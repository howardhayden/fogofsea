import type { Climate, Difficulty, Season } from "./gameModel";
import { isBoundedCleanText, isSafeIdentifier } from "./inputSecurity";

export type ForceScale = "tiny" | "small" | "medium" | "large" | "massive";
export type IllicitNetworkType =
  | "trafficking-in-persons"
  | "forced-labor"
  | "arms"
  | "controlled-contraband"
  | "wildlife"
  | "cultural-property"
  | "stolen-goods"
  | "sanctions-evasion"
  | "mixed";
export type OpponentCoordination = "none" | "opportunistic" | "selective" | "integrated";
export type OpportunisticActorType =
  | "route-exploitation-network"
  | "deniable-raiding-group"
  | "resource-seeking-spoiler"
  | "information-broker"
  | "salvage-seeking-group";
export type InstitutionalConstraint =
  | "none"
  | "risk-insensitive-sponsor"
  | "unsustainable-overfunding"
  | "command-overrule"
  | "funding-restriction";
export type DisruptionKind =
  | "severe-weather"
  | "command-interference"
  | "opposing-coordination"
  | "opportunistic-actor"
  | "objective-change";
export type CapabilityDomain = "surface" | "air" | "subsurface" | "mission-pack" | "communications";
export type AffectedSide = "selected-force" | "opposing-force" | "both";
export type MatrixResult = "success" | "partial" | "failure";

export type ScenarioDisruption = {
  id: string;
  kind: DisruptionKind;
  headline: string;
  description: string;
  startsTurn: number;
  endsTurn: number;
  minimumDifficulty: Difficulty;
  severity: "watch" | "major" | "extreme";
  affectedSide: AffectedSide;
  affectedDomains: CapabilityDomain[];
  availabilityMultiplier: number;
  permanentLossFraction: number;
  opposingPressureMultiplier: number;
  /** Present only for an independent third actor; it is never a cooperation claim. */
  opportunisticActorType?: OpportunisticActorType;
};

export type SecondaryObjective = {
  id: string;
  label: string;
  description: string;
  revealTurn: number;
  minimumDifficulty: Difficulty;
  weight: number;
  method: "recovery-reserve" | "protective-escort" | "alternate-route" | "evidence-handoff" | "system-accountability";
};

export type ScenarioMatrix = {
  version: 1;
  seed: number;
  forceScale: ForceScale;
  forceScaleLabel: string;
  estimatedOpposingElements: readonly [number, number];
  opponentCoordination: OpponentCoordination;
  institutionalConstraint: InstitutionalConstraint;
  illicitNetworkType: IllicitNetworkType;
  secondaryObjective: SecondaryObjective | null;
  disruptions: ScenarioDisruption[];
  committedTurnDraws: number[];
};

export type ActivatedScenarioMatrix = ScenarioMatrix & {
  difficulty: Difficulty;
  activeCoordination: OpponentCoordination;
  activeDisruptions: ScenarioDisruption[];
  activeSecondaryObjective: SecondaryObjective | null;
  adverseBias: number;
};

export type MatrixComponentKey = "contact" | "task" | "environment" | "coordination" | "sustainment";
export type MatrixComponentResolution = {
  key: MatrixComponentKey;
  label: string;
  range: readonly [number, number];
  committedChance: number;
  draw: number;
  result: MatrixResult;
};
export type ResolutionMatrix = {
  turn: number;
  components: MatrixComponentResolution[];
  ultimate: Omit<MatrixComponentResolution, "key"> & { key: "ultimate" };
};

export type ResolutionMatrixInput = {
  turn: number;
  contactQuality: number;
  taskFit: number;
  environmentFit: number;
  coordinationFit: number;
  sustainment: number;
};

