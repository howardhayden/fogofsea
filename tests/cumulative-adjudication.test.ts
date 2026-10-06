import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  createInitialRigidState, resolveRigidTurn, previewRigidTurnMatrix, undoRigidTurn,
  type RigidGameState, type RigidOrders, type RigidReadiness, type RigidScenario,
} from "../app/kriegsspiel";
import { createScenarioMatrix, type ScenarioDisruption } from "../app/scenarioMatrix";
import { deriveForceReadiness } from "../app/forceReadiness";
import { generateScenario } from "../app/gameModel";

const ready: RigidReadiness = {
  planningScore: 90, missionReady: true, requiredCoverage: 3, requiredCount: 3,
  forcePoints: 90, escortValue: 3, airDefenseValue: 2, underseaValue: 3,
  uncrewedCount: 6, uncrewedAirCount: 2, uncrewedSurfaceCount: 2, uncrewedUnderseaCount: 2,
  submarineCount: 2, supportedAircraftCount: 8, missionAircraftCount: 6,
  compatibleArmamentCount: 5, maxReachNm: 250, trackCapacity: 160,
  trackingMethods: ["active radar", "passive acoustic", "cooperative network"],
  lowSignatureCount: 2, selectedUnitCount: 15, adaptationScore: 85,
  capabilityProfile: {
    surface: { trackCapacity: 0, trackingMethods: [], escortValue: 3, airDefenseValue: 2, underseaValue: 1, unitCount: 5, lowSignatureCount: 2 },
    air: { trackCapacity: 120, trackingMethods: ["active radar", "cooperative network"], escortValue: 0, airDefenseValue: 0, underseaValue: 1, unitCount: 5, lowSignatureCount: 0 },
    subsurface: { trackCapacity: 0, trackingMethods: [], escortValue: 0, airDefenseValue: 0, underseaValue: 1, unitCount: 5, lowSignatureCount: 0 },
    "mission-pack": { trackCapacity: 40, trackingMethods: ["passive acoustic"], escortValue: 0, airDefenseValue: 0, underseaValue: 0, unitCount: 0, lowSignatureCount: 0 },
  },
};
const orders: RigidOrders = {
  formation: "concentrated-screen", sensors: "cooperative-fusion", tempo: "measured-advance",
  engagement: "contain", task: "surface-operations", uncrewed: "distributed-scouting",
  undersea: "independent-patrol", riskTreatment: "prepare", coordination: "federated",
  strategicPolicy: "conventional-restraint",
};
function scenario(disruptions: ScenarioDisruption[] = []): RigidScenario {
  return {
    id: 41, difficulty: "standard", climate: "ocean", regionId: "pelagic-island-arc", season: "autumn",
    time: "day", clouds: "scattered", precipitation: "none", seaState: 3, visibility: 8,
    required: ["surface-operations", "air-defense", "undersea-operations"], recommended: ["reconnaissance"],
    guardrail: "escalation", minimumEscort: 2, minimumAirDefense: 2, minimumAsw: 2, minimumUncrewed: 2,
    adversaryCount: 2, selectedLens: "corbett",
    matrix: {
      ...createScenarioMatrix({ exerciseId: 41, climate: "ocean", regionId: "pelagic-island-arc", season: "autumn", adversaryCount: 2 }),
      forceScale: "medium", forceScaleLabel: "Cruiser-hunting group", estimatedOpposingElements: [8, 16],
      disruptions, secondaryObjective: null, committedTurnDraws: [1, 1, 1, 1, 1, 1],
    },
  };
}
function initial(rules = scenario(), readiness = ready): RigidGameState {
  return { ...createInitialRigidState(readiness, rules), rangeNm: 110, contactQuality: 45, integrity: 72, readiness: 78, supply: 76 };
}
function turn(rules = scenario(), order = orders, readiness = ready, state = initial(rules, readiness)) {
  return resolveRigidTurn(state, order, readiness, rules);
}

