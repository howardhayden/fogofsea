import assert from "node:assert/strict";
import test from "node:test";
import { deriveForceReadiness } from "../../app/forceReadiness";
import { createInitialRigidState, DEFAULT_RIGID_ORDERS, resolveRigidTurn } from "../../app/kriegsspiel";
import { formatPortableSave } from "../../app/saveGame";
import { deterministicScenario, minimalPortableSave } from "./fixtures";

function scenarioWithDeferredInformation() {
  for (let previousId = 1; previousId < 300; previousId += 1) {
    const scenario = deterministicScenario(previousId);
    if (scenario.matrix?.secondaryObjective && scenario.matrix.secondaryObjective.revealTurn > 1
      && scenario.matrix.disruptions.some((event) => event.startsTurn > 1)) return scenario;
  }
  throw new Error("No deferred-information scenario was generated.");
}

test("RT-INFO-001: planning exports do not print future commitments as ordinary JSON", () => {
  const save = minimalPortableSave(scenarioWithDeferredInformation());
  const text = formatPortableSave(save);
  const matrix = save.game.scenario.matrix!;

  assert.match(text, /BASE64-UTF8:/);
  assert.match(text, /casual spoiler resistance/i);
  assert.doesNotMatch(text, new RegExp(String(matrix.seed)));
  assert.doesNotMatch(text, new RegExp(matrix.disruptions[0].headline, "i"));
  assert.doesNotMatch(text, /"committedTurnDraws"|"institutionalConstraint"/);
});

test("RT-INFO-002: an active export does not announce a still-concealed secondary objective", () => {
  const scenario = scenarioWithDeferredInformation();
  const save = minimalPortableSave(scenario);
  const readiness = deriveForceReadiness({
    scenario,
    difficulty: "challenge",
    fleet: save.game.fleet,
    airWing: save.game.airWing,
    selectedArmaments: save.game.selectedArmaments ?? {},
    selectedWarfare: save.game.selectedWarfare,
    selectedEndState: save.game.selectedEndState,
    selectedLens: save.game.selectedLens,
    selectedPartnerLens: save.game.selectedPartnerLens ?? "",
    selectedGuardrail: save.game.selectedGuardrail,
  }).rigidReadiness;
  save.preferences.difficulty = "challenge";
  save.game.rigidState = createInitialRigidState(readiness, { ...scenario, difficulty: "challenge" });
  const text = formatPortableSave(save);

  assert.match(text, /No secondary objective has been disclosed at the current turn/i);
  assert.doesNotMatch(text, /secondary objective 0/i);
  assert.doesNotMatch(text, new RegExp(scenario.matrix!.secondaryObjective!.label, "i"));
});

test("RT-INFO-003D: active exports do not reveal opposing institutional direction as own command interference", () => {
  let scenario = deterministicScenario(1);
  for (let previousId = 2; previousId < 500; previousId += 1) {
    const candidate = deterministicScenario(previousId);
    const opposing = candidate.matrix?.disruptions.find((event) => (
      event.kind === "command-interference" && event.affectedSide === "opposing-force"
    ));
    if (opposing) {
      scenario = candidate;
      break;
    }
  }
  const opposing = scenario.matrix?.disruptions.find((event) => (
    event.kind === "command-interference" && event.affectedSide === "opposing-force"
  ));
  assert.ok(opposing, "fixture includes opposing institutional direction");

  const save = minimalPortableSave(scenario);
  save.preferences.difficulty = "challenge";
  const readiness = deriveForceReadiness({
    scenario,
    difficulty: "challenge",
    fleet: save.game.fleet,
    airWing: save.game.airWing,
    selectedArmaments: save.game.selectedArmaments ?? {},
    selectedWarfare: save.game.selectedWarfare,
    selectedEndState: save.game.selectedEndState,
    selectedLens: save.game.selectedLens,
    selectedPartnerLens: save.game.selectedPartnerLens ?? "",
    selectedGuardrail: save.game.selectedGuardrail,
  }).rigidReadiness;
  const rigidScenario = { ...scenario, difficulty: "challenge" as const };
  let state = createInitialRigidState(readiness, rigidScenario);
  while (state.phase === "active" && state.turn < opposing.startsTurn - 1) {
    state = resolveRigidTurn(state, {
      ...DEFAULT_RIGID_ORDERS,
      task: scenario.required[0],
    }, readiness, rigidScenario);
  }
  save.game.rigidState = state;
  const readable = formatPortableSave(save).split("--- BEGIN FOG OF SEA MACHINE DATA ---")[0];

  assert.doesNotMatch(readable, new RegExp(opposing.headline, "i"));
  assert.doesNotMatch(readable, new RegExp(opposing.description, "i"));
});
