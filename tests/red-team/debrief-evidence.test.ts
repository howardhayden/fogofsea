import assert from "node:assert/strict";
import test from "node:test";
import { createElement, createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CommandPanel from "../../app/CommandPanel";
import ResultDebrief from "../../app/ResultDebrief";
import { generateScenario } from "../../app/gameModel";
import type { RigidGameState, RigidOutcome, RigidTurnReport } from "../../app/kriegsspiel";
import { latticeCopy, latticeLearningCopy } from "../../app/latticeCopy";
import { activateMatrixForDifficulty } from "../../app/scenarioMatrix";

const outcome: RigidOutcome = {
  won: false,
  score: 42,
  title: "MISSION LOSS",
  difficulty: "challenge",
  breakdown: {
    objective: 10,
    opposingDisruption: 9,
    forceIntegrity: 5,
    commandReadiness: 4,
    supply: 4,
    contactQuality: 3,
    escalationDiscipline: 0,
    planning: 7,
    total: 42,
    victoryThreshold: 76,
    objectiveThreshold: 72,
    integrityThreshold: 44,
    supplyThreshold: 20,
    escalationLimit: 30,
  },
  findings: [],
  notes: [],
};

const report: RigidTurnReport = {
  turn: 1,
  phase: "Initial contact",
  contactReport: "Contact remains ambiguous.",
  orders: {
    formation: "distributed-barrier",
    sensors: "active-sweep",
    tempo: "measured-advance",
    engagement: "bounded-effects",
    task: "reconnaissance",
    uncrewed: "deception-swarm",
    undersea: "coordinated-wolfpack",
    riskTreatment: "recover",
    coordination: "mutual-support",
    strategicPolicy: "nuclear-employment",
  },
  delta: {
    rangeNm: -12,
    contactQuality: 8,
    readiness: -8,
    integrity: -12,
    supply: -10,
    escalation: 62,
    objectiveProgress: 4,
    opposingCohesion: -22,
  },
  umpireNotes: [
    "Nuclear employment imposed extreme escalation and legitimacy costs.",
    "The controlling escalation boundary was exceeded.",
  ],
  diagnosticCodes: ["employment-mismatch"],
};

const state: RigidGameState = {
  version: 1,
  phase: "complete",
  turn: 6,
  maxTurns: 6,
  rangeNm: 100,
  contactQuality: 35,
  readiness: 30,
  integrity: 42,
  supply: 18,
  escalation: 62,
  objectiveProgress: 40,
  opposingCohesion: 50,
  reports: [report],
  outcome,
};

const markup = renderToStaticMarkup(createElement(ResultDebrief, {
  result: outcome,
  state,
  headingRef: createRef<HTMLElement>(),
  planningRecap: createElement("div", null, "Planning recap"),
  warfareLabel: (area) => area,
  onOpenLesson: () => undefined,
  onUndo: () => undefined,
  onRetry: () => undefined,
  onReturn: () => undefined,
  onNewScenario: () => undefined,
}));

test("RT-UMP-AAR-001: the timeline preserves consequential policy orders and each umpire note", () => {
  assert.match(markup, /Risk treatment: Recover and reconstitute/);
  assert.match(markup, /coordination: Mutual-support network/);
  assert.match(markup, /strategic force policy: Nuclear employment/);
  assert.match(markup, /Nuclear employment imposed extreme escalation and legitimacy costs/);
  assert.match(markup, /The controlling escalation boundary was exceeded/);
});

test("RT-EDU-SCOPE-001: the debrief scopes exact scores as invented indices rather than real assessments", () => {
  assert.match(markup, /All \/100 values are invented game indices/);
  assert.match(markup, /not probabilities, forecasts, or real operational assessments/);
  assert.match(markup, /aria-describedby="result-threshold-summary result-index-caveat"/);
});

test("RT-EDU-SCOPE-002: the debrief publishes the Lattice writing boundary and final-turn adjustment", () => {
  assert.ok(markup.includes(latticeCopy("game.outcome.unscoredWriting").replaceAll("'", "&#x27;")));
  assert.match(markup, /select employment methods supported by the available uncrewed and undersea elements/i);
});

test("RT-EDU-SCOPE-003: active command publishes the Lattice pending-review state", () => {
  const activeState: RigidGameState = {
    ...state,
    phase: "active",
    turn: 0,
    reports: [],
    outcome: null,
  };
  const pending = latticeLearningCopy("game.learning.outcome.pending");
  const activeMarkup = renderToStaticMarkup(createElement(CommandPanel, {
    state: activeState,
    orders: report.orders,
    warfareAreas: ["reconnaissance"],
    warfareLabel: (area) => area,
    headingRef: createRef<HTMLHeadingElement>(),
    planningRecap: null,
    operationalStrategy: {
      friendlyMethod: "fleet-action",
      friendlyPosture: "offensive",
      opposingMethod: "commerce-pressure",
      opposingPosture: "defensive",
      recommendedUncrewed: "distributed-scouting",
      recommendedUndersea: "independent-patrol",
      environmentEffects: [],
      summary: "",
    },
    onOrdersChange: () => undefined,
    onResolve: () => undefined,
    onUndo: () => undefined,
    onReturn: () => undefined,
  }));

  assert.ok(activeMarkup.includes(pending.heading));
  assert.ok(activeMarkup.includes(pending.summary));
});

test("RT-INFO-008: an early terminal debrief withholds a later secondary objective", () => {
  let scenario = generateScenario(0, () => 0.31);
  for (let previousId = 1; previousId < 200 && (!scenario.matrix?.secondaryObjective || scenario.matrix.secondaryObjective.revealTurn <= 1); previousId += 1) {
    scenario = generateScenario(previousId, () => 0.31);
  }
  assert.ok(scenario.matrix?.secondaryObjective);
  assert.ok(scenario.matrix.secondaryObjective.revealTurn > 1);
  const matrix = activateMatrixForDifficulty(scenario.matrix, "challenge");
  assert.ok(matrix.activeSecondaryObjective);
  const earlyState: RigidGameState = {
    ...state,
    version: 2,
    turn: 1,
    reports: [{
      ...report,
      delta: { ...report.delta, secondaryObjectiveProgress: 0 },
      adversaryActions: [],
      inflictions: [],
      observationDomains: [],
    }],
    matrix,
    secondaryObjectiveProgress: 0,
  };
  const earlyMarkup = renderToStaticMarkup(createElement(ResultDebrief, {
    result: outcome,
    state: earlyState,
    headingRef: createRef<HTMLElement>(),
    planningRecap: null,
    warfareLabel: (area) => area,
    onOpenLesson: () => undefined,
    onUndo: () => undefined,
    onRetry: () => undefined,
    onReturn: () => undefined,
    onNewScenario: () => undefined,
  }));

  assert.ok(!earlyMarkup.includes(matrix.activeSecondaryObjective.label));
  assert.doesNotMatch(earlyMarkup, /secondary objective/i);
});
