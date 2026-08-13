import assert from "node:assert/strict";
import test from "node:test";
import { AIRCRAFT, PLATFORMS } from "../app/catalog";
import {
  ARMAMENTS,
  calculateMissionCreditedForcePoints,
  emptyCounts,
  evaluateArmamentFit,
  evaluateAviationFit,
  evaluateWarfareIdentification,
  generateScenario,
  type Difficulty,
  type Scenario,
  type Warfare,
} from "../app/gameModel";
import {
  createInitialRigidState,
  resolveRigidTurn,
  type RigidOrders,
  type RigidReadiness,
  type RigidScenario,
} from "../app/kriegsspiel";
import { evaluateForceAdaptation } from "../app/forceAdaptation";

const REFERENCE_PACKS = [
  "vessel-passive-surface-tracking-pack",
  "vessel-close-defense-effect-pack",
  "shipborne-asw-pack",
  "surface-land-effect-pack",
  "airborne-mine-sensing-pack",
  "airborne-decoy-pack",
  "maritime-safeguarding-pack",
];

function greatestDistance(value: string) {
  return Math.max(...(value.match(/\d+(?:\.\d+)?/g)?.map(Number) || [0]));
}

function referencePlan(scenario: Scenario, tailored = true) {
  const selectedWarfare = [...new Set([...scenario.required, ...scenario.recommended])];
  const fleet = emptyCounts(PLATFORMS);
  const airWing = emptyCounts(AIRCRAFT);
  const empty = emptyCounts(PLATFORMS);
  const profile = evaluateForceAdaptation(scenario, PLATFORMS, AIRCRAFT, ARMAMENTS, empty, emptyCounts(AIRCRAFT), emptyCounts(ARMAMENTS)).profile;
  if (!tailored) {
    fleet["multirole-frigate"] = 3;
    fleet["stealth-littoral-corvette"] = 9;
  } else if (profile === "mine-lane") {
    fleet["multirole-frigate"] = 2;
    fleet["area-defense-destroyer"] = 2;
    fleet["autonomous-mine-support-ship"] = 3;
    fleet["undersea-systems-tender"] = 1;
  } else if (profile === "heavy-weather") {
    fleet["multirole-frigate"] = 6;
    fleet["area-defense-destroyer"] = 2;
    airWing["maritime-mission-helicopter"] = 2;
  } else if (profile === "restricted-water") {
    fleet["multirole-frigate"] = 2;
    fleet["stealth-littoral-corvette"] = 4;
    fleet["air-independent-submarine"] = 2;
  } else {
    fleet["multirole-frigate"] = 3;
    fleet["area-defense-destroyer"] = 2;
    fleet["fleet-aviation-ship"] = 1;
    airWing["fixed-wing-surveillance-aircraft"] = 2;
  }
  airWing["uncrewed-surveillance-rotorcraft"] = 10;
  const selectedArmaments = emptyCounts(ARMAMENTS);
  for (const id of REFERENCE_PACKS) {
    const pack = ARMAMENTS.find((item) => item.id === id)!;
    if (pack.warfare.some((area) => selectedWarfare.includes(area))) selectedArmaments[id] = 1;
  }

  const aviationFit = evaluateAviationFit(PLATFORMS, AIRCRAFT, fleet, airWing);
  const armamentFit = evaluateArmamentFit(PLATFORMS, AIRCRAFT, ARMAMENTS, fleet, aviationFit.supportedByAircraft, selectedArmaments);
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
  const creditedPlatforms = PLATFORMS.flatMap((platform) => Array.from({ length: pointCredit.creditedPlatforms[platform.id] || 0 }, () => platform));
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
  return { selectedWarfare, fleet, airWing, selectedArmaments, aviationFit, armamentFit, pointCredit, readiness, hardValid, adaptation };
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
    matrix: scenario.matrix,
  };
}

