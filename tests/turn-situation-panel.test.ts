import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import TurnSituationPanel, {
  situationAnnouncement,
  type SituationObjective,
  type TurnSituationEvent,
} from "../app/TurnSituationPanel";

const events: TurnSituationEvent[] = [
  {
    id: "cyclone-onset",
    kind: "severe-weather",
    severity: "extreme",
    headline: "Tropical cyclone crosses the operating area",
    description: "Extreme wind, heavy rain, and confused seas interrupt flight and surface operations.",
    startsTurn: 3,
    endsTurn: 4,
    knowledge: "confirmed",
    impacts: [
      {
        id: "friendly-air-loss",
        side: "selected-force",
        kind: "aircraft",
        label: "uncrewed scout aircraft",
        quantity: 2,
        status: "downed",
        capabilitiesUnavailable: ["wide-area observation", "cooperative relay"],
        knowledge: "confirmed",
      },
      {
        id: "opposing-assessment",
        side: "opposing-force",
        kind: "vessel",
        label: "assessed opposing patrol vessel",
        quantity: 1,
        status: "disabled",
        unavailableThroughTurn: 4,
        knowledge: "assessed",
      },
      {
        id: "concealed-opposing-loss",
        side: "opposing-force",
        kind: "aircraft",
        label: "concealed opposing aircraft",
        quantity: 4,
        status: "downed",
        knowledge: "concealed",
      },
    ],
  },
  {
    id: "concealed-coordination",
    kind: "opposing-coordination",
    severity: "major",
    headline: "Concealed opposing coordination",
    description: "This must never reach the player before detection.",
    startsTurn: 3,
    endsTurn: 5,
    knowledge: "concealed",
    impacts: [],
  },
];

const objectives: SituationObjective[] = [
  { id: "primary", kind: "primary", label: "Protect access through the corridor", status: "active", progress: 45, revealedTurn: 1 },
  { id: "secondary", kind: "secondary", label: "Recover the disabled survey crew", status: "active", progress: 0, revealedTurn: 3 },
];

test("turn situation presents onset, duration, impacts, and objectives without leaking concealed or internal resolution information", () => {
  const markup = renderToStaticMarkup(
    createElement(TurnSituationPanel, { id: "command-situation", turn: 3, maxTurns: 6, events, objectives }),
  );

  assert.match(markup, /TURN 3 OF 6 · SITUATION UPDATE/);
  assert.match(markup, /Tropical cyclone crosses the operating area/);
  assert.match(markup, /Starts turn 3 · active through turn 4/);
  assert.match(markup, /2 × uncrewed scout aircraft/);
  assert.match(markup, /wide-area observation, cooperative relay/);
  assert.match(markup, /Opposing impact is assessed, not confirmed/);
  assert.match(markup, /SECONDARY · NEW/);
  assert.match(markup, /Recover the disabled survey crew/);
  assert.doesNotMatch(markup, /estimated success range|committed chance|draw \d+\/100|WHY THIS RANGE/i);
  assert.doesNotMatch(markup, /concealed opposing aircraft|Concealed opposing coordination|never reach the player/i);
});

test("turn situation exposes a polite atomic update and a current six-step timeline without an interruptive alert", () => {
  const markup = renderToStaticMarkup(
    createElement(TurnSituationPanel, { id: "mobile-command-situation", turn: 3, maxTurns: 6, events, objectives }),
  );

  assert.match(markup, /role="status" aria-live="polite" aria-atomic="true"/);
  assert.doesNotMatch(markup, /role="alert"|aria-live="assertive"/);
  assert.match(markup, /aria-label="Disruption and objective timeline"/);
  assert.match(markup, /aria-current="step"/);
  assert.equal((markup.match(/<li/g) || []).length >= 6, true);
  assert.match(markup, /Turn 3, current turn\. Tropical cyclone crosses the operating area starts\. Secondary objective revealed: Recover the disabled survey crew/);
});

test("screen-reader and visual timelines withhold confirmed future headlines and objectives", () => {
  const futureEvent: TurnSituationEvent = {
    id: "future-independent-actor",
    kind: "opportunistic-actor",
    severity: "watch",
    headline: "Independent route exploiter arrives",
    description: "This event is committed but not disclosed before its onset.",
    startsTurn: 5,
    endsTurn: 6,
    knowledge: "confirmed",
    impacts: [],
  };
  const futureObjective: SituationObjective = {
    id: "future-objective",
    kind: "secondary",
    label: "Protect a later recovery movement",
    status: "active",
    progress: 0,
    revealedTurn: 5,
  };
  const markup = renderToStaticMarkup(createElement(TurnSituationPanel, {
    id: "future-safe-situation",
    turn: 3,
    maxTurns: 6,
    events: [...events, futureEvent],
    objectives: [...objectives, futureObjective],
  }));
  assert.doesNotMatch(markup, /Independent route exploiter arrives|Protect a later recovery movement|committed but not disclosed/i);
  assert.match(markup, /Turn 5\. Future details are not yet disclosed/);
});

test("announcement prioritizes newly disclosed current-phase information", () => {
  const announcement = situationAnnouncement({ turn: 3, maxTurns: 6, events, objectives });
  assert.equal(
    announcement,
    "Turn 3 of 6. New: Tropical cyclone crosses the operating area. 2 uncrewed scout aircraft downed; 1 assessed opposing patrol vessel disabled. Objective revealed: Recover the disabled survey crew.",
  );
  assert.doesNotMatch(announcement, /concealed/i);
});

test("live announcements stay finite when a large scenario changes many assets at once", () => {
  const crowdedEvents = Array.from({ length: 7 }, (_, index): TurnSituationEvent => ({
    id: `event-${index}`,
    kind: "opposing-coordination",
    severity: "major",
    headline: `Disclosed event ${index + 1}`,
    description: "A disclosed event.",
    startsTurn: 4,
    endsTurn: 5,
    knowledge: "confirmed",
    impacts: Array.from({ length: 3 }, (__, impactIndex) => ({
      id: `impact-${index}-${impactIndex}`,
      side: "selected-force",
      kind: "capability",
      label: `capability ${index + 1}-${impactIndex + 1}`,
      quantity: 1,
      status: "degraded",
      unavailableThroughTurn: 5,
      knowledge: "confirmed",
    })),
  }));
  const announcement = situationAnnouncement({ turn: 4, maxTurns: 6, events: crowdedEvents, objectives: [] });
  assert.match(announcement, /Disclosed event 1; Disclosed event 2; Disclosed event 3; 4 more/);
  assert.match(announcement, /capability 1-1 degraded; 1 capability 1-2 degraded; 1 capability 1-3 degraded; 1 capability 2-1 degraded; 17 more/);
  assert.doesNotMatch(announcement, /Disclosed event 7/);
  assert.ok(announcement.length < 300);
});
