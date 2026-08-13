import assert from "node:assert/strict";
import test from "node:test";
import {
  generateScenario,
  SCENARIO_SYNTHESIS_MAX_ATTEMPTS,
  synthesizeScenario,
  validateScenarioCoexistence,
  type Scenario,
  type ScenarioCoexistenceFacet,
  type TheoryLens,
} from "../app/gameModel";

function seededRandom(initial: number) {
  let state = initial;
  return () => {
    state = (state * 48271) % 0x7fffffff;
    return state / 0x7fffffff;
  };
}

function scenarioSample(count: number, seed = 9137) {
  const random = seededRandom(seed);
  return Array.from({ length: count }, (_, index) => generateScenario(index, random));
}

function structuralFrame(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/\d+(?:\.\d+)?/g, "#")
    .replace(/\s+/g, " ")
    .trim();
}

function distribution(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return {
    distinct: counts.size,
    largest: Math.max(...counts.values()),
  };
}

function frames(scenarios: Scenario[], key: keyof Scenario) {
  return scenarios.map((scenario) => structuralFrame(String(scenario[key])));
}

test("seeded scenario generation is reproducible without collapsing different seeds", () => {
  assert.deepEqual(scenarioSample(32, 173), scenarioSample(32, 173));
  assert.notDeepEqual(scenarioSample(32, 173), scenarioSample(32, 174));
});

test("weather sampling makes adverse conditions common without breaking regional coherence", () => {
  const scenarios = scenarioSample(600, 8821);
  const adverse = scenarios.filter((scenario) => scenario.precipitation !== "none");
  const storms = scenarios.filter((scenario) => scenario.storming);
  assert.ok(adverse.length / scenarios.length >= 0.62, `${adverse.length} of ${scenarios.length} scenarios had precipitation`);
  assert.ok(storms.length / scenarios.length >= 0.25, `${storms.length} of ${scenarios.length} scenarios were storming`);
  assert.ok(new Set(adverse.map((scenario) => scenario.precipitation)).size === 2, "both regional rain and polar snow must remain present");
  assert.ok(adverse.every((scenario) => ["broken", "overcast"].includes(scenario.clouds)));
  assert.ok(storms.every((scenario) => scenario.clouds === "overcast"
    && scenario.precipitation !== "none"
    && scenario.windSpeed >= 30
    && scenario.seaState >= 5
    && scenario.visibility <= 4));
});

test("whole candidates retry with fresh entropy and only a validated complete scenario is presented", () => {
  const source = seededRandom(73);
  let draws = 0;
  const result = synthesizeScenario(0, () => {
    draws += 1;
    if (draws === 1) throw new Error("reject the first complete proposal");
    return source();
  });
  assert.equal(result.candidateAttempts, 2);
  assert.equal(result.usedConstructiveFallback, false);
  assert.equal(validateScenarioCoexistence(result.scenario).valid, true);
  assert.ok(draws > 20, "the retry consumed a fresh whole candidate rather than patching one failed field");
});

test("adversarial entropy terminates at a deterministic constructive fallback that also validates", () => {
  const boundedNumericSources: Array<() => number> = [
    () => Number.NaN,
    () => Number.POSITIVE_INFINITY,
    () => 1,
  ];
  boundedNumericSources.forEach((source, index) => {
    const first = synthesizeScenario(700 + index, source);
    const replay = synthesizeScenario(700 + index, source);
    assert.deepEqual(first.scenario, replay.scenario);
    assert.deepEqual(validateScenarioCoexistence(first.scenario).issues, []);
  });
  const unavailable = () => { throw new Error("entropy unavailable"); };
  const first = synthesizeScenario(799, unavailable);
  const replay = synthesizeScenario(799, unavailable);
  assert.equal(first.usedConstructiveFallback, true);
  assert.equal(first.candidateAttempts, SCENARIO_SYNTHESIS_MAX_ATTEMPTS);
  assert.deepEqual(first.scenario, replay.scenario);
  assert.deepEqual(validateScenarioCoexistence(first.scenario).issues, []);
});