function commandSequence(scenario: Scenario, preserveFinal = false): RigidOrders[] {
  const task = (index: number) => scenario.required[index % scenario.required.length];
  if (scenario.required.includes("maritime-interdiction")) {
    return alignSecondaryObjective(scenario, [
      { formation: "distributed-barrier", sensors: "cooperative-fusion", tempo: "hold", engagement: "shadow", task: "reconnaissance" },
      { formation: "protected-column", sensors: "cooperative-fusion", tempo: "measured-advance", engagement: "contain", task: task(0) },
      { formation: "distributed-barrier", sensors: "passive-search", tempo: "measured-advance", engagement: "shadow", task: task(1) },
      { formation: "protected-column", sensors: "cooperative-fusion", tempo: "measured-advance", engagement: "contain", task: task(2) },
      { formation: "distributed-barrier", sensors: "passive-search", tempo: "measured-advance", engagement: "contain", task: task(0) },
      { formation: "protected-column", sensors: "cooperative-fusion", tempo: preserveFinal ? "withdraw" : "measured-advance", engagement: preserveFinal ? "avoid" : "contain", task: "reconnaissance" },
    ]);
  }
  return alignSecondaryObjective(scenario, [
    { formation: "concentrated-screen", sensors: "cooperative-fusion", tempo: "hold", engagement: "shadow", task: "reconnaissance" },
    { formation: "concentrated-screen", sensors: "cooperative-fusion", tempo: "measured-advance", engagement: "contain", task: task(0) },
    { formation: "concentrated-screen", sensors: "passive-search", tempo: "measured-advance", engagement: "contain", task: task(1) },
    { formation: "concentrated-screen", sensors: "cooperative-fusion", tempo: "measured-advance", engagement: "bounded-effects", task: task(0) },
    { formation: "concentrated-screen", sensors: "passive-search", tempo: "measured-advance", engagement: "contain", task: task(2) },
    preserveFinal
      ? { formation: "concentrated-screen", sensors: "emission-control", tempo: "withdraw", engagement: "avoid", task: "reconnaissance" }
      : { formation: "concentrated-screen", sensors: "passive-search", tempo: "measured-advance", engagement: "contain", task: "reconnaissance" },
  ]);
}

function alignSecondaryObjective(scenario: Scenario, sequence: RigidOrders[]) {
  const objective = scenario.matrix?.secondaryObjective;
  const riskTreatments = ["prepare", "respond", "mitigate", "respond", "mitigate", "recover"] as const;
  const riskAware = sequence.map((orders, index): RigidOrders => ({
    ...orders,
    riskTreatment: riskTreatments[index],
    coordination: index < 2 ? "federated" : "mutual-support",
  }));
  if (!objective) return riskAware;
  return riskAware.map((orders, index): RigidOrders => {
    if (index + 1 < objective.revealTurn) return orders;
    if (objective.method === "recovery-reserve") return { ...orders, riskTreatment: "mitigate", tempo: index + 1 === objective.revealTurn ? "hold" : orders.tempo, formation: "distributed-barrier" };
    if (objective.method === "protective-escort") return { ...orders, formation: "protected-column", engagement: "contain", coordination: "mutual-support" };
    if (objective.method === "alternate-route") return { ...orders, formation: "distributed-barrier", tempo: "measured-advance", uncrewed: "distributed-scouting" };
    if (objective.method === "evidence-handoff") return { ...orders, sensors: "cooperative-fusion", engagement: "contain", coordination: "federated" };
    return { ...orders, riskTreatment: "recover", tempo: index + 1 === objective.revealTurn ? "hold" : orders.tempo, coordination: "mutual-support" };
  });
}

test("generated problems are winnable through the actual catalog and compatibility rules", () => {
  let seed = 17;
  const random = () => {
    seed = (seed * 48271) % 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let index = 0; index < 80; index += 1) {
    const scenario = generateScenario(index, random);
    const plan = referencePlan(scenario);
    assert.equal(plan.hardValid, true, `exercise ${scenario.id} has a legal reference plan`);
    assert.ok(plan.pointCredit.total <= 100, `exercise ${scenario.id} remains within budget`);
    assert.equal(plan.aviationFit.deficit, 0);
    assert.equal(plan.armamentFit.deficit, 0);
    assert.ok(plan.adaptation.score >= 65, `exercise ${scenario.id} tailored force fits ${plan.adaptation.profile}`);
    const rules = rigidScenario(scenario);
    const final = commandSequence(scenario).reduce(
      (state, orders) => resolveRigidTurn(state, orders, plan.readiness, rules),
      createInitialRigidState(plan.readiness, rules),
    );
    assert.equal(final.outcome?.won, true, `exercise ${scenario.id} ${plan.adaptation.profile} reference wins: ${JSON.stringify({ adaptation: plan.adaptation.score, score: final.outcome?.score, objective: final.objectiveProgress, integrity: final.integrity, supply: final.supply, escalation: final.escalation, findings: final.outcome?.findings.map((finding) => finding.code) })}`);
  }
});

