import assert from "node:assert/strict";
import test from "node:test";
import { adversaryAssessmentOptions } from "../../app/commandIntelligence";
import { commandScenario } from "../../app/commandPhase";
import { deriveForceReadiness } from "../../app/forceReadiness";
import {
  ADVERSARY_INTENT_ASSUMPTIONS,
  ADVERSARY_NEXT_ACTION_ASSUMPTIONS,
  DEFAULT_RIGID_ORDERS,
  OBSERVED_PATTERN_ASSUMPTIONS,
  RIGID_ADVERSARY_ACTION_CODES,
  createInitialRigidState,
  isRigidGameState,
  resolveRigidTurn,
  type RigidGameState,
  type RigidOrders,
} from "../../app/kriegsspiel";
import { formatPortableSave, parsePortableSave, type PortableSave } from "../../app/saveGame";
import { deterministicScenario, minimalPortableSave } from "./fixtures";

function currentSave(resolvedTurns: 1 | 2) {
  const save = minimalPortableSave(deterministicScenario(20));
  const { rigidReadiness } = deriveForceReadiness({
    scenario: save.game.scenario,
    difficulty: save.preferences.difficulty,
    fleet: save.game.fleet,
    airWing: save.game.airWing,
    selectedArmaments: save.game.selectedArmaments ?? {},
    selectedWarfare: save.game.selectedWarfare,
    selectedEndState: save.game.selectedEndState,
    selectedLens: save.game.selectedLens,
    selectedPartnerLens: save.game.selectedPartnerLens ?? "",
    selectedGuardrail: save.game.selectedGuardrail,
  });
  const rules = commandScenario(
    save.game.scenario,
    save.preferences.difficulty,
    save.game.selectedLens,
  );
  const orders: RigidOrders = {
    ...DEFAULT_RIGID_ORDERS,
    task: save.game.scenario.required[0] ?? "reconnaissance",
  };
  let state = createInitialRigidState(rigidReadiness, rules);
  for (let turn = 0; turn < resolvedTurns; turn += 1) {
    const options = adversaryAssessmentOptions(state);
    state = resolveRigidTurn(
      state,
      state.turn === 0
        ? orders
        : {
          ...orders,
          adversaryAssessment: {
            intent: options.intent[0].value,
            observedPattern: options.observedPattern[0].value,
            nextAction: options.nextAction[0].value,
          },
        },
      rigidReadiness,
      rules,
    );
  }
  save.game.rigidState = state;
  return { save, state, orders };
}

function cloneSave(save: PortableSave) {
  return structuredClone(save);
}

test("RT-TI-SAVE-001: v4 states require all typed intelligence arrays on every resolved turn", () => {
  const { save } = currentSave(2);
  for (const reportIndex of [0, 1]) {
    for (const field of ["adversaryActions", "inflictions", "observationDomains"] as const) {
      const stripped = cloneSave(save);
      delete stripped.game.rigidState!.reports[reportIndex][field];

      assert.throws(
        () => parsePortableSave(JSON.stringify(stripped)),
        /Rigid umpire state is invalid/i,
        `stripping ${field} from report ${reportIndex + 1} must invalidate a current transcript`,
      );
    }
  }
});

test("RT-TI-SAVE-002: a resolved Turn 2 requires a complete adversary assessment", () => {
  const { save } = currentSave(2);
  const incomplete = cloneSave(save);
  const assessment = incomplete.game.rigidState!.reports[1].orders.adversaryAssessment;
  assert.ok(assessment);
  delete assessment.nextAction;

  assert.throws(
    () => parsePortableSave(JSON.stringify(incomplete)),
    /Rigid umpire state is invalid/i,
  );
});

test("RT-TI-SAVE-002B: replay rejects a committed assessment unavailable before its turn", () => {
  const { save } = currentSave(2);
  const beforeTurnTwo = currentSave(1).state;
  const options = adversaryAssessmentOptions(beforeTurnTwo);
  const unavailableIntent = ADVERSARY_INTENT_ASSUMPTIONS.find(
    (value) => !options.intent.some((option) => option.value === value),
  );
  assert.ok(unavailableIntent);
  save.game.rigidState!.reports[1].orders.adversaryAssessment!.intent = unavailableIntent;

  assert.throws(
    () => parsePortableSave(JSON.stringify(save)),
    /report chain or committed matrix result is invalid/i,
  );
});

test("RT-TI-SAVE-003: typed intelligence rejects invalid action codes, amounts, and domains", () => {
  const { save } = currentSave(2);
  const mutations: Array<[string, (candidate: PortableSave) => void]> = [
    ["action code", (candidate) => {
      const action = candidate.game.rigidState!.reports[0].adversaryActions![0];
      (action as unknown as Record<string, unknown>).action = "predict-hidden-movement";
    }],
    ["infliction amount", (candidate) => {
      candidate.game.rigidState!.reports[0].inflictions![0].amount = 0;
    }],
    ["action domain", (candidate) => {
      const action = candidate.game.rigidState!.reports[0].adversaryActions![0];
      (action.domains as unknown[])[0] = "space";
    }],
  ];

  for (const [label, mutate] of mutations) {
    const tampered = cloneSave(save);
    mutate(tampered);
    assert.throws(
      () => parsePortableSave(JSON.stringify(tampered)),
      /Rigid umpire state is invalid/i,
      `${label} must remain inside its declared domain`,
    );
  }
});