const DIFFICULTY_LEVEL: Readonly<Record<Difficulty, number>> = { guided: 0, standard: 1, challenge: 2 };
const FORCE_SCALES: readonly ForceScale[] = ["tiny", "small", "medium", "large", "massive"];
const ILLICIT_TYPES: readonly IllicitNetworkType[] = [
  "trafficking-in-persons", "forced-labor", "arms", "controlled-contraband", "wildlife",
  "cultural-property", "stolen-goods", "sanctions-evasion", "mixed",
];
const COORDINATION: readonly OpponentCoordination[] = ["none", "opportunistic", "selective", "integrated"];
const CONSTRAINTS: readonly InstitutionalConstraint[] = [
  "none", "risk-insensitive-sponsor", "unsustainable-overfunding", "command-overrule", "funding-restriction",
];
const OPPORTUNISTIC_ACTOR_TYPES: readonly OpportunisticActorType[] = [
  "route-exploitation-network",
  "deniable-raiding-group",
  "resource-seeking-spoiler",
  "information-broker",
  "salvage-seeking-group",
];

const FORCE_SCALE_DETAILS: Readonly<Record<ForceScale, { label: string; range: readonly [number, number] }>> = {
  tiny: { label: "Tiny dispersed craft group", range: [2, 5] },
  small: { label: "Small raiding or converted-merchant group", range: [4, 9] },
  medium: { label: "Cruiser-hunting group", range: [8, 16] },
  large: { label: "Distributed multi-domain formation", range: [15, 28] },
  massive: { label: "Massive combined formation", range: [26, 48] },
};

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))];
}

function integer(minimum: number, maximum: number, random: () => number) {
  return minimum + Math.floor(random() * (maximum - minimum + 1));
}

function clamp(value: number, minimum = 1, maximum = 99) {
  return Math.max(minimum, Math.min(maximum, Math.round(value)));
}

function severeWeatherName(climate: Climate, regionId: string, season: Season) {
  if (climate !== "ocean") return season === "winter" ? "Polar cyclone" : "Severe polar low";
  if (regionId === "western-tropical-passage") return season === "summer" || season === "autumn" ? "Typhoon-class tropical cyclone" : "Severe tropical storm";
  if (regionId === "pelagic-island-arc") return season === "summer" || season === "autumn" ? "Hurricane-class tropical cyclone" : "Severe tropical storm";
  if (regionId === "equatorial-convergence") return "Tropical cyclone";
  return "Severe ocean storm";
}

function weatherDisruption(climate: Climate, regionId: string, season: Season, random: () => number): ScenarioDisruption {
  const startsTurn = integer(2, 4, random);
  const duration = integer(1, 3, random);
  const headline = severeWeatherName(climate, regionId, season);
  const extreme = random() < 0.28;
  return {
    id: "weather-window",
    kind: "severe-weather",
    headline,
    description: `${headline} crosses the working area. Flight operations, exposed craft, sensing, and recovery are constrained for the stated window; the same environmental rule applies to both forces.`,
    startsTurn,
    endsTurn: Math.min(6, startsTurn + duration - 1),
    minimumDifficulty: random() < 0.2 ? "guided" : random() < 0.66 ? "standard" : "challenge",
    severity: extreme ? "extreme" : "major",
    affectedSide: "both",
    affectedDomains: climate === "ocean" ? ["air", "surface", "communications"] : ["air", "surface", "subsurface", "communications"],
    availabilityMultiplier: extreme ? 0.64 : 0.78,
    permanentLossFraction: extreme ? 0.08 : 0,
    opposingPressureMultiplier: extreme ? 0.72 : 0.84,
  };
}

