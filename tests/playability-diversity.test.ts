import assert from "node:assert/strict";
import test from "node:test";
import { AIRCRAFT, PLATFORMS } from "../app/catalog";
import { evaluateForceAdaptation, type ForceAdaptation } from "../app/forceAdaptation";
import {
  ARMAMENTS,
  calculateMissionCreditedForcePoints,
  emptyCounts,
  evaluateArmamentFit,
  evaluateAviationFit,
  generateScenario,
  type Difficulty,
  type Scenario,
  type Warfare,
} from "../app/gameModel";
import {
  createInitialRigidState,
  resolveRigidTurn,
  type RigidGameState,
  type RigidOrders,
  type RigidReadiness,
  type RigidScenario,
} from "../app/kriegsspiel";

type OperatingProfile = ForceAdaptation["profile"];
type CountSelection = Record<string, number>;
type BuildSpec = {
  name: string;
  fleet: CountSelection;
  aircraft?: CountSelection;
};

type EvaluatedBuild = {
  spec: BuildSpec;
  hardValid: boolean;
  readiness: RigidReadiness;
  adaptation: ForceAdaptation;
  pointTotal: number;
  aviationDeficit: number;
  armamentDeficit: number;
  final: RigidGameState;
};

const REFERENCE_PACKS = [
  "vessel-passive-surface-tracking-pack",
  "vessel-close-defense-effect-pack",
  "shipborne-asw-pack",
  "surface-land-effect-pack",
  "airborne-mine-sensing-pack",
  "airborne-decoy-pack",
] as const;

const PROFILE_BUILDS: Record<OperatingProfile, readonly [BuildSpec, BuildSpec, BuildSpec]> = {
  "mine-lane": [
    {
      name: "escort-led remote lane group",
      fleet: {
        "multirole-frigate": 2,
        "area-defense-destroyer": 2,
        "autonomous-mine-support-ship": 3,
        "undersea-systems-tender": 1,
      },
      aircraft: {
        "rotary-surveillance-aircraft": 2,
        "uncrewed-surveillance-rotorcraft": 10,
      },
    },
    {
      name: "distributed corvette and tender lane group",
      fleet: {
        "multirole-frigate": 2,
        "stealth-littoral-corvette": 4,
        "autonomous-mine-support-ship": 2,
        "undersea-systems-tender": 2,
      },
      aircraft: {
        "mine-countermeasure-rotorcraft": 2,
        "uncrewed-surveillance-rotorcraft": 10,
      },
    },
    {
      name: "balanced escort and remote-lane group",
      fleet: {
        "multirole-frigate": 3,
        "area-defense-destroyer": 1,
        "autonomous-mine-support-ship": 2,
        "undersea-systems-tender": 2,
      },
      aircraft: {
        "mine-countermeasure-rotorcraft": 2,
        "uncrewed-surveillance-rotorcraft": 10,
      },
    },
  ],
  "heavy-weather": [
    {
      name: "escort-heavy endurance group",
      fleet: { "multirole-frigate": 6, "area-defense-destroyer": 2 },
      aircraft: {
        "maritime-mission-helicopter": 2,
        "uncrewed-surveillance-rotorcraft": 10,
      },
    },
    {
      name: "air-defence and undersea endurance group",
      fleet: {
        "multirole-frigate": 3,
        "area-defense-destroyer": 3,
        "long-endurance-submarine": 1,
      },
      aircraft: { "uncrewed-surveillance-rotorcraft": 10 },
    },
    {
      name: "submarine-backed dispersed endurance group",
      fleet: {
        "multirole-frigate": 5,
        "area-defense-destroyer": 1,
        "long-endurance-submarine": 2,
      },
      aircraft: { "uncrewed-surveillance-rotorcraft": 10 },
    },
  ],
  "restricted-water": [
    {
      name: "quiet distributed littoral group",
      fleet: {
        "multirole-frigate": 2,
        "stealth-littoral-corvette": 4,
        "air-independent-submarine": 2,
      },
      aircraft: { "uncrewed-surveillance-rotorcraft": 10 },
    },
    {
      name: "screen and remote-systems littoral group",
      fleet: {
        "area-defense-destroyer": 2,
        "stealth-littoral-corvette": 6,
        "undersea-systems-tender": 1,
        "air-independent-submarine": 1,
      },
      aircraft: {
        "rotary-surveillance-aircraft": 2,
        "uncrewed-surveillance-rotorcraft": 10,
      },
    },
    {
      name: "escort lattice littoral group",
      fleet: {
        "multirole-frigate": 2,
        "area-defense-destroyer": 2,
        "stealth-littoral-corvette": 4,
      },
      aircraft: {
        "maritime-mission-helicopter": 2,
        "uncrewed-surveillance-rotorcraft": 10,
      },
    },
  ],
  "open-water": [
    {
      name: "crewed long-range aviation group",
      fleet: {
        "multirole-frigate": 3,
        "area-defense-destroyer": 2,
        "fleet-aviation-ship": 1,
      },
      aircraft: {
        "fixed-wing-surveillance-aircraft": 2,
        "uncrewed-surveillance-rotorcraft": 10,
      },
    },
    {
      name: "uncrewed long-range aviation group",
      fleet: {
        "multirole-frigate": 4,
        "area-defense-destroyer": 1,
        "uncrewed-aviation-ship": 1,
      },
      aircraft: {
        "long-endurance-uncrewed-strike": 4,
        "uncrewed-surveillance-rotorcraft": 10,
      },
    },
    {
      name: "aviation and covert-ocean screen",
      fleet: {
        "fleet-aviation-ship": 1,
        "multirole-frigate": 1,
        "area-defense-destroyer": 2,
        "air-independent-submarine": 2,
      },
      aircraft: {
        "fixed-wing-surveillance-aircraft": 2,
        "uncrewed-surveillance-rotorcraft": 10,
      },
    },
  ],
};

