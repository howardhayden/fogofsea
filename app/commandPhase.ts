import type { Difficulty, EndState, Guardrail, Scenario, TheoryLens, Warfare } from "./gameModel";
import {
  createInitialRigidState,
  resolveRigidTurn,
  undoRigidTurn,
  type RigidGameState,
  type RigidOrders,
  type RigidReadiness,
  type RigidScenario,
} from "./kriegsspiel";
import type { DecisionRecord, SavedResult } from "./saveGame";

const CANONICAL_COMMAND_TASK_ORDER: readonly Warfare[] = [
  "air-defense",
  "surface-operations",
  "undersea-operations",
  "land-attack",
  "electromagnetic-operations",
  "reconnaissance",
  "mine-countermeasures",
  "missile-defense",
  "maritime-interdiction",
];

/**
 * The strategic and force-design snapshot committed when a command run ends.
 * The scenario is deliberately supplied separately to adjudication so that
 * the record and the rules can never describe different exercises.
 */
export type CommandDecisionSnapshot = {
  selectedWarfare: readonly Warfare[];
  selectedEndState: EndState | "";
  selectedLens: TheoryLens | "";
  selectedPartnerLens: TheoryLens | "";
  selectedGuardrail: Guardrail | "";
  theorySynthesis: string;
  rationale: string;
  assumptions: string;
  termination: string;
  fleet: Readonly<Record<string, number>>;
  airWing: Readonly<Record<string, number>>;
  selectedArmaments: Readonly<Record<string, number>>;
};

export type BeginCommandAction = {
  type: "begin-command";
  state: RigidGameState;
  orders: RigidOrders;
};

export type ResolveCommandAction = {
  type: "resolve-turn";
  state: RigidGameState;
  outcome: SavedResult | null;
  record?: DecisionRecord;
};

export type UndoCommandAction = {
  type: "undo-turn";
  state: RigidGameState;
  dropHistory: boolean;
};

export type RetryCommandAction = {
  type: "retry-command";
  state: RigidGameState;
  dropHistory: boolean;
};

export type CommandPhaseAction = BeginCommandAction | ResolveCommandAction | UndoCommandAction | RetryCommandAction;

export function commandScenario(scenario: Scenario, difficulty: Difficulty, selectedLens?: TheoryLens | ""): RigidScenario {
  return {
    id: scenario.id,
    difficulty,
    climate: scenario.climate,
    regionId: scenario.regionId,
    season: scenario.season,
    soundProfile: scenario.soundProfile,
    storming: scenario.storming,
    endState: scenario.endState,
    time: scenario.time,
    clouds: scenario.clouds,
    precipitation: scenario.precipitation,
    seaState: scenario.seaState,
    visibility: scenario.visibility,
    required: scenario.required,
    recommended: scenario.recommended,
    guardrail: scenario.guardrail,
    minimumEscort: scenario.minimumEscort,
    minimumAirDefense: scenario.minimumAirDefense,
    minimumAsw: scenario.minimumAsw,
    minimumUncrewed: scenario.minimumUncrewed,
    adversaryCount: scenario.adversaryCount ?? 1,
    selectedLens: selectedLens || undefined,
    matrix: scenario.matrix,
  };
}

export function beginCommandTransition(input: {
  scenario: Scenario;
  difficulty: Difficulty;
  readiness: RigidReadiness;
  orders: RigidOrders;
  selectedWarfare: readonly Warfare[];
  selectedLens?: TheoryLens | "";
}): BeginCommandAction {
  const selected = new Set(input.selectedWarfare);
  const task = input.selectedWarfare.includes(input.orders.task)
    ? input.orders.task
    : input.scenario.required.find((area) => selected.has(area))
      || CANONICAL_COMMAND_TASK_ORDER.find((area) => selected.has(area))
      || "reconnaissance";
  const orders = { ...input.orders, task };
  return {
    type: "begin-command",
    state: createInitialRigidState(input.readiness, commandScenario(input.scenario, input.difficulty, input.selectedLens)),
    orders,
  };
}

