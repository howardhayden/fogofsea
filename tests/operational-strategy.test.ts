import assert from "node:assert/strict";
import test from "node:test";
import { commandScenario } from "../app/commandPhase";
import { generateScenario, type Scenario } from "../app/gameModel";
import { createInitialRigidState, resolveRigidTurn, type RigidReadiness } from "../app/kriegsspiel";
import { deriveOperationalStrategy, underseaDoctrineFit, uncrewedDoctrineFit } from "../app/operationalStrategy";

const base = generateScenario(0, () => 0.31);
const readiness: RigidReadiness = {
  planningScore: 100,
  missionReady: true,
  requiredCoverage: base.required.length,
  requiredCount: base.required.length,
  forcePoints: 90,
  escortValue: 5,
  airDefenseValue: 3,
  underseaValue: 4,
  uncrewedCount: 6,
  uncrewedAirCount: 4,
  uncrewedSurfaceCount: 1,
  uncrewedUnderseaCount: 1,
  submarineCount: 2,
  supportedAircraftCount: 16,
  compatibleArmamentCount: 10,
  maxReachNm: 700,
  trackCapacity: 240,
  trackingMethods: ["active radar", "passive acoustic", "passive emitter", "cooperative network"],
  lowSignatureCount: 4,
  selectedUnitCount: 20,
  adaptationScore: 100,
};

function scenario(overrides: Partial<Scenario>): Scenario {
  return { ...base, ...overrides };
}

test("environment and purpose change the recommended maritime methods", () => {
  const strait = deriveOperationalStrategy(scenario({ regionId: "temperate-strait", endState: "protection", time: "night", season: "winter", storming: true, seaState: 6, visibility: 3 }));
  assert.equal(strait.friendlyPosture, "defensive");
  assert.equal(strait.friendlyMethod, "commerce-pressure");
  assert.equal(strait.recommendedUncrewed, "autonomous-lane-control");
  assert.equal(strait.recommendedUndersea, "protective-screen");
  assert.match(strait.environmentEffects.join(" "), /Low light/);
  assert.match(strait.environmentEffects.join(" "), /Heavy weather/);

  const open = deriveOperationalStrategy(scenario({ regionId: "island-arc", endState: "limited-compellence", time: "day", season: "dry", storming: false, seaState: 2, visibility: 10, required: ["surface-operations"], recommended: [] }));
  assert.equal(open.friendlyPosture, "offensive");
  assert.equal(open.friendlyMethod, "fleet-action");
  assert.equal(open.recommendedUncrewed, "attritable-massing");
});

test("wolfpack and drone methods require the force each method assumes", () => {
  assert.ok(underseaDoctrineFit("coordinated-wolfpack", "coordinated-wolfpack", 3) > 0);
  assert.ok(underseaDoctrineFit("coordinated-wolfpack", "coordinated-wolfpack", 1) < 0);
  assert.ok(uncrewedDoctrineFit("attritable-massing", "attritable-massing", 6) > 0);
  assert.ok(uncrewedDoctrineFit("attritable-massing", "attritable-massing", 0) < 0);
});

test("matched and mismatched doctrines produce different rigid outcomes", () => {
  const source = scenario({ id: 18, regionId: "equatorial-convergence", endState: "denial", required: ["undersea-operations", "reconnaissance"], recommended: ["electromagnetic-operations"], time: "night", storming: false, seaState: 3, visibility: 7 });
  const rigidScenario = commandScenario(source, "standard");
  const context = deriveOperationalStrategy(source);
  const initial = createInitialRigidState(readiness, rigidScenario);
  const common = { formation: "distributed-barrier", sensors: "cooperative-fusion", tempo: "measured-advance", engagement: "contain", task: "undersea-operations" } as const;
  const matched = resolveRigidTurn(initial, { ...common, uncrewed: context.recommendedUncrewed, undersea: context.recommendedUndersea }, readiness, rigidScenario);
  const mismatched = resolveRigidTurn(initial, { ...common, uncrewed: "attritable-massing", undersea: "coordinated-wolfpack" }, { ...readiness, uncrewedCount: 0, submarineCount: 1, uncrewedUnderseaCount: 0 }, rigidScenario);
  assert.ok(matched.contactQuality > mismatched.contactQuality || matched.objectiveProgress > mismatched.objectiveProgress);
  assert.ok(mismatched.escalation >= matched.escalation);
});

test("generated exercises use every modeled maritime and autonomous approach", () => {
  let state = 17;
  const random = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296);
  const contexts = Array.from({ length: 400 }, (_, index) => deriveOperationalStrategy(generateScenario(index, random)));
  assert.deepEqual(new Set(contexts.map((item) => item.friendlyMethod)), new Set(["fleet-action", "commerce-pressure"]));
  assert.deepEqual(new Set(contexts.map((item) => item.friendlyPosture)), new Set(["offensive", "defensive"]));
  assert.deepEqual(new Set(contexts.map((item) => item.recommendedUncrewed)), new Set(["distributed-scouting", "deception-swarm", "attritable-massing", "autonomous-lane-control"]));
  assert.deepEqual(new Set(contexts.map((item) => item.recommendedUndersea)), new Set(["independent-patrol", "coordinated-wolfpack", "barrier-ambush", "protective-screen"]));
});
