import assert from "node:assert/strict";
import test from "node:test";
import { validateScenarioCoexistence } from "../../app/gameModel";
import { parsePortableSave } from "../../app/saveGame";
import { deterministicScenario, minimalPortableSave } from "./fixtures";

test("RT-DATA-001: import cannot bypass whole-scenario coexistence validation", () => {
  const scenario = deterministicScenario(20);
  scenario.minimumEscort = 20;
  scenario.required = scenario.required.filter((area) => area !== "reconnaissance");
  scenario.politicalAim = "A fabricated but syntactically valid aim outside the mission family.";
  const validation = validateScenarioCoexistence(scenario);

  assert.equal(validation.valid, false);
  assert.ok(validation.issues.some((issue) => issue.code === "force-requirements"));
  assert.throws(
    () => parsePortableSave(JSON.stringify(minimalPortableSave(scenario))),
    /scenario is missing or invalid/i,
  );
});

test("RT-DATA-002: pending orders reject undeclared future-control fields", () => {
  const save = minimalPortableSave();
  const task = save.game.scenario.required[0];
  (save.game as unknown as Record<string, unknown>).rigidOrders = {
    formation: "concentrated-screen",
    sensors: "passive-search",
    tempo: "hold",
    engagement: "avoid",
    task,
    futureCommitment: { turn: 6, draw: 100, hiddenObjective: "smuggled" },
  };

  assert.throws(
    () => parsePortableSave(JSON.stringify(save)),
    /pending rigid orders are invalid/i,
  );
});

test("RT-DATA-003: schema versions are exact numeric values rather than coercible strings", () => {
  const save = minimalPortableSave();
  (save as unknown as Record<string, unknown>).version = " 3 ";

  assert.throws(
    () => parsePortableSave(JSON.stringify(save)),
    /unsupported save format or version/i,
  );
});

test("RT-DATA-004: scenarios reject undeclared control fields", () => {
  const save = minimalPortableSave();
  (save.game.scenario as unknown as Record<string, unknown>).scoreOverride = 100;

  assert.throws(
    () => parsePortableSave(JSON.stringify(save)),
    /scenario is missing or invalid/i,
  );
});
