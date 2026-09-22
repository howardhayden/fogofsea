export type AcademyDecisionAtomId =
  | "first-phase-warfare"
  | "first-phase-end-state"
  | "first-phase-primary-theory"
  | "first-phase-partner-theory"
  | "first-phase-guardrail";

export type AcademyPublicEvidenceKey =
  | "brief"
  | "friendlySituation"
  | "opposingSituation"
  | "civilianContext"
  | "objective"
  | "intelligence"
  | "constraints"
  | "successConditions"
  | "navalProblem"
  | "politicalAim";

export type AcademyDecisionCopyId =
  | "academy.strategy.warfareAreas"
  | "academy.strategy.endState"
  | "academy.strategy.primaryTheory"
  | "academy.strategy.complementTheory"
  | "academy.strategy.guardrail";

export type AcademyDecisionAtom = {
  id: AcademyDecisionAtomId;
  number: string;
  group: "MISSION DIAGNOSIS" | "THEORY OF ACTION" | "CONTROL";
  title: string;
  prompt: string;
  copyId: AcademyDecisionCopyId;
  evidence: ReadonlyArray<{
    key: AcademyPublicEvidenceKey;
    label: string;
  }>;
  optionSet?: "warfare" | "end-state" | "guardrail";
};

/**
 * Fixed, equally presented support for the five scored first-phase questions.
 * Lattice owns the generic method copy; the host supplies only whole fields
 * already visible in the mission brief. No answer-key field can enter here.
 */
export const ACADEMY_STRATEGY_DECISION_ATOMS: readonly AcademyDecisionAtom[] = [
  {
    id: "first-phase-warfare",
    number: "01",
    group: "MISSION DIAGNOSIS",
    title: "Identify warfare areas",
    prompt: "Which maritime functions does the stated mission actually require?",
    copyId: "academy.strategy.warfareAreas",
    evidence: [
      { key: "brief", label: "Brief" },
      { key: "friendlySituation", label: "Friendly situation" },
      { key: "opposingSituation", label: "Opposing situation" },
      { key: "objective", label: "Objective" },
      { key: "intelligence", label: "Intelligence" },
    ],
    optionSet: "warfare",
  },
  {
    id: "first-phase-end-state",
    number: "02",
    group: "MISSION DIAGNOSIS",
    title: "Define the desired end state",
    prompt: "What observable political condition should exist when the operation can end or transition?",
    copyId: "academy.strategy.endState",
    evidence: [
      { key: "politicalAim", label: "Political aim" },
      { key: "objective", label: "Objective" },
      { key: "successConditions", label: "Success conditions" },
      { key: "constraints", label: "Constraints" },
    ],
    optionSet: "end-state",
  },
  {
    id: "first-phase-primary-theory",
    number: "03",
    group: "THEORY OF ACTION",
    title: "Choose a primary theory",
    prompt: "Which causal mechanism best explains how maritime action could create the desired condition?",
    copyId: "academy.strategy.primaryTheory",
    evidence: [
      { key: "navalProblem", label: "Comparative theory problem" },
      { key: "politicalAim", label: "Political aim" },
    ],
  },
  {
    id: "first-phase-partner-theory",
    number: "04",
    group: "THEORY OF ACTION",
    title: "Choose a complement or challenge",
    prompt: "What distinct second mechanism adds a missing condition or exposes a weakness in the primary theory?",
    copyId: "academy.strategy.complementTheory",
    evidence: [
      { key: "navalProblem", label: "Comparative theory problem" },
    ],
  },
  {
    id: "first-phase-guardrail",
    number: "05",
    group: "CONTROL",
    title: "Set the controlling guardrail",
    prompt: "Which boundary would make apparent success politically self-defeating if it were crossed?",
    copyId: "academy.strategy.guardrail",
    evidence: [
      { key: "constraints", label: "Constraints" },
      { key: "civilianContext", label: "Civilian and neutral context" },
      { key: "politicalAim", label: "Political aim" },
    ],
    optionSet: "guardrail",
  },
];
