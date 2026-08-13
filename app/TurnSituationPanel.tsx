import type { ReactNode } from "react";

export type SituationEventKind =
  | "severe-weather"
  | "command-interference"
  | "opposing-coordination"
  | "opportunistic-actor"
  | "objective-change";

export type SituationEventSeverity = "watch" | "major" | "extreme";
export type SituationKnowledge = "confirmed" | "assessed" | "concealed";
export type SituationAssetKind = "vessel" | "aircraft" | "submarine" | "mission-pack" | "capability";
export type SituationAssetStatus = "downed" | "disabled" | "degraded" | "diverted" | "unavailable" | "restored";

export type SituationAssetImpact = {
  id: string;
  side: "selected-force" | "opposing-force";
  kind: SituationAssetKind;
  label: string;
  quantity: number;
  status: SituationAssetStatus;
  /** The impact is active through this turn. Omit for a permanent loss. */
  unavailableThroughTurn?: number;
  capabilitiesUnavailable?: readonly string[];
  knowledge: SituationKnowledge;
};

export type TurnSituationEvent = {
  id: string;
  kind: SituationEventKind;
  severity: SituationEventSeverity;
  headline: string;
  description: string;
  startsTurn: number;
  endsTurn: number;
  knowledge: SituationKnowledge;
  impacts: readonly SituationAssetImpact[];
};

export type SituationObjective = {
  id: string;
  kind: "primary" | "secondary";
  label: string;
  status: "active" | "complete" | "failed";
  progress: number;
  revealedTurn: number;
};

type TurnSituationPanelProps = {
  id: string;
  turn: number;
  maxTurns: number;
  events: readonly TurnSituationEvent[];
  objectives: readonly SituationObjective[];
  /** Optional action or current-phase control rendered after the update. */
  children?: ReactNode;
};

const EVENT_KIND_LABELS: Readonly<Record<SituationEventKind, string>> = {
  "severe-weather": "SEVERE WEATHER",
  "command-interference": "COMMAND INTERFERENCE",
  "opposing-coordination": "OPPOSING COORDINATION",
  "opportunistic-actor": "INDEPENDENT OPPORTUNIST",
  "objective-change": "OBJECTIVE CHANGE",
};

const STATUS_LABELS: Readonly<Record<SituationAssetStatus, string>> = {
  downed: "downed",
  disabled: "disabled",
  degraded: "degraded",
  diverted: "diverted",
  unavailable: "unavailable",
  restored: "restored",
};

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function publicEvents(events: readonly TurnSituationEvent[]) {
  return events.filter((event) => event.knowledge !== "concealed");
}

function publicImpacts(event: TurnSituationEvent) {
  return event.impacts.filter((impact) => impact.knowledge !== "concealed");
}

function timingLabel(event: TurnSituationEvent) {
  if (event.endsTurn <= event.startsTurn) return `Turn ${event.startsTurn}`;
  return `Starts turn ${event.startsTurn} · active through turn ${event.endsTurn}`;
}

function impactDuration(impact: SituationAssetImpact) {
  if (impact.status === "restored") return "capability restored";
  if (impact.unavailableThroughTurn !== undefined) return `unavailable through turn ${impact.unavailableThroughTurn}`;
  return "unavailable for the remainder of the command";
}

function finiteList(values: readonly string[], limit: number) {
  const shown = values.slice(0, limit);
  const remaining = values.length - shown.length;
  return `${shown.join("; ")}${remaining > 0 ? `; ${remaining} more` : ""}`;
}

export function situationAnnouncement(input: Omit<TurnSituationPanelProps, "id" | "children">) {
  const visibleEvents = publicEvents(input.events);
  const onsets = visibleEvents.filter((event) => event.startsTurn === input.turn);
  const active = visibleEvents.filter((event) => event.startsTurn < input.turn && event.endsTurn >= input.turn);
  const revealedObjectives = input.objectives.filter((objective) => objective.revealedTurn === input.turn);
  const parts = [`Turn ${input.turn} of ${input.maxTurns}.`];

  if (onsets.length) parts.push(`New: ${finiteList(onsets.map((event) => event.headline), 3)}.`);
  else if (active.length) parts.push(`Continuing: ${finiteList(active.map((event) => event.headline), 3)}.`);
  else parts.push("No disclosed disruption is active.");

  const newImpacts = onsets.flatMap(publicImpacts);
  if (newImpacts.length) {
    parts.push(finiteList(newImpacts.map((impact) => `${impact.quantity} ${impact.label} ${STATUS_LABELS[impact.status]}`), 4) + ".");
  }
  if (revealedObjectives.length) {
    parts.push(`${revealedObjectives.length === 1 ? "Objective" : "Objectives"} revealed: ${finiteList(revealedObjectives.map((objective) => objective.label), 2)}.`);
  }
  return parts.join(" ");
}

