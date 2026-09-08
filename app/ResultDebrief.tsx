"use client";

import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from "react";
import {
  COORDINATION_OPTIONS,
  ENGAGEMENT_OPTIONS,
  FORMATION_OPTIONS,
  RISK_TREATMENT_OPTIONS,
  SENSOR_OPTIONS,
  STRATEGIC_FORCE_OPTIONS,
  TEMPO_OPTIONS,
  UNDERSEA_DOCTRINE_OPTIONS,
  UNCREWED_DOCTRINE_OPTIONS,
  outcomeLearningAssessment,
  turnLearningNote,
  type RigidGameState,
} from "./kriegsspiel";
import type { SavedResult } from "./saveGame";
import type { Warfare } from "./gameModel";
import { latticeCopy } from "./latticeCopy";
import {
  deriveCommandIntelligence,
  formatAdversaryAssessment,
  formatCommandIntelligenceFact,
} from "./commandIntelligence";

type ResultDebriefProps = {
  result: SavedResult;
  state: RigidGameState;
  headingRef: RefObject<HTMLElement | null>;
  planningRecap: ReactNode;
  warfareLabel: (area: Warfare) => string;
  onOpenLesson: (moduleId: string) => void;
  onUndo: () => void;
  onRetry: () => void;
  onReturn: () => void;
  onNewScenario: () => void;
};

const optionLabel = (options: ReadonlyArray<{ value: string; label: string }>, value: string) => (
  options.find((option) => option.value === value)?.label ?? value
);

