import { useMemo, useReducer } from "react";
import type { Difficulty, EndState, Guardrail, Scenario, TheoryLens, Warfare } from "./gameModel";
import type { RigidGameState, RigidOrders } from "./kriegsspiel";
import type { DecisionRecord, SavedResult } from "./saveGame";
import { sanitizeWrittenDecision } from "./inputSecurity";

export type GameSessionState = {
  scenario: Scenario;
  fleet: Record<string, number>;
  airWing: Record<string, number>;
  selectedArmaments: Record<string, number>;
  selectedWarfare: Warfare[];
  academyProgress: string[];
  difficulty: Difficulty;
  guidedChecklistCollapsed: boolean;
  selectedEndState: EndState | "";
  selectedLens: TheoryLens | "";
  selectedPartnerLens: TheoryLens | "";
  selectedGuardrail: Guardrail | "";
  theorySynthesis: string;
  rationale: string;
  assumptions: string;
  termination: string;
  history: DecisionRecord[];
  result: SavedResult | null;
  rigidState: RigidGameState | null;
  rigidOrders: RigidOrders;
};

export type ForceRoster = "fleet" | "airWing" | "selectedArmaments";
export type WrittenDecisionField = "theorySynthesis" | "rationale" | "assumptions" | "termination";

export type GameSessionActions = {
  restoreSave: (next: GameSessionState) => void;
  resetSession: (next: GameSessionState) => void;
  changeScenario: (scenario: Scenario) => void;
  updateForceCount: (roster: ForceRoster, id: string, count: number) => void;
  setWarfare: (warfare: Warfare[]) => void;
  selectEndState: (value: EndState | "") => void;
  selectPrimaryLens: (value: TheoryLens | "") => void;
  selectPartnerLens: (value: TheoryLens | "") => void;
  selectGuardrail: (value: Guardrail | "") => void;
  writeDecision: (field: WrittenDecisionField, value: string) => void;
  setDifficulty: (value: Difficulty) => void;
  setGuidanceCollapsed: (value: boolean) => void;
  setAcademyProgress: (value: string[]) => void;
  updateOrders: (value: Partial<RigidOrders>) => void;
  beginCommand: (next: RigidGameState, orders: RigidOrders) => void;
  resolveTurn: (next: RigidGameState, outcome: SavedResult | null, record?: DecisionRecord) => void;
  undoTurn: (next: RigidGameState, dropHistory: boolean) => void;
  retryCommand: (next: RigidGameState, dropHistory: boolean) => void;
  returnToPlanning: () => void;
};

export type GameSessionAction =
  | { type: "restore-save"; state: GameSessionState }
  | { type: "reset-session"; state: GameSessionState }
  | { type: "change-scenario"; scenario: Scenario }
  | { type: "update-force-count"; roster: ForceRoster; id: string; count: number }
  | { type: "set-warfare"; warfare: Warfare[] }
  | { type: "select-end-state"; value: EndState | "" }
  | { type: "select-primary-lens"; value: TheoryLens | "" }
  | { type: "select-partner-lens"; value: TheoryLens | "" }
  | { type: "select-guardrail"; value: Guardrail | "" }
  | { type: "write-decision"; field: WrittenDecisionField; value: string }
  | { type: "set-difficulty"; value: Difficulty }
  | { type: "set-guidance-collapsed"; value: boolean }
  | { type: "set-academy-progress"; value: string[] }
  | { type: "update-orders"; value: Partial<RigidOrders> }
  | { type: "begin-command"; state: RigidGameState; orders: RigidOrders }
  | { type: "resolve-turn"; state: RigidGameState; outcome: SavedResult | null; record?: DecisionRecord }
  | { type: "undo-turn"; state: RigidGameState; dropHistory: boolean }
  | { type: "retry-command"; state: RigidGameState; dropHistory: boolean }
  | { type: "return-to-planning" };