test("version-one campaigns retain all 28 original whole-state snapshots", () => {
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/legacy-turn-fixtures.json", import.meta.url), "utf8")) as {
    readiness: RigidReadiness; orders: RigidOrders[]; fixtures: { scenario: RigidScenario; snapshots: string[] }[];
  };
  for (const example of fixture.fixtures) {
    let state = createInitialRigidState(fixture.readiness, example.scenario);
    const digest = () => createHash("sha256").update(JSON.stringify(state)).digest("hex");
    assert.equal(digest(), example.snapshots[0]);
    for (const [index, order] of fixture.orders.entries()) {
      state = resolveRigidTurn(state, order, fixture.readiness, example.scenario);
      assert.equal(digest(), example.snapshots[index + 1], `legacy scenario ${example.scenario.id}, turn ${index + 1}`);
    }
  }
});

test("all ten actual command controls affect the assessed scores or their cumulative weights", () => {
  const baseline = turn().reports[0].matrixInput;
  const alternatives: Partial<RigidOrders>[] = [
    { formation: "distributed-barrier" }, { sensors: "active-sweep" }, { tempo: "high-speed-dash" },
    { engagement: "bounded-effects" }, { task: "land-attack" }, { uncrewed: "attritable-massing" },
    { undersea: "coordinated-wolfpack" }, { riskTreatment: "recover" }, { coordination: "independent" },
    { strategicPolicy: "nuclear-employment" },
  ];
  for (const alternative of alternatives) {
    const actual = turn(scenario(), { ...orders, ...alternative }).reports[0];
    assert.notDeepEqual(actual.matrixInput, baseline, Object.keys(alternative)[0]);
    assert.equal(actual.matrixResolution?.ultimate.draw, 1, "orders never change the committed draw");
  }
  const assumed = turn(scenario(), { ...orders, adversaryAssessment: { intent: "raise-political-cost", observedPattern: "probing-screen", nextAction: "probe-screen" } });
  assert.deepEqual(assumed.reports[0].matrixInput, baseline, "unverified player assumptions remain non-authoritative");
});

test("planning, force reach, environmental fit and every persistent command measure inform the next matrix", () => {
  const rules = scenario();
  const current = initial(rules);
  const input = turn(rules, orders, ready, current).reports[0].matrixInput;
  const cumulativeChanges: Partial<RigidGameState>[] = [
    { rangeNm: 280 }, { contactQuality: 10 }, { readiness: 25 }, { integrity: 25 }, { supply: 25 },
    { escalation: 95 }, { objectiveProgress: 85 }, { opposingCohesion: 20 },
  ];
  for (const change of cumulativeChanges) {
    assert.notDeepEqual(turn(rules, orders, ready, { ...current, ...change }).reports[0].matrixInput, input, Object.keys(change)[0]);
  }
  for (const change of [{ planningScore: 30 }, { requiredCoverage: 1 }, { maxReachNm: 25 }, { adaptationScore: 30 }, { missionReady: false }]) {
    assert.notDeepEqual(turn(rules, orders, { ...ready, ...change }, current).reports[0].matrixInput, input, Object.keys(change)[0]);
  }
  const storm = turn({ ...rules, storming: true, seaState: 6, clouds: "overcast", visibility: 2 }, orders, ready, current);
  assert.ok(storm.reports[0].matrixInput!.environmentFit < input!.environmentFit);
});

test("the single outer outcome changes realized gains and recovery while physical costs remain firm", () => {
  const results = new Map<string, ReturnType<typeof turn>>();
  for (let draw = 1; draw <= 100; draw += 1) {
    const rules = scenario();
    rules.matrix!.committedTurnDraws[0] = draw;
    const outcome = turn(rules, { ...orders, riskTreatment: "recover" });
    const matrix = outcome.reports[0].matrixResolution!;
    assert.equal(matrix.version, 2);
    assert.ok(matrix.components.every((component) => !("draw" in component) && !("result" in component)));
    results.set(matrix.ultimate.result, outcome);
  }
  assert.equal(results.size, 3);
  const success = results.get("success")!;
  const partial = results.get("partial")!;
  const failure = results.get("failure")!;
  assert.ok(success.objectiveProgress > partial.objectiveProgress);
  assert.ok(partial.objectiveProgress > failure.objectiveProgress);
  assert.equal(failure.objectiveProgress, 0);
  assert.equal(failure.opposingCohesion, 100);
  assert.ok(success.contactQuality > partial.contactQuality && partial.contactQuality > failure.contactQuality);
  assert.ok(success.readiness > partial.readiness && partial.readiness > failure.readiness);
  assert.ok(failure.integrity <= 72 && failure.supply < 76 && failure.readiness < 78, "failure creates no free recovery");
  assert.equal(success.rangeNm, failure.rangeNm);
  assert.equal(success.escalation, failure.escalation);
  assert.ok(success.supply > failure.supply, "only the successful recovery credit offsets the same operating cost");
});