test("coexistence diagnostics cover every coupled environmental, strategic, force, and matrix facet", () => {
  const scenarios = scenarioSample(180, 419);
  const expectedFacets = new Set<ScenarioCoexistenceFacet>([
    "identity", "region-climate", "season-date", "weather-cloud-precipitation",
    "sea-wind-current-visibility", "aurora-celestial", "mission-geography-objective",
    "forces", "difficulty-matrix", "narrative",
  ]);
  for (const scenario of scenarios) {
    const validation = validateScenarioCoexistence(scenario);
    assert.equal(validation.valid, true, `exercise ${scenario.id}: ${JSON.stringify(validation.issues)}`);
    assert.deepEqual(new Set(validation.checkedFacets), expectedFacets);
    assert.ok(validation.derived.missionFamily);
    assert.ok(validation.derived.threatFamily);
    if (scenario.time === "day") assert.equal(validation.derived.auroraEnvironmentEligible, false);
  }

  const base = scenarios.find((scenario) => scenario.climate === "ocean" && scenario.precipitation === "none")!;
  const mutations: Array<{ scenario: Scenario; facet: ScenarioCoexistenceFacet }> = [
    { scenario: { ...base, climate: "arctic" }, facet: "region-climate" },
    { scenario: { ...base, scenarioDate: "2037-02-01" }, facet: "season-date" },
    { scenario: { ...base, precipitation: "snow" }, facet: "weather-cloud-precipitation" },
    { scenario: { ...base, waveHeading: (base.waveHeading + 1) % 360 }, facet: "sea-wind-current-visibility" },
    { scenario: { ...base, observerLatitude: -base.observerLatitude }, facet: "aurora-celestial" },
    { scenario: { ...base, endState: base.endState === "access" ? "denial" : "access" }, facet: "mission-geography-objective" },
    { scenario: { ...base, required: base.required.filter((area) => area !== "reconnaissance") }, facet: "forces" },
    { scenario: { ...base, matrix: base.matrix && { ...base.matrix, committedTurnDraws: [(base.matrix.committedTurnDraws[0] % 100) + 1, ...base.matrix.committedTurnDraws.slice(1)] } }, facet: "difficulty-matrix" },
    { scenario: { ...base, brief: "Too short." }, facet: "narrative" },
  ];
  for (const mutation of mutations) {
    const validation = validateScenarioCoexistence(mutation.scenario);
    assert.equal(validation.valid, false);
    assert.ok(validation.issues.some((issue) => issue.facet === mutation.facet), `${mutation.facet}: ${JSON.stringify(validation.issues)}`);
  }
});

