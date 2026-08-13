import assert from "node:assert/strict";
import test from "node:test";
import {
  createInitialRigidState,
  isRigidGameState,
  outcomeLearningAssessment,
  resolveRigidTurn,
  secondaryObjectiveThreshold,
  turnLearningNote,
  undoRigidTurn,
  type RigidDiagnosticFinding,
  type RigidOrders,
  type RigidReadiness,
  type RigidScenario,
} from "../app/kriegsspiel";
import { generateScenario } from "../app/gameModel";

const strongReadiness: RigidReadiness = {
  planningScore: 95,
  missionReady: true,
  requiredCoverage: 3,
  requiredCount: 3,
  forcePoints: 92,
  escortValue: 4,
  airDefenseValue: 3,
  underseaValue: 3,
  uncrewedCount: 8,
  supportedAircraftCount: 18,
  compatibleArmamentCount: 12,
  maxReachNm: 260,
  trackCapacity: 260,
  trackingMethods: ["active radar", "passive acoustic", "passive emitter", "cooperative network"],
  lowSignatureCount: 3,
  selectedUnitCount: 20,
};

const weakReadiness: RigidReadiness = {
  planningScore: 25,
  missionReady: false,
  requiredCoverage: 1,
  requiredCount: 3,
  forcePoints: 22,
  escortValue: 0,
  airDefenseValue: 0,
  underseaValue: 0,
  uncrewedCount: 0,
  supportedAircraftCount: 0,
  compatibleArmamentCount: 0,
  maxReachNm: 25,
  trackCapacity: 6,
  trackingMethods: ["electro-optical"],
  lowSignatureCount: 0,
  selectedUnitCount: 1,
};

const scenario: RigidScenario = {
  id: 1,
  difficulty: "standard",
  climate: "ocean",
  time: "night",
  clouds: "scattered",
  precipitation: "none",
  seaState: 3,
  visibility: 8,
  required: ["reconnaissance", "surface-operations", "air-defense"],
  recommended: ["electromagnetic-operations"],
  guardrail: "escalation",
  minimumEscort: 3,
  minimumAirDefense: 2,
  minimumAsw: 1,
  minimumUncrewed: 4,
};

const winningOrders: RigidOrders[] = [
  { formation: "concentrated-screen", sensors: "cooperative-fusion", tempo: "hold", engagement: "shadow", task: "reconnaissance" },
  { formation: "distributed-barrier", sensors: "cooperative-fusion", tempo: "measured-advance", engagement: "contain", task: "surface-operations" },
  { formation: "concentrated-screen", sensors: "passive-search", tempo: "measured-advance", engagement: "contain", task: "air-defense" },
  { formation: "distributed-barrier", sensors: "cooperative-fusion", tempo: "measured-advance", engagement: "bounded-effects", task: "surface-operations" },
  { formation: "concentrated-screen", sensors: "passive-search", tempo: "measured-advance", engagement: "contain", task: "air-defense" },
  { formation: "protected-column", sensors: "passive-search", tempo: "measured-advance", engagement: "contain", task: "reconnaissance" },
];

test("secondary objective thresholds are centralized by difficulty", () => {
  assert.equal(secondaryObjectiveThreshold("guided"), 25);
  assert.equal(secondaryObjectiveThreshold("standard"), 34);
  assert.equal(secondaryObjectiveThreshold("challenge"), 40);
});

function play(readiness: RigidReadiness, orders = winningOrders, gameScenario = scenario) {
  return orders.reduce((state, order) => resolveRigidTurn(state, order, readiness, gameScenario), createInitialRigidState(readiness, gameScenario));
}

test("six-turn transcripts are deterministic, bounded, and terminal", () => {
  const first = play(strongReadiness);
  const second = play(strongReadiness);
  assert.deepEqual(first, second);
  assert.equal(first.turn, 6);
  assert.equal(first.phase, "complete");
  assert.equal(first.reports.length, 6);
  assert.ok(first.outcome);
  assert.ok(first.outcome.score >= 0 && first.outcome.score <= 100);
  for (const key of ["contactQuality", "readiness", "integrity", "supply", "escalation", "objectiveProgress", "opposingCohesion"] as const) {
    assert.ok(first[key] >= 0 && first[key] <= 100, key);
  }
  assert.equal(resolveRigidTurn(first, winningOrders[0], strongReadiness, scenario), first);
  assert.equal(isRigidGameState(first), true);
});

test("a coherent compatible force can win while a planning-gap force cannot", () => {
  const strong = play(strongReadiness);
  const weak = play(weakReadiness);
  assert.equal(strong.outcome?.won, true);
  assert.equal(weak.outcome?.won, false);
  assert.ok((strong.outcome?.score || 0) > (weak.outcome?.score || 0));
  assert.ok(strong.objectiveProgress > weak.objectiveProgress);
});