function institutionalDisruption(constraint: InstitutionalConstraint, random: () => number): ScenarioDisruption | null {
  if (constraint === "none") return null;
  const startsTurn = integer(2, 5, random);
  const copy: Record<Exclude<InstitutionalConstraint, "none">, { headline: string; description: string; side: AffectedSide; domains: CapabilityDomain[] }> = {
    "risk-insensitive-sponsor": {
      headline: "Risk-insensitive opposing direction",
      description: "Opposing political direction accepts disproportionate cost and orders a short surge. Pressure increases for the stated window; the model does not assume that risk acceptance creates durable capacity.",
      side: "opposing-force",
      domains: ["surface", "air", "communications"],
    },
    "unsustainable-overfunding": {
      headline: "Unsustainable opposing mobilization",
      description: "An opposing sponsor releases resources beyond a supportable plan. Pressure rises during the stated window, while immediate maintenance and integration failures create the recorded permanent loss.",
      side: "opposing-force",
      domains: ["surface", "air", "subsurface", "mission-pack"],
    },
    "command-overrule": {
      headline: "Command decision overruled",
      description: "A senior authority overrules the selected force's preferred sequence. One capability is diverted until the command relationship is clarified.",
      side: "selected-force",
      domains: ["communications", "mission-pack"],
    },
    "funding-restriction": {
      headline: "Funding restriction",
      description: "A funding restriction removes planned support during execution. The force must protect the objective with fewer available enablers until an alternative is coordinated.",
      side: "selected-force",
      domains: ["air", "mission-pack"],
    },
  };
  const selected = copy[constraint];
  return {
    id: `institution-${constraint}`,
    kind: "command-interference",
    headline: selected.headline,
    description: selected.description,
    startsTurn,
    endsTurn: Math.min(6, startsTurn + integer(1, 2, random)),
    minimumDifficulty: random() < 0.25 ? "standard" : "challenge",
    severity: constraint === "command-overrule" || constraint === "funding-restriction" ? "major" : "watch",
    affectedSide: selected.side,
    affectedDomains: selected.domains,
    availabilityMultiplier: constraint === "risk-insensitive-sponsor" || constraint === "unsustainable-overfunding" ? 1 : 0.72,
    permanentLossFraction: constraint === "unsustainable-overfunding" ? 0.06 : 0,
    opposingPressureMultiplier: constraint === "risk-insensitive-sponsor" ? 1.2 : constraint === "unsustainable-overfunding" ? 1.16 : constraint === "command-overrule" ? 1.08 : 1.05,
  };
}

function cooperationDisruption(coordination: OpponentCoordination, random: () => number): ScenarioDisruption | null {
  if (coordination === "none") return null;
  const startsTurn = integer(2, 5, random);
  return {
    id: "opposing-cooperation",
    kind: "opposing-coordination",
    headline: coordination === "integrated" ? "Integrated opposing action" : "Opposing cooperation window",
    description: `${coordination[0].toUpperCase()}${coordination.slice(1)} coordination lets distinct opposing actors share timing and selected information without assuming identical political aims.`,
    startsTurn,
    endsTurn: Math.min(6, startsTurn + (coordination === "integrated" ? 2 : 1)),
    minimumDifficulty: coordination === "integrated" ? "challenge" : "standard",
    severity: coordination === "integrated" ? "major" : "watch",
    affectedSide: "opposing-force",
    affectedDomains: ["communications", "air", "surface", "subsurface"],
    availabilityMultiplier: 1,
    permanentLossFraction: 0,
    opposingPressureMultiplier: coordination === "integrated" ? 1.2 : coordination === "selective" ? 1.12 : 1.06,
  };
}

