import {
  ARMAMENTS as ARMAMENT_CATALOG,
  combinedWaveHeading,
  deriveScenarioEnvironment,
  validateScenarioCoexistence,
  type Climate,
  type Difficulty,
  type EndState,
  type Guardrail,
  type Hemisphere,
  type Scenario,
  type Season,
  type SoundProfile,
  type TheoryLens,
  type Warfare,
} from "./gameModel";
import {
  isCanonicalRigidState,
  isRigidGameState,
  isRigidOrders,
  RIGID_FINDING_CODES,
  RIGID_FINDING_MODULES,
  type RigidDiagnosticFinding,
  type RigidGameState,
  type RigidOrders,
  type RigidOutcome,
  type RigidScoreBreakdown,
  type RigidTurnReport,
} from "./kriegsspiel";
import { AIRCRAFT, PLATFORMS } from "./catalog";
import {
  INPUT_LIMITS,
  isBoundedCleanText,
  isSafeIdentifier,
  parseUntrustedJson,
  sanitizeWrittenDecision,
} from "./inputSecurity";
import { deriveOperationalStrategy, FLEET_METHOD_LABELS, POSTURE_LABELS } from "./operationalStrategy";
import { deriveForceReadiness } from "./forceReadiness";
import { cloudCoverPhrase } from "./weatherPresentation";
import { jsonSemanticEqual } from "./jsonSemantic";
import {
  activateMatrixForDifficulty,
  createScenarioMatrix,
  isResolutionMatrix,
  isResolutionMatrixInput,
  isScenarioMatrix,
  type IllicitNetworkType,
} from "./scenarioMatrix";

export type SavedResult = RigidOutcome;

export type DecisionRecord = {
  id: string;
  at: string;
  exercise: number;
  operation: string;
  region: string;
  context: {
    brief: string;
    objective: string;
    politicalAim: string;
    intelligence: string;
    historicalMode: string;
    geography?: string;
    friendlySituation?: string;
    opposingSituation?: string;
    civilianContext?: string;
    constraints?: string;
    timing?: string;
    successConditions?: string;
    navalProblem?: string;
    climate: string;
    time: string;
    clouds: string;
    precipitation: string;
    seaState: number;
    visibility: number;
    regionId: string;
    hemisphere: Hemisphere;
    observerLatitude: number;
    observerLongitude: number;
    scenarioDate: string;
    season: Season;
    storming: boolean;
    lightningCapable: boolean;
    windHeading: number;
    windSpeed: number;
    currentHeading: number;
    currentSpeed: number;
    waveHeading: number;
    soundProfile: SoundProfile;
    budget: number;
  };
  score: number;
  outcome: string;
  warfare: Warfare[];
  endState: EndState | "";
  theoryLens: TheoryLens | "";
  partnerLens?: TheoryLens | "";
  theorySynthesis?: string;
  guardrail: Guardrail | "";
  rationale: string;
  assumptions: string;
  termination: string;
  fleet: Record<string, number>;
  airWing: Record<string, number>;
  selectedArmaments?: Record<string, number>;
  rigidTurns?: RigidTurnReport[];
  notes: string[];
};

export type PortableSave = {
  format: "fog-of-sea-save";
  version: 3;
  savedAt: string;
  game: {
    scenario: Scenario;
    fleet: Record<string, number>;
    airWing: Record<string, number>;
    selectedArmaments?: Record<string, number>;
    selectedWarfare: Warfare[];
    selectedEndState: EndState | "";
    selectedLens: TheoryLens | "";
    selectedPartnerLens?: TheoryLens | "";
    selectedGuardrail: Guardrail | "";
    theorySynthesis?: string;
    rationale: string;
    assumptions: string;
    termination: string;
    result: SavedResult | null;
    rigidState: RigidGameState | null;
    rigidOrders: RigidOrders | null;
    history: DecisionRecord[];
  };
  preferences: {
    theme: "light" | "dark";
    difficulty: Difficulty;
    planningStage: "strategy" | "force";
    guidance: { checklistCollapsed: boolean };
  };
  academyProgress: string[];
};

/**
 * Browser persistence defaults to the minimum state needed to resume play.
 * Portable TXT exports remain complete so the player can keep their own
 * analysis without silently placing free-form writing in long-lived storage.
 */
export function minimizePortableSaveForBrowser(save: PortableSave): PortableSave {
  return {
    ...save,
    game: {
      ...save.game,
      theorySynthesis: "",
      rationale: "",
      assumptions: "",
      termination: "",
      history: save.game.history.map((entry) => ({
        ...entry,
        theorySynthesis: "",
        rationale: "",
        assumptions: "",
        termination: "",
      })),
    },
  };
}

const MACHINE_START = "--- BEGIN FOG OF SEA MACHINE DATA ---";
const MACHINE_END = "--- END FOG OF SEA MACHINE DATA ---";
const LEGACY_MACHINE_START = "--- BEGIN FOG OF THE SEA MACHINE DATA ---";
const LEGACY_MACHINE_END = "--- END FOG OF THE SEA MACHINE DATA ---";
const ENCODED_MACHINE_PREFIX = "BASE64-UTF8:";

function lastStandaloneMarker(source: string, marker: string, before = source.length) {
  let index = source.lastIndexOf(marker, before);
  while (index >= 0) {
    const after = index + marker.length;
    const startsLine = index === 0 || source[index - 1] === "\n" || source[index - 1] === "\r";
    const endsLine = after === source.length || source[after] === "\n" || source[after] === "\r";
    if (startsLine && endsLine) return index;
    index = source.lastIndexOf(marker, index - 1);
  }
  return -1;
}

function encodeUtf8Base64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function decodeUtf8Base64(value: string) {
  if (value.length > Math.ceil(INPUT_LIMITS.portableSaveBytes * 4 / 3) + 16 || !/^[A-Za-z0-9+/]*={0,2}$/u.test(value)) {
    throw new Error("Encoded save data is invalid or too large.");
  }
  try {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("Encoded save data is invalid.");
  }
}

const LABELS: Record<string, string> = {
  "fleet-aviation-ship": "Fleet aviation ship", "short-deck-aviation-ship": "Short-deck aviation ship", "expeditionary-aviation-dock": "Expeditionary aviation dock", "uncrewed-aviation-ship": "Uncrewed aviation ship", "area-defense-destroyer": "Area-defence destroyer", "multirole-frigate": "Multi-role frigate", "stealth-littoral-corvette": "Stealth littoral corvette", "autonomous-mine-support-ship": "Autonomous mine-support ship", "air-independent-submarine": "Air-independent patrol submarine", "long-endurance-submarine": "Long-endurance attack submarine", "undersea-systems-tender": "Undersea systems tender",
  "deck-multirole-aircraft": "Deck-launched multirole aircraft", "short-takeoff-aircraft": "Short-takeoff multirole aircraft", "electromagnetic-support-aircraft": "Electromagnetic-support aircraft", "fixed-wing-surveillance-aircraft": "Fixed-wing surveillance aircraft", "rotary-surveillance-aircraft": "Rotary-wing surveillance aircraft", "maritime-mission-helicopter": "Maritime mission helicopter", "heavy-utility-rotorcraft": "Heavy utility rotorcraft", "uncrewed-combat-aircraft": "Shipborne uncrewed combat aircraft", "uncrewed-surveillance-rotorcraft": "Uncrewed surveillance rotorcraft", "uncrewed-logistics-aircraft": "Uncrewed logistics aircraft",
  access: "Preserve reliable access", protection: "Protect noncombatants", denial: "Deny hostile control", "limited-compellence": "Compel a limited concession", "status-quo": "Restore the status quo",
  "sun-tzu": "Sun Tzu — shape choices", clausewitz: "Clausewitz — political purpose", mahan: "Mahan — maritime system", aube: "Aube — asymmetric maritime pressure", corbett: "Corbett — limited control", richmond: "Richmond — communications and judgment", wegener: "Wegener — position before battle", castex: "Castex — strategic combinations", panikkar: "Panikkar — regional maritime order", gorshkov: "Gorshkov — comprehensive sea power", "liu-huaqing": "Liu — phased maritime development", till: "Till — maritime order and sea use", galula: "Galula — political legitimacy",
  escalation: "Limit escalation", civilian: "Protect civilian life and traffic", coalition: "Preserve coalition cohesion", legitimacy: "Preserve political legitimacy", sustainability: "Preserve long-term capacity",
  ...Object.fromEntries(ARMAMENT_CATALOG.map((item) => [item.id, item.name])),
};

function label(value: string) {
  return LABELS[value] || value || "Not selected";
}