test("even the most favorable draw cannot bypass credible force, reach, planning, or contact requirements", () => {
  const rules = scenario();
  for (const change of [{ missionReady: false }, { selectedUnitCount: 0, capabilityProfile: {} }, { maxReachNm: 25 }, { trackCapacity: 0, trackingMethods: [], capabilityProfile: {} }]) {
    const readiness = { ...ready, ...change };
    const state = initial(rules, readiness);
    state.contactQuality = change.trackCapacity === 0 ? 0 : 90;
    const resolved = turn(rules, orders, readiness, state);
    assert.equal(resolved.reports[0].matrixResolution!.ultimate.result, "success");
    assert.equal(resolved.objectiveProgress, 0, JSON.stringify(change));
    assert.equal(resolved.opposingCohesion, 100, JSON.stringify(change));
  }
});

function disruption(side: ScenarioDisruption["affectedSide"], domain: ScenarioDisruption["affectedDomains"][number], permanentLossFraction = 0): ScenarioDisruption {
  return {
    id: "directional-test", kind: "severe-weather", headline: "Localized weather", description: "One named domain is affected.",
    startsTurn: 1, endsTurn: 2, minimumDifficulty: "guided", severity: "major", affectedSide: side,
    affectedDomains: [domain], availabilityMultiplier: 0, permanentLossFraction, opposingPressureMultiplier: 1,
  };
}

test("directional events help when the opponent loses capacity and preserve only permanent effects after recovery", () => {
  const base = scenario();
  const enemy = scenario([disruption("opposing-force", "air")]);
  const own = scenario([disruption("selected-force", "air")]);
  for (const index of [0, 1, 2]) {
    const baseline = turn(base, orders, ready, { ...initial(base), turn: index });
    const favorable = turn(enemy, orders, ready, { ...initial(enemy), turn: index });
    const adverse = turn(own, orders, ready, { ...initial(own), turn: index });
    if (index < 2) {
      assert.ok(favorable.reports[0].matrixResolution!.ultimate.committedChance >= baseline.reports[0].matrixResolution!.ultimate.committedChance);
      assert.ok(favorable.reports[0].matrixInput!.taskFit > baseline.reports[0].matrixInput!.taskFit);
      assert.ok(adverse.reports[0].matrixInput!.contactQuality < baseline.reports[0].matrixInput!.contactQuality);
    } else {
      assert.deepEqual(favorable.reports[0].matrixInput, baseline.reports[0].matrixInput);
      assert.deepEqual(adverse.reports[0].matrixInput, baseline.reports[0].matrixInput);
    }
  }
  const persistent = scenario([disruption("opposing-force", "air", 0.3)]);
  assert.ok(turn(persistent, orders, ready, { ...initial(persistent), turn: 2 }).reports[0].matrixInput!.taskFit
    > turn(base, orders, ready, { ...initial(base), turn: 2 }).reports[0].matrixInput!.taskFit);
});

test("an aircraft outage removes its tracking but preserves surface and undersea uncrewed capacity", () => {
  const rules = scenario([disruption("selected-force", "air")]);
  const physicallyRemaining: RigidReadiness = {
    ...ready, trackCapacity: 40, trackingMethods: ["passive acoustic"], supportedAircraftCount: 0, missionAircraftCount: 0,
    uncrewedCount: 4, uncrewedAirCount: 0, underseaValue: 2, selectedUnitCount: 10,
    capabilityProfile: { ...ready.capabilityProfile, air: { trackCapacity: 0, trackingMethods: [], escortValue: 0, airDefenseValue: 0, underseaValue: 0, unitCount: 0, lowSignatureCount: 0 } },
  };
  const degraded = turn(rules);
  const remaining = turn(scenario(), orders, physicallyRemaining);
  assert.deepEqual(degraded.reports[0].matrixInput, remaining.reports[0].matrixInput);
  assert.deepEqual(degraded.reports[0].delta, remaining.reports[0].delta);
});

