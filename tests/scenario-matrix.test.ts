import assert from "node:assert/strict";
import test from "node:test";
import {
  activateMatrixForDifficulty,
  activeCapabilityFactors,
  createScenarioMatrix,
  estimateResolutionMatrix,
  isActivatedScenarioMatrix,
  isScenarioMatrix,
  type ForceScale,
  type IllicitNetworkType,
} from "../app/scenarioMatrix";

const environment = { climate: "ocean" as const, regionId: "pelagic-island-arc", season: "autumn" as const };

test("scenario matrices are replay-stable, bounded, and change with the exercise identity", () => {
  const first = createScenarioMatrix({ exerciseId: 41, ...environment });
  const replay = createScenarioMatrix({ exerciseId: 41, ...environment });
  const next = createScenarioMatrix({ exerciseId: 42, ...environment });
  assert.deepEqual(first, replay);
  assert.notDeepEqual(first, next);
  assert.equal(isScenarioMatrix(first), true);
  assert.deepEqual(first.committedTurnDraws, replay.committedTurnDraws);
  assert.equal(first.committedTurnDraws.length, 6);
});

test("force scale and illicit-network category vary independently of difficulty", () => {
  const scales = new Set<ForceScale>();
  const illicit = new Set<IllicitNetworkType>();
  for (let exerciseId = 1; exerciseId <= 600; exerciseId += 1) {
    const matrix = createScenarioMatrix({ exerciseId, ...environment });
    scales.add(matrix.forceScale);
    illicit.add(matrix.illicitNetworkType);
    for (const difficulty of ["guided", "standard", "challenge"] as const) {
      assert.equal(activateMatrixForDifficulty(matrix, difficulty).forceScale, matrix.forceScale);
    }
  }
  assert.deepEqual([...scales].sort(), ["large", "massive", "medium", "small", "tiny"]);
  assert.equal(illicit.size, 9);
});

test("cooperation frames require multiple opposing actors", () => {
  for (let exerciseId = 1; exerciseId <= 120; exerciseId += 1) {
    const singleActor = createScenarioMatrix({ exerciseId, ...environment, adversaryCount: 1 });
    assert.equal(singleActor.opponentCoordination, "none");
  }
  const multiActorModes = new Set(Array.from({ length: 240 }, (_, index) => createScenarioMatrix({
    exerciseId: index + 1,
    ...environment,
    adversaryCount: 3,
  }).opponentCoordination));
  assert.ok(multiActorModes.has("none"));
  assert.ok(multiActorModes.has("opportunistic"));
  assert.ok(multiActorModes.has("selective"));
  assert.ok(multiActorModes.has("integrated"));
});

test("independent opportunists can emerge without inventing primary-opponent cooperation", () => {
  let independent = null as ReturnType<typeof createScenarioMatrix> | null;
  const actorTypes = new Set<string>();
  const targets = new Set<string>();
  for (let exerciseId = 1; exerciseId <= 1_200; exerciseId += 1) {
    const matrix = createScenarioMatrix({ exerciseId, ...environment, adversaryCount: 1 });
    const event = matrix.disruptions.find((candidate) => candidate.kind === "opportunistic-actor");
    if (!event) continue;
    independent ??= matrix;
    actorTypes.add(String(event.opportunisticActorType));
    targets.add(event.affectedSide);
    if (event.affectedSide === "selected-force") assert.ok(event.opposingPressureMultiplier > 1);
    if (event.affectedSide === "opposing-force") assert.ok(event.opposingPressureMultiplier < 1);
    if (event.affectedSide === "both") assert.equal(event.opposingPressureMultiplier, 1);
    assert.equal(matrix.opponentCoordination, "none");
    assert.doesNotMatch(event.description, /cooperat|shared command|shared political aim/i);
    assert.match(event.description, /does not share command, information, or political aims/i);
    assert.equal(activateMatrixForDifficulty(matrix, "guided").activeDisruptions.some((item) => item.id === event.id), false);
  }
  assert.ok(independent);
  assert.equal(actorTypes.size, 5);
  assert.deepEqual([...targets].sort(), ["both", "opposing-force", "selected-force"]);
});

