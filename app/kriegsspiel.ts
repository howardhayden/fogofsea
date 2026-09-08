import type { Climate, Clouds, Difficulty, EndState, Guardrail, Precipitation, Season, SoundProfile, TheoryLens, TimeOfDay, Warfare } from "./gameModel";
import {
  deriveOperationalStrategy,
  underseaDoctrineFit,
  uncrewedDoctrineFit,
  UNDERSEA_DOCTRINE_OPTIONS,
  UNCREWED_DOCTRINE_OPTIONS,
  type UnderseaDoctrine,
  type UncrewedDoctrine,
} from "./operationalStrategy";
import {
  assessRiskEffects,
  COORDINATION_OPTIONS,
  isCoordinationMode,
  isRiskTreatment,
  isStrategicForcePolicy,
  RISK_TREATMENT_OPTIONS,
  STRATEGIC_FORCE_OPTIONS,
  type CoordinationMode,
  type RiskTreatment,
  type StrategicForcePolicy,
} from "./riskStrategy";
import {
  activateMatrixForDifficulty,
  activeCapabilityFactors,
  estimateResolutionMatrix,
  isActivatedScenarioMatrix,
  isResolutionMatrix,
  isResolutionMatrixInput,
  type ActivatedScenarioMatrix,
  type CapabilityDomain,
  type MatrixResult,
  type ResolutionMatrix,
  type ResolutionMatrixInput,
  type ScenarioMatrix,
  type SecondaryObjective,
} from "./scenarioMatrix";
import { isBoundedCleanText, isSafeIdentifier } from "./inputSecurity";
import { jsonSemanticEqual } from "./jsonSemantic";
import { latticeCopy, latticeLearningCopy } from "./latticeCopy";

export type { Difficulty } from "./gameModel";

export type FormationOrder = "concentrated-screen" | "distributed-barrier" | "protected-column";
export type SensorOrder = "emission-control" | "passive-search" | "cooperative-fusion" | "active-sweep";
export type TempoOrder = "hold" | "measured-advance" | "high-speed-dash" | "withdraw";
export type EngagementOrder = "avoid" | "shadow" | "contain" | "bounded-effects";

/**
 * A player's deliberately non-authoritative reading of the opposition. These
 * values frame the next order but never modify adjudication. `insufficient-*`
 * values let the player record that the public evidence does not support a
 * narrower judgment instead of forcing false certainty.
 */
export type AdversaryIntentAssumption =
  | "preserve-freedom"
  | "delay-objective"
  | "degrade-screen"
  | "deny-classification"
  | "raise-political-cost"
  | "insufficient-evidence";

export type ObservedPatternAssumption =
  | "probing-screen"
  | "masking-main-movement"
  | "concentrating-pressure"
  | "dispersing-after-effects"
  | "holding-contested-position"
  | "insufficient-evidence";

export type AdversaryNextActionAssumption =
  | "probe-screen"
  | "contest-sensors"
  | "concentrate-pressure"
  | "mask-movement"
  | "disengage-preserve"
  | "exploit-disruption"
  | "insufficient-evidence";

export type RigidAdversaryAssessment = {
  intent?: AdversaryIntentAssumption;
  observedPattern?: ObservedPatternAssumption;
  nextAction?: AdversaryNextActionAssumption;
};

export type RigidObservationDomain = "air" | "surface" | "subsurface";

/** Typed model truth. Public certainty is derived separately and never stored. */
export type RigidAdversaryActionCode =
  | "apply-pressure"
  | "probe-screen"
  | "contest-sensors"
  | "mask-movement"
  | "disperse-and-preserve"
  | "hold-and-preserve"
  | "exploit-disruption";

export type RigidAdversaryAction = {
  id: string;
  occurredTurn: number;
  subject: "opposition";
  action: RigidAdversaryActionCode;
  domains: RigidObservationDomain[];
};

export type RigidInfliction = {
  id: string;
  occurredTurn: number;
  sourceSide: "selected-force" | "opposing-force";
  targetSide: "selected-force" | "opposing-force";
  effect: "integrity" | "cohesion";
  amount: number;
  domains: RigidObservationDomain[];
};

export type RigidOrders = {
  formation: FormationOrder;
  sensors: SensorOrder;
  tempo: TempoOrder;
  engagement: EngagementOrder;
  task: Warfare;
  /** Optional only for migration of earlier local saves; new commands always set it. */
  uncrewed?: UncrewedDoctrine;
  /** Optional only for migration of earlier local saves; new commands always set it. */
  undersea?: UnderseaDoctrine;
  /** Optional only for migration of earlier local saves. */
  riskTreatment?: RiskTreatment;
  /** Optional only for migration of earlier local saves. */
  coordination?: CoordinationMode;
  /** Optional only for migration of earlier local saves. */
  strategicPolicy?: StrategicForcePolicy;
  /** Pending values may be partial; resolved turns 2–6 record all fields. */
  adversaryAssessment?: RigidAdversaryAssessment;
};

export type RigidReadiness = {
  planningScore: number;
  missionReady: boolean;
  requiredCoverage: number;
  requiredCount: number;
  forcePoints: number;
  escortValue: number;
  airDefenseValue: number;
  underseaValue: number;
  uncrewedCount: number;
  uncrewedAirCount?: number;
  uncrewedSurfaceCount?: number;
  uncrewedUnderseaCount?: number;
  submarineCount?: number;
  supportedAircraftCount: number;
  compatibleArmamentCount: number;
  maxReachNm: number;
  trackCapacity: number;
  trackingMethods: string[];
  lowSignatureCount: number;
  selectedUnitCount: number;
  /** Missing in older in-memory integrations and therefore treated as fully adapted. */
  adaptationScore?: number;
  adaptationLabel?: string;
  adaptationEvidence?: string;
  adaptationGaps?: string[];
  /** Credited selections used only to name transparent disruption impacts. */
  forceManifest?: RigidForceManifestEntry[];
};

export type RigidForceManifestEntry = {
  id: string;
  label: string;
  domain: Exclude<CapabilityDomain, "communications">;
  quantity: number;
  capabilities: string[];
};

export type RigidAssetImpact = {
  id: string;
  disruptionId: string;
  side: "selected-force" | "opposing-force";
  domain: CapabilityDomain;
  label: string;
  quantity: number;
  status: "downed" | "disabled" | "degraded" | "diverted" | "unavailable";
  unavailableThroughTurn?: number;
  capabilitiesUnavailable: string[];
  knowledge: "confirmed" | "assessed" | "concealed";
};

export type RigidScenario = {
  id: number;
  /** Missing on earlier saves and therefore interpreted as standard. */
  difficulty?: Difficulty;
  climate: Climate;
  regionId?: string;
  season?: Season;
  soundProfile?: SoundProfile;
  storming?: boolean;
  endState?: EndState;
  time: TimeOfDay;
  clouds: Clouds;
  precipitation: Precipitation;
  seaState: number;
  visibility: number;
  required: Warfare[];
  recommended: Warfare[];
  guardrail: Guardrail;
  minimumEscort: number;
  minimumAirDefense: number;
  minimumAsw: number;
  minimumUncrewed: number;
  adversaryCount?: number;
  selectedLens?: TheoryLens;
  matrix?: ScenarioMatrix;
};

export type RigidTurnDelta = {
  rangeNm: number;
  contactQuality: number;
  readiness: number;
  integrity: number;
  supply: number;
  escalation: number;
  objectiveProgress: number;
  opposingCohesion: number;
  secondaryObjectiveProgress?: number;
};

/**
 * Machine-readable reasons that a resolved turn did not fit the tracked
 * command constraints. Presentation copy must never be parsed to recover
 * these facts.
 */
export type RigidTurnDiagnosticCode =
  | "task-mismatch"
  | "reach-gap"
  | "contact-gap"
  | "employment-mismatch";

export type RigidTurnReport = {
  turn: number;
  orders: RigidOrders;
  phase: string;
  contactReport: string;
  umpireNotes: string[];
  delta: RigidTurnDelta;
  /** Inputs committed before resolution; required by new compound saves. */
  matrixInput?: ResolutionMatrixInput;
  matrixResolution?: ResolutionMatrix;
  activeDisruptionIds?: string[];
  /** Missing only on saves produced before typed turn diagnostics existed. */
  diagnosticCodes?: RigidTurnDiagnosticCode[];
  /** Required by v2 states; absent only on imported v1 transcripts. */
  adversaryActions?: RigidAdversaryAction[];
  /** Required by v2 states; absent only on imported v1 transcripts. */
  inflictions?: RigidInfliction[];
  /** Credited observation domains for this turn; required by v2 states. */
  observationDomains?: RigidObservationDomain[];
};

export type RigidScoreBreakdown = {
  objective: number;
  opposingDisruption: number;
  forceIntegrity: number;
  commandReadiness: number;
  supply: number;
  contactQuality: number;
  escalationDiscipline: number;
  planning: number;
  total: number;
  victoryThreshold: number;
  objectiveThreshold: number;
  integrityThreshold: number;
  supplyThreshold: number;
  escalationLimit: number;
};

export type RigidFindingCode =
  | "planning-gap"
  | "force-mismatch"
  | "operational-mismatch"
  | "task-mismatch"
  | "reach-gap"
  | "contact-gap"
  | "integrity-collapse"
  | "supply-exhaustion"
  | "guardrail-breach"
  | "objective-gap";

export type RigidFindingModuleId =
  | "strategy-grammar"
  | "wargaming"
  | "jomini"
  | "maritime-schools"
  | "maritime-uncrewed"
  | "undersea-campaigns"
  | "global-seapower"
  | "clausewitz"
  | "corbett"
  | "synthesis";

export type RigidDiagnosticFinding = {
  code: RigidFindingCode;
  cause: string;
  evidence: string;
  adjustment: string;
  moduleId: RigidFindingModuleId;
};

export type RigidOutcome = {
  won: boolean;
  score: number;
  title: "DECISIVE VICTORY" | "LIMITED SUCCESS" | "MISSION UNRESOLVED" | "MISSION LOSS";
  difficulty: Difficulty;
  breakdown: RigidScoreBreakdown;
  findings: RigidDiagnosticFinding[];
  notes: string[];
};

export type RigidLearningAssessment = {
  kind: "adjustment" | "uncertainty" | "clear";
  heading: string;
  summary: string;
};

export type RigidGameState = {
  version: 1 | 2;
  phase: "active" | "complete";
  turn: number;
  maxTurns: 6;
  rangeNm: number;
  contactQuality: number;
  readiness: number;
  integrity: number;
  supply: number;
  escalation: number;
  objectiveProgress: number;
  opposingCohesion: number;
  matrix?: ActivatedScenarioMatrix;
  disruptionImpacts?: RigidAssetImpact[];
  secondaryObjectiveProgress?: number;
  reports: RigidTurnReport[];
  outcome: RigidOutcome | null;
};

export const FORMATION_OPTIONS: ReadonlyArray<{ value: FormationOrder; label: string; note: string }> = [
  { value: "concentrated-screen", label: "Concentrated screen", note: "Mutual protection and concentrated defensive power; less geographic coverage." },
  { value: "distributed-barrier", label: "Distributed barrier", note: "Wider sensing and access control; greater exposure if contact quality is poor." },
  { value: "protected-column", label: "Protected column", note: "Preserves a convoy or high-value unit; advances more slowly." },
];

export const SENSOR_OPTIONS: ReadonlyArray<{ value: SensorOrder; label: string; note: string }> = [
  { value: "emission-control", label: "Emission control", note: "Protects signatures but yields only slow contact improvement." },
  { value: "passive-search", label: "Passive search", note: "Builds a picture without announcing a broad active search." },
  { value: "cooperative-fusion", label: "Cooperative fusion", note: "Combines compatible tracks and relays across the force." },
  { value: "active-sweep", label: "Active sweep", note: "Fastest contact gain, with greater counter-detection and escalation exposure." },
];

