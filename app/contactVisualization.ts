import type { Aircraft, Armament, Platform, TrackingMethod } from "./gameModel";
import type { ScenarioDisruption } from "./scenarioMatrix";
import { seededRandom, type ViewLayer } from "./viewModel";

export type ContactDomain = "air" | "surface" | "subsurface";
export type ContactVisibility = Readonly<Record<ContactDomain, boolean>>;
export type PublicSituationKnowledge = "confirmed" | "assessed" | "concealed";

export type AssessedImpactDomain = ContactDomain | "mission-pack" | "communications";

type CountMap = Readonly<Record<string, number>>;

export type ContactVisibilityInput = {
  platformCounts: CountMap;
  aircraftCounts: CountMap;
  armamentCounts: CountMap;
  platforms: readonly Platform[];
  aircraft: readonly Aircraft[];
  armaments: readonly Armament[];
};

export type UnknownContact = {
  domain: ContactDomain;
  x: number;
  y: number;
  z: number;
  scale: number;
  heading: number;
};

export type ContactVisualizationPlan = {
  seed: number;
  contacts: UnknownContact[];
  counts: Record<ContactDomain, number>;
};

export const CONTACT_LIMITS = {
  air: 3,
  surface: 3,
  subsurface: 2,
  total: 8,
} as const;

const DOMAIN_WARFARE: Record<ContactDomain, ReadonlySet<string>> = {
  air: new Set(["air-defense", "missile-defense"]),
  surface: new Set(["surface-operations", "maritime-interdiction"]),
  subsurface: new Set(["undersea-operations"]),
} as const;

const DOMAIN_TERMS = {
  air: /air picture|air defence|air defense|airborne warning|intercept|missile defence|missile defense|combat air patrol/i,
  surface: /surface (?:contact|detection|track(?:ing)?|classification|identification|movement|picture|watch)|tracks? surface|surface and undersea contacts|sea control|maritime patrol|ocean patrol|coastal reconnaissance/i,
  subsurface: /undersea|submarine|acoustic|bathymetric|mine-search|underwater/i,
} as const;

const DOMAIN_TRACKING_METHODS: Record<ContactDomain, ReadonlySet<TrackingMethod>> = {
  air: new Set(["active radar", "passive emitter", "infrared", "cooperative network"]),
  surface: new Set(["active radar", "passive emitter", "electro-optical", "infrared", "cooperative network"]),
  subsurface: new Set(["active acoustic", "passive acoustic", "magnetic anomaly", "bathymetric comparison"]),
};

function credited(counts: CountMap, id: string) {
  const count = counts[id];
  return Number.isFinite(count) && count > 0;
}

function hasWarfare(domain: ContactDomain, warfare: readonly string[]) {
  return warfare.some((area) => DOMAIN_WARFARE[domain].has(area));
}

function textFor(item: { name: string; role: string; capabilities?: readonly string[] }) {
  return [item.name, item.role, ...(item.capabilities ?? [])].join(" ");
}

function hasDomainTracking(domain: ContactDomain, methods: readonly TrackingMethod[]) {
  return methods.some((method) => DOMAIN_TRACKING_METHODS[domain].has(method));
}

function platformCanTrack(platform: Platform, domain: ContactDomain) {
  if (domain === "air" && platform.airDefenseValue > 0) return true;
  if (domain === "subsurface" && platform.aswValue > 0) return true;
  return hasWarfare(domain, platform.warfare) || DOMAIN_TERMS[domain].test(textFor(platform));
}

function aircraftCanTrack(aircraft: Aircraft, domain: ContactDomain) {
  const contextualEvidence = hasWarfare(domain, aircraft.warfare) || DOMAIN_TERMS[domain].test(textFor(aircraft));
  return aircraft.trackCapacity > 0 && contextualEvidence && hasDomainTracking(domain, aircraft.trackingMethods);
}

function armamentCanTrack(armament: Armament, domain: ContactDomain) {
  const contextualEvidence = hasWarfare(domain, armament.warfare) || DOMAIN_TERMS[domain].test(textFor(armament));
  return armament.trackCapacity > 0 && contextualEvidence && hasDomainTracking(domain, armament.trackingMethods);
}

