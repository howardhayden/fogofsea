import assert from "node:assert/strict";
import test from "node:test";
import {
  createInitialRigidState,
  DEFAULT_RIGID_ORDERS,
  outcomeLearningAssessment,
  resolveRigidTurn,
  RIGID_FINDING_CODES,
  type RigidGameState,
  type RigidOrders,
  type RigidReadiness,
  type RigidScenario,
} from "../../app/kriegsspiel";

const scenario: RigidScenario = {
  id: 901,
  difficulty: "standard",
  climate: "ocean",
  time: "day",
  clouds: "clear",
  precipitation: "none",
  seaState: 2,
  visibility: 12,
  required: ["reconnaissance", "surface-operations"],
  recommended: ["electromagnetic-operations"],
  guardrail: "escalation",
  minimumEscort: 2,
  minimumAirDefense: 1,
  minimumAsw: 1,
  minimumUncrewed: 2,
};

const readyForce: RigidReadiness = {
  planningScore: 96,
  missionReady: true,
  requiredCoverage: 2,
  requiredCount: 2,
  forcePoints: 90,
  escortValue: 5,
  airDefenseValue: 4,
  underseaValue: 3,
  uncrewedCount: 8,
  supportedAircraftCount: 16,
  compatibleArmamentCount: 12,
  maxReachNm: 260,
  trackCapacity: 260,
  trackingMethods: ["active radar", "passive acoustic", "cooperative network"],
  lowSignatureCount: 3,
  selectedUnitCount: 18,
  adaptationScore: 95,
};

const effectOrders: RigidOrders = {
  ...DEFAULT_RIGID_ORDERS,
  formation: "distributed-barrier",
  sensors: "active-sweep",
  tempo: "measured-advance",
  engagement: "bounded-effects",
  task: "surface-operations",
  riskTreatment: "respond",
};

function positionedState(readiness = readyForce, gameScenario = scenario) {
  return {
    ...createInitialRigidState(readiness, gameScenario),
    rangeNm: 30,
    contactQuality: 100,
  };
}

function playSix(orders: RigidOrders[], readiness = readyForce, gameScenario = scenario, initial?: RigidGameState) {
  return orders.reduce(
    (state, order) => resolveRigidTurn(state, order, readiness, gameScenario),
    initial ?? createInitialRigidState(readiness, gameScenario),
  );
}

function assertNoMissionEffect(state: RigidGameState, label: string) {
  const report = state.reports.at(-1);
  assert.ok(report, label);
  assert.equal(report.delta.objectiveProgress, 0, `${label}: primary objective`);
  assert.equal(report.delta.opposingCohesion, 0, `${label}: opposing cohesion`);
}

test("RT-RULE-EFFECT-001 invalid pressure attempts cannot create primary progress or cohesion loss", () => {
  const noReady = { ...readyForce, missionReady: false };
  const shortReach = { ...readyForce, maxReachNm: 25 };
  const noCreditedEffect = {
    ...readyForce,
    selectedUnitCount: 0,
    escortValue: 0,
    airDefenseValue: 0,
    underseaValue: 0,
    uncrewedCount: 0,
    supportedAircraftCount: 0,
    compatibleArmamentCount: 0,
  };
  const cases: Array<{ label: string; state: RigidGameState; orders: RigidOrders; readiness: RigidReadiness }> = [
    {
      label: "avoid",
      state: positionedState(),
      orders: { ...effectOrders, engagement: "avoid", strategicPolicy: "nuclear-employment" },
      readiness: readyForce,
    },
    {
      label: "withdraw",
      state: positionedState(),
      orders: { ...effectOrders, tempo: "withdraw", strategicPolicy: "nuclear-employment" },
      readiness: readyForce,
    },
    { label: "not mission ready", state: positionedState(), orders: effectOrders, readiness: noReady },
    {
      label: "below contact threshold",
      state: { ...positionedState(), contactQuality: 0 },
      orders: { ...effectOrders, sensors: "emission-control" },
      readiness: readyForce,
    },
    {
      label: "out of reach",
      state: { ...positionedState(), rangeNm: 280 },
      orders: { ...effectOrders, tempo: "hold" },
      readiness: shortReach,
    },
    {
      label: "irrelevant task",
      state: positionedState(),
      orders: { ...effectOrders, task: "mine-countermeasures" },
      readiness: readyForce,
    },
    {
      label: "no credited mission effect",
      state: positionedState(),
      orders: effectOrders,
      readiness: noCreditedEffect,
    },
  ];

  for (const attack of cases) {
    assertNoMissionEffect(resolveRigidTurn(attack.state, attack.orders, attack.readiness, scenario), attack.label);
  }

  const avoidedNuclearAttempt = resolveRigidTurn(cases[0].state, cases[0].orders, cases[0].readiness, scenario);
  assert.ok(avoidedNuclearAttempt.escalation > 0, "invalid effects retain their escalation cost");
});

