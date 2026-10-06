import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  activateMatrixForDifficulty,
  activeCapabilityFactors,
  createScenarioMatrix,
  estimateResolutionMatrix,
  isActivatedScenarioMatrix,
  isCanonicalResolutionMatrix,
  isResolutionMatrix,
  isResolutionMatrixInput,
  isScenarioMatrix,
  type ForceScale,
  type IllicitNetworkType,
  type MatrixComponentKey,
  type ResolutionMatrixInput,
  type StochasticOutcomeRow,
} from "../app/scenarioMatrix";

const environment = { climate: "ocean" as const, regionId: "pelagic-island-arc", season: "autumn" as const };

function probabilityRow(row: StochasticOutcomeRow) {
  assert.ok(row.every((probability) => Number.isFinite(probability) && probability >= 0 && probability <= 1));
  assert.ok(Math.abs(row.reduce((sum, probability) => sum + probability, 0) - 1) < 1e-12);
}

function neutralMatrix() {
  return activateMatrixForDifficulty({
    ...createScenarioMatrix({ exerciseId: 83, ...environment }),
    forceScale: "medium" as const,
    forceScaleLabel: "Cruiser-hunting group",
    estimatedOpposingElements: [8, 16] as const,
    disruptions: [],
    secondaryObjective: null,
  }, "standard");
}

const weightedInput: ResolutionMatrixInput = {
  turn: 3,
  contactQuality: 40,
  taskFit: 60,
  environmentFit: 80,
  coordinationFit: 20,
  sustainment: 90,
  componentWeights: { contact: 1, task: 2, environment: 3, coordination: 4, sustainment: 5 },
};

test("the original generator and all 720 frozen v1 resolutions replay byte for byte", () => {
  // Captured from deployed commit 56a8a9cffdb9831097efdc64a09dabd39f459779,
  // before adding version 2. These protect historical saves, not v2 tuning.
  const matrices = Array.from({ length: 40 }, (_, index) => createScenarioMatrix({
    exerciseId: index + 1, ...environment, adversaryCount: (index + 1) % 4, version: 1,
  }));
  assert.equal(createHash("sha256").update(JSON.stringify(matrices)).digest("hex"), "fa698ddeb184cbf50d9919bf0ffeeb7af1d6e158a4dbd3302652fb26331e5f6b");
  const resolutions = matrices.flatMap((matrix, index) => (["guided", "standard", "challenge"] as const).flatMap((difficulty) => (
    Array.from({ length: 6 }, (_, turnIndex) => {
      const exerciseId = index + 1;
      const turn = turnIndex + 1;
      return estimateResolutionMatrix(activateMatrixForDifficulty(matrix, difficulty), {
        turn,
        contactQuality: (exerciseId * 7 + turn) % 101,
        taskFit: (exerciseId * 11 + turn) % 101,
        environmentFit: (exerciseId * 13 + turn) % 101,
        coordinationFit: (exerciseId * 17 + turn) % 101,
        sustainment: (exerciseId * 19 + turn) % 101,
      });
    })
  )));
  assert.equal(createHash("sha256").update(JSON.stringify(resolutions)).digest("hex"), "0e44ed4e9d8afa391064b7d91116ebb4aa3bc4d2f4351c1629c6b211f629a93e");
  assert.ok(resolutions.every(isResolutionMatrix));
  for (let index = 0; index < matrices.length; index += 1) {
    const current = createScenarioMatrix({ exerciseId: index + 1, ...environment, adversaryCount: (index + 1) % 4 });
    assert.equal(current.version, 2);
    assert.deepEqual({ ...current, version: 1 }, matrices[index], "upgrading the resolver cannot consume new scenario draws");
  }
});

