import type { EndState, Guardrail, TheoryLens, Warfare } from "./gameModel";

/**
 * Canonical player-facing labels for the five first-phase decisions. Keeping
 * these outside the planning page lets the Academy present every option with
 * identical wording and ordering, without importing adjudication authority.
 */
export const WARFARE: { id: Warfare; label: string; detail: string }[] = [
  { id: "air-defense", label: "Air defence", detail: "Task-group and local air defence" },
  { id: "surface-operations", label: "Surface operations", detail: "Surface detection, tracking, and engagement" },
  { id: "undersea-operations", label: "Anti-submarine operations", detail: "Submarine detection, tracking, and engagement" },
  { id: "land-attack", label: "Land attack", detail: "Conventional effects against objectives ashore" },
  { id: "electromagnetic-operations", label: "Electromagnetic operations", detail: "Detect, identify, protect, deceive, and disrupt" },
  { id: "reconnaissance", label: "Intelligence and reconnaissance", detail: "Situational awareness, reconnaissance, and identification" },
  { id: "mine-countermeasures", label: "Mine countermeasures", detail: "Mine detection, avoidance, and neutralization" },
  { id: "missile-defense", label: "Missile defence", detail: "Task-group defence against long-range missiles" },
  { id: "maritime-interdiction", label: "Maritime interception and safeguarding", detail: "Identification, lawful interception, rescue, evidence custody, and protected handoff" },
];

export const END_STATES: { id: EndState; label: string }[] = [
  { id: "access", label: "Preserve reliable access" },
  { id: "protection", label: "Protect noncombatants" },
  { id: "denial", label: "Deny hostile control" },
  { id: "limited-compellence", label: "Compel a limited concession" },
  { id: "status-quo", label: "Restore the status quo" },
];

export const THEORY_LENSES: { id: TheoryLens; label: string; note: string }[] = [
  { id: "sun-tzu", label: "Sun Tzu · shape choices", note: "Change information, position, and incentives before destructive commitment." },
  { id: "clausewitz", label: "Clausewitz · political purpose", note: "Scale effort to the value of the political aim and anticipate reciprocal adaptation." },
  { id: "mahan", label: "Mahan · maritime system", note: "Link concentrated sea power to commerce, access, position, and collective capacity." },
  { id: "aube", label: "Aube · asymmetric maritime pressure", note: "Use distributed coastal and commerce pressure to impose costs a stronger fleet cannot ignore." },
  { id: "corbett", label: "Corbett · limited control", note: "Secure the degree of maritime communications needed for the political purpose." },
  { id: "richmond", label: "Richmond · communications and judgment", note: "Connect maritime communications, professional learning, and fleet action to political policy." },
  { id: "wegener", label: "Wegener · position before battle", note: "Test whether geography, access, and bases permit tactical power to produce strategic effect." },
  { id: "castex", label: "Castex · strategic combinations", note: "Combine control, denial, protection, and pressure according to circumstance rather than formula." },
  { id: "panikkar", label: "Panikkar · regional maritime order", note: "Read security through regional routes, coastal exposure, external presence, and political autonomy." },
  { id: "gorshkov", label: "Gorshkov · comprehensive sea power", note: "Link fleets, submarines, industry, science, peacetime presence, and political reach." },
  { id: "liu-huaqing", label: "Liu · phased maritime development", note: "Sequence doctrine, technology, training, industry, access, and defensive depth." },
  { id: "till", label: "Till · maritime order and sea use", note: "Integrate competitive, cooperative, economic, diplomatic, and constabulary uses of the sea." },
  { id: "galula", label: "Galula · political legitimacy", note: "Evaluate security through civilian protection, political order, and legitimacy." },
];

export const GUARDRAILS: { id: Guardrail; label: string }[] = [
  { id: "escalation", label: "Limit escalation" },
  { id: "civilian", label: "Protect civilian life and traffic" },
  { id: "coalition", label: "Preserve coalition cohesion" },
  { id: "legitimacy", label: "Preserve political legitimacy" },
  { id: "sustainability", label: "Preserve long-term capacity" },
];
