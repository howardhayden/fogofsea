import type { ForceAdaptation } from "./forceAdaptation";
import {
  evaluateWarfareIdentification,
  type Difficulty,
  type EndState,
  type Guardrail,
  type Scenario,
  type TheoryLens,
  type Warfare,
} from "./gameModel";

const NAVAL_LENS_IDS = new Set<TheoryLens>([
  "mahan",
  "aube",
  "corbett",
  "richmond",
  "wegener",
  "castex",
  "panikkar",
  "gorshkov",
  "liu-huaqing",
  "till",
]);

const WARFARE_LABELS: Record<Warfare, string> = {
  "air-defense": "Air defence",
  "surface-operations": "Surface operations",
  "undersea-operations": "Anti-submarine operations",
  "land-attack": "Land attack",
  "electromagnetic-operations": "Electromagnetic operations",
  reconnaissance: "Intelligence and reconnaissance",
  "mine-countermeasures": "Mine countermeasures",
  "missile-defense": "Missile defence",
  "maritime-interdiction": "Maritime interception and safeguarding",
};

export type PlanningSelections = {
  selectedWarfare: Warfare[];
  selectedEndState: EndState | "";
  selectedLens: TheoryLens | "";
  selectedPartnerLens: TheoryLens | "";
  selectedGuardrail: Guardrail | "";
};

export type PlanningAssessmentMetrics = {
  forcePlanningReady: boolean;
  allCoverage: ReadonlySet<Warfare>;
  forcePoints: number;
  aviationFit: {
    deficit: number;
    totalCapacity: number;
    supportedAircraft: number;
    totalAircraft: number;
  };
  armamentFit: {
    deficit: number;
    totalSelected: number;
  };
  escorts: number;
  airDefenseShips: number;
  aswAssets: number;
  uncrewedAircraft: number;
  missionAircraftSelected: number;
  missionAircraftCredited: number;
  missionArmamentsSelected: number;
  missionArmamentsCredited: number;
};

export type PlanningAssessment = {
  missedIdentification: Warfare[];
  falseIdentification: Warfare[];
  missingCoverage: Warfare[];
  overBudget: number;
  capacityOverflow: number;
  armamentOverflow: number;
  noCompatibleDeck: boolean;
  escortGap: number;
  defenseGap: number;
  aswGap: number;
  uncrewedGap: number;
  deckLoad: number;
  score: number;
  hardValid: boolean;
  endStateAligned: boolean;
  lensAligned: boolean;
  partnerLensValid: boolean;
  includesNavalTheory: boolean;
  guardrailAligned: boolean;
  strategicScore: number;
  missionScore: number;
  coverageScore: number;
  forceScore: number;
  compatibilityScore: number;
  strategyScore: number;
};

export type PlanningReadiness = {
  assessment: PlanningAssessment;
  readinessGaps: string[];
  adaptationThreshold: number;
  fullyReady: boolean;
};

export type PlanningAssessmentInput = {
  scenario: Scenario;
  selections: PlanningSelections;
  metrics: PlanningAssessmentMetrics;
};

export type PlanningReadinessInput = PlanningAssessmentInput & {
  difficulty: Difficulty;
  forceAdaptation: Pick<ForceAdaptation, "score" | "label" | "gaps">;
};

export function adaptationThresholdForDifficulty(difficulty: Difficulty) {
  return difficulty === "challenge" ? 75 : difficulty === "standard" ? 65 : 50;
}

export function formatWarfareAreas(areas: readonly Warfare[]) {
  return areas.map((area) => WARFARE_LABELS[area]).join(", ");
}

