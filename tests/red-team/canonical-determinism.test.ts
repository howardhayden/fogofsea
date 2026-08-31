import assert from "node:assert/strict";
import test from "node:test";
import { beginCommandTransition, commandScenario } from "../../app/commandPhase";
import { deriveForceReadiness } from "../../app/forceReadiness";
import type { Warfare } from "../../app/gameModel";
import { createInitialRigidState, DEFAULT_RIGID_ORDERS, type RigidReadiness } from "../../app/kriegsspiel";
import { parsePortableSave } from "../../app/saveGame";
import {
  activateMatrixForDifficulty,
  estimateResolutionMatrix,
  isActivatedScenarioMatrix,
  isCanonicalResolutionMatrix,
} from "../../app/scenarioMatrix";
import { deterministicScenario, minimalPortableSave } from "./fixtures";

const WARFARE_ORDER: readonly Warfare[] = [
  "air-defense",
  "surface-operations",
  "undersea-operations",
  "land-attack",
  "electromagnetic-operations",
  "reconnaissance",
  "mine-countermeasures",
  "missile-defense",
  "maritime-interdiction",
];

const readiness: RigidReadiness = {
  planningScore: 50,
  missionReady: false,
  requiredCoverage: 0,
  requiredCount: 1,
  forcePoints: 0,
  escortValue: 0,
  airDefenseValue: 0,
  underseaValue: 0,
  uncrewedCount: 0,
  supportedAircraftCount: 0,
  compatibleArmamentCount: 0,
  maxReachNm: 0,
  trackCapacity: 0,
  trackingMethods: [],
  lowSignatureCount: 0,
  selectedUnitCount: 0,
};

function reverseObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseObjectKeys);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .reverse()
    .map(([key, item]) => [key, reverseObjectKeys(item)]));
}

test("RT-DATA-008A: parsed scenario matrices are canonical regardless of JSON member order", () => {
  const save = minimalPortableSave(deterministicScenario(30));
  const { rigidReadiness } = deriveForceReadiness({
    scenario: save.game.scenario,
    difficulty: save.preferences.difficulty,
    fleet: save.game.fleet,
    airWing: save.game.airWing,
    selectedArmaments: save.game.selectedArmaments ?? {},
    selectedWarfare: save.game.selectedWarfare,
    selectedEndState: save.game.selectedEndState,
    selectedLens: save.game.selectedLens,
    selectedPartnerLens: save.game.selectedPartnerLens ?? "",
    selectedGuardrail: save.game.selectedGuardrail,
  });
  save.game.rigidState = createInitialRigidState(
    rigidReadiness,
    commandScenario(save.game.scenario, save.preferences.difficulty),
  );
  const reordered = reverseObjectKeys(save);

  const parsed = parsePortableSave(JSON.stringify(reordered));

  assert.deepEqual(parsed.game.scenario, JSON.parse(JSON.stringify(save.game.scenario)) as unknown);
});

test("RT-DATA-008B: activated and resolved matrices ignore object member order but preserve array order", () => {
  const scenario = deterministicScenario(31);
  assert.ok(scenario.matrix);
  const activated = activateMatrixForDifficulty(scenario.matrix, "challenge");
  const input = {
    turn: 3,
    contactQuality: 72,
    taskFit: 80,
    environmentFit: 70,
    coordinationFit: 68,
    sustainment: 74,
  };
  const resolution = estimateResolutionMatrix(activated, input);

  assert.equal(isActivatedScenarioMatrix(reverseObjectKeys(activated)), true);
  assert.equal(isCanonicalResolutionMatrix(activated, reverseObjectKeys(resolution), input), true);
  assert.equal(isCanonicalResolutionMatrix(
    activated,
    { ...resolution, components: [...resolution.components].reverse() },
    input,
  ), false, "component array order remains part of the committed resolution");
});

test("RT-UMP-006: default command task is required-first and independent of warfare click order", () => {
  const scenario = deterministicScenario(32);
  const selectedRequired = [...scenario.required].reverse();
  const unselectedTask = WARFARE_ORDER.find((area) => !selectedRequired.includes(area));
  assert.ok(unselectedTask);
  const orders = { ...DEFAULT_RIGID_ORDERS, task: unselectedTask };

  const first = beginCommandTransition({
    scenario,
    difficulty: "standard",
    readiness,
    orders,
    selectedWarfare: selectedRequired,
  });
  const second = beginCommandTransition({
    scenario,
    difficulty: "standard",
    readiness,
    orders,
    selectedWarfare: [...selectedRequired].reverse(),
  });

  assert.equal(first.orders.task, scenario.required[0]);
  assert.equal(second.orders.task, scenario.required[0]);

  const optionalOnly = WARFARE_ORDER.filter((area) => !scenario.required.includes(area)).slice(-2);
  assert.equal(optionalOnly.length, 2);
  const invalidOptionalTask = scenario.required[0];
  const canonicalOptional = WARFARE_ORDER.find((area) => optionalOnly.includes(area));
  assert.ok(canonicalOptional);
  const optionalFirst = beginCommandTransition({
    scenario,
    difficulty: "standard",
    readiness,
    orders: { ...DEFAULT_RIGID_ORDERS, task: invalidOptionalTask },
    selectedWarfare: optionalOnly,
  });
  const optionalSecond = beginCommandTransition({
    scenario,
    difficulty: "standard",
    readiness,
    orders: { ...DEFAULT_RIGID_ORDERS, task: invalidOptionalTask },
    selectedWarfare: [...optionalOnly].reverse(),
  });
  assert.equal(optionalFirst.orders.task, canonicalOptional);
  assert.equal(optionalSecond.orders.task, canonicalOptional);
});
