import type { ReactNode, RefObject } from "react";
import type { Warfare } from "./gameModel";
import {
  ENGAGEMENT_OPTIONS,
  FORMATION_OPTIONS,
  COORDINATION_OPTIONS,
  RISK_TREATMENT_OPTIONS,
  SENSOR_OPTIONS,
  STRATEGIC_FORCE_OPTIONS,
  TEMPO_OPTIONS,
  UNDERSEA_DOCTRINE_OPTIONS,
  UNCREWED_DOCTRINE_OPTIONS,
  turnLearningNote,
  type RigidGameState,
  type RigidOrders,
} from "./kriegsspiel";
import { FLEET_METHOD_LABELS, POSTURE_LABELS, type OperationalStrategy } from "./operationalStrategy";
import TurnSituationPanel, {
  type SituationObjective,
  type TurnSituationEvent,
} from "./TurnSituationPanel";
import {
  canDiscloseOpposingImpact,
  publicKnowledgeForDisruption,
  type ContactVisibility,
} from "./contactVisualization";

type CommandPanelProps = {
  state: RigidGameState;
  orders: RigidOrders;
  warfareAreas: Warfare[];
  warfareLabel: (area: Warfare) => string;
  headingRef: RefObject<HTMLHeadingElement | null>;
  planningRecap: ReactNode;
  operationalStrategy: OperationalStrategy;
  adversaryCount: number;
  contactVisibility: ContactVisibility;
  onOrdersChange: (value: Partial<RigidOrders>) => void;
  onResolve: () => void;
  onUndo: () => void;
  onReturn: () => void;
};

type OrderOption = { value: string; label: string; note: string };

function OrderField({ id, label, value, options, onChange }: {
  id: string;
  label: string;
  value: string;
  options: readonly OrderOption[];
  onChange: (value: string) => void;
}) {
  const noteId = `${id}-note`;
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <select id={id} aria-describedby={noteId} value={value} onChange={(event) => onChange(event.currentTarget.value)}>
        {options.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
      <small id={noteId}>{options.find((item) => item.value === value)?.note}</small>
    </div>
  );
}

