import assert from "node:assert/strict";
import test from "node:test";
import { assessRiskEffects } from "../app/riskStrategy";

const base = {
  treatment: "prepare" as const,
  coordination: "federated" as const,
  strategicPolicy: "conventional-restraint" as const,
  turn: 2,
  adversaryCount: 2,
  selectedLens: "corbett" as const,
  guardrail: "escalation" as const,
  currentIntegrity: 60,
  currentSupply: 55,
};

test("preparedness, response, recovery, and mitigation produce distinct bounded tradeoffs", () => {
  const treatments = (["prepare", "respond", "recover", "mitigate"] as const).map((treatment) => assessRiskEffects({ ...base, treatment }));
  assert.equal(new Set(treatments.map((effect) => JSON.stringify(effect))).size, 4);
  assert.ok(treatments[0].contact > treatments[2].contact);
  assert.ok(treatments[1].integrity > treatments[0].integrity);
  assert.ok(treatments[2].readiness > treatments[1].readiness);
  assert.ok(treatments[3].objective > 0);
});

test("plural adversaries penalize brittle centralization while federated support remains viable", () => {
  const centralized = assessRiskEffects({ ...base, adversaryCount: 3, selectedLens: "mahan", coordination: "centralized" });
  const federated = assessRiskEffects({ ...base, adversaryCount: 3, selectedLens: "mahan", coordination: "federated" });
  const mutual = assessRiskEffects({ ...base, adversaryCount: 3, selectedLens: "mahan", coordination: "mutual-support" });
  assert.ok(centralized.pressure > federated.pressure);
  assert.ok(federated.objective > centralized.objective);
  assert.ok(mutual.integrity > centralized.integrity);
});

test("nuclear options are not universal wins and carry escalating recovery consequences", () => {
  const restraint = assessRiskEffects(base);
  const deterrent = assessRiskEffects({ ...base, strategicPolicy: "nuclear-deterrent" });
  const demonstration = assessRiskEffects({ ...base, strategicPolicy: "nuclear-demonstration" });
  const employment = assessRiskEffects({ ...base, strategicPolicy: "nuclear-employment" });
  assert.ok(restraint.escalation < deterrent.escalation);
  assert.ok(deterrent.escalation < demonstration.escalation);
  assert.ok(demonstration.escalation < employment.escalation);
  assert.ok(employment.integrity < restraint.integrity);
  assert.ok(employment.readiness < restraint.readiness);
  assert.ok(employment.supply < restraint.supply);
  assert.ok(employment.pressure > demonstration.pressure);
});