export const TEMPO_OPTIONS: ReadonlyArray<{ value: TempoOrder; label: string; note: string }> = [
  { value: "hold", label: "Hold and clarify", note: "Conserves supply while improving local organization." },
  { value: "measured-advance", label: "Measured advance", note: "Balances closing distance, formation, and identification." },
  { value: "high-speed-dash", label: "High-speed dash", note: "Closes quickly but consumes supply and disrupts sensing." },
  { value: "withdraw", label: "Withdraw and preserve", note: "Opens range, lowers escalation, and protects the remaining force." },
];

export const ENGAGEMENT_OPTIONS: ReadonlyArray<{ value: EngagementOrder; label: string; note: string }> = [
  { value: "avoid", label: "Avoid contact", note: "Preserves the force but produces little direct objective pressure." },
  { value: "shadow", label: "Shadow and attribute", note: "Improves identification and preserves decision space." },
  { value: "contain", label: "Contain", note: "Uses position and credible coverage to limit opposing freedom." },
  { value: "bounded-effects", label: "Bounded effects", note: "Applies compatible notional effects only against an adequate track." },
];

export { COORDINATION_OPTIONS, RISK_TREATMENT_OPTIONS, STRATEGIC_FORCE_OPTIONS, UNDERSEA_DOCTRINE_OPTIONS, UNCREWED_DOCTRINE_OPTIONS };

export const DEFAULT_RIGID_ORDERS: RigidOrders = {
  formation: "concentrated-screen",
  sensors: "passive-search",
  tempo: "hold",
  engagement: "shadow",
  task: "reconnaissance",
  uncrewed: "distributed-scouting",
  undersea: "independent-patrol",
  riskTreatment: "prepare",
  coordination: "federated",
  strategicPolicy: "conventional-restraint",
};

export const ADVERSARY_INTENT_ASSUMPTIONS: readonly AdversaryIntentAssumption[] = [
  "preserve-freedom",
  "delay-objective",
  "degrade-screen",
  "deny-classification",
  "raise-political-cost",
  "insufficient-evidence",
];

export const OBSERVED_PATTERN_ASSUMPTIONS: readonly ObservedPatternAssumption[] = [
  "probing-screen",
  "masking-main-movement",
  "concentrating-pressure",
  "dispersing-after-effects",
  "holding-contested-position",
  "insufficient-evidence",
];

export const ADVERSARY_NEXT_ACTION_ASSUMPTIONS: readonly AdversaryNextActionAssumption[] = [
  "probe-screen",
  "contest-sensors",
  "concentrate-pressure",
  "mask-movement",
  "disengage-preserve",
  "exploit-disruption",
  "insufficient-evidence",
];

export const UNRESOLVED_ADVERSARY_ASSESSMENT: Readonly<Required<RigidAdversaryAssessment>> = {
  intent: "insufficient-evidence",
  observedPattern: "insufficient-evidence",
  nextAction: "insufficient-evidence",
};

export type RigidAdversaryAssessmentCandidates = {
  intent: AdversaryIntentAssumption[];
  observedPattern: ObservedPatternAssumption[];
  nextAction: AdversaryNextActionAssumption[];
};

function appendUniqueAssumption<T extends string>(values: T[], value: T) {
  if (!values.includes(value)) values.push(value);
}

function boundedAssumptionCandidates<T extends string>(values: T[], insufficient: T) {
  return [...values.filter((value) => value !== insufficient).slice(0, 2), insufficient];
}

/**
 * Candidate codes are derived only from player-visible state and disclosed
 * turn effects. Hidden actions, matrix commitments, and actor count are not
 * inputs. Keeping this predicate in the rigid domain lets live resolution and
 * canonical replay enforce the same historical choice set.
 */
export function rigidAdversaryAssessmentCandidates(
  state: RigidGameState,
): RigidAdversaryAssessmentCandidates {
  const latest = state.reports.at(-1);
  const intent: AdversaryIntentAssumption[] = [];
  if (state.contactQuality < 65) appendUniqueAssumption(intent, "deny-classification");
  if (state.objectiveProgress < 75) appendUniqueAssumption(intent, "delay-objective");
  if ((latest?.inflictions ?? []).some((entry) => entry.targetSide === "selected-force")) {
    appendUniqueAssumption(intent, "degrade-screen");
  }
  if (state.escalation > 35) appendUniqueAssumption(intent, "raise-political-cost");

  const observedPattern: ObservedPatternAssumption[] = [];
  if ((latest?.inflictions ?? []).some((entry) => entry.targetSide === "selected-force")) {
    appendUniqueAssumption(observedPattern, "concentrating-pressure");
  }
  if ((latest?.inflictions ?? []).some((entry) => entry.targetSide === "opposing-force")) {
    appendUniqueAssumption(observedPattern, "dispersing-after-effects");
  }
  if ((latest?.delta.contactQuality ?? 0) > 0) appendUniqueAssumption(observedPattern, "probing-screen");
  if (state.contactQuality < 40 || (latest?.delta.contactQuality ?? 0) < 0) {
    appendUniqueAssumption(observedPattern, "masking-main-movement");
  }

  const nextAction: AdversaryNextActionAssumption[] = [];
  if ((latest?.inflictions ?? []).some((entry) => entry.targetSide === "selected-force")) {
    appendUniqueAssumption(nextAction, "concentrate-pressure");
  }
  if (state.contactQuality < 65) appendUniqueAssumption(nextAction, "contest-sensors");
  if ((latest?.inflictions ?? []).some((entry) => entry.targetSide === "opposing-force")) {
    appendUniqueAssumption(nextAction, "disengage-preserve");
  }
  if ((latest?.delta.contactQuality ?? 0) > 0) appendUniqueAssumption(nextAction, "mask-movement");

  return {
    intent: boundedAssumptionCandidates(intent, "insufficient-evidence"),
    observedPattern: boundedAssumptionCandidates(observedPattern, "insufficient-evidence"),
    nextAction: boundedAssumptionCandidates(nextAction, "insufficient-evidence"),
  };
}

export function isReasonableRigidAdversaryAssessment(
  state: RigidGameState,
  assessment: RigidAdversaryAssessment | undefined,
): assessment is Required<RigidAdversaryAssessment> {
  if (!isCompleteAdversaryAssessment(assessment)) return false;
  const candidates = rigidAdversaryAssessmentCandidates(state);
  return candidates.intent.includes(assessment.intent)
    && candidates.observedPattern.includes(assessment.observedPattern)
    && candidates.nextAction.includes(assessment.nextAction);
}

export function isCompleteAdversaryAssessment(
  value: RigidAdversaryAssessment | undefined,
): value is Required<RigidAdversaryAssessment> {
  return Boolean(value
    && value.intent && ADVERSARY_INTENT_ASSUMPTIONS.includes(value.intent)
    && value.observedPattern && OBSERVED_PATTERN_ASSUMPTIONS.includes(value.observedPattern)
    && value.nextAction && ADVERSARY_NEXT_ACTION_ASSUMPTIONS.includes(value.nextAction));
}

type DifficultyRules = {
  sensorAdjustment: number;
  initialContactAdjustment: number;
  initialReadinessAdjustment: number;
  initialRangeAdjustment: number;
  opposingPressureMultiplier: number;
  supplyUseMultiplier: number;
  effectMultiplier: number;
  objectiveMultiplier: number;
  contactThresholdAdjustment: number;
  escalationLimitAdjustment: number;
  victoryThreshold: number;
  decisiveThreshold: number;
  objectiveThreshold: number;
  secondaryObjectiveThreshold: number;
  integrityThreshold: number;
  supplyThreshold: number;
  adaptationThreshold: number;
};

const DIFFICULTY_RULES: Record<Difficulty, DifficultyRules> = {
  guided: {
    sensorAdjustment: 4,
    initialContactAdjustment: 5,
    initialReadinessAdjustment: 5,
    initialRangeAdjustment: -12,
    opposingPressureMultiplier: 0.82,
    supplyUseMultiplier: 0.88,
    effectMultiplier: 1.12,
    objectiveMultiplier: 1.12,
    contactThresholdAdjustment: -6,
    escalationLimitAdjustment: 6,
    victoryThreshold: 64,
    decisiveThreshold: 84,
    objectiveThreshold: 62,
    secondaryObjectiveThreshold: 25,
    integrityThreshold: 30,
    supplyThreshold: 10,
    adaptationThreshold: 50,
  },
  standard: {
    sensorAdjustment: 0,
    initialContactAdjustment: 0,
    initialReadinessAdjustment: 0,
    initialRangeAdjustment: 0,
    opposingPressureMultiplier: 1,
    supplyUseMultiplier: 1,
    effectMultiplier: 1,
    objectiveMultiplier: 1,
    contactThresholdAdjustment: 0,
    escalationLimitAdjustment: 0,
    victoryThreshold: 70,
    decisiveThreshold: 88,
    objectiveThreshold: 70,
    secondaryObjectiveThreshold: 34,
    integrityThreshold: 35,
    supplyThreshold: 15,
    adaptationThreshold: 65,
  },
  challenge: {
    sensorAdjustment: -3,
    initialContactAdjustment: -4,
    initialReadinessAdjustment: -5,
    initialRangeAdjustment: 12,
    opposingPressureMultiplier: 1.18,
    supplyUseMultiplier: 1.12,
    effectMultiplier: 0.9,
    objectiveMultiplier: 0.9,
    contactThresholdAdjustment: 6,
    escalationLimitAdjustment: -5,
    victoryThreshold: 76,
    decisiveThreshold: 92,
    objectiveThreshold: 76,
    secondaryObjectiveThreshold: 40,
    integrityThreshold: 40,
    supplyThreshold: 20,
    adaptationThreshold: 75,
  },
};

const clamp = (value: number, minimum = 0, maximum = 100) => Math.max(minimum, Math.min(maximum, value));
const rounded = (value: number) => Math.round(value);
const roundedTenth = (value: number) => Math.round(value * 10) / 10;
const hasMethod = (readiness: RigidReadiness, fragment: string) => readiness.trackingMethods.some((method) => method.toLowerCase().includes(fragment));
const scenarioDifficulty = (scenario: RigidScenario): Difficulty => scenario.difficulty ?? "standard";
const difficultyRules = (scenario: RigidScenario) => DIFFICULTY_RULES[scenarioDifficulty(scenario)];
export const secondaryObjectiveThreshold = (difficulty: Difficulty) => DIFFICULTY_RULES[difficulty].secondaryObjectiveThreshold;
const forceAdaptationScore = (readiness: RigidReadiness) => clamp(readiness.adaptationScore ?? 100);

function domainLabel(domain: CapabilityDomain) {
  return {
    surface: "surface elements",
    air: "air elements",
    subsurface: "undersea elements",
    "mission-pack": "mission packs",
    communications: "command-and-sensor network",
  }[domain];
}

function impactStatus(kind: ActivatedScenarioMatrix["activeDisruptions"][number]["kind"], domain: CapabilityDomain, permanent: boolean): RigidAssetImpact["status"] {
  if (permanent && domain === "air") return "downed";
  if (permanent) return "disabled";
  if (kind === "command-interference") return domain === "mission-pack" ? "diverted" : "unavailable";
  return kind === "severe-weather" ? "unavailable" : "degraded";
}

