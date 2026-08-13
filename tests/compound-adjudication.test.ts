import assert from "node:assert/strict";
import test from "node:test";
import { commandScenario } from "../app/commandPhase";
import { generateScenario } from "../app/gameModel";
import {
  createInitialRigidState,
  DEFAULT_RIGID_ORDERS,
  isRigidGameState,
  previewRigidTurnMatrix,
  resolveRigidTurn,
  secondaryObjectiveOrderFit,
  undoRigidTurn,
  type RigidOrders,
  type RigidReadiness,
} from "../app/kriegsspiel";

function readiness(requiredCount: number): RigidReadiness {
  return {
    planningScore: 94,
    missionReady: true,
    requiredCoverage: requiredCount,
    requiredCount,
    forcePoints: 96,
    escortValue: 6,
    airDefenseValue: 6,
    underseaValue: 6,
    uncrewedCount: 14,
    uncrewedAirCount: 8,
    uncrewedSurfaceCount: 3,
    uncrewedUnderseaCount: 3,
    submarineCount: 2,
    supportedAircraftCount: 24,
    compatibleArmamentCount: 16,
    maxReachNm: 500,
    trackCapacity: 380,
    trackingMethods: ["active radar", "passive acoustic", "passive emitter", "cooperative network"],
    lowSignatureCount: 4,
    selectedUnitCount: 30,
    adaptationScore: 91,
    adaptationLabel: "Compound test force",
    adaptationEvidence: "A legal high-readiness force with recoverable capacity.",
    adaptationGaps: [],
    forceManifest: [
      { id: "screen", label: "Multi-role screening vessel", domain: "surface", quantity: 4, capabilities: ["air defence", "surface sensing"] },
      { id: "air", label: "Shipborne surveillance aircraft", domain: "air", quantity: 8, capabilities: ["wide-area sensing"] },
      { id: "sub", label: "Patrol submarine", domain: "subsurface", quantity: 2, capabilities: ["passive acoustic sensing"] },
      { id: "pack", label: "Cooperative relay mission pack", domain: "mission-pack", quantity: 4, capabilities: ["track relay"] },
    ],
  };
}

test("command derivation activates the saved matrix by difficulty without changing force scale", () => {
  const scenario = generateScenario(17, () => 0.37);
  assert.ok(scenario.matrix);
  const guided = commandScenario(scenario, "guided");
  const challenge = commandScenario(scenario, "challenge");
  const ready = readiness(scenario.required.length);
  const guidedState = createInitialRigidState(ready, guided);
  const challengeState = createInitialRigidState(ready, challenge);
  assert.equal(guidedState.matrix?.forceScale, challengeState.matrix?.forceScale);
  assert.ok((guidedState.matrix?.activeDisruptions.length ?? 0) <= (challengeState.matrix?.activeDisruptions.length ?? 0));
  assert.ok(challengeState.disruptionImpacts?.some((impact) => impact.side === "selected-force"));
  assert.ok(challengeState.disruptionImpacts?.some((impact) => impact.side === "opposing-force"));
  assert.equal(isRigidGameState(challengeState), true);
});

test("matrix preview hides no uncertainty internally, while a resolved report records the committed draw", () => {
  const scenario = generateScenario(31, () => 0.28);
  const rules = commandScenario(scenario, "challenge");
  const ready = readiness(scenario.required.length);
  const state = createInitialRigidState(ready, rules);
  const orders: RigidOrders = { ...DEFAULT_RIGID_ORDERS, task: scenario.required[0], coordination: "federated", riskTreatment: "prepare" };
  const preview = previewRigidTurnMatrix(state, orders, ready, rules);
  assert.ok(preview);
  const resolved = resolveRigidTurn(state, orders, ready, rules);
  assert.deepEqual(resolved.reports[0].matrixResolution, preview);
  assert.equal(resolved.reports[0].matrixResolution?.ultimate.draw, state.matrix?.committedTurnDraws[0]);
  assert.equal(isRigidGameState(resolved), true);
});

