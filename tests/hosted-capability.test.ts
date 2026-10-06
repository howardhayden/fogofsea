import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { AIRCRAFT } from "../app/catalog";
import { largestInventedDistance } from "../app/catalogMath";
import { deriveForceReadiness } from "../app/forceReadiness";
import { ARMAMENTS, generateScenario, type Scenario } from "../app/gameModel";
import { createInitialRigidState, DEFAULT_RIGID_ORDERS, previewRigidTurnMatrix, resolveRigidTurn, type RigidOrders, type RigidScenario } from "../app/kriegsspiel";
import type { PortableSave } from "../app/saveGame";
import type { ScenarioDisruption } from "../app/scenarioMatrix";

const cases = [
  { domain: "air", host: "deck-multirole-aircraft", pack: "airborne-anti-surface-pack", fleet: { "fleet-aviation-ship": 1 }, airWing: { "deck-multirole-aircraft": 2 } },
  { domain: "surface", host: "area-defense-destroyer", pack: "surface-land-effect-pack", fleet: { "area-defense-destroyer": 1 }, airWing: {} },
  { domain: "subsurface", host: "long-endurance-submarine", pack: "submarine-land-effect-pack", fleet: { "long-endurance-submarine": 1 }, airWing: {} },
] as const;

function catalogCase(entry: typeof cases[number]) {
  const base = generateScenario(31, () => 0.4);
  const pack = ARMAMENTS.find((candidate) => candidate.id === entry.pack)!;
  assert.ok(base.matrix);
  const scenario: Scenario & RigidScenario = {
    ...base,
    difficulty: "standard",
    climate: "ocean", time: "day", clouds: "clear", precipitation: "none", seaState: 2, visibility: 12,
    required: [pack.warfare[0]], recommended: ["reconnaissance"],
    matrix: {
      ...base.matrix, version: 2, forceScale: "medium", forceScaleLabel: "Cruiser-hunting group", estimatedOpposingElements: [8, 16],
      disruptions: [], secondaryObjective: null, committedTurnDraws: [1, 1, 1, 1, 1, 1],
    },
  };
  const derived = deriveForceReadiness({
    scenario, difficulty: "standard", fleet: entry.fleet, airWing: entry.airWing,
    selectedArmaments: { [entry.pack]: 1 }, selectedWarfare: [...new Set([...pack.warfare, "reconnaissance" as const])],
    selectedEndState: scenario.endState, selectedLens: scenario.lenses[0], selectedPartnerLens: scenario.lenses[1], selectedGuardrail: scenario.guardrail,
  });
  return { scenario, pack, derived };
}

test("catalog mission packs retain the actual credited host domain, tracking and paired reach", () => {
  for (const entry of cases) {
    const { pack, derived } = catalogCase(entry);
    assert.equal(derived.metrics.pointCredit.missionCreditedArmaments[entry.pack], 1);
    assert.equal(derived.metrics.armamentFit.assignmentsByArmament[entry.pack][entry.host], 1);
    const credits = derived.rigidReadiness.hostedMissionPacks!;
    assert.equal(credits.length, 1);
    const host = AIRCRAFT.find((candidate) => candidate.id === entry.host);
    assert.deepEqual(credits[0], {
      hostDomain: entry.domain, quantity: 1, trackCapacity: pack.trackCapacity,
      trackingMethods: [...new Set(pack.trackingMethods)].sort(),
      maxReachNm: largestInventedDistance(pack.reach) + (host ? largestInventedDistance(host.missionReach) : 0),
    });
  }
});

test("unavailable catalog hosts cannot lend mission-pack effects or distant reach; surviving hosts keep their range", () => {
  for (const entry of cases) {
    const { scenario, derived } = catalogCase(entry);
    // Isolate the physical availability gate from the separate planning gate.
    // All unit/pack credits and host pairings remain actual catalog derivations.
    const readiness = { ...derived.rigidReadiness, missionReady: true, planningScore: 100, adaptationScore: 100 };
    const orders: RigidOrders = { ...DEFAULT_RIGID_ORDERS, tempo: "hold", engagement: "contain", sensors: "passive-search", task: scenario.required[0] };
    const resolve = (availabilityMultiplier: number) => {
      const event: ScenarioDisruption = {
        id: `host-${entry.domain}`, kind: "command-interference", headline: "Host availability", description: "The named host domain is unavailable.",
        startsTurn: 1, endsTurn: 1, minimumDifficulty: "standard", severity: "major", affectedSide: "selected-force",
        affectedDomains: [entry.domain], availabilityMultiplier, permanentLossFraction: 0, opposingPressureMultiplier: 1,
      };
      const affected = { ...scenario, matrix: { ...scenario.matrix!, disruptions: [event] } };
      const initial = { ...createInitialRigidState(readiness, affected), contactQuality: 100, rangeNm: 200 };
      return resolveRigidTurn(initial, orders, readiness, affected).reports[0];
    };
    const partialAvailability = resolve(0.5);
    assert.equal(partialAvailability.matrixResolution?.ultimate.result, "success");
    assert.ok(partialAvailability.delta.objectiveProgress > 0, `${entry.domain}: remaining hosts retain distant effect reach`);
    const unavailable = resolve(0);
    assert.equal(unavailable.matrixResolution?.ultimate.result, "success", "a favorable draw cannot recreate the missing host");
    assert.equal(unavailable.delta.objectiveProgress, 0, `${entry.domain}: no objective effect from an unavailable host`);
    assert.equal(unavailable.delta.opposingCohesion, 0, `${entry.domain}: no opposing effect from an unavailable host`);
  }
});

test("a generated polar-low window degrades airborne packs with their aircraft hosts", () => {
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/legacy-matrix-v1-campaigns.json", import.meta.url), "utf8")) as {
    campaigns: Array<{ initialSave: PortableSave; orders: RigidOrders[] }>;
  };
  const campaign = fixture.campaigns[0];
  const game = campaign.initialSave.game;
  assert.ok(game.scenario.matrix);
  const scenario = { ...game.scenario, matrix: { ...game.scenario.matrix, version: 2 as const }, difficulty: "challenge" as const, selectedLens: game.selectedLens || undefined };
  const readiness = deriveForceReadiness({
    ...game, scenario, difficulty: "challenge",
    selectedArmaments: game.selectedArmaments ?? {}, selectedPartnerLens: game.selectedPartnerLens ?? "",
  }).rigidReadiness;
  assert.equal(readiness.hostedMissionPacks?.length, 1);
  assert.equal(readiness.hostedMissionPacks[0].hostDomain, "air");
  assert.equal(readiness.hostedMissionPacks[0].trackCapacity, 96);
  // This genuine generated turn has air and communications at .78. The 232
  // aircraft and 96 hosted-pack tracks must all receive .78*.78, not let the
  // packs keep their former .78-only availability after their host degrades.
  const state = { ...createInitialRigidState(readiness, scenario), turn: 4 };
  const resolution = previewRigidTurnMatrix(state, campaign.orders[0], readiness, scenario);
  assert.ok(resolution);
  assert.equal(resolution.components.find((component) => component.key === "contact")?.committedChance, 43);
});