test("difficulty changes friction, thresholds, and outcomes without changing determinism", () => {
  const guided = play(strongReadiness, winningOrders, { ...scenario, difficulty: "guided" });
  const standard = play(strongReadiness, winningOrders, { ...scenario, difficulty: "standard" });
  const challenge = play(strongReadiness, winningOrders, { ...scenario, difficulty: "challenge" });
  const legacyDefault = play(strongReadiness, winningOrders, { ...scenario, difficulty: undefined });

  assert.deepEqual(guided, play(strongReadiness, winningOrders, { ...scenario, difficulty: "guided" }));
  assert.deepEqual(legacyDefault, standard);
  assert.ok(guided.integrity >= standard.integrity);
  assert.ok(standard.integrity >= challenge.integrity);
  assert.ok(guided.supply >= standard.supply);
  assert.ok(standard.supply >= challenge.supply);
  assert.ok((guided.outcome?.score || 0) >= (standard.outcome?.score || 0));
  assert.ok((standard.outcome?.score || 0) >= (challenge.outcome?.score || 0));
  assert.equal(guided.outcome?.breakdown.victoryThreshold, 64);
  assert.equal(standard.outcome?.breakdown.victoryThreshold, 70);
  assert.equal(challenge.outcome?.breakdown.victoryThreshold, 76);
  assert.equal(guided.outcome?.difficulty, "guided");
  assert.equal(challenge.outcome?.difficulty, "challenge");
  assert.equal(guided.outcome?.won, true);
  assert.equal(standard.outcome?.won, true);
  assert.equal(challenge.outcome?.won, true);
});

test("outcomes expose a bounded score breakdown and actionable typed findings", () => {
  const final = play(weakReadiness, Array.from({ length: 6 }, () => ({
    formation: "distributed-barrier",
    sensors: "emission-control",
    tempo: "high-speed-dash",
    engagement: "bounded-effects",
    task: "mine-countermeasures",
  } as RigidOrders)));
  const outcome = final.outcome;
  assert.ok(outcome);
  assert.equal(outcome.breakdown.total, outcome.score);
  assert.equal(outcome.breakdown.victoryThreshold, 70);
  for (const value of Object.values(outcome.breakdown)) assert.ok(value >= 0 && value <= 100);
  assert.ok(outcome.findings.length >= 3);
  const findings: RigidDiagnosticFinding[] = outcome.findings;
  assert.ok(findings.some((finding) => finding.code === "planning-gap" && finding.moduleId === "strategy-grammar"));
  assert.ok(findings.some((finding) => finding.code === "task-mismatch" && finding.moduleId === "synthesis"));
  assert.ok(findings.some((finding) => finding.code === "objective-gap" && finding.moduleId === "corbett"));
  for (const finding of findings) {
    assert.ok(finding.cause.length > 0);
    assert.ok(finding.evidence.length > 0);
    assert.ok(finding.adjustment.length > 0);
    assert.ok(finding.moduleId.length > 0);
  }
});

test("post-resolution learning distinguishes mistakes from unfavorable uncertainty", () => {
  const weakFinal = play(weakReadiness, Array.from({ length: 6 }, () => ({
    formation: "distributed-barrier",
    sensors: "emission-control",
    tempo: "high-speed-dash",
    engagement: "bounded-effects",
    task: "mine-countermeasures",
  } as RigidOrders)));
  assert.equal(outcomeLearningAssessment(weakFinal).kind, "adjustment");
  assert.equal(turnLearningNote(weakFinal.reports[0]).kind, "adjustment");

  const coherent = play(strongReadiness);
  const adverseReports = coherent.reports.map((report, index) => index === 0 ? {
    ...report,
    matrixResolution: {
      turn: report.turn,
      components: [],
      ultimate: { key: "ultimate" as const, label: "Ultimate mission matrix", range: [45, 65] as const, committedChance: 55, draw: 90, result: "failure" as const },
    },
    umpireNotes: report.umpireNotes.filter((note) => !/does not address|outside every|remains below|lacks the force or environmental conditions/i.test(note)),
  } : report);
  const uncertaintyState = {
    ...coherent,
    reports: adverseReports,
    outcome: { ...coherent.outcome!, won: false, findings: [] },
  };
  assert.equal(turnLearningNote(adverseReports[0]).kind, "uncertainty");
  assert.equal(outcomeLearningAssessment(uncertaintyState).kind, "uncertainty");
  assert.match(outcomeLearningAssessment(uncertaintyState).heading, /NO CLEAR MISTAKE/);
});

test("undo reverses active and completed turns exactly", () => {
  const initial = createInitialRigidState(strongReadiness, scenario);
  const first = resolveRigidTurn(initial, winningOrders[0], strongReadiness, scenario);
  const second = resolveRigidTurn(first, winningOrders[1], strongReadiness, scenario);
  assert.deepEqual(undoRigidTurn(second), first);
  assert.equal(undoRigidTurn(initial), initial);

  const complete = play(strongReadiness);
  const rewound = undoRigidTurn(complete);
  assert.equal(rewound.phase, "active");
  assert.equal(rewound.turn, 5);
  assert.equal(rewound.outcome, null);
  assert.equal(rewound.reports.length, 5);
  assert.equal(isRigidGameState(rewound), true);
  assert.deepEqual(resolveRigidTurn(rewound, winningOrders[5], strongReadiness, scenario), complete);
});