function opportunisticActorDisruption(seed: number): ScenarioDisruption | null {
  // This stream is deliberately independent of the primary-opponent stream so
  // adding the optional actor does not rewrite force scale, cooperation, or any
  // already-committed turn draw.
  const random = seededRandom(hashText(`${seed}|independent-opportunist-v1`));
  if (random() >= 0.48) return null;
  const actorType = pick(OPPORTUNISTIC_ACTOR_TYPES, random);
  const affectedSide = pick<AffectedSide>(["selected-force", "opposing-force", "both"], random);
  const startsTurn = integer(2, 5, random);
  const labels: Readonly<Record<OpportunisticActorType, string>> = {
    "route-exploitation-network": "Independent route-exploitation network",
    "deniable-raiding-group": "Independent deniable raiding group",
    "resource-seeking-spoiler": "Independent resource-seeking spoiler",
    "information-broker": "Independent information broker",
    "salvage-seeking-group": "Independent salvage-seeking group",
  };
  const targetText = affectedSide === "selected-force"
    ? "pressures the selected force"
    : affectedSide === "opposing-force"
      ? "pressures the primary opposition"
      : "seeks advantage from both principal forces";
  return {
    id: `opportunist-${actorType}`,
    kind: "opportunistic-actor",
    headline: labels[actorType],
    description: `${labels[actorType]} ${targetText}. It acts for its own limited purpose and does not share command, information, or political aims with the primary opposition. Its identity remains abstract unless the contact picture supports further disclosure.`,
    startsTurn,
    endsTurn: Math.min(6, startsTurn + integer(0, 1, random)),
    minimumDifficulty: random() < 0.28 ? "standard" : "challenge",
    severity: random() < 0.3 ? "major" : "watch",
    affectedSide,
    affectedDomains: pick<CapabilityDomain[]>([
      ["surface", "communications"],
      ["air", "communications"],
      ["surface", "mission-pack"],
    ], random),
    availabilityMultiplier: 1,
    permanentLossFraction: 0,
    // Above one means net pressure on the selected force; below one means the
    // independent actor burdens the primary opposition. "Both" is neutral in
    // the relative pressure term but still increases compound uncertainty.
    opposingPressureMultiplier: affectedSide === "selected-force" ? 1.1 : affectedSide === "opposing-force" ? 0.9 : 1,
    opportunisticActorType: actorType,
  };
}

function objectiveChange(random: () => number): SecondaryObjective {
  const options = [
    ["Preserve recovery capacity", "Retain enough rescue, repair, and recovery capacity to sustain the transition after the primary movement.", "recovery-reserve"],
    ["Protect a second civil movement", "A second civil movement enters the working area and must reach the handoff without displacing the primary objective.", "protective-escort"],
    ["Maintain an alternate route", "Keep one alternate passage usable so success does not depend on a single brittle corridor.", "alternate-route"],
    ["Secure an evidence handoff", "Preserve and transfer the evidence needed for legitimate follow-on action without exposing protected people or unrelated traffic.", "evidence-handoff"],
    ["Recover disabled systems", "Recover or safely account for disabled crewed and uncrewed systems before transition.", "system-accountability"],
  ] as const;
  const [label, description, method] = pick(options, random);
  return {
    id: `secondary-${hashText(label).toString(16)}`,
    label,
    description,
    revealTurn: integer(2, 4, random),
    minimumDifficulty: random() < 0.18 ? "guided" : random() < 0.62 ? "standard" : "challenge",
    weight: integer(18, 30, random),
    method,
  };
}

export function createScenarioMatrix(input: {
  exerciseId: number;
  climate: Climate;
  regionId: string;
  season: Season;
  adversaryCount?: number;
  random?: () => number;
}): ScenarioMatrix {
  const seed = hashText(`${input.exerciseId}|${input.climate}|${input.regionId}|${input.season}|compound-v1`);
  const random = input.random ?? seededRandom(seed);
  const forceScale = pick(FORCE_SCALES, random);
  const forceDetail = FORCE_SCALE_DETAILS[forceScale];
  // Cooperation requires distinct actors. Callers that do not yet model actor
  // count retain the full matrix distribution for backwards-compatible pure
  // model tests; generated scenarios pass the known count explicitly.
  const opponentCoordination = input.adversaryCount !== undefined && input.adversaryCount <= 1
    ? "none"
    : pick(COORDINATION, random);
  const institutionalConstraint = pick(CONSTRAINTS, random);
  const disruptions = [
    weatherDisruption(input.climate, input.regionId, input.season, random),
    institutionalDisruption(institutionalConstraint, random),
    cooperationDisruption(opponentCoordination, random),
    opportunisticActorDisruption(seed),
  ].filter((item): item is ScenarioDisruption => item !== null);
  return {
    version: 1,
    seed,
    forceScale,
    forceScaleLabel: forceDetail.label,
    estimatedOpposingElements: forceDetail.range,
    opponentCoordination,
    institutionalConstraint,
    illicitNetworkType: pick(ILLICIT_TYPES, random),
    secondaryObjective: objectiveChange(random),
    disruptions,
    committedTurnDraws: Array.from({ length: 6 }, () => integer(1, 100, random)),
  };
}