function EventGlyph({ kind }: { kind: SituationEventKind }) {
  return (
    <svg className="situation-event-glyph" data-event-kind={kind} viewBox="0 0 64 48" aria-hidden="true" focusable="false">
      {kind === "severe-weather" && <><path d="M8 24 18 12l13 4 8-9 15 11-7 8 8 8-18 7-11-8-13 4Z" /><path d="M12 42c12-9 28-9 40 0M20 46c8-5 16-5 24 0" /></>}
      {kind === "command-interference" && <><path d="m8 10 26-4 5 26-26 4Z" /><path d="m25 15 28 2-2 26-28-2Z" /><path d="m29 22 8 7-8 7" /></>}
      {kind === "opposing-coordination" && <><path d="m10 37 9-16 9 16Zm26 0 9-16 9 16Z" /><circle cx="32" cy="10" r="6" /><path d="M21 22 28 13m15 9-7-9M28 34h8" /></>}
      {kind === "opportunistic-actor" && <><path d="m8 36 14-24 8 13 8-13 18 24Z" /><circle cx="32" cy="10" r="4" /><path d="M17 39h30M25 29h14" /></>}
      {kind === "objective-change" && <><path d="m18 8 14 14-14 14L4 22Zm28 4 12 12-12 12-12-12Z" /><path d="M20 42h28" /></>}
    </svg>
  );
}

function ImpactGlyph({ kind }: { kind: SituationAssetKind }) {
  return (
    <svg className="situation-impact-glyph" data-impact-kind={kind} viewBox="0 0 44 28" aria-hidden="true" focusable="false">
      {kind === "aircraft" && <path d="m3 15 15-4 3-8 3 8 17 4-17 2-3 8-3-8Z" />}
      {kind === "vessel" && <><path d="m4 16 34-4-7 11H10Z" /><path d="M17 14V7h10v6" /></>}
      {kind === "submarine" && <><path d="M4 17c5-8 29-8 36 0-7 7-31 7-36 0Z" /><path d="M20 10V5h7v6" /></>}
      {kind === "mission-pack" && <><rect x="8" y="5" width="28" height="18" rx="2" /><path d="M15 10h14M15 15h14" /></>}
      {kind === "capability" && <><path d="m22 3 16 11-16 11L6 14Z" /><path d="M14 14h16" /></>}
    </svg>
  );
}

