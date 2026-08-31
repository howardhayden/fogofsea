import assert from "node:assert/strict";
import test from "node:test";
import { ACADEMY_MODULES, THINKER_COMPARISON } from "../app/academyData";
import { PLATFORMS, AIRCRAFT } from "../app/catalog";
import { ARMAMENTS, generateScenario, validateScenarioCoexistence, type Scenario } from "../app/gameModel";
import { evaluateForceAdaptation } from "../app/forceAdaptation";
import { deriveOperationalStrategy } from "../app/operationalStrategy";

function generatedSample(count = 240) {
  let state = 37;
  const random = () => {
    state = (state * 48271) % 0x7fffffff;
    return state / 0x7fffffff;
  };
  return Array.from({ length: count }, (_, index) => generateScenario(index, random));
}

function scenarioFamily(key: string, sample = generatedSample()): Scenario {
  const scenario = sample.find((item) => validateScenarioCoexistence(item).derived.missionFamily === key);
  assert.ok(scenario, `sample contains the ${key} compositional mission family`);
  return scenario;
}

test("coastal and anti-trafficking mission families are distinct, protection-centered, and regularly generated", () => {
  const sample = generatedSample();
  const coastal = scenarioFamily("coastal-safeguarding", sample);
  const safeguarding = scenarioFamily("anti-trafficking-safeguarding", sample);
  assert.ok(coastal.required.includes("maritime-interdiction"));
  assert.ok(safeguarding.required.includes("maritime-interdiction"));
  assert.match(`${coastal.brief} ${coastal.objective} ${coastal.constraints}`, /coastal|estuary|port|shallow|littoral/i);
  assert.match(`${safeguarding.brief} ${safeguarding.objective} ${safeguarding.constraints}`, /traffick|exploitation|safeguard|victim|survivor/i);
  assert.match(safeguarding.constraints, /do not profile|rescue|privacy|corrobor/i);
  assert.match(safeguarding.successConditions, /evidence|civil|network|protected care|due process/i);
  assert.notEqual(coastal.brief, safeguarding.brief);

  const safeguardingCount = sample.filter((item) => item.required.includes("maritime-interdiction")).length;
  assert.ok(safeguardingCount >= 30 && safeguardingCount <= 70, `compositional synthesis produced ${safeguardingCount} safeguarding scenarios in 240 accepted candidates`);
});

test("the actual catalog supports lawful interception, rescue, evidence custody, and protected handoff", () => {
  const pack = ARMAMENTS.find((item) => item.id === "maritime-safeguarding-pack");
  assert.ok(pack);
  assert.ok(pack.warfare.includes("maritime-interdiction"));
  assert.match(`${pack.role} ${pack.name}`, /non-lethal|safeguard|evidence|rescue|handoff/i);
  assert.ok(pack.hostIds.length >= 5);
  for (const hostId of pack.hostIds) {
    const host = [...PLATFORMS, ...AIRCRAFT].find((item) => item.id === hostId);
    assert.ok(host, `${hostId} exists in a force catalog`);
    assert.ok(host.armamentIds.includes(pack.id), `${hostId} explicitly carries the safeguarding pack`);
  }
});

test("littoral doctrine changes force adaptation and command recommendations", () => {
  const coastal = scenarioFamily("coastal-safeguarding");
  const emptyPlatforms = Object.fromEntries(PLATFORMS.map((item) => [item.id, 0]));
  const emptyAircraft = Object.fromEntries(AIRCRAFT.map((item) => [item.id, 0]));
  const emptyPacks = Object.fromEntries(ARMAMENTS.map((item) => [item.id, 0]));
  const sparse = evaluateForceAdaptation(coastal, PLATFORMS, AIRCRAFT, ARMAMENTS, emptyPlatforms, emptyAircraft, emptyPacks);
  assert.ok(sparse.gaps.some((gap) => /safeguarding|littoral|coastal|shallow/i.test(gap)));

  const strategy = deriveOperationalStrategy(coastal);
  assert.equal(strategy.friendlyMethod, "commerce-pressure");
  assert.equal(strategy.recommendedUncrewed, "autonomous-lane-control");
  assert.ok(strategy.environmentEffects.some((effect) => /coastal clutter|civil traffic|evidence custody|handoff/i.test(effect)));
});

test("Academy connects coastal strategy, maritime security, trafficking networks, drones, and human protection", () => {
  const module = ACADEMY_MODULES.find((item) => item.id === "littoral-safeguarding");
  assert.ok(module);
  const corpus = [module.title, module.subtitle, module.thesis, ...module.lesson, module.misreading, module.application, module.discussion, ...module.readings].join(" ");
  for (const term of ["Corbett", "Aube", "Till", "Bueger", "trafficking", "Drones", "privacy", "rescue", "evidence", "corroboration", "network displacement"]) {
    assert.match(corpus, new RegExp(term, "i"), `Academy includes ${term}`);
  }
  assert.ok(THINKER_COMPARISON.some((item) => item.thinker === "Christian Bueger"));
  assert.ok(THINKER_COMPARISON.some((item) => item.thinker === "Louise Shelley"));
  assert.match(
    module.quiz.options[module.quiz.correct],
    /corroborate observations.*protect people and evidence.*lawful handoff.*monitor displacement/i,
  );
});