test("conditional component matrices compose through normalized execution and support mixtures", () => {
  const matrix = neutralMatrix();
  const resolution = estimateResolutionMatrix(matrix, weightedInput);
  assert.equal(resolution.version, 2);
  if (resolution.version !== 2) throw new Error("Expected current stochastic resolver.");
  assert.deepEqual(resolution.components.map((component) => component.influence), [1, 2, 3, 4, 5].map((weight) => weight / 15));
  assert.deepEqual(resolution.groups.map((group) => group.componentKeys), [["contact", "task", "environment"], ["coordination", "sustainment"]]);
  assert.ok(Math.abs(resolution.ultimate.weights[0] - 0.4) < 1e-12);
  assert.ok(Math.abs(resolution.ultimate.weights[1] - 0.6) < 1e-12);
  for (const component of resolution.components) probabilityRow(component.probabilities);
  for (const group of resolution.groups) {
    probabilityRow(group.probabilities);
    assert.ok(Math.abs(group.weights.reduce((sum, weight) => sum + weight, 0) - 1) < 1e-12);
  }
  // Independent hand calculation: success=(40+120+240+80+450)/15=62%;
  // partial=(12+24+36+48+50)/15=11 1/3%; rounded cumulative bins=62,73.
  assert.deepEqual(resolution.ultimate.probabilities, [0.62, 0.11, 0.27]);
  assert.equal(resolution.ultimate.committedChance, 62);
  assert.equal(isResolutionMatrix(resolution), true);
  assert.equal(isCanonicalResolutionMatrix(matrix, resolution, weightedInput), true);
});

test("all 100 outer draws exactly realize the advertised accumulated outcome probabilities", () => {
  const matrix = neutralMatrix();
  const results = { success: 0, partial: 0, failure: 0 };
  for (let draw = 1; draw <= 100; draw += 1) {
    const committedTurnDraws = [...matrix.committedTurnDraws];
    committedTurnDraws[2] = draw;
    const resolution = estimateResolutionMatrix({ ...matrix, committedTurnDraws }, weightedInput);
    assert.equal(resolution.version, 2);
    if (resolution.version !== 2) throw new Error("Expected current stochastic resolver.");
    assert.deepEqual(resolution.ultimate.probabilities, [0.62, 0.11, 0.27]);
    results[resolution.ultimate.result] += 1;
    assert.equal(isResolutionMatrix(resolution), true);
  }
  assert.deepEqual(results, { success: 62, partial: 11, failure: 27 });
});

test("rescaling equivalent influence weights cannot move a cumulative rounding boundary", () => {
  const input: ResolutionMatrixInput = {
    turn: 3, contactQuality: 63, taskFit: 44, environmentFit: 25, coordinationFit: 27, sustainment: 58,
    componentWeights: { contact: 4, task: 5, environment: 6, coordination: 7, sustainment: 8 },
  };
  const baseline = estimateResolutionMatrix(neutralMatrix(), input);
  if (baseline.version !== 2) throw new Error("Expected current stochastic resolver.");
  // Exact weighted success is 42.5%, hence 43 bins, regardless of units used
  // to express the same relative importance.
  assert.equal(baseline.ultimate.committedChance, 43);
  for (const scale of [0.001, 0.1, 1.1, 2, 5, 10]) {
    const componentWeights = Object.fromEntries(Object.entries(input.componentWeights!).map(([key, weight]) => [key, weight * scale])) as Record<MatrixComponentKey, number>;
    const resolution = estimateResolutionMatrix(neutralMatrix(), { ...input, componentWeights });
    if (resolution.version !== 2) throw new Error("Expected current stochastic resolver.");
    assert.deepEqual(resolution.ultimate.probabilities, baseline.ultimate.probabilities);
  }
});

test("inner probabilities depend on assessed conditions, never a hidden seed or sampled component result", () => {
  const matrix = neutralMatrix();
  const baseline = estimateResolutionMatrix(matrix, weightedInput);
  for (let seed = 0; seed < 100; seed += 1) {
    const resolution = estimateResolutionMatrix({ ...matrix, seed }, weightedInput);
    assert.deepEqual(resolution, baseline);
  }
  const draws = [...matrix.committedTurnDraws];
  draws[2] = baseline.ultimate.result === "success" ? 100 : 1;
  const changedDraw = estimateResolutionMatrix({ ...matrix, committedTurnDraws: draws }, weightedInput);
  assert.deepEqual(changedDraw.components, baseline.components);
  if (baseline.version !== 2 || changedDraw.version !== 2) throw new Error("Expected current stochastic resolver.");
  assert.deepEqual(changedDraw.groups, baseline.groups);
  assert.deepEqual(changedDraw.ultimate.probabilities, baseline.ultimate.probabilities);
  assert.notEqual(changedDraw.ultimate.result, baseline.ultimate.result);
});