test("emission-control bonuses follow the available low-signature domain", () => {
  const ordinary: RigidReadiness = {
    ...ready, lowSignatureCount: 0,
    capabilityProfile: {
      ...ready.capabilityProfile,
      surface: { ...ready.capabilityProfile!.surface!, lowSignatureCount: 0 },
    },
  };
  const lowSignature: RigidReadiness = {
    ...ordinary, lowSignatureCount: 4,
    capabilityProfile: { ...ordinary.capabilityProfile, air: { ...ordinary.capabilityProfile!.air!, lowSignatureCount: 4 } },
  };
  const emissionControl = { ...orders, sensors: "emission-control" as const };
  for (const availability of [1, 0.5, 0]) {
    const event = { ...disruption("selected-force", "air"), availabilityMultiplier: availability };
    const rules = scenario(availability === 1 ? [] : [event]);
    const state = { ...initial(rules), contactQuality: 10 };
    const withSignature = turn(rules, emissionControl, lowSignature, state).reports[0].matrixInput!;
    const withoutSignature = turn(rules, emissionControl, ordinary, state).reports[0].matrixInput!;
    assert.equal(withSignature.contactQuality - withoutSignature.contactQuality, 4 * availability);
  }
  const surfaceOutage = scenario([disruption("selected-force", "surface")]);
  const state = { ...initial(surfaceOutage), contactQuality: 10 };
  assert.equal(
    turn(surfaceOutage, emissionControl, lowSignature, state).reports[0].matrixInput!.contactQuality
      - turn(surfaceOutage, emissionControl, ordinary, state).reports[0].matrixInput!.contactQuality,
    4,
    "an unrelated surface outage does not remove the surviving airborne signature benefit",
  );
});

test("revealed secondary progress and posture affect the weights, and failure cannot advance it", () => {
  const rules = scenario();
  rules.matrix!.secondaryObjective = { id: "secondary-test", label: "Recover systems", description: "Restore the recovery capacity.", revealTurn: 2, minimumDifficulty: "guided", weight: 28, method: "system-accountability" };
  const current = { ...initial(rules), turn: 1 };
  const pending = turn(rules, orders, ready, current).reports[0].matrixInput!;
  const completed = turn(rules, orders, ready, { ...current, secondaryObjectiveProgress: 100 }).reports[0].matrixInput!;
  assert.ok(completed.taskFit > pending.taskFit);
  assert.deepEqual(completed.componentWeights, pending.componentWeights, "completed work is not penalized by reducing a strong component’s importance");
  const aligned = turn(rules, { ...orders, riskTreatment: "recover", tempo: "hold", coordination: "mutual-support" }, ready, current);
  assert.ok(aligned.reports[0].matrixInput!.taskFit > pending.taskFit);
  rules.matrix!.committedTurnDraws[1] = 100;
  const failed = turn(rules, orders, ready, { ...initial(rules), turn: 1 });
  assert.equal(failed.reports[0].matrixResolution!.ultimate.result, "failure");
  assert.equal(failed.secondaryObjectiveProgress, 0);
});

test("preview, undo, and replay agree on the full cumulative assessment and one committed turn draw", () => {
  const rules = scenario();
  const state = initial(rules);
  const preview = previewRigidTurnMatrix(state, orders, ready, rules);
  const resolved = turn(rules, orders, ready, state);
  assert.deepEqual(resolved.reports[0].matrixResolution, preview);
  const rewound = undoRigidTurn(resolved);
  assert.deepEqual(rewound, state);
  assert.deepEqual(turn(rules, orders, ready, rewound), resolved);
});