test("higher difficulty activates at least as much compound uncertainty and adverse weighting", () => {
  for (let exerciseId = 1; exerciseId <= 180; exerciseId += 1) {
    const matrix = createScenarioMatrix({ exerciseId, ...environment });
    const guided = activateMatrixForDifficulty(matrix, "guided");
    const standard = activateMatrixForDifficulty(matrix, "standard");
    const challenge = activateMatrixForDifficulty(matrix, "challenge");
    assert.ok(guided.activeDisruptions.length <= standard.activeDisruptions.length);
    assert.ok(standard.activeDisruptions.length <= challenge.activeDisruptions.length);
    assert.ok(guided.adverseBias < standard.adverseBias);
    assert.ok(standard.adverseBias < challenge.adverseBias);
    assert.equal(challenge.activeCoordination, matrix.opponentCoordination);
    const cooperation = challenge.activeDisruptions.find((event) => event.kind === "opposing-coordination");
    if (matrix.opponentCoordination === "none") assert.equal(cooperation, undefined);
    if (cooperation) {
      assert.match(cooperation.description.toLocaleLowerCase(), new RegExp(matrix.opponentCoordination));
      assert.equal(
        cooperation.opposingPressureMultiplier,
        matrix.opponentCoordination === "integrated" ? 1.2 : matrix.opponentCoordination === "selective" ? 1.12 : 1.06,
      );
    }
    assert.equal(isActivatedScenarioMatrix(challenge), true);
  }
});

test("active disruptions reduce only named domains and recover after the inclusive window", () => {
  let found = false;
  for (let exerciseId = 1; exerciseId <= 400 && !found; exerciseId += 1) {
    const activated = activateMatrixForDifficulty(createScenarioMatrix({ exerciseId, ...environment }), "challenge");
    const event = activated.activeDisruptions.find((candidate) => candidate.availabilityMultiplier < 1);
    if (!event) continue;
    found = true;
    const during = activeCapabilityFactors(activated, event.startsTurn);
    const after = activeCapabilityFactors(activated, Math.min(7, event.endsTurn + 1));
    for (const domain of event.affectedDomains) {
      if (event.affectedSide === "selected-force" || event.affectedSide === "both") assert.ok(during.selected[domain] < 1);
      if (event.affectedSide === "opposing-force" || event.affectedSide === "both") assert.ok(during.opposing[domain] < 1);
      if (event.endsTurn < 6) {
        assert.equal(after.selected[domain], 1);
        assert.equal(after.opposing[domain], 1);
      }
    }
  }
  assert.equal(found, true);
});

test("temporary disruption recovers while permanent loss persists symmetrically", () => {
  const base = createScenarioMatrix({ exerciseId: 59, ...environment, adversaryCount: 2 });
  const temporary = {
    ...base.disruptions[0],
    startsTurn: 2,
    endsTurn: 3,
    affectedSide: "both" as const,
    affectedDomains: ["air" as const],
    availabilityMultiplier: 0.6,
    permanentLossFraction: 0,
    minimumDifficulty: "guided" as const,
  };
  const permanent = { ...temporary, id: "permanent-test", permanentLossFraction: 0.1 };
  const temporaryMatrix = activateMatrixForDifficulty({ ...base, disruptions: [temporary] }, "challenge");
  const permanentMatrix = activateMatrixForDifficulty({ ...base, disruptions: [permanent] }, "challenge");
  assert.equal(activeCapabilityFactors(temporaryMatrix, 2).selected.air, 0.6);
  assert.equal(activeCapabilityFactors(temporaryMatrix, 4).selected.air, 1);
  assert.equal(activeCapabilityFactors(temporaryMatrix, 4).opposing.air, 1);
  assert.ok(Math.abs(activeCapabilityFactors(permanentMatrix, 2).selected.air - 0.54) < 1e-9);
  assert.ok(Math.abs(activeCapabilityFactors(permanentMatrix, 4).selected.air - 0.9) < 1e-9);
  assert.ok(Math.abs(activeCapabilityFactors(permanentMatrix, 4).opposing.air - 0.9) < 1e-9);
});

