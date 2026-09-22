import type { Scenario, TheoryLens, Warfare } from "./gameModel";
import { ACADEMY_STRATEGY_DECISION_ATOMS, type AcademyDecisionAtomId } from "./academyDecisionAtoms";
import { THEORY_ACADEMY_ATOM } from "./academyTheoryAtoms";

export { THEORY_ACADEMY_ATOM } from "./academyTheoryAtoms";

export type AcademyGameplayPhase = "strategy" | "force" | "command" | "debrief";
export type AcademyWorkspaceView = "mission" | "decisions" | "force" | "command" | "visualization";

export type AcademyScenarioContext = Pick<
  Scenario,
  | "brief"
  | "friendlySituation"
  | "opposingSituation"
  | "civilianContext"
  | "objective"
  | "intelligence"
  | "constraints"
  | "successConditions"
  | "navalProblem"
  | "politicalAim"
>;

export type AcademyGuidanceInput = {
  scenario: AcademyScenarioContext;
  gameplayPhase: AcademyGameplayPhase;
  workspaceView: AcademyWorkspaceView;
  selectedWarfare: readonly Warfare[];
  selectedLens: TheoryLens | "";
  selectedPartnerLens: TheoryLens | "";
};

export type AcademyGuidance = {
  source: "brief" | "player-selections";
  decisionAtomIds: AcademyDecisionAtomId[];
  theoryLenses: TheoryLens[];
  theoryAtomIds: string[];
  theoryModuleIds: string[];
  contextModuleIds: string[];
  defaultExpandedModuleIds: string[];
  primaryModuleId: string;
  theoryRelevanceLabel: "NAMED IN THE BRIEF" | "YOUR RECORDED THEORY";
  contextRelevanceLabel: "CURRENT PHASE";
  heading: string;
  explanation: string;
};

export function selectAcademyScenarioContext(scenario: AcademyScenarioContext): AcademyScenarioContext {
  return {
    brief: scenario.brief,
    friendlySituation: scenario.friendlySituation,
    opposingSituation: scenario.opposingSituation,
    civilianContext: scenario.civilianContext,
    objective: scenario.objective,
    intelligence: scenario.intelligence,
    constraints: scenario.constraints,
    successConditions: scenario.successConditions,
    navalProblem: scenario.navalProblem,
    politicalAim: scenario.politicalAim,
  };
}