function materializeDisruptionImpacts(matrix: ActivatedScenarioMatrix, readiness: RigidReadiness): RigidAssetImpact[] {
  const manifest = [...(readiness.forceManifest ?? [])].filter((item) => item.quantity > 0).sort((a, b) => a.id.localeCompare(b.id));
  const impacts: RigidAssetImpact[] = [];
  for (const disruption of matrix.activeDisruptions) {
    const temporaryFraction = Math.max(0, 1 - disruption.availabilityMultiplier);
    const permanentFraction = disruption.permanentLossFraction;
    // Coordination and surge events can increase pressure without disabling
    // capacity. Do not manufacture a casualty record for a zero-loss event.
    if (temporaryFraction <= 0 && permanentFraction <= 0) continue;
    for (const domain of disruption.affectedDomains) {
      if (disruption.affectedSide === "selected-force" || disruption.affectedSide === "both") {
        const eligible = manifest.filter((item) => item.domain === domain || domain === "communications");
        if (eligible.length) {
          const totalQuantity = eligible.reduce((sum, item) => sum + item.quantity, 0);
          const labels = eligible.slice(0, 2).map((item) => item.label);
          const label = eligible.length === 1 ? labels[0] : `${domainLabel(domain)} (${labels.join(", ")}${eligible.length > 2 ? ", and others" : ""})`;
          const capabilities = [...new Set(eligible.flatMap((item) => item.capabilities))].slice(0, 4);
          for (const [kind, fraction] of [["temporary", temporaryFraction], ["permanent", permanentFraction]] as const) {
            if (fraction <= 0) continue;
            const permanent = kind === "permanent";
            impacts.push({
              id: `${disruption.id}-selected-${domain}-${kind}`,
              disruptionId: disruption.id,
              side: "selected-force",
              domain,
              label,
              quantity: Math.max(1, Math.min(totalQuantity, Math.ceil(totalQuantity * fraction))),
              status: impactStatus(disruption.kind, domain, permanent),
              ...(permanent ? {} : { unavailableThroughTurn: disruption.endsTurn }),
              capabilitiesUnavailable: capabilities.length ? capabilities : [domainLabel(domain)],
              knowledge: "confirmed",
            });
          }
        }
      }
      if (disruption.affectedSide === "opposing-force" || disruption.affectedSide === "both") {
        const opposingQuantity = (matrix.estimatedOpposingElements[0] + matrix.estimatedOpposingElements[1]) / 2;
        for (const [kind, fraction] of [["temporary", temporaryFraction], ["permanent", permanentFraction]] as const) {
          if (fraction <= 0) continue;
          const permanent = kind === "permanent";
          impacts.push({
            id: `${disruption.id}-opposing-${domain}-${kind}`,
            disruptionId: disruption.id,
            side: "opposing-force",
            domain,
            label: `assessed opposing ${domainLabel(domain)}`,
            quantity: Math.max(1, Math.ceil(opposingQuantity * fraction)),
            status: impactStatus(disruption.kind, domain, permanent),
            ...(permanent ? {} : { unavailableThroughTurn: disruption.endsTurn }),
            capabilitiesUnavailable: [domainLabel(domain)],
            knowledge: "assessed",
          });
        }
      }
    }
  }
  return impacts;
}

function readinessWithCapabilityFactors(readiness: RigidReadiness, matrix: ActivatedScenarioMatrix | undefined, turn: number) {
  if (!matrix) return { readiness, opposingMultiplier: 1, activeDisruptions: [] as ActivatedScenarioMatrix["activeDisruptions"] };
  const factors = activeCapabilityFactors(matrix, turn);
  const selected = factors.selected;
  const adjusted: RigidReadiness = {
    ...readiness,
    escortValue: readiness.escortValue * selected.surface,
    airDefenseValue: readiness.airDefenseValue * Math.min(selected.surface, selected.air),
    underseaValue: readiness.underseaValue * selected.subsurface,
    uncrewedCount: readiness.uncrewedCount * Math.min(selected.air, selected.surface, selected.subsurface),
    uncrewedAirCount: (readiness.uncrewedAirCount ?? 0) * selected.air,
    uncrewedSurfaceCount: (readiness.uncrewedSurfaceCount ?? 0) * selected.surface,
    uncrewedUnderseaCount: (readiness.uncrewedUnderseaCount ?? 0) * selected.subsurface,
    submarineCount: (readiness.submarineCount ?? 0) * selected.subsurface,
    supportedAircraftCount: readiness.supportedAircraftCount * selected.air,
    compatibleArmamentCount: readiness.compatibleArmamentCount * selected["mission-pack"],
    trackCapacity: readiness.trackCapacity * selected.communications * Math.max(selected.air, selected.surface, selected.subsurface),
  };
  const opposingMultiplier = Object.values(factors.opposing).reduce((sum, value) => sum + value, 0) / 5;
  return { readiness: adjusted, opposingMultiplier, activeDisruptions: factors.active };
}

function matrixResultMultiplier(result: MatrixResult) {
  return result === "success" ? 1.08 : result === "partial" ? 0.97 : 0.85;
}

function opposingScalePressureMultiplier(matrix: ActivatedScenarioMatrix | undefined) {
  if (!matrix) return 1;
  return { tiny: 0.8, small: 0.9, medium: 1, large: 1.08, massive: 1.16 }[matrix.forceScale];
}

export function secondaryObjectiveOrderFit(objective: SecondaryObjective, orders: RigidOrders) {
  const risk = orders.riskTreatment ?? "prepare";
  const coordination = orders.coordination ?? "federated";
  const uncrewed = orders.uncrewed ?? "distributed-scouting";
  const criteria: Record<SecondaryObjective["method"], readonly [boolean, boolean, boolean]> = {
    "recovery-reserve": [risk === "prepare" || risk === "mitigate", orders.tempo === "hold", orders.formation !== "concentrated-screen"],
    "protective-escort": [orders.formation === "protected-column", orders.engagement === "contain" || orders.engagement === "avoid", coordination === "mutual-support" || coordination === "federated"],
    "alternate-route": [orders.formation === "distributed-barrier", orders.tempo === "measured-advance", uncrewed === "distributed-scouting" || uncrewed === "autonomous-lane-control"],
    "evidence-handoff": [orders.sensors === "passive-search" || orders.sensors === "cooperative-fusion", orders.engagement === "shadow" || orders.engagement === "contain", coordination === "federated"],
    "system-accountability": [risk === "recover", orders.tempo === "hold" || orders.tempo === "withdraw", coordination === "mutual-support"],
  };
  const matched = criteria[objective.method].filter(Boolean).length;
  return {
    multiplier: 0.35 + matched * 0.35,
    note: `${objective.label} matched ${matched} of 3 distinct posture conditions for ${objective.method.replaceAll("-", " ")}.`,
  };
}

function engagementContactThreshold(engagement: EngagementOrder, scenario: RigidScenario) {
  const base = engagement === "bounded-effects" ? 58 : engagement === "contain" ? 42 : engagement === "shadow" ? 28 : 90;
  return clamp(base + difficultyRules(scenario).contactThresholdAdjustment);
}

function requiresEffectReach(orders: RigidOrders) {
  return orders.engagement !== "avoid" && orders.tempo !== "withdraw";
}

function environmentalFriction(scenario: RigidScenario) {
  const cloud = { clear: 0, scattered: 1, broken: 3, overcast: 5 }[scenario.clouds];
  const precipitation = scenario.precipitation === "none" ? 0 : 4;
  const night = scenario.time === "night" ? 2 : scenario.time === "dawn" || scenario.time === "dusk" ? 1 : 0;
  const polar = scenario.climate === "ocean" ? 0 : 1;
  return cloud + precipitation + night + polar + Math.max(0, scenario.seaState - 2);
}

function sensorGain(orders: RigidOrders, readiness: RigidReadiness, scenario: RigidScenario) {
  const base = { "emission-control": 4, "passive-search": 10, "cooperative-fusion": 15, "active-sweep": 19 }[orders.sensors];
  const tracking = Math.min(12, Math.floor(readiness.trackCapacity / 20));
  const methodBonus = orders.sensors === "active-sweep"
    ? (hasMethod(readiness, "radar") || hasMethod(readiness, "active acoustic") ? 5 : -4)
    : orders.sensors === "passive-search" || orders.sensors === "emission-control"
      ? (hasMethod(readiness, "passive") ? 5 : -2)
      : (hasMethod(readiness, "cooperative") ? 6 : -3);
  const visibilityPenalty = orders.sensors === "active-sweep" ? 0 : Math.max(0, 6 - scenario.visibility) / 2;
  const signatureBonus = orders.sensors === "emission-control" ? Math.min(4, readiness.lowSignatureCount) : 0;
  const operational = deriveOperationalStrategy(scenario);
  const uncrewed = orders.uncrewed ?? "distributed-scouting";
  const undersea = orders.undersea ?? "independent-patrol";
  const doctrine = uncrewedDoctrineFit(uncrewed, operational.recommendedUncrewed, readiness.uncrewedCount)
    + underseaDoctrineFit(undersea, operational.recommendedUndersea, (readiness.submarineCount ?? 0) + (readiness.uncrewedUnderseaCount ?? 0));
  const doctrineSensor = uncrewed === "distributed-scouting" ? Math.max(0, doctrine) : undersea === "barrier-ambush" ? Math.max(0, doctrine / 2) : 0;
  return rounded(base + tracking + methodBonus + signatureBonus + doctrineSensor + difficultyRules(scenario).sensorAdjustment - environmentalFriction(scenario) * 0.55 - visibilityPenalty);
}

function creditedTrackingMethodCount(readiness: RigidReadiness) {
  return new Set(readiness.trackingMethods.map((method) => method.trim().toLowerCase()).filter(Boolean)).size;
}

function contactCapabilityCeiling(readiness: RigidReadiness) {
  if (readiness.trackCapacity <= 0) return 19;
  return creditedTrackingMethodCount(readiness) === 0 ? 19 : creditedTrackingMethodCount(readiness) === 1 ? 64 : 100;
}

function defensivePower(readiness: RigidReadiness, scenario: RigidScenario, orders: RigidOrders, contactQuality: number) {
  let value = readiness.escortValue * 3;
  if (scenario.required.some((area) => area === "air-defense" || area === "missile-defense")) value += readiness.airDefenseValue * 5;
  if (scenario.required.includes("undersea-operations")) value += readiness.underseaValue * 5;
  if (scenario.required.includes("maritime-interdiction")) {
    value += Math.min(10, readiness.compatibleArmamentCount * 2);
  }
  value += Math.min(8, readiness.uncrewedCount / 2);
  value += orders.formation === "concentrated-screen" ? 10 : orders.formation === "protected-column" ? 7 : 2;
  value += contactQuality >= 55 ? 7 : contactQuality >= 35 ? 3 : 0;
  if (orders.tempo === "high-speed-dash") value -= 5;
  const operational = deriveOperationalStrategy(scenario);
  const undersea = orders.undersea ?? "independent-patrol";
  const uncrewed = orders.uncrewed ?? "distributed-scouting";
  if (undersea === "protective-screen") value += Math.max(0, underseaDoctrineFit(undersea, operational.recommendedUndersea, (readiness.submarineCount ?? 0) + (readiness.uncrewedUnderseaCount ?? 0)));
  if (uncrewed === "autonomous-lane-control" && operational.recommendedUncrewed === uncrewed) value += Math.min(6, readiness.uncrewedCount);
  return value * (0.82 + forceAdaptationScore(readiness) * 0.0018);
}

function contactDescription(contactQuality: number) {
  if (contactQuality < 20) return "Scattered indications only; identity, number, and intent remain unresolved.";
  if (contactQuality < 40) return "A probable contact pattern is forming, but decoys and neutral activity cannot be separated confidently.";
  if (contactQuality < 65) return "Correlated tracks reveal organized opposition, though exact strength, disposition, and intent remain uncertain.";
  if (contactQuality < 85) return "High-confidence tracks reveal a principal movement and supporting activity; purpose and effects remain assessed rather than confirmed.";
  return "Persistent multi-method custody establishes the opposing movement and its observable actions; unobserved intent still requires judgment.";
}

const AIR_OBSERVATION_METHODS = new Set(["active radar", "passive emitter", "infrared", "cooperative network"]);
const SURFACE_OBSERVATION_METHODS = new Set(["active radar", "passive emitter", "electro-optical", "infrared", "cooperative network"]);
const SUBSURFACE_OBSERVATION_METHODS = new Set(["active acoustic", "passive acoustic", "magnetic anomaly", "bathymetric comparison"]);

function rigidObservationDomains(readiness: RigidReadiness): RigidObservationDomain[] {
  const methods = new Set(readiness.trackingMethods.map((method) => method.toLowerCase()));
  const includesAny = (candidates: ReadonlySet<string>) => [...candidates].some((method) => methods.has(method));
  return [
    ...(includesAny(AIR_OBSERVATION_METHODS) ? ["air" as const] : []),
    ...(includesAny(SURFACE_OBSERVATION_METHODS) ? ["surface" as const] : []),
    ...(includesAny(SUBSURFACE_OBSERVATION_METHODS) ? ["subsurface" as const] : []),
  ];
}

