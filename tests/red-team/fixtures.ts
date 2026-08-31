import { generateScenario, type Scenario } from "../../app/gameModel";
import type { PortableSave } from "../../app/saveGame";

export function deterministicScenario(previousId = 20): Scenario {
  let state = (previousId * 2654435761) >>> 0;
  return generateScenario(previousId, () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  });
}

export function minimalPortableSave(scenario = deterministicScenario()): PortableSave {
  return {
    format: "fog-of-sea-save",
    version: 3,
    savedAt: "2026-08-30T00:00:00.000Z",
    game: {
      scenario,
      fleet: {},
      airWing: {},
      selectedArmaments: {},
      selectedWarfare: [],
      selectedEndState: "",
      selectedLens: "",
      selectedPartnerLens: "",
      selectedGuardrail: "",
      theorySynthesis: "",
      rationale: "",
      assumptions: "",
      termination: "",
      result: null,
      rigidState: null,
      rigidOrders: null,
      history: [],
    },
    preferences: {
      theme: "dark",
      difficulty: "standard",
      planningStage: "strategy",
      guidance: { checklistCollapsed: false },
    },
    academyProgress: [],
  };
}