test("orders materially change contact, position, escalation, and objective state", () => {
  const cautious = play(strongReadiness, Array.from({ length: 6 }, () => ({
    formation: "protected-column",
    sensors: "emission-control",
    tempo: "hold",
    engagement: "avoid",
    task: "mine-countermeasures",
  } as RigidOrders)));
  const active = play(strongReadiness);
  assert.notEqual(active.rangeNm, cautious.rangeNm);
  assert.notEqual(active.reports[0].delta.contactQuality, cautious.reports[0].delta.contactQuality);
  assert.notEqual(active.escalation, cautious.escalation);
  assert.ok(active.objectiveProgress > cautious.objectiveProgress);
});

test("weather and tracking methods have rigid sensor consequences", () => {
  const clear = { ...scenario, time: "day" as const, clouds: "clear" as const, seaState: 1, visibility: 14 };
  const obscured = { ...scenario, clouds: "overcast" as const, precipitation: "rain" as const, seaState: 6, visibility: 2 };
  const order = winningOrders[0];
  const clearTurn = resolveRigidTurn(createInitialRigidState(strongReadiness, clear), order, strongReadiness, clear);
  const obscuredTurn = resolveRigidTurn(createInitialRigidState(strongReadiness, obscured), order, strongReadiness, obscured);
  const methodPoor = resolveRigidTurn(createInitialRigidState(weakReadiness, clear), order, weakReadiness, clear);
  assert.ok(clearTurn.contactQuality > obscuredTurn.contactQuality);
  assert.ok(clearTurn.contactQuality > methodPoor.contactQuality);
});

test("the umpire accepts no writing and explicitly disclaims prose evaluation", () => {
  const final = play(strongReadiness);
  const machineData = JSON.stringify(final);
  assert.doesNotMatch(machineData, /rationale|synthesis|assumption|termination|proseScore/i);
  assert.match(final.outcome?.notes.join(" ") || "", /No written response was evaluated/i);
});

test("invalid imported rigid state is rejected", () => {
  const valid = play(strongReadiness);
  assert.equal(isRigidGameState(valid), true);
  assert.equal(isRigidGameState({ ...valid, turn: 7 }), false);
  assert.equal(isRigidGameState({ ...valid, contactQuality: 104 }), false);
  assert.equal(isRigidGameState({ ...valid, reports: [] }), false);
  assert.equal(isRigidGameState({ ...valid, outcome: { ...valid.outcome!, difficulty: "impossible" } }), false);
  assert.equal(isRigidGameState({ ...valid, outcome: { ...valid.outcome!, breakdown: { ...valid.outcome!.breakdown, total: 101 } } }), false);
  assert.equal(isRigidGameState({ ...valid, outcome: { ...valid.outcome!, findings: [{ ...valid.outcome!.findings[0], cause: "" }] } }), false);
});

test("generated scenarios admit a deterministic reference solution", () => {
  let seed = 17;
  const random = () => {
    seed = (seed * 48271) % 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let index = 0; index < 80; index += 1) {
    const generated = generateScenario(index, random);
    const gameScenario: RigidScenario = {
      id: generated.id,
      difficulty: "standard",
      climate: generated.climate,
      time: generated.time,
      clouds: generated.clouds,
      precipitation: generated.precipitation,
      seaState: generated.seaState,
      visibility: generated.visibility,
      required: generated.required,
      recommended: generated.recommended,
      guardrail: generated.guardrail,
      minimumEscort: generated.minimumEscort,
      minimumAirDefense: generated.minimumAirDefense,
      minimumAsw: generated.minimumAsw,
      minimumUncrewed: generated.minimumUncrewed,
    };
    const referenceReadiness: RigidReadiness = {
      ...strongReadiness,
      planningScore: 100,
      requiredCoverage: generated.required.length,
      requiredCount: generated.required.length,
      forcePoints: 100,
      escortValue: 8,
      airDefenseValue: 7,
      underseaValue: 7,
      uncrewedCount: 18,
      supportedAircraftCount: 30,
      compatibleArmamentCount: 20,
      maxReachNm: 420,
      trackCapacity: 440,
      trackingMethods: ["active radar", "active acoustic", "passive acoustic", "passive emitter", "cooperative network", "infrared", "magnetic anomaly", "bathymetric comparison"],
    };
    const orders = Array.from({ length: 6 }, (_, turn): RigidOrders => ({
      formation: turn === 2 ? "distributed-barrier" : "concentrated-screen",
      sensors: turn < 2
        ? (generated.storming || generated.visibility <= 3 ? "active-sweep" : "cooperative-fusion")
        : "passive-search",
      tempo: turn === 0 ? "hold" : "measured-advance",
      engagement: turn === 0 ? "shadow" : turn === 3 ? "bounded-effects" : "contain",
      task: generated.required[turn % generated.required.length],
    }));
    const final = play(referenceReadiness, orders, gameScenario);
    assert.equal(final.outcome?.won, true, `reference solution failed for scenario ${index}`);
  }
});