export const NAVAL_THEORY_PROBLEM_MAPPINGS: ReadonlyArray<{
  problem: string;
  lenses: readonly TheoryLens[];
}> = [
  {
    problem: "Combine Corbett’s limited control of communications with Wegener’s emphasis on position and access. Decide what must concentrate, what can form barriers, and when the combination should dissolve.",
    lenses: ["corbett", "wegener"],
  },
  {
    problem: "Compare Richmond’s concern for preparation and judgement with Clausewitz’s test of political purpose. Explain which escort risks serve the passage and which merely seek an unnecessary encounter.",
    lenses: ["richmond", "clausewitz"],
  },
  {
    problem: "Set Corbett’s moving protection problem against Wegener’s geographic leverage. Determine whether the decisive element is close escort, an advanced barrier, or the timing that connects them.",
    lenses: ["corbett", "wegener"],
  },
  {
    problem: "Combine Till’s cooperative and constabulary sea use, Panikkar’s concern for regional autonomy, and Corbett’s limited objective. Explain how protection provides order without substituting for legitimate civil authority.",
    lenses: ["till", "panikkar", "corbett"],
  },
  {
    problem: "Compare Galula’s emphasis on legitimacy with Till’s cooperative maritime practice. Decide how the formation can create security while leaving agency with the communities that must sustain it.",
    lenses: ["galula", "till"],
  },
  {
    problem: "Test Corbett’s limited control against Panikkar’s regional perspective. Identify the point at which additional protection would cease to support relief and begin to displace civil choice.",
    lenses: ["corbett", "panikkar"],
  },
  {
    problem: "Contrast Mahanian concentration with Aube’s distributed cost imposition and Castex’s combinations. Explain what remains concentrated, what disperses, and how the parts create control rather than disconnected activity.",
    lenses: ["mahan", "aube", "castex"],
  },
  {
    problem: "Compare Sun Tzu’s preference for shaping advantage with Mahan’s search for decisive concentration. Decide whether the junction is held by threatening battle, avoiding it, or controlling the information that makes either choice credible.",
    lenses: ["sun-tzu", "mahan"],
  },
  {
    problem: "Use Castex’s combinations to connect Aube’s dispersed pressure with Mahanian mass. Explain where concentration becomes necessary and where it would instead expose the force to defeat in detail.",
    lenses: ["castex", "aube", "mahan"],
  },
  {
    problem: "Use Richmond’s institutional judgement and Corbett’s limited control, then test both against Panikkar’s concern for regional order. Explain how protection remains legitimate under severe uncertainty.",
    lenses: ["richmond", "corbett", "panikkar"],
  },
  {
    problem: "Compare Clausewitz’s insistence on political purpose with Corbett’s temporary local control. Decide which risks are necessary to complete the evacuation and which would widen the task after success is already possible.",
    lenses: ["clausewitz", "corbett"],
  },
  {
    problem: "Set Panikkar’s regional perspective beside Richmond’s focus on preparation. Explain how command arrangements, rescue capacity, and an explicit endpoint can make protective power credible without making it permanent.",
    lenses: ["panikkar", "richmond"],
  },
  {
    problem: "Combine Gorshkov’s comprehensive sea-power system, Liu Huaqing’s phased development, and Castex’s strategic combinations. Distinguish the force needed for immediate protection from the institutions required for durable resilience.",
    lenses: ["gorshkov", "liu-huaqing", "castex"],
  },
  {
    problem: "Compare Till’s broad account of maritime security with Liu Huaqing’s staged development. Decide which sensing, repair, and protection capacities must exist now and which can be built into the transition.",
    lenses: ["till", "liu-huaqing"],
  },
  {
    problem: "Use Castex’s combinations to test Gorshkov’s system view. Explain why ships, remote sensors, repair capacity, and evidence standards must work as one design rather than as separate inventories.",
    lenses: ["castex", "gorshkov"],
  },
  {
    problem: "Combine Aube’s distributed pressure, Corbett’s limited control, Castex’s combinations, and Clausewitz’s political test. Identify the mechanism expected to change the opposing choice and the point at which more force defeats the limited aim.",
    lenses: ["aube", "corbett", "castex", "clausewitz"],
  },
  {
    problem: "Compare Clausewitz’s political test with Aube’s dispersed pressure. Explain what observable decision the pressure is meant to change and why a broader attack might reduce rather than increase leverage.",
    lenses: ["clausewitz", "aube"],
  },
  {
    problem: "Use Corbett’s limited control and Castex’s combinations to connect escort, denial, and signalling. Identify the termination condition before selecting the action that is supposed to produce it.",
    lenses: ["corbett", "castex"],
  },
  {
    problem: "Compare Sun Tzu’s preference for shaping choices with Corbett’s limited local control. Explain how observation can deny advantage without making a threatening concentration necessary.",
    lenses: ["sun-tzu", "corbett"],
  },
  {
    problem: "Set Galula’s legitimacy test beside Richmond’s emphasis on institutional competence. Decide which evidence, liaison, and command arrangements make restraint credible rather than merely passive.",
    lenses: ["galula", "richmond"],
  },
  {
    problem: "Use Corbett and Richmond to distinguish a temporary monitoring concentration from the routine system that must replace it. Explain how the force can succeed by becoming less necessary.",
    lenses: ["corbett", "richmond"],
  },
  {
    problem: "Compare Liu Huaqing’s phased development with Till’s account of maritime security. Decide how an immediate specialist force should create the conditions for a simpler enduring system.",
    lenses: ["liu-huaqing", "till"],
  },
  {
    problem: "Use Gorshkov’s system perspective and Castex’s combinations to connect survey craft, escorts, data custody, and the first protected transit. Explain why clearance without continued observation is incomplete.",
    lenses: ["gorshkov", "castex"],
  },
  {
    problem: "Set Till’s cooperative practice beside Liu Huaqing’s staged capacity. Identify which knowledge must be transferred so that access survives after the most capable systems depart.",
    lenses: ["till", "liu-huaqing"],
  },
  {
    problem: "Compare Corbett’s local control of communications with Aube’s emphasis on dispersed littoral threats. Explain why a concentrated fleet may be visible yet poorly suited to the decisive classification problem.",
    lenses: ["corbett", "aube"],
  },
  {
    problem: "Use Till’s maritime-security framework and Richmond’s institutional emphasis to connect sensing, rescue, civil authority, and sustainable handoff.",
    lenses: ["till", "richmond"],
  },
  {
    problem: "Set Corbett’s limited control beside Aube’s coastal asymmetry. Decide which functions should disperse, which decisions must remain human, and when the temporary screen should dissolve.",
    lenses: ["corbett", "aube"],
  },
  {
    problem: "Use Corbett’s protection of communications and Till’s maritime-security lens to explain why lawful access, rescue, evidence, and coordination are strategic functions rather than administrative details.",
    lenses: ["corbett", "till"],
  },
  {
    problem: "Compare Sun Tzu’s preference for disrupting an adversary’s design with Galula’s legitimacy test. Explain why indiscriminate interception can strengthen the network’s adaptation and undermine the mission.",
    lenses: ["sun-tzu", "galula"],
  },
  {
    problem: "Set Till’s cooperative maritime security against Corbett’s local control. Design a handoff in which distributed drones widen awareness but human and civil authorities retain classification, safeguarding, and legal decisions.",
    lenses: ["till", "corbett"],
  },
];

export function theoryLensesForNavalProblem(navalProblem: string): TheoryLens[] {
  const mapping = NAVAL_THEORY_PROBLEM_MAPPINGS.find(({ problem, lenses }) => (
    problem === navalProblem
    && lenses.length >= 2
  ));
  return mapping ? [...mapping.lenses] : [];
}