export function activateMatrixForDifficulty(matrix: ScenarioMatrix, difficulty: Difficulty): ActivatedScenarioMatrix {
  const level = DIFFICULTY_LEVEL[difficulty];
  const activeDisruptions = matrix.disruptions.filter((event) => DIFFICULTY_LEVEL[event.minimumDifficulty] <= level);
  return {
    ...matrix,
    difficulty,
    // Difficulty determines whether the generated cooperation window becomes
    // active; it does not silently rewrite that event's named coordination
    // mode, pressure, or copy.
    activeCoordination: matrix.opponentCoordination,
    activeDisruptions,
    activeSecondaryObjective: matrix.secondaryObjective && DIFFICULTY_LEVEL[matrix.secondaryObjective.minimumDifficulty] <= level ? matrix.secondaryObjective : null,
    adverseBias: difficulty === "guided" ? -5 : difficulty === "challenge" ? 9 : 0,
  };
}

export function activeCapabilityFactors(matrix: ActivatedScenarioMatrix, turn: number) {
  const baseline = (): Record<CapabilityDomain, number> => ({ surface: 1, air: 1, subsurface: 1, "mission-pack": 1, communications: 1 });
  const selected = baseline();
  const opposing = baseline();
  const active = matrix.activeDisruptions.filter((event) => event.startsTurn <= turn && event.endsTurn >= turn);
  const occurred = matrix.activeDisruptions.filter((event) => event.startsTurn <= turn);
  for (const event of occurred) {
    for (const domain of event.affectedDomains) {
      const currentlyActive = event.endsTurn >= turn;
      const multiplier = (currentlyActive ? event.availabilityMultiplier : 1) * (1 - event.permanentLossFraction);
      if (event.affectedSide === "selected-force" || event.affectedSide === "both") selected[domain] *= multiplier;
      if (event.affectedSide === "opposing-force" || event.affectedSide === "both") opposing[domain] *= multiplier;
    }
  }
  return { selected, opposing, active };
}

function componentRange(base: number, adverseBias: number): readonly [number, number] {
  const center = clamp(base - adverseBias);
  return [clamp(center - 9), clamp(center + 9)] as const;
}

function resolveComponent(key: MatrixComponentKey, label: string, base: number, draw: number, adverseBias: number): MatrixComponentResolution {
  const range = componentRange(base, adverseBias);
  const committedChance = clamp((range[0] + range[1]) / 2);
  const result: MatrixResult = draw <= committedChance ? "success" : draw <= committedChance + 12 ? "partial" : "failure";
  return { key, label, range, committedChance, draw, result };
}