test("undo and identical replay cannot reroll a committed matrix", () => {
  const scenario = generateScenario(48, () => 0.42);
  const rules = commandScenario(scenario, "challenge");
  const ready = readiness(scenario.required.length);
  const initial = createInitialRigidState(ready, rules);
  const orders: RigidOrders = { ...DEFAULT_RIGID_ORDERS, task: scenario.required[0], riskTreatment: "mitigate", coordination: "mutual-support" };
  const first = resolveRigidTurn(initial, orders, ready, rules);
  const rewound = undoRigidTurn(first);
  const replay = resolveRigidTurn(rewound, orders, ready, rules);
  assert.deepEqual(rewound, initial);
  assert.deepEqual(replay, first);
});

test("secondary objectives remain concealed until their reveal turn and then accumulate separately", () => {
  let scenario = generateScenario(0, () => 0.31);
  for (let index = 1; index < 80; index += 1) {
    if (scenario.matrix?.secondaryObjective?.minimumDifficulty !== "guided") break;
    scenario = generateScenario(index, () => ((index * 17) % 97) / 97);
  }
  const rules = commandScenario(scenario, "challenge");
  const ready = readiness(scenario.required.length);
  let state = createInitialRigidState(ready, rules);
  const reveal = state.matrix?.activeSecondaryObjective?.revealTurn;
  assert.ok(reveal);
  const order: RigidOrders = { ...DEFAULT_RIGID_ORDERS, task: scenario.required[0], engagement: "contain", sensors: "cooperative-fusion", tempo: "measured-advance", riskTreatment: "recover" };
  while (state.turn < (reveal ?? 1) - 1) {
    state = resolveRigidTurn(state, order, ready, rules);
    assert.equal(state.secondaryObjectiveProgress, 0);
  }
  state = resolveRigidTurn(state, order, ready, rules);
  assert.ok((state.secondaryObjectiveProgress ?? 0) > 0);
});

test("severe disruption applies named availability windows and permanent loss after onset", () => {
  let stateAndRules: { state: ReturnType<typeof createInitialRigidState>; rules: ReturnType<typeof commandScenario>; ready: RigidReadiness } | null = null;
  for (let id = 1; id <= 250 && !stateAndRules; id += 1) {
    const scenario = generateScenario(id, () => ((id * 23) % 101) / 101);
    const rules = commandScenario(scenario, "challenge");
    const ready = readiness(scenario.required.length);
    const state = createInitialRigidState(ready, rules);
    if (state.matrix?.activeDisruptions.some((event) => event.kind === "severe-weather")) stateAndRules = { state, rules, ready };
  }
  assert.ok(stateAndRules);
  const weather = stateAndRules.state.matrix?.activeDisruptions.find((event) => event.kind === "severe-weather");
  assert.ok(weather);
  const impacts = stateAndRules.state.disruptionImpacts?.filter((impact) => impact.disruptionId === weather.id) ?? [];
  assert.ok(impacts.length >= 2);
  assert.ok(impacts.every((impact) => impact.unavailableThroughTurn === weather.endsTurn || impact.status === "downed" || impact.status === "disabled"));
  assert.ok(impacts.some((impact) => impact.side === "selected-force"));
  assert.ok(impacts.some((impact) => impact.side === "opposing-force"));
  if (weather.availabilityMultiplier < 1 && weather.permanentLossFraction > 0) {
    for (const side of ["selected-force", "opposing-force"] as const) {
      const sideImpacts = impacts.filter((impact) => impact.side === side);
      assert.ok(sideImpacts.some((impact) => impact.unavailableThroughTurn === weather.endsTurn), `${side} temporary outage is recorded`);
      assert.ok(sideImpacts.some((impact) => impact.unavailableThroughTurn === undefined), `${side} permanent loss is recorded separately`);
    }
  }
});