test("RT-RULE-EFFECT-002 an all-avoid transcript cannot win the scoring system", () => {
  const avoidOrders: RigidOrders = {
    ...DEFAULT_RIGID_ORDERS,
    formation: "protected-column",
    sensors: "emission-control",
    tempo: "hold",
    engagement: "avoid",
    task: "reconnaissance",
  };
  const final = playSix(Array.from({ length: 6 }, () => avoidOrders));

  assert.equal(final.phase, "complete");
  assert.equal(final.objectiveProgress, 0);
  assert.equal(final.opposingCohesion, 100);
  assert.equal(final.outcome?.won, false);
  assert.ok(final.outcome?.findings.some((finding) => finding.code === "objective-gap"));
});

test("RT-RULE-EFFECT-003 legitimate shadow and contain postures retain non-kinetic mission effects", () => {
  const shadow = resolveRigidTurn(positionedState(), {
    ...DEFAULT_RIGID_ORDERS,
    sensors: "cooperative-fusion",
    engagement: "shadow",
    tempo: "hold",
    task: "reconnaissance",
  }, readyForce, scenario);
  const contain = resolveRigidTurn(positionedState(), {
    ...DEFAULT_RIGID_ORDERS,
    sensors: "passive-search",
    engagement: "contain",
    tempo: "measured-advance",
    task: "surface-operations",
  }, readyForce, scenario);

  for (const [label, state] of [["shadow", shadow], ["contain", contain]] as const) {
    const delta = state.reports[0].delta;
    assert.ok(delta.objectiveProgress > 0, `${label}: primary objective`);
    assert.ok(delta.opposingCohesion < 0, `${label}: opposing cohesion`);
  }
});

test("RT-UMP-DEFAULT-001 omitted optional orders adjudicate and record as the visible defaults", () => {
  const compact: RigidOrders = {
    formation: "concentrated-screen",
    sensors: "passive-search",
    tempo: "hold",
    engagement: "shadow",
    task: "reconnaissance",
  };
  const explicit: RigidOrders = { ...DEFAULT_RIGID_ORDERS };
  const initial = positionedState();

  const omittedResult = resolveRigidTurn(initial, compact, readyForce, scenario);
  const explicitResult = resolveRigidTurn(initial, explicit, readyForce, scenario);

  assert.deepEqual(omittedResult, explicitResult);
  assert.deepEqual(omittedResult.reports[0].orders, explicit);
});

test("RT-INFO-SENSOR-001 zero sensing capacity cannot manufacture high-confidence contact", () => {
  const blindForce: RigidReadiness = { ...readyForce, trackCapacity: 0, trackingMethods: [] };
  const activeSweep: RigidOrders = {
    ...DEFAULT_RIGID_ORDERS,
    sensors: "active-sweep",
    engagement: "shadow",
    tempo: "hold",
    task: "reconnaissance",
  };
  const initial = createInitialRigidState(blindForce, scenario);
  const final = playSix(Array.from({ length: 6 }, () => activeSweep), blindForce, scenario, initial);

  assert.ok(initial.contactQuality <= 19);
  assert.ok(final.contactQuality <= 19);
  assert.ok(final.reports.every((report) => report.contactReport.startsWith("Scattered indications only")));
  assert.doesNotMatch(final.reports.map((report) => report.contactReport).join(" "), /high-confidence|multi-method/i);
});