function greatestDistance(value: string) {
  return Math.max(...(value.match(/\d+(?:\.\d+)?/g)?.map(Number) || [0]));
}

function selectedCounts<T extends { id: string }>(catalog: T[], requested: CountSelection = {}) {
  const counts = emptyCounts(catalog);
  for (const [id, count] of Object.entries(requested)) {
    assert.ok(id in counts, `test build references catalog entry ${id}`);
    counts[id] = count;
  }
  return counts;
}

function rigidScenario(scenario: Scenario, difficulty: Difficulty = "standard"): RigidScenario {
  return {
    id: scenario.id,
    difficulty,
    climate: scenario.climate,
    time: scenario.time,
    clouds: scenario.clouds,
    precipitation: scenario.precipitation,
    seaState: scenario.seaState,
    visibility: scenario.visibility,
    required: scenario.required,
    recommended: scenario.recommended,
    guardrail: scenario.guardrail,
    minimumEscort: scenario.minimumEscort,
    minimumAirDefense: scenario.minimumAirDefense,
    minimumAsw: scenario.minimumAsw,
    minimumUncrewed: scenario.minimumUncrewed,
    adversaryCount: scenario.adversaryCount,
    matrix: scenario.matrix,
  };
}

function commandSequence(scenario: Scenario): RigidOrders[] {
  const task = (index: number) => scenario.required[index % scenario.required.length];
  const sequence: RigidOrders[] = [
    { formation: "concentrated-screen", sensors: "cooperative-fusion", tempo: "hold", engagement: "shadow", task: "reconnaissance" },
    { formation: "concentrated-screen", sensors: "cooperative-fusion", tempo: "measured-advance", engagement: "contain", task: task(0) },
    { formation: "concentrated-screen", sensors: "passive-search", tempo: "measured-advance", engagement: "contain", task: task(1) },
    { formation: "concentrated-screen", sensors: "cooperative-fusion", tempo: "measured-advance", engagement: "bounded-effects", task: task(0) },
    { formation: "concentrated-screen", sensors: "passive-search", tempo: "measured-advance", engagement: "contain", task: task(2) },
    { formation: "concentrated-screen", sensors: "passive-search", tempo: "measured-advance", engagement: "contain", task: "reconnaissance" },
  ];
  const riskTreatments = ["prepare", "respond", "mitigate", "respond", "mitigate", "recover"] as const;
  const objective = scenario.matrix?.secondaryObjective;
  return sequence.map((orders, index): RigidOrders => {
    const riskAware: RigidOrders = { ...orders, riskTreatment: riskTreatments[index], coordination: index < 2 ? "federated" : "mutual-support" };
    if (!objective || index + 1 < objective.revealTurn) return riskAware;
    if (objective.method === "recovery-reserve") return { ...riskAware, riskTreatment: "mitigate", formation: "distributed-barrier", tempo: index + 1 === objective.revealTurn ? "hold" : riskAware.tempo };
    if (objective.method === "protective-escort") return { ...riskAware, formation: "protected-column", engagement: "contain", coordination: "mutual-support" };
    if (objective.method === "alternate-route") return { ...riskAware, formation: "distributed-barrier", tempo: "measured-advance", uncrewed: "distributed-scouting" };
    if (objective.method === "evidence-handoff") return { ...riskAware, sensors: "cooperative-fusion", engagement: "contain", coordination: "federated" };
    return { ...riskAware, riskTreatment: "recover", coordination: "mutual-support", tempo: index + 1 === objective.revealTurn ? "hold" : riskAware.tempo };
  });
}

