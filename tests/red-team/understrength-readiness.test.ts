import assert from "node:assert/strict";
import test from "node:test";
import { deriveForceReadiness } from "../../app/forceReadiness";
import { generateScenario } from "../../app/gameModel";

test("RT-RULE-002: a 17.9-point OPEN STRAIT force without safeguarding effects is not command-ready", () => {
  const scenario = generateScenario(7, () => 0.41);
  assert.equal(scenario.id, 8);
  assert.equal(scenario.operation, "OPEN STRAIT");
  assert.ok(scenario.required.includes("maritime-interdiction"));
  assert.ok(scenario.required.includes("mine-countermeasures"));

  const result = deriveForceReadiness({
    scenario,
    difficulty: "standard",
    fleet: { "autonomous-mine-support-ship": 2 },
    airWing: { "uncrewed-surveillance-rotorcraft": 8 },
    selectedArmaments: { "airborne-decoy-pack": 1 },
    selectedWarfare: [...new Set([...scenario.required, ...scenario.recommended])],
    selectedEndState: scenario.endState,
    selectedLens: scenario.lenses[0],
    selectedPartnerLens: scenario.lenses[1],
    selectedGuardrail: scenario.guardrail,
  });

  // Preserve the exact exploit conditions: coverage-by-affiliation and weighted
  // adaptation currently award a perfect planning score at only 17.9 points.
  assert.equal(result.metrics.forcePoints, 17.9);
  assert.equal(result.assessment.score, 100);
  assert.equal(result.forceAdaptation.score, 65);
  assert.equal(result.metrics.pointCredit.missionCreditedArmaments["maritime-safeguarding-pack"], 0);
  assert.equal(result.metrics.pointCredit.missionCreditedArmaments["mine-neutralization-pack"], 0);
  assert.equal(result.metrics.pointCredit.missionCreditedArmaments["airborne-mine-sensing-pack"], 0);

  // A zero-value mission-specific gap is noncompensable: unrelated strengths
  // must not offset the absence of every safeguarding, rescue, or handoff asset.
  assert.equal(result.fullyReady, false);
  assert.equal(result.rigidReadiness.missionReady, false);
  assert.deepEqual(result.forceAdaptation.criticalGaps, [
    "Add at least one credited safeguarding, rescue, documentation, or protected-handoff asset.",
  ]);
  assert.ok(result.readinessGaps.some((gap) => /safeguarding, rescue, documentation, or protected-handoff/i.test(gap)));

  // This is a capability gate, not a covert minimum-spend floor: adding one
  // compatible safeguarding pack clears the noncompensable gap at 18.3 points.
  const corrected = deriveForceReadiness({
    scenario,
    difficulty: "standard",
    fleet: { "autonomous-mine-support-ship": 2 },
    airWing: { "uncrewed-surveillance-rotorcraft": 8 },
    selectedArmaments: { "airborne-decoy-pack": 1, "maritime-safeguarding-pack": 1 },
    selectedWarfare: [...new Set([...scenario.required, ...scenario.recommended])],
    selectedEndState: scenario.endState,
    selectedLens: scenario.lenses[0],
    selectedPartnerLens: scenario.lenses[1],
    selectedGuardrail: scenario.guardrail,
  });
  assert.equal(corrected.metrics.forcePoints, 18.3);
  assert.deepEqual(corrected.forceAdaptation.criticalGaps, []);
  assert.equal(corrected.fullyReady, true);
  assert.equal(corrected.rigidReadiness.missionReady, true);
});