function warfareObservationDomains(task: Warfare): RigidObservationDomain[] {
  if (task === "air-defense" || task === "missile-defense") return ["air"];
  if (task === "undersea-operations") return ["subsurface"];
  if (task === "surface-operations" || task === "maritime-interdiction" || task === "mine-countermeasures") return ["surface"];
  if (task === "land-attack") return ["air", "surface"];
  return ["air", "surface", "subsurface"];
}

function adversaryActionDomains(scenario: RigidScenario): RigidObservationDomain[] {
  const domains = new Set<RigidObservationDomain>();
  for (const area of [...scenario.required, ...scenario.recommended]) {
    for (const domain of warfareObservationDomains(area)) domains.add(domain);
  }
  return domains.size ? [...domains] : ["surface"];
}

function rigidAdversaryAction(input: {
  turn: number;
  currentContact: number;
  nextContact: number;
  integrityLoss: number;
  cohesionLoss: number;
  opposingMethod: ReturnType<typeof deriveOperationalStrategy>["opposingMethod"];
  opposingPosture: ReturnType<typeof deriveOperationalStrategy>["opposingPosture"];
  activeDisruptionCount: number;
  scenario: RigidScenario;
}): RigidAdversaryAction {
  const action: RigidAdversaryActionCode = input.integrityLoss > 0
    ? "apply-pressure"
    : input.activeDisruptionCount > 0 && input.opposingPosture === "offensive"
      ? "exploit-disruption"
      : input.cohesionLoss > 0
        ? "disperse-and-preserve"
        : input.nextContact < input.currentContact
          ? "contest-sensors"
          : input.nextContact < 40
            ? "mask-movement"
            : input.opposingMethod === "fleet-action" && input.opposingPosture === "offensive"
              ? "probe-screen"
              : "hold-and-preserve";
  return {
    id: `opposition-action-turn-${input.turn}`,
    occurredTurn: input.turn,
    subject: "opposition",
    action,
    domains: adversaryActionDomains(input.scenario),
  };
}

function escalationLimit(scenario: RigidScenario) {
  const base = scenario.guardrail === "escalation" || scenario.guardrail === "civilian" || scenario.guardrail === "legitimacy" ? 36 : 55;
  return clamp(base + difficultyRules(scenario).escalationLimitAdjustment);
}

function transcriptPeakEscalation(state: RigidGameState) {
  const initial = clamp(state.escalation - state.reports.reduce((sum, report) => sum + report.delta.escalation, 0));
  let current = initial;
  let peak = initial;
  for (const report of state.reports) {
    current = clamp(current + report.delta.escalation);
    peak = Math.max(peak, current);
  }
  return rounded(peak);
}

function diagnosticFindings(
  state: RigidGameState,
  readiness: RigidReadiness,
  scenario: RigidScenario,
  rules: DifficultyRules,
  limit: number,
  peakEscalation: number,
): RigidDiagnosticFinding[] {
  const findings: RigidDiagnosticFinding[] = [];
  const initialRange = state.rangeNm - state.reports.reduce((sum, report) => sum + report.delta.rangeNm, 0);
  const initialContact = state.contactQuality - state.reports.reduce((sum, report) => sum + report.delta.contactQuality, 0);
  let range = initialRange;
  let contact = initialContact;
  let outOfReachTurns = 0;
  let belowContactTurns = 0;
  let mismatchedTaskTurns = 0;
  let mismatchedUncrewedTurns = 0;
  let unsupportedWolfpackTurns = 0;
  const operational = deriveOperationalStrategy(scenario);
  const underseaElements = (readiness.submarineCount ?? 0) + (readiness.uncrewedUnderseaCount ?? 0);

  for (const report of state.reports) {
    range += report.delta.rangeNm;
    contact += report.delta.contactQuality;
    if (requiresEffectReach(report.orders) && readiness.maxReachNm < range && range > 45) outOfReachTurns += 1;
    if (report.orders.engagement !== "avoid" && contact < engagementContactThreshold(report.orders.engagement, scenario)) belowContactTurns += 1;
    if (!scenario.required.includes(report.orders.task) && !scenario.recommended.includes(report.orders.task)) mismatchedTaskTurns += 1;
    if ((report.orders.uncrewed ?? "distributed-scouting") !== operational.recommendedUncrewed && readiness.uncrewedCount < 4) mismatchedUncrewedTurns += 1;
    if ((report.orders.undersea ?? "independent-patrol") === "coordinated-wolfpack" && underseaElements < 2) unsupportedWolfpackTurns += 1;
  }

  if (!readiness.missionReady) {
    findings.push({
      code: "planning-gap",
      cause: "The force entered command turns without complete mission readiness.",
      evidence: `${readiness.requiredCoverage} of ${readiness.requiredCount} required areas had credited coverage; ${readiness.supportedAircraftCount} aircraft and ${readiness.compatibleArmamentCount} mission packs had compatible support.`,
      adjustment: "Return to planning, close required coverage and host-pairing gaps, then verify the force against every generated minimum.",
      moduleId: "strategy-grammar",
    });
  }
  if (forceAdaptationScore(readiness) < rules.adaptationThreshold) {
    findings.push({
      code: "force-mismatch",
      cause: `The force was not sufficiently adapted to the scenario's operating profile.`,
      evidence: `${readiness.adaptationLabel || "Environment fit"} scored ${forceAdaptationScore(readiness)}/100 against the ${rules.adaptationThreshold}/100 ${scenarioDifficulty(scenario)} threshold. ${readiness.adaptationEvidence || "The model found an unfavorable force mix."}`,
      adjustment: readiness.adaptationGaps?.[0] || "Return to force design and shift the mix toward the scenario's geography, weather, and specialist demands.",
      moduleId: "maritime-schools",
    });
  }
  if (mismatchedTaskTurns > 0) {
    findings.push({
      code: "task-mismatch",
      cause: "One or more assigned tasks did not support the generated problem.",
      evidence: `${mismatchedTaskTurns} of ${state.reports.length} resolved turns used a task outside the required and recommended areas.`,
      adjustment: "Tie each turn's assigned task to a required or supporting area and explain how the sequence advances the same end state.",
      moduleId: "synthesis",
    });
  }
  if (mismatchedUncrewedTurns > 0 || unsupportedWolfpackTurns > 0) {
    findings.push({
      code: "operational-mismatch",
      cause: "The selected uncrewed or undersea employment method assumed capabilities or conditions the force did not provide.",
      evidence: `${mismatchedUncrewedTurns} turn${mismatchedUncrewedTurns === 1 ? "" : "s"} used a weakly supported uncrewed pattern; ${unsupportedWolfpackTurns} turn${unsupportedWolfpackTurns === 1 ? "" : "s"} ordered wolfpack coordination without two available undersea elements.`,
      adjustment: unsupportedWolfpackTurns > 0 ? "Use independent patrol or add a second credited submarine or undersea-systems element before coordinating a wolfpack." : `Align uncrewed employment with ${operational.recommendedUncrewed.replaceAll("-", " ")} or add sufficient compatible nodes and hosts.`,
      moduleId: unsupportedWolfpackTurns > 0 ? "undersea-campaigns" : "maritime-uncrewed",
    });
  }
  if (outOfReachTurns > 0) {
    findings.push({
      code: "reach-gap",
      cause: "The force spent command turns outside every credited effect's reach.",
      evidence: `${outOfReachTurns} of ${state.reports.length} turn-end positions exceeded the force's ${readiness.maxReachNm}-mile invented reach band.`,
      adjustment: "Change position or tempo before selecting a pressure posture, or redesign the force around a compatible longer-reach pairing.",
      moduleId: "jomini",
    });
  }
  if (belowContactTurns > 0) {
    findings.push({
      code: "contact-gap",
      cause: "Contact quality did not support the selected engagement posture.",
      evidence: `${belowContactTurns} of ${state.reports.length} applicable turns ended below that posture's ${scenarioDifficulty(scenario)} contact threshold; final contact quality was ${state.contactQuality}/100.`,
      adjustment: "Build and preserve the contact picture with a compatible sensor policy before escalating the engagement posture.",
      moduleId: "wargaming",
    });
  }
  if (state.integrity < rules.integrityThreshold) {
    findings.push({
      code: "integrity-collapse",
      cause: "Force integrity fell below the difficulty setting's survival threshold.",
      evidence: `Integrity closed at ${state.integrity}/100; ${scenarioDifficulty(scenario)} play requires at least ${rules.integrityThreshold}/100.`,
      adjustment: "Strengthen the screen, improve contact before distributing, or reduce exposed high-tempo movement under pressure.",
      moduleId: "maritime-schools",
    });
  }
  if (state.supply < rules.supplyThreshold) {
    findings.push({
      code: "supply-exhaustion",
      cause: "The command sequence consumed the reserve needed to complete the mission.",
      evidence: `Supply closed at ${state.supply}/100; ${scenarioDifficulty(scenario)} play requires at least ${rules.supplyThreshold}/100.`,
      adjustment: "Alternate costly movement, active sensing, and bounded effects with turns that conserve supply and preserve follow-on capacity.",
      moduleId: "global-seapower",
    });
  }
  if (peakEscalation > limit) {
    findings.push({
      code: "guardrail-breach",
      cause: "The controlling escalation boundary was exceeded.",
      evidence: `Escalation peaked at ${peakEscalation}/100 and closed at ${state.escalation}/100 against a ${limit}/100 ${scenarioDifficulty(scenario)} limit.`,
      adjustment: "Use restraint, withdrawal, emission control, or a more relevant assigned task before pressure exceeds the political guardrail.",
      moduleId: "clausewitz",
    });
  }
  const secondaryThreshold = secondaryObjectiveThreshold(scenarioDifficulty(scenario));
  const secondaryDisclosed = Boolean(
    state.matrix?.activeSecondaryObjective
    && state.matrix.activeSecondaryObjective.revealTurn <= state.turn,
  );
  const secondaryGap = secondaryDisclosed && (state.secondaryObjectiveProgress ?? 0) < secondaryThreshold;
  if (state.objectiveProgress < rules.objectiveThreshold || secondaryGap) {
    findings.push({
      code: "objective-gap",
      cause: "The command sequence did not create enough objective progress.",
      evidence: `Primary objective progress closed at ${state.objectiveProgress}/100 against ${rules.objectiveThreshold}/100.${secondaryDisclosed ? ` The revealed secondary objective closed at ${state.secondaryObjectiveProgress ?? 0}/100 against ${secondaryThreshold}/100.` : ""}`,
      adjustment: "Sequence identification, position, and a relevant pressure posture around the limited degree and duration of control the objective requires.",
      moduleId: "corbett",
    });
  }
  return findings;
}

