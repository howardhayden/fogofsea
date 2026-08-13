import type { Guardrail, TheoryLens } from "./gameModel";

export type RiskTreatment = "prepare" | "respond" | "recover" | "mitigate";
export type CoordinationMode = "centralized" | "federated" | "mutual-support" | "independent";
export type StrategicForcePolicy = "conventional-restraint" | "nuclear-deterrent" | "nuclear-demonstration" | "nuclear-employment";

const RISK_TREATMENTS: readonly RiskTreatment[] = ["prepare", "respond", "recover", "mitigate"];
const COORDINATION_MODES: readonly CoordinationMode[] = ["centralized", "federated", "mutual-support", "independent"];
const STRATEGIC_FORCE_POLICIES: readonly StrategicForcePolicy[] = ["conventional-restraint", "nuclear-deterrent", "nuclear-demonstration", "nuclear-employment"];

export const isRiskTreatment = (value: unknown): value is RiskTreatment => RISK_TREATMENTS.includes(value as RiskTreatment);
export const isCoordinationMode = (value: unknown): value is CoordinationMode => COORDINATION_MODES.includes(value as CoordinationMode);
export const isStrategicForcePolicy = (value: unknown): value is StrategicForcePolicy => STRATEGIC_FORCE_POLICIES.includes(value as StrategicForcePolicy);

export const RISK_TREATMENT_OPTIONS = [
  { value: "prepare", label: "Prepare and anticipate", note: "Improve warning, reserves, contingency arrangements, and role clarity before the next hazard or opposing move." },
  { value: "respond", label: "Respond and stabilize", note: "Protect the force and essential movement now; immediate stabilization can consume reserves needed later." },
  { value: "recover", label: "Recover and reconstitute", note: "Restore readiness, supply, and continuity after disruption instead of treating initial response as completion." },
  { value: "mitigate", label: "Mitigate recurring risk", note: "Reduce exposure and vulnerability so the same hazard or adversary combination causes less harm on later turns." },
] as const;

export const COORDINATION_OPTIONS = [
  { value: "centralized", label: "Centralized direction", note: "Produces unity and clear priorities but creates delay and a concentrated coordination dependency." },
  { value: "federated", label: "Federated coordination", note: "Partners retain local authority while sharing intent, thresholds, resources, and a common information picture." },
  { value: "mutual-support", label: "Mutual-support network", note: "Dispersed elements exchange warning, recovery, and protection without requiring one controlling node." },
  { value: "independent", label: "Independent action", note: "Reduces coordination signatures and delay but risks duplication, gaps, and adversaries defeating elements separately." },
] as const;

export const STRATEGIC_FORCE_OPTIONS = [
  { value: "conventional-restraint", label: "Conventional restraint", note: "Preserve escalation control and rely on reversible pressure, protection, and recovery capacity." },
  { value: "nuclear-deterrent", label: "Nuclear deterrent reserve", note: "Retain nuclear capability solely to influence adversary calculations; deterrence may fail or produce competitive countermeasures." },
  { value: "nuclear-demonstration", label: "Nuclear demonstration", note: "Signal readiness without direct employment; ambiguity and reciprocal mobilization sharply increase escalation risk." },
  { value: "nuclear-employment", label: "Nuclear employment", note: "Use abstract strategic effects. It can disrupt adversaries but imposes extreme escalation, legitimacy, coordination, and recovery consequences." },
] as const;

export type RiskEffects = {
  contact: number;
  integrity: number;
  readiness: number;
  supply: number;
  objective: number;
  cohesion: number;
  escalation: number;
  pressure: number;
  note: string;
};

export function assessRiskEffects(input: {
  treatment: RiskTreatment;
  coordination: CoordinationMode;
  strategicPolicy: StrategicForcePolicy;
  turn: number;
  adversaryCount: number;
  selectedLens?: TheoryLens;
  guardrail: Guardrail;
  currentIntegrity: number;
  currentSupply: number;
}): RiskEffects {
  const adversaries = Math.max(1, Math.min(3, Math.floor(input.adversaryCount)));
  const effects: RiskEffects = { contact: 0, integrity: 0, readiness: 0, supply: 0, objective: 0, cohesion: 0, escalation: 0, pressure: adversaries - 1, note: "" };
  if (input.treatment === "prepare") Object.assign(effects, { contact: 5, readiness: 3, supply: -1, pressure: effects.pressure - 1, note: "Preparedness improved warning, reserves, and role clarity." });
  if (input.treatment === "respond") Object.assign(effects, { integrity: 4, objective: 3, supply: -3, pressure: effects.pressure - 2, note: "Response protected essential functions while consuming immediate reserves." });
  if (input.treatment === "recover") Object.assign(effects, { integrity: input.currentIntegrity < 75 ? 7 : 2, readiness: 5, supply: input.currentSupply < 65 ? 4 : 1, objective: -2, note: "Recovery reconstituted capacity but displaced some immediate pressure on the objective." });
  if (input.treatment === "mitigate") Object.assign(effects, { readiness: 2, objective: input.turn >= 3 ? 4 : 1, pressure: effects.pressure - Math.max(1, Math.floor(input.turn / 2)), supply: -2, note: "Mitigation reduced recurring exposure and vulnerability." });

  if (input.coordination === "centralized") { effects.contact += 2; effects.objective += 2; effects.pressure += adversaries > 1 ? 2 : 0; }
  if (input.coordination === "federated") { effects.contact += 3; effects.readiness += 2; effects.pressure -= 1; }
  if (input.coordination === "mutual-support") { effects.integrity += 3; effects.supply += 1; effects.pressure -= 1; }
  if (input.coordination === "independent") { effects.contact -= adversaries; effects.pressure += adversaries; }

  const mahanianConcentration = input.selectedLens === "mahan";
  if (mahanianConcentration && adversaries > 1 && input.coordination === "centralized") effects.pressure += 3;
  if (mahanianConcentration && adversaries > 1 && (input.coordination === "federated" || input.coordination === "mutual-support")) effects.objective += 3;

  if (input.strategicPolicy === "nuclear-deterrent") { effects.cohesion += 2; effects.escalation += adversaries + 1; }
  if (input.strategicPolicy === "nuclear-demonstration") { effects.cohesion += 6; effects.objective += 2; effects.escalation += 18 + adversaries * 3; effects.pressure += 2; }
  if (input.strategicPolicy === "nuclear-employment") {
    effects.cohesion += 18 + adversaries * 4;
    effects.objective += 6;
    effects.escalation += 48 + adversaries * 7;
    effects.integrity -= 8;
    effects.readiness -= 8;
    effects.supply -= 8;
    effects.pressure += 8;
  }
  if (input.strategicPolicy !== "conventional-restraint" && ["civilian", "coalition", "legitimacy", "escalation"].includes(input.guardrail)) effects.escalation += 6;
  return effects;
}
