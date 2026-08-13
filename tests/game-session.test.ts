import assert from "node:assert/strict";
import test from "node:test";
import { commandScenario } from "../app/commandPhase";
import { generateScenario } from "../app/gameModel";
import { createInitialRigidState, DEFAULT_RIGID_ORDERS, resolveRigidTurn, type RigidReadiness } from "../app/kriegsspiel";
import { gameSessionReducer, type GameSessionState } from "../app/useGameSession";

const readiness: RigidReadiness = {
  planningScore: 82,
  missionReady: true,
  requiredCoverage: 2,
  requiredCount: 2,
  forcePoints: 94,
  escortValue: 3,
  airDefenseValue: 4,
  underseaValue: 4,
  uncrewedCount: 4,
  supportedAircraftCount: 10,
  compatibleArmamentCount: 4,
  maxReachNm: 220,
  trackCapacity: 18,
  trackingMethods: ["passive", "cooperative"],
  lowSignatureCount: 3,
  selectedUnitCount: 9,
  adaptationScore: 80,
};

function initialState(): GameSessionState {
  return {
    scenario: generateScenario(0, () => 0.31),
    fleet: {},
    airWing: {},
    selectedArmaments: {},
    selectedWarfare: [],
    academyProgress: [],
    difficulty: "standard",
    guidedChecklistCollapsed: true,
    selectedEndState: "",
    selectedLens: "",
    selectedPartnerLens: "",
    selectedGuardrail: "",
    theorySynthesis: "",
    rationale: "",
    assumptions: "",
    termination: "",
    history: [],
    result: null,
    rigidState: null,
    rigidOrders: DEFAULT_RIGID_ORDERS,
  };
}

test("typed force and decision actions update only their domain", () => {
  const start = initialState();
  const withForce = gameSessionReducer(start, { type: "update-force-count", roster: "fleet", id: "screen-vessel", count: 2 });
  const withWriting = gameSessionReducer(withForce, { type: "write-decision", field: "rationale", value: "Preserve access." });
  const withSelection = gameSessionReducer(withWriting, { type: "select-primary-lens", value: "corbett" });
  assert.equal(withSelection.fleet["screen-vessel"], 2);
  assert.equal(withSelection.rationale, "Preserve access.");
  assert.equal(withSelection.selectedLens, "corbett");
  assert.equal(withSelection.scenario, start.scenario);
  assert.equal(withSelection.airWing, start.airWing);
});

test("begin, resolve, undo, and return transitions remain coherent", () => {
  const start = initialState();
  const rigidScenario = commandScenario(start.scenario, start.difficulty);
  const active = createInitialRigidState(readiness, rigidScenario);
  const begun = gameSessionReducer(start, { type: "begin-command", state: active, orders: DEFAULT_RIGID_ORDERS });
  assert.equal(begun.rigidState?.phase, "active");

  const afterTurn = resolveRigidTurn(active, DEFAULT_RIGID_ORDERS, readiness, rigidScenario);
  const resolved = gameSessionReducer(begun, { type: "resolve-turn", state: afterTurn, outcome: null });
  assert.equal(resolved.rigidState?.reports.length, 1);

  const undoneState = { ...active, reports: [] };
  const undone = gameSessionReducer(resolved, { type: "undo-turn", state: undoneState, dropHistory: false });
  assert.equal(undone.result, null);
  assert.equal(undone.rigidState?.reports.length, 0);

  const planning = gameSessionReducer(undone, { type: "return-to-planning" });
  assert.equal(planning.rigidState, null);
  assert.equal(planning.result, null);
});

test("restore-save and reset-session replace the session atomically", () => {
  const start = initialState();
  const restored = { ...initialState(), difficulty: "challenge" as const, rationale: "Restored record", fleet: { scout: 1 } };
  assert.deepEqual(gameSessionReducer(start, { type: "restore-save", state: restored }), restored);

  const reset = { ...initialState(), difficulty: "guided" as const };
  assert.deepEqual(gameSessionReducer(restored, { type: "reset-session", state: reset }), reset);
});
