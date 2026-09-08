import {
  isReasonableRigidAdversaryAssessment,
  rigidAdversaryAssessmentCandidates,
  type AdversaryIntentAssumption,
  type AdversaryNextActionAssumption,
  type ObservedPatternAssumption,
  type RigidAdversaryAction,
  type RigidAdversaryActionCode,
  type RigidAdversaryAssessment,
  type RigidAssetImpact,
  type RigidGameState,
  type RigidInfliction,
  type RigidObservationDomain,
  type RigidTurnReport,
} from "./kriegsspiel";
import type { CapabilityDomain, ScenarioDisruption } from "./scenarioMatrix";

export const ABSOLUTE_CONTACT_THRESHOLD = 85;

export type AssumptionOption<T extends string> = {
  value: T;
  label: string;
  note: string;
};

export type AdversaryAssessmentOptions = {
  intent: AssumptionOption<AdversaryIntentAssumption>[];
  observedPattern: AssumptionOption<ObservedPatternAssumption>[];
  nextAction: AssumptionOption<AdversaryNextActionAssumption>[];
};

type BaseIntelligenceFact = {
  id: string;
  occurredTurn: number;
  discoveredTurn: number;
  knowledge: "absolute";
};

export type CommandIntelligenceFact = BaseIntelligenceFact & (
  | {
    kind: "adversary-action";
    action: RigidAdversaryActionCode;
    domains: RigidObservationDomain[];
  }
  | {
    kind: "infliction";
    sourceSide: RigidInfliction["sourceSide"];
    targetSide: RigidInfliction["targetSide"];
    effect: RigidInfliction["effect"];
    amount: number;
  }
  | {
    kind: "situation-change";
    change: "disruption" | "objective-revealed";
    headline: string;
    detail: string;
  }
  | {
    kind: "asset-impact";
    side: RigidAssetImpact["side"];
    label: string;
    quantity: number;
    status: RigidAssetImpact["status"];
    unavailableThroughTurn?: number;
  }
);

export type CommandIntelligenceHistoryTurn = {
  occurredTurn: number;
  discoveryGroups: Array<{
    discoveredTurn: number;
    facts: CommandIntelligenceFact[];
  }>;
};

export type CommandIntelligenceView = {
  facts: CommandIntelligenceFact[];
  immediate: CommandIntelligenceFact[];
  lastKnownAdversaryAction: CommandIntelligenceFact | null;
  history: CommandIntelligenceHistoryTurn[];
  potentials: AdversaryAssessmentOptions;
};

const INTENT_OPTIONS: Readonly<Record<AdversaryIntentAssumption, AssumptionOption<AdversaryIntentAssumption>>> = {
  "preserve-freedom": {
    value: "preserve-freedom",
    label: "Preserve freedom of movement",
    note: "Treat the observed activity as an effort to keep routes and timing open.",
  },
  "delay-objective": {
    value: "delay-objective",
    label: "Delay mission progress",
    note: "Treat delay, not decisive contact, as the likely purpose.",
  },
  "degrade-screen": {
    value: "degrade-screen",
    label: "Wear down the screen",
    note: "Treat pressure on strike-group protection as the likely purpose.",
  },
  "deny-classification": {
    value: "deny-classification",
    label: "Deny classification",
    note: "Treat ambiguity and broken custody as the likely purpose.",
  },
  "raise-political-cost": {
    value: "raise-political-cost",
    label: "Raise the political cost",
    note: "Treat escalation pressure as the likely purpose without assuming compliance.",
  },
  "insufficient-evidence": {
    value: "insufficient-evidence",
    label: "Evidence is insufficient",
    note: "Record that the observable picture does not support a narrower intent judgment.",
  },
};

