import assert from "node:assert/strict";
import test from "node:test";
import {
  publicKnowledgeForDisruption,
  type ContactVisibility,
} from "../../app/contactVisualization";
import type { ScenarioDisruption } from "../../app/scenarioMatrix";

const noSensing: ContactVisibility = { air: false, surface: false, subsurface: false };
const surfaceSensing: ContactVisibility = { air: false, surface: true, subsurface: false };

function disruption(
  kind: ScenarioDisruption["kind"],
  affectedSide: ScenarioDisruption["affectedSide"],
  affectedDomains: ScenarioDisruption["affectedDomains"],
): Pick<ScenarioDisruption, "kind" | "affectedSide" | "affectedDomains"> {
  return { kind, affectedSide, affectedDomains };
}

test("RT-INFO-003A: opposing causes stay concealed at low contact or without credited sensing", () => {
  const coordination = disruption("opposing-coordination", "opposing-force", ["surface", "communications"]);
  const opportunist = disruption("opportunistic-actor", "selected-force", ["surface", "communications"]);

  assert.equal(publicKnowledgeForDisruption(coordination, 39, surfaceSensing), "concealed");
  assert.equal(publicKnowledgeForDisruption(coordination, 100, noSensing), "concealed");
  assert.equal(publicKnowledgeForDisruption(opportunist, 39, surfaceSensing), "concealed");
  assert.equal(publicKnowledgeForDisruption(opportunist, 100, noSensing), "concealed");
});

test("RT-INFO-003B: earned sensing supports an assessment, never unjustified confirmation", () => {
  const coordination = disruption("opposing-coordination", "opposing-force", ["surface", "communications"]);
  const opportunist = disruption("opportunistic-actor", "both", ["surface", "mission-pack"]);
  const opposingInterference = disruption("command-interference", "opposing-force", ["communications"]);

  assert.equal(publicKnowledgeForDisruption(coordination, 40, surfaceSensing), "assessed");
  assert.equal(publicKnowledgeForDisruption(opportunist, 100, surfaceSensing), "assessed");
  assert.equal(publicKnowledgeForDisruption(opposingInterference, 40, surfaceSensing), "assessed");
});

test("RT-INFO-003C: directly observable weather and own command interference remain confirmed", () => {
  const weather = disruption("severe-weather", "both", ["air", "surface"]);
  const ownInterference = disruption("command-interference", "selected-force", ["communications"]);

  assert.equal(publicKnowledgeForDisruption(weather, 0, noSensing), "confirmed");
  assert.equal(publicKnowledgeForDisruption(ownInterference, 0, noSensing), "confirmed");
});
