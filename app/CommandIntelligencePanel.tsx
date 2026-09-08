import type { RefObject } from "react";
import {
  commandIntelligenceAnnouncement,
  deriveCommandIntelligence,
  formatAdversaryAssessment,
  formatCommandIntelligenceFact,
  type AssumptionOption,
  type CommandIntelligenceFact,
} from "./commandIntelligence";
import type {
  AdversaryIntentAssumption,
  AdversaryNextActionAssumption,
  ObservedPatternAssumption,
  RigidAdversaryAssessment,
  RigidGameState,
  RigidOrders,
} from "./kriegsspiel";

export const COMMAND_ORDERS_FORM_ID = "command-orders-form";

type CommandIntelligencePanelProps = {
  state: RigidGameState;
  orders: RigidOrders;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onOrdersChange: (value: Partial<RigidOrders>) => void;
};

function AssumptionSelect<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: T | undefined;
  options: readonly AssumptionOption<T>[];
  onChange: (value: T) => void;
}) {
  const noteId = `${id}-note`;
  return (
    <div className="intelligence-assumption-field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        name={id}
        form={COMMAND_ORDERS_FORM_ID}
        required
        aria-describedby={`${noteId} command-potentials-boundary`}
        value={value ?? ""}
        onChange={(event) => onChange(event.currentTarget.value as T)}
      >
        <option value="" disabled>Choose a working assumption</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <small id={noteId}>{options.find((option) => option.value === value)?.note ?? "Select a reasonable reading or explicitly record that the evidence is insufficient."}</small>
    </div>
  );
}

function IntelligenceFact({ fact }: { fact: CommandIntelligenceFact }) {
  const copy = formatCommandIntelligenceFact(fact);
  return (
    <li
      data-knowledge={fact.knowledge}
      data-occurred-turn={fact.occurredTurn}
      data-discovered-turn={fact.discoveredTurn}
    >
      <b>{copy.label}</b>
      <span>{copy.detail}</span>
    </li>
  );
}