const PATTERN_OPTIONS: Readonly<Record<ObservedPatternAssumption, AssumptionOption<ObservedPatternAssumption>>> = {
  "probing-screen": {
    value: "probing-screen",
    label: "A probe against the screen",
    note: "Interpret the pattern as testing detection, response, or protection boundaries.",
  },
  "masking-main-movement": {
    value: "masking-main-movement",
    label: "Activity masking a main movement",
    note: "Interpret incomplete or unstable tracks as cover for another movement.",
  },
  "concentrating-pressure": {
    value: "concentrating-pressure",
    label: "Pressure is concentrating",
    note: "Interpret observed strike-group effects as a more focused opposing effort.",
  },
  "dispersing-after-effects": {
    value: "dispersing-after-effects",
    label: "Elements may be dispersing",
    note: "Interpret the pattern as preservation or recovery after friendly effects.",
  },
  "holding-contested-position": {
    value: "holding-contested-position",
    label: "A contested position is holding",
    note: "Interpret the picture as continued presence without a clear directional change.",
  },
  "insufficient-evidence": {
    value: "insufficient-evidence",
    label: "Evidence is insufficient",
    note: "Record that the observable picture supports no narrower pattern judgment.",
  },
};

const NEXT_ACTION_OPTIONS: Readonly<Record<AdversaryNextActionAssumption, AssumptionOption<AdversaryNextActionAssumption>>> = {
  "probe-screen": {
    value: "probe-screen",
    label: "Probe the screen",
    note: "Prepare for a limited test of sensing, protection, or response timing.",
  },
  "contest-sensors": {
    value: "contest-sensors",
    label: "Contest the contact picture",
    note: "Prepare for masking, decoys, or pressure against track continuity.",
  },
  "concentrate-pressure": {
    value: "concentrate-pressure",
    label: "Concentrate pressure",
    note: "Prepare for another focused effort against the strike group.",
  },
  "mask-movement": {
    value: "mask-movement",
    label: "Mask another movement",
    note: "Prepare for observable activity to cover a different route or timing.",
  },
  "disengage-preserve": {
    value: "disengage-preserve",
    label: "Disengage and preserve",
    note: "Prepare for opposition to disperse, recover, or open distance.",
  },
  "exploit-disruption": {
    value: "exploit-disruption",
    label: "Exploit the disruption",
    note: "Prepare for opposition to use a confirmed disruption without assuming coordination.",
  },
  "insufficient-evidence": {
    value: "insufficient-evidence",
    label: "No next action is favored",
    note: "Record that the evidence supports no narrower expectation.",
  },
};

/**
 * Candidate construction reads only state already disclosed to the player.
 * Matrix commitments, actual opposing actions, exact actor count, and hidden
 * strategy never affect membership or ordering.
 */
export function adversaryAssessmentOptions(state: RigidGameState): AdversaryAssessmentOptions {
  const candidates = rigidAdversaryAssessmentCandidates(state);

  return {
    intent: candidates.intent.map((value) => INTENT_OPTIONS[value]),
    observedPattern: candidates.observedPattern.map((value) => PATTERN_OPTIONS[value]),
    nextAction: candidates.nextAction.map((value) => NEXT_ACTION_OPTIONS[value]),
  };
}

export function isReasonableAdversaryAssessment(
  state: RigidGameState,
  assessment: RigidAdversaryAssessment | undefined,
): assessment is Required<RigidAdversaryAssessment> {
  return isReasonableRigidAdversaryAssessment(state, assessment);
}

export function isPendingAdversaryAssessmentReasonable(
  state: RigidGameState,
  assessment: RigidAdversaryAssessment | undefined,
) {
  if (!assessment) return true;
  const options = adversaryAssessmentOptions(state);
  return (assessment.intent === undefined || options.intent.some((option) => option.value === assessment.intent))
    && (assessment.observedPattern === undefined || options.observedPattern.some((option) => option.value === assessment.observedPattern))
    && (assessment.nextAction === undefined || options.nextAction.some((option) => option.value === assessment.nextAction));
}

function contactAfterReports(state: RigidGameState) {
  let contact = state.contactQuality - state.reports.reduce((sum, report) => sum + report.delta.contactQuality, 0);
  const byTurn = new Map<number, number>();
  for (const report of state.reports) {
    contact += report.delta.contactQuality;
    byTurn.set(report.turn, contact);
  }
  return byTurn;
}

function physicalDomains(domains: readonly CapabilityDomain[]) {
  return domains.filter((domain): domain is RigidObservationDomain => (
    domain === "air" || domain === "surface" || domain === "subsurface"
  ));
}

