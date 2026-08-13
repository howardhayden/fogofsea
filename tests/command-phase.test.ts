import assert from "node:assert/strict";
import test from "node:test";
import {
  beginCommandTransition,
  commandScenario,
  resolveCommandTransition,
  retryCommandTransition,
  undoCommandTransition,
  type CommandDecisionSnapshot,
} from "../app/commandPhase";
import { generateScenario } from "../app/gameModel";
import { DEFAULT_RIGID_ORDERS, type RigidGameState, type RigidOrders, type RigidReadiness } from "../app/kriegsspiel";

const scenario = generateScenario(0, () => 0.31);
const readiness: RigidReadiness = {
  planningScore: 100,
  missionReady: true,
  requiredCoverage: scenario.required.length,
  requiredCount: scenario.required.length,
  forcePoints: 94,
  escortValue: 8,
  airDefenseValue: 7,
  underseaValue: 7,
  uncrewedCount: 18,
  supportedAircraftCount: 30,
  compatibleArmamentCount: 20,
  maxReachNm: 650,
  trackCapacity: 440,
  trackingMethods: [
    "active radar",
    "active acoustic",
    "passive acoustic",
    "passive emitter",
    "cooperative network",
    "infrared",
  ],
  lowSignatureCount: 4,
  selectedUnitCount: 28,
  adaptationScore: 92,
  adaptationLabel: "Test operating profile",
  adaptationEvidence: "A deterministic high-readiness fixture.",
  adaptationGaps: [],
};

const decision: CommandDecisionSnapshot = {
  selectedWarfare: [...scenario.required, ...scenario.recommended],
  selectedEndState: scenario.endState,
  selectedLens: scenario.lenses[0],
  selectedPartnerLens: scenario.lenses[1],
  selectedGuardrail: scenario.guardrail,
  theorySynthesis: "Compare the two selected mechanisms before commitment.",
  rationale: "Preserve access while maintaining a reversible posture.",
  assumptions: "The contact picture remains incomplete.",
  termination: "Transfer control after the bounded objective is secured.",
  fleet: { "multirole-frigate": 4, "area-defense-destroyer": 2 },
  airWing: { "uncrewed-surveillance-rotorcraft": 10 },
  selectedArmaments: { "vessel-passive-surface-tracking-pack": 1 },
};

const recordedAt = "2031-04-06T12:30:45.000Z";

function ordersForTurn(index: number): RigidOrders {
  const task = scenario.required[index % scenario.required.length];
  const orders: RigidOrders[] = [
    { formation: "concentrated-screen", sensors: "cooperative-fusion", tempo: "hold", engagement: "shadow", task: "reconnaissance" },
    { formation: "concentrated-screen", sensors: "cooperative-fusion", tempo: "measured-advance", engagement: "contain", task },
    { formation: "concentrated-screen", sensors: "passive-search", tempo: "measured-advance", engagement: "contain", task },
    { formation: "concentrated-screen", sensors: "cooperative-fusion", tempo: "measured-advance", engagement: "bounded-effects", task },
    { formation: "concentrated-screen", sensors: "passive-search", tempo: "measured-advance", engagement: "contain", task },
    { formation: "concentrated-screen", sensors: "passive-search", tempo: "measured-advance", engagement: "contain", task: "reconnaissance" },
  ];
  return orders[index];
}

function start() {
  return beginCommandTransition({
    scenario,
    difficulty: "standard",
    readiness,
    orders: DEFAULT_RIGID_ORDERS,
    selectedWarfare: decision.selectedWarfare,
  });
}

function resolveFrom(state: RigidGameState, index: number) {
  return resolveCommandTransition({
    scenario,
    difficulty: "standard",
    readiness,
    orders: ordersForTurn(index),
    state,
    decision,
    recordedAt,
  });
}

function playToCompletion() {
  let state = start().state;
  let final: NonNullable<ReturnType<typeof resolveCommandTransition>> | null = null;
  for (let index = 0; index < 6; index += 1) {
    const transition = resolveFrom(state, index);
    assert.ok(transition);
    state = transition.state;
    final = transition;
  }
  assert.ok(final);
  return final;
}

test("command scenario derivation and begin transition are typed and deterministic", () => {
  const rules = commandScenario(scenario, "standard");
  assert.equal(rules.id, scenario.id);
  assert.equal(rules.difficulty, "standard");
  assert.deepEqual(rules.required, scenario.required);
  assert.equal(rules.minimumUncrewed, scenario.minimumUncrewed);

  const invalidOrders = { ...DEFAULT_RIGID_ORDERS, task: "mine-countermeasures" as const };
  const input = {
    scenario,
    difficulty: "standard" as const,
    readiness,
    orders: invalidOrders,
    selectedWarfare: decision.selectedWarfare,
  };
  const first = beginCommandTransition(input);
  const second = beginCommandTransition(input);
  assert.deepEqual(first, second);
  assert.equal(first.type, "begin-command");
  assert.equal(first.orders.task, scenario.required[0]);
  assert.equal(first.state.phase, "active");
  assert.equal(first.state.turn, 0);
  assert.equal(first.state.reports.length, 0);
});