function nonZeroEntries(values: Record<string, number>) {
  const entries = Object.entries(values).filter(([, value]) => Number.isFinite(value) && value > 0);
  return entries.length ? entries.map(([key, value]) => `${label(key)}: ${value}`).join(", ") : "None";
}

function armamentEntries(values: Record<string, number>) {
  const entries = Object.entries(values).filter(([, value]) => value > 0);
  return entries.length
    ? entries.map(([key, value]) => {
      const item = ARMAMENT_CATALOG.find((candidate) => candidate.id === key);
      return item
        ? `- ${item.name} × ${value}: ${item.role} Notional reach ${item.reach}; tracks ${item.trackCapacity}; tracking ${item.trackingMethods.join(", ")}.`
        : `- ${label(key)} × ${value}`;
    })
    : ["- None selected"];
}

function scenarioLabel(scenario: unknown, key: string, fallback = "Not recorded") {
  if (!scenario || typeof scenario !== "object") return fallback;
  const value = (scenario as Record<string, unknown>)[key];
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : fallback;
}

function signed(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

function rigidTurnLines(turns: RigidTurnReport[], matrix?: RigidGameState["matrix"]) {
  if (!turns.length) return ["No command turns resolved."];
  return turns.flatMap((turn) => [
    `TURN ${turn.turn} — ${turn.phase}`,
    `Orders: formation ${turn.orders.formation}; sensors ${turn.orders.sensors}; tempo ${turn.orders.tempo}; engagement ${turn.orders.engagement}; uncrewed employment ${turn.orders.uncrewed ?? "distributed-scouting"}; undersea employment ${turn.orders.undersea ?? "independent-patrol"}; risk treatment ${turn.orders.riskTreatment ?? "prepare"}; coordination ${turn.orders.coordination ?? "federated"}; strategic force policy ${turn.orders.strategicPolicy ?? "conventional-restraint"}; task ${turn.orders.task}.`,
    `Disclosed contact report: ${turn.contactReport}`,
    `State changes: range ${signed(turn.delta.rangeNm)} nm; contact ${signed(turn.delta.contactQuality)}; readiness ${signed(turn.delta.readiness)}; integrity ${signed(turn.delta.integrity)}; supply ${signed(turn.delta.supply)}; escalation ${signed(turn.delta.escalation)}; primary objective ${signed(turn.delta.objectiveProgress)}${turn.delta.secondaryObjectiveProgress !== undefined ? `; secondary objective ${signed(turn.delta.secondaryObjectiveProgress)}` : ""}.`,
    ...(turn.matrixResolution ? [
      `Ultimate matrix: estimated ${turn.matrixResolution.ultimate.range[0]}–${turn.matrixResolution.ultimate.range[1]}%; committed chance ${turn.matrixResolution.ultimate.committedChance}%; draw ${turn.matrixResolution.ultimate.draw}/100; ${turn.matrixResolution.ultimate.result}.`,
      `Component matrices: ${turn.matrixResolution.components.map((component) => `${component.label} ${component.range[0]}–${component.range[1]}% / draw ${component.draw} / ${component.result}`).join("; ")}.`,
    ] : []),
    ...(turn.activeDisruptionIds?.length ? [
      `Disclosed active disruptions: ${turn.activeDisruptionIds.map((id) => matrix?.activeDisruptions.find((event) => event.id === id)?.headline).filter(Boolean).join("; ") || "effects described in the umpire notes"}.`,
    ] : []),
    ...turn.umpireNotes.map((note) => `- ${note}`),
    "",
  ]);
}

function compoundStateLines(state: RigidGameState | null) {
  if (!state?.matrix) return ["No compound scenario matrix was active."];
  const disclosureTurn = state.phase === "complete" ? state.maxTurns : Math.min(state.maxTurns, state.turn + 1);
  const secondary = state.matrix.activeSecondaryObjective && state.matrix.activeSecondaryObjective.revealTurn <= disclosureTurn
    ? state.matrix.activeSecondaryObjective
    : null;
  const disclosedEvents = state.matrix.activeDisruptions.filter((event) => event.startsTurn <= disclosureTurn
    && (state.phase === "complete"
      || event.kind === "severe-weather"
      || (event.kind === "command-interference" && event.affectedSide === "selected-force")));
  const disclosedEventIds = new Set(disclosedEvents.map((event) => event.id));
  const disclosedImpacts = (state.disruptionImpacts ?? []).filter((impact) => disclosedEventIds.has(impact.disruptionId)
    && (impact.side === "selected-force" || impact.knowledge === "confirmed"));
  return [
    state.phase === "complete"
      ? `Force scale: ${state.matrix.forceScaleLabel}; estimated opposing elements ${state.matrix.estimatedOpposingElements[0]}–${state.matrix.estimatedOpposingElements[1]}; active coordination ${state.matrix.activeCoordination}; play mode ${state.matrix.difficulty}.`
      : `Compound uncertainty is active for ${state.matrix.difficulty} play. Undisclosed opposing details and future commitments are omitted from this readable record.`,
    secondary
      ? `Secondary objective: ${secondary.label}; reveals turn ${secondary.revealTurn}; method ${secondary.method}; progress ${state.secondaryObjectiveProgress ?? 0}/100; ${secondary.description}`
      : "No secondary objective has been disclosed at the current turn.",
    state.phase === "complete" ? "Disruption schedule: complete history." : "Disruption schedule: disclosed history and current windows only.",
    ...(disclosedEvents.length ? disclosedEvents.map((event) => `- ${event.headline}: turns ${event.startsTurn}–${event.endsTurn}; ${event.affectedSide}; domains ${event.affectedDomains.join(", ")}; availability ×${event.availabilityMultiplier}; permanent loss ${Math.round(event.permanentLossFraction * 100)}%; pressure ×${event.opposingPressureMultiplier}. ${event.description}`) : ["- No disruption has been disclosed at the current turn."]),
    "Disclosed impact ledger:",
    ...(disclosedImpacts.length ? disclosedImpacts.map((impact) => `- ${impact.quantity} × ${impact.label}: ${impact.status}; ${impact.unavailableThroughTurn === undefined ? "permanent impairment" : `unavailable through turn ${impact.unavailableThroughTurn}`}; capabilities ${impact.capabilitiesUnavailable.join(", ")}; information ${impact.knowledge}.`) : ["- No selected-force capacity impairment was recorded; unconfirmed opposing losses are omitted."]),
  ];
}

function writeRecord(record: DecisionRecord, index: number) {
  return [
    `DECISION RECORD ${index + 1}`,
    `Time: ${record.at}`,
    `Exercise: ${record.exercise} — ${record.operation}`,
    `Region: ${record.region}`,
    `Environment: ${record.context.climate}; ${record.context.season || "season not recorded"}; ${record.context.scenarioDate || "date not recorded"}; ${record.context.time}; ${record.context.precipitation}; ${cloudCoverPhrase(record.context.clouds)}; sea state ${record.context.seaState}; visibility ${record.context.visibility} nm`,
    `Environmental motion: wind toward ${record.context.windHeading}° at ${record.context.windSpeed} knots; current toward ${record.context.currentHeading}° at ${record.context.currentSpeed} knots; waves toward ${record.context.waveHeading}°; ${record.context.storming ? "storm" : "no storm"}; ${record.context.lightningCapable ? "static lightning geometry and localized eased non-flashing cloud light available" : "no lightning geometry"}; sound profile ${record.context.soundProfile}.`,
    `Budget: ${record.context.budget} points`,
    `Political aim: ${record.context.politicalAim}`,
    `Objective: ${record.context.objective}`,
    `Brief: ${record.context.brief}`,
    `Geography and chokepoints: ${record.context.geography || "Not recorded"}`,
    `Friendly situation: ${record.context.friendlySituation || "Not recorded"}`,
    `Opposing situation: ${record.context.opposingSituation || "Not recorded"}`,
    `Civilian and neutral context: ${record.context.civilianContext || "Not recorded"}`,
    `Intelligence: ${record.context.intelligence}`,
    `Constraints: ${record.context.constraints || "Not recorded"}`,
    `Timing: ${record.context.timing || "Not recorded"}`,
    `Success conditions: ${record.context.successConditions || "Not recorded"}`,
    `Comparative maritime-theory problem: ${record.context.navalProblem || "Not recorded"}`,
    `Historical mode: ${record.context.historicalMode}`,
    `Outcome: ${record.outcome} (${record.score}/100)`,
    `Warfare areas: ${record.warfare.join(", ") || "None selected"}`,
    `End state: ${label(record.endState)}`,
    `Theory lens: ${label(record.theoryLens)}`,
    `Complement or challenge: ${label(record.partnerLens || "")}`,
    `Guardrail: ${label(record.guardrail)}`,
    `Fleet: ${nonZeroEntries(record.fleet)}`,
    `Embarked aviation: ${nonZeroEntries(record.airWing)}`,
    `Selected armament packs: ${nonZeroEntries(record.selectedArmaments || {})}`,
    "",
    "SELECTED NOTIONAL ARMAMENT PACKS",
    ...armamentEntries(record.selectedArmaments || {}),
    "",
    "RIGID UMPIRE TURN RECORD",
    ...rigidTurnLines(record.rigidTurns || []),
    "",
    "OPTIONAL NAVAL-THEORY SYNTHESIS — NEVER SCORED",
    record.theorySynthesis || "No synthesis recorded.",
    "",
    "COMMANDER'S LOGIC",
    record.rationale || "No rationale recorded.",
    "",
    "KEY ASSUMPTIONS",
    record.assumptions || "No assumptions recorded.",
    "",
    "TERMINATION / TRANSITION CRITERIA",
    record.termination || "No criteria recorded.",
    "",
    "UMPIRE NOTES",
    ...record.notes.map((note) => `- ${note}`),
  ].join("\n");
}

export function formatPortableSave(save: PortableSave) {
  const current = save.game;
  const concealCommittedFuture = Boolean(current.scenario.matrix) && current.rigidState?.phase !== "complete";
  const completedCompoundFrame = current.rigidState?.phase === "complete" && current.scenario.matrix;
  const secondaryDisclosed = current.rigidState?.matrix?.activeSecondaryObjective
    && (current.rigidState.phase === "complete"
      || current.rigidState.matrix.activeSecondaryObjective.revealTurn <= Math.min(current.rigidState.maxTurns, current.rigidState.turn + 1));
  const machineJson = JSON.stringify(save, null, 2);
  const machinePayload = concealCommittedFuture
    ? `${ENCODED_MACHINE_PREFIX}${encodeUtf8Base64(machineJson)}`
    : machineJson;
  const operational = deriveOperationalStrategy(current.scenario);
  const report = [
    "FOG OF SEA — INDEPENDENT FICTIONAL EDUCATIONAL SIMULATION",
    "Human-readable decision record with an embedded machine-readable save.",
    "This file remains on the user's device unless the user chooses to move it.",
    concealCommittedFuture ? "The resume payload is encoded for casual spoiler resistance. Encoding is not encryption, and this local-only app cannot protect state from a source-inspecting player." : "",
    "",
    `Saved: ${save.savedAt}`,
    `Current exercise: ${scenarioLabel(current.scenario, "id")} — ${scenarioLabel(current.scenario, "operation")}`,
    `Region: ${scenarioLabel(current.scenario, "region")}`,
    `Difficulty: ${save.preferences.difficulty}`,
    `Planning stage: ${save.preferences.planningStage}`,
    `Environment: ${scenarioLabel(current.scenario, "climate")}; ${scenarioLabel(current.scenario, "season")}; ${scenarioLabel(current.scenario, "scenarioDate")}; ${scenarioLabel(current.scenario, "time")}; ${scenarioLabel(current.scenario, "precipitation")}; clouds ${scenarioLabel(current.scenario, "clouds")}; sea state ${scenarioLabel(current.scenario, "seaState")}; visibility ${scenarioLabel(current.scenario, "visibility")} nm`,
    `Environmental motion: wind toward ${scenarioLabel(current.scenario, "windHeading")}° at ${scenarioLabel(current.scenario, "windSpeed")} knots; current toward ${scenarioLabel(current.scenario, "currentHeading")}° at ${scenarioLabel(current.scenario, "currentSpeed")} knots; waves toward ${scenarioLabel(current.scenario, "waveHeading")}°; storm ${scenarioLabel(current.scenario, "storming", "false")}; static lightning geometry with localized eased non-flashing cloud light available ${scenarioLabel(current.scenario, "lightningCapable", "false")}; sound profile ${scenarioLabel(current.scenario, "soundProfile")}.`,
    ...(completedCompoundFrame ? [
      `Compound frame: ${completedCompoundFrame.forceScaleLabel}; estimated opposing elements ${completedCompoundFrame.estimatedOpposingElements[0]}–${completedCompoundFrame.estimatedOpposingElements[1]}; assessed coordination ${completedCompoundFrame.opponentCoordination}; institutional constraint ${completedCompoundFrame.institutionalConstraint}${current.scenario.illicitNetworkType ? `; illicit-network category ${current.scenario.illicitNetworkType}` : ""}.`,
      "The completed turn record discloses the committed outcomes used during play.",
    ] : current.scenario.matrix ? [
      "Compound uncertainty is precommitted. Undisclosed opposing details, future events, and future draws are omitted from this readable record.",
    ] : []),
    `Budget: ${scenarioLabel(current.scenario, "budget")} points`,
    `Political aim: ${scenarioLabel(current.scenario, "politicalAim")}`,
    `Objective: ${scenarioLabel(current.scenario, "objective")}`,
    `Brief: ${scenarioLabel(current.scenario, "brief")}`,
    `Geography and chokepoints: ${scenarioLabel(current.scenario, "geography")}`,
    `Friendly situation: ${scenarioLabel(current.scenario, "friendlySituation")}`,
    `Opposing situation: ${scenarioLabel(current.scenario, "opposingSituation")}`,
    `Civilian and neutral context: ${scenarioLabel(current.scenario, "civilianContext")}`,
    `Intelligence: ${scenarioLabel(current.scenario, "intelligence")}`,
    `Constraints: ${scenarioLabel(current.scenario, "constraints")}`,
    `Timing: ${scenarioLabel(current.scenario, "timing")}`,
    `Success conditions: ${scenarioLabel(current.scenario, "successConditions")}`,
    `Comparative maritime-theory problem: ${scenarioLabel(current.scenario, "navalProblem")}`,
    `Friendly operating method: ${FLEET_METHOD_LABELS[operational.friendlyMethod]}; ${POSTURE_LABELS[operational.friendlyPosture]}.`,
    `Assessed opposing method: ${FLEET_METHOD_LABELS[operational.opposingMethod]}; ${POSTURE_LABELS[operational.opposingPosture]}.`,
    `Environment-suited uncrewed and undersea methods: ${operational.recommendedUncrewed}; ${operational.recommendedUndersea}.`,
    `Historical mode: ${scenarioLabel(current.scenario, "history")}`,
    `Warfare areas: ${current.selectedWarfare.join(", ") || "None selected"}`,
    `End state: ${label(current.selectedEndState)}`,
    `Theory lens: ${label(current.selectedLens)}`,
    `Complement or challenge: ${label(current.selectedPartnerLens || "")}`,
    `Guardrail: ${label(current.selectedGuardrail)}`,
    `Fleet: ${nonZeroEntries(current.fleet)}`,
    `Embarked aviation: ${nonZeroEntries(current.airWing)}`,
    `Selected armament packs: ${nonZeroEntries(current.selectedArmaments || {})}`,
    "",
    "CURRENT SELECTED NOTIONAL ARMAMENT PACKS",
    ...armamentEntries(current.selectedArmaments || {}),
    "",
    "CURRENT RIGID UMPIRE STATE",
    current.rigidState
      ? `Turn ${current.rigidState.turn}/${current.rigidState.maxTurns}; ${current.rigidState.phase}; range ${current.rigidState.rangeNm} nm; contact ${current.rigidState.contactQuality}; readiness ${current.rigidState.readiness}; integrity ${current.rigidState.integrity}; supply ${current.rigidState.supply}; escalation ${current.rigidState.escalation}; primary objective ${current.rigidState.objectiveProgress}${secondaryDisclosed ? `; secondary objective ${current.rigidState.secondaryObjectiveProgress ?? 0}` : ""}.`
      : "Not started.",
    ...compoundStateLines(current.rigidState),
    ...rigidTurnLines(current.rigidState?.reports || [], current.rigidState?.matrix),
    "",
    "CURRENT OPTIONAL NAVAL-THEORY SYNTHESIS — NEVER SCORED",
    current.theorySynthesis || "No synthesis recorded.",
    "",
    "CURRENT COMMANDER'S LOGIC",
    current.rationale || "No rationale recorded.",
    "",
    "CURRENT KEY ASSUMPTIONS",
    current.assumptions || "No assumptions recorded.",
    "",
    "CURRENT TERMINATION / TRANSITION CRITERIA",
    current.termination || "No criteria recorded.",
    "",
    "ADJUDICATION HISTORY",
    current.history.length ? current.history.map(writeRecord).join("\n\n========================================\n\n") : "No adjudications recorded.",
    "",
    MACHINE_START,
    machinePayload,
    MACHINE_END,
    "",
  ];
  return report.join("\n");
}

const PLATFORM_IDS = new Set(PLATFORMS.map((item) => item.id));
const AIRCRAFT_IDS = new Set(AIRCRAFT.map((item) => item.id));
const ARMAMENT_IDS = new Set(ARMAMENT_CATALOG.map((item) => item.id));

function isNumberRecord(value: unknown, allowedIds: ReadonlySet<string>): value is Record<string, number> {
  return isRecord(value)
    && Object.keys(value).every((key) => allowedIds.has(key))
    && Object.values(value).every((item) => typeof item === "number" && Number.isInteger(item) && item >= 0 && item <= 99);
}

function isStringArray(value: unknown, maximumItems: number = 200, maximumLength: number = INPUT_LIMITS.recordText): value is string[] {
  return Array.isArray(value)
    && value.length <= maximumItems
    && value.every((item) => isBoundedCleanText(item, maximumLength));
}

function isListedValue<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === "string" && values.some((candidate) => candidate === value);
}