export function gameSessionReducer(state: GameSessionState, action: GameSessionAction): GameSessionState {
  switch (action.type) {
    case "restore-save":
    case "reset-session":
      return action.state;
    case "change-scenario":
      return { ...state, scenario: action.scenario, result: null };
    case "update-force-count":
      return { ...state, [action.roster]: { ...state[action.roster], [action.id]: action.count }, result: null };
    case "set-warfare":
      return { ...state, selectedWarfare: action.warfare, result: null };
    case "select-end-state":
      return { ...state, selectedEndState: action.value, result: null };
    case "select-primary-lens":
      return { ...state, selectedLens: action.value, result: null };
    case "select-partner-lens":
      return { ...state, selectedPartnerLens: action.value, result: null };
    case "select-guardrail":
      return { ...state, selectedGuardrail: action.value, result: null };
    case "write-decision":
      return { ...state, [action.field]: sanitizeWrittenDecision(action.value) };
    case "set-difficulty":
      return { ...state, difficulty: action.value };
    case "set-guidance-collapsed":
      return { ...state, guidedChecklistCollapsed: action.value };
    case "set-academy-progress":
      return { ...state, academyProgress: action.value };
    case "update-orders":
      return { ...state, rigidOrders: { ...state.rigidOrders, ...action.value } };
    case "begin-command":
      return { ...state, rigidOrders: action.orders, rigidState: action.state, result: null };
    case "resolve-turn":
      return {
        ...state,
        rigidState: action.state,
        result: action.outcome,
        history: action.record ? [...state.history, action.record] : state.history,
      };
    case "undo-turn":
      return {
        ...state,
        rigidState: action.state,
        result: null,
        history: action.dropHistory ? state.history.slice(0, -1) : state.history,
      };
    case "retry-command":
      return {
        ...state,
        rigidState: action.state,
        result: null,
        history: action.dropHistory ? state.history.slice(0, -1) : state.history,
      };
    case "return-to-planning":
      return { ...state, rigidState: null, result: null };
  }
}

type GameSessionInitializer = GameSessionState | (() => GameSessionState);

function initializeGameSession(initializer: GameSessionInitializer) {
  return typeof initializer === "function" ? initializer() : initializer;
}

export function useGameSession(initializer: GameSessionInitializer) {
  const [state, dispatch] = useReducer(gameSessionReducer, initializer, initializeGameSession);
  const actions = useMemo<GameSessionActions>(() => ({
    restoreSave: (next) => dispatch({ type: "restore-save", state: next }),
    resetSession: (next) => dispatch({ type: "reset-session", state: next }),
    changeScenario: (scenario) => dispatch({ type: "change-scenario", scenario }),
    updateForceCount: (roster, id, count) => dispatch({ type: "update-force-count", roster, id, count }),
    setWarfare: (warfare) => dispatch({ type: "set-warfare", warfare }),
    selectEndState: (value) => dispatch({ type: "select-end-state", value }),
    selectPrimaryLens: (value) => dispatch({ type: "select-primary-lens", value }),
    selectPartnerLens: (value) => dispatch({ type: "select-partner-lens", value }),
    selectGuardrail: (value) => dispatch({ type: "select-guardrail", value }),
    writeDecision: (field, value) => dispatch({ type: "write-decision", field, value }),
    setDifficulty: (value) => dispatch({ type: "set-difficulty", value }),
    setGuidanceCollapsed: (value) => dispatch({ type: "set-guidance-collapsed", value }),
    setAcademyProgress: (value) => dispatch({ type: "set-academy-progress", value }),
    updateOrders: (value) => dispatch({ type: "update-orders", value }),
    beginCommand: (next, orders) => dispatch({ type: "begin-command", state: next, orders }),
    resolveTurn: (next, outcome, record) => dispatch({ type: "resolve-turn", state: next, outcome, record }),
    undoTurn: (next, dropHistory) => dispatch({ type: "undo-turn", state: next, dropHistory }),
    retryCommand: (next, dropHistory) => dispatch({ type: "retry-command", state: next, dropHistory }),
    returnToPlanning: () => dispatch({ type: "return-to-planning" }),
  }), []);

  return {
    state,
    actions,
  };
}