export default function CommandPanel({
  state,
  orders,
  warfareAreas,
  warfareLabel,
  headingRef,
  planningRecap,
  operationalStrategy,
  adversaryCount,
  contactVisibility,
  onOrdersChange,
  onResolve,
  onUndo,
  onReturn,
}: CommandPanelProps) {
  const latestReport = state.reports.at(-1);
  const displayTurn = Math.min(state.maxTurns, state.turn + 1);
  const matrix = state.matrix;
  const situationEvents: TurnSituationEvent[] = (matrix?.activeDisruptions ?? []).map((event) => ({
    id: event.id,
    kind: event.kind,
    severity: event.severity,
    headline: event.headline,
    description: event.description,
    startsTurn: event.startsTurn,
    endsTurn: event.endsTurn,
    knowledge: publicKnowledgeForDisruption(event, state.contactQuality, contactVisibility),
    impacts: (state.disruptionImpacts ?? []).filter((impact) => impact.disruptionId === event.id).map((impact) => ({
      id: impact.id,
      side: impact.side,
      kind: impact.domain === "air" ? "aircraft" : impact.domain === "subsurface" ? "submarine" : impact.domain === "surface" ? "vessel" : impact.domain === "mission-pack" ? "mission-pack" : "capability",
      label: impact.label,
      quantity: impact.quantity,
      status: impact.status,
      unavailableThroughTurn: impact.unavailableThroughTurn,
      capabilitiesUnavailable: impact.capabilitiesUnavailable,
      knowledge: impact.side === "opposing-force"
        && !canDiscloseOpposingImpact(impact.domain, state.contactQuality, contactVisibility)
        ? "concealed"
        : impact.knowledge,
    })),
  }));
  const objectives: SituationObjective[] = [
    { id: "primary", kind: "primary", label: "Primary mission objective", status: state.objectiveProgress >= 100 ? "complete" : "active", progress: state.objectiveProgress, revealedTurn: 1 },
    ...(matrix?.activeSecondaryObjective && displayTurn >= matrix.activeSecondaryObjective.revealTurn ? [{
      id: matrix.activeSecondaryObjective.id,
      kind: "secondary" as const,
      label: matrix.activeSecondaryObjective.label,
      status: (state.secondaryObjectiveProgress ?? 0) >= 100 ? "complete" as const : "active" as const,
      progress: state.secondaryObjectiveProgress ?? 0,
      revealedTurn: matrix.activeSecondaryObjective.revealTurn,
    }] : []),
  ];
  return (
    <section className="kriegsspiel-panel" aria-labelledby="rigid-turn-heading">
      <div className="kriegsspiel-header">
        <div>
          <span className="kriegsspiel-kicker">COMMAND</span>
          <h2 ref={headingRef} id="rigid-turn-heading" className="kriegsspiel-title" tabIndex={-1}>TURN {state.turn + 1} OF {state.maxTurns}</h2>
        </div>
        <span className="kriegsspiel-meta">{state.turn < 2 ? "APPROACH & CLASSIFICATION" : state.turn < 4 ? "CONTEST & MANOEUVRE" : "DECISION & TRANSITION"}</span>
      </div>

      <dl className="kriegsspiel-grid" aria-label={`State at the start of turn ${state.turn + 1}`}>
        <div className="kriegsspiel-row"><dt className="kriegsspiel-label">RANGE</dt><dd className="kriegsspiel-value">{state.rangeNm} invented nm</dd></div>
        <div className="kriegsspiel-row"><dt className="kriegsspiel-label">CONTACT QUALITY</dt><dd className="kriegsspiel-value">{state.contactQuality}/100</dd></div>
        <div className="kriegsspiel-row"><dt className="kriegsspiel-label">FORCE INTEGRITY</dt><dd className="kriegsspiel-value">{state.integrity}/100</dd></div>
        <div className="kriegsspiel-row"><dt className="kriegsspiel-label">COMMAND READINESS</dt><dd className="kriegsspiel-value">{state.readiness}/100</dd></div>
        <div className="kriegsspiel-row"><dt className="kriegsspiel-label">SUPPLY</dt><dd className="kriegsspiel-value">{state.supply}/100</dd></div>
        <div className="kriegsspiel-row"><dt className="kriegsspiel-label">OBJECTIVE PROGRESS</dt><dd className="kriegsspiel-value">{state.objectiveProgress}/100</dd></div>
        <div className="kriegsspiel-row"><dt className="kriegsspiel-label">ESCALATION</dt><dd className="kriegsspiel-value">{state.escalation}/100</dd></div>
      </dl>

      {matrix && (
        <TurnSituationPanel
          id="command-situation"
          turn={displayTurn}
          maxTurns={state.maxTurns}
          events={situationEvents}
          objectives={objectives}
        />
      )}

      <details className="kriegsspiel-report operational-frame">
        <summary>OPERATIONAL FRAME</summary>
        <dl>
          <div><dt>Friendly method</dt><dd>{FLEET_METHOD_LABELS[operationalStrategy.friendlyMethod]}</dd></div>
          <div><dt>Friendly posture</dt><dd>{POSTURE_LABELS[operationalStrategy.friendlyPosture]}</dd></div>
          <div><dt>Assessed opposing method</dt><dd>{FLEET_METHOD_LABELS[operationalStrategy.opposingMethod]}</dd></div>
          <div><dt>Assessed opposing posture</dt><dd>{POSTURE_LABELS[operationalStrategy.opposingPosture]}</dd></div>
          <div><dt>Distinct opposing actors</dt><dd>{adversaryCount}</dd></div>
        </dl>
        <ul>{operationalStrategy.environmentEffects.map((effect) => <li key={effect}>{effect}</li>)}</ul>
      </details>

      {latestReport && (
        <details className="kriegsspiel-report">
          <summary>LAST TURN · {latestReport.turn}</summary>
          <p>{latestReport.contactReport}</p>
          <p><b>CHANGE</b> contact {latestReport.delta.contactQuality > 0 ? "+" : ""}{latestReport.delta.contactQuality}; integrity {latestReport.delta.integrity > 0 ? "+" : ""}{latestReport.delta.integrity}; supply {latestReport.delta.supply > 0 ? "+" : ""}{latestReport.delta.supply}; objective {latestReport.delta.objectiveProgress > 0 ? "+" : ""}{latestReport.delta.objectiveProgress}; escalation {latestReport.delta.escalation > 0 ? "+" : ""}{latestReport.delta.escalation}.</p>
          {(() => {
            const learning = turnLearningNote(latestReport);
            return <p data-learning-kind={learning.kind}><b>{learning.heading}</b>{learning.summary}</p>;
          })()}
        </details>
      )}

      <div className="kriegsspiel-orders" role="group" aria-labelledby="turn-orders-title">
        <h3 id="turn-orders-title" className="visually-hidden">Orders for turn {state.turn + 1}</h3>
        <OrderField id="rigid-formation" label="FORMATION" value={orders.formation} options={FORMATION_OPTIONS} onChange={(value) => onOrdersChange({ formation: value as RigidOrders["formation"] })} />
        <OrderField id="rigid-sensors" label="SENSOR POLICY" value={orders.sensors} options={SENSOR_OPTIONS} onChange={(value) => onOrdersChange({ sensors: value as RigidOrders["sensors"] })} />
        <OrderField id="rigid-tempo" label="TEMPO" value={orders.tempo} options={TEMPO_OPTIONS} onChange={(value) => onOrdersChange({ tempo: value as RigidOrders["tempo"] })} />
        <OrderField id="rigid-engagement" label="ENGAGEMENT POSTURE" value={orders.engagement} options={ENGAGEMENT_OPTIONS} onChange={(value) => onOrdersChange({ engagement: value as RigidOrders["engagement"] })} />
        <OrderField id="rigid-uncrewed" label="UNCREWED EMPLOYMENT" value={orders.uncrewed ?? "distributed-scouting"} options={UNCREWED_DOCTRINE_OPTIONS} onChange={(value) => onOrdersChange({ uncrewed: value as NonNullable<RigidOrders["uncrewed"]> })} />
        <OrderField id="rigid-undersea" label="UNDERSEA EMPLOYMENT" value={orders.undersea ?? "independent-patrol"} options={UNDERSEA_DOCTRINE_OPTIONS} onChange={(value) => onOrdersChange({ undersea: value as NonNullable<RigidOrders["undersea"]> })} />
        <OrderField id="rigid-risk-treatment" label="RISK TREATMENT" value={orders.riskTreatment ?? "prepare"} options={RISK_TREATMENT_OPTIONS} onChange={(value) => onOrdersChange({ riskTreatment: value as NonNullable<RigidOrders["riskTreatment"]> })} />
        <OrderField id="rigid-coordination" label="COORDINATION" value={orders.coordination ?? "federated"} options={COORDINATION_OPTIONS} onChange={(value) => onOrdersChange({ coordination: value as NonNullable<RigidOrders["coordination"]> })} />
        <OrderField id="rigid-strategic-policy" label="STRATEGIC FORCE POLICY" value={orders.strategicPolicy ?? "conventional-restraint"} options={STRATEGIC_FORCE_OPTIONS} onChange={(value) => onOrdersChange({ strategicPolicy: value as NonNullable<RigidOrders["strategicPolicy"]> })} />
        <div><label htmlFor="rigid-task">ASSIGNED WARFARE TASK</label><select id="rigid-task" aria-describedby="rigid-task-note" value={orders.task} onChange={(event) => onOrdersChange({ task: event.target.value as Warfare })}>{warfareAreas.map((area) => <option key={area} value={area}>{warfareLabel(area)}</option>)}</select><small id="rigid-task-note">Apply the selected formation, sensor policy, tempo, and engagement posture to this identified warfare area.</small></div>
      </div>

      <div className="kriegsspiel-actions">
        <button type="button" className="resolve-turn" onClick={onResolve}>RESOLVE TURN {state.turn + 1}</button>
        {state.reports.length > 0 && <button type="button" onClick={onUndo}>UNDO LAST TURN</button>}
        <button type="button" onClick={onReturn}>END &amp; RETURN TO PLANNING</button>
      </div>
      {planningRecap}
    </section>
  );
}
