import { useEffect, useRef, useState } from "react";
import DecisionStep, { type DecisionStepStatus } from "./DecisionStep";
import type { EndState, Guardrail, TheoryLens } from "./gameModel";
import { INPUT_LIMITS } from "./inputSecurity";
import { FLEET_METHOD_LABELS, POSTURE_LABELS, UNDERSEA_DOCTRINE_OPTIONS, UNCREWED_DOCTRINE_OPTIONS, type OperationalStrategy } from "./operationalStrategy";

type Option<T extends string> = { id: T; label: string };
type TheoryOption = Option<TheoryLens> & { note: string };

type StrategicDecisionFlowProps = {
  politicalAim: string;
  navalProblem: string;
  warfareSelected: boolean;
  completed: number;
  endStates: Array<Option<EndState>>;
  theories: TheoryOption[];
  guardrails: Array<Option<Guardrail>>;
  selectedEndState: EndState | "";
  selectedLens: TheoryLens | "";
  selectedPartnerLens: TheoryLens | "";
  selectedGuardrail: Guardrail | "";
  theorySynthesis: string;
  rationale: string;
  assumptions: string;
  termination: string;
  operationalStrategy: OperationalStrategy;
  onEndState: (value: EndState | "") => void;
  onPrimaryLens: (value: TheoryLens | "") => void;
  onPartnerLens: (value: TheoryLens | "") => void;
  onGuardrail: (value: Guardrail | "") => void;
  onWriting: (field: "theorySynthesis" | "rationale" | "assumptions" | "termination", value: string) => void;
};

function optionLabel<T extends string>(options: readonly Option<T>[], selected: T | "") {
  return options.find((item) => item.id === selected)?.label || "Not yet selected";
}

function optionValue<T extends string>(options: readonly Option<T>[], value: string): T | "" {
  return options.find((item) => item.id === value)?.id || "";
}