export const THEORY_ACADEMY_MODULE = Object.fromEntries(
  Object.entries(THEORY_ACADEMY_ATOM).map(([lens, target]) => [lens, target.moduleId]),
) as Record<TheoryLens, string>;

function unique<T>(values: readonly T[]) {
  return [...new Set(values)];
}

export function scenarioTheoryLenses(scenario: AcademyScenarioContext): TheoryLens[] {
  // Exact canonical public prose is the sole authority. Unknown legacy prose
  // fails closed to generic comparison help instead of consulting scored lens
  // metadata that is not visible to the player.
  return unique(theoryLensesForNavalProblem(scenario.navalProblem));
}

function contextModules(input: AcademyGuidanceInput): string[] {
  if (input.workspaceView === "visualization") return ["jomini"];

  if (input.gameplayPhase === "force") {
    const warfare = new Set(input.selectedWarfare);
    if (warfare.has("undersea-operations")) return ["undersea-campaigns"];
    if (warfare.has("maritime-interdiction") || warfare.has("mine-countermeasures")) return ["littoral-safeguarding"];
    if (warfare.has("reconnaissance") || warfare.has("electromagnetic-operations")) return ["maritime-uncrewed"];
    return ["risk-resilience"];
  }

  if (input.gameplayPhase === "command") {
    // Exact actor count is concealed command intelligence. Keep contextual
    // help fail-closed until a separately typed disclosed-plurality fact exists.
    return ["compound-uncertainty"];
  }
  if (input.gameplayPhase === "debrief") return ["synthesis"];
  if (input.gameplayPhase === "strategy") return ["strategy-grammar"];
  return [];
}

function phaseName(phase: AcademyGameplayPhase, view: AcademyWorkspaceView) {
  if (view === "visualization") return "visualization";
  if (phase === "force") return "force design";
  if (phase === "command") return "command";
  if (phase === "debrief") return "debrief";
  return "strategy";
}

export function deriveAcademyGuidance(input: AcademyGuidanceInput): AcademyGuidance {
  const recordedSelectionCount = Number(Boolean(input.selectedLens)) + Number(Boolean(input.selectedPartnerLens));
  const selectionsComplete = Boolean(
    input.selectedLens
    && input.selectedPartnerLens
    && input.selectedLens !== input.selectedPartnerLens,
  );
  const guidanceSource = selectionsComplete ? "player-selections" : "brief";
  const theoryLenses = guidanceSource === "player-selections"
    ? unique([input.selectedLens as TheoryLens, input.selectedPartnerLens as TheoryLens])
    : scenarioTheoryLenses(input.scenario);
  const theoryAtomIds = unique(theoryLenses.map((lens) => THEORY_ACADEMY_ATOM[lens].atomId));
  const theoryModuleIds = unique(theoryLenses.map((lens) => THEORY_ACADEMY_MODULE[lens]));
  const contextModuleIds = contextModules(input).filter((id) => !theoryModuleIds.includes(id));
  const defaultExpandedModuleIds = unique([...theoryModuleIds, ...contextModuleIds]);
  const currentContext = phaseName(input.gameplayPhase, input.workspaceView);
  const contextIsImmediate = input.workspaceView === "visualization" || input.gameplayPhase !== "strategy";
  const primaryModuleId = contextIsImmediate
    ? contextModuleIds[0] || theoryModuleIds[0] || "strategy-grammar"
    : theoryModuleIds[0] || contextModuleIds[0] || "strategy-grammar";

  if (guidanceSource === "player-selections") {
    return {
      source: guidanceSource,
      decisionAtomIds: ACADEMY_STRATEGY_DECISION_ATOMS.map((atom) => atom.id),
      theoryLenses,
      theoryAtomIds,
      theoryModuleIds,
      contextModuleIds,
      defaultExpandedModuleIds,
      primaryModuleId,
      theoryRelevanceLabel: "YOUR RECORDED THEORY",
      contextRelevanceLabel: "CURRENT PHASE",
      heading: `Help for ${currentContext}`,
      explanation: "Your recorded theory pair is shown for review without being checked or endorsed. The Academy never changes a selection, and scored answer fields do not enter this guide. Deeper curriculum stays closed until requested.",
    };
  }

  return {
    source: guidanceSource,
    decisionAtomIds: ACADEMY_STRATEGY_DECISION_ATOMS.map((atom) => atom.id),
    theoryLenses,
    theoryAtomIds,
    theoryModuleIds,
    contextModuleIds,
    defaultExpandedModuleIds,
    primaryModuleId,
    theoryRelevanceLabel: "NAMED IN THE BRIEF",
    contextRelevanceLabel: "CURRENT PHASE",
    heading: `Help for ${currentContext}`,
    explanation: recordedSelectionCount === 0
      ? "This guide uses only the mission text already visible to you. Thinkers named in the comparative problem are open for study, not marked correct. The Academy makes no selection and receives no scored answer fields."
      : "Until two distinct theories are recorded, this guide stays anchored to the public mission text. An incomplete choice cannot steer or probe the guidance, and the Academy receives no scored answer fields.",
  };
}