function evaluateBuild(scenario: Scenario, spec: BuildSpec): EvaluatedBuild {
  const selectedWarfare = [...new Set([...scenario.required, ...scenario.recommended])];
  const fleet = selectedCounts(PLATFORMS, spec.fleet);
  const airWing = selectedCounts(AIRCRAFT, spec.aircraft);
  const selectedArmaments = emptyCounts(ARMAMENTS);
  for (const id of REFERENCE_PACKS) {
    const pack = ARMAMENTS.find((item) => item.id === id)!;
    if (pack.warfare.some((area) => selectedWarfare.includes(area))) selectedArmaments[id] = 1;
  }

  const aviationFit = evaluateAviationFit(PLATFORMS, AIRCRAFT, fleet, airWing);
  const armamentFit = evaluateArmamentFit(
    PLATFORMS,
    AIRCRAFT,
    ARMAMENTS,
    fleet,
    aviationFit.supportedByAircraft,
    selectedArmaments,
  );
  const pointCredit = calculateMissionCreditedForcePoints(
    PLATFORMS,
    AIRCRAFT,
    ARMAMENTS,
    fleet,
    aviationFit.supportedByAircraft,
    armamentFit.creditedByArmament,
    aviationFit.assignmentsByAircraft,
    armamentFit.assignmentsByArmament,
    selectedWarfare,
    true,
  );
  const creditedPlatforms = PLATFORMS.flatMap((platform) => (
    Array.from({ length: pointCredit.creditedPlatforms[platform.id] || 0 }, () => platform)
  ));
  const creditedAircraft = AIRCRAFT.filter((aircraft) => (pointCredit.creditedAircraft[aircraft.id] || 0) > 0);
  const creditedArmaments = ARMAMENTS.filter((pack) => (pointCredit.missionCreditedArmaments[pack.id] || 0) > 0);
  const coverage = new Set<Warfare>([
    ...creditedPlatforms.flatMap((platform) => platform.warfare.filter((area) => selectedWarfare.includes(area))),
    ...creditedAircraft.flatMap((aircraft) => aircraft.warfare.filter((area) => selectedWarfare.includes(area))),
    ...creditedArmaments.flatMap((pack) => pack.warfare.filter((area) => selectedWarfare.includes(area))),
  ]);
  const escorts = creditedPlatforms.filter((platform) => platform.screenUnit).length;
  const airDefense = creditedPlatforms.reduce((sum, platform) => sum + platform.airDefenseValue, 0);
  const undersea = creditedPlatforms.reduce((sum, platform) => sum + platform.aswValue, 0)
    + Math.floor((pointCredit.creditedAircraft["uncrewed-surveillance-rotorcraft"] || 0) / 4);
  const uncrewed = AIRCRAFT.filter((aircraft) => aircraft.kind.startsWith("uncrewed-"))
    .reduce((sum, aircraft) => sum + (pointCredit.creditedAircraft[aircraft.id] || 0), 0);
  const trackingMethods = new Set<string>();
  let trackCapacity = 0;
  for (const aircraft of creditedAircraft) {
    const count = pointCredit.creditedAircraft[aircraft.id] || 0;
    trackCapacity += aircraft.trackCapacity * count;
    aircraft.trackingMethods.forEach((method) => trackingMethods.add(method));
  }
  for (const pack of creditedArmaments) {
    const count = pointCredit.missionCreditedArmaments[pack.id] || 0;
    trackCapacity += pack.trackCapacity * count;
    pack.trackingMethods.forEach((method) => trackingMethods.add(method));
  }
  const maxReachNm = Math.max(
    25,
    ...creditedAircraft.map((aircraft) => greatestDistance(aircraft.missionReach)),
    ...creditedArmaments.map((pack) => greatestDistance(pack.reach)),
  );
  const hardValid = pointCredit.ready
    && scenario.required.every((area) => coverage.has(area))
    && selectedWarfare.every((area) => scenario.required.includes(area) || scenario.recommended.includes(area))
    && pointCredit.total > 0
    && pointCredit.total <= scenario.budget
    && aviationFit.deficit === 0
    && armamentFit.deficit === 0
    && aviationFit.totalAircraft > 0
    && armamentFit.totalSelected > 0
    && escorts >= scenario.minimumEscort
    && airDefense >= scenario.minimumAirDefense
    && undersea >= scenario.minimumAsw
    && uncrewed >= scenario.minimumUncrewed;
  const adaptation = evaluateForceAdaptation(
    scenario,
    PLATFORMS,
    AIRCRAFT,
    ARMAMENTS,
    pointCredit.creditedPlatforms,
    pointCredit.creditedAircraft,
    pointCredit.missionCreditedArmaments,
  );
  const readiness: RigidReadiness = {
    planningScore: hardValid ? 100 : 0,
    missionReady: hardValid,
    requiredCoverage: scenario.required.filter((area) => coverage.has(area)).length,
    requiredCount: scenario.required.length,
    forcePoints: pointCredit.total,
    escortValue: escorts,
    airDefenseValue: airDefense,
    underseaValue: undersea,
    uncrewedCount: uncrewed,
    supportedAircraftCount: aviationFit.supportedAircraft,
    compatibleArmamentCount: Object.values(pointCredit.missionCreditedArmaments).reduce((sum, count) => sum + count, 0),
    maxReachNm,
    trackCapacity,
    trackingMethods: [...trackingMethods],
    lowSignatureCount: creditedPlatforms.filter((platform) => platform.visualSignature === "low").length,
    selectedUnitCount: creditedPlatforms.length + aviationFit.supportedAircraft,
    adaptationScore: adaptation.score,
    adaptationLabel: adaptation.label,
    adaptationEvidence: adaptation.evidence,
    adaptationGaps: adaptation.gaps,
  };
  const rules = rigidScenario(scenario);
  const final = commandSequence(scenario).reduce(
    (state, orders) => resolveRigidTurn(state, orders, readiness, rules),
    createInitialRigidState(readiness, rules),
  );
  return {
    spec,
    hardValid,
    readiness,
    adaptation,
    pointTotal: pointCredit.total,
    aviationDeficit: aviationFit.deficit,
    armamentDeficit: armamentFit.deficit,
    final,
  };
}