/**
 * Derives only whether the credited force can form a credible contact in each
 * environment. Raw selections and unsupported hosts must be filtered before
 * this helper is called; no opposing identity or composition enters the rule.
 */
export function deriveContactVisibility(input: ContactVisibilityInput): ContactVisibility {
  const canDetect = (domain: ContactDomain) => (
    input.platforms.some((platform) => credited(input.platformCounts, platform.id) && platformCanTrack(platform, domain))
      || input.aircraft.some((aircraft) => credited(input.aircraftCounts, aircraft.id) && aircraftCanTrack(aircraft, domain))
      || input.armaments.some((armament) => credited(input.armamentCounts, armament.id) && armamentCanTrack(armament, domain))
  );
  return {
    air: canDetect("air"),
    surface: canDetect("surface"),
    subsurface: canDetect("subsurface"),
  };
}

/**
 * Keeps assessed opposing losses behind both a minimum global contact picture
 * and the credited force's domain-specific sensing. Network and mission-pack
 * assessments require at least one credible sensed domain; they never inherit
 * visibility from contact quality alone.
 */
export function canDiscloseOpposingImpact(
  domain: AssessedImpactDomain,
  contactQuality: number,
  visibility: ContactVisibility,
) {
  if (!Number.isFinite(contactQuality) || contactQuality < 40) return false;
  if (domain === "mission-pack" || domain === "communications") {
    return visibility.air || visibility.surface || visibility.subsurface;
  }
  return visibility[domain];
}

/**
 * Reduces a committed disruption to what the selected force can actually know.
 * Environmental effects and interference with the player's own command are
 * directly observable. Opposing behavior remains concealed until both the
 * contact threshold and relevant credited sensing support an assessment; it
 * is never promoted to confirmed merely because the matrix committed it.
 */
export function publicKnowledgeForDisruption(
  disruption: Pick<ScenarioDisruption, "kind" | "affectedSide" | "affectedDomains">,
  contactQuality: number,
  visibility: ContactVisibility,
): PublicSituationKnowledge {
  if (disruption.kind === "severe-weather" || disruption.kind === "objective-change") return "confirmed";
  if (disruption.kind === "command-interference" && disruption.affectedSide !== "opposing-force") return "confirmed";

  const assessed = disruption.affectedDomains.some((domain) => (
    canDiscloseOpposingImpact(domain, contactQuality, visibility)
  ));
  return assessed ? "assessed" : "concealed";
}

function contactPosition(domain: ContactDomain, random: () => number): UnknownContact {
  const x = -13 + random() * 26;
  const z = -12 + random() * 24;
  return {
    domain,
    x,
    y: domain === "air" ? 5.8 + random() * 5.2 : domain === "surface" ? 0.58 : -3.8 - random() * 1.5,
    z,
    scale: 0.78 + random() * 0.54,
    heading: random() * Math.PI * 2,
  };
}

/** Makes bounded unknown-contact locations from capability flags and a seed. */
export function createContactVisualizationPlan(seed: number, visibility: ContactVisibility): ContactVisualizationPlan {
  const random = seededRandom(seed ^ 0xc07ac7);
  const domains: ContactDomain[] = ["air", "surface", "subsurface"];
  const contacts = domains.flatMap((domain) => {
    if (!visibility[domain]) return [];
    const count = 1 + Math.floor(random() * CONTACT_LIMITS[domain]);
    return Array.from({ length: count }, () => contactPosition(domain, random));
  });
  return {
    seed,
    contacts,
    counts: {
      air: contacts.filter((contact) => contact.domain === "air").length,
      surface: contacts.filter((contact) => contact.domain === "surface").length,
      subsurface: contacts.filter((contact) => contact.domain === "subsurface").length,
    },
  };
}

export function contactDomainForView(viewLayer: ViewLayer): ContactDomain | null {
  if (viewLayer === "sky" || viewLayer === "air") return "air";
  if (viewLayer === "surface") return "surface";
  if (viewLayer === "subsurface") return "subsurface";
  return null;
}

export function contactsForView(plan: ContactVisualizationPlan, viewLayer: ViewLayer) {
  const domain = contactDomainForView(viewLayer);
  return domain ? plan.contacts.filter((contact) => contact.domain === domain) : [];
}