const WARFARE_AREAS = ["air-defense", "surface-operations", "undersea-operations", "land-attack", "electromagnetic-operations", "reconnaissance", "mine-countermeasures", "missile-defense", "maritime-interdiction"] as const satisfies readonly Warfare[];
const CLIMATES: Climate[] = ["ocean", "arctic", "antarctic"];
const TIMES = ["dawn", "day", "dusk", "night"] as const;
const CLOUDS = ["clear", "scattered", "broken", "overcast"] as const;
const PRECIPITATION = ["none", "rain", "snow"] as const;
const SEASONS: Season[] = ["winter", "spring", "summer", "autumn", "wet", "dry"];
const HEMISPHERES: Hemisphere[] = ["north", "south"];
const SOUND_PROFILES: SoundProfile[] = ["island-arc", "equatorial-current", "temperate-strait", "boreal-ice", "polar-archipelago", "southern-ice", "austral-corridor"];
const CURRENT_SPEED_RANGES: Record<SoundProfile, readonly [number, number]> = {
  "island-arc": [0.5, 1.6],
  "equatorial-current": [1.2, 2.8],
  "temperate-strait": [0.7, 2.2],
  "boreal-ice": [0.3, 1.1],
  "polar-archipelago": [0.2, 0.9],
  "southern-ice": [0.5, 1.5],
  "austral-corridor": [0.4, 1.2],
};
const DIFFICULTIES = ["guided", "standard", "challenge"] as const satisfies readonly Difficulty[];
const END_STATES = ["access", "protection", "denial", "limited-compellence", "status-quo"] as const satisfies readonly EndState[];
const GUARDRAILS = ["escalation", "civilian", "coalition", "legitimacy", "sustainability"] as const satisfies readonly Guardrail[];
const THEORY_LENSES = ["sun-tzu", "clausewitz", "mahan", "aube", "corbett", "richmond", "wegener", "castex", "panikkar", "gorshkov", "liu-huaqing", "till", "galula"] as const satisfies readonly TheoryLens[];
const SCENARIO_TEXT_KEYS = [
  "operation", "region", "brief", "geography", "friendlySituation", "opposingSituation",
  "civilianContext", "constraints", "timing", "successConditions", "navalProblem", "objective",
  "intelligence", "history", "politicalAim",
] as const;
const LEGACY_OPTIONAL_SCENARIO_TEXT_KEYS = ["geography", "friendlySituation", "opposingSituation", "civilianContext", "constraints", "timing", "successConditions", "navalProblem"] as const;
const MAX_DECISION_HISTORY = 200;
const SCENARIO_KEYS = new Set([
  "id", "operation", "region", "climate", "time", "clouds", "precipitation", "seaState", "visibility",
  "regionId", "hemisphere", "observerLatitude", "observerLongitude", "scenarioDate", "season", "storming",
  "lightningCapable", "windHeading", "windSpeed", "currentHeading", "currentSpeed", "waveHeading", "soundProfile",
  "budget", "brief", "geography", "friendlySituation", "opposingSituation", "adversaryCount", "matrix",
  "illicitNetworkType", "civilianContext", "constraints", "timing", "successConditions", "navalProblem",
  "objective", "intelligence", "history", "required", "recommended", "minimumEscort", "minimumAirDefense",
  "minimumAsw", "minimumUncrewed", "politicalAim", "endState", "lenses", "guardrail",
]);

function hasOnlyKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>) {
  return Object.keys(value).every((key) => allowed.has(key));
}

function isWarfareArea(value: unknown): value is Warfare {
  return isListedValue(value, WARFARE_AREAS);
}

function isWarfareArray(value: unknown): value is Warfare[] {
  return Array.isArray(value)
    && value.length <= WARFARE_AREAS.length
    && value.every(isWarfareArea)
    && new Set(value).size === value.length;
}

function isDifficulty(value: unknown): value is Difficulty {
  return isListedValue(value, DIFFICULTIES);
}

function isEndState(value: unknown): value is EndState {
  return isListedValue(value, END_STATES);
}

function isTheoryLens(value: unknown): value is TheoryLens {
  return isListedValue(value, THEORY_LENSES);
}

function isGuardrail(value: unknown): value is Guardrail {
  return isListedValue(value, GUARDRAILS);
}

function parseOptionalEnumerated<T extends string>(
  value: unknown,
  validator: (candidate: unknown) => candidate is T,
  errorMessage: string,
): T | "" {
  if (value === "") return "";
  if (validator(value)) return value;
  throw new Error(errorMessage);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isIntegerBetween(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= minimum && value <= maximum;
}

function isNumberBetween(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum;
}

function isHeading(value: unknown) {
  return isIntegerBetween(value, 0, 359);
}

function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isIsoInstant(value: unknown): value is string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return false;
  return new Date(value).toISOString() === value;
}

function isUniqueStringArray(value: unknown, validator: (item: string) => boolean) {
  return isStringArray(value) && new Set(value).size === value.length && value.every(validator);
}

function expectedSeasonMonth(season: Season, hemisphere: Hemisphere) {
  const north: Record<Season, number> = { winter: 11, spring: 4, summer: 8, autumn: 10, wet: 5, dry: 1 };
  const south: Record<Season, number> = { winter: 5, spring: 10, summer: 2, autumn: 4, wet: 11, dry: 7 };
  return (hemisphere === "north" ? north : south)[season];
}

function hasCoherentSeasonDate(date: string, season: Season, hemisphere: Hemisphere, exerciseId: number) {
  return Number(date.slice(0, 4)) === 2028 + exerciseId % 5
    && Number(date.slice(5, 7)) === expectedSeasonMonth(season, hemisphere);
}

function hasCoherentWeather(environment: Record<string, unknown>) {
  const climate = environment.climate as Climate;
  const season = environment.season as Season;
  const precipitation = environment.precipitation;
  const storming = environment.storming;
  const lightningCapable = environment.lightningCapable;
  if (climate === "ocean" ? precipitation === "snow" : precipitation === "rain") return false;
  if (precipitation !== "none" && environment.clouds !== "broken" && environment.clouds !== "overcast") return false;
  if (storming && (
    precipitation === "none"
    || environment.clouds !== "overcast"
    || !isIntegerBetween(environment.seaState, 5, 7)
    || !isIntegerBetween(environment.visibility, 2, 4)
    || !isIntegerBetween(environment.windSpeed, 30, 48)
  )) return false;
  if (!storming && !isIntegerBetween(environment.windSpeed, climate === "ocean" ? 8 : 10, climate === "ocean" ? 27 : 31)) return false;
  const shouldSupportLightning = storming === true
    && climate === "ocean"
    && (season === "wet" || season === "summer" || season === "autumn");
  return lightningCapable === shouldSupportLightning;
}

function hasCoherentRegionalEnvironment(environment: Record<string, unknown>, exerciseId: number, region: string, climate: Climate) {
  const derived = deriveScenarioEnvironment({ id: exerciseId, region, climate });
  const stableIdentity = environment.regionId === derived.regionId
    && environment.hemisphere === derived.hemisphere
    && environment.observerLatitude === derived.observerLatitude
    && environment.observerLongitude === derived.observerLongitude
    && environment.soundProfile === derived.soundProfile;
  if (!stableIdentity) return false;
  const hemisphere = environment.hemisphere as Hemisphere;
  const season = environment.season as Season;
  const date = environment.scenarioDate as string;
  if ((hemisphere === "north" && Number(environment.observerLatitude) < 0) || (hemisphere === "south" && Number(environment.observerLatitude) > 0)) return false;
  if ((environment.soundProfile === "equatorial-current") !== (season === "wet" || season === "dry")) return false;
  if (!hasCoherentSeasonDate(date, season, hemisphere, exerciseId)) return false;
  return environment.waveHeading === combinedWaveHeading(
    environment.windHeading as number,
    environment.windSpeed as number,
    environment.currentHeading as number,
    environment.currentSpeed as number,
  );
}