export default function CommandIntelligencePanel({
  state,
  orders,
  headingRef,
  onOrdersChange,
}: CommandIntelligencePanelProps) {
  const view = deriveCommandIntelligence(state);
  const currentTurn = Math.min(state.maxTurns, state.turn + 1);
  const assessment = orders.adversaryAssessment ?? {};
  const updateAssessment = (value: Partial<RigidAdversaryAssessment>) => onOrdersChange({
    adversaryAssessment: { ...assessment, ...value },
  });

  return (
    <aside className="command-intelligence-panel" aria-labelledby="command-intelligence-heading">
      <header className="command-intelligence-header">
        <span>TURN {currentTurn} INTELLIGENCE</span>
        <h2 ref={headingRef} id="command-intelligence-heading" tabIndex={-1}>KNOWN PICTURE &amp; LOG</h2>
      </header>
      <p className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
        {commandIntelligenceAnnouncement(state, view.immediate)}
      </p>

      <section id="command-known" className="command-intelligence-section" aria-labelledby="command-known-heading">
        <h3 id="command-known-heading">ABSOLUTELY KNOWN</h3>
        <p>These are strike-group observations and current game indices—not inferred opposing intent.</p>
        <dl className="intelligence-state-grid" aria-label={`Absolutely known state before turn ${currentTurn}`}>
          <div><dt>RANGE INDEX</dt><dd>{state.rangeNm} invented nm</dd></div>
          <div><dt>CONTACT QUALITY</dt><dd>{state.contactQuality}/100</dd></div>
          <div><dt>FORCE INTEGRITY</dt><dd>{state.integrity}/100</dd></div>
          <div><dt>COMMAND READINESS</dt><dd>{state.readiness}/100</dd></div>
          <div><dt>SUPPLY</dt><dd>{state.supply}/100</dd></div>
          <div><dt>OBJECTIVE</dt><dd>{state.objectiveProgress}/100</dd></div>
          {state.matrix?.activeSecondaryObjective
            && state.matrix.activeSecondaryObjective.revealTurn <= currentTurn
            && <div><dt>SECONDARY OBJECTIVE</dt><dd>{state.secondaryObjectiveProgress ?? 0}/100</dd></div>}
          <div><dt>ESCALATION</dt><dd>{state.escalation}/100</dd></div>
        </dl>
        {view.lastKnownAdversaryAction ? (
          <div className="intelligence-last-known">
            <b>LAST ABSOLUTELY KNOWN OPPOSING ACTION</b>
            <p>{formatCommandIntelligenceFact(view.lastKnownAdversaryAction).detail}</p>
            <small>Occurred turn {view.lastKnownAdversaryAction.occurredTurn}; discovered turn {view.lastKnownAdversaryAction.discoveredTurn}.</small>
          </div>
        ) : <p className="intelligence-empty">No opposing action is yet known absolutely.</p>}
      </section>

      <section id="command-potentials" className="command-intelligence-section" aria-labelledby="command-potentials-heading">
        <h3 id="command-potentials-heading">POTENTIALS · STAFF JUDGMENT</h3>
        {state.turn === 0 ? (
          <p className="intelligence-empty">Turn 1 establishes the baseline. From turn 2, record how you read the opposition before issuing orders.</p>
        ) : (
          <>
            <p id="command-potentials-boundary">Required for this turn. These bounded choices are hypotheses, not facts; they do not change the score or adjudication.</p>
            <div className="intelligence-assumptions">
              <AssumptionSelect<AdversaryIntentAssumption>
                id="adversary-intent-assumption"
                label="WHAT MAY THE OPPOSITION WANT?"
                value={assessment.intent}
                options={view.potentials.intent}
                onChange={(intent) => updateAssessment({ intent })}
              />
              <AssumptionSelect<ObservedPatternAssumption>
                id="observed-pattern-assumption"
                label="WHAT MAY THE OBSERVABLE PATTERN MEAN?"
                value={assessment.observedPattern}
                options={view.potentials.observedPattern}
                onChange={(observedPattern) => updateAssessment({ observedPattern })}
              />
              <AssumptionSelect<AdversaryNextActionAssumption>
                id="adversary-next-action-assumption"
                label="WHAT MAY THE OPPOSITION DO NEXT?"
                value={assessment.nextAction}
                options={view.potentials.nextAction}
                onChange={(nextAction) => updateAssessment({ nextAction })}
              />
            </div>
          </>
        )}
      </section>

      <section id="command-log" className="command-intelligence-section" aria-labelledby="command-log-heading">
        <h3 id="command-log-heading">LOG</h3>
        <section id="command-log-immediate" className="intelligence-immediate" aria-labelledby="command-log-immediate-heading">
          <h4 id="command-log-immediate-heading">IMMEDIATE</h4>
          {view.immediate.length ? (
            <ul>{view.immediate.map((fact) => <IntelligenceFact key={fact.id} fact={fact} />)}</ul>
          ) : <p className="intelligence-empty">No absolute opposing action or infliction is available for Immediate.</p>}
          <small>Infliction values are invented game effects, not real-world battle-damage assessments.</small>
        </section>

        <details id="command-log-history" className="situation-history">
          <summary>HISTORY · {view.history.length} {view.history.length === 1 ? "TURN" : "TURNS"}</summary>
          <div className="intelligence-history-turns">
            {view.history.length ? view.history.map((turn) => {
              const recordedAssessment = formatAdversaryAssessment(state.reports[turn.occurredTurn - 1]?.orders.adversaryAssessment);
              return (
                <section key={turn.occurredTurn} id={`command-history-turn-${turn.occurredTurn}`} aria-labelledby={`command-history-turn-${turn.occurredTurn}-heading`}>
                  <h4 id={`command-history-turn-${turn.occurredTurn}-heading`}>TURN {turn.occurredTurn}</h4>
                  {recordedAssessment && (
                    <div className="intelligence-recorded-assessment">
                      <b>WORKING ASSUMPTIONS RECORDED</b>
                      <span>Intent: {recordedAssessment.intent}</span>
                      <span>Pattern: {recordedAssessment.observedPattern}</span>
                      <span>Next action: {recordedAssessment.nextAction}</span>
                    </div>
                  )}
                  {turn.discoveryGroups.length ? turn.discoveryGroups.map((group) => (
                    <section key={group.discoveredTurn} aria-labelledby={`command-history-turn-${turn.occurredTurn}-discovered-${group.discoveredTurn}`}>
                      <h5 id={`command-history-turn-${turn.occurredTurn}-discovered-${group.discoveredTurn}`}>Discovered during Turn {group.discoveredTurn}</h5>
                      <ul>{group.facts.map((fact) => <IntelligenceFact key={fact.id} fact={fact} />)}</ul>
                    </section>
                  )) : <p className="intelligence-empty">No absolute change was logged for this turn.</p>}
                </section>
              );
            }) : <p className="intelligence-empty">History begins after Turn 1 resolves.</p>}
          </div>
        </details>
      </section>
    </aside>
  );
}