function finalOutcome(state: RigidGameState, readiness: RigidReadiness, scenario: RigidScenario): RigidOutcome {
  const difficulty = scenarioDifficulty(scenario);
  const rules = difficultyRules(scenario);
  const secondaryRequired = Boolean(
    state.matrix?.activeSecondaryObjective
    && state.matrix.activeSecondaryObjective.revealTurn <= state.turn,
  );
  const secondaryProgress = state.secondaryObjectiveProgress ?? 0;
  const secondaryThreshold = secondaryObjectiveThreshold(difficulty);
  const objective = secondaryRequired
    ? state.objectiveProgress * 0.24 + secondaryProgress * 0.06
    : state.objectiveProgress * 0.3;
  const opposition = (100 - state.opposingCohesion) * 0.15;
  const integrity = state.integrity * 0.15;
  const commandReadiness = state.readiness * 0.1;
  const supply = state.supply * 0.1;
  const contact = state.contactQuality * 0.1;
  const limit = escalationLimit(scenario);
  const peakEscalation = transcriptPeakEscalation(state);
  const escalation = clamp(100 - Math.max(0, peakEscalation - limit) * 4) * 0.05;
  const planning = clamp(readiness.planningScore) * 0.05;
  const score = rounded(clamp(objective + opposition + integrity + commandReadiness + supply + contact + escalation + planning));
  const guardrailHeld = peakEscalation <= limit;
  const won = state.objectiveProgress >= rules.objectiveThreshold
    && (!secondaryRequired || secondaryProgress >= secondaryThreshold)
    && state.integrity >= rules.integrityThreshold
    && state.supply >= rules.supplyThreshold
    && guardrailHeld
    && forceAdaptationScore(readiness) >= rules.adaptationThreshold
    && score >= rules.victoryThreshold;
  const title: RigidOutcome["title"] = won && score >= rules.decisiveThreshold
    ? "DECISIVE VICTORY"
    : won
      ? "LIMITED SUCCESS"
      : score >= rules.victoryThreshold - 10
        ? "MISSION UNRESOLVED"
        : "MISSION LOSS";
  const breakdown: RigidScoreBreakdown = {
    objective: roundedTenth(objective),
    opposingDisruption: roundedTenth(opposition),
    forceIntegrity: roundedTenth(integrity),
    commandReadiness: roundedTenth(commandReadiness),
    supply: roundedTenth(supply),
    contactQuality: roundedTenth(contact),
    escalationDiscipline: roundedTenth(escalation),
    planning: roundedTenth(planning),
    total: score,
    victoryThreshold: rules.victoryThreshold,
    objectiveThreshold: rules.objectiveThreshold,
    integrityThreshold: rules.integrityThreshold,
    supplyThreshold: rules.supplyThreshold,
    escalationLimit: limit,
  };
  const findings = diagnosticFindings(state, readiness, scenario, rules, limit, peakEscalation);
  const notes = [
    `Objective progress closed at ${state.objectiveProgress}/100; force integrity at ${state.integrity}/100; supply at ${state.supply}/100.`,
    secondaryRequired ? `The revealed secondary objective closed at ${secondaryProgress}/100 against a ${secondaryThreshold}/100 threshold.` : "No disclosed secondary objective affected the terminal review.",
    `The final contact picture reached ${state.contactQuality}/100 while assessed opposing cohesion closed at ${state.opposingCohesion}/100.`,
    guardrailHeld
      ? `The controlling escalation boundary held; escalation peaked at ${peakEscalation}/100 and closed at ${state.escalation}/100.`
      : `The controlling escalation boundary was exceeded at a ${peakEscalation}/100 peak before closing at ${state.escalation}/100.`,
    readiness.missionReady ? "The force entered play with complete mission-area coverage and compatible pairings." : "Planning gaps constrained every turn of execution.",
    `${readiness.adaptationLabel || "Environment fit"} scored ${forceAdaptationScore(readiness)}/100 against a ${rules.adaptationThreshold}/100 threshold.`,
    `${difficulty[0].toUpperCase()}${difficulty.slice(1)} play required a score of ${rules.victoryThreshold}, objective progress of ${rules.objectiveThreshold}, integrity of ${rules.integrityThreshold}, and supply of ${rules.supplyThreshold}.`,
    latticeCopy("game.outcome.unscoredWriting"),
  ];
  return { won, score, title, difficulty, breakdown, findings, notes };
}

const TURN_DIAGNOSTIC_NOTE_INDEX: Readonly<Record<RigidTurnDiagnosticCode, number>> = {
  "task-mismatch": 0,
  "reach-gap": 1,
  "contact-gap": 2,
  "employment-mismatch": 3,
};

const TURN_DIAGNOSTIC_FALLBACK: Readonly<Record<RigidTurnDiagnosticCode, string>> = {
  "task-mismatch": "The assigned task did not match a required or recommended warfare area.",
  "reach-gap": "The turn ended outside every compatible selected effect's invented reach band.",
  "contact-gap": "Contact quality ended below the selected engagement posture's threshold.",
  "employment-mismatch": "The selected uncrewed or undersea employment method lacked a required force or environmental condition.",
};

const TURN_DIAGNOSTIC_ADJUSTMENT: Readonly<Record<RigidTurnDiagnosticCode, string>> = {
  "task-mismatch": "Next turn, assign a task from the scenario's required or recommended warfare areas.",
  "reach-gap": "Next turn, close the range or select a posture supported by the force's credited reach.",
  "contact-gap": "Next turn, improve the contact picture or select a posture whose contact threshold is met.",
  "employment-mismatch": "Next turn, select employment methods supported by the available uncrewed and undersea elements.",
};

/** A single post-resolution explanation; never used to preview a turn. */
export function turnLearningNote(report: RigidTurnReport): RigidLearningAssessment {
  const diagnosticCode = report.diagnosticCodes?.[0];
  const correction = diagnosticCode === undefined
    ? undefined
    : report.umpireNotes[TURN_DIAGNOSTIC_NOTE_INDEX[diagnosticCode]];
  if (diagnosticCode) return {
    kind: "adjustment",
    heading: "ADJUST NEXT TURN",
    summary: `${correction || TURN_DIAGNOSTIC_FALLBACK[diagnosticCode]} ${TURN_DIAGNOSTIC_ADJUSTMENT[diagnosticCode]}`,
  };
  if (report.matrixResolution?.ultimate.result === "failure") {
    return {
      kind: "uncertainty",
      ...latticeLearningCopy("game.learning.turn.uncertainty"),
    };
  }
  return {
    kind: "clear",
    ...latticeLearningCopy("game.learning.turn.clear"),
  };
}

/** Separates actionable debrief findings from an adverse result without an obvious rules mistake. */
export function outcomeLearningAssessment(state: RigidGameState): RigidLearningAssessment {
  const outcome = state.outcome;
  if (!outcome) return { kind: "clear", ...latticeLearningCopy("game.learning.outcome.pending") };
  const hasExplicitProblem = outcome.findings.length > 0
    || state.reports.some((report) => (report.diagnosticCodes?.length ?? 0) > 0);
  const adverseUncertainty = state.reports.some((report) => report.matrixResolution?.ultimate.result === "failure");
  if (!outcome.won && !hasExplicitProblem && adverseUncertainty) {
    return {
      kind: "uncertainty",
      ...latticeLearningCopy("game.learning.outcome.uncertainty"),
    };
  }
  if (outcome.findings.length) {
    return {
      kind: "adjustment",
      ...latticeLearningCopy("game.learning.outcome.adjustment"),
    };
  }
  return {
    kind: "clear",
    ...latticeLearningCopy("game.learning.outcome.clear"),
  };
}

type NormalizedRigidOrders = RigidOrders & Required<Pick<RigidOrders,
  "uncrewed" | "undersea" | "riskTreatment" | "coordination" | "strategicPolicy">>;

function normalizedRigidOrders(orders: RigidOrders, turn: number): NormalizedRigidOrders {
  const assessment = turn > 1
    ? isCompleteAdversaryAssessment(orders.adversaryAssessment)
      ? { ...orders.adversaryAssessment }
      : { ...UNRESOLVED_ADVERSARY_ASSESSMENT }
    : undefined;
  return {
    formation: orders.formation,
    sensors: orders.sensors,
    tempo: orders.tempo,
    engagement: orders.engagement,
    task: orders.task,
    uncrewed: orders.uncrewed ?? DEFAULT_RIGID_ORDERS.uncrewed!,
    undersea: orders.undersea ?? DEFAULT_RIGID_ORDERS.undersea!,
    riskTreatment: orders.riskTreatment ?? DEFAULT_RIGID_ORDERS.riskTreatment!,
    coordination: orders.coordination ?? DEFAULT_RIGID_ORDERS.coordination!,
    strategicPolicy: orders.strategicPolicy ?? DEFAULT_RIGID_ORDERS.strategicPolicy!,
    ...(assessment ? { adversaryAssessment: assessment } : {}),
  };
}

export function previewRigidTurnMatrix(
  current: RigidGameState,
  orders: RigidOrders,
  readiness: RigidReadiness,
  scenario: RigidScenario,
): ResolutionMatrix | null {
  const matrixInput = rigidTurnMatrixInput(current, orders, readiness, scenario);
  if (!matrixInput || !current.matrix) return null;
  return estimateResolutionMatrix(current.matrix, matrixInput);
}

function rigidTurnMatrixInput(
  current: RigidGameState,
  orders: RigidOrders,
  readiness: RigidReadiness,
  scenario: RigidScenario,
): ResolutionMatrixInput | null {
  const matrix = current.matrix ?? (scenario.matrix ? activateMatrixForDifficulty(scenario.matrix, scenarioDifficulty(scenario)) : undefined);
  if (!matrix || current.phase !== "active") return null;
  const turn = current.turn + 1;
  const capability = readinessWithCapabilityFactors(readiness, matrix, turn);
  const taskFit = scenario.required.includes(orders.task) ? 84 : scenario.recommended.includes(orders.task) ? 66 : 32;
  const environmentalFit = clamp(92 - environmentalFriction(scenario) * 6 + forceAdaptationScore(capability.readiness) * 0.08);
  const coordinationMode = orders.coordination ?? "federated";
  const coordinationFit = clamp(52
    + (coordinationMode === "centralized" ? 18 : coordinationMode === "federated" ? 14 : coordinationMode === "mutual-support" ? 12 : 3)
    + Math.min(12, capability.readiness.uncrewedCount / 2)
    - Math.max(0, (scenario.adversaryCount ?? 1) - 1) * 5);
  return {
    turn,
    contactQuality: clamp(
      current.contactQuality + sensorGain(orders, capability.readiness, scenario),
      0,
      Math.max(current.contactQuality, contactCapabilityCeiling(capability.readiness)),
    ),
    taskFit,
    environmentFit: environmentalFit,
    coordinationFit,
    sustainment: clamp((current.supply + current.integrity + current.readiness) / 3),
  };
}

export function createInitialRigidState(readiness: RigidReadiness, scenario: RigidScenario): RigidGameState {
  const rules = difficultyRules(scenario);
  const matrix = scenario.matrix ? activateMatrixForDifficulty(scenario.matrix, scenarioDifficulty(scenario)) : undefined;
  const coverageRatio = readiness.requiredCount > 0 ? readiness.requiredCoverage / readiness.requiredCount : 0;
  const initialContact = rounded(clamp(
    8 + coverageRatio * 12 + Math.min(12, readiness.trackCapacity / 30) + rules.initialContactAdjustment - environmentalFriction(scenario) * 0.45,
    0,
    contactCapabilityCeiling(readiness),
  ));
  return {
    version: 2,
    phase: "active",
    turn: 0,
    maxTurns: 6,
    rangeNm: rounded(clamp(150 + scenario.seaState * 6 + scenario.required.length * 8 + rules.initialRangeAdjustment, 18, 280)),
    contactQuality: initialContact,
    readiness: rounded(clamp((readiness.missionReady ? 92 : 64) + rules.initialReadinessAdjustment + (forceAdaptationScore(readiness) - 70) * 0.12)),
    integrity: 100,
    supply: 100,
    escalation: 0,
    objectiveProgress: 0,
    opposingCohesion: 100,
    ...(matrix ? {
      matrix,
      disruptionImpacts: materializeDisruptionImpacts(matrix, readiness),
      ...(matrix.activeSecondaryObjective ? { secondaryObjectiveProgress: 0 } : {}),
    } : {}),
    reports: [],
    outcome: null,
  };
}