test("nested component and ultimate matrices use committed draws and resist same-state rerolls", () => {
  const activated = activateMatrixForDifficulty(createScenarioMatrix({ exerciseId: 83, ...environment }), "challenge");
  const input = {
    turn: 3,
    contactQuality: 72,
    taskFit: 80,
    environmentFit: 70,
    coordinationFit: 68,
    sustainment: 74,
  };
  const first = estimateResolutionMatrix(activated, input);
  const replay = estimateResolutionMatrix(activated, input);
  const differentChances = estimateResolutionMatrix(activated, { ...input, taskFit: 35, coordinationFit: 32 });
  assert.deepEqual(first, replay);
  assert.equal(first.components.length, 5);
  assert.equal(first.ultimate.draw, activated.committedTurnDraws[2]);
  assert.deepEqual(first.components.map((item) => item.draw), differentChances.components.map((item) => item.draw));
  assert.notDeepEqual(first.components.map((item) => item.committedChance), differentChances.components.map((item) => item.committedChance));
  assert.notEqual(first.ultimate.committedChance, differentChances.ultimate.committedChance);
  for (const component of [...first.components, first.ultimate]) {
    assert.ok(component.range[0] >= 1 && component.range[1] <= 99);
    assert.ok(component.range[0] <= component.committedChance && component.committedChance <= component.range[1]);
  }
});

test("opposing force scale changes the disclosed task and coordination ranges", () => {
  const base = createScenarioMatrix({ exerciseId: 91, ...environment, adversaryCount: 3 });
  const input = {
    turn: 2,
    contactQuality: 66,
    taskFit: 72,
    environmentFit: 70,
    coordinationFit: 68,
    sustainment: 74,
  };
  const tiny = estimateResolutionMatrix(activateMatrixForDifficulty({
    ...base,
    forceScale: "tiny",
    forceScaleLabel: "Tiny dispersed craft group",
    estimatedOpposingElements: [2, 5],
  }, "challenge"), input);
  const massive = estimateResolutionMatrix(activateMatrixForDifficulty({
    ...base,
    forceScale: "massive",
    forceScaleLabel: "Massive combined formation",
    estimatedOpposingElements: [26, 48],
  }, "challenge"), input);
  assert.ok(tiny.components.find((item) => item.key === "task")!.committedChance > massive.components.find((item) => item.key === "task")!.committedChance);
  assert.ok(tiny.components.find((item) => item.key === "coordination")!.committedChance > massive.components.find((item) => item.key === "coordination")!.committedChance);
  assert.ok(tiny.ultimate.committedChance > massive.ultimate.committedChance);
});

test("regional severe-weather names remain climate coherent", () => {
  const samples = [
    { climate: "ocean" as const, regionId: "pelagic-island-arc", season: "autumn" as const, allowed: /^Hurricane-class tropical cyclone$/i },
    { climate: "ocean" as const, regionId: "western-tropical-passage", season: "summer" as const, allowed: /^Typhoon-class tropical cyclone$/i },
    { climate: "ocean" as const, regionId: "equatorial-convergence", season: "wet" as const, allowed: /^Tropical cyclone$/i },
    { climate: "ocean" as const, regionId: "temperate-strait", season: "autumn" as const, allowed: /^Severe ocean storm$/i },
    { climate: "arctic" as const, regionId: "boreal-ice-gate", season: "winter" as const, allowed: /Polar cyclone|polar low/i },
    { climate: "antarctic" as const, regionId: "southern-ice-margin", season: "summer" as const, allowed: /polar low/i },
  ];
  for (const sample of samples) {
    const event = createScenarioMatrix({ exerciseId: 12, climate: sample.climate, regionId: sample.regionId, season: sample.season }).disruptions.find((item) => item.kind === "severe-weather");
    assert.ok(event);
    assert.match(event.headline, sample.allowed);
  }
});