test("improving any assessed condition cannot worsen either cumulative outcome boundary at fixed importance", () => {
  const fields: Record<MatrixComponentKey, keyof Pick<ResolutionMatrixInput, "contactQuality" | "taskFit" | "environmentFit" | "coordinationFit" | "sustainment">> = {
    contact: "contactQuality", task: "taskFit", environment: "environmentFit", coordination: "coordinationFit", sustainment: "sustainment",
  };
  for (const field of Object.values(fields)) {
    let previousSuccess = 0;
    let previousNonFailure = 0;
    for (let score = 0; score <= 100; score += 1) {
      const resolution = estimateResolutionMatrix(neutralMatrix(), { ...weightedInput, [field]: score });
      if (resolution.version !== 2) throw new Error("Expected current stochastic resolver.");
      const [success, partial] = resolution.ultimate.probabilities;
      assert.ok(success + 1e-12 >= previousSuccess, `${field}=${score}: success`);
      assert.ok(success + partial + 1e-12 >= previousNonFailure, `${field}=${score}: non-failure`);
      previousSuccess = success;
      previousNonFailure = success + partial;
    }
  }
});

test("the v2 resolver does not invent an adverse probability penalty for an opposition-only event", () => {
  const matrix = neutralMatrix();
  const favorable = {
    id: "opposition-only-opportunist", kind: "opportunistic-actor" as const,
    headline: "Opposition-only opportunist", description: "The independent actor burdens the primary opposition.",
    startsTurn: 2, endsTurn: 4, minimumDifficulty: "standard" as const, severity: "watch" as const,
    affectedSide: "opposing-force" as const, affectedDomains: ["surface" as const],
    availabilityMultiplier: 1, permanentLossFraction: 0, opposingPressureMultiplier: 0.9,
    opportunisticActorType: "resource-seeking-spoiler" as const,
  };
  const withEvent = activateMatrixForDifficulty({ ...matrix, disruptions: [favorable, { ...favorable, id: "second-opportunist" }] }, "standard");
  // The engine assesses signed event effects in the inputs. The probability
  // layer cannot count the same event again merely because a window exists.
  assert.deepEqual(estimateResolutionMatrix(withEvent, weightedInput), estimateResolutionMatrix(matrix, weightedInput));
});

test("malformed weights and edited nested probabilities cannot masquerade as a canonical resolution", () => {
  const matrix = neutralMatrix();
  for (const weight of [0, Number.MIN_VALUE, -1, 101, Number.NaN, Number.POSITIVE_INFINITY]) {
    const input = { ...weightedInput, componentWeights: { ...weightedInput.componentWeights!, contact: weight } };
    assert.equal(isResolutionMatrixInput(input), false);
    assert.throws(() => estimateResolutionMatrix(matrix, input), /Invalid stochastic matrix inputs/);
  }
  const original = estimateResolutionMatrix(matrix, weightedInput);
  if (original.version !== 2) throw new Error("Expected current stochastic resolver.");
  const innerDraw = { ...original, components: original.components.map((component, index) => index === 0 ? { ...component, draw: 42 } : component) };
  assert.equal(isResolutionMatrix(innerDraw), false);
  const alteredGroup = structuredClone(original);
  alteredGroup.groups[0].probabilities = [0.8, 0.1, 0.1];
  assert.equal(isResolutionMatrix(alteredGroup), false);
  const alteredMass = structuredClone(original);
  alteredMass.ultimate.probabilities = [0.63, 0.1, 0.27];
  assert.equal(isResolutionMatrix(alteredMass), false);
  assert.equal(isCanonicalResolutionMatrix({ ...matrix, version: 1 }, original, weightedInput), false);
});

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

test("nested component distributions resist same-state rerolls and reserve luck for the outer matrix", () => {
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
  assert.equal(first.version, 2);
  assert.equal(differentChances.version, 2);
  for (const component of first.components) {
    assert.equal(Object.hasOwn(component, "draw"), false);
    assert.equal(Object.hasOwn(component, "result"), false);
  }
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
