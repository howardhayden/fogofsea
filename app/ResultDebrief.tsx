"use client";

import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from "react";
import {
  ENGAGEMENT_OPTIONS,
  FORMATION_OPTIONS,
  SENSOR_OPTIONS,
  TEMPO_OPTIONS,
  UNDERSEA_DOCTRINE_OPTIONS,
  UNCREWED_DOCTRINE_OPTIONS,
  outcomeLearningAssessment,
  type RigidGameState,
} from "./kriegsspiel";
import type { SavedResult } from "./saveGame";
import type { Warfare } from "./gameModel";

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
    <section ref={headingRef} className={`result-card ${result.won ? "victory" : "loss"}`} role="region" aria-labelledby="result-heading" aria-describedby="result-threshold-summary" aria-keyshortcuts="PageUp PageDown Home End" tabIndex={0} onKeyDown={scrollReview}>
      <header className="result-summary">
        <div className="result-score"><span>{result.score}<b>/100</b></span><small>FINAL<br />SCORE</small></div>
        <div><small>{result.difficulty.toUpperCase()} REVIEW</small><h2 id="result-heading" tabIndex={-1}>{result.title}</h2><p id="result-threshold-summary">Final state: objective {state.objectiveProgress}{state.matrix?.activeSecondaryObjective ? `; secondary objective ${state.secondaryObjectiveProgress ?? 0}` : ""}; integrity {state.integrity}; supply {state.supply}; escalation {state.escalation}.</p></div>
      </header>
      <div className="result-actions" role="group" aria-label="Debrief actions"><button type="button" onClick={onUndo}>UNDO FINAL TURN</button><button type="button" onClick={onRetry}>RETRY SAME SCENARIO</button><button type="button" onClick={onReturn}>RETURN TO PLANNING</button><button type="button" onClick={onNewScenario}>NEW SCENARIO</button></div>
      <section className={`result-learning ${learning.kind}`} aria-labelledby="result-learning-title">
        <h3 id="result-learning-title">{learning.heading}</h3>
        <p>{learning.summary}</p>
      </section>
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
      <details className="debrief-findings" open={learning.kind === "adjustment"}>
        <summary id="findings-title">WHAT TO LEARN · {result.findings.length}</summary>
        {result.findings.length ? result.findings.map((finding, index) => (
          <article key={finding.code} aria-labelledby={`finding-${finding.code}`}>
            <h4 id={`finding-${finding.code}`}>{finding.cause}</h4>
            <p><b>TURN EVIDENCE</b>{finding.evidence}</p>
            <p><b>ONE ADJUSTMENT</b>{finding.adjustment}</p>
            <button type="button" aria-label={`Open related lesson ${index + 1}: ${finding.cause}`} onClick={() => onOpenLesson(finding.moduleId)}>OPEN RELATED LESSON</button>
          </article>
        )) : <p className="no-findings">No blocking diagnostic finding remained. Use the timeline to compare efficient and costly decisions.</p>}
      </details>
      <details className="turn-timeline">
        <summary>{state.maxTurns}-TURN TIMELINE · {state.reports.length} REPORTS</summary>
        {state.reports.map((report) => (
          <article key={report.turn}>
            <h4>TURN {report.turn} · {report.phase}</h4>
            <p>{report.contactReport}</p>
            <p><b>ORDERS</b>{FORMATION_OPTIONS.find((item) => item.value === report.orders.formation)?.label}; {SENSOR_OPTIONS.find((item) => item.value === report.orders.sensors)?.label}; {TEMPO_OPTIONS.find((item) => item.value === report.orders.tempo)?.label}; {ENGAGEMENT_OPTIONS.find((item) => item.value === report.orders.engagement)?.label}; {UNCREWED_DOCTRINE_OPTIONS.find((item) => item.value === (report.orders.uncrewed ?? "distributed-scouting"))?.label}; {UNDERSEA_DOCTRINE_OPTIONS.find((item) => item.value === (report.orders.undersea ?? "independent-patrol"))?.label}; {warfareLabel(report.orders.task)}.</p>
            <p><b>DELTA</b>range {report.delta.rangeNm > 0 ? "+" : ""}{report.delta.rangeNm}; contact {report.delta.contactQuality > 0 ? "+" : ""}{report.delta.contactQuality}; integrity {report.delta.integrity}; supply {report.delta.supply}; escalation {report.delta.escalation > 0 ? "+" : ""}{report.delta.escalation}; primary objective {report.delta.objectiveProgress > 0 ? "+" : ""}{report.delta.objectiveProgress}{report.delta.secondaryObjectiveProgress !== undefined ? `; secondary objective ${report.delta.secondaryObjectiveProgress > 0 ? "+" : ""}${report.delta.secondaryObjectiveProgress}` : ""}.</p>
            {report.activeDisruptionIds?.length ? <p><b>ACTIVE DISRUPTIONS</b>{report.activeDisruptionIds.map((id) => state.matrix?.activeDisruptions.find((event) => event.id === id)?.headline ?? id).join("; ")}.</p> : null}
          </article>
        ))}
      </details>
      {planningRecap}
    </section>
  );
}