export default function StrategicDecisionFlow(props: StrategicDecisionFlowProps) {
  const [editingStep, setEditingStep] = useState<number | null>(null);
  const selectRefs = useRef<Array<HTMLSelectElement | null>>([]);
  const summaryRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const pendingFocus = useRef<{ kind: "select" | "summary"; index: number } | null>(null);
  const primary = props.theories.find((item) => item.id === props.selectedLens);
  const partner = props.theories.find((item) => item.id === props.selectedPartnerLens);
  const selected = [
    Boolean(props.selectedEndState),
    Boolean(props.selectedLens),
    Boolean(props.selectedPartnerLens),
    Boolean(props.selectedGuardrail),
  ];
  const unlocked = [
    props.warfareSelected,
    props.warfareSelected && selected[0],
    props.warfareSelected && selected[0] && selected[1],
    props.warfareSelected && selected[0] && selected[1] && selected[2],
  ];
  const firstIncomplete = unlocked.findIndex((isUnlocked, index) => isUnlocked && !selected[index]);
  const expandedStep = editingStep !== null && unlocked[editingStep]
    ? editingStep
    : firstIncomplete;
  const stepStatus = (index: number): DecisionStepStatus => {
    if (index === expandedStep) return "current";
    if (!unlocked[index]) return "locked";
    return selected[index] ? "complete" : "locked";
  };
  const editStep = (index: number) => {
    pendingFocus.current = { kind: "select", index };
    setEditingStep(index);
  };
  const advanceFrom = (index: number, value: string) => {
    if (!value) {
      setEditingStep(index);
      return;
    }
    if (index < 3) {
      pendingFocus.current = { kind: "select", index: index + 1 };
      setEditingStep(index + 1);
      return;
    }
    pendingFocus.current = { kind: "summary", index };
    setEditingStep(null);
  };

  useEffect(() => {
    const pending = pendingFocus.current;
    if (!pending) return;
    const target = pending.kind === "select"
      ? selectRefs.current[pending.index]
      : summaryRefs.current[pending.index];
    if (!target) return;
    target.focus();
    pendingFocus.current = null;
  }, [expandedStep, props.selectedEndState, props.selectedLens, props.selectedPartnerLens, props.selectedGuardrail]);

  return (
    <div className="strategy-frame">
      <div className="section-title"><span><small>03</small> STRATEGIC FRAME</span><i>{props.completed}/4 answered</i></div>
      <p><b>POLITICAL AIM</b>{props.politicalAim}</p>
      <p className="naval-problem"><b>NAVAL-THEORY PROBLEM</b>{props.navalProblem}</p>
      <details className="operational-guidance">
        <summary>ENVIRONMENT &amp; OPERATING METHOD</summary>
        <dl>
          <div><dt>Friendly method</dt><dd>{FLEET_METHOD_LABELS[props.operationalStrategy.friendlyMethod]}</dd></div>
          <div><dt>Friendly posture</dt><dd>{POSTURE_LABELS[props.operationalStrategy.friendlyPosture]}</dd></div>
          <div><dt>Assessed opposing method</dt><dd>{FLEET_METHOD_LABELS[props.operationalStrategy.opposingMethod]}</dd></div>
          <div><dt>Assessed opposing posture</dt><dd>{POSTURE_LABELS[props.operationalStrategy.opposingPosture]}</dd></div>
          <div><dt>Environment-suited uncrewed method</dt><dd>{UNCREWED_DOCTRINE_OPTIONS.find((item) => item.value === props.operationalStrategy.recommendedUncrewed)?.label}</dd></div>
          <div><dt>Environment-suited undersea method</dt><dd>{UNDERSEA_DOCTRINE_OPTIONS.find((item) => item.value === props.operationalStrategy.recommendedUndersea)?.label}</dd></div>
        </dl>
        <ul>{props.operationalStrategy.environmentEffects.map((effect) => <li key={effect}>{effect}</li>)}</ul>
        <p><small>This is a planning frame, not a revealed answer. Compare it with the political aim, available force, and likely opposing adaptation.</small></p>
      </details>
      {!props.warfareSelected && (
        <p className="progressive-prompt" role="status" aria-live="polite" aria-atomic="true"><b>NEXT</b>Identify the warfare areas above to unlock the objective decision.</p>
      )}
      <ol className="decision-steps" aria-label="Strategic decisions">
        <DecisionStep
          number={1}
          title="MISSION OBJECTIVE / DESIRED END STATE"
          status={stepStatus(0)}
          summary={optionLabel(props.endStates, props.selectedEndState)}
          lockedReason="Identify at least one warfare area first."
          onEdit={() => editStep(0)}
          editButtonRef={(node) => { summaryRefs.current[0] = node; }}
        >
          <label htmlFor="strategic-end-state">
            <span>Determine the objective</span>
            <select
              id="strategic-end-state"
              ref={(node) => { selectRefs.current[0] = node; }}
              value={props.selectedEndState}
              onChange={(event) => {
                const value = optionValue(props.endStates, event.currentTarget.value);
                props.onEndState(value);
                advanceFrom(0, value);
              }}
            >
              <option value="">Determine the objective…</option>
              {props.endStates.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
        </DecisionStep>
        <DecisionStep
          number={2}
          title="PRIMARY THEORY"
          status={stepStatus(1)}
          summary={optionLabel(props.theories, props.selectedLens)}
          lockedReason="Choose the mission objective first."
          note={primary?.note}
          onEdit={() => editStep(1)}
          editButtonRef={(node) => { summaryRefs.current[1] = node; }}
        >
          <label htmlFor="strategic-primary-theory">
            <span>Choose the primary mechanism</span>
            <select
              id="strategic-primary-theory"
              ref={(node) => { selectRefs.current[1] = node; }}
              value={props.selectedLens}
              onChange={(event) => {
                const value = optionValue(props.theories, event.currentTarget.value);
                props.onPrimaryLens(value);
                advanceFrom(1, value);
              }}
            >
              <option value="">Choose the primary mechanism…</option>
              {props.theories.map((item) => <option key={item.id} value={item.id} disabled={item.id === props.selectedPartnerLens}>{item.label}</option>)}
            </select>
          </label>
        </DecisionStep>
        <DecisionStep
          number={3}
          title="COMPLEMENT OR CHALLENGE"
          status={stepStatus(2)}
          summary={optionLabel(props.theories, props.selectedPartnerLens)}
          lockedReason="Choose the primary theory first."
          note={partner?.note}
          onEdit={() => editStep(2)}
          editButtonRef={(node) => { summaryRefs.current[2] = node; }}
        >
          <label htmlFor="strategic-partner-theory">
            <span>Choose a distinct second theory</span>
            <select
              id="strategic-partner-theory"
              ref={(node) => { selectRefs.current[2] = node; }}
              value={props.selectedPartnerLens}
              onChange={(event) => {
                const value = optionValue(props.theories, event.currentTarget.value);
                props.onPartnerLens(value);
                advanceFrom(2, value);
              }}
            >
              <option value="">Choose a second theory…</option>
              {props.theories.map((item) => <option key={item.id} value={item.id} disabled={item.id === props.selectedLens}>{item.label}</option>)}
            </select>
          </label>
        </DecisionStep>
        <DecisionStep
          number={4}
          title="CONTROLLING GUARDRAIL"
          status={stepStatus(3)}
          summary={optionLabel(props.guardrails, props.selectedGuardrail)}
          lockedReason="Choose the complementary or challenging theory first."
          onEdit={() => editStep(3)}
          editButtonRef={(node) => { summaryRefs.current[3] = node; }}
        >
          <label htmlFor="strategic-guardrail">
            <span>Choose the controlling guardrail</span>
            <select
              id="strategic-guardrail"
              ref={(node) => { selectRefs.current[3] = node; }}
              value={props.selectedGuardrail}
              onChange={(event) => {
                const value = optionValue(props.guardrails, event.currentTarget.value);
                props.onGuardrail(value);
                advanceFrom(3, value);
              }}
            >
              <option value="">Choose a guardrail…</option>
              {props.guardrails.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
        </DecisionStep>
      </ol>
      {props.selectedGuardrail && (
        <details className="optional-analysis">
          <summary>OPTIONAL WRITTEN ANALYSIS · NEVER SCORED</summary>
          <label><span>NAVAL-THEORY SYNTHESIS</span><textarea value={props.theorySynthesis} maxLength={INPUT_LIMITS.writtenDecision} onChange={(event) => props.onWriting("theorySynthesis", event.target.value)} placeholder="Record how the theories combine, conflict, or expose different assumptions…" rows={5} /></label>
          <div className="logic-fields">
            <label><span>COMMANDER&apos;S LOGIC</span><textarea value={props.rationale} maxLength={INPUT_LIMITS.writtenDecision} onChange={(event) => props.onWriting("rationale", event.target.value)} placeholder="Explain how the force and chosen theory create the political end state…" rows={4} /></label>
            <label><span>KEY ASSUMPTIONS</span><textarea value={props.assumptions} maxLength={INPUT_LIMITS.writtenDecision} onChange={(event) => props.onWriting("assumptions", event.target.value)} placeholder="What must be true? What might the opponent do differently?" rows={3} /></label>
            <label><span>TERMINATION / TRANSITION</span><textarea value={props.termination} maxLength={INPUT_LIMITS.writtenDecision} onChange={(event) => props.onWriting("termination", event.target.value)} placeholder="What observable condition ends or changes the mission?" rows={3} /></label>
          </div>
          <small className="synthesis-count">Saved for your review. Writing does not affect the score.</small>
        </details>
      )}
    </div>
  );
}