function EventArticle({ event, currentTurn }: { event: TurnSituationEvent; currentTurn: number }) {
  const impacts = publicImpacts(event);
  const isOnset = event.startsTurn === currentTurn;
  return (
    <article className="situation-event" data-kind={event.kind} data-severity={event.severity} data-onset={isOnset ? "true" : "false"}>
      <header>
        <EventGlyph kind={event.kind} />
        <div>
          <span>{EVENT_KIND_LABELS[event.kind]} · {event.severity.toUpperCase()}</span>
          <h4>{event.headline}</h4>
          <small>{timingLabel(event)}{event.knowledge === "assessed" ? " · assessed information" : ""}</small>
        </div>
      </header>
      <p>{event.description}</p>
      {impacts.length > 0 && (
        <dl className="situation-impact-list" aria-label={`Disclosed impacts from ${event.headline}`}>
          {impacts.map((impact) => (
            <div key={impact.id} data-status={impact.status}>
              <dt><ImpactGlyph kind={impact.kind} /><span>{impact.quantity} × {impact.label}</span></dt>
              <dd>
                <b>{STATUS_LABELS[impact.status]}</b> · {impactDuration(impact)}
                {impact.capabilitiesUnavailable?.length ? <small>Unavailable: {impact.capabilitiesUnavailable.join(", ")}</small> : null}
                {impact.knowledge === "assessed" ? <small>Opposing impact is assessed, not confirmed.</small> : null}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
}

function ObjectiveList({ objectives, turn, headingId }: { objectives: readonly SituationObjective[]; turn: number; headingId: string }) {
  return (
    <section className="situation-objectives" aria-labelledby={headingId}>
      <h4 id={headingId}>CURRENT OBJECTIVES</h4>
      <ul>
        {objectives.map((objective) => (
          <li key={objective.id} data-status={objective.status} data-new={objective.revealedTurn === turn ? "true" : "false"}>
            <span>{objective.kind.toUpperCase()}{objective.revealedTurn === turn ? " · NEW" : ""}</span>
            <b>{objective.label}</b>
            <small>{clampPercent(objective.progress)}% · {objective.status}</small>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TurnTrack({ turn, maxTurns, events, objectives }: { turn: number; maxTurns: number; events: readonly TurnSituationEvent[]; objectives: readonly SituationObjective[] }) {
  const visibleEvents = publicEvents(events).filter((event) => event.startsTurn <= turn);
  const visibleObjectives = objectives.filter((objective) => objective.revealedTurn <= turn);
  return (
    <ol className="situation-turn-track" aria-label="Disruption and objective timeline">
      {Array.from({ length: maxTurns }, (_, index) => index + 1).map((step) => {
        const starting = visibleEvents.filter((event) => event.startsTurn === step);
        const revealing = visibleObjectives.filter((objective) => objective.revealedTurn === step && objective.kind === "secondary");
        const descriptions = [
          ...starting.map((event) => `${event.headline} starts`),
          ...revealing.map((objective) => `Secondary objective revealed: ${objective.label}`),
        ];
        return (
          <li key={step} aria-current={step === turn ? "step" : undefined} data-has-change={descriptions.length ? "true" : "false"}>
            <b aria-hidden="true">T{step}</b>
            <i aria-hidden="true" />
            <span className="visually-hidden">Turn {step}{step === turn ? ", current turn" : ""}{step > turn ? ". Future details are not yet disclosed." : descriptions.length ? `. ${descriptions.join(". ")}` : ". No disclosed change starts."}</span>
          </li>
        );
      })}
    </ol>
  );
}

export default function TurnSituationPanel({ id, turn, maxTurns, events, objectives, children }: TurnSituationPanelProps) {
  const visibleEvents = publicEvents(events).filter((event) => event.startsTurn <= turn);
  const visibleObjectives = objectives.filter((objective) => objective.revealedTurn <= turn);
  const currentEvents = visibleEvents.filter((event) => event.startsTurn <= turn && event.endsTurn >= turn);
  const priorEvents = visibleEvents.filter((event) => event.endsTurn < turn);
  const headingId = `${id}-heading`;
  const announcement = situationAnnouncement({ turn, maxTurns, events, objectives });

  return (
    <section className="turn-situation-panel" aria-labelledby={headingId} data-active-events={currentEvents.length}>
      <header className="turn-situation-heading">
        <span>TURN {turn} OF {maxTurns} · SITUATION UPDATE</span>
        <h3 id={headingId}>{currentEvents.length ? `${currentEvents.length} ACTIVE ${currentEvents.length === 1 ? "DISRUPTION" : "DISRUPTIONS"}` : "NO ACTIVE DISRUPTION"}</h3>
      </header>
      <p className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>
      <TurnTrack turn={turn} maxTurns={maxTurns} events={visibleEvents} objectives={visibleObjectives} />
      {currentEvents.length ? <div className="situation-current-events">{currentEvents.map((event) => <EventArticle key={event.id} event={event} currentTurn={turn} />)}</div> : <p className="situation-clear-state">No disclosed severe-weather, command, coordinated-opposition, or independent-actor disruption is active this turn.</p>}
      <ObjectiveList objectives={visibleObjectives} turn={turn} headingId={`${id}-objectives-heading`} />
      {priorEvents.length > 0 && (
        <details className="situation-recap">
          <summary>PRIOR DISRUPTIONS · {priorEvents.length}</summary>
          <div>{priorEvents.map((event) => <EventArticle key={event.id} event={event} currentTurn={turn} />)}</div>
        </details>
      )}
      {children}
    </section>
  );
}