export default function ResultDebrief({
  result,
  state,
  headingRef,
  planningRecap,
  warfareLabel,
  onOpenLesson,
  onUndo,
  onRetry,
  onReturn,
  onNewScenario,
}: ResultDebriefProps) {
  const learning = outcomeLearningAssessment(state);
  const intelligence = deriveCommandIntelligence(state);
  const secondaryObjective = state.matrix?.activeSecondaryObjective;
  const secondaryObjectiveDisclosed = Boolean(secondaryObjective && secondaryObjective.revealTurn <= state.turn);
  const scrollReview = (event: ReactKeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target !== event.currentTarget && target.id !== "result-heading") return;
    const review = event.currentTarget;
    if (event.key === "PageDown") {
      event.preventDefault();
      review.scrollTop = Math.min(review.scrollHeight - review.clientHeight, review.scrollTop + Math.max(120, review.clientHeight * 0.8));
    } else if (event.key === "PageUp") {
      event.preventDefault();
      review.scrollTop = Math.max(0, review.scrollTop - Math.max(120, review.clientHeight * 0.8));
    } else if (event.key === "End") {
      event.preventDefault();
      review.scrollTop = review.scrollHeight;
    } else if (event.key === "Home") {
      event.preventDefault();
      review.scrollTop = 0;
    }
  };

  return (
    <section ref={headingRef} className={`result-card ${result.won ? "victory" : "loss"}`} role="region" aria-labelledby="result-heading" aria-describedby="result-threshold-summary result-index-caveat" aria-keyshortcuts="PageUp PageDown Home End" tabIndex={0} onKeyDown={scrollReview}>
      <header className="result-summary">
        <div className="result-score"><span>{result.score}<b>/100</b></span><small>FINAL<br />SCORE</small></div>
        <div><small>{result.difficulty.toUpperCase()} REVIEW</small><h2 id="result-heading" tabIndex={-1}>{result.title}</h2><p id="result-threshold-summary">Final state: objective {state.objectiveProgress}{secondaryObjectiveDisclosed ? `; secondary objective ${state.secondaryObjectiveProgress ?? 0}` : ""}; integrity {state.integrity}; supply {state.supply}; escalation {state.escalation}.</p><p id="result-index-caveat" className="result-index-caveat">All /100 values are invented game indices—not probabilities, forecasts, or real operational assessments.</p></div>
      </header>
      <div className="result-actions" role="group" aria-label="Debrief actions"><button type="button" onClick={onUndo}>UNDO FINAL TURN</button><button type="button" onClick={onRetry}>RETRY SAME SCENARIO</button><button type="button" onClick={onReturn}>RETURN TO PLANNING</button><button type="button" onClick={onNewScenario}>NEW SCENARIO</button></div>
      <section id="result-learning" className={`result-learning ${learning.kind}`} aria-labelledby="result-learning-title">
        <h3 id="result-learning-title">{learning.heading}</h3>
        <p>{learning.summary}</p>
      </section>
      {state.escalation > result.breakdown.escalationLimit && <p className="result-index-caveat">The controlling escalation boundary was exceeded.</p>}
      <p id="result-notes" className="result-index-caveat">{latticeCopy("game.outcome.unscoredWriting")}</p>
      <details className="score-breakdown">
        <summary id="score-breakdown-title">SCORE COMPONENTS</summary>
        <dl>
          <div><dt>Objective</dt><dd>{result.breakdown.objective}</dd></div>
          <div><dt>Opposing disruption</dt><dd>{result.breakdown.opposingDisruption}</dd></div>
          <div><dt>Integrity</dt><dd>{result.breakdown.forceIntegrity}</dd></div>
          <div><dt>Readiness</dt><dd>{result.breakdown.commandReadiness}</dd></div>
          <div><dt>Supply</dt><dd>{result.breakdown.supply}</dd></div>
          <div><dt>Contact</dt><dd>{result.breakdown.contactQuality}</dd></div>
          <div><dt>Escalation discipline</dt><dd>{result.breakdown.escalationDiscipline}</dd></div>
          <div><dt>Planning</dt><dd>{result.breakdown.planning}</dd></div>
        </dl>
      </details>
      {result.findings.length > 0 && <details className="debrief-findings" open={learning.kind === "adjustment"}>
        <summary id="findings-title">WHAT TO LEARN · {result.findings.length}</summary>
        {result.findings.map((finding, index) => (
          <article key={finding.code} aria-labelledby={`finding-${finding.code}`}>
            <h4 id={`finding-${finding.code}`}>{finding.cause}</h4>
            <p><b>TURN EVIDENCE</b>{finding.evidence}</p>
            <p><b>ONE ADJUSTMENT</b>{finding.adjustment}</p>
            <button type="button" aria-label={`Open related lesson ${index + 1}: ${finding.cause}`} onClick={() => onOpenLesson(finding.moduleId)}>OPEN RELATED LESSON</button>
          </article>
        ))}
      </details>}
      <details id="turn-timeline-learning" className="turn-timeline">
        <summary>{state.maxTurns}-TURN TIMELINE &amp; INTELLIGENCE LOG · {state.reports.length} REPORTS</summary>
        {state.reports.map((report) => {
          const historyTurn = intelligence.history.find((turn) => turn.occurredTurn === report.turn);
          const assessment = formatAdversaryAssessment(report.orders.adversaryAssessment);
          return <article key={report.turn}>
            <h4>TURN {report.turn} · {report.phase}</h4>
            <p>{report.contactReport}</p>
            <p><b>ORDERS</b>{FORMATION_OPTIONS.find((item) => item.value === report.orders.formation)?.label}; {SENSOR_OPTIONS.find((item) => item.value === report.orders.sensors)?.label}; {TEMPO_OPTIONS.find((item) => item.value === report.orders.tempo)?.label}; {ENGAGEMENT_OPTIONS.find((item) => item.value === report.orders.engagement)?.label}; {UNCREWED_DOCTRINE_OPTIONS.find((item) => item.value === (report.orders.uncrewed ?? "distributed-scouting"))?.label}; {UNDERSEA_DOCTRINE_OPTIONS.find((item) => item.value === (report.orders.undersea ?? "independent-patrol"))?.label}; {warfareLabel(report.orders.task)}.</p>
            <p><b>COMMAND POLICIES</b>Risk treatment: {optionLabel(RISK_TREATMENT_OPTIONS, report.orders.riskTreatment ?? "prepare")}; coordination: {optionLabel(COORDINATION_OPTIONS, report.orders.coordination ?? "federated")}; strategic force policy: {optionLabel(STRATEGIC_FORCE_OPTIONS, report.orders.strategicPolicy ?? "conventional-restraint")}.</p>
            {report.orders.strategicPolicy === "nuclear-employment" && <p><b>KNOWN CONSEQUENCE</b>Nuclear employment imposed extreme escalation and legitimacy costs.</p>}
            {assessment && <p><b>WORKING ASSUMPTIONS · UNSCORED</b>Intent: {assessment.intent}; pattern: {assessment.observedPattern}; next action: {assessment.nextAction}.</p>}
            <p><b>DELTA</b>range {report.delta.rangeNm > 0 ? "+" : ""}{report.delta.rangeNm}; contact {report.delta.contactQuality > 0 ? "+" : ""}{report.delta.contactQuality}; integrity {report.delta.integrity}; supply {report.delta.supply}; escalation {report.delta.escalation > 0 ? "+" : ""}{report.delta.escalation}; primary objective {report.delta.objectiveProgress > 0 ? "+" : ""}{report.delta.objectiveProgress}{report.delta.secondaryObjectiveProgress !== undefined && secondaryObjective && secondaryObjective.revealTurn <= report.turn ? `; secondary objective ${report.delta.secondaryObjectiveProgress > 0 ? "+" : ""}${report.delta.secondaryObjectiveProgress}` : ""}.</p>
            {(() => {
              const turnLearning = turnLearningNote(report);
              return <p data-learning-kind={turnLearning.kind}><b>{turnLearning.heading}</b>{turnLearning.summary}</p>;
            })()}
            <div className="timeline-intelligence-log">
              <b>ABSOLUTE LOG</b>
              {historyTurn?.discoveryGroups.length ? historyTurn.discoveryGroups.map((group) => (
                <section key={group.discoveredTurn} aria-labelledby={`debrief-turn-${report.turn}-discovered-${group.discoveredTurn}`}>
                  <h5 id={`debrief-turn-${report.turn}-discovered-${group.discoveredTurn}`}>Discovered during Turn {group.discoveredTurn}</h5>
                  <ul>{group.facts.map((fact) => {
                    const copy = formatCommandIntelligenceFact(fact);
                    return <li key={fact.id} data-knowledge="absolute" data-occurred-turn={fact.occurredTurn} data-discovered-turn={fact.discoveredTurn}><b>{copy.label}</b> {copy.detail}</li>;
                  })}</ul>
                </section>
              )) : <p>No absolute change was logged for this turn.</p>}
            </div>
          </article>;
        })}
      </details>
      {planningRecap}
    </section>
  );
}