test("resolve transition creates exactly one coherent immutable decision record at completion", () => {
  let state = start().state;
  for (let index = 0; index < 5; index += 1) {
    const transition = resolveFrom(state, index);
    assert.ok(transition);
    assert.equal(transition.type, "resolve-turn");
    assert.equal(transition.outcome, null);
    assert.equal(transition.record, undefined);
    state = transition.state;
  }

  const first = resolveFrom(state, 5);
  const second = resolveFrom(state, 5);
  assert.deepEqual(first, second, "fixed input and recordedAt produce the same completion transition");
  assert.ok(first?.outcome);
  assert.ok(first.record);
  assert.equal(first.state.phase, "complete");
  assert.equal(first.record.id, `${scenario.id}-${recordedAt}`);
  assert.equal(first.record.at, recordedAt);
  assert.equal(first.record.exercise, scenario.id);
  assert.equal(first.record.operation, scenario.operation);
  assert.equal(first.record.region, scenario.region);
  assert.equal(first.record.context.objective, scenario.objective);
  assert.equal(first.record.context.scenarioDate, scenario.scenarioDate);
  assert.equal(first.record.score, first.outcome.score);
  assert.equal(first.record.outcome, first.outcome.title);
  assert.deepEqual(first.record.warfare, decision.selectedWarfare);
  assert.equal(first.record.endState, decision.selectedEndState);
  assert.equal(first.record.theoryLens, decision.selectedLens);
  assert.equal(first.record.partnerLens, decision.selectedPartnerLens);
  assert.equal(first.record.guardrail, decision.selectedGuardrail);
  assert.deepEqual(first.record.fleet, decision.fleet);
  assert.deepEqual(first.record.airWing, decision.airWing);
  assert.deepEqual(first.record.selectedArmaments, decision.selectedArmaments);
  assert.deepEqual(first.record.rigidTurns, first.state.reports);
  assert.deepEqual(first.record.notes, first.outcome.notes);
  assert.notEqual(first.record.fleet, decision.fleet);
  assert.notEqual(first.record.rigidTurns, first.state.reports);
  assert.notEqual(first.record.rigidTurns?.[0], first.state.reports[0]);
  assert.notEqual(first.record.notes, first.outcome.notes);

  assert.equal(resolveCommandTransition({
    scenario,
    difficulty: "standard",
    readiness,
    orders: ordersForTurn(0),
    state: first.state,
    decision,
    recordedAt,
  }), null, "a completed transcript cannot resolve another turn");
  assert.equal(resolveCommandTransition({
    scenario,
    difficulty: "standard",
    readiness,
    orders: ordersForTurn(0),
    state: null,
    decision,
    recordedAt,
  }), null, "a missing command state is a no-op");
});

test("undo transition reverses an active or completed turn and signals history removal", () => {
  const initial = start().state;
  const first = resolveFrom(initial, 0);
  assert.ok(first);
  const second = resolveFrom(first.state, 1);
  assert.ok(second);

  const activeUndo = undoCommandTransition(second.state);
  assert.ok(activeUndo);
  assert.equal(activeUndo.type, "undo-turn");
  assert.equal(activeUndo.dropHistory, false);
  assert.deepEqual(activeUndo.state, first.state);

  const complete = playToCompletion();
  const completeUndo = undoCommandTransition(complete.state);
  assert.ok(completeUndo);
  assert.equal(completeUndo.dropHistory, true);
  assert.equal(completeUndo.state.phase, "active");
  assert.equal(completeUndo.state.turn, 5);
  assert.equal(completeUndo.state.outcome, null);
  assert.equal(undoCommandTransition(initial), null);
  assert.equal(undoCommandTransition(null), null);
});

test("retry transition restores the exact initial state and removes only completed history", () => {
  const initial = start().state;
  const active = resolveFrom(initial, 0);
  assert.ok(active);
  const activeRetry = retryCommandTransition({
    scenario,
    difficulty: "standard",
    readiness,
    state: active.state,
  });
  assert.equal(activeRetry.type, "retry-command");
  assert.equal(activeRetry.dropHistory, false);
  assert.deepEqual(activeRetry.state, initial);

  const complete = playToCompletion();
  const completeRetry = retryCommandTransition({
    scenario,
    difficulty: "standard",
    readiness,
    state: complete.state,
  });
  assert.equal(completeRetry.dropHistory, true);
  assert.deepEqual(completeRetry.state, initial);
});