test("one generic force no longer dominates every operating profile", () => {
  let seed = 17;
  const random = () => {
    seed = (seed * 48271) % 0x7fffffff;
    return seed / 0x7fffffff;
  };
  let genericWins = 0;
  const profiles = new Set<string>();
  for (let index = 0; index < 80; index += 1) {
    const scenario = generateScenario(index, random);
    const plan = referencePlan(scenario, false);
    profiles.add(plan.adaptation.profile);
    const rules = rigidScenario(scenario);
    const final = commandSequence(scenario).reduce(
      (state, orders) => resolveRigidTurn(state, orders, plan.readiness, rules),
      createInitialRigidState(plan.readiness, rules),
    );
    if (final.outcome?.won) genericWins += 1;
  }
  assert.ok(profiles.size >= 4, "the generator exercised all operating profiles");
  assert.ok(genericWins <= 40, `generic force won ${genericWins} of 80 scenarios; it should not dominate most profiles`);
});

test("tailored catalog forces remain winnable at every difficulty", () => {
  for (const difficulty of ["guided", "standard", "challenge"] as const) {
    for (let index = 0; index < 24; index += 1) {
      const scenario = generateScenario(index, () => ((index * 37 + 19) % 101) / 101);
      const plan = referencePlan(scenario);
      const rules = rigidScenario(scenario, difficulty);
      const base = commandSequence(scenario, difficulty === "challenge");
      const candidates = [
        base,
        base.map((orders, turn) => ({ ...orders, riskTreatment: (["prepare", "respond", "recover", "mitigate", "recover", "mitigate"] as const)[turn], coordination: "mutual-support" as const })),
        base.map((orders, turn) => ({ ...orders, riskTreatment: turn < 2 ? "prepare" as const : "mitigate" as const, coordination: "federated" as const })),
        base.map((orders, turn) => ({ ...orders, formation: turn % 2 ? "protected-column" as const : "concentrated-screen" as const, riskTreatment: turn === 3 || turn === 4 ? "recover" as const : "respond" as const, coordination: "mutual-support" as const })),
      ];
      const finals = candidates.map((sequence) => sequence.reduce(
        (state, orders) => resolveRigidTurn(state, orders, plan.readiness, rules),
        createInitialRigidState(plan.readiness, rules),
      ));
      const correctEnough = finals.filter((candidate) => (candidate.outcome?.score ?? 0) >= (difficulty === "guided" ? 52 : difficulty === "standard" ? 58 : 64) && candidate.objectiveProgress >= 60);
      assert.ok(correctEnough.length >= 3, `${difficulty} exercise ${scenario.id} retains at least three credible command families inside the modeled success neighborhood; got ${correctEnough.length}`);
      const final = finals.find((candidate) => candidate.outcome?.won) ?? finals.sort((a, b) => (b.outcome?.score ?? 0) - (a.outcome?.score ?? 0))[0];
      assert.equal(final.outcome?.won, true, `${difficulty} exercise ${scenario.id} ${plan.adaptation.profile} has a catalog-backed win path among four materially different command families: ${JSON.stringify({ points: plan.pointCredit.total, score: final.outcome?.score, objective: final.objectiveProgress, secondary: final.secondaryObjectiveProgress, integrity: final.integrity, supply: final.supply, escalation: final.escalation, findings: final.outcome?.findings.map((finding) => finding.code) })}`);
    }
  }
});

test("an unhosted, uncovered catalog build cannot share the reference win path", () => {
  const scenario = generateScenario(0, () => 0.31);
  const plan = referencePlan(scenario);
  const weakReadiness: RigidReadiness = {
    ...plan.readiness,
    planningScore: 20,
    missionReady: false,
    requiredCoverage: 0,
    escortValue: 0,
    airDefenseValue: 0,
    underseaValue: 0,
    uncrewedCount: 0,
    supportedAircraftCount: 0,
    compatibleArmamentCount: 0,
    maxReachNm: 25,
    trackCapacity: 0,
    trackingMethods: [],
    selectedUnitCount: 1,
  };
  const rules = rigidScenario(scenario);
  const final = commandSequence(scenario).reduce(
    (state, orders) => resolveRigidTurn(state, orders, weakReadiness, rules),
    createInitialRigidState(weakReadiness, rules),
  );
  assert.equal(final.outcome?.won, false);
  assert.ok(final.objectiveProgress < 70);
});

test("selecting every area cannot pass the same classification path as a correct answer", () => {
  const scenario = generateScenario(0, () => 0.31);
  const allAreas: Warfare[] = ["air-defense", "surface-operations", "undersea-operations", "land-attack", "electromagnetic-operations", "reconnaissance", "mine-countermeasures", "missile-defense", "maritime-interdiction"];
  const correct = evaluateWarfareIdentification(scenario.required, scenario.recommended, [...scenario.required]);
  const selectAll = evaluateWarfareIdentification(scenario.required, scenario.recommended, allAreas);
  assert.deepEqual(correct.missed, []);
  assert.deepEqual(correct.unsupported, []);
  assert.ok(selectAll.unsupported.length > 0);
});