test("RT-INFO-SENSOR-002 one unique method cannot produce multi-method custody", () => {
  const oneMethod = {
    ...readyForce,
    trackingMethods: ["active radar", "ACTIVE RADAR", " active radar "],
  };
  const multiMethod = { ...readyForce, trackingMethods: ["active radar", "passive acoustic"] };
  const activeSweep: RigidOrders = {
    ...DEFAULT_RIGID_ORDERS,
    sensors: "active-sweep",
    engagement: "shadow",
    tempo: "hold",
    task: "reconnaissance",
  };
  const orders = Array.from({ length: 6 }, () => activeSweep);
  const singleFinal = playSix(orders, oneMethod);
  const multiFinal = playSix(orders, multiMethod);

  assert.equal(singleFinal.contactQuality, 64);
  assert.doesNotMatch(singleFinal.reports.map((report) => report.contactReport).join(" "), /high-confidence|multi-method/i);
  assert.ok(multiFinal.contactQuality > singleFinal.contactQuality);
});

test("RT-UMP-ESC-001 peak escalation cannot be washed out before final scoring", () => {
  const guidedScenario: RigidScenario = { ...scenario, difficulty: "guided" };
  const employment: RigidOrders = {
    ...effectOrders,
    sensors: "active-sweep",
    tempo: "high-speed-dash",
    strategicPolicy: "nuclear-employment",
  };
  const deescalate: RigidOrders = {
    ...DEFAULT_RIGID_ORDERS,
    sensors: "emission-control",
    tempo: "withdraw",
    engagement: "avoid",
    task: "reconnaissance",
  };
  const initial = positionedState(readyForce, guidedScenario);
  const final = playSix([employment, deescalate, deescalate, deescalate, deescalate, deescalate], readyForce, guidedScenario, initial);
  const peak = Math.max(...final.reports.reduce<number[]>((values, report) => {
    values.push((values.at(-1) ?? 0) + report.delta.escalation);
    return values;
  }, []));

  assert.ok(peak > final.outcome!.breakdown.escalationLimit, `peak ${peak}`);
  assert.ok(final.escalation <= final.outcome!.breakdown.escalationLimit, `close ${final.escalation}`);
  assert.equal(final.outcome?.won, false);
  assert.ok(final.outcome?.findings.some((finding) => finding.code === "guardrail-breach" && /peaked at/.test(finding.evidence)));
  assert.match(final.outcome?.notes.join(" ") ?? "", /exceeded at a .* peak before closing/);
});

test("RT-EDU-FINDING-001 every typed finding blocks false no-mistake absolution", () => {
  const avoidOrders: RigidOrders = { ...DEFAULT_RIGID_ORDERS, engagement: "avoid", task: "reconnaissance" };
  const base = playSix(Array.from({ length: 6 }, () => avoidOrders));
  const adverseReports = base.reports.map((report, index) => index === 0 ? {
    ...report,
    matrixResolution: {
      turn: report.turn,
      components: [],
      ultimate: {
        key: "ultimate" as const,
        label: "Ultimate mission matrix",
        range: [45, 65] as const,
        committedChance: 55,
        draw: 90,
        result: "failure" as const,
      },
    },
  } : report);

  for (const code of RIGID_FINDING_CODES) {
    const assessed: RigidGameState = {
      ...base,
      reports: adverseReports,
      outcome: {
        ...base.outcome!,
        won: false,
        findings: [{
          code,
          cause: `${code} cause`,
          evidence: `${code} evidence`,
          adjustment: `${code} adjustment`,
          moduleId: "synthesis",
        }],
      },
    };
    const learning = outcomeLearningAssessment(assessed);
    assert.equal(learning.kind, "adjustment", code);
    assert.doesNotMatch(learning.heading, /NO CLEAR MISTAKE/, code);
  }
});