function hasStrictEnvironmentFields(environment: Record<string, unknown>, exerciseId: number, region: string, climate: Climate) {
  const soundProfile = environment.soundProfile as SoundProfile;
  const currentRange = CURRENT_SPEED_RANGES[soundProfile];
  return typeof environment.regionId === "string" && environment.regionId.length > 0
    && HEMISPHERES.includes(environment.hemisphere as Hemisphere)
    && isNumberBetween(environment.observerLatitude, -90, 90)
    && isNumberBetween(environment.observerLongitude, -180, 180)
    && isCalendarDate(environment.scenarioDate)
    && SEASONS.includes(environment.season as Season)
    && typeof environment.storming === "boolean"
    && typeof environment.lightningCapable === "boolean"
    && isHeading(environment.windHeading)
    && isIntegerBetween(environment.windSpeed, 0, 60)
    && isHeading(environment.currentHeading)
    && Boolean(currentRange)
    && isNumberBetween(environment.currentSpeed, currentRange?.[0] ?? 0, currentRange?.[1] ?? 0)
    && Math.abs((environment.currentSpeed as number) * 10 - Math.round((environment.currentSpeed as number) * 10)) < 1e-8
    && isHeading(environment.waveHeading)
    && SOUND_PROFILES.includes(soundProfile)
    && hasCoherentWeather(environment)
    && hasCoherentRegionalEnvironment(environment, exerciseId, region, climate);
}

function hasScenarioCore(value: unknown, strictText: boolean): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  const requiredTextKeys = strictText ? SCENARIO_TEXT_KEYS : SCENARIO_TEXT_KEYS.filter((key) => !LEGACY_OPTIONAL_SCENARIO_TEXT_KEYS.includes(key as typeof LEGACY_OPTIONAL_SCENARIO_TEXT_KEYS[number]));
  if (!requiredTextKeys.every((key) => isBoundedCleanText(value[key], INPUT_LIMITS.scenarioText) && (value[key] as string).trim().length > 0)) return false;
  if (!strictText && !LEGACY_OPTIONAL_SCENARIO_TEXT_KEYS.every((key) => value[key] === undefined || isBoundedCleanText(value[key], INPUT_LIMITS.scenarioText))) return false;
  const climate = value.climate as Climate;
  return isIntegerBetween(value.id, 1, 999_999_999)
    && CLIMATES.includes(climate)
    && TIMES.includes(value.time as typeof TIMES[number])
    && CLOUDS.includes(value.clouds as typeof CLOUDS[number])
    && PRECIPITATION.includes(value.precipitation as typeof PRECIPITATION[number])
    && isIntegerBetween(value.seaState, 1, 7)
    && isIntegerBetween(value.visibility, 1, 20)
    && isNumberBetween(value.budget, 0, 1_000)
    && isIntegerBetween(value.minimumEscort, 0, 20)
    && isIntegerBetween(value.minimumAirDefense, 0, 20)
    && isIntegerBetween(value.minimumAsw, 0, 20)
    && isIntegerBetween(value.minimumUncrewed, 0, 50)
    && isEndState(value.endState)
    && isGuardrail(value.guardrail)
    && isUniqueStringArray(value.required, isWarfareArea)
    && isUniqueStringArray(value.recommended, isWarfareArea)
    && (value.recommended as string[]).every((item) => !(value.required as string[]).includes(item))
    && isUniqueStringArray(value.lenses, isTheoryLens)
    && (value.adversaryCount === undefined || isIntegerBetween(value.adversaryCount, 1, 3))
    && (value.matrix === undefined || isScenarioMatrix(value.matrix))
    && (value.illicitNetworkType === undefined || [
      "trafficking-in-persons", "forced-labor", "arms", "controlled-contraband", "wildlife",
      "cultural-property", "stolen-goods", "sanctions-evasion", "mixed",
    ].includes(value.illicitNetworkType as IllicitNetworkType));
}

function isScenarioV3(value: unknown): value is Scenario {
  if (!hasScenarioCore(value, true) || value.budget !== 100 || !hasOnlyKeys(value, SCENARIO_KEYS)) return false;
  const climate = value.climate as Climate;
  if (!hasStrictEnvironmentFields(value, value.id as number, value.region as string, climate)) return false;
  if (value.matrix !== undefined) {
    const expected = createScenarioMatrix({
      exerciseId: value.id as number,
      climate,
      regionId: value.regionId as string,
      season: value.season as Season,
      adversaryCount: value.adversaryCount as number | undefined,
    });
    if (!jsonSemanticEqual(value.matrix, expected)) return false;
    if (value.illicitNetworkType !== undefined && value.illicitNetworkType !== expected.illicitNetworkType) return false;
  }
  return validateScenarioCoexistence(value as Scenario).valid;
}

function usableHeading(value: unknown, fallback: number) {
  return isHeading(value) ? value as number : fallback;
}

function usableCurrentSpeed(value: unknown, fallback: number, soundProfile: SoundProfile) {
  const [minimum, maximum] = CURRENT_SPEED_RANGES[soundProfile];
  return isNumberBetween(value, minimum, maximum) && Math.abs((value as number) * 10 - Math.round((value as number) * 10)) < 1e-8 ? value as number : fallback;
}

function legacySeasonAndDate(value: Record<string, unknown>, derived: ReturnType<typeof deriveScenarioEnvironment>, exerciseId: number) {
  if (SEASONS.includes(value.season as Season)
    && HEMISPHERES.includes(derived.hemisphere)
    && isCalendarDate(value.scenarioDate)
    && hasCoherentSeasonDate(value.scenarioDate, value.season as Season, derived.hemisphere, exerciseId)
    && ((derived.soundProfile === "equatorial-current") === (value.season === "wet" || value.season === "dry"))) {
    return { season: value.season as Season, scenarioDate: value.scenarioDate };
  }
  return { season: derived.season, scenarioDate: derived.scenarioDate };
}

function migrateLegacyScenario(value: unknown): Scenario | null {
  if (!hasScenarioCore(value, false)) return null;
  const id = value.id as number;
  const climate = value.climate as Climate;
  const region = value.region as string;
  const derived = deriveScenarioEnvironment({ id, region, climate });
  const { season, scenarioDate } = legacySeasonAndDate(value, derived, id);
  const weatherSupportsStorm = value.precipitation !== "none"
    && value.clouds === "overcast"
    && isIntegerBetween(value.seaState, 5, 7)
    && isIntegerBetween(value.visibility, 2, 4);
  const storming = (typeof value.storming === "boolean" ? value.storming : derived.storming) && weatherSupportsStorm;
  const calmMinimum = climate === "ocean" ? 8 : 10;
  const calmMaximum = climate === "ocean" ? 27 : 31;
  const candidateWindSpeed = isIntegerBetween(value.windSpeed, storming ? 30 : calmMinimum, storming ? 48 : calmMaximum)
    ? value.windSpeed as number
    : derived.windSpeed;
  const windSpeed = storming
    ? (isIntegerBetween(candidateWindSpeed, 30, 48) ? candidateWindSpeed : 30 + id % 19)
    : (isIntegerBetween(candidateWindSpeed, calmMinimum, calmMaximum) ? candidateWindSpeed : Math.min(calmMaximum, Math.max(calmMinimum, (value.seaState as number) * 6)));
  const windHeading = usableHeading(value.windHeading, derived.windHeading);
  const currentHeading = usableHeading(value.currentHeading, derived.currentHeading);
  const currentSpeed = usableCurrentSpeed(value.currentSpeed, derived.currentSpeed, derived.soundProfile);
  const migrated = {
    ...value,
    budget: 100,
    regionId: derived.regionId,
    hemisphere: derived.hemisphere,
    observerLatitude: derived.observerLatitude,
    observerLongitude: derived.observerLongitude,
    scenarioDate,
    season,
    storming,
    lightningCapable: storming && climate === "ocean" && (season === "wet" || season === "summer" || season === "autumn"),
    windHeading,
    windSpeed,
    currentHeading,
    currentSpeed,
    waveHeading: combinedWaveHeading(windHeading, windSpeed, currentHeading, currentSpeed),
    soundProfile: derived.soundProfile,
    geography: typeof value.geography === "string" ? value.geography : "Not recorded in this earlier save.",
    friendlySituation: typeof value.friendlySituation === "string" ? value.friendlySituation : "Not recorded in this earlier save.",
    opposingSituation: typeof value.opposingSituation === "string" ? value.opposingSituation : "Not recorded in this earlier save.",
    civilianContext: typeof value.civilianContext === "string" ? value.civilianContext : "Not recorded in this earlier save.",
    constraints: typeof value.constraints === "string" ? value.constraints : "Not recorded in this earlier save.",
    timing: typeof value.timing === "string" ? value.timing : "Not recorded in this earlier save.",
    successConditions: typeof value.successConditions === "string" ? value.successConditions : "Not recorded in this earlier save.",
    navalProblem: typeof value.navalProblem === "string" ? value.navalProblem : "Compare at least two theories and explain how their mechanisms combine.",
  };
  return isScenarioV3(migrated) ? migrated : null;
}