test("zero-loss cooperation creates pressure without false degradation and absent domains create no phantom assets", () => {
  let generated = generateScenario(0, () => 0.41);
  for (let id = 1; id < 300; id += 1) {
    if (generated.matrix?.disruptions.some((event) => event.kind === "opposing-coordination")) break;
    generated = generateScenario(id, () => ((id * 19) % 101) / 101);
  }
  const rules = commandScenario(generated, "challenge");
  const surfaceOnly = {
    ...readiness(generated.required.length),
    forceManifest: [{ id: "surface-only", label: "Surface-only vessel", domain: "surface" as const, quantity: 2, capabilities: ["surface sensing"] }],
  };
  const state = createInitialRigidState(surfaceOnly, rules);
  const cooperation = state.matrix?.activeDisruptions.find((event) => event.kind === "opposing-coordination");
  assert.ok(cooperation);
  assert.equal(state.disruptionImpacts?.filter((impact) => impact.disruptionId === cooperation.id).length, 0);
  assert.equal(state.disruptionImpacts?.some((impact) => impact.side === "selected-force" && (impact.domain === "air" || impact.domain === "subsurface" || impact.domain === "mission-pack")), false);
});

test("secondary objective types reward different sensible command postures", () => {
  const base = {
    id: "secondary-test",
    label: "Secondary test",
    description: "Test distinct command fit.",
    revealTurn: 1,
    minimumDifficulty: "guided" as const,
    weight: 20,
  };
  const evidenceOrders: RigidOrders = { ...DEFAULT_RIGID_ORDERS, sensors: "cooperative-fusion", engagement: "shadow", coordination: "federated", riskTreatment: "mitigate" };
  const recoveryOrders: RigidOrders = { ...DEFAULT_RIGID_ORDERS, sensors: "emission-control", engagement: "avoid", coordination: "mutual-support", riskTreatment: "recover", tempo: "hold" };
  const evidence = { ...base, method: "evidence-handoff" as const };
  const accountability = { ...base, method: "system-accountability" as const };
  assert.ok(secondaryObjectiveOrderFit(evidence, evidenceOrders).multiplier > secondaryObjectiveOrderFit(evidence, recoveryOrders).multiplier);
  assert.ok(secondaryObjectiveOrderFit(accountability, recoveryOrders).multiplier > secondaryObjectiveOrderFit(accountability, evidenceOrders).multiplier);
});

test("tiny and massive opposing formations create materially different pressure under the same orders", () => {
  const generated = generateScenario(107, () => 0.43);
  assert.ok(generated.matrix);
  const tinyScenario = commandScenario({
    ...generated,
    matrix: { ...generated.matrix, forceScale: "tiny", forceScaleLabel: "Tiny dispersed craft group", estimatedOpposingElements: [2, 5] },
  }, "challenge");
  const massiveScenario = commandScenario({
    ...generated,
    matrix: { ...generated.matrix, forceScale: "massive", forceScaleLabel: "Massive combined formation", estimatedOpposingElements: [26, 48] },
  }, "challenge");
  const weak = {
    ...readiness(generated.required.length),
    escortValue: 0,
    airDefenseValue: 0,
    underseaValue: 0,
    uncrewedCount: 0,
    uncrewedAirCount: 0,
    uncrewedSurfaceCount: 0,
    uncrewedUnderseaCount: 0,
    supportedAircraftCount: 0,
    compatibleArmamentCount: 0,
    trackCapacity: 0,
    trackingMethods: [],
  };
  const orders: RigidOrders = { ...DEFAULT_RIGID_ORDERS, formation: "distributed-barrier", task: generated.required[0] };
  const tiny = resolveRigidTurn(createInitialRigidState(weak, tinyScenario), orders, weak, tinyScenario);
  const massive = resolveRigidTurn(createInitialRigidState(weak, massiveScenario), orders, weak, massiveScenario);
  assert.ok(massive.integrity < tiny.integrity, `expected massive pressure (${massive.integrity}) to exceed tiny pressure (${tiny.integrity})`);
});