export function createCommandDecisionRecord(input: {
  scenario: Scenario;
  decision: CommandDecisionSnapshot;
  outcome: SavedResult;
  state: RigidGameState;
  recordedAt: string;
}): DecisionRecord {
  const { scenario, decision, outcome, state, recordedAt } = input;
  return {
    id: `${scenario.id}-${recordedAt}`,
    at: recordedAt,
    exercise: scenario.id,
    operation: scenario.operation,
    region: scenario.region,
    context: {
      brief: scenario.brief,
      objective: scenario.objective,
      politicalAim: scenario.politicalAim,
      intelligence: scenario.intelligence,
      historicalMode: scenario.history,
      geography: scenario.geography,
      friendlySituation: scenario.friendlySituation,
      opposingSituation: scenario.opposingSituation,
      civilianContext: scenario.civilianContext,
      constraints: scenario.constraints,
      timing: scenario.timing,
      successConditions: scenario.successConditions,
      navalProblem: scenario.navalProblem,
      climate: scenario.climate,
      time: scenario.time,
      clouds: scenario.clouds,
      precipitation: scenario.precipitation,
      seaState: scenario.seaState,
      visibility: scenario.visibility,
      regionId: scenario.regionId,
      hemisphere: scenario.hemisphere,
      observerLatitude: scenario.observerLatitude,
      observerLongitude: scenario.observerLongitude,
      scenarioDate: scenario.scenarioDate,
      season: scenario.season,
      storming: scenario.storming,
      lightningCapable: scenario.lightningCapable,
      windHeading: scenario.windHeading,
      windSpeed: scenario.windSpeed,
      currentHeading: scenario.currentHeading,
      currentSpeed: scenario.currentSpeed,
      waveHeading: scenario.waveHeading,
      soundProfile: scenario.soundProfile,
      budget: scenario.budget,
    },
    score: outcome.score,
    outcome: outcome.title,
    warfare: [...decision.selectedWarfare],
    endState: decision.selectedEndState,
    theoryLens: decision.selectedLens,
    partnerLens: decision.selectedPartnerLens,
    theorySynthesis: decision.theorySynthesis,
    guardrail: decision.selectedGuardrail,
    rationale: decision.rationale,
    assumptions: decision.assumptions,
    termination: decision.termination,
    fleet: { ...decision.fleet },
    airWing: { ...decision.airWing },
    selectedArmaments: { ...decision.selectedArmaments },
    rigidTurns: state.reports.map((report) => ({
      ...report,
      orders: { ...report.orders },
      umpireNotes: [...report.umpireNotes],
      delta: { ...report.delta },
    })),
    notes: [...outcome.notes],
  };
}

export function resolveCommandTransition(input: {
  scenario: Scenario;
  difficulty: Difficulty;
  readiness: RigidReadiness;
  orders: RigidOrders;
  state: RigidGameState | null;
  decision: CommandDecisionSnapshot;
  recordedAt: string;
}): ResolveCommandAction | null {
  if (!input.state || input.state.phase !== "active") return null;
  const next = resolveRigidTurn(
    input.state,
    input.orders,
    input.readiness,
    commandScenario(input.scenario, input.difficulty, input.decision.selectedLens),
  );
  if (!next.outcome) return { type: "resolve-turn", state: next, outcome: null };

  const outcome: SavedResult = { ...next.outcome, notes: [...next.outcome.notes] };
  return {
    type: "resolve-turn",
    state: next,
    outcome,
    record: createCommandDecisionRecord({
      scenario: input.scenario,
      decision: input.decision,
      outcome,
      state: next,
      recordedAt: input.recordedAt,
    }),
  };
}

export function undoCommandTransition(state: RigidGameState | null): UndoCommandAction | null {
  if (!state?.reports.length) return null;
  return {
    type: "undo-turn",
    state: undoRigidTurn(state),
    dropHistory: state.phase === "complete",
  };
}

export function retryCommandTransition(input: {
  scenario: Scenario;
  difficulty: Difficulty;
  readiness: RigidReadiness;
  state: RigidGameState | null;
  selectedLens?: TheoryLens | "";
}): RetryCommandAction {
  return {
    type: "retry-command",
    state: createInitialRigidState(input.readiness, commandScenario(input.scenario, input.difficulty, input.selectedLens)),
    dropHistory: input.state?.phase === "complete",
  };
}