const OUTCOME_TITLES: RigidOutcome["title"][] = ["DECISIVE VICTORY", "LIMITED SUCCESS", "MISSION UNRESOLVED", "MISSION LOSS"];
function isScoreBreakdown(value: unknown, score: number): value is RigidScoreBreakdown {
  if (!isRecord(value)) return false;
  const keys: Array<keyof RigidScoreBreakdown> = [
    "objective", "opposingDisruption", "forceIntegrity", "commandReadiness", "supply", "contactQuality",
    "escalationDiscipline", "planning", "total", "victoryThreshold", "objectiveThreshold", "integrityThreshold",
    "supplyThreshold", "escalationLimit",
  ];
  return keys.every((key) => isNumberBetween(value[key], 0, 100)) && value.total === score;
}

function isDiagnosticFinding(value: unknown): value is RigidDiagnosticFinding {
  if (!isRecord(value)) return false;
  return RIGID_FINDING_CODES.includes(value.code as RigidDiagnosticFinding["code"])
    && RIGID_FINDING_MODULES.includes(value.moduleId as RigidDiagnosticFinding["moduleId"])
    && ["cause", "evidence", "adjustment"].every((key) => isBoundedCleanText(value[key], INPUT_LIMITS.recordText) && (value[key] as string).trim().length > 0);
}

type LegacySavedResult = Pick<SavedResult, "won" | "score" | "title" | "notes">;

function isLegacySavedResult(value: unknown): value is LegacySavedResult | null {
  if (value === null) return true;
  if (!isRecord(value)) return false;
  return typeof value.won === "boolean"
    && typeof value.score === "number"
    && Number.isFinite(value.score)
    && typeof value.title === "string"
    && isStringArray(value.notes);
}

function isSavedResult(value: unknown): value is SavedResult | null {
  if (value === null) return true;
  if (!isRecord(value)) return false;
  return typeof value.won === "boolean"
    && isNumberBetween(value.score, 0, 100)
    && isListedValue(value.title, OUTCOME_TITLES)
    && isStringArray(value.notes)
    && isDifficulty(value.difficulty)
    && isScoreBreakdown(value.breakdown, value.score)
    && Array.isArray(value.findings)
    && value.findings.length <= RIGID_FINDING_CODES.length
    && value.findings.every(isDiagnosticFinding)
    && new Set(value.findings.map((finding) => (finding as RigidDiagnosticFinding).code)).size === value.findings.length;
}

function legacyResult(value: LegacySavedResult | null, difficulty: Difficulty, scenario: Scenario): SavedResult | null {
  if (value === null) return null;
  const score = Math.max(0, Math.min(100, value.score));
  const thresholds = {
    guided: { victory: 64, objective: 62, integrity: 30, supply: 10, escalation: 6 },
    standard: { victory: 70, objective: 70, integrity: 35, supply: 15, escalation: 0 },
    challenge: { victory: 76, objective: 76, integrity: 42, supply: 20, escalation: -5 },
  }[difficulty];
  const constrainedGuardrail = scenario.guardrail === "escalation" || scenario.guardrail === "civilian" || scenario.guardrail === "legitimacy";
  return {
    won: value.won,
    score,
    title: isListedValue(value.title, OUTCOME_TITLES)
      ? value.title
      : score >= 88 ? "DECISIVE VICTORY" : score >= 70 ? "LIMITED SUCCESS" : score >= 60 ? "MISSION UNRESOLVED" : "MISSION LOSS",
    difficulty,
    breakdown: {
      objective: 0,
      opposingDisruption: 0,
      forceIntegrity: 0,
      commandReadiness: 0,
      supply: 0,
      contactQuality: 0,
      escalationDiscipline: 0,
      planning: 0,
      total: score,
      victoryThreshold: thresholds.victory,
      objectiveThreshold: thresholds.objective,
      integrityThreshold: thresholds.integrity,
      supplyThreshold: thresholds.supply,
      escalationLimit: Math.max(0, (constrainedGuardrail ? 36 : 55) + thresholds.escalation),
    },
    findings: [],
    notes: value.notes,
  };
}

function migrateLegacyCompletedState(
  value: unknown,
  gameResult: SavedResult | null,
  difficulty: Difficulty,
  scenario: Scenario,
) {
  const rigidState = value ?? null;
  if (!isRecord(rigidState) || rigidState.phase !== "complete") return { rigidState, result: gameResult };
  if (rigidState.outcome === null || !isLegacySavedResult(rigidState.outcome)) return { rigidState, result: gameResult };
  const nestedResult = legacyResult(rigidState.outcome, difficulty, scenario);
  const result = gameResult ?? nestedResult;
  return {
    rigidState: { ...rigidState, outcome: result },
    result,
  };
}

type LegacyDecisionContext = {
  brief: string;
  objective: string;
  politicalAim: string;
  intelligence: string;
  historicalMode: string;
  geography?: string;
  friendlySituation?: string;
  opposingSituation?: string;
  civilianContext?: string;
  constraints?: string;
  timing?: string;
  successConditions?: string;
  navalProblem?: string;
  climate: string;
  time: string;
  clouds: string;
  precipitation: string;
  seaState: number;
  visibility: number;
  budget: number;
  [key: string]: unknown;
};

type LegacyDecisionRecord = {
  id: string;
  at: string;
  exercise: number;
  operation: string;
  region: string;
  context: LegacyDecisionContext;
  score: number;
  outcome: string;
  warfare: Warfare[];
  endState: string;
  theoryLens: string;
  partnerLens?: string;
  theorySynthesis?: string;
  guardrail: string;
  rationale: string;
  assumptions: string;
  termination: string;
  fleet: Record<string, number>;
  airWing: Record<string, number>;
  selectedArmaments?: Record<string, number>;
  rigidTurns?: RigidTurnReport[];
  notes: string[];
  [key: string]: unknown;
};

function hasDecisionRecordCore(value: unknown, strictScore: boolean): value is LegacyDecisionRecord {
  if (!isRecord(value)) return false;
  const record = value;
  const stringKeys = ["id", "at", "operation", "region", "outcome", "endState", "theoryLens", "guardrail", "rationale", "assumptions", "termination"];
  const context = record.context as Record<string, unknown> | undefined;
  const contextStrings = ["brief", "objective", "politicalAim", "intelligence", "historicalMode", "climate", "time", "clouds", "precipitation"];
  const optionalContextStrings = ["geography", "friendlySituation", "opposingSituation", "civilianContext", "constraints", "timing", "successConditions", "navalProblem"];
  const validRigidTurns = record.rigidTurns === undefined || Array.isArray(record.rigidTurns) && record.rigidTurns.length <= 6 && record.rigidTurns.every((value, index) => {
    if (!value || typeof value !== "object") return false;
    const turn = value as Record<string, unknown>;
    const delta = turn.delta as Record<string, unknown> | undefined;
    return turn.turn === index + 1 && isRigidOrders(turn.orders) && isBoundedCleanText(turn.phase, INPUT_LIMITS.recordText) && isBoundedCleanText(turn.contactReport, INPUT_LIMITS.recordText)
      && isStringArray(turn.umpireNotes)
      && Boolean(delta) && ["rangeNm", "contactQuality", "readiness", "integrity", "supply", "escalation", "objectiveProgress", "opposingCohesion"].every((key) => typeof delta?.[key] === "number" && Number.isFinite(delta[key] as number))
      && (delta?.secondaryObjectiveProgress === undefined || typeof delta.secondaryObjectiveProgress === "number" && Number.isFinite(delta.secondaryObjectiveProgress))
      && (turn.matrixInput === undefined || isResolutionMatrixInput(turn.matrixInput))
      && (turn.matrixResolution === undefined || isResolutionMatrix(turn.matrixResolution))
      && (turn.activeDisruptionIds === undefined || isStringArray(turn.activeDisruptionIds, 5, 100));
  });
  const validContext = context
    ? contextStrings.every((key) => isBoundedCleanText(context[key], INPUT_LIMITS.scenarioText))
      && optionalContextStrings.every((key) => context[key] === undefined || isBoundedCleanText(context[key], INPUT_LIMITS.scenarioText))
      && ["seaState", "visibility", "budget"].every((key) => typeof context[key] === "number" && Number.isFinite(context[key] as number))
    : false;
  return stringKeys.every((key) => isBoundedCleanText(record[key], INPUT_LIMITS.recordText))
    && isIsoInstant(record.at)
    && (record.partnerLens === undefined || isBoundedCleanText(record.partnerLens, INPUT_LIMITS.recordText))
    && (record.theorySynthesis === undefined || isBoundedCleanText(record.theorySynthesis, INPUT_LIMITS.writtenDecision))
    && validContext
    && isIntegerBetween(record.exercise, 1, 999_999_999)
    && typeof record.score === "number" && Number.isFinite(record.score)
    && (!strictScore || isNumberBetween(record.score, 0, 100))
    && isWarfareArray(record.warfare)
    && isStringArray(record.notes)
    && isNumberRecord(record.fleet, PLATFORM_IDS)
    && isNumberRecord(record.airWing, AIRCRAFT_IDS)
    && (record.selectedArmaments === undefined || isNumberRecord(record.selectedArmaments, ARMAMENT_IDS))
    && validRigidTurns;
}