export function evaluatePlanningAssessment({
  scenario,
  selections,
  metrics,
}: PlanningAssessmentInput): PlanningAssessment {
  const {
    selectedWarfare,
    selectedEndState,
    selectedLens,
    selectedPartnerLens,
    selectedGuardrail,
  } = selections;
  const identification = evaluateWarfareIdentification(scenario.required, scenario.recommended, selectedWarfare);
  const missedIdentification = identification.missed;
  const falseIdentification = identification.unsupported;
  const missingCoverage = scenario.required.filter((area) => !metrics.allCoverage.has(area));
  const overBudget = Math.max(0, metrics.forcePoints - scenario.budget);
  const capacityOverflow = metrics.aviationFit.deficit;
  const armamentOverflow = metrics.armamentFit.deficit;
  const noCompatibleDeck = capacityOverflow > 0;
  const escortGap = Math.max(0, scenario.minimumEscort - metrics.escorts);
  const defenseGap = Math.max(0, scenario.minimumAirDefense - metrics.airDefenseShips);
  const aswGap = Math.max(0, scenario.minimumAsw - metrics.aswAssets);
  const uncrewedGap = Math.max(0, scenario.minimumUncrewed - metrics.uncrewedAircraft);
  const endStateAligned = selectedEndState === scenario.endState;
  const lensAligned = selectedLens !== "" && scenario.lenses.includes(selectedLens);
  const partnerLensValid = selectedPartnerLens !== ""
    && selectedPartnerLens !== selectedLens
    && scenario.lenses.includes(selectedPartnerLens);
  const includesNavalTheory = (selectedLens !== "" && NAVAL_LENS_IDS.has(selectedLens))
    || (selectedPartnerLens !== "" && NAVAL_LENS_IDS.has(selectedPartnerLens));
  const guardrailAligned = selectedGuardrail === scenario.guardrail;
  const strategicScore = [
    endStateAligned,
    lensAligned,
    partnerLensValid,
    includesNavalTheory,
    guardrailAligned,
  ].filter(Boolean).length;
  const deckLoad = metrics.aviationFit.totalCapacity > 0
    ? Math.round((metrics.aviationFit.supportedAircraft / metrics.aviationFit.totalCapacity) * 100)
    : 0;
  const classificationRatio = scenario.required.length
    ? (scenario.required.length - missedIdentification.length) / scenario.required.length
    : 0;
  const coverageRatio = scenario.required.length
    ? (scenario.required.length - missingCoverage.length) / scenario.required.length
    : 0;
  const missionScore = Math.max(0, Math.round(15 * classificationRatio) - falseIdentification.length * 2);
  const coverageScore = metrics.forcePlanningReady ? Math.round(20 * coverageRatio) : 0;
  const forceCriteria = [
    metrics.forcePoints > 0 && overBudget === 0,
    escortGap === 0,
    defenseGap === 0,
    aswGap === 0,
    uncrewedGap === 0,
  ];
  const forceScore = metrics.forcePlanningReady ? forceCriteria.filter(Boolean).length * 4 : 0;
  const aviationRatio = metrics.missionAircraftSelected > 0
    ? metrics.missionAircraftCredited / metrics.missionAircraftSelected
    : 0;
  const armamentRatio = metrics.missionArmamentsSelected > 0
    ? metrics.missionArmamentsCredited / metrics.missionArmamentsSelected
    : 0;
  const compatibilityScore = metrics.forcePlanningReady
    ? Math.round(10 * aviationRatio + 10 * armamentRatio)
    : 0;
  const strategyScore = strategicScore * 5;
  const score = Math.max(
    0,
    Math.min(100, missionScore + coverageScore + forceScore + compatibilityScore + strategyScore),
  );
  const hardValid = metrics.forcePlanningReady
    && missedIdentification.length === 0
    && falseIdentification.length === 0
    && missingCoverage.length === 0
    && overBudget === 0
    && capacityOverflow === 0
    && armamentOverflow === 0
    && metrics.aviationFit.totalAircraft > 0
    && metrics.armamentFit.totalSelected > 0
    && escortGap === 0
    && defenseGap === 0
    && aswGap === 0
    && uncrewedGap === 0
    && strategicScore === 5;

  return {
    missedIdentification,
    falseIdentification,
    missingCoverage,
    overBudget,
    capacityOverflow,
    armamentOverflow,
    noCompatibleDeck,
    escortGap,
    defenseGap,
    aswGap,
    uncrewedGap,
    deckLoad,
    score,
    hardValid,
    endStateAligned,
    lensAligned,
    partnerLensValid,
    includesNavalTheory,
    guardrailAligned,
    strategicScore,
    missionScore,
    coverageScore,
    forceScore,
    compatibilityScore,
    strategyScore,
  };
}