function representativeScenarios() {
  let seed = 17;
  const random = () => {
    seed = (seed * 48271) % 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const scenarios = new Map<OperatingProfile, Scenario>();
  for (let index = 0; index < 80 && scenarios.size < 4; index += 1) {
    const scenario = generateScenario(index, random);
    const profile = evaluateForceAdaptation(
      scenario,
      PLATFORMS,
      AIRCRAFT,
      ARMAMENTS,
      emptyCounts(PLATFORMS),
      emptyCounts(AIRCRAFT),
      emptyCounts(ARMAMENTS),
    ).profile;
    if (!scenarios.has(profile)) scenarios.set(profile, scenario);
  }
  assert.equal(scenarios.size, 4, "deterministic sample contains all four operating profiles");
  return scenarios;
}

function sampledScenarios(count: number) {
  let seed = 29;
  const random = () => {
    seed = (seed * 48271) % 0x7fffffff;
    return seed / 0x7fffffff;
  };
  return Array.from({ length: count }, (_, index) => generateScenario(index + 200, random));
}

function assertLegalWinningBuild(build: EvaluatedBuild, profile: OperatingProfile) {
  assert.equal(build.adaptation.profile, profile, `${build.spec.name} is assessed against ${profile}`);
  assert.equal(build.hardValid, true, `${build.spec.name} meets catalog, hosting, coverage, and scenario minimums: ${JSON.stringify({
    points: build.pointTotal,
    aviationDeficit: build.aviationDeficit,
    armamentDeficit: build.armamentDeficit,
    readiness: build.readiness,
  })}`);
  assert.equal(build.aviationDeficit, 0, `${build.spec.name} hosts every aircraft`);
  assert.equal(build.armamentDeficit, 0, `${build.spec.name} hosts every mission pack`);
  assert.ok(build.pointTotal <= 100, `${build.spec.name} stays within the 100-point budget`);
  assert.ok(build.adaptation.score >= 65, `${build.spec.name} meets the Standard adaptation threshold`);
  assert.equal(
    build.final.outcome?.won,
    true,
    `${build.spec.name} has an adjudicated Standard win path: ${JSON.stringify({
      profile,
      points: build.pointTotal,
      adaptation: build.adaptation.score,
      score: build.final.outcome?.score,
      objective: build.final.objectiveProgress,
      integrity: build.final.integrity,
      supply: build.final.supply,
      escalation: build.final.escalation,
    })}`,
  );
}

function compositionDistance(left: BuildSpec, right: BuildSpec) {
  const ids = new Set([...Object.keys(left.fleet), ...Object.keys(right.fleet)]);
  return [...ids].reduce((sum, id) => sum + Math.abs((left.fleet[id] || 0) - (right.fleet[id] || 0)), 0);
}

test("each operating profile supports at least three materially different legal winning builds", () => {
  const scenarios = representativeScenarios();
  for (const [profile, specs] of Object.entries(PROFILE_BUILDS) as [OperatingProfile, readonly [BuildSpec, BuildSpec, BuildSpec]][]) {
    const scenario = scenarios.get(profile)!;
    const builds = specs.map((spec) => evaluateBuild(scenario, spec));
    builds.forEach((build) => assertLegalWinningBuild(build, profile));
    for (let left = 0; left < specs.length; left += 1) {
      for (let right = left + 1; right < specs.length; right += 1) {
        assert.ok(
          compositionDistance(specs[left], specs[right]) >= 4,
          `${profile} alternatives ${left + 1} and ${right + 1} have at least four units of aggregate platform-composition distance`,
        );
      }
    }
    assert.ok(
      new Set(specs.map((spec) => JSON.stringify(spec.aircraft || {}))).size >= 2,
      `${profile} alternatives include more than one aviation mix`,
    );
  }
});

test("every sampled generated problem retains three catalog-grounded winning force paths", () => {
  for (const scenario of sampledScenarios(48)) {
    const profile = evaluateForceAdaptation(
      scenario,
      PLATFORMS,
      AIRCRAFT,
      ARMAMENTS,
      emptyCounts(PLATFORMS),
      emptyCounts(AIRCRAFT),
      emptyCounts(ARMAMENTS),
    ).profile;
    PROFILE_BUILDS[profile]
      .map((spec) => evaluateBuild(scenario, spec))
      .forEach((build) => assertLegalWinningBuild(build, profile));
  }
});

test("a force suited to one operating profile fails adaptation in an opposing profile", () => {
  const scenarios = representativeScenarios();
  const openWaterSpec = PROFILE_BUILDS["open-water"][0];
  const restrictedWaterSpec = PROFILE_BUILDS["restricted-water"][0];
  const openAtHome = evaluateBuild(scenarios.get("open-water")!, openWaterSpec);
  const openInRestrictedWater = evaluateBuild(scenarios.get("restricted-water")!, openWaterSpec);
  const restrictedAtHome = evaluateBuild(scenarios.get("restricted-water")!, restrictedWaterSpec);
  const restrictedInOpenWater = evaluateBuild(scenarios.get("open-water")!, restrictedWaterSpec);

  assert.ok(openAtHome.adaptation.score >= 65, "long-range aviation group fits open water");
  assert.ok(openInRestrictedWater.adaptation.score < 65, "the same long-range group fails restricted-water adaptation");
  assert.ok(restrictedAtHome.adaptation.score >= 65, "distributed littoral group fits restricted water");
  assert.ok(restrictedInOpenWater.adaptation.score < 65, "the same littoral group fails open-water adaptation");
});

test("small sensible substitutions preserve viable winning paths", () => {
  const scenarios = representativeScenarios();
  const substitutions: Record<OperatingProfile, BuildSpec> = {
    "mine-lane": {
      ...PROFILE_BUILDS["mine-lane"][0],
      name: "mine-lane substitution: one support ship becomes a tender",
      fleet: {
        ...PROFILE_BUILDS["mine-lane"][0].fleet,
        "autonomous-mine-support-ship": 2,
        "undersea-systems-tender": 2,
      },
    },
    "heavy-weather": {
      ...PROFILE_BUILDS["heavy-weather"][0],
      name: "heavy-weather substitution: one escort becomes a long-endurance submarine",
      fleet: {
        ...PROFILE_BUILDS["heavy-weather"][0].fleet,
        "multirole-frigate": 5,
        "long-endurance-submarine": 1,
      },
    },
    "restricted-water": {
      ...PROFILE_BUILDS["restricted-water"][0],
      name: "restricted-water substitution: one corvette becomes a remote-systems ship",
      fleet: {
        ...PROFILE_BUILDS["restricted-water"][0].fleet,
        "stealth-littoral-corvette": 3,
        "autonomous-mine-support-ship": 1,
      },
    },
    "open-water": {
      ...PROFILE_BUILDS["open-water"][0],
      name: "open-water substitution: one destroyer becomes a multirole frigate",
      fleet: {
        ...PROFILE_BUILDS["open-water"][0].fleet,
        "multirole-frigate": 4,
        "area-defense-destroyer": 1,
      },
    },
  };

  for (const [profile, substitution] of Object.entries(substitutions) as [OperatingProfile, BuildSpec][]) {
    const original = PROFILE_BUILDS[profile][0];
    assert.equal(compositionDistance(original, substitution), 2, `${profile} substitution exchanges exactly one platform`);
    assertLegalWinningBuild(evaluateBuild(scenarios.get(profile)!, substitution), profile);
  }
});