test("RT-TI-SAVE-004: canonical replay detects structurally valid action and infliction mutations", () => {
  const { save } = currentSave(2);
  const mutations: Array<[string, (state: RigidGameState) => void]> = [
    ["action", (state) => {
      const action = state.reports[0].adversaryActions![0];
      const replacement = RIGID_ADVERSARY_ACTION_CODES.find((code) => code !== action.action);
      assert.ok(replacement);
      action.action = replacement;
    }],
    ["infliction", (state) => {
      const infliction = state.reports[0].inflictions![0];
      infliction.amount = infliction.amount === 100 ? 99 : infliction.amount + 1;
    }],
  ];

  for (const [label, mutate] of mutations) {
    const tampered = cloneSave(save);
    mutate(tampered.game.rigidState!);
    assert.equal(isRigidGameState(tampered.game.rigidState), true, `${label} mutation remains structurally valid`);
    assert.throws(
      () => parsePortableSave(JSON.stringify(tampered)),
      /report chain or committed matrix result is invalid/i,
      `canonical replay must detect the ${label} mutation`,
    );
  }
});

test("RT-TI-SAVE-005: a v3 state-version-1 transcript imports and upgrades to state version 2", () => {
  const { save } = currentSave(2);
  const legacy = cloneSave(save);
  (legacy as unknown as { version: number }).version = 3;
  (legacy.game.rigidState as unknown as { version: number }).version = 1;
  for (const report of legacy.game.rigidState!.reports) {
    delete report.adversaryActions;
    delete report.inflictions;
    delete report.observationDomains;
    delete report.orders.adversaryAssessment;
  }

  assert.equal(isRigidGameState(legacy.game.rigidState), true);
  const parsed = parsePortableSave(JSON.stringify(legacy));

  assert.equal(parsed.version, 4);
  assert.equal(parsed.game.rigidState?.version, 2);
  assert.equal(parsed.game.rigidState?.reports.length, 2);
  for (const report of parsed.game.rigidState!.reports) {
    assert.ok(Array.isArray(report.adversaryActions));
    assert.ok(Array.isArray(report.inflictions));
    assert.ok(Array.isArray(report.observationDomains));
  }
  assert.deepEqual(parsed.game.rigidState!.reports[1].orders.adversaryAssessment, {
    intent: "insufficient-evidence",
    observedPattern: "insufficient-evidence",
    nextAction: "insufficient-evidence",
  });
});

test("RT-TI-SAVE-006: v4 pending partial assessments round-trip only within current bounded options", () => {
  const { save, state, orders } = currentSave(1);
  const options = adversaryAssessmentOptions(state);
  const allowedPartial: RigidOrders = {
    ...orders,
    adversaryAssessment: {
      intent: options.intent[0].value,
      nextAction: options.nextAction[0].value,
    },
  };
  const allowed = cloneSave(save);
  allowed.game.rigidOrders = allowedPartial;

  assert.deepEqual(
    parsePortableSave(formatPortableSave(allowed)).game.rigidOrders,
    allowedPartial,
  );

  const unsupportedIntent = ADVERSARY_INTENT_ASSUMPTIONS.find(
    (value) => !options.intent.some((option) => option.value === value),
  );
  const unsupportedPattern = OBSERVED_PATTERN_ASSUMPTIONS.find(
    (value) => !options.observedPattern.some((option) => option.value === value),
  );
  const unsupportedNextAction = ADVERSARY_NEXT_ACTION_ASSUMPTIONS.find(
    (value) => !options.nextAction.some((option) => option.value === value),
  );
  assert.ok(unsupportedIntent);
  assert.ok(unsupportedPattern);
  assert.ok(unsupportedNextAction);

  const unsupported = [
    ["intent", unsupportedIntent],
    ["observedPattern", unsupportedPattern],
    ["nextAction", unsupportedNextAction],
  ] as const;
  for (const [field, value] of unsupported) {
    const rejected = cloneSave(save);
    rejected.game.rigidOrders = {
      ...orders,
      adversaryAssessment: { [field]: value },
    };
    assert.throws(
      () => parsePortableSave(formatPortableSave(rejected)),
      /Pending adversary assumptions are not supported by the visible picture/i,
      `a globally valid but currently unavailable ${field} must be rejected`,
    );
  }
});

test("RT-TI-SAVE-007: v4 rejects legacy rigid-state version 1 instead of silently widening it", () => {
  const { save } = currentSave(1);
  (save.game.rigidState as unknown as { version: number }).version = 1;
  for (const report of save.game.rigidState!.reports) {
    delete report.adversaryActions;
    delete report.inflictions;
    delete report.observationDomains;
  }

  assert.throws(
    () => parsePortableSave(JSON.stringify(save)),
    /Current saves require the typed intelligence transcript/i,
  );
});