export function deriveReadinessGaps({
  assessment,
  metrics,
  forceAdaptation,
  adaptationThreshold,
}: {
  assessment: PlanningAssessment;
  metrics: PlanningAssessmentMetrics;
  forceAdaptation: Pick<ForceAdaptation, "score" | "label" | "gaps">;
  adaptationThreshold: number;
}) {
  const gaps: string[] = [];
  if (assessment.missedIdentification.length) gaps.push(`Identify ${formatWarfareAreas(assessment.missedIdentification)}.`);
  if (assessment.falseIdentification.length) gaps.push(`Remove unsupported classifications: ${formatWarfareAreas(assessment.falseIdentification)}.`);
  if (assessment.missingCoverage.length) gaps.push(`Add connected capability for ${formatWarfareAreas(assessment.missingCoverage)}.`);
  if (assessment.overBudget > 0) gaps.push(`Remove ${assessment.overBudget.toFixed(1)} mission-credited points.`);
  if (assessment.capacityOverflow > 0) gaps.push(`Provide compatible deck space for ${assessment.capacityOverflow} aircraft.`);
  if (assessment.armamentOverflow > 0) gaps.push(`Provide compatible host slots for ${assessment.armamentOverflow} mission packs.`);
  if (metrics.aviationFit.totalAircraft <= 0) gaps.push("Embark at least one compatible aircraft.");
  if (metrics.armamentFit.totalSelected <= 0) gaps.push("Select at least one compatible mission pack.");
  if (assessment.escortGap) gaps.push(`Add ${assessment.escortGap} screening vessel${assessment.escortGap === 1 ? "" : "s"}.`);
  if (assessment.defenseGap) gaps.push(`Add ${assessment.defenseGap} area-defence value.`);
  if (assessment.aswGap) gaps.push(`Add ${assessment.aswGap} undersea-search value.`);
  if (assessment.uncrewedGap) gaps.push(`Add ${assessment.uncrewedGap} uncrewed aircraft.`);
  if (!assessment.endStateAligned) gaps.push("Reconsider the political objective and desired end state.");
  if (!assessment.lensAligned) gaps.push("Choose a primary theory suited to this scenario.");
  if (!assessment.partnerLensValid) gaps.push("Choose a distinct complementary or challenging theory.");
  if (!assessment.includesNavalTheory) gaps.push("Include one maritime theory in the comparison.");
  if (!assessment.guardrailAligned) gaps.push("Choose the guardrail implied by the political aim.");
  if (forceAdaptation.score < adaptationThreshold) {
    gaps.push(`${forceAdaptation.label}: ${forceAdaptation.gaps[0] || "Improve the force's fit to this operating environment."}`);
  }
  return gaps;
}

export function evaluatePlanningReadiness(input: PlanningReadinessInput): PlanningReadiness {
  const assessment = evaluatePlanningAssessment(input);
  const adaptationThreshold = adaptationThresholdForDifficulty(input.difficulty);
  const readinessGaps = deriveReadinessGaps({
    assessment,
    metrics: input.metrics,
    forceAdaptation: input.forceAdaptation,
    adaptationThreshold,
  });
  return {
    assessment,
    readinessGaps,
    adaptationThreshold,
    fullyReady: assessment.hardValid && input.forceAdaptation.score >= adaptationThreshold,
  };
}