test("improving cumulative resources or completed objectives never lowers the next outcome distribution", () => {
  const rules = scenario();
  rules.matrix!.secondaryObjective = { id: "secondary-test", label: "Recover systems", description: "Restore the recovery capacity.", revealTurn: 1, minimumDifficulty: "guided", weight: 28, method: "system-accountability" };
  for (const riskTreatment of ["prepare", "respond", "recover", "mitigate"] as const) {
    for (const key of ["supply", "integrity", "readiness", "contactQuality", "objectiveProgress", "secondaryObjectiveProgress"] as const) {
      let previous = 0;
      for (let value = 1; value <= 100; value += 1) {
        const preview = previewRigidTurnMatrix({ ...initial(rules), [key]: value }, { ...orders, riskTreatment }, ready, rules)!;
        assert.ok(preview.ultimate.committedChance >= previous, `${riskTreatment}: ${key} ${value - 1}→${value} reduced chance ${previous}→${preview.ultimate.committedChance}`);
        previous = preview.ultimate.committedChance;
      }
    }
  }
});

test("production domain credits sum to the original force totals without a disruption", () => {
  const generated = generateScenario(17, () => 0.37);
  const { rigidReadiness: production } = deriveForceReadiness({
    scenario: generated, difficulty: "standard",
    fleet: { "multirole-frigate": 3, "air-independent-submarine": 2, "fleet-aviation-ship": 1, "stealth-littoral-corvette": 1 },
    airWing: { "uncrewed-surveillance-rotorcraft": 8, "maritime-mission-helicopter": 4, "low-signature-uncrewed-scout": 3 },
    selectedArmaments: { "vessel-passive-surface-tracking-pack": 2, "shipborne-asw-pack": 2 },
    selectedWarfare: ["air-defense", "surface-operations", "undersea-operations", "reconnaissance"],
    selectedEndState: generated.endState, selectedLens: generated.lenses[0], selectedPartnerLens: generated.lenses[1], selectedGuardrail: generated.guardrail,
  });
  const domains = Object.values(production.capabilityProfile!);
  assert.ok(domains.length >= 3 && production.trackCapacity > 0 && production.selectedUnitCount > 0);
  for (const key of ["trackCapacity", "escortValue", "airDefenseValue", "underseaValue", "lowSignatureCount"] as const) {
    assert.equal(domains.reduce((sum, domain) => sum + domain[key], 0), production[key], key);
  }
  assert.equal(domains.reduce((sum, domain) => sum + domain.unitCount, 0), production.selectedUnitCount);
  assert.equal(production.capabilityProfile!.surface!.lowSignatureCount, 1);
  assert.equal(production.capabilityProfile!.air!.lowSignatureCount, 3);
  assert.equal(production.capabilityProfile!.subsurface!.lowSignatureCount, 2);
  assert.equal(production.lowSignatureCount, 6);
  assert.deepEqual([...new Set(domains.flatMap((domain) => domain.trackingMethods))].sort(), production.trackingMethods);
});

test("secondary work needs an available ready force while remaining independent of primary firing range", () => {
  const rules = scenario();
  rules.matrix!.secondaryObjective = { id: "secondary-test", label: "Recover systems", description: "Restore the recovery capacity.", revealTurn: 1, minimumDifficulty: "guided", weight: 28, method: "system-accountability" };
  const work = { ...orders, tempo: "hold" as const, engagement: "avoid" as const, riskTreatment: "recover" as const, coordination: "mutual-support" as const };
  const suitable = turn(rules, work, { ...ready, maxReachNm: 1 });
  assert.equal(suitable.objectiveProgress, 0);
  assert.ok(suitable.secondaryObjectiveProgress! > 0, "supported recovery work does not require hostile contact or firing range");
  assert.equal(turn(rules, work, { ...ready, missionReady: false }).secondaryObjectiveProgress, 0);
  assert.equal(turn(rules, work, ready, { ...initial(rules), readiness: 0 }).secondaryObjectiveProgress, 0);
  const outage = { ...disruption("selected-force", "air"), affectedDomains: ["surface", "air", "subsurface", "mission-pack"] as ScenarioDisruption["affectedDomains"] };
  const unavailable = { ...rules, matrix: { ...rules.matrix!, disruptions: [outage] } };
  const failedWork = turn(unavailable, work);
  assert.equal(failedWork.secondaryObjectiveProgress, 0);
  assert.ok(failedWork.readiness <= initial(unavailable).readiness, "no crews or platforms available to perform recovery");
});