export function resolveRigidTurn(current: RigidGameState, orders: RigidOrders, readiness: RigidReadiness, scenario: RigidScenario): RigidGameState {
  if (current.phase !== "active") return current;

  const turn = current.turn + 1;
  const normalizedOrders = normalizedRigidOrders(orders, turn);
  const rules = difficultyRules(scenario);
  const operational = deriveOperationalStrategy(scenario);
  const capabilityState = readinessWithCapabilityFactors(readiness, current.matrix, turn);
  const turnReadiness = capabilityState.readiness;
  const matrixInput = rigidTurnMatrixInput(current, orders, readiness, scenario);
  const matrixResolution = current.matrix && matrixInput ? estimateResolutionMatrix(current.matrix, matrixInput) : null;
  const matrixMultiplier = matrixResolution ? matrixResultMultiplier(matrixResolution.ultimate.result) : 1;
  const underseaElements = (turnReadiness.submarineCount ?? 0) + (turnReadiness.uncrewedUnderseaCount ?? 0);
  const uncrewedOrder = orders.uncrewed ?? "distributed-scouting";
  const underseaOrder = orders.undersea ?? "independent-patrol";
  const uncrewedFit = uncrewedDoctrineFit(uncrewedOrder, operational.recommendedUncrewed, turnReadiness.uncrewedCount);
  const underseaFit = underseaDoctrineFit(underseaOrder, operational.recommendedUndersea, underseaElements);
  const doctrineFit = uncrewedFit + underseaFit;
  const employmentMismatch = uncrewedFit < 0 || underseaFit < 0;
  const riskTreatment = orders.riskTreatment ?? "prepare";
  const coordination = orders.coordination ?? "federated";
  const strategicPolicy = orders.strategicPolicy ?? "conventional-restraint";
  const riskEffects = assessRiskEffects({
    treatment: riskTreatment,
    coordination,
    strategicPolicy,
    turn,
    adversaryCount: scenario.adversaryCount ?? 1,
    selectedLens: scenario.selectedLens,
    guardrail: scenario.guardrail,
    currentIntegrity: current.integrity,
    currentSupply: current.supply,
  });
  const taskRequired = scenario.required.includes(orders.task);
  const taskRelevant = taskRequired || scenario.recommended.includes(orders.task);
  const sensor = sensorGain(orders, turnReadiness, scenario);
  const tempoRange = { hold: 0, "measured-advance": -28, "high-speed-dash": -44, withdraw: 30 }[orders.tempo];
  const formationRange = orders.formation === "protected-column" && tempoRange < 0 ? 7 : orders.formation === "distributed-barrier" && tempoRange < 0 ? -4 : 0;
  const nextRange = rounded(clamp(current.rangeNm + tempoRange + formationRange, 18, 280));
  const highTempoSensorPenalty = orders.tempo === "high-speed-dash" ? 7 : 0;
  const engagementContact = orders.engagement === "shadow" ? 5 : orders.engagement === "avoid" ? -2 : 0;
  const nextContact = rounded(clamp(
    current.contactQuality + sensor + engagementContact + riskEffects.contact - highTempoSensorPenalty,
    0,
    Math.max(current.contactQuality, contactCapabilityCeiling(turnReadiness)),
  ));

  const disruptionPressureMultiplier = capabilityState.activeDisruptions.reduce((product, event) => product * event.opposingPressureMultiplier, 1);
  const pressure = (13 + turn * 2 + scenario.required.length * 1.5 + environmentalFriction(scenario) * 0.65 + riskEffects.pressure * 2.5)
    * rules.opposingPressureMultiplier * capabilityState.opposingMultiplier * disruptionPressureMultiplier
    * opposingScalePressureMultiplier(current.matrix)
    * (matrixResolution?.ultimate.result === "failure" ? 1.03 : matrixResolution?.ultimate.result === "success" ? 0.97 : 1);
  const defense = defensivePower(turnReadiness, scenario, orders, nextContact);
  const exposure = orders.formation === "distributed-barrier" && nextContact < 45 ? 6 : 0;
  const avoidReduction = orders.engagement === "avoid" || orders.tempo === "withdraw" ? 5 : 0;
  const integrityLoss = rounded(Math.max(0, pressure - defense * 0.62 + exposure - avoidReduction));
  const readinessLoss = rounded(Math.max(1, integrityLoss * 0.55 + (orders.tempo === "high-speed-dash" ? 4 : 1) - (orders.tempo === "hold" ? 2 : 0)));
  const baseSupplyLoss = { hold: 3, "measured-advance": 8, "high-speed-dash": 15, withdraw: 6 }[orders.tempo]
    + (orders.sensors === "active-sweep" ? 3 : orders.sensors === "cooperative-fusion" ? 2 : 0)
    + (orders.engagement === "bounded-effects" ? 4 : 0)
    + (underseaOrder === "coordinated-wolfpack" ? 2 : 0)
    + (uncrewedOrder === "attritable-massing" ? 2 : 0);
  const supplyLoss = rounded(baseSupplyLoss * rules.supplyUseMultiplier);

  const withinReach = turnReadiness.maxReachNm >= nextRange || nextRange <= 45;
  const reachMismatch = requiresEffectReach(orders) && !withinReach;
  const contactThreshold = engagementContactThreshold(orders.engagement, scenario);
  const contactMismatch = orders.engagement !== "avoid" && nextContact < contactThreshold;
  const hasCreditedMissionEffect = turnReadiness.selectedUnitCount > 0 && (orders.engagement === "shadow"
    ? turnReadiness.trackCapacity > 0 && creditedTrackingMethodCount(turnReadiness) > 0
    : turnReadiness.compatibleArmamentCount > 0
      || turnReadiness.supportedAircraftCount > 0
      || turnReadiness.escortValue > 0
      || turnReadiness.airDefenseValue > 0
      || turnReadiness.underseaValue > 0
      || turnReadiness.uncrewedCount > 0);
  const canApplyPressure = requiresEffectReach(orders)
    && taskRelevant
    && withinReach
    && nextContact >= contactThreshold
    && turnReadiness.missionReady
    && hasCreditedMissionEffect;
  const effectBase = orders.engagement === "bounded-effects" ? 13 : orders.engagement === "contain" ? 9 : orders.engagement === "shadow" ? 4 : 0;
  const effectSupport = Math.min(15, turnReadiness.compatibleArmamentCount * 0.9 + turnReadiness.supportedAircraftCount * 0.18 + turnReadiness.trackCapacity / 90 + Math.max(-4, doctrineFit * 0.55));
  const cohesionLoss = canApplyPressure
    ? rounded((effectBase + effectSupport + (taskRequired ? 4 : 0) + riskEffects.cohesion) * rules.effectMultiplier * matrixMultiplier)
    : 0;

  const advanceContribution = orders.tempo === "measured-advance" ? 9 : orders.tempo === "high-speed-dash" ? 12 : orders.tempo === "hold" ? 3 : -4;
  const engagementContribution = orders.engagement === "bounded-effects" ? 8 : orders.engagement === "contain" ? 10 : orders.engagement === "shadow" ? 5 : -3;
  const formationContribution = orders.formation === "distributed-barrier" && taskRelevant ? 4 : orders.formation === "protected-column" && scenario.guardrail !== "sustainability" ? 3 : 2;
  const adaptationEffect = 0.85 + forceAdaptationScore(turnReadiness) * 0.0015;
  const methodFit = operational.friendlyMethod === "fleet-action"
    ? (orders.formation === "concentrated-screen" && orders.engagement !== "avoid" ? 3 : 0)
    : (orders.formation === "distributed-barrier" || orders.engagement === "shadow" ? 3 : 0);
  const postureFit = operational.friendlyPosture === "offensive"
    ? (orders.tempo === "measured-advance" || orders.tempo === "high-speed-dash" ? 2 : 0)
    : (orders.engagement === "contain" || orders.tempo === "hold" ? 2 : 0);
  const objectiveGain = canApplyPressure
    ? rounded((Math.max(0, advanceContribution + engagementContribution + formationContribution + methodFit + postureFit + Math.max(-5, doctrineFit * 0.55) + (taskRequired ? 4 : 0)) + riskEffects.objective) * rules.objectiveMultiplier * adaptationEffect * matrixMultiplier)
    : 0;

  const secondaryObjective = current.matrix?.activeSecondaryObjective;
  const secondaryActive = Boolean(secondaryObjective && turn >= secondaryObjective.revealTurn);
  const secondaryFit = secondaryActive && secondaryObjective ? secondaryObjectiveOrderFit(secondaryObjective, orders) : null;
  const secondaryGain = secondaryActive
    ? rounded(Math.max(0, objectiveGain * 0.55 + 3) * (secondaryFit?.multiplier ?? 0.35))
    : 0;

  const escalationGain = (orders.sensors === "active-sweep" ? 5 : orders.sensors === "emission-control" ? -2 : 0)
    + (orders.engagement === "bounded-effects" ? 9 : orders.engagement === "contain" ? 3 : orders.engagement === "avoid" ? -2 : 0)
    + (orders.tempo === "high-speed-dash" ? 3 : orders.tempo === "withdraw" ? -4 : 0)
    + (!taskRequired && orders.engagement === "bounded-effects" ? 6 : 0)
    + (uncrewedOrder === "attritable-massing" && nextContact < contactThreshold ? 4 : 0)
    + (underseaOrder === "coordinated-wolfpack" && underseaElements < 2 ? 4 : 0)
    + riskEffects.escalation;

  const nextWithoutOutcome: RigidGameState = {
    ...current,
    turn,
    rangeNm: nextRange,
    contactQuality: nextContact,
    readiness: rounded(clamp(current.readiness - readinessLoss + riskEffects.readiness)),
    integrity: rounded(clamp(current.integrity - integrityLoss + riskEffects.integrity)),
    supply: rounded(clamp(current.supply - supplyLoss + riskEffects.supply)),
    escalation: rounded(clamp(current.escalation + escalationGain)),
    objectiveProgress: rounded(clamp(current.objectiveProgress + objectiveGain)),
    opposingCohesion: rounded(clamp(current.opposingCohesion - cohesionLoss)),
    ...(current.secondaryObjectiveProgress === undefined ? {} : {
      secondaryObjectiveProgress: rounded(clamp(current.secondaryObjectiveProgress + secondaryGain)),
    }),
    reports: current.reports,
    outcome: null,
  };

  const capacityDisruptions = capabilityState.activeDisruptions.filter((event) => event.availabilityMultiplier < 1 || event.permanentLossFraction > 0);
  const pressureDisruptions = capabilityState.activeDisruptions.filter((event) => event.availabilityMultiplier === 1 && event.permanentLossFraction === 0);
  const disruptionNote = capabilityState.activeDisruptions.length
    ? [
      capacityDisruptions.length
        ? `${capacityDisruptions.map((event) => event.headline).join("; ")} affected credited capacities under the disclosed duration and recovery rules.`
        : "",
      pressureDisruptions.length
        ? `${pressureDisruptions.map((event) => event.headline).join("; ")} altered opposing pressure without creating a capacity-loss record.`
        : "",
    ].filter(Boolean).join(" ")
    : "No compound disruption was active this turn.";

  const observationDomains = rigidObservationDomains(turnReadiness);
  const adversaryAction = rigidAdversaryAction({
    turn,
    currentContact: current.contactQuality,
    nextContact,
    integrityLoss,
    cohesionLoss,
    opposingMethod: operational.opposingMethod,
    opposingPosture: operational.opposingPosture,
    activeDisruptionCount: capabilityState.activeDisruptions.length,
    scenario,
  });
  const inflictions: RigidInfliction[] = [
    ...(integrityLoss > 0 ? [{
      id: `opposing-infliction-turn-${turn}`,
      occurredTurn: turn,
      sourceSide: "opposing-force" as const,
      targetSide: "selected-force" as const,
      effect: "integrity" as const,
      amount: integrityLoss,
      domains: [...adversaryAction.domains],
    }] : []),
    ...(cohesionLoss > 0 ? [{
      id: `friendly-infliction-turn-${turn}`,
      occurredTurn: turn,
      sourceSide: "selected-force" as const,
      targetSide: "opposing-force" as const,
      effect: "cohesion" as const,
      amount: cohesionLoss,
      domains: warfareObservationDomains(normalizedOrders.task),
    }] : []),
  ];

  const report: RigidTurnReport = {
    turn,
    orders: normalizedOrders,
    phase: turn <= 2 ? "Approach and classification" : turn <= 4 ? "Contest and manoeuvre" : "Decision and transition",
    contactReport: contactDescription(nextWithoutOutcome.contactQuality),
    umpireNotes: [
      taskRequired ? "The assigned task directly addresses a required warfare area." : taskRelevant ? "The assigned task supports the mission but is not a principal requirement." : "The assigned task does not address the generated mission’s required or recommended areas.",
      !requiresEffectReach(orders)
        ? "The selected posture and tempo do not attempt an effect that requires a reach check."
        : !reachMismatch
          ? "At least one compatible fictional effect or close-position option is within its invented reach band."
          : "The force remains outside every compatible selected effect’s invented reach band.",
      orders.engagement === "avoid"
        ? "The avoid posture does not require contact quality to meet an engagement threshold."
        : !contactMismatch
          ? "Contact quality meets the selected engagement posture’s rigid threshold."
          : "Contact quality remains below the selected engagement posture’s rigid threshold.",
      employmentMismatch
        ? "At least one selected uncrewed or undersea method lacks the force or environmental conditions it assumes."
        : doctrineFit >= 6
          ? "The uncrewed and undersea employment methods fit the assessed environment and available force."
          : "The selected uncrewed and undersea methods are workable but not mutually reinforcing.",
      `${riskEffects.note} Coordination used ${coordination.replaceAll("-", " ")} against ${scenario.adversaryCount ?? 1} assessed adversary actor${(scenario.adversaryCount ?? 1) === 1 ? "" : "s"}.`,
      secondaryFit?.note ?? "No secondary objective required a separate command posture on this turn.",
      strategicPolicy === "nuclear-employment" ? "Nuclear employment disrupted opposition while imposing extreme escalation, legitimacy, coordination, and recovery costs." : strategicPolicy === "nuclear-demonstration" ? "Nuclear demonstration increased reciprocal mobilization and escalation risk." : strategicPolicy === "nuclear-deterrent" ? "Nuclear capability remained a deterrent reserve; its effect depended on adversary interpretation rather than guaranteed compliance." : "Strategic force policy retained conventional restraint.",
      matrixResolution ? `The nested matrix committed a ${matrixResolution.ultimate.committedChance}% ultimate chance against draw ${matrixResolution.ultimate.draw}/100: ${matrixResolution.ultimate.result}. The draw was fixed by the scenario and turn before this resolution.` : "This legacy scenario used the fixed-rule adjudicator without a compound probability matrix.",
      disruptionNote,
      integrityLoss > 0 ? `Opposing pressure reduced force integrity by ${integrityLoss}.` : "The screen and contact picture absorbed the turn’s opposing pressure without integrity loss.",
    ],
    delta: {
      rangeNm: nextWithoutOutcome.rangeNm - current.rangeNm,
      contactQuality: nextWithoutOutcome.contactQuality - current.contactQuality,
      readiness: nextWithoutOutcome.readiness - current.readiness,
      integrity: nextWithoutOutcome.integrity - current.integrity,
      supply: nextWithoutOutcome.supply - current.supply,
      escalation: nextWithoutOutcome.escalation - current.escalation,
      objectiveProgress: nextWithoutOutcome.objectiveProgress - current.objectiveProgress,
      opposingCohesion: nextWithoutOutcome.opposingCohesion - current.opposingCohesion,
      secondaryObjectiveProgress: (nextWithoutOutcome.secondaryObjectiveProgress ?? 0) - (current.secondaryObjectiveProgress ?? 0),
    },
    ...(matrixResolution && matrixInput ? { matrixInput, matrixResolution } : {}),
    activeDisruptionIds: capabilityState.activeDisruptions.map((event) => event.id),
    diagnosticCodes: [
      ...(!taskRelevant ? ["task-mismatch" as const] : []),
      ...(reachMismatch ? ["reach-gap" as const] : []),
      ...(contactMismatch ? ["contact-gap" as const] : []),
      ...(employmentMismatch ? ["employment-mismatch" as const] : []),
    ],
    adversaryActions: [adversaryAction],
    inflictions,
    observationDomains,
  };

  const withReport = { ...nextWithoutOutcome, reports: [...current.reports, report] };
  const complete = turn >= current.maxTurns || withReport.integrity <= 0 || withReport.supply <= 0;
  return complete ? { ...withReport, phase: "complete", outcome: finalOutcome(withReport, readiness, scenario) } : withReport;
}