function reportCanEstablish(
  report: RigidTurnReport,
  contactQuality: number,
  domains: readonly CapabilityDomain[] | readonly RigidObservationDomain[],
) {
  if (contactQuality < ABSOLUTE_CONTACT_THRESHOLD) return false;
  const observed = report.observationDomains ?? [];
  const relevantPhysical = physicalDomains(domains as readonly CapabilityDomain[]);
  if (relevantPhysical.some((domain) => observed.includes(domain))) return true;
  const nonPhysicalOnly = domains.length > 0 && relevantPhysical.length === 0;
  return nonPhysicalOnly && contactQuality >= 95 && observed.length >= 2;
}

function firstDiscoveryTurn(
  state: RigidGameState,
  occurredTurn: number,
  domains: readonly CapabilityDomain[] | readonly RigidObservationDomain[],
  contactByTurn: ReadonlyMap<number, number>,
) {
  for (const report of state.reports) {
    if (report.turn < occurredTurn) continue;
    if (reportCanEstablish(report, contactByTurn.get(report.turn) ?? 0, domains)) return report.turn;
  }
  return null;
}

function actionFact(
  action: RigidAdversaryAction,
  state: RigidGameState,
  contactByTurn: ReadonlyMap<number, number>,
): CommandIntelligenceFact | null {
  const pressureObserved = action.action === "apply-pressure"
    && state.reports.find((report) => report.turn === action.occurredTurn)?.inflictions?.some((entry) => (
      entry.sourceSide === "opposing-force" && entry.targetSide === "selected-force"
    ));
  const discoveredTurn = pressureObserved
    ? action.occurredTurn
    : firstDiscoveryTurn(state, action.occurredTurn, action.domains, contactByTurn);
  if (!discoveredTurn || discoveredTurn > state.turn) return null;
  return {
    id: action.id,
    kind: "adversary-action",
    occurredTurn: action.occurredTurn,
    discoveredTurn,
    knowledge: "absolute",
    action: action.action,
    domains: [...action.domains],
  };
}

function inflictionFact(infliction: RigidInfliction, state: RigidGameState): CommandIntelligenceFact | null {
  if (infliction.occurredTurn > state.turn) return null;
  return {
    id: infliction.id,
    kind: "infliction",
    occurredTurn: infliction.occurredTurn,
    discoveredTurn: infliction.occurredTurn,
    knowledge: "absolute",
    sourceSide: infliction.sourceSide,
    targetSide: infliction.targetSide,
    effect: infliction.effect,
    amount: infliction.amount,
  };
}

function disruptionDiscoveryTurn(
  state: RigidGameState,
  event: ScenarioDisruption,
  contactByTurn: ReadonlyMap<number, number>,
) {
  if (event.kind === "opposing-coordination" || event.kind === "opportunistic-actor") return null;
  if (event.kind === "command-interference" && event.affectedSide === "opposing-force") return null;
  const direct = event.kind === "severe-weather"
    || event.kind === "objective-change"
    || event.kind === "command-interference" && event.affectedSide !== "opposing-force";
  const planningTurn = state.phase === "active"
    ? Math.min(state.maxTurns, state.turn + 1)
    : state.turn;
  if (direct) return event.startsTurn <= planningTurn ? event.startsTurn : null;
  return firstDiscoveryTurn(state, event.startsTurn, event.affectedDomains, contactByTurn);
}

function disruptionFacts(state: RigidGameState, contactByTurn: ReadonlyMap<number, number>) {
  const matrix = state.matrix;
  if (!matrix) return [];
  const disclosureTurn = state.phase === "active"
    ? Math.min(state.maxTurns, state.turn + 1)
    : state.turn;
  return matrix.activeDisruptions.flatMap((event): CommandIntelligenceFact[] => {
    const discoveredTurn = disruptionDiscoveryTurn(state, event, contactByTurn);
    if (!discoveredTurn || discoveredTurn > disclosureTurn) return [];
    return [{
      id: `situation-${event.id}`,
      kind: "situation-change",
      occurredTurn: event.startsTurn,
      discoveredTurn,
      knowledge: "absolute",
      change: "disruption",
      headline: event.headline,
      detail: event.description,
    }];
  });
}