function isDecisionRecordV3(value: unknown): value is DecisionRecord {
  if (!hasDecisionRecordCore(value, true)) return false;
  const context = value.context as Record<string, unknown>;
  const climate = context.climate as Climate;
  return CLIMATES.includes(climate)
    && TIMES.includes(context.time as typeof TIMES[number])
    && CLOUDS.includes(context.clouds as typeof CLOUDS[number])
    && PRECIPITATION.includes(context.precipitation as typeof PRECIPITATION[number])
    && isIntegerBetween(context.seaState, 1, 7)
    && isIntegerBetween(context.visibility, 1, 20)
    && context.budget === 100
    && isEndState(value.endState)
    && isTheoryLens(value.theoryLens)
    && (value.partnerLens === undefined || value.partnerLens === "" || isTheoryLens(value.partnerLens))
    && isGuardrail(value.guardrail)
    && hasStrictEnvironmentFields(context, value.exercise as number, value.region as string, climate);
}

function migrateLegacyDecisionRecord(value: unknown, scenario: Scenario): DecisionRecord | null {
  if (!hasDecisionRecordCore(value, false)) return null;
  const record = value;
  const context = record.context;
  if (!isEndState(record.endState)
    || !isTheoryLens(record.theoryLens)
    || record.partnerLens !== undefined && record.partnerLens !== "" && !isTheoryLens(record.partnerLens)
    || !isGuardrail(record.guardrail)) return null;
  const climate = CLIMATES.includes(context.climate as Climate) ? context.climate as Climate : scenario.climate;
  const exercise = record.exercise;
  const region = record.region;
  const sameScenario = exercise === scenario.id && region === scenario.region && climate === scenario.climate;
  const derived = sameScenario ? scenario : deriveScenarioEnvironment({ id: exercise, region, climate });
  const { season, scenarioDate } = legacySeasonAndDate(context, derived, exercise);
  const windHeading = usableHeading(context.windHeading, derived.windHeading);
  const currentHeading = usableHeading(context.currentHeading, derived.currentHeading);
  const currentSpeed = usableCurrentSpeed(context.currentSpeed, derived.currentSpeed, derived.soundProfile);
  const stormCandidate = typeof context.storming === "boolean" ? context.storming : derived.storming;
  const weatherSupportsStorm = context.precipitation !== "none"
    && context.clouds === "overcast"
    && isIntegerBetween(context.seaState, 5, 7)
    && isIntegerBetween(context.visibility, 2, 4);
  const storming = stormCandidate && weatherSupportsStorm;
  const calmMinimum = climate === "ocean" ? 8 : 10;
  const calmMaximum = climate === "ocean" ? 27 : 31;
  const preferredWindSpeed = isIntegerBetween(context.windSpeed, storming ? 30 : calmMinimum, storming ? 48 : calmMaximum)
    ? context.windSpeed as number
    : derived.windSpeed;
  const windSpeed = storming
    ? (isIntegerBetween(preferredWindSpeed, 30, 48) ? preferredWindSpeed : 30 + exercise % 19)
    : (isIntegerBetween(preferredWindSpeed, calmMinimum, calmMaximum) ? preferredWindSpeed : Math.min(calmMaximum, Math.max(calmMinimum, (context.seaState as number) * 6)));
  const migrated: DecisionRecord = {
    id: record.id,
    at: record.at,
    exercise,
    operation: record.operation,
    region,
    score: Math.max(0, Math.min(100, record.score)),
    outcome: record.outcome,
    warfare: [...record.warfare],
    endState: record.endState,
    theoryLens: record.theoryLens,
    ...(record.partnerLens !== undefined ? { partnerLens: record.partnerLens } : {}),
    ...(record.theorySynthesis !== undefined ? { theorySynthesis: record.theorySynthesis } : {}),
    guardrail: record.guardrail,
    rationale: record.rationale,
    assumptions: record.assumptions,
    termination: record.termination,
    fleet: { ...record.fleet },
    airWing: { ...record.airWing },
    ...(record.selectedArmaments !== undefined ? { selectedArmaments: { ...record.selectedArmaments } } : {}),
    ...(record.rigidTurns !== undefined ? { rigidTurns: structuredClone(record.rigidTurns) } : {}),
    notes: [...record.notes],
    context: {
      brief: context.brief,
      objective: context.objective,
      politicalAim: context.politicalAim,
      intelligence: context.intelligence,
      historicalMode: context.historicalMode,
      ...(context.geography !== undefined ? { geography: context.geography } : {}),
      ...(context.friendlySituation !== undefined ? { friendlySituation: context.friendlySituation } : {}),
      ...(context.opposingSituation !== undefined ? { opposingSituation: context.opposingSituation } : {}),
      ...(context.civilianContext !== undefined ? { civilianContext: context.civilianContext } : {}),
      ...(context.constraints !== undefined ? { constraints: context.constraints } : {}),
      ...(context.timing !== undefined ? { timing: context.timing } : {}),
      ...(context.successConditions !== undefined ? { successConditions: context.successConditions } : {}),
      ...(context.navalProblem !== undefined ? { navalProblem: context.navalProblem } : {}),
      time: context.time,
      clouds: context.clouds,
      precipitation: context.precipitation,
      seaState: context.seaState,
      visibility: context.visibility,
      climate,
      budget: 100,
      regionId: derived.regionId,
      hemisphere: derived.hemisphere,
      observerLatitude: derived.observerLatitude,
      observerLongitude: derived.observerLongitude,
      scenarioDate,
      season,
      storming,
      lightningCapable: storming && climate === "ocean" && (season === "wet" || season === "summer" || season === "autumn"),
      windHeading,
      windSpeed,
      currentHeading,
      currentSpeed,
      waveHeading: combinedWaveHeading(windHeading, windSpeed, currentHeading, currentSpeed),
      soundProfile: derived.soundProfile,
    },
  };
  return isDecisionRecordV3(migrated) ? migrated : null;
}

function parseRigidState(value: unknown): RigidGameState | null {
  if (value === null) return null;
  if (isRigidGameState(value)
    && value.reports.every((report) => isBoundedCleanText(report.phase, INPUT_LIMITS.recordText)
      && isBoundedCleanText(report.contactReport, INPUT_LIMITS.recordText)
      && isStringArray(report.umpireNotes))
    && (!value.outcome || isStringArray(value.outcome.notes)
      && value.outcome.findings.every((finding) => isDiagnosticFinding(finding)))) return value;
  throw new Error("Rigid umpire state is invalid.");
}