/**
 * Reverses one resolved turn exactly from its recorded delta. Completed states
 * return to active play with their outcome cleared; turn-zero states are stable.
 */
export function undoRigidTurn(current: RigidGameState): RigidGameState {
  const report = current.reports.at(-1);
  if (!report) return current;
  return {
    ...current,
    phase: "active",
    turn: current.turn - 1,
    rangeNm: rounded(clamp(current.rangeNm - report.delta.rangeNm, 18, 280)),
    contactQuality: rounded(clamp(current.contactQuality - report.delta.contactQuality)),
    readiness: rounded(clamp(current.readiness - report.delta.readiness)),
    integrity: rounded(clamp(current.integrity - report.delta.integrity)),
    supply: rounded(clamp(current.supply - report.delta.supply)),
    escalation: rounded(clamp(current.escalation - report.delta.escalation)),
    objectiveProgress: rounded(clamp(current.objectiveProgress - report.delta.objectiveProgress)),
    opposingCohesion: rounded(clamp(current.opposingCohesion - report.delta.opposingCohesion)),
    ...(current.secondaryObjectiveProgress === undefined ? {} : {
      secondaryObjectiveProgress: rounded(clamp(current.secondaryObjectiveProgress - (report.delta.secondaryObjectiveProgress ?? 0))),
    }),
    reports: current.reports.slice(0, -1),
    outcome: null,
  };
}

export const RIGID_FINDING_CODES: readonly RigidFindingCode[] = [
  "planning-gap",
  "force-mismatch",
  "operational-mismatch",
  "task-mismatch",
  "reach-gap",
  "contact-gap",
  "integrity-collapse",
  "supply-exhaustion",
  "guardrail-breach",
  "objective-gap",
];

export const RIGID_TURN_DIAGNOSTIC_CODES: readonly RigidTurnDiagnosticCode[] = [
  "task-mismatch",
  "reach-gap",
  "contact-gap",
  "employment-mismatch",
];

export const RIGID_FINDING_MODULES: readonly RigidFindingModuleId[] = [
  "strategy-grammar",
  "wargaming",
  "jomini",
  "maritime-schools",
  "maritime-uncrewed",
  "undersea-campaigns",
  "global-seapower",
  "clausewitz",
  "corbett",
  "synthesis",
];

export const RIGID_ADVERSARY_ACTION_CODES: readonly RigidAdversaryActionCode[] = [
  "apply-pressure",
  "probe-screen",
  "contest-sensors",
  "mask-movement",
  "disperse-and-preserve",
  "hold-and-preserve",
  "exploit-disruption",
];