function impactFacts(state: RigidGameState, contactByTurn: ReadonlyMap<number, number>) {
  const matrix = state.matrix;
  if (!matrix) return [];
  const events = new Map(matrix.activeDisruptions.map((event) => [event.id, event]));
  return (state.disruptionImpacts ?? []).flatMap((impact): CommandIntelligenceFact[] => {
    if (impact.knowledge !== "confirmed") return [];
    const event = events.get(impact.disruptionId);
    const disclosureTurn = impact.side === "selected-force"
      ? state.phase === "active" ? Math.min(state.maxTurns, state.turn + 1) : state.turn
      : state.turn;
    if (!event || event.startsTurn > disclosureTurn) return [];
    const discoveredTurn = impact.side === "selected-force"
      ? event.startsTurn
      : firstDiscoveryTurn(state, event.startsTurn, [impact.domain], contactByTurn);
    if (!discoveredTurn || discoveredTurn > disclosureTurn) return [];
    return [{
      id: `impact-${impact.id}`,
      kind: "asset-impact",
      occurredTurn: event.startsTurn,
      discoveredTurn,
      knowledge: "absolute",
      side: impact.side,
      label: impact.label,
      quantity: impact.quantity,
      status: impact.status,
      ...(impact.unavailableThroughTurn === undefined ? {} : { unavailableThroughTurn: impact.unavailableThroughTurn }),
    }];
  });
}

function objectiveFacts(state: RigidGameState) {
  const objective = state.matrix?.activeSecondaryObjective;
  const planningTurn = state.phase === "active"
    ? Math.min(state.maxTurns, state.turn + 1)
    : state.turn;
  if (!objective || objective.revealTurn > planningTurn) return [];
  return [{
    id: `objective-${objective.id}`,
    kind: "situation-change" as const,
    occurredTurn: objective.revealTurn,
    discoveredTurn: objective.revealTurn,
    knowledge: "absolute" as const,
    change: "objective-revealed" as const,
    headline: objective.label,
    detail: objective.description,
  }];
}

function compareFacts(left: CommandIntelligenceFact, right: CommandIntelligenceFact) {
  return left.occurredTurn - right.occurredTurn
    || left.discoveredTurn - right.discoveredTurn
    || left.kind.localeCompare(right.kind, "en")
    || left.id.localeCompare(right.id, "en");
}

export function deriveCommandIntelligence(state: RigidGameState): CommandIntelligenceView {
  const contactByTurn = contactAfterReports(state);
  const reportFacts = state.reports.flatMap((report) => [
    ...(report.adversaryActions ?? []).flatMap((action) => {
      const fact = actionFact(action, state, contactByTurn);
      return fact ? [fact] : [];
    }),
    ...(report.inflictions ?? []).flatMap((infliction) => {
      const fact = inflictionFact(infliction, state);
      return fact ? [fact] : [];
    }),
  ]);
  const facts = [
    ...reportFacts,
    ...disruptionFacts(state, contactByTurn),
    ...impactFacts(state, contactByTurn),
    ...objectiveFacts(state),
  ].sort(compareFacts);
  const lastKnownAdversaryAction = [...facts]
    .reverse()
    .find((fact) => fact.kind === "adversary-action") ?? null;
  const decisionTurn = state.phase === "active"
    ? Math.min(state.maxTurns, state.turn + 1)
    : state.turn;
  const immediateIds = new Set(
    facts.filter((fact) => (
      fact.discoveredTurn === state.turn
      || fact.discoveredTurn === decisionTurn
        && fact.occurredTurn > state.turn
    )).map((fact) => fact.id),
  );
  if (lastKnownAdversaryAction) immediateIds.add(lastKnownAdversaryAction.id);
  const immediate = facts.filter((fact) => immediateIds.has(fact.id));
  const history: CommandIntelligenceHistoryTurn[] = Array.from(
    { length: state.turn },
    (_, index) => index + 1,
  ).map((occurredTurn) => {
    const turnFacts = facts.filter((fact) => fact.occurredTurn === occurredTurn);
    const discoveryTurns = [...new Set(turnFacts.map((fact) => fact.discoveredTurn))].sort((left, right) => left - right);
    return {
      occurredTurn,
      discoveryGroups: discoveryTurns.map((discoveredTurn) => ({
        discoveredTurn,
        facts: turnFacts.filter((fact) => fact.discoveredTurn === discoveredTurn),
      })),
    };
  });
  return {
    facts,
    immediate,
    lastKnownAdversaryAction,
    history,
    potentials: adversaryAssessmentOptions(state),
  };
}

