import assert from "node:assert/strict";
import test from "node:test";
import { createElement, createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CommandIntelligencePanel, { COMMAND_ORDERS_FORM_ID } from "../app/CommandIntelligencePanel";
import {
  ABSOLUTE_CONTACT_THRESHOLD,
  COMMAND_INTELLIGENCE_ANNOUNCEMENT_LIMIT,
  adversaryAssessmentOptions,
  commandIntelligenceAnnouncement,
  deriveCommandIntelligence,
  formatCommandIntelligenceFact,
} from "../app/commandIntelligence";
import {
  DEFAULT_RIGID_ORDERS,
  UNRESOLVED_ADVERSARY_ASSESSMENT,
  createInitialRigidState,
  resolveRigidTurn,
  type RigidAdversaryAction,
  type RigidAdversaryAssessment,
  type RigidGameState,
  type RigidInfliction,
  type RigidOrders,
  type RigidReadiness,
  type RigidScenario,
  type RigidTurnReport,
} from "../app/kriegsspiel";
import { activateMatrixForDifficulty, type ScenarioMatrix } from "../app/scenarioMatrix";

const emptyDelta = {
  rangeNm: 0,
  contactQuality: 0,
  readiness: 0,
  integrity: 0,
  supply: 0,
  escalation: 0,
  objectiveProgress: 0,
  opposingCohesion: 0,
};

function action(turn: number, domain: "air" | "surface" | "subsurface" = "surface"): RigidAdversaryAction {
  return {
    id: `opposition-action-turn-${turn}`,
    occurredTurn: turn,
    subject: "opposition",
    action: "probe-screen",
    domains: [domain],
  };
}

function report(input: {
  turn: number;
  contactDelta?: number;
  actionDomain?: "air" | "surface" | "subsurface";
  observationDomains?: Array<"air" | "surface" | "subsurface">;
  inflictions?: RigidInfliction[];
}): RigidTurnReport {
  const orders: RigidOrders = {
    ...DEFAULT_RIGID_ORDERS,
    ...(input.turn > 1 ? { adversaryAssessment: { ...UNRESOLVED_ADVERSARY_ASSESSMENT } } : {}),
  };
  return {
    turn: input.turn,
    orders,
    phase: "Test phase",
    contactReport: "The public contact picture remains bounded by observation.",
    umpireNotes: [],
    delta: { ...emptyDelta, contactQuality: input.contactDelta ?? 0 },
    adversaryActions: [action(input.turn, input.actionDomain)],
    inflictions: input.inflictions ?? [],
    observationDomains: input.observationDomains ?? ["surface"],
  };
}

function stateWithReports(reports: RigidTurnReport[], contactQuality: number): RigidGameState {
  return {
    version: 2,
    phase: "active",
    turn: reports.length,
    maxTurns: 6,
    rangeNm: 120,
    contactQuality,
    readiness: 90,
    integrity: 88,
    supply: 82,
    escalation: 18,
    objectiveProgress: 32,
    opposingCohesion: 91,
    reports,
    outcome: null,
  };
}

function renderPanel(state: RigidGameState, orders: RigidOrders = DEFAULT_RIGID_ORDERS) {
  return renderToStaticMarkup(createElement(CommandIntelligencePanel, {
    state,
    orders,
    headingRef: createRef<HTMLHeadingElement>(),
    onOrdersChange: () => undefined,
  }));
}

test("Turn 1 establishes the baseline without requiring adversary-assessment selects", () => {
  const markup = renderPanel(stateWithReports([], 24));

  assert.match(markup, /Turn 1 establishes the baseline/i);
  assert.doesNotMatch(markup, /<select\b/i);
  assert.doesNotMatch(markup, /Required for this turn/i);
});

test("Turn 2 exposes exactly three required selects associated with the command form", () => {
  const state = stateWithReports([report({ turn: 1 })], 24);
  const markup = renderPanel(state);
  const selects = markup.match(/<select\b[^>]*>/g) ?? [];

  assert.equal(selects.length, 3);
  for (const select of selects) {
    assert.match(select, /required=""/);
    assert.match(select, new RegExp(`form="${COMMAND_ORDERS_FORM_ID}"`));
  }
  assert.match(markup, /WHAT MAY THE OPPOSITION WANT\?/);
  assert.match(markup, /WHAT MAY THE OBSERVABLE PATTERN MEAN\?/);
  assert.match(markup, /WHAT MAY THE OPPOSITION DO NEXT\?/);
});

test("every potential category is capped at three choices and retains an insufficient-evidence choice", () => {
  const latestInflictions: RigidInfliction[] = [
    {
      id: "opposing-infliction-turn-1",
      occurredTurn: 1,
      sourceSide: "opposing-force",
      targetSide: "selected-force",
      effect: "integrity",
      amount: 4,
      domains: ["surface"],
    },
    {
      id: "friendly-infliction-turn-1",
      occurredTurn: 1,
      sourceSide: "selected-force",
      targetSide: "opposing-force",
      effect: "cohesion",
      amount: 3,
      domains: ["surface"],
    },
  ];
  const state = {
    ...stateWithReports([report({ turn: 1, contactDelta: 8, inflictions: latestInflictions })], 34),
    escalation: 48,
    objectiveProgress: 10,
  };
  const options = adversaryAssessmentOptions(state);

  for (const category of [options.intent, options.observedPattern, options.nextAction]) {
    assert.ok(category.length <= 3);
    assert.ok(category.some((option) => option.value === "insufficient-evidence"));
    assert.equal(new Set(category.map((option) => option.value)).size, category.length);
  }
});

test("a category with no public support offers only insufficient evidence", () => {
  const state = {
    ...stateWithReports([report({ turn: 1 })], 70),
    objectiveProgress: 80,
    escalation: 10,
  };
  const options = adversaryAssessmentOptions(state);

  assert.deepEqual(options.intent.map((option) => option.value), ["insufficient-evidence"]);
  assert.deepEqual(options.observedPattern.map((option) => option.value), ["insufficient-evidence"]);
  assert.deepEqual(options.nextAction.map((option) => option.value), ["insufficient-evidence"]);
});

const scenario: RigidScenario = {
  id: 71,
  difficulty: "standard",
  climate: "ocean",
  time: "day",
  clouds: "clear",
  precipitation: "none",
  seaState: 2,
  visibility: 11,
  required: ["reconnaissance"],
  recommended: ["surface-operations"],
  guardrail: "escalation",
  minimumEscort: 1,
  minimumAirDefense: 0,
  minimumAsw: 0,
  minimumUncrewed: 0,
  adversaryCount: 1,
};

const readiness: RigidReadiness = {
  planningScore: 96,
  missionReady: true,
  requiredCoverage: 1,
  requiredCount: 1,
  forcePoints: 90,
  escortValue: 8,
  airDefenseValue: 5,
  underseaValue: 4,
  uncrewedCount: 8,
  supportedAircraftCount: 16,
  compatibleArmamentCount: 10,
  maxReachNm: 500,
  trackCapacity: 320,
  trackingMethods: ["active radar", "passive acoustic", "passive emitter", "cooperative network"],
  lowSignatureCount: 4,
  selectedUnitCount: 20,
  adaptationScore: 94,
};

function assessmentFromState(state: RigidGameState, useInsufficientEvidence: boolean): Required<RigidAdversaryAssessment> {
  const options = adversaryAssessmentOptions(state);
  const choose = <T extends string>(values: Array<{ value: T }>) => (
    useInsufficientEvidence
      ? values.find((option) => option.value === "insufficient-evidence")!.value
      : values.find((option) => option.value !== "insufficient-evidence")!.value
  );
  return {
    intent: choose(options.intent),
    observedPattern: choose(options.observedPattern),
    nextAction: choose(options.nextAction),
  };
}

test("working-assumption choices are recorded but do not alter rigid turn mechanics", () => {
  const initial = createInitialRigidState(readiness, scenario);
  const afterTurnOne = resolveRigidTurn(initial, DEFAULT_RIGID_ORDERS, readiness, scenario);
  const firstAssessment = assessmentFromState(afterTurnOne, false);
  const insufficientAssessment = assessmentFromState(afterTurnOne, true);

  const first = resolveRigidTurn(afterTurnOne, {
    ...DEFAULT_RIGID_ORDERS,
    adversaryAssessment: firstAssessment,
  }, readiness, scenario);
  const insufficient = resolveRigidTurn(afterTurnOne, {
    ...DEFAULT_RIGID_ORDERS,
    adversaryAssessment: insufficientAssessment,
  }, readiness, scenario);

  const mechanicalKeys = [
    "phase", "turn", "rangeNm", "contactQuality", "readiness", "integrity", "supply",
    "escalation", "objectiveProgress", "opposingCohesion", "outcome",
  ] as const;
  for (const key of mechanicalKeys) assert.deepEqual(first[key], insufficient[key], key);
  assert.deepEqual(first.reports[1].delta, insufficient.reports[1].delta);
  assert.deepEqual(first.reports[1].adversaryActions, insufficient.reports[1].adversaryActions);
  assert.deepEqual(first.reports[1].inflictions, insufficient.reports[1].inflictions);
  assert.notDeepEqual(first.reports[1].orders.adversaryAssessment, insufficient.reports[1].orders.adversaryAssessment);
});

test("an opposing action crosses from concealed to absolute only at 85 with relevant observation", () => {
  assert.equal(ABSOLUTE_CONTACT_THRESHOLD, 85);
  const sourceReport = report({ turn: 1, actionDomain: "surface", observationDomains: ["surface"] });
  const below = deriveCommandIntelligence(stateWithReports([sourceReport], 84));
  const atThreshold = deriveCommandIntelligence(stateWithReports([sourceReport], 85));
  const wrongDomain = deriveCommandIntelligence(stateWithReports([
    report({ turn: 1, actionDomain: "surface", observationDomains: ["air"] }),
  ], 100));

  assert.equal(below.facts.some((fact) => fact.kind === "adversary-action"), false);
  assert.equal(atThreshold.facts.some((fact) => fact.kind === "adversary-action"), true);
  assert.equal(wrongDomain.facts.some((fact) => fact.kind === "adversary-action"), false);
});

function delayedDiscoveryStates() {
  const turnFourInfliction: RigidInfliction = {
    id: "friendly-infliction-turn-4",
    occurredTurn: 4,
    sourceSide: "selected-force",
    targetSide: "opposing-force",
    effect: "cohesion",
    amount: 7,
    domains: ["surface"],
  };
  const reports = [
    report({ turn: 1, contactDelta: 20, actionDomain: "air" }),
    report({ turn: 2, contactDelta: 20, actionDomain: "surface" }),
    report({ turn: 3, contactDelta: 20, actionDomain: "air" }),
    report({ turn: 4, contactDelta: 25, actionDomain: "air", inflictions: [turnFourInfliction] }),
  ];
  return {
    beforeDiscovery: stateWithReports(reports.slice(0, 3), 60),
    afterDiscovery: stateWithReports(reports, 85),
  };
}

test("an action from Turn 2 discovered in Turn 4 stays filed under occurrence Turn 2", () => {
  const { afterDiscovery } = delayedDiscoveryStates();
  const view = deriveCommandIntelligence(afterDiscovery);
  const delayedAction = view.facts.find((fact) => (
    fact.kind === "adversary-action" && fact.occurredTurn === 2
  ));
  const turnTwoHistory = view.history.find((turn) => turn.occurredTurn === 2);

  assert.ok(delayedAction);
  assert.equal(delayedAction.discoveredTurn, 4);
  assert.ok(turnTwoHistory);
  assert.deepEqual(turnTwoHistory.discoveryGroups.map((group) => group.discoveredTurn), [4]);
  assert.ok(turnTwoHistory.discoveryGroups[0].facts.some((fact) => fact.id === delayedAction.id));

  const markup = renderPanel(afterDiscovery, {
    ...DEFAULT_RIGID_ORDERS,
    adversaryAssessment: { ...UNRESOLVED_ADVERSARY_ASSESSMENT },
  });
  assert.match(markup, /id="command-history-turn-2"/);
  assert.match(markup, /Discovered during Turn 4/);
});

test("Immediate contains newly discovered opposing action and the latest infliction", () => {
  const { afterDiscovery } = delayedDiscoveryStates();
  const view = deriveCommandIntelligence(afterDiscovery);

  assert.ok(view.immediate.some((fact) => fact.kind === "adversary-action" && fact.occurredTurn === 2 && fact.discoveredTurn === 4));
  assert.ok(view.immediate.some((fact) => fact.kind === "infliction" && fact.id === "friendly-infliction-turn-4"));
  assert.ok(view.lastKnownAdversaryAction);
  assert.equal(view.lastKnownAdversaryAction.occurredTurn, 2);
});

test("History contains every resolved turn, including turns with no absolute discovery", () => {
  const { afterDiscovery } = delayedDiscoveryStates();
  const view = deriveCommandIntelligence(afterDiscovery);

  assert.deepEqual(view.history.map((turn) => turn.occurredTurn), [1, 2, 3, 4]);
  assert.equal(view.history[0].discoveryGroups.length, 0);
  assert.equal(view.history[2].discoveryGroups.length, 0);
  assert.match(renderPanel(afterDiscovery), /HISTORY · 4 TURNS/);
});

test("direct current-turn conditions enter Immediate before orders but not resolved History", () => {
  const matrix: ScenarioMatrix = {
    version: 1,
    seed: 41,
    forceScale: "small",
    forceScaleLabel: "Small fictional group",
    estimatedOpposingElements: [4, 8],
    opponentCoordination: "selective",
    institutionalConstraint: "none",
    illicitNetworkType: "mixed",
    secondaryObjective: {
      id: "secondary-current-turn",
      label: "Secure the handoff",
      description: "Preserve the fictional evidence handoff.",
      revealTurn: 2,
      minimumDifficulty: "guided",
      weight: 20,
      method: "evidence-handoff",
    },
    disruptions: [
      {
        id: "weather-current-turn",
        kind: "severe-weather",
        headline: "Severe test weather",
        description: "Directly observable weather crosses the working area.",
        startsTurn: 2,
        endsTurn: 3,
        minimumDifficulty: "guided",
        severity: "major",
        affectedSide: "both",
        affectedDomains: ["air", "surface"],
        availabilityMultiplier: 0.8,
        permanentLossFraction: 0,
        opposingPressureMultiplier: 0.9,
      },
      {
        id: "hidden-coordination-current-turn",
        kind: "opposing-coordination",
        headline: "Hidden coordination sentinel",
        description: "This opposing-only event must remain concealed.",
        startsTurn: 2,
        endsTurn: 3,
        minimumDifficulty: "standard",
        severity: "watch",
        affectedSide: "opposing-force",
        affectedDomains: ["communications", "surface"],
        availabilityMultiplier: 1,
        permanentLossFraction: 0,
        opposingPressureMultiplier: 1.1,
      },
    ],
    committedTurnDraws: [11, 22, 33, 44, 55, 66],
  };
  const state: RigidGameState = {
    ...stateWithReports([report({ turn: 1 })], 100),
    matrix: activateMatrixForDifficulty(matrix, "challenge"),
    secondaryObjectiveProgress: 0,
    disruptionImpacts: [
      {
        id: "impact-weather-current-turn",
        disruptionId: "weather-current-turn",
        side: "selected-force",
        domain: "air",
        label: "Test aviation element",
        quantity: 1,
        status: "unavailable",
        unavailableThroughTurn: 3,
        capabilitiesUnavailable: ["air observation"],
        knowledge: "confirmed",
      },
      {
        id: "assessed-opposing-impact",
        disruptionId: "weather-current-turn",
        side: "opposing-force",
        domain: "air",
        label: "Hidden opposing estimate",
        quantity: 9,
        status: "degraded",
        unavailableThroughTurn: 3,
        capabilitiesUnavailable: ["hidden estimate"],
        knowledge: "assessed",
      },
    ],
  };
  const view = deriveCommandIntelligence(state);
  const turnTwoImmediate = view.immediate.filter((fact) => fact.occurredTurn === 2);

  assert.ok(turnTwoImmediate.some((fact) => fact.kind === "situation-change" && fact.change === "disruption"));
  assert.ok(turnTwoImmediate.some((fact) => fact.kind === "situation-change" && fact.change === "objective-revealed"));
  assert.ok(turnTwoImmediate.some((fact) => fact.kind === "asset-impact"));
  assert.equal(view.facts.some((fact) => fact.kind === "situation-change" && fact.headline === "Hidden coordination sentinel"), false);
  assert.equal(view.facts.some((fact) => fact.kind === "asset-impact" && fact.label === "Hidden opposing estimate"), false);
  assert.deepEqual(view.history.map((turn) => turn.occurredTurn), [1]);
  assert.match(renderPanel(state), /SECONDARY OBJECTIVE/);
  assert.match(renderPanel(state), /Severe test weather/);

  const terminalBeforeTurnTwo = deriveCommandIntelligence({ ...state, phase: "complete" });
  assert.equal(terminalBeforeTurnTwo.facts.some((fact) => fact.occurredTurn === 2), false);
  assert.equal(terminalBeforeTurnTwo.immediate.some((fact) => fact.occurredTurn === 2), false);
});

test("concealed adversary actions do not leak into facts, Immediate, last-known copy, or rendered history", () => {
  const { beforeDiscovery } = delayedDiscoveryStates();
  const view = deriveCommandIntelligence(beforeDiscovery);
  const concealedCopy = formatCommandIntelligenceFact({
    id: "concealed-probe-copy",
    kind: "adversary-action",
    occurredTurn: 2,
    discoveredTurn: 4,
    knowledge: "absolute",
    action: "probe-screen",
    domains: ["surface"],
  }).detail;
  const markup = renderPanel(beforeDiscovery, {
    ...DEFAULT_RIGID_ORDERS,
    adversaryAssessment: { ...UNRESOLVED_ADVERSARY_ASSESSMENT },
  });

  assert.equal(view.facts.some((fact) => fact.kind === "adversary-action"), false);
  assert.equal(view.immediate.some((fact) => fact.kind === "adversary-action"), false);
  assert.equal(view.lastKnownAdversaryAction, null);
  assert.ok(view.history.every((turn) => turn.discoveryGroups.every((group) => (
    group.facts.every((fact) => fact.kind !== "adversary-action")
  ))));
  assert.ok(!markup.includes(concealedCopy));
  assert.match(markup, /No opposing action is yet known absolutely/);
});

test("the polite intelligence update is bounded while retaining an overflow count", () => {
  const state = stateWithReports([report({ turn: 1 })], 30);
  const facts = Array.from({ length: 6 }, (_, index) => ({
    id: `bounded-announcement-${index}`,
    kind: "situation-change" as const,
    occurredTurn: 1,
    discoveredTurn: 1,
    knowledge: "absolute" as const,
    change: "disruption" as const,
    headline: `Condition ${index + 1}`,
    detail: "A deliberately long directly observed condition description remains in the ordinary Immediate and History views even when the live update is clipped.",
  }));

  const announcement = commandIntelligenceAnnouncement(state, facts);
  assert.ok(announcement.length <= COMMAND_INTELLIGENCE_ANNOUNCEMENT_LIMIT);
  assert.match(announcement, /3 more entries are available in Immediate\.$/);
});

test("absolute opposing-action copy reports observable behavior without assigning purpose", () => {
  const actions: RigidAdversaryAction["action"][] = [
    "apply-pressure",
    "probe-screen",
    "contest-sensors",
    "mask-movement",
    "disperse-and-preserve",
    "hold-and-preserve",
    "exploit-disruption",
  ];
  const rendered = actions.map((actionCode) => formatCommandIntelligenceFact({
    id: `observable-${actionCode}`,
    kind: "adversary-action",
    occurredTurn: 2,
    discoveredTurn: 4,
    knowledge: "absolute",
    action: actionCode,
    domains: ["surface"],
  }).detail).join(" ");

  assert.doesNotMatch(rendered, /intent|purpose|to preserve|to exploit|confirmed disruption/i);
});
