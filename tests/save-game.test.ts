import assert from "node:assert/strict";
import test from "node:test";
import { getCelestialState } from "../app/celestial";
import {
  ARMAMENTS,
  aircraftAffiliations,
  calculateCreditedForcePoints,
  calculateDecisionCompletion,
  calculateMissionCreditedForcePoints,
  deriveScenarioEnvironment,
  evaluateArmamentFit,
  evaluateAviationFit,
  generateScenario,
  hasSelectedAffiliation,
  platformAffiliations,
  restrictCountsToWarfare,
  type Aircraft,
  type Platform,
} from "../app/gameModel";
import { formatPortableSave, minimizePortableSaveForBrowser, parsePortableSave, type PortableSave, type SavedResult } from "../app/saveGame";
import { createInitialRigidState, resolveRigidTurn, type RigidOrders, type RigidReadiness, type RigidScenario } from "../app/kriegsspiel";
import { deriveForceReadiness } from "../app/forceReadiness";
import { estimateResolutionMatrix, isScenarioMatrix } from "../app/scenarioMatrix";
import { createStarPlacements, getSkyVisibility, getSubsurfaceLifeProfile, headingToCompass, nextViewLayer, stableSeed, VIEW_CONFIG, viewTelemetryFromDirection } from "../app/viewModel";

const sampleEnvironment = deriveScenarioEnvironment({ id: 4, region: "Test Sector", climate: "ocean" });

function deterministicScenario(previousId: number) {
  let state = (previousId * 2654435761) >>> 0;
  return generateScenario(previousId, () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  });
}

const sample: PortableSave = {
  format: "fog-of-sea-save",
  version: 3,
  savedAt: "2026-08-04T12:00:00.000Z",
  game: {
    scenario: {
      id: 4,
      operation: "TEST MERIDIAN",
      region: "Test Sector",
      climate: "ocean",
      time: "dawn",
      clouds: "overcast",
      precipitation: "rain",
      seaState: 6,
      visibility: 3,
      ...sampleEnvironment,
      budget: 100,
      brief: "Test brief",
      geography: "A narrow strait constrains manoeuvre.",
      friendlySituation: "A convoy requires escort.",
      opposingSituation: "Ambiguous contacts contest the route.",
      civilianContext: "Neutral traffic remains in the corridor.",
      objective: "Test objective",
      intelligence: "Test intelligence",
      constraints: "Preserve identification confidence.",
      timing: "The transit begins in ninety minutes.",
      successConditions: "The convoy exits intact without escalation.",
      navalProblem: "Combine limited control with geographic access.",
      history: "Historical analogy",
      required: ["air-defense"],
      recommended: ["reconnaissance"],
      minimumEscort: 2,
      minimumAirDefense: 1,
      minimumAsw: 1,
      minimumUncrewed: 2,
      politicalAim: "Preserve access.",
      endState: "access",
      lenses: ["corbett", "wegener"],
      guardrail: "escalation",
    },
    fleet: { "fleet-aviation-ship": 1, "multirole-frigate": 2 },
    airWing: { "deck-multirole-aircraft": 12, "fixed-wing-surveillance-aircraft": 2, "uncrewed-surveillance-rotorcraft": 4 },
    selectedArmaments: { "air-to-air-mission-pack": 8, "airborne-acoustic-pack": 4 },
    selectedWarfare: ["air-defense", "reconnaissance"],
    selectedEndState: "access",
    selectedLens: "corbett",
    selectedPartnerLens: "wegener",
    selectedGuardrail: "escalation",
    theorySynthesis: "Corbett defines the limited control required for passage while Wegener tests whether position and access make that control possible; the plan sequences both without seeking general command.",
    rationale: "Secure only the degree of control required for passage.",
    assumptions: "The opposing force values avoiding escalation.",
    termination: "Commercial passage is restored and can persist.",
    result: null,
    rigidState: null,
    rigidOrders: null,
    history: [{
      id: "4-1",
      at: "2026-08-04T12:00:00.000Z",
      exercise: 4,
      operation: "TEST MERIDIAN",
      region: "Test Sector",
      context: {
        brief: "Test brief",
        objective: "Test objective",
        politicalAim: "Preserve access.",
        intelligence: "Test intelligence",
        historicalMode: "Historical analogy",
        geography: "A narrow strait constrains manoeuvre.",
        friendlySituation: "A convoy requires escort.",
        opposingSituation: "Ambiguous contacts contest the route.",
        civilianContext: "Neutral traffic remains in the corridor.",
        constraints: "Preserve identification confidence.",
        timing: "The transit begins in ninety minutes.",
        successConditions: "The convoy exits intact without escalation.",
        navalProblem: "Combine limited control with geographic access.",
        climate: "ocean",
        time: "dawn",
        clouds: "overcast",
        precipitation: "rain",
        seaState: 6,
        visibility: 3,
        ...sampleEnvironment,
        budget: 100,
      },
      score: 92,
      outcome: "DECISIVE VICTORY",
      warfare: ["air-defense", "reconnaissance"],
      endState: "access",
      theoryLens: "corbett",
      partnerLens: "wegener",
      theorySynthesis: "Corbett defines the limited control required for passage while Wegener tests whether position and access make that control possible; the plan sequences both without seeking general command.",
      guardrail: "escalation",
      rationale: "Secure only the degree of control required for passage.",
      assumptions: "The opposing force values avoiding escalation.",
      termination: "Commercial passage is restored and can persist.",
      fleet: { "fleet-aviation-ship": 1, "multirole-frigate": 2 },
      airWing: { "deck-multirole-aircraft": 12, "fixed-wing-surveillance-aircraft": 2, "uncrewed-surveillance-rotorcraft": 4 },
      selectedArmaments: { "air-to-air-mission-pack": 8, "airborne-acoustic-pack": 4 },
      notes: ["The plan remains coherent."],
    }],
  },
  preferences: { theme: "dark", difficulty: "standard", planningStage: "force", guidance: { checklistCollapsed: false } },
  academyProgress: ["strategy-grammar"],
};

function savedRules(save: PortableSave): RigidScenario {
  return {
    ...save.game.scenario,
    difficulty: save.preferences.difficulty,
    selectedLens: save.game.selectedLens || undefined,
  };
}

function savedReadiness(save: PortableSave) {
  return deriveForceReadiness({
    scenario: save.game.scenario,
    difficulty: save.preferences.difficulty,
    fleet: save.game.fleet,
    airWing: save.game.airWing,
    selectedArmaments: save.game.selectedArmaments || {},
    selectedWarfare: save.game.selectedWarfare,
    selectedEndState: save.game.selectedEndState,
    selectedLens: save.game.selectedLens,
    selectedPartnerLens: save.game.selectedPartnerLens || "",
    selectedGuardrail: save.game.selectedGuardrail,
  }).rigidReadiness;
}

function completedSave(save: PortableSave) {
  const completed = structuredClone(save);
  const readiness = savedReadiness(completed);
  const rules = savedRules(completed);
  const orders: RigidOrders = {
    formation: "concentrated-screen",
    sensors: "cooperative-fusion",
    tempo: "measured-advance",
    engagement: "contain",
    task: rules.required[0],
  };
  let state = createInitialRigidState(readiness, rules);
  while (state.phase === "active") state = resolveRigidTurn(state, orders, readiness, rules);
  completed.game.rigidState = state;
  completed.game.rigidOrders = orders;
  completed.game.result = state.outcome;
  return completed;
}