export function formatCommandIntelligenceFact(fact: CommandIntelligenceFact) {
  if (fact.kind === "adversary-action") {
    const labels: Record<RigidAdversaryActionCode, string> = {
      "apply-pressure": "Opposition applied pressure against the strike group.",
      "probe-screen": "Opposing movement entered the observed boundary of the strike-group screen.",
      "contest-sensors": "Opposing tracks broke or complicated continuity in the contact picture.",
      "mask-movement": "Observed opposing activity obscured continuity of the principal movement.",
      "disperse-and-preserve": "Observed opposing elements increased separation after friendly effects.",
      "hold-and-preserve": "Observed opposing movement held its position.",
      "exploit-disruption": "Observed opposing activity increased in the operating area.",
    };
    return { label: "OPPOSING ACTION", detail: labels[fact.action] };
  }
  if (fact.kind === "infliction") {
    const friendly = fact.sourceSide === "selected-force";
    return {
      label: friendly ? "FRIENDLY INFLICTION" : "OPPOSING INFLICTION",
      detail: friendly
        ? `Friendly effects reduced modeled opposing cohesion by ${fact.amount} points.`
        : `Opposing pressure reduced strike-group integrity by ${fact.amount} points.`,
    };
  }
  if (fact.kind === "asset-impact") {
    const duration = fact.unavailableThroughTurn === undefined
      ? "The impairment is permanent for this run."
      : `Unavailable through turn ${fact.unavailableThroughTurn}.`;
    return {
      label: fact.side === "selected-force" ? "CONFIRMED FORCE CHANGE" : "CONFIRMED OPPOSING CHANGE",
      detail: `${fact.quantity} × ${fact.label}: ${fact.status}. ${duration}`,
    };
  }
  return {
    label: fact.change === "objective-revealed" ? "OBJECTIVE CHANGE" : "SITUATION CHANGE",
    detail: `${fact.headline}. ${fact.detail}`,
  };
}

export function formatAdversaryAssessment(assessment: RigidAdversaryAssessment | undefined) {
  if (!assessment?.intent || !assessment.observedPattern || !assessment.nextAction) return null;
  return {
    intent: INTENT_OPTIONS[assessment.intent].label,
    observedPattern: PATTERN_OPTIONS[assessment.observedPattern].label,
    nextAction: NEXT_ACTION_OPTIONS[assessment.nextAction].label,
  };
}

export const COMMAND_INTELLIGENCE_ANNOUNCEMENT_LIMIT = 300;

/**
 * Keep the polite update finite. The complete, ordinary review remains in
 * Immediate and History, so clipping this status never drops canonical data.
 */
export function commandIntelligenceAnnouncement(
  state: RigidGameState,
  facts: readonly CommandIntelligenceFact[],
) {
  if (state.turn === 0) return "Turn 1 command baseline. No prior action log exists.";

  const summaries = facts.slice(0, 3).map((fact) => formatCommandIntelligenceFact(fact).detail);
  const remainder = facts.length - summaries.length;
  const prefix = `Turn ${state.turn} resolved; Turn ${Math.min(state.maxTurns, state.turn + 1)} intelligence updated. `;
  const suffix = remainder > 0 ? ` ${remainder} more entries are available in Immediate.` : "";
  const fallback = "No immediate absolute action, infliction, or direct condition was established.";
  const body = summaries.length ? summaries.join(" ") : fallback;
  const available = COMMAND_INTELLIGENCE_ANNOUNCEMENT_LIMIT - prefix.length - suffix.length;
  const boundedBody = body.length <= available
    ? body
    : `${body.slice(0, Math.max(0, available - 1)).trimEnd()}…`;
  return `${prefix}${boundedBody}${suffix}`;
}