test("a 240-exercise sample has broad narrative and strategic-frame variety", () => {
  const scenarios = scenarioSample(240);
  const expectations: Array<{
    key: keyof Scenario;
    minimumDistinct: number;
    maximumRepeat: number;
  }> = [
    { key: "operation", minimumDistinct: 190, maximumRepeat: 5 },
    { key: "brief", minimumDistinct: 210, maximumRepeat: 5 },
    { key: "geography", minimumDistinct: 150, maximumRepeat: 7 },
    { key: "friendlySituation", minimumDistinct: 24, maximumRepeat: 20 },
    { key: "opposingSituation", minimumDistinct: 20, maximumRepeat: 24 },
    { key: "civilianContext", minimumDistinct: 19, maximumRepeat: 22 },
    { key: "constraints", minimumDistinct: 60, maximumRepeat: 12 },
    { key: "timing", minimumDistinct: 85, maximumRepeat: 10 },
    { key: "successConditions", minimumDistinct: 24, maximumRepeat: 24 },
    { key: "navalProblem", minimumDistinct: 24, maximumRepeat: 20 },
    { key: "objective", minimumDistinct: 60, maximumRepeat: 12 },
    { key: "intelligence", minimumDistinct: 95, maximumRepeat: 8 },
    { key: "history", minimumDistinct: 125, maximumRepeat: 8 },
    { key: "politicalAim", minimumDistinct: 24, maximumRepeat: 20 },
  ];

  for (const expectation of expectations) {
    const result = distribution(frames(scenarios, expectation.key));
    assert.ok(
      result.distinct >= expectation.minimumDistinct,
      `${String(expectation.key)} produced ${result.distinct} structural frames; expected at least ${expectation.minimumDistinct}`,
    );
    assert.ok(
      result.largest <= expectation.maximumRepeat,
      `${String(expectation.key)} repeated one structural frame ${result.largest} times; ceiling is ${expectation.maximumRepeat}`,
    );
  }

  const strategicFrames = scenarios.map((scenario) => structuralFrame([
    scenario.politicalAim,
    scenario.objective,
    scenario.constraints,
    scenario.successConditions,
    scenario.navalProblem,
  ].join(" | ")));
  assert.ok(new Set(strategicFrames).size >= 235, "strategic choices should not arrive as repeated bundled frames");
  assert.equal(new Set(scenarios.map((scenario) => scenario.endState)).size, 5);
  assert.equal(new Set(scenarios.map((scenario) => scenario.guardrail)).size, 5);
  assert.ok(new Set(scenarios.map((scenario) => scenario.lenses.join("|"))).size >= 8);
  assert.deepEqual(new Set(scenarios.map((scenario) => scenario.adversaryCount)), new Set([1, 2, 3]));
  const plural = scenarios.filter((scenario) => (scenario.adversaryCount ?? 1) > 1);
  assert.ok(plural.length >= 80);
  const coordinationCopy = {
    none: "are not currently assessed to share timing or information",
    opportunistic: "can coordinate opportunistically",
    selective: "can coordinate selectively",
    integrated: "can use integrated timing and information",
  } as const;
  assert.ok(plural.every((scenario) => {
    assert.ok(scenario.matrix);
    return scenario.opposingSituation.includes(coordinationCopy[scenario.matrix.opponentCoordination]);
  }));
});

const THEORY_NAMES: Record<TheoryLens, string> = {
  "sun-tzu": "sun tzu",
  clausewitz: "clausewitz",
  mahan: "mahan",
  aube: "aube",
  corbett: "corbett",
  richmond: "richmond",
  wegener: "wegener",
  castex: "castex",
  panikkar: "panikkar",
  gorshkov: "gorshkov",
  "liu-huaqing": "liu huaqing",
  till: "till",
  galula: "galula",
};

test("generated fields remain coherent, comparative, and non-duplicative", () => {
  for (const scenario of scenarioSample(480, 27183)) {
    const narrativeFields = [
      scenario.brief,
      scenario.geography,
      scenario.friendlySituation,
      scenario.opposingSituation,
      scenario.civilianContext,
      scenario.objective,
      scenario.intelligence,
      scenario.constraints,
      scenario.timing,
      scenario.successConditions,
      scenario.navalProblem,
      scenario.history,
      scenario.politicalAim,
    ];
    assert.ok(narrativeFields.every((value) => value.trim().length >= 24), `exercise ${scenario.id} has a thin narrative field`);
    assert.equal(new Set(narrativeFields.map(structuralFrame)).size, narrativeFields.length, `exercise ${scenario.id} repeats a narrative field`);
    assert.ok(!scenario.brief.includes(scenario.opposingSituation), `exercise ${scenario.id} repeats the full opposing situation in its brief`);

    const problem = scenario.navalProblem.toLocaleLowerCase();
    const namedLenses = scenario.lenses.filter((lens) => problem.includes(THEORY_NAMES[lens]));
    assert.ok(namedLenses.length >= 2, `exercise ${scenario.id} does not compare at least two offered theory lenses`);
    assert.match(scenario.history, /; /, `exercise ${scenario.id} does not join a historical mode to an environmental adaptation`);

    if (scenario.precipitation === "rain") assert.equal(scenario.climate, "ocean");
    if (scenario.precipitation === "snow") assert.notEqual(scenario.climate, "ocean");
    if (scenario.precipitation !== "none") assert.ok(["broken", "overcast"].includes(scenario.clouds));
    assert.equal(new Set(scenario.required).size, scenario.required.length);
    assert.equal(new Set(scenario.recommended).size, scenario.recommended.length);
    assert.ok(scenario.required.includes("reconnaissance"));
    assert.ok(scenario.recommended.every((area) => !scenario.required.includes(area)));
  }
});