test("browser-minimized saves omit free-form analysis without mutating the export", () => {
  const minimized = minimizePortableSaveForBrowser(sample);
  assert.equal(minimized.game.theorySynthesis, "");
  assert.equal(minimized.game.rationale, "");
  assert.equal(minimized.game.assumptions, "");
  assert.equal(minimized.game.termination, "");
  assert.equal(minimized.game.history[0].theorySynthesis, "");
  assert.equal(minimized.game.history[0].rationale, "");
  assert.match(sample.game.rationale, /Secure only/);
  assert.match(sample.game.history[0].assumptions, /avoiding escalation/);
});

test("portable TXT is readable and round-trips", () => {
  const text = formatPortableSave(sample);
  assert.match(text, /CURRENT COMMANDER'S LOGIC/);
  assert.match(text, /Secure only the degree of control/);
  assert.match(text, /Political aim: Preserve access/);
  assert.match(text, /Budget: 100 points/);
  assert.match(text, /Difficulty: standard/);
  assert.match(text, /sound profile island-arc/);
  assert.match(text, /2032-11-10/);
  assert.match(text, /Geography and chokepoints: A narrow strait/);
  assert.match(text, /CURRENT OPTIONAL NAVAL-THEORY SYNTHESIS — NEVER SCORED/);
  assert.match(text, /CURRENT RIGID UMPIRE STATE/);
  assert.match(text, /Complement or challenge: Wegener/);
  assert.match(text, /CURRENT SELECTED NOTIONAL ARMAMENT PACKS/);
  assert.match(text, /Air-to-air mission pack/);
  assert.match(text, /BEGIN FOG OF SEA MACHINE DATA/);
  assert.deepEqual(parsePortableSave(text), sample);

  const legacy = text
    .replaceAll("FOG OF SEA", "FOG OF THE SEA")
    .replace('"format": "fog-of-sea-save"', '"format": "fog-of-the-sea-save"');
  assert.deepEqual(parsePortableSave(legacy), sample);
});

test("portable TXT framing cannot be redirected by marker-shaped user prose", () => {
  const markerProse = structuredClone(sample);
  markerProse.game.rationale = [
    "Keep these literal study notes intact:",
    "--- BEGIN FOG OF SEA MACHINE DATA ---",
    "not machine data",
    "--- END FOG OF SEA MACHINE DATA ---",
  ].join("\n");
  markerProse.game.assumptions = "A quoted --- BEGIN FOG OF THE SEA MACHINE DATA --- marker is also plain text.";
  assert.deepEqual(parsePortableSave(formatPortableSave(markerProse)), markerProse);
  assert.deepEqual(parsePortableSave(JSON.stringify(markerProse)), markerProse);
});

test("portable saves preserve an explicit strategy or force interface stage", () => {
  for (const planningStage of ["strategy", "force"] as const) {
    const staged = structuredClone(sample);
    staged.preferences.planningStage = planningStage;
    assert.equal(parsePortableSave(formatPortableSave(staged)).preferences.planningStage, planningStage);
  }
});

test("older saves infer force only from warfare plus every completed strategic choice", () => {
  const completeLegacy = structuredClone(sample) as unknown as { preferences: Record<string, unknown>; game: PortableSave["game"] };
  delete completeLegacy.preferences.planningStage;
  assert.equal(parsePortableSave(JSON.stringify(completeLegacy)).preferences.planningStage, "force");

  const noWarfare = structuredClone(completeLegacy);
  noWarfare.game.selectedWarfare = [];
  assert.equal(parsePortableSave(JSON.stringify(noWarfare)).preferences.planningStage, "strategy");

  const incomplete = structuredClone(completeLegacy);
  incomplete.game.selectedPartnerLens = "";
  assert.equal(parsePortableSave(JSON.stringify(incomplete)).preferences.planningStage, "strategy");
});

test("mid-game rigid state round-trips and resumes identically", () => {
  const midgame = structuredClone(sample);
  const gameScenario = savedRules(midgame);
  const readiness = savedReadiness(midgame);
  const orders: RigidOrders = { formation: "concentrated-screen", sensors: "cooperative-fusion", tempo: "measured-advance", engagement: "contain", task: "air-defense" };
  const turnOne = resolveRigidTurn(createInitialRigidState(readiness, gameScenario), orders, readiness, gameScenario);
  midgame.game.rigidState = turnOne;
  midgame.game.rigidOrders = orders;
  const restored = parsePortableSave(formatPortableSave(midgame));
  assert.deepEqual(restored, midgame);
  assert.deepEqual(
    resolveRigidTurn(restored.game.rigidState!, restored.game.rigidOrders!, readiness, gameScenario),
    resolveRigidTurn(turnOne, orders, readiness, gameScenario),
  );

  const corrupted = structuredClone(midgame);
  corrupted.game.rigidState = { ...turnOne, contactQuality: 101 };
  assert.throws(() => parsePortableSave(JSON.stringify(corrupted)), /Rigid umpire state is invalid/);
});

test("completed v2 rigid state migrates its legacy outcome before validation", () => {
  const gameScenario: RigidScenario = {
    id: 4, climate: "ocean", time: "dawn", clouds: "overcast", precipitation: "rain", seaState: 6, visibility: 3,
    required: ["air-defense"], recommended: ["reconnaissance"], guardrail: "escalation",
    minimumEscort: 2, minimumAirDefense: 1, minimumAsw: 1, minimumUncrewed: 2,
  };
  const readiness: RigidReadiness = {
    planningScore: 90, missionReady: true, requiredCoverage: 1, requiredCount: 1, forcePoints: 88,
    escortValue: 3, airDefenseValue: 2, underseaValue: 1, uncrewedCount: 4, supportedAircraftCount: 14,
    compatibleArmamentCount: 8, maxReachNm: 280, trackCapacity: 180, trackingMethods: ["active radar", "passive emitter", "cooperative network"],
    lowSignatureCount: 2, selectedUnitCount: 18,
  };
  const orders: RigidOrders = { formation: "concentrated-screen", sensors: "cooperative-fusion", tempo: "measured-advance", engagement: "contain", task: "air-defense" };
  let completed = createInitialRigidState(readiness, gameScenario);
  for (let turn = 0; turn < completed.maxTurns && completed.phase === "active"; turn += 1) {
    completed = resolveRigidTurn(completed, orders, readiness, gameScenario);
  }
  assert.equal(completed.phase, "complete");
  assert.ok(completed.outcome);
  const legacyOutcome = {
    won: completed.outcome.won,
    score: completed.outcome.score,
    title: completed.outcome.title,
    notes: completed.outcome.notes,
  };
  const completedV2 = structuredClone(sample);
  (completedV2 as { version: number }).version = 2;
  delete (completedV2.preferences as unknown as Record<string, unknown>).difficulty;
  delete (completedV2.preferences as unknown as Record<string, unknown>).guidance;
  for (const key of [
    "regionId", "hemisphere", "observerLatitude", "observerLongitude", "scenarioDate", "season",
    "storming", "lightningCapable", "windHeading", "windSpeed", "currentHeading", "currentSpeed",
    "waveHeading", "soundProfile",
  ]) {
    delete (completedV2.game.scenario as unknown as Record<string, unknown>)[key];
    delete (completedV2.game.history[0].context as unknown as Record<string, unknown>)[key];
  }
  completedV2.game.result = legacyOutcome as unknown as SavedResult;
  completedV2.game.rigidState = { ...completed, outcome: { ...legacyOutcome } } as unknown as typeof completedV2.game.rigidState;
  completedV2.game.rigidOrders = orders;

  const parsed = parsePortableSave(JSON.stringify(completedV2));
  assert.equal(parsed.game.rigidState?.phase, "complete");
  assert.equal(parsed.game.rigidState?.turn, completed.turn);
  assert.deepEqual(parsed.game.rigidState?.reports, completed.reports);
  assert.deepEqual(parsed.game.rigidState?.outcome, parsed.game.result);
  assert.equal(parsed.game.result?.difficulty, "standard");
  assert.equal(parsed.game.result?.breakdown.total, legacyOutcome.score);
  assert.deepEqual(parsed.game.result?.findings, []);
});

test("only supported aircraft and hosted armament packs receive force-point credit", () => {
  const platforms: Platform[] = [{
    id: "test-deck", name: "Test deck", short: "TEST DECK", role: "Test host", points: 20, crew: 100,
    aviationCapacity: 2, aviationKinds: ["rotary"], armamentSlots: 1, armamentIds: [], capabilities: ["hosts rotary aircraft"],
    screenUnit: false, airDefenseValue: 0, aswValue: 0, warfare: ["reconnaissance"], note: "Test only.",
  }];
  const aircraft: Aircraft[] = [{
    id: "heavy-utility-rotorcraft", name: "Test rotary", short: "TEST ROTARY", role: "Test aircraft", points: 2, aircrew: 1, supportCrew: 1,
    kind: "rotary", armamentSlots: 1, armamentIds: ["airborne-decoy-pack"], capabilities: ["tests compatibility"], warfare: ["reconnaissance"],
    missionReach: "100 invented nautical miles", trackCapacity: 2, trackingMethods: ["cooperative network"],
  }];
  const noDeckFit = evaluateAviationFit(platforms, aircraft, { "test-deck": 0 }, { "heavy-utility-rotorcraft": 3 });
  const noDeckArmaments = evaluateArmamentFit(platforms, aircraft, ARMAMENTS, { "test-deck": 0 }, noDeckFit.supportedByAircraft, { "airborne-decoy-pack": 3 });
  const unsupportedPoints = calculateCreditedForcePoints(platforms, aircraft, ARMAMENTS, { "test-deck": 0 }, noDeckFit.supportedByAircraft, noDeckArmaments.creditedByArmament);
  assert.equal(noDeckFit.supportedAircraft, 0);
  assert.equal(noDeckArmaments.totalCredited, 0);
  assert.equal(unsupportedPoints.total, 0);

  const hostedFit = evaluateAviationFit(platforms, aircraft, { "test-deck": 1 }, { "heavy-utility-rotorcraft": 3 });
  const hostedArmaments = evaluateArmamentFit(platforms, aircraft, ARMAMENTS, { "test-deck": 1 }, hostedFit.supportedByAircraft, { "airborne-decoy-pack": 3 });
  const hostedPoints = calculateCreditedForcePoints(platforms, aircraft, ARMAMENTS, { "test-deck": 1 }, hostedFit.supportedByAircraft, hostedArmaments.creditedByArmament);
  assert.equal(hostedFit.supportedAircraft, 2);
  assert.equal(hostedFit.deficit, 1);
  assert.equal(hostedArmaments.totalCredited, 2);
  assert.equal(hostedArmaments.deficit, 1);
  assert.equal(hostedPoints.platformPoints, 20);
  assert.equal(hostedPoints.airPoints, 4);
  assert.equal(hostedPoints.armamentPoints, 0.6);
  assert.equal(hostedPoints.total, 24.6);

  const missionPoints = (fit: typeof hostedFit, armamentFit: typeof hostedArmaments, selected: Parameters<typeof calculateMissionCreditedForcePoints>[8], objective: boolean) => calculateMissionCreditedForcePoints(platforms, aircraft, ARMAMENTS, { "test-deck": fit === noDeckFit ? 0 : 1 }, fit.supportedByAircraft, armamentFit.creditedByArmament, fit.assignmentsByAircraft, armamentFit.assignmentsByArmament, selected, objective);
  const neitherChosen = missionPoints(hostedFit, hostedArmaments, [], false);
  const objectiveOnly = missionPoints(hostedFit, hostedArmaments, [], true);
  const warfareOnly = missionPoints(hostedFit, hostedArmaments, ["reconnaissance"], false);
  const unrelated = missionPoints(hostedFit, hostedArmaments, ["air-defense"], true);
  const missionCredited = missionPoints(hostedFit, hostedArmaments, ["reconnaissance", "electromagnetic-operations"], true);
  const connectedEffectOnly = missionPoints(hostedFit, hostedArmaments, ["electromagnetic-operations"], true);
  const unsupportedMission = missionPoints(noDeckFit, noDeckArmaments, ["reconnaissance", "electromagnetic-operations"], true);
  assert.equal(neitherChosen.total, 0);
  assert.equal(objectiveOnly.total, 0);
  assert.equal(warfareOnly.total, 0);
  assert.equal(unrelated.total, 0);
  assert.equal(missionCredited.total, 24.6);
  assert.equal(connectedEffectOnly.total, 24.6);
  assert.equal(connectedEffectOnly.creditedPlatforms["test-deck"], 1);
  assert.equal(connectedEffectOnly.creditedAircraft["heavy-utility-rotorcraft"], 2);
  assert.equal(connectedEffectOnly.missionCreditedArmaments["airborne-decoy-pack"], 2);
  assert.equal(unsupportedMission.total, 0);

  const onePackFit = evaluateArmamentFit(platforms, aircraft, ARMAMENTS, { "test-deck": 1 }, hostedFit.supportedByAircraft, { "airborne-decoy-pack": 1 });
  const onePackMission = calculateMissionCreditedForcePoints(platforms, aircraft, ARMAMENTS, { "test-deck": 1 }, hostedFit.supportedByAircraft, onePackFit.creditedByArmament, hostedFit.assignmentsByAircraft, onePackFit.assignmentsByArmament, ["electromagnetic-operations"], true);
  assert.equal(onePackMission.creditedAircraft["heavy-utility-rotorcraft"], 1);
  assert.equal(onePackMission.creditedPlatforms["test-deck"], 1);
  assert.equal(onePackMission.total, 22.3);
});

test("warfare affiliations gate selection consistently through aircraft, packs, and their host decks", () => {
  const aircraft: Aircraft = {
    id: "deck-multirole-aircraft", name: "Test strike", short: "TEST STRIKE", role: "Configurable effect", points: 1,
    aircrew: 1, supportCrew: 1, kind: "catapult", armamentSlots: 1, armamentIds: [], capabilities: ["test"], warfare: ["reconnaissance"],
    missionReach: "200 invented nautical miles", trackCapacity: 4, trackingMethods: ["cooperative network"],
  };
  const platform: Platform = {
    id: "test-carrier", name: "Test carrier", short: "TEST CARRIER", role: "Aviation host", points: 10, crew: 20,
    aviationCapacity: 4, aviationKinds: ["catapult"], armamentSlots: 0, armamentIds: [], capabilities: ["hosts strike aircraft"],
    screenUnit: false, airDefenseValue: 0, aswValue: 0, warfare: ["reconnaissance"], note: "Test only.",
  };
  const airAreas = aircraftAffiliations(aircraft, ARMAMENTS);
  const platformAreas = platformAffiliations(platform, [aircraft], ARMAMENTS);
  assert.equal(hasSelectedAffiliation(airAreas, []), false);
  assert.equal(hasSelectedAffiliation(airAreas, ["land-attack"]), true);
  assert.equal(hasSelectedAffiliation(platformAreas, ["land-attack"]), true);
  assert.equal(hasSelectedAffiliation(airAreas, ["mine-countermeasures"]), false);
  assert.deepEqual(restrictCountsToWarfare([aircraft], { [aircraft.id]: 3 }, ["land-attack"], (item) => aircraftAffiliations(item, ARMAMENTS)), { [aircraft.id]: 3 });
  assert.deepEqual(restrictCountsToWarfare([aircraft], { [aircraft.id]: 3 }, ["mine-countermeasures"], (item) => aircraftAffiliations(item, ARMAMENTS)), { [aircraft.id]: 0 });
});

test("every unified armament pack carries fictional reach, tracking, hosts, and warfare affiliations", () => {
  assert.ok(ARMAMENTS.length >= 24);
  assert.equal(new Set(ARMAMENTS.map((item) => item.id)).size, ARMAMENTS.length);
  for (const armament of ARMAMENTS) {
    assert.ok(armament.hostIds.length > 0, armament.id);
    assert.ok(armament.warfare.length > 0, armament.id);
    assert.match(armament.reach, /invented nautical miles/i, armament.id);
    assert.ok(armament.trackCapacity > 0, armament.id);
    assert.ok(armament.trackingMethods.length > 0, armament.id);
  }
  assert.ok(ARMAMENTS.some((item) => item.hostIds.includes("long-endurance-submarine")));
  assert.ok(ARMAMENTS.some((item) => item.hostIds.includes("area-defense-destroyer")));
  assert.ok(ARMAMENTS.some((item) => item.hostIds.includes("deck-long-range-strike-aircraft")));
});

test("new decisions begin at zero and generated facets stay coherent within a 100-point game", () => {
  assert.equal(calculateDecisionCompletion({ selectedWarfare: [], selectedEndState: "", selectedLens: "", selectedPartnerLens: "", selectedGuardrail: "" }), 0);
  assert.equal(calculateDecisionCompletion({
    selectedWarfare: ["reconnaissance"], selectedEndState: "access", selectedLens: "corbett", selectedPartnerLens: "wegener",
    selectedGuardrail: "escalation",
  }), 100);
  assert.equal(calculateDecisionCompletion({
    selectedWarfare: ["reconnaissance"], selectedEndState: "access", selectedLens: "corbett", selectedPartnerLens: "wegener",
    selectedGuardrail: "escalation",
  }), 100);
  assert.equal(calculateDecisionCompletion({
    selectedWarfare: [], selectedEndState: "", selectedLens: "", selectedPartnerLens: "",
    selectedGuardrail: "",
  }), 0);

  let state = 19;
  const random = () => {
    state = (state * 48271) % 0x7fffffff;
    return state / 0x7fffffff;
  };
  const scenarios = Array.from({ length: 80 }, (_, index) => generateScenario(index, random));
  assert.ok(new Set(scenarios.map((scenario) => scenario.operation)).size > 10);
  assert.ok(new Set(scenarios.map((scenario) => scenario.region)).size > 4);
  assert.ok(new Set(scenarios.map((scenario) => scenario.required.join("|"))).size > 5);
  for (const scenario of scenarios) {
    assert.equal(scenario.budget, 100);
    assert.equal(new Set(scenario.required).size, scenario.required.length);
    assert.ok(scenario.required.includes("reconnaissance"));
    if (scenario.precipitation === "rain") assert.equal(scenario.climate, "ocean");
    if (scenario.precipitation === "snow") assert.notEqual(scenario.climate, "ocean");
    if (scenario.precipitation !== "none") assert.ok(["broken", "overcast"].includes(scenario.clouds));
    if (/patrol submarines/i.test(scenario.opposingSituation)) assert.ok(scenario.required.includes("undersea-operations"));
    if (/long-range guided raids/i.test(scenario.opposingSituation)) assert.ok(scenario.required.includes("missile-defense"));
    if (/influence mines/i.test(scenario.opposingSituation)) assert.ok(scenario.required.includes("mine-countermeasures"));
  }
});

test("invalid imported environments are rejected", () => {
  const invalid = structuredClone(sample);
  (invalid.game.scenario as Record<string, unknown>).climate = "desert";
  assert.throws(() => parsePortableSave(JSON.stringify(invalid)), /scenario is missing or invalid/i);
});

test("v3 rejects invalid environmental ranges and cross-field combinations", () => {
  const corrupt = (change: (scenario: Record<string, unknown>) => void) => {
    const invalid = structuredClone(sample);
    change(invalid.game.scenario as unknown as Record<string, unknown>);
    assert.throws(() => parsePortableSave(JSON.stringify(invalid)), /scenario is missing or invalid/i);
  };

  corrupt((scenario) => { scenario.waveHeading = (Number(scenario.waveHeading) + 1) % 360; });
  corrupt((scenario) => { scenario.windHeading = 360; });
  corrupt((scenario) => { scenario.currentSpeed = 1.234; });
  corrupt((scenario) => { scenario.currentSpeed = 4.9; });
  corrupt((scenario) => { scenario.observerLatitude = -24; });
  corrupt((scenario) => { scenario.scenarioDate = "2032-08-10"; });
  corrupt((scenario) => { scenario.precipitation = "none"; });
  corrupt((scenario) => { scenario.clouds = "broken"; });
  corrupt((scenario) => { scenario.lightningCapable = true; });
  corrupt((scenario) => { scenario.storming = false; });
  corrupt((scenario) => { scenario.budget = 102; });
});

test("v3 validates difficulty, guidance, and complete decision environments", () => {
  const withResult = completedSave(sample);
  assert.deepEqual(parsePortableSave(JSON.stringify(withResult)), withResult);
  withResult.game.result!.difficulty = "guided";
  assert.throws(() => parsePortableSave(JSON.stringify(withResult)), /result difficulty does not match/i);

  const missingDifficulty = structuredClone(sample);
  delete (missingDifficulty.preferences as unknown as Record<string, unknown>).difficulty;
  assert.throws(() => parsePortableSave(JSON.stringify(missingDifficulty)), /difficulty preference is invalid/i);

  const badDifficulty = structuredClone(sample);
  (badDifficulty.preferences as unknown as Record<string, unknown>).difficulty = "impossible";
  assert.throws(() => parsePortableSave(JSON.stringify(badDifficulty)), /difficulty preference is invalid/i);

  const missingGuidance = structuredClone(sample);
  delete (missingGuidance.preferences as unknown as Record<string, unknown>).guidance;
  assert.throws(() => parsePortableSave(JSON.stringify(missingGuidance)), /guidance preference is invalid/i);

  const badGuidance = structuredClone(sample);
  (badGuidance.preferences.guidance as unknown as Record<string, unknown>).checklistCollapsed = "no";
  assert.throws(() => parsePortableSave(JSON.stringify(badGuidance)), /guidance preference is invalid/i);

  const incompleteHistory = structuredClone(sample);
  delete (incompleteHistory.game.history[0].context as unknown as Record<string, unknown>).soundProfile;
  assert.throws(() => parsePortableSave(JSON.stringify(incompleteHistory)), /decision data is invalid/i);
});

test("v3 rejects unknown domain values in current decisions and decision history", () => {
  const cases: Array<{
    name: string;
    mutate: (invalid: PortableSave) => void;
    message: RegExp;
  }> = [
    {
      name: "current warfare area",
      mutate: (invalid) => { (invalid.game as unknown as Record<string, unknown>).selectedWarfare = ["space-control"]; },
      message: /decision data is invalid/i,
    },
    {
      name: "current end state",
      mutate: (invalid) => { (invalid.game as unknown as Record<string, unknown>).selectedEndState = "unlimited-control"; },
      message: /end state is invalid/i,
    },
    {
      name: "current primary theory lens",
      mutate: (invalid) => { (invalid.game as unknown as Record<string, unknown>).selectedLens = "score-only"; },
      message: /theory lens is invalid/i,
    },
    {
      name: "current partner theory lens",
      mutate: (invalid) => { (invalid.game as unknown as Record<string, unknown>).selectedPartnerLens = "score-only"; },
      message: /partner theory lens is invalid/i,
    },
    {
      name: "current guardrail",
      mutate: (invalid) => { (invalid.game as unknown as Record<string, unknown>).selectedGuardrail = "none"; },
      message: /guardrail is invalid/i,
    },
    {
      name: "difficulty",
      mutate: (invalid) => { (invalid.preferences as unknown as Record<string, unknown>).difficulty = "impossible"; },
      message: /difficulty preference is invalid/i,
    },
    {
      name: "history warfare area",
      mutate: (invalid) => { (invalid.game.history[0] as unknown as Record<string, unknown>).warfare = ["space-control"]; },
      message: /decision data is invalid/i,
    },
    {
      name: "history end state",
      mutate: (invalid) => { (invalid.game.history[0] as unknown as Record<string, unknown>).endState = "unlimited-control"; },
      message: /decision data is invalid/i,
    },
    {
      name: "history primary theory lens",
      mutate: (invalid) => { (invalid.game.history[0] as unknown as Record<string, unknown>).theoryLens = "score-only"; },
      message: /decision data is invalid/i,
    },
    {
      name: "history partner theory lens",
      mutate: (invalid) => { (invalid.game.history[0] as unknown as Record<string, unknown>).partnerLens = "score-only"; },
      message: /decision data is invalid/i,
    },
    {
      name: "history guardrail",
      mutate: (invalid) => { (invalid.game.history[0] as unknown as Record<string, unknown>).guardrail = "none"; },
      message: /decision data is invalid/i,
    },
  ];

  for (const invalidCase of cases) {
    const invalid = structuredClone(sample);
    invalidCase.mutate(invalid);
    assert.throws(
      () => parsePortableSave(JSON.stringify(invalid)),
      invalidCase.message,
      invalidCase.name,
    );
  }
});

test("portable-save trust boundary rejects code-shaped keys, unknown catalog entries, and hidden controls", () => {
  const encoded = JSON.stringify(sample);
  assert.throws(
    () => parsePortableSave(encoded.replace('"version":3', '"version":3,"__proto__":{"polluted":true}')),
    /unsafe object key/,
  );
  const unknownCatalog = structuredClone(sample);
  unknownCatalog.game.fleet["<script>alert(1)</script>"] = 1;
  assert.throws(() => parsePortableSave(JSON.stringify(unknownCatalog)), /force roster is invalid/i);
  const directionalOverride = structuredClone(sample);
  directionalOverride.game.rationale = "Safe prefix\u202Egnp.exe";
  assert.throws(() => parsePortableSave(JSON.stringify(directionalOverride)), /Current decision fields are invalid/);
  const duplicateWarfare = structuredClone(sample);
  duplicateWarfare.game.selectedWarfare = ["air-defense", "air-defense"];
  assert.throws(() => parsePortableSave(JSON.stringify(duplicateWarfare)), /Decision data is invalid/i);
  const oversizedHistory = structuredClone(sample);
  oversizedHistory.game.history = Array.from({ length: 201 }, () => structuredClone(sample.game.history[0]));
  assert.throws(() => parsePortableSave(JSON.stringify(oversizedHistory)), /Decision data is invalid/i);
  assert.equal((Object.prototype as { polluted?: boolean }).polluted, undefined);
});

test("compound scenario imports reject noncanonical metadata and unsafe matrix copy", () => {
  const compound = structuredClone(sample);
  compound.game.scenario = deterministicScenario(48);
  assert.deepEqual(parsePortableSave(JSON.stringify(compound)).game.scenario.matrix, compound.game.scenario.matrix);

  const contradictoryScale = structuredClone(compound);
  const contradictoryMatrix = contradictoryScale.game.scenario.matrix;
  assert.ok(contradictoryMatrix);
  contradictoryMatrix.forceScaleLabel = "Tiny group";
  assert.equal(isScenarioMatrix(contradictoryMatrix), false);
  assert.throws(() => parsePortableSave(JSON.stringify(contradictoryScale)), /scenario is missing or invalid/i);

  const hiddenControl = structuredClone(compound);
  const hiddenControlMatrix = hiddenControl.game.scenario.matrix;
  assert.ok(hiddenControlMatrix);
  hiddenControlMatrix.disruptions[0].headline = "Storm\u202Egnp.exe";
  assert.equal(isScenarioMatrix(hiddenControlMatrix), false);
  assert.throws(() => parsePortableSave(JSON.stringify(hiddenControl)), /scenario is missing or invalid/i);

  const rogueEvent = structuredClone(compound);
  const rogueMatrix = rogueEvent.game.scenario.matrix;
  assert.ok(rogueMatrix);
  rogueMatrix.disruptions.push(...Array.from({ length: 6 }, (_, index) => ({
    ...rogueMatrix.disruptions[0],
    id: `rogue-${index}`,
  })));
  assert.equal(isScenarioMatrix(rogueMatrix), false);
  assert.throws(() => parsePortableSave(JSON.stringify(rogueEvent)), /scenario is missing or invalid/i);
});

test("compound imports reject rerolled matrices, edited report chains, and impossible success claims", () => {
  const completed = structuredClone(sample);
  completed.game.scenario = deterministicScenario(48);
  completed.preferences.difficulty = "challenge";
  const rules = savedRules(completed);
  const readiness = savedReadiness(completed);
  const orders: RigidOrders = {
    formation: "concentrated-screen", sensors: "cooperative-fusion", tempo: "measured-advance",
    engagement: "contain", task: rules.required[0], coordination: "federated", riskTreatment: "mitigate",
  };
  const initialState = createInitialRigidState(readiness, rules);
  const initialSave = structuredClone(completed);
  initialSave.game.rigidState = initialState;
  initialSave.game.rigidOrders = orders;
  assert.deepEqual(parsePortableSave(JSON.stringify(initialSave)).game.rigidState, initialState);

  for (const key of ["contactQuality", "readiness"] as const) {
    const alteredInitial = structuredClone(initialSave);
    alteredInitial.game.rigidState![key] = Math.min(100, alteredInitial.game.rigidState![key] + 1);
    assert.throws(() => parsePortableSave(JSON.stringify(alteredInitial)), /committed matrix|report chain/i);
  }

  let state = initialState;
  while (state.phase === "active") state = resolveRigidTurn(state, orders, readiness, rules);
  completed.game.rigidState = state;
  completed.game.rigidOrders = orders;
  completed.game.result = state.outcome;
  assert.deepEqual(parsePortableSave(JSON.stringify(completed)).game.rigidState, state);

  const detachedWithoutState = structuredClone(completed);
  detachedWithoutState.game.rigidState = null;
  assert.throws(
    () => parsePortableSave(JSON.stringify(detachedWithoutState)),
    /completed result requires its canonical umpire state/i,
  );

  const rerolled = structuredClone(completed);
  const resolution = rerolled.game.rigidState!.reports[0].matrixResolution!;
  resolution.ultimate.draw = resolution.ultimate.draw === 100 ? 99 : resolution.ultimate.draw + 1;
  resolution.ultimate.result = resolution.ultimate.draw <= resolution.ultimate.committedChance
    ? "success"
    : resolution.ultimate.draw <= resolution.ultimate.committedChance + 12 ? "partial" : "failure";
  assert.throws(() => parsePortableSave(JSON.stringify(rerolled)), /Rigid umpire state|committed matrix|report chain/i);

  const rewrittenChance = structuredClone(completed);
  const component = rewrittenChance.game.rigidState!.reports[0].matrixResolution!.components[0];
  component.range = [80, 98];
  component.committedChance = 89;
  component.result = component.draw <= 89 ? "success" : component.draw <= 101 ? "partial" : "failure";
  assert.throws(() => parsePortableSave(JSON.stringify(rewrittenChance)), /committed matrix|report chain/i);

  const alteredOrder = structuredClone(completed);
  alteredOrder.game.rigidState!.reports[0].orders.task = "land-attack";
  assert.throws(() => parsePortableSave(JSON.stringify(alteredOrder)), /committed matrix|report chain/i);

  const rewrittenInput = structuredClone(completed);
  const firstInput = rewrittenInput.game.rigidState!.reports[0].matrixInput!;
  firstInput.contactQuality += firstInput.contactQuality < 100 ? 1 : -1;
  rewrittenInput.game.rigidState!.reports[0].matrixResolution = estimateResolutionMatrix(
    rewrittenInput.game.rigidState!.matrix!,
    firstInput,
  );
  assert.throws(() => parsePortableSave(JSON.stringify(rewrittenInput)), /committed matrix|report chain/i);

  const rewrittenDelta = structuredClone(completed);
  const lastReport = rewrittenDelta.game.rigidState!.reports.at(-1)!;
  const rangeShift = rewrittenDelta.game.rigidState!.rangeNm < 280 ? 1 : -1;
  lastReport.delta.rangeNm += rangeShift;
  rewrittenDelta.game.rigidState!.rangeNm += rangeShift;
  assert.throws(() => parsePortableSave(JSON.stringify(rewrittenDelta)), /committed matrix|report chain/i);

  const rosterSwap = structuredClone(completed);
  rosterSwap.game.fleet = Object.fromEntries(Object.keys(rosterSwap.game.fleet).map((id) => [id, 0]));
  rosterSwap.game.airWing = Object.fromEntries(Object.keys(rosterSwap.game.airWing).map((id) => [id, 0]));
  rosterSwap.game.selectedArmaments = Object.fromEntries(Object.keys(rosterSwap.game.selectedArmaments || {}).map((id) => [id, 0]));
  assert.throws(() => parsePortableSave(JSON.stringify(rosterSwap)), /committed matrix|report chain/i);

  // Preserve every committed draw while fabricating a numerically coherent
  // perfect final state and win. The older aggregate-only validator accepts
  // this construction; roster-derived deterministic replay must reject it.
  const fabricated = structuredClone(completed);
  const fabricatedState = fabricated.game.rigidState!;
  const fabricatedLast = fabricatedState.reports.at(-1)!;
  const targets = {
    contactQuality: 100,
    readiness: 100,
    integrity: 100,
    supply: 100,
    escalation: 0,
    objectiveProgress: 100,
    opposingCohesion: 0,
  } as const;
  for (const [key, target] of Object.entries(targets) as Array<[keyof typeof targets, number]>) {
    fabricatedLast.delta[key] += target - fabricatedState[key];
    fabricatedState[key] = target;
  }
  if (fabricatedState.secondaryObjectiveProgress !== undefined) {
    fabricatedLast.delta.secondaryObjectiveProgress = (fabricatedLast.delta.secondaryObjectiveProgress ?? 0)
      + 100 - fabricatedState.secondaryObjectiveProgress;
    fabricatedState.secondaryObjectiveProgress = 100;
  }
  const fabricatedPlanning = fabricatedState.outcome!.breakdown.planning;
  const fabricatedTotal = Math.round(30 + 15 + 15 + 10 + 10 + 10 + 5 + fabricatedPlanning);
  fabricatedState.outcome = {
    ...fabricatedState.outcome!,
    won: true,
    score: fabricatedTotal,
    title: fabricatedTotal >= 92 ? "DECISIVE VICTORY" : "LIMITED SUCCESS",
    breakdown: {
      ...fabricatedState.outcome!.breakdown,
      objective: 30,
      opposingDisruption: 15,
      forceIntegrity: 15,
      commandReadiness: 10,
      supply: 10,
      contactQuality: 10,
      escalationDiscipline: 5,
      total: fabricatedTotal,
    },
  };
  fabricated.game.result = fabricatedState.outcome;
  assert.throws(() => parsePortableSave(JSON.stringify(fabricated)), /committed matrix|report chain/i);

  const impossible = structuredClone(completed);
  impossible.game.rigidState!.integrity = 0;
  impossible.game.rigidState!.outcome!.won = true;
  impossible.game.rigidState!.outcome!.title = "LIMITED SUCCESS";
  impossible.game.result = impossible.game.rigidState!.outcome;
  assert.throws(() => parsePortableSave(JSON.stringify(impossible)), /committed matrix|report chain|canonical umpire/i);

  const detached = structuredClone(completed);
  detached.game.result = { ...detached.game.result!, score: Math.max(0, detached.game.result!.score - 1) };
  detached.game.result.breakdown = { ...detached.game.result.breakdown, total: detached.game.result.score };
  assert.throws(() => parsePortableSave(JSON.stringify(detached)), /does not match the canonical umpire outcome/i);
});

test("imported rigid impacts, matrix reports, and new debrief findings share the clean-text boundary", () => {
  const compound = structuredClone(sample);
  compound.game.scenario = deterministicScenario(48);
  compound.preferences.difficulty = "challenge";
  const readiness = savedReadiness(compound);
  const compoundRules = savedRules(compound);
  compound.game.rigidState = createInitialRigidState(readiness, compoundRules);
  assert.ok(compound.game.rigidState.disruptionImpacts?.length);

  const spoofedImpact = structuredClone(compound);
  spoofedImpact.game.rigidState!.disruptionImpacts![0].label = "Safe\u202Egnp.exe";
  assert.throws(() => parsePortableSave(JSON.stringify(spoofedImpact)), /Rigid umpire state is invalid/i);

  const orders: RigidOrders = {
    formation: "concentrated-screen", sensors: "cooperative-fusion", tempo: "measured-advance",
    engagement: "contain", task: compound.game.scenario.required[0],
  };
  const resolved = structuredClone(compound);
  resolved.game.rigidState = resolveRigidTurn(
    compound.game.rigidState!,
    orders,
    readiness,
    compoundRules,
  );
  resolved.game.rigidOrders = orders;
  const spoofedReportId = structuredClone(resolved);
  spoofedReportId.game.rigidState!.reports[0].activeDisruptionIds = ["safe\u202Egnp.exe"];
  assert.throws(() => parsePortableSave(JSON.stringify(spoofedReportId)), /Rigid umpire state is invalid/i);
  const spoofedMatrixLabel = structuredClone(resolved);
  spoofedMatrixLabel.game.rigidState!.reports[0].matrixResolution!.components[0].label = "Safe\u202Egnp.exe";
  assert.throws(() => parsePortableSave(JSON.stringify(spoofedMatrixLabel)), /Rigid umpire state is invalid/i);

  const completed = completedSave(sample);
  assert.deepEqual(parsePortableSave(JSON.stringify(completed)).game.result, completed.game.result);
  const duplicateFindings = structuredClone(completed);
  const duplicateFinding = {
    code: "force-mismatch" as const,
    cause: "The force did not fit.",
    evidence: "The manifest lacked a required capability.",
    adjustment: "Revise the force.",
    moduleId: "maritime-uncrewed" as const,
  };
  duplicateFindings.game.result!.findings = [duplicateFinding, { ...duplicateFinding }];
  duplicateFindings.game.rigidState!.outcome = duplicateFindings.game.result;
  assert.throws(() => parsePortableSave(JSON.stringify(duplicateFindings)), /Current decision fields are invalid/i);

  const excessiveTurns = structuredClone(sample);
  const archivedTurn = {
    orders,
    phase: "Test phase",
    contactReport: "Test report.",
    umpireNotes: ["Test note."],
    delta: { rangeNm: 0, contactQuality: 0, readiness: 0, integrity: 0, supply: 0, escalation: 0, objectiveProgress: 0, opposingCohesion: 0 },
  };
  excessiveTurns.game.history[0].rigidTurns = Array.from({ length: 7 }, (_, index) => ({ ...archivedTurn, turn: index + 1 }));
  assert.throws(() => parsePortableSave(JSON.stringify(excessiveTurns)), /Decision data is invalid/i);
});

test("human-readable export explains compound events without inventing an illicit-network mission", () => {
  const ordinary = structuredClone(sample);
  ordinary.game.scenario = deterministicScenario(40);
  while (ordinary.game.scenario.illicitNetworkType) ordinary.game.scenario = deterministicScenario(ordinary.game.scenario.id);
  const ordinaryText = formatPortableSave(ordinary);
  assert.doesNotMatch(ordinaryText, /illicit-network category/i);

  const relevant = structuredClone(sample);
  relevant.game.scenario = deterministicScenario(47);
  while (!relevant.game.scenario.illicitNetworkType) relevant.game.scenario = deterministicScenario(relevant.game.scenario.id);
  const relevantText = formatPortableSave(relevant);
  assert.match(relevantText, /illicit-network category/i);

  relevant.preferences.difficulty = "challenge";
  const readiness = savedReadiness(relevant);
  relevant.game.rigidState = createInitialRigidState(readiness, savedRules(relevant));
  const compoundText = formatPortableSave(relevant);
  assert.match(compoundText, /Disruption schedule:/);
  assert.match(compoundText, /No secondary objective has been disclosed at the current turn|Secondary objective: .*method /);
  assert.match(compoundText, /Disclosed impact ledger:/);
});

test("mid-command human-readable TXT withholds future events and unrevealed objectives", () => {
  const midgame = structuredClone(sample);
  let scenario = deterministicScenario(1);
  for (let id = 2; id <= 300; id += 1) {
    const matrix = scenario.matrix;
    if (matrix?.secondaryObjective && matrix.secondaryObjective.revealTurn > 1
      && matrix.disruptions.some((event) => event.startsTurn > 1)) break;
    scenario = deterministicScenario(id);
  }
  assert.ok(scenario.matrix?.secondaryObjective);
  midgame.game.scenario = scenario;
  midgame.preferences.difficulty = "challenge";
  const readiness = savedReadiness(midgame);
  const rules = savedRules(midgame);
  midgame.game.rigidState = createInitialRigidState(readiness, rules);
  const readable = formatPortableSave(midgame);
  assert.match(readable, /BASE64-UTF8:/);
  assert.deepEqual(parsePortableSave(readable).game.rigidState, midgame.game.rigidState);
  assert.doesNotMatch(readable, new RegExp(scenario.matrix.secondaryObjective!.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  for (const event of midgame.game.rigidState.matrix!.activeDisruptions.filter((item) => item.startsTurn > 1)) {
    assert.doesNotMatch(readable, new RegExp(event.headline.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
  assert.match(readable, /No secondary objective has been disclosed at the current turn/);
  assert.match(readable, /disclosed history and current windows only/i);

  const orders: RigidOrders = {
    formation: "concentrated-screen", sensors: "cooperative-fusion", tempo: "measured-advance",
    engagement: "contain", task: scenario.required[0], coordination: "federated", riskTreatment: "prepare",
  };
  let revealed = midgame.game.rigidState;
  while (revealed && revealed.phase === "active" && revealed.turn + 1 < scenario.matrix.secondaryObjective!.revealTurn) {
    revealed = resolveRigidTurn(revealed, orders, readiness, rules);
  }
  assert.ok(revealed);
  midgame.game.rigidState = revealed;
  const revealedText = formatPortableSave(midgame);
  assert.match(revealedText, new RegExp(scenario.matrix.secondaryObjective!.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));

  let complete = revealed;
  while (complete.phase === "active") complete = resolveRigidTurn(complete, orders, readiness, rules);
  midgame.game.rigidState = complete;
  midgame.game.result = complete.outcome;
  const completedText = formatPortableSave(midgame);
  assert.doesNotMatch(completedText, /BASE64-UTF8:/);
  assert.match(completedText, /Disruption schedule: complete history/i);
  for (const event of complete.matrix!.activeDisruptions) {
    assert.match(completedText, new RegExp(event.headline.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
});

test("valid v2 domain selections migrate without widening or loss", () => {
  const legacy = structuredClone(sample);
  (legacy as { version: number }).version = 2;
  delete (legacy.preferences as unknown as Record<string, unknown>).difficulty;
  delete (legacy.preferences as unknown as Record<string, unknown>).guidance;
  legacy.game.selectedWarfare = ["surface-operations", "undersea-operations"];
  legacy.game.selectedEndState = "protection";
  legacy.game.selectedLens = "mahan";
  legacy.game.selectedPartnerLens = "sun-tzu";
  legacy.game.selectedGuardrail = "civilian";
  legacy.game.history[0].warfare = ["surface-operations", "undersea-operations"];
  legacy.game.history[0].endState = "protection";
  legacy.game.history[0].theoryLens = "mahan";
  legacy.game.history[0].partnerLens = "sun-tzu";
  legacy.game.history[0].guardrail = "civilian";

  const parsed = parsePortableSave(JSON.stringify(legacy));
  assert.deepEqual(
    {
      warfare: parsed.game.selectedWarfare,
      endState: parsed.game.selectedEndState,
      primaryLens: parsed.game.selectedLens,
      partnerLens: parsed.game.selectedPartnerLens,
      guardrail: parsed.game.selectedGuardrail,
      historyWarfare: parsed.game.history[0].warfare,
      historyEndState: parsed.game.history[0].endState,
      historyPrimaryLens: parsed.game.history[0].theoryLens,
      historyPartnerLens: parsed.game.history[0].partnerLens,
      historyGuardrail: parsed.game.history[0].guardrail,
      difficulty: parsed.preferences.difficulty,
    },
    {
      warfare: ["surface-operations", "undersea-operations"],
      endState: "protection",
      primaryLens: "mahan",
      partnerLens: "sun-tzu",
      guardrail: "civilian",
      historyWarfare: ["surface-operations", "undersea-operations"],
      historyEndState: "protection",
      historyPrimaryLens: "mahan",
      historyPartnerLens: "sun-tzu",
      historyGuardrail: "civilian",
      difficulty: "standard",
    },
  );
});

test("legacy saves are normalized to the 100-point model", () => {
  const legacy = structuredClone(sample);
  (legacy as { version: number }).version = 1;
  const environmentalKeys = [
    "regionId", "hemisphere", "observerLatitude", "observerLongitude", "scenarioDate", "season",
    "storming", "lightningCapable", "windHeading", "windSpeed", "currentHeading", "currentSpeed",
    "waveHeading", "soundProfile",
  ];
  for (const key of environmentalKeys) {
    delete (legacy.game.scenario as unknown as Record<string, unknown>)[key];
    delete (legacy.game.history[0].context as unknown as Record<string, unknown>)[key];
  }
  delete (legacy.preferences as unknown as Record<string, unknown>).difficulty;
  delete (legacy.preferences as unknown as Record<string, unknown>).guidance;
  delete (legacy.game as Partial<typeof legacy.game>).rigidState;
  delete (legacy.game as Partial<typeof legacy.game>).rigidOrders;
  (legacy.game.scenario as Record<string, unknown>).budget = 102;
  legacy.game.result = { won: true, score: 102, title: "LEGACY RESULT", notes: [] } as unknown as SavedResult;
  legacy.game.history[0].score = 102;
  legacy.game.history[0].context.budget = 102;
  const parsed = parsePortableSave(JSON.stringify(legacy));
  assert.equal(parsed.version, 3);
  assert.equal(parsed.game.rigidState, null);
  assert.equal(parsed.game.rigidOrders, null);
  assert.equal(parsed.game.scenario.budget, 100);
  assert.equal(parsed.game.result?.score, 100);
  assert.equal(parsed.game.result?.difficulty, "standard");
  assert.equal(parsed.game.result?.breakdown.total, 100);
  assert.deepEqual(parsed.game.result?.findings, []);
  assert.equal(parsed.game.history[0].score, 100);
  assert.equal(parsed.game.history[0].context.budget, 100);
  assert.equal(parsed.preferences.difficulty, "standard");
  assert.equal(parsed.preferences.guidance.checklistCollapsed, false);
  assert.deepEqual(
    {
      regionId: parsed.game.scenario.regionId,
      hemisphere: parsed.game.scenario.hemisphere,
      observerLatitude: parsed.game.scenario.observerLatitude,
      observerLongitude: parsed.game.scenario.observerLongitude,
      scenarioDate: parsed.game.scenario.scenarioDate,
      season: parsed.game.scenario.season,
      soundProfile: parsed.game.scenario.soundProfile,
    },
    {
      regionId: sampleEnvironment.regionId,
      hemisphere: sampleEnvironment.hemisphere,
      observerLatitude: sampleEnvironment.observerLatitude,
      observerLongitude: sampleEnvironment.observerLongitude,
      scenarioDate: sampleEnvironment.scenarioDate,
      season: sampleEnvironment.season,
      soundProfile: sampleEnvironment.soundProfile,
    },
  );
  assert.equal(parsed.game.history[0].context.regionId, parsed.game.scenario.regionId);
  assert.equal(parsed.game.history[0].context.waveHeading, parsed.game.scenario.waveHeading);

  (legacy as { version: number }).version = 2;
  const parsedV2 = parsePortableSave(JSON.stringify(legacy));
  assert.equal(parsedV2.version, 3);
  assert.deepEqual(parsedV2.game.scenario, parsed.game.scenario);
  assert.deepEqual(parsedV2.game.history[0].context, parsed.game.history[0].context);
});

test("calendar sky reports astronomical phase and horizontal positions", () => {
  const full = getCelestialState("2026-07-29", "night", 12, 0);
  const dark = getCelestialState("2026-08-12", "night", 12, 0);
  const daylight = getCelestialState("2026-07-29", "day", 12, 0);

  assert.equal(full.moon.phaseName, "full moon");
  assert.ok(full.moon.illumination > 0.98);
  assert.equal(dark.moon.phaseName, "new moon");
  assert.ok(dark.moon.illumination < 0.02);
  assert.ok(daylight.sun.altitude > full.sun.altitude);
  assert.ok(full.moon.azimuth >= 0 && full.moon.azimuth < 360);
  assert.ok(full.moon.altitude >= -90 && full.moon.altitude <= 90);
});

test("astronomical lunar state is deterministic for phase rendering", () => {
  const first = getCelestialState("2030-10-21", "night", -64, 51);
  const repeated = getCelestialState("2030-10-21", "night", -64, 51);

  assert.equal(first.moon.phaseAngle, repeated.moon.phaseAngle);
  assert.equal(first.moon.illumination, repeated.moon.illumination);
  assert.equal(first.moon.waxing, first.moon.phaseAngle < 180);
});

test("all five views retain safe camera geometry and canonical numeric direction telemetry", () => {
  assert.ok(VIEW_CONFIG.subsurface.camera[1] < 0);
  assert.ok(VIEW_CONFIG.subsurface.target[1] < 0);
  assert.ok(VIEW_CONFIG.sky.target[1] > VIEW_CONFIG.sky.camera[1]);
  assert.ok(VIEW_CONFIG.stars.maxPolarAngle > 3);
  assert.equal(nextViewLayer("surface", -1), "air");
  assert.equal(nextViewLayer("surface", 1), "subsurface");
  assert.equal(nextViewLayer("sky", -1), "stars");
  assert.equal(nextViewLayer("stars", -1), "stars");
  assert.equal(nextViewLayer("subsurface", 1), "subsurface");

  const cardinal = [
    [[0, 0, -1], 0, "N"],
    [[1, 0, 0], 90, "E"],
    [[0, 0, 1], 180, "S"],
    [[-1, 0, 0], 270, "W"],
  ] as const;
  for (const [[x, y, z], expectedHeading, expectedDirection] of cardinal) {
    const telemetry = viewTelemetryFromDirection(x, y, z);
    assert.equal(telemetry.heading, expectedHeading);
    assert.equal(telemetry.direction, expectedDirection);
    assert.equal(headingToCompass(telemetry.heading), expectedDirection);
  }
  assert.equal(viewTelemetryFromDirection(0, 1, -1).elevation, 45);
});

test("procedural star visibility is deterministic and declines with conventional air traffic", () => {
  const baseline = { time: "night", clouds: "clear", precipitation: "none", visibility: 12, aircraftCount: 0, lowSignatureAircraft: 0, vesselCount: 0, lowSignatureVessels: 0 } as const;
  const quiet = getSkyVisibility(baseline);
  const busy = getSkyVisibility({ ...baseline, aircraftCount: 12 });
  const busier = getSkyVisibility({ ...baseline, aircraftCount: 20 });
  const lowSignature = getSkyVisibility({ ...baseline, aircraftCount: 12, lowSignatureAircraft: 12, vesselCount: 2, lowSignatureVessels: 2 });
  const overcast = getSkyVisibility({ ...baseline, clouds: "overcast" });
  const daylight = getSkyVisibility({ ...baseline, time: "day" });
  const hostileTwilight = {
    ...baseline,
    clouds: "overcast" as const,
    precipitation: "rain" as const,
    visibility: 2,
    aircraftCount: 40,
    vesselCount: 40,
  };
  const dawn = getSkyVisibility({ ...hostileTwilight, time: "dawn" });
  const dusk = getSkyVisibility({ ...hostileTwilight, time: "dusk" });
  assert.ok(quiet.starCount > busy.starCount);
  assert.ok(busy.starCount > busier.starCount);
  assert.ok(lowSignature.starCount > busy.starCount);
  assert.equal(lowSignature.allLowSignature, true);
  assert.match(lowSignature.clarity, /pristine|expansive/);
  assert.ok(overcast.starCount < quiet.starCount);
  assert.ok(daylight.starCount < quiet.starCount);
  assert.equal(dawn.starCount, 64, "dawn must retain a brightest-star cohort even under compounded penalties");
  assert.equal(dusk.starCount, 96, "dusk must retain a brightest-star cohort even under compounded penalties");

  const seed = stableSeed(8, "Temperate Strait Network", "stars");
  const first = createStarPlacements(seed, 12);
  const second = createStarPlacements(seed, 12);
  assert.deepEqual(first, second);
  assert.deepEqual(createStarPlacements(seed, 20).slice(0, 12), first);
  assert.notDeepEqual(createStarPlacements(stableSeed(9, "Temperate Strait Network", "stars"), 12), first);
});

test("subsurface life stays vague, deterministic, and appropriate to broad region and depth", () => {
  const reef = getSubsurfaceLifeProfile("ocean", "Equatorial Convergence Gate · reef shelves", 5);
  const reefAgain = getSubsurfaceLifeProfile("ocean", "Equatorial Convergence Gate · reef shelves", 5);
  const polarTrench = getSubsurfaceLifeProfile("antarctic", "Southern Ice Margin · deep ocean trench", 5);
  assert.deepEqual(reef, reefAgain);
  assert.equal(reef.key, "reef-shelf");
  assert.ok(reef.solitaryCount + reef.schoolCount > polarTrench.solitaryCount + polarTrench.schoolCount);
  assert.equal(polarTrench.key, "polar-trench");
  assert.equal(polarTrench.seabedY, null);
  for (const profile of [reef, polarTrench]) assert.doesNotMatch(profile.depthLabel, /shark|whale|dolphin|tuna|seal|penguin/i);
});
