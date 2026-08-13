import assert from "node:assert/strict";
import test from "node:test";
import {
  adaptationThresholdForDifficulty,
  evaluatePlanningAssessment,
  evaluatePlanningReadiness,
  type PlanningAssessmentMetrics,
  type PlanningSelections,
} from "../app/planningAssessment";
import { generateScenario, type Scenario, type Warfare } from "../app/gameModel";

function scenario(): Scenario {
  return {
    ...generateScenario(0, () => 0.31),
    required: ["air-defense", "undersea-operations"],
    recommended: ["reconnaissance"],
    minimumEscort: 2,
    minimumAirDefense: 2,
    minimumAsw: 2,
    minimumUncrewed: 2,
    endState: "access",
    lenses: ["clausewitz", "corbett"],
    guardrail: "escalation",
  };
}

function alignedSelections(): PlanningSelections {
  return {
    selectedWarfare: ["air-defense", "undersea-operations"],
    selectedEndState: "access",
    selectedLens: "clausewitz",
    selectedPartnerLens: "corbett",
    selectedGuardrail: "escalation",
  };
}

function completeMetrics(): PlanningAssessmentMetrics {
  return {
    forcePlanningReady: true,
    allCoverage: new Set<Warfare>(["air-defense", "undersea-operations"]),
    forcePoints: 100,
    aviationFit: { deficit: 0, totalCapacity: 10, supportedAircraft: 4, totalAircraft: 4 },
    armamentFit: { deficit: 0, totalSelected: 2 },
    escorts: 2,
    airDefenseShips: 2,
    aswAssets: 2,
    uncrewedAircraft: 2,
    missionAircraftSelected: 4,
    missionAircraftCredited: 4,
    missionArmamentsSelected: 2,
    missionArmamentsCredited: 2,
  };
}

test("a fully aligned plan preserves the exact 100-point assessment and hard-valid result", () => {
  const assessment = evaluatePlanningAssessment({
    scenario: scenario(),
    selections: alignedSelections(),
    metrics: completeMetrics(),
  });

  assert.equal(assessment.score, 100);
  assert.equal(assessment.missionScore, 15);
  assert.equal(assessment.coverageScore, 20);
  assert.equal(assessment.forceScore, 20);
  assert.equal(assessment.compatibilityScore, 20);
  assert.equal(assessment.strategyScore, 25);
  assert.equal(assessment.deckLoad, 40);
  assert.equal(assessment.strategicScore, 5);
  assert.equal(assessment.hardValid, true);
});

test("readiness gaps retain their instructional order and exact domain language", () => {
  const metrics: PlanningAssessmentMetrics = {
    ...completeMetrics(),
    forcePlanningReady: false,
    allCoverage: new Set<Warfare>(),
    forcePoints: 105,
    aviationFit: { deficit: 2, totalCapacity: 0, supportedAircraft: 0, totalAircraft: 0 },
    armamentFit: { deficit: 3, totalSelected: 0 },
    escorts: 0,
    airDefenseShips: 0,
    aswAssets: 0,
    uncrewedAircraft: 0,
    missionAircraftSelected: 0,
    missionAircraftCredited: 0,
    missionArmamentsSelected: 0,
    missionArmamentsCredited: 0,
  };
  const result = evaluatePlanningReadiness({
    scenario: scenario(),
    selections: {
      selectedWarfare: ["surface-operations"],
      selectedEndState: "",
      selectedLens: "",
      selectedPartnerLens: "",
      selectedGuardrail: "",
    },
    metrics,
    difficulty: "standard",
    forceAdaptation: {
      score: 10,
      label: "Open-water reach force",
      gaps: ["Increase the share of ocean-endurance platforms."],
    },
  });

  assert.deepEqual(result.readinessGaps, [
    "Identify Air defence, Anti-submarine operations.",
    "Remove unsupported classifications: Surface operations.",
    "Add connected capability for Air defence, Anti-submarine operations.",
    "Remove 5.0 mission-credited points.",
    "Provide compatible deck space for 2 aircraft.",
    "Provide compatible host slots for 3 mission packs.",
    "Embark at least one compatible aircraft.",
    "Select at least one compatible mission pack.",
    "Add 2 screening vessels.",
    "Add 2 area-defence value.",
    "Add 2 undersea-search value.",
    "Add 2 uncrewed aircraft.",
    "Reconsider the political objective and desired end state.",
    "Choose a primary theory suited to this scenario.",
    "Choose a distinct complementary or challenging theory.",
    "Include one maritime theory in the comparison.",
    "Choose the guardrail implied by the political aim.",
    "Open-water reach force: Increase the share of ocean-endurance platforms.",
  ]);
  assert.equal(result.fullyReady, false);
});

test("difficulty thresholds alone decide whether an otherwise valid plan is fully ready", () => {
  assert.equal(adaptationThresholdForDifficulty("guided"), 50);
  assert.equal(adaptationThresholdForDifficulty("standard"), 65);
  assert.equal(adaptationThresholdForDifficulty("challenge"), 75);

  const input = {
    scenario: scenario(),
    selections: alignedSelections(),
    metrics: completeMetrics(),
    forceAdaptation: { score: 65, label: "Open-water reach force", gaps: [] },
  };
  assert.equal(evaluatePlanningReadiness({ ...input, difficulty: "guided" }).fullyReady, true);
  assert.equal(evaluatePlanningReadiness({ ...input, difficulty: "standard" }).fullyReady, true);
  assert.equal(evaluatePlanningReadiness({ ...input, difficulty: "challenge" }).fullyReady, false);
});

test("one maritime lens is required even when both selected theories otherwise fit", () => {
  const localScenario: Scenario = { ...scenario(), lenses: ["sun-tzu", "clausewitz"] };
  const assessment = evaluatePlanningAssessment({
    scenario: localScenario,
    selections: {
      ...alignedSelections(),
      selectedLens: "sun-tzu",
      selectedPartnerLens: "clausewitz",
    },
    metrics: completeMetrics(),
  });

  assert.equal(assessment.lensAligned, true);
  assert.equal(assessment.partnerLensValid, true);
  assert.equal(assessment.includesNavalTheory, false);
  assert.equal(assessment.strategicScore, 4);
  assert.equal(assessment.strategyScore, 20);
  assert.equal(assessment.hardValid, false);
});