export function parsePortableSave(text: string): PortableSave {
  const trimmed = text.trim();
  const markerBlocks = trimmed.startsWith("{") ? [] : [
    [MACHINE_START, MACHINE_END],
    [LEGACY_MACHINE_START, LEGACY_MACHINE_END],
  ].flatMap(([startMarker, endMarker]) => {
    const end = lastStandaloneMarker(text, endMarker);
    const start = end < 0 ? -1 : lastStandaloneMarker(text, startMarker, end);
    return start >= 0 && end > start ? [{ start, end, startMarker }] : [];
  }).sort((left, right) => right.end - left.end);
  const block = markerBlocks[0];
  const raw = block
    ? text.slice(block.start + block.startMarker.length, block.end).trim()
    : trimmed;
  const machineJson = raw.startsWith(ENCODED_MACHINE_PREFIX)
    ? decodeUtf8Base64(raw.slice(ENCODED_MACHINE_PREFIX.length))
    : raw;
  const value = parseUntrustedJson(machineJson);
  if (!isRecord(value)) throw new Error("Save data is not an object.");
  const incomingVersion = value.version;
  if ((value.format !== "fog-of-the-sea-save" && value.format !== "fog-of-sea-save")
    || typeof incomingVersion !== "number"
    || !Number.isInteger(incomingVersion)
    || ![1, 2, 3].includes(incomingVersion)) throw new Error("Unsupported save format or version.");
  if (!isRecord(value.game)) throw new Error("The scenario is missing or invalid.");
  const game = value.game;
  const scenario = incomingVersion === 3
    ? (isScenarioV3(game.scenario) ? game.scenario : null)
    : migrateLegacyScenario(game.scenario);
  if (!scenario) throw new Error("The scenario is missing or invalid.");
  if (!isNumberRecord(game.fleet, PLATFORM_IDS) || !isNumberRecord(game.airWing, AIRCRAFT_IDS)) throw new Error("The force roster is invalid.");
  if (game.selectedArmaments !== undefined && !isNumberRecord(game.selectedArmaments, ARMAMENT_IDS)) throw new Error("The armament roster is invalid.");
  if (!isWarfareArray(game.selectedWarfare) || !Array.isArray(game.history) || game.history.length > MAX_DECISION_HISTORY) throw new Error("Decision data is invalid.");
  const selectedWarfare = game.selectedWarfare;
  const history: DecisionRecord[] = [];
  if (incomingVersion === 3) {
    if (!game.history.every(isDecisionRecordV3)) throw new Error("Decision data is invalid.");
    history.push(...game.history);
  } else {
    for (const record of game.history) {
      const migrated = migrateLegacyDecisionRecord(record, scenario);
      if (!migrated) throw new Error("Decision data is invalid.");
      history.push(migrated);
    }
  }
  if (!isBoundedCleanText(game.rationale, INPUT_LIMITS.writtenDecision)
    || !isBoundedCleanText(game.assumptions, INPUT_LIMITS.writtenDecision)
    || !isBoundedCleanText(game.termination, INPUT_LIMITS.writtenDecision)) {
    throw new Error("Current decision fields are invalid.");
  }
  const rationale = sanitizeWrittenDecision(game.rationale);
  const assumptions = sanitizeWrittenDecision(game.assumptions);
  const termination = sanitizeWrittenDecision(game.termination);
  const selectedEndState = parseOptionalEnumerated(game.selectedEndState, isEndState, "End state is invalid.");
  const selectedLens = parseOptionalEnumerated(game.selectedLens, isTheoryLens, "Theory lens is invalid.");
  const selectedPartnerLens = parseOptionalEnumerated(game.selectedPartnerLens ?? "", isTheoryLens, "Partner theory lens is invalid.");
  if (game.theorySynthesis !== undefined && !isBoundedCleanText(game.theorySynthesis, INPUT_LIMITS.writtenDecision)) throw new Error("Theory synthesis is invalid.");
  const selectedGuardrail = parseOptionalEnumerated(game.selectedGuardrail, isGuardrail, "Guardrail is invalid.");
  if (!isRecord(value.preferences) || (value.preferences.theme !== "light" && value.preferences.theme !== "dark")) throw new Error("Theme preference is invalid.");
  const difficulty = value.preferences.difficulty === undefined && incomingVersion < 3
    ? "standard"
    : value.preferences.difficulty;
  if (!isDifficulty(difficulty)) throw new Error("Difficulty preference is invalid.");
  const inferredPlanningStage = selectedWarfare.length > 0
    && Boolean(selectedEndState)
    && Boolean(selectedLens)
    && Boolean(selectedPartnerLens)
    && Boolean(selectedGuardrail)
    ? "force"
    : "strategy";
  const planningStage = value.preferences.planningStage === undefined
    ? inferredPlanningStage
    : value.preferences.planningStage;
  if (planningStage !== "strategy" && planningStage !== "force") throw new Error("Planning stage preference is invalid.");
  const guidance = value.preferences.guidance === undefined && incomingVersion < 3
    ? { checklistCollapsed: false }
    : value.preferences.guidance;
  if (!isRecord(guidance) || typeof guidance.checklistCollapsed !== "boolean") throw new Error("Guidance preference is invalid.");
  let result: SavedResult | null;
  if (incomingVersion === 3) {
    if (!isSavedResult(game.result)) throw new Error("Current decision fields are invalid.");
    result = game.result;
  } else {
    if (!isLegacySavedResult(game.result)) throw new Error("Current decision fields are invalid.");
    result = legacyResult(game.result, difficulty, scenario);
  }
  let rawRigidState: unknown = game.rigidState ?? null;
  if (incomingVersion < 3) {
    const migrated = migrateLegacyCompletedState(rawRigidState, result, difficulty, scenario);
    rawRigidState = migrated.rigidState;
    result = migrated.result;
  }
  const rigidState = parseRigidState(rawRigidState);
  const rawRigidOrders = game.rigidOrders ?? null;
  if (rawRigidOrders !== null && !isRigidOrders(rawRigidOrders)) throw new Error("Pending rigid orders are invalid.");
  const rigidOrders = rawRigidOrders;
  if (incomingVersion === 3 && result && result.difficulty !== difficulty) throw new Error("Result difficulty does not match the saved preference.");
  if (incomingVersion === 3 && rigidState?.outcome && rigidState.outcome.difficulty !== difficulty) throw new Error("Umpire difficulty does not match the saved preference.");
  if (incomingVersion === 3 && result !== null && rigidState === null) {
    throw new Error("A completed result requires its canonical umpire state.");
  }
  if (incomingVersion === 3 && rigidState) {
    const expectedMatrix = scenario.matrix ? activateMatrixForDifficulty(scenario.matrix, difficulty) : undefined;
    if (!jsonSemanticEqual(rigidState.matrix, expectedMatrix)) throw new Error("Umpire matrix does not match the saved scenario and difficulty.");
    const { rigidReadiness } = deriveForceReadiness({
      scenario,
      difficulty,
      fleet: game.fleet,
      airWing: game.airWing,
      selectedArmaments: game.selectedArmaments || {},
      selectedWarfare,
      selectedEndState,
      selectedLens,
      selectedPartnerLens,
      selectedGuardrail,
    });
    if (!isCanonicalRigidState(
      rigidState,
      { ...scenario, difficulty, selectedLens: selectedLens || undefined },
      rigidReadiness,
    )) {
      throw new Error("Umpire report chain or committed matrix result is invalid.");
    }
    if (rigidState.phase === "active" && result !== null) throw new Error("An active umpire state cannot contain a completed result.");
    if (rigidState.phase === "complete" && !jsonSemanticEqual(rigidState.outcome, result)) {
      throw new Error("The completed result does not match the canonical umpire outcome.");
    }
  }
  if (!isIsoInstant(value.savedAt)) throw new Error("Save timestamp is invalid.");
  if (!isStringArray(value.academyProgress, 100, INPUT_LIMITS.shortIdentifier) || !value.academyProgress.every(isSafeIdentifier)) throw new Error("Study progress is invalid.");
  const parsed: PortableSave = {
    format: "fog-of-sea-save",
    version: 3,
    savedAt: value.savedAt,
    game: {
      scenario,
      fleet: game.fleet,
      airWing: game.airWing,
      selectedArmaments: game.selectedArmaments || {},
      selectedWarfare,
      selectedEndState,
      selectedLens,
      selectedPartnerLens,
      selectedGuardrail,
      theorySynthesis: sanitizeWrittenDecision(game.theorySynthesis || ""),
      rationale,
      assumptions,
      termination,
      result,
      rigidState,
      rigidOrders,
      history,
    },
    preferences: {
      theme: value.preferences.theme,
      difficulty,
      planningStage,
      guidance: { checklistCollapsed: guidance.checklistCollapsed },
    },
    academyProgress: value.academyProgress,
  };
  return parsed;
}

export function saveFilename(operation: string, date = new Date()) {
  const safeOperation = operation.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "exercise";
  return `fog-of-sea-${safeOperation}-${date.toISOString().slice(0, 10)}.txt`;
}