export function estimateResolutionMatrix(matrix: ActivatedScenarioMatrix, input: ResolutionMatrixInput): ResolutionMatrix {
  const turn = Math.max(1, Math.min(6, Math.round(input.turn)));
  const draw = matrix.committedTurnDraws[turn - 1];
  const active = activeCapabilityFactors(matrix, turn);
  const environmentPenalty = active.active.some((event) => event.kind === "severe-weather") ? 12 : 0;
  const coordinationActive = active.active.some((event) => event.kind === "opposing-coordination");
  const coordinationPressure = !coordinationActive ? 0 : matrix.activeCoordination === "integrated" ? 12 : matrix.activeCoordination === "selective" ? 7 : matrix.activeCoordination === "opportunistic" ? 3 : 0;
  const forceScalePressure = { tiny: -6, small: -3, medium: 0, large: 4, massive: 8 }[matrix.forceScale];
  // Component draws are committed by scenario, turn, and component—not by the
  // order submitted. Orders alter the chance ranges, never the random draw.
  const componentDraw = (key: MatrixComponentKey) => 1 + (hashText(`${matrix.seed}|${turn}|${key}|component-draw`) % 100);
  const components: MatrixComponentResolution[] = [
    resolveComponent("contact", "Contact and classification", input.contactQuality, componentDraw("contact"), matrix.adverseBias),
    resolveComponent("task", "Task and objective fit", input.taskFit - forceScalePressure, componentDraw("task"), matrix.adverseBias),
    resolveComponent("environment", "Environmental execution", input.environmentFit - environmentPenalty, componentDraw("environment"), matrix.adverseBias),
    resolveComponent("coordination", "Coordination contest", input.coordinationFit - coordinationPressure - forceScalePressure, componentDraw("coordination"), matrix.adverseBias),
    resolveComponent("sustainment", "Sustainment and recovery", input.sustainment, componentDraw("sustainment"), matrix.adverseBias),
  ];
  const componentAverage = components.reduce((sum, component) => sum + component.committedChance, 0) / components.length;
  const sharedDependencyPenalty = active.active.length > 1 ? (active.active.length - 1) * 3 : 0;
  const secondaryPenalty = matrix.activeSecondaryObjective && turn >= matrix.activeSecondaryObjective.revealTurn ? matrix.activeSecondaryObjective.weight * 0.18 : 0;
  const nestedResultAdjustment = components.reduce((sum, component) => sum + (component.result === "success" ? 2.5 : component.result === "failure" ? -3 : 0), 0);
  const ultimateBase = componentAverage + nestedResultAdjustment - sharedDependencyPenalty - secondaryPenalty;
  const range = componentRange(ultimateBase, 0);
  const committedChance = clamp((range[0] + range[1]) / 2);
  const ultimateDraw = draw;
  const result: MatrixResult = ultimateDraw <= committedChance ? "success" : ultimateDraw <= committedChance + 12 ? "partial" : "failure";
  return {
    turn,
    components,
    ultimate: { key: "ultimate", label: "Ultimate mission matrix", range, committedChance, draw: ultimateDraw, result },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isResolutionMatrixInput(value: unknown): value is ResolutionMatrixInput {
  if (!isRecord(value)) return false;
  return Number.isInteger(value.turn) && (value.turn as number) >= 1 && (value.turn as number) <= 6
    && ["contactQuality", "taskFit", "environmentFit", "coordinationFit", "sustainment"]
      .every((key) => typeof value[key] === "number"
        && Number.isFinite(value[key])
        && (value[key] as number) >= 0
        && (value[key] as number) <= 100);
}

export function isScenarioMatrix(value: unknown): value is ScenarioMatrix {
  if (!isRecord(value)) return false;
  const range = value.estimatedOpposingElements;
  return value.version === 1
    && Number.isInteger(value.seed) && (value.seed as number) >= 0
    && FORCE_SCALES.includes(value.forceScale as ForceScale)
    && value.forceScaleLabel === FORCE_SCALE_DETAILS[value.forceScale as ForceScale].label
    && Array.isArray(range) && range.length === 2 && range[0] === FORCE_SCALE_DETAILS[value.forceScale as ForceScale].range[0] && range[1] === FORCE_SCALE_DETAILS[value.forceScale as ForceScale].range[1]
    && COORDINATION.includes(value.opponentCoordination as OpponentCoordination)
    && CONSTRAINTS.includes(value.institutionalConstraint as InstitutionalConstraint)
    && ILLICIT_TYPES.includes(value.illicitNetworkType as IllicitNetworkType)
    && Array.isArray(value.disruptions) && value.disruptions.length <= 5 && value.disruptions.every(isScenarioDisruption)
    && Array.isArray(value.committedTurnDraws) && value.committedTurnDraws.length === 6 && value.committedTurnDraws.every((item) => Number.isInteger(item) && item >= 1 && item <= 100)
    && (value.secondaryObjective === null || isSecondaryObjective(value.secondaryObjective));
}

function isScenarioDisruption(value: unknown): value is ScenarioDisruption {
  if (!isRecord(value)) return false;
  const kind = String(value.kind) as DisruptionKind;
  const actorTypeValid = kind === "opportunistic-actor"
    ? OPPORTUNISTIC_ACTOR_TYPES.includes(value.opportunisticActorType as OpportunisticActorType)
    : value.opportunisticActorType === undefined;
  return isSafeIdentifier(value.id)
    && ["severe-weather", "command-interference", "opposing-coordination", "opportunistic-actor", "objective-change"].includes(kind)
    && isBoundedCleanText(value.headline, 160, false)
    && isBoundedCleanText(value.description, 1_000)
    && Number.isInteger(value.startsTurn) && (value.startsTurn as number) >= 1 && (value.startsTurn as number) <= 6
    && Number.isInteger(value.endsTurn) && (value.endsTurn as number) >= (value.startsTurn as number) && (value.endsTurn as number) <= 6
    && ["guided", "standard", "challenge"].includes(String(value.minimumDifficulty))
    && ["watch", "major", "extreme"].includes(String(value.severity))
    && ["selected-force", "opposing-force", "both"].includes(String(value.affectedSide))
    && Array.isArray(value.affectedDomains) && value.affectedDomains.length <= 5 && value.affectedDomains.every((item) => ["surface", "air", "subsurface", "mission-pack", "communications"].includes(String(item)))
    && typeof value.availabilityMultiplier === "number" && value.availabilityMultiplier >= 0 && value.availabilityMultiplier <= 1
    && typeof value.permanentLossFraction === "number" && value.permanentLossFraction >= 0 && value.permanentLossFraction <= 0.5
    && typeof value.opposingPressureMultiplier === "number" && value.opposingPressureMultiplier >= 0.5 && value.opposingPressureMultiplier <= 1.6
    && actorTypeValid;
}

function isSecondaryObjective(value: unknown): value is SecondaryObjective {
  if (!isRecord(value)) return false;
  return isSafeIdentifier(value.id)
    && isBoundedCleanText(value.label, 160, false)
    && isBoundedCleanText(value.description, 1_000)
    && Number.isInteger(value.revealTurn) && (value.revealTurn as number) >= 1 && (value.revealTurn as number) <= 6
    && ["guided", "standard", "challenge"].includes(String(value.minimumDifficulty))
    && typeof value.weight === "number" && value.weight >= 0 && value.weight <= 40
    && ["recovery-reserve", "protective-escort", "alternate-route", "evidence-handoff", "system-accountability"].includes(String(value.method));
}

export function isActivatedScenarioMatrix(value: unknown): value is ActivatedScenarioMatrix {
  if (!isScenarioMatrix(value)) return false;
  const activated = value as ScenarioMatrix & Record<string, unknown>;
  if (!["guided", "standard", "challenge"].includes(String(activated.difficulty))) return false;
  const expected = activateMatrixForDifficulty(value, activated.difficulty as Difficulty);
  return activated.activeCoordination === expected.activeCoordination
    && activated.adverseBias === expected.adverseBias
    && JSON.stringify(activated.activeDisruptions) === JSON.stringify(expected.activeDisruptions)
    && JSON.stringify(activated.activeSecondaryObjective) === JSON.stringify(expected.activeSecondaryObjective);
}

function isMatrixResolutionComponent(value: unknown, ultimate = false) {
  if (!isRecord(value)) return false;
  const allowedKeys = ultimate ? ["ultimate"] : ["contact", "task", "environment", "coordination", "sustainment"];
  const labels: Readonly<Record<string, string>> = {
    contact: "Contact and classification",
    task: "Task and objective fit",
    environment: "Environmental execution",
    coordination: "Coordination contest",
    sustainment: "Sustainment and recovery",
    ultimate: "Ultimate mission matrix",
  };
  return allowedKeys.includes(String(value.key))
    && value.label === labels[String(value.key)]
    && Array.isArray(value.range) && value.range.length === 2 && value.range.every((item) => typeof item === "number" && Number.isFinite(item) && item >= 1 && item <= 99)
    && (value.range[0] as number) <= (value.range[1] as number)
    && typeof value.committedChance === "number" && value.committedChance === clamp(((value.range[0] as number) + (value.range[1] as number)) / 2)
    && Number.isInteger(value.draw) && (value.draw as number) >= 1 && (value.draw as number) <= 100
    && value.result === expectedResult(value.draw as number, value.committedChance as number);
}

export function isResolutionMatrix(value: unknown): value is ResolutionMatrix {
  if (!isRecord(value)) return false;
  return Number.isInteger(value.turn) && (value.turn as number) >= 1 && (value.turn as number) <= 6
    && Array.isArray(value.components) && value.components.length === 5
    && value.components.every((component) => isMatrixResolutionComponent(component))
    && new Set(value.components.map((component) => isRecord(component) ? component.key : undefined)).size === 5
    && isMatrixResolutionComponent(value.ultimate, true);
}

function expectedResult(draw: number, chance: number): MatrixResult {
  return draw <= chance ? "success" : draw <= chance + 12 ? "partial" : "failure";
}

/**
 * Verifies a resolved nested matrix against the scenario's committed draws.
 * When the original inputs are available, every probability and label must be
 * an exact replay. The input-less path exists only for earlier compound saves;
 * it still rejects edited draws, impossible results, labels, and ultimate math.
 */
export function isCanonicalResolutionMatrix(
  matrix: ActivatedScenarioMatrix,
  value: unknown,
  input?: ResolutionMatrixInput,
): value is ResolutionMatrix {
  if (!isResolutionMatrix(value)) return false;
  if (input) return JSON.stringify(value) === JSON.stringify(estimateResolutionMatrix(matrix, input));

  const canonicalLabels: Readonly<Record<MatrixComponentKey | "ultimate", string>> = {
    contact: "Contact and classification",
    task: "Task and objective fit",
    environment: "Environmental execution",
    coordination: "Coordination contest",
    sustainment: "Sustainment and recovery",
    ultimate: "Ultimate mission matrix",
  };
  const turn = value.turn;
  for (const component of value.components) {
    const canonicalDraw = 1 + (hashText(`${matrix.seed}|${turn}|${component.key}|component-draw`) % 100);
    const midpoint = clamp((component.range[0] + component.range[1]) / 2);
    if (component.label !== canonicalLabels[component.key]
      || component.draw !== canonicalDraw
      || component.committedChance !== midpoint
      || component.result !== expectedResult(component.draw, component.committedChance)) return false;
  }
  const active = activeCapabilityFactors(matrix, turn).active;
  const componentAverage = value.components.reduce((sum, component) => sum + component.committedChance, 0) / value.components.length;
  const sharedDependencyPenalty = active.length > 1 ? (active.length - 1) * 3 : 0;
  const secondaryPenalty = matrix.activeSecondaryObjective && turn >= matrix.activeSecondaryObjective.revealTurn
    ? matrix.activeSecondaryObjective.weight * 0.18
    : 0;
  const nestedResultAdjustment = value.components.reduce((sum, component) => sum + (component.result === "success" ? 2.5 : component.result === "failure" ? -3 : 0), 0);
  const canonicalRange = componentRange(componentAverage + nestedResultAdjustment - sharedDependencyPenalty - secondaryPenalty, 0);
  const canonicalChance = clamp((canonicalRange[0] + canonicalRange[1]) / 2);
  return value.ultimate.label === canonicalLabels.ultimate
    && value.ultimate.draw === matrix.committedTurnDraws[turn - 1]
    && value.ultimate.range[0] === canonicalRange[0]
    && value.ultimate.range[1] === canonicalRange[1]
    && value.ultimate.committedChance === canonicalChance
    && value.ultimate.result === expectedResult(value.ultimate.draw, canonicalChance);
}