function hasOnlyObjectKeys(value: Record<string, unknown>, allowed: readonly string[]) {
  const allowedKeys = new Set(allowed);
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function isRigidAdversaryAssessment(value: unknown, requireComplete = false): value is RigidAdversaryAssessment {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const assessment = value as Record<string, unknown>;
  if (!hasOnlyObjectKeys(assessment, ["intent", "observedPattern", "nextAction"])) return false;
  const valid = (assessment.intent === undefined || ADVERSARY_INTENT_ASSUMPTIONS.includes(assessment.intent as AdversaryIntentAssumption))
    && (assessment.observedPattern === undefined || OBSERVED_PATTERN_ASSUMPTIONS.includes(assessment.observedPattern as ObservedPatternAssumption))
    && (assessment.nextAction === undefined || ADVERSARY_NEXT_ACTION_ASSUMPTIONS.includes(assessment.nextAction as AdversaryNextActionAssumption));
  return valid && (!requireComplete || isCompleteAdversaryAssessment(assessment as RigidAdversaryAssessment));
}

function isRigidObservationDomains(value: unknown): value is RigidObservationDomain[] {
  return Array.isArray(value)
    && value.length <= 3
    && value.every((domain) => ["air", "surface", "subsurface"].includes(String(domain)))
    && new Set(value).size === value.length;
}

function isRigidAdversaryAction(value: unknown, turn: number): value is RigidAdversaryAction {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const action = value as Record<string, unknown>;
  return hasOnlyObjectKeys(action, ["id", "occurredTurn", "subject", "action", "domains"])
    && isSafeIdentifier(action.id)
    && action.occurredTurn === turn
    && action.subject === "opposition"
    && RIGID_ADVERSARY_ACTION_CODES.includes(action.action as RigidAdversaryActionCode)
    && isRigidObservationDomains(action.domains)
    && action.domains.length > 0;
}

function isRigidInfliction(value: unknown, turn: number): value is RigidInfliction {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const infliction = value as Record<string, unknown>;
  return hasOnlyObjectKeys(infliction, ["id", "occurredTurn", "sourceSide", "targetSide", "effect", "amount", "domains"])
    && isSafeIdentifier(infliction.id)
    && infliction.occurredTurn === turn
    && ["selected-force", "opposing-force"].includes(String(infliction.sourceSide))
    && ["selected-force", "opposing-force"].includes(String(infliction.targetSide))
    && infliction.sourceSide !== infliction.targetSide
    && ["integrity", "cohesion"].includes(String(infliction.effect))
    && ((infliction.effect === "integrity" && infliction.targetSide === "selected-force")
      || (infliction.effect === "cohesion" && infliction.targetSide === "opposing-force"))
    && typeof infliction.amount === "number"
    && Number.isFinite(infliction.amount)
    && infliction.amount > 0
    && infliction.amount <= 100
    && isRigidObservationDomains(infliction.domains)
    && infliction.domains.length > 0;
}

function isRigidAssetImpact(value: unknown): value is RigidAssetImpact {
  if (!value || typeof value !== "object") return false;
  const impact = value as Record<string, unknown>;
  return isSafeIdentifier(impact.id)
    && isSafeIdentifier(impact.disruptionId)
    && isBoundedCleanText(impact.label, 180, false) && (impact.label as string).trim().length > 0
    && ["selected-force", "opposing-force"].includes(String(impact.side))
    && ["surface", "air", "subsurface", "mission-pack", "communications"].includes(String(impact.domain))
    && Number.isInteger(impact.quantity) && (impact.quantity as number) >= 1 && (impact.quantity as number) <= 100
    && ["downed", "disabled", "degraded", "diverted", "unavailable"].includes(String(impact.status))
    && (impact.unavailableThroughTurn === undefined || Number.isInteger(impact.unavailableThroughTurn) && (impact.unavailableThroughTurn as number) >= 1 && (impact.unavailableThroughTurn as number) <= 6)
    && Array.isArray(impact.capabilitiesUnavailable) && impact.capabilitiesUnavailable.length <= 6
    && impact.capabilitiesUnavailable.every((item) => isBoundedCleanText(item, 200, false) && item.trim().length > 0)
    && ["confirmed", "assessed", "concealed"].includes(String(impact.knowledge));
}

function isRigidScoreBreakdown(value: unknown, score: number): value is RigidScoreBreakdown {
  if (!value || typeof value !== "object") return false;
  const breakdown = value as Record<string, unknown>;
  const numericKeys: Array<keyof RigidScoreBreakdown> = [
    "objective",
    "opposingDisruption",
    "forceIntegrity",
    "commandReadiness",
    "supply",
    "contactQuality",
    "escalationDiscipline",
    "planning",
    "total",
    "victoryThreshold",
    "objectiveThreshold",
    "integrityThreshold",
    "supplyThreshold",
    "escalationLimit",
  ];
  return numericKeys.every((key) => typeof breakdown[key] === "number" && Number.isFinite(breakdown[key] as number) && (breakdown[key] as number) >= 0 && (breakdown[key] as number) <= 100)
    && breakdown.total === score;
}

function isRigidDiagnosticFinding(value: unknown): value is RigidDiagnosticFinding {
  if (!value || typeof value !== "object") return false;
  const finding = value as Record<string, unknown>;
  return RIGID_FINDING_CODES.includes(finding.code as RigidFindingCode)
    && RIGID_FINDING_MODULES.includes(finding.moduleId as RigidFindingModuleId)
    && ["cause", "evidence", "adjustment"].every((key) => isBoundedCleanText(finding[key], 2_000) && (finding[key] as string).trim().length > 0);
}

function isRigidOutcome(value: unknown): value is RigidOutcome {
  if (!value || typeof value !== "object") return false;
  const outcome = value as Record<string, unknown>;
  return typeof outcome.won === "boolean"
    && typeof outcome.score === "number"
    && Number.isFinite(outcome.score)
    && outcome.score >= 0
    && outcome.score <= 100
    && ["DECISIVE VICTORY", "LIMITED SUCCESS", "MISSION UNRESOLVED", "MISSION LOSS"].includes(String(outcome.title))
    && ["guided", "standard", "challenge"].includes(String(outcome.difficulty))
    && isRigidScoreBreakdown(outcome.breakdown, outcome.score)
    && Array.isArray(outcome.findings)
    && outcome.findings.length <= RIGID_FINDING_CODES.length
    && outcome.findings.every(isRigidDiagnosticFinding)
    && new Set(outcome.findings.map((finding) => (finding as RigidDiagnosticFinding).code)).size === outcome.findings.length
    && Array.isArray(outcome.notes)
    && outcome.notes.length <= 200
    && outcome.notes.every((note) => isBoundedCleanText(note, 2_000));
}

export function isRigidTurnReport(
  value: unknown,
  index: number,
  stateVersion: 1 | 2,
): value is RigidTurnReport {
  if (!value || typeof value !== "object") return false;
  const report = value as Record<string, unknown>;
  const delta = report.delta as Record<string, unknown> | undefined;
  return hasOnlyObjectKeys(report, [
    "turn", "orders", "phase", "contactReport", "umpireNotes", "delta",
    "matrixInput", "matrixResolution", "activeDisruptionIds", "diagnosticCodes",
    "adversaryActions", "inflictions", "observationDomains",
  ])
    && report.turn === index + 1
    && isRigidOrders(report.orders)
    && isBoundedCleanText(report.phase, 300, false)
    && isBoundedCleanText(report.contactReport, 2_000)
    && Array.isArray(report.umpireNotes) && (report.umpireNotes as unknown[]).every((note) => isBoundedCleanText(note, 2_000))
    && Boolean(delta)
    && hasOnlyObjectKeys(delta!, [
      "rangeNm", "contactQuality", "readiness", "integrity", "supply",
      "escalation", "objectiveProgress", "opposingCohesion", "secondaryObjectiveProgress",
    ])
    && ["rangeNm", "contactQuality", "readiness", "integrity", "supply", "escalation", "objectiveProgress", "opposingCohesion"]
      .every((key) => typeof delta?.[key] === "number" && Number.isFinite(delta[key] as number) && Math.abs(delta[key] as number) <= 280)
    && (delta?.secondaryObjectiveProgress === undefined || typeof delta.secondaryObjectiveProgress === "number" && Number.isFinite(delta.secondaryObjectiveProgress) && Math.abs(delta.secondaryObjectiveProgress) <= 100)
    && (report.matrixInput === undefined || isResolutionMatrixInput(report.matrixInput))
    && (report.matrixResolution === undefined || isResolutionMatrix(report.matrixResolution))
    && (report.activeDisruptionIds === undefined || Array.isArray(report.activeDisruptionIds) && report.activeDisruptionIds.length <= 5 && report.activeDisruptionIds.every(isSafeIdentifier))
    && (report.diagnosticCodes === undefined || Array.isArray(report.diagnosticCodes)
      && report.diagnosticCodes.length <= RIGID_TURN_DIAGNOSTIC_CODES.length
      && report.diagnosticCodes.every((code) => RIGID_TURN_DIAGNOSTIC_CODES.includes(code as RigidTurnDiagnosticCode))
      && new Set(report.diagnosticCodes).size === report.diagnosticCodes.length)
    && (report.adversaryActions === undefined || Array.isArray(report.adversaryActions)
      && report.adversaryActions.length >= 1
      && report.adversaryActions.length <= 4
      && report.adversaryActions.every((action) => isRigidAdversaryAction(action, report.turn as number))
      && new Set(report.adversaryActions.map((action) => (action as RigidAdversaryAction).id)).size === report.adversaryActions.length)
    && (report.inflictions === undefined || Array.isArray(report.inflictions)
      && report.inflictions.length <= 8
      && report.inflictions.every((infliction) => isRigidInfliction(infliction, report.turn as number))
      && new Set(report.inflictions.map((infliction) => (infliction as RigidInfliction).id)).size === report.inflictions.length)
    && (report.observationDomains === undefined || isRigidObservationDomains(report.observationDomains))
    && (stateVersion === 1 || Boolean(
      Array.isArray(report.adversaryActions)
      && Array.isArray(report.inflictions)
      && Array.isArray(report.observationDomains)
      && (report.turn === 1 || isRigidAdversaryAssessment(
        (report.orders as RigidOrders).adversaryAssessment,
        true,
      ))
    ));
}

export function isRigidGameState(value: unknown): value is RigidGameState {
  if (!value || typeof value !== "object") return false;
  const state = value as Record<string, unknown>;
  const stateVersion = state.version;
  if (stateVersion !== 1 && stateVersion !== 2) return false;
  const bounded = ["rangeNm", "contactQuality", "readiness", "integrity", "supply", "escalation", "objectiveProgress", "opposingCohesion"]
    .every((key) => typeof state[key] === "number" && Number.isFinite(state[key] as number) && (state[key] as number) >= 0 && (key === "rangeNm" ? (state[key] as number) <= 280 : (state[key] as number) <= 100));
  const reportsValid = Array.isArray(state.reports)
    && (state.reports as unknown[]).every((report, index) => isRigidTurnReport(report, index, stateVersion));
  const outcomeValid = state.outcome === null || isRigidOutcome(state.outcome);
  return (state.phase === "active" || state.phase === "complete")
    && Number.isInteger(state.turn) && (state.turn as number) >= 0 && (state.turn as number) <= 6
    && state.maxTurns === 6
    && bounded
    && (state.matrix === undefined || isActivatedScenarioMatrix(state.matrix))
    && (state.secondaryObjectiveProgress === undefined || typeof state.secondaryObjectiveProgress === "number" && Number.isFinite(state.secondaryObjectiveProgress) && state.secondaryObjectiveProgress >= 0 && state.secondaryObjectiveProgress <= 100)
    && (state.disruptionImpacts === undefined || Array.isArray(state.disruptionImpacts) && state.disruptionImpacts.length <= 40 && state.disruptionImpacts.every(isRigidAssetImpact))
    && reportsValid
    && (state.reports as unknown[]).length === state.turn
    && outcomeValid
    && (state.phase === "complete" ? state.outcome !== null : state.outcome === null);
}

function rigidReportAdjudication(
  report: RigidTurnReport,
  includeDiagnosticCodes: boolean,
  includeIntelligence: boolean,
) {
  const { adversaryAssessment: _assessment, ...legacyOrders } = report.orders;
  return {
    turn: report.turn,
    orders: includeIntelligence ? report.orders : legacyOrders,
    delta: report.delta,
    ...(report.matrixInput === undefined ? {} : { matrixInput: report.matrixInput }),
    ...(report.matrixResolution === undefined ? {} : { matrixResolution: report.matrixResolution }),
    ...(report.activeDisruptionIds === undefined ? {} : { activeDisruptionIds: report.activeDisruptionIds }),
    ...(includeDiagnosticCodes && report.diagnosticCodes !== undefined ? { diagnosticCodes: report.diagnosticCodes } : {}),
    ...(includeIntelligence ? {
      adversaryActions: report.adversaryActions,
      inflictions: report.inflictions,
      observationDomains: report.observationDomains,
    } : {}),
  };
}

function rigidOutcomeAdjudication(outcome: RigidOutcome | null) {
  if (!outcome) return null;
  return {
    won: outcome.won,
    score: outcome.score,
    title: outcome.title,
    difficulty: outcome.difficulty,
    breakdown: outcome.breakdown,
    findings: outcome.findings.map((finding) => ({ code: finding.code, moduleId: finding.moduleId })),
  };
}

function rigidStateAdjudication(state: RigidGameState, includeVersion = true) {
  return {
    ...(includeVersion ? { version: state.version } : {}),
    phase: state.phase,
    turn: state.turn,
    maxTurns: state.maxTurns,
    rangeNm: state.rangeNm,
    contactQuality: state.contactQuality,
    readiness: state.readiness,
    integrity: state.integrity,
    supply: state.supply,
    escalation: state.escalation,
    objectiveProgress: state.objectiveProgress,
    opposingCohesion: state.opposingCohesion,
    ...(state.matrix === undefined ? {} : { matrix: state.matrix }),
    ...(state.disruptionImpacts === undefined ? {} : { disruptionImpacts: state.disruptionImpacts }),
    ...(state.secondaryObjectiveProgress === undefined ? {} : { secondaryObjectiveProgress: state.secondaryObjectiveProgress }),
  };
}

/** Compare only outcome fields that can change adjudication or lesson routing. */
export function rigidOutcomeAdjudicationEqual(left: RigidOutcome | null, right: RigidOutcome | null): boolean {
  return jsonSemanticEqual(rigidOutcomeAdjudication(left), rigidOutcomeAdjudication(right));
}

/**
 * Replays a portable state from roster-derived readiness instead of trusting
 * any stored initial value, report, delta, matrix input, diagnostic code, or
 * claimed result. Safe presentation prose is deliberately not an adjudication
 * input: accepted saves receive freshly generated report and outcome prose.
 */
export function canonicalRigidState(
  state: RigidGameState,
  scenario: RigidScenario,
  readiness: RigidReadiness,
): RigidGameState | null {
  if (!isRigidGameState(state)) return null;
  const includeIntelligence = state.version === 2;
  let replay = createInitialRigidState(readiness, scenario);
  for (const report of state.reports) {
    if (replay.phase !== "active") return null;
    if (includeIntelligence && replay.turn >= 1
      && !isReasonableRigidAdversaryAssessment(replay, report.orders.adversaryAssessment)) return null;
    replay = resolveRigidTurn(replay, report.orders, readiness, scenario);
    const replayedReport = replay.reports.at(-1);
    if (!replayedReport) return null;
    const includeDiagnosticCodes = report.diagnosticCodes !== undefined;
    if (!jsonSemanticEqual(
      rigidReportAdjudication(replayedReport, includeDiagnosticCodes, includeIntelligence),
      rigidReportAdjudication(report, includeDiagnosticCodes, includeIntelligence),
    )) return null;
  }
  if (!jsonSemanticEqual(
    rigidStateAdjudication(replay, includeIntelligence),
    rigidStateAdjudication(state, includeIntelligence),
  )) return null;
  if (!rigidOutcomeAdjudicationEqual(replay.outcome, state.outcome)) return null;
  return replay;
}

export function isCanonicalRigidState(
  state: RigidGameState,
  scenario: RigidScenario,
  readiness: RigidReadiness,
): boolean {
  return canonicalRigidState(state, scenario, readiness) !== null;
}

export function isRigidOrders(value: unknown): value is RigidOrders {
  if (!value || typeof value !== "object") return false;
  const orders = value as Record<string, unknown>;
  const allowedKeys = new Set([
    "formation", "sensors", "tempo", "engagement", "task", "uncrewed", "undersea",
    "riskTreatment", "coordination", "strategicPolicy", "adversaryAssessment",
  ]);
  return Object.keys(orders).every((key) => allowedKeys.has(key))
    && ["concentrated-screen", "distributed-barrier", "protected-column"].includes(String(orders.formation))
    && ["emission-control", "passive-search", "cooperative-fusion", "active-sweep"].includes(String(orders.sensors))
    && ["hold", "measured-advance", "high-speed-dash", "withdraw"].includes(String(orders.tempo))
    && ["avoid", "shadow", "contain", "bounded-effects"].includes(String(orders.engagement))
    && ["air-defense", "surface-operations", "undersea-operations", "land-attack", "electromagnetic-operations", "reconnaissance", "mine-countermeasures", "missile-defense", "maritime-interdiction"].includes(String(orders.task))
    && (orders.uncrewed === undefined || ["distributed-scouting", "deception-swarm", "attritable-massing", "autonomous-lane-control"].includes(String(orders.uncrewed)))
    && (orders.undersea === undefined || ["independent-patrol", "coordinated-wolfpack", "barrier-ambush", "protective-screen"].includes(String(orders.undersea)))
    && (orders.riskTreatment === undefined || isRiskTreatment(orders.riskTreatment))
    && (orders.coordination === undefined || isCoordinationMode(orders.coordination))
    && (orders.strategicPolicy === undefined || isStrategicForcePolicy(orders.strategicPolicy))
    && (orders.adversaryAssessment === undefined || isRigidAdversaryAssessment(orders.adversaryAssessment));
}
