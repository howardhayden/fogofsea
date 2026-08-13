import type { Climate, Clouds, Precipitation, Season, TimeOfDay } from "./gameModel";
import { seededRandom, stableSeed, type ViewLayer } from "./viewModel";

export type WildlifeKind = "penguin" | "seal" | "whale" | "dolphin" | "shark" | "seabird" | "shorebird";
export type WildlifeMedium = "air" | "ice" | "surface" | "subsurface";
export type WildlifeBehavior = "gliding" | "circling" | "resting" | "commuting" | "surfacing" | "porpoising" | "swimming";
export type LandProximity = "near-land" | "coastal" | "offshore";

export type WildlifeMemberPlan = {
  id: string;
  x: number;
  y: number;
  z: number;
  depth: number;
  scale: number;
  heading: number;
  phase: number;
  speed: number;
  radius: number;
  routeEccentricity: number;
  routeDirection: -1 | 1;
  /** A deterministic rest stop on an otherwise bounded ecological route.
   * Only a minority of a multi-penguin group may receive this pose. */
  restingPose: boolean;
};

export type WildlifeGroupPlan = {
  id: string;
  kind: WildlifeKind;
  label: string;
  behavior: WildlifeBehavior;
  count: number;
  members: WildlifeMemberPlan[];
};

export type WildlifePlan = {
  seed: number;
  regionId: string;
  proximityToLand: LandProximity;
  iceEdge: boolean;
  groups: WildlifeGroupPlan[];
  individualCount: number;
  description: string;
};

export type VisibleWildlife = WildlifeMemberPlan & {
  groupId: string;
  kind: WildlifeKind;
  label: string;
  medium: WildlifeMedium;
  behavior: WildlifeBehavior;
};

export const WILDLIFE_LIMITS = {
  maxGroups: 6,
  maxIndividuals: 48,
  maxBirds: 24,
  maxPenguins: 14,
  maxSeals: 8,
  maxLargeAnimals: 8,
} as const;

type WildlifeInput = {
  seed: number;
  regionId: string;
  climate: Climate;
  season: Season | string;
  time: TimeOfDay;
  clouds: Clouds;
  precipitation: Precipitation;
  storming: boolean;
  windSpeed: number;
  seaState: number;
  visibility: number;
};

type RegionalEcology = {
  proximityToLand: LandProximity;
  iceEdge: boolean;
  candidates: ReadonlyArray<readonly [WildlifeKind, number]>;
};

const REGION_ECOLOGY: Record<string, RegionalEcology> = {
  "pelagic-island-arc": { proximityToLand: "coastal", iceEdge: false, candidates: [["seabird", 9], ["dolphin", 5], ["shark", 3], ["whale", 2]] },
  "western-tropical-passage": { proximityToLand: "coastal", iceEdge: false, candidates: [["seabird", 11], ["shorebird", 5], ["dolphin", 6], ["shark", 4], ["whale", 2]] },
  "equatorial-convergence": { proximityToLand: "near-land", iceEdge: false, candidates: [["seabird", 10], ["shorebird", 6], ["dolphin", 6], ["shark", 3], ["whale", 1]] },
  "temperate-strait": { proximityToLand: "near-land", iceEdge: false, candidates: [["seabird", 9], ["shorebird", 7], ["seal", 5], ["dolphin", 5], ["shark", 2], ["whale", 2]] },
  "boreal-ice-gate": { proximityToLand: "near-land", iceEdge: true, candidates: [["seabird", 8], ["shorebird", 4], ["seal", 7], ["whale", 2]] },
  "polar-archipelago": { proximityToLand: "near-land", iceEdge: true, candidates: [["seabird", 9], ["seal", 8], ["whale", 2]] },
  "southern-ice-margin": { proximityToLand: "offshore", iceEdge: true, candidates: [["penguin", 12], ["seal", 7], ["seabird", 9], ["whale", 2]] },
  "austral-research-corridor": { proximityToLand: "near-land", iceEdge: true, candidates: [["penguin", 14], ["seal", 8], ["seabird", 10], ["shorebird", 4], ["whale", 2]] },
};

const LABELS: Record<WildlifeKind, string> = {
  penguin: "penguins",
  seal: "seals",
  whale: "large whales",
  dolphin: "dolphins or porpoises",
  shark: "sharks",
  seabird: "pelagic seabirds",
  shorebird: "coastal birds",
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, Number.isFinite(value) ? value : minimum));
}

function fallbackEcology(climate: Climate): RegionalEcology {
  if (climate === "antarctic") return REGION_ECOLOGY["southern-ice-margin"];
  if (climate === "arctic") return REGION_ECOLOGY["polar-archipelago"];
  return REGION_ECOLOGY["pelagic-island-arc"];
}

function seasonalFactor(kind: WildlifeKind, climate: Climate, season: string) {
  if (season === "wet" || season === "dry") return kind === "shorebird" && season === "wet" ? 0.82 : 1;
  if (climate === "antarctic") {
    if (kind === "penguin") return { winter: 0.22, spring: 1, summer: 1, autumn: 0.64 }[season] ?? 0.65;
    if (kind === "seal" || kind === "seabird" || kind === "shorebird") return { winter: 0.28, spring: 0.9, summer: 1, autumn: 0.62 }[season] ?? 0.65;
    return { winter: 0.72, spring: 0.9, summer: 1, autumn: 0.9 }[season] ?? 0.85;
  }
  if (climate === "arctic") {
    if (kind === "seabird" || kind === "shorebird") return { winter: 0.08, spring: 0.82, summer: 1, autumn: 0.52 }[season] ?? 0.5;
    if (kind === "seal") return { winter: 0.56, spring: 1, summer: 0.82, autumn: 0.68 }[season] ?? 0.7;
    return { winter: 0.42, spring: 0.72, summer: 1, autumn: 0.78 }[season] ?? 0.7;
  }
  if (kind === "shorebird") return { winter: 0.42, spring: 0.88, summer: 1, autumn: 0.78 }[season] ?? 0.8;
  return { winter: 0.62, spring: 0.9, summer: 1, autumn: 0.88 }[season] ?? 0.85;
}

function timeFactor(kind: WildlifeKind, time: TimeOfDay) {
  if (kind === "seabird" || kind === "shorebird") return { dawn: 0.86, day: 1, dusk: 0.68, night: 0.1 }[time];
  if (kind === "penguin" || kind === "seal") return { dawn: 0.82, day: 1, dusk: 0.76, night: 0.34 }[time];
  return { dawn: 0.82, day: 1, dusk: 0.9, night: 0.72 }[time];
}

function weatherFactor(kind: WildlifeKind, input: WildlifeInput) {
  const bird = kind === "seabird" || kind === "shorebird";
  if (bird && input.storming) return 0;
  let factor = input.storming ? (kind === "whale" || kind === "dolphin" ? 0.44 : 0.24) : 1;
  if (input.precipitation !== "none") factor *= bird ? 0.38 : 0.78;
  factor *= { clear: 1, scattered: 0.96, broken: 0.82, overcast: bird ? 0.64 : 0.88 }[input.clouds];
  if (bird) factor *= 1 - clamp((input.windSpeed - 18) / 32, 0, 0.78);
  else factor *= 1 - clamp((input.seaState - 4) / 7, 0, 0.42);
  factor *= 0.42 + clamp(input.visibility / 11, 0, 1) * 0.58;
  return factor;
}

function proximityFactor(kind: WildlifeKind, proximity: LandProximity, iceEdge: boolean) {
  if (kind === "shorebird") return proximity === "near-land" ? 1 : proximity === "coastal" ? 0.62 : 0;
  if (kind === "penguin" || kind === "seal") return iceEdge ? 1 : proximity === "near-land" ? 0.82 : 0.45;
  if (kind === "whale") return proximity === "offshore" ? 1 : 0.78;
  if (kind === "dolphin") return proximity === "offshore" ? 0.82 : 1;
  return proximity === "offshore" ? 0.82 : 1;
}

function behaviorFor(kind: WildlifeKind, random: () => number): WildlifeBehavior {
  if (kind === "seabird" || kind === "shorebird") return random() < 0.56 ? "gliding" : "circling";
  if (kind === "penguin") return random() < 0.72 ? "commuting" : "swimming";
  if (kind === "seal") return random() < 0.58 ? "commuting" : "swimming";
  if (kind === "whale") return "surfacing";
  // Sharks are always traveling through the water. Surface-view dorsal
  // glimpses are derived from the route and greeting response, not an idle
  // "surfacing" state that can leave the animal hovering near one wave.
  if (kind === "shark") return "swimming";
  // Dolphins also remain underway. Both modes use the same continuously
  // advancing route; porpoising only adds a bounded surface arc to it.
  if (kind === "dolphin") return random() < 0.68 ? "porpoising" : "swimming";
  return "swimming";
}

function memberScale(kind: WildlifeKind, random: () => number) {
  const [minimum, range] = {
    // These are scene-display scales, not biological measurements. They keep
    // fauna readable while preserving the strong size hierarchy from birds
    // and penguins through cetaceans to selected aircraft and vessels.
    penguin: [0.17, 0.06], seal: [0.22, 0.1], whale: [0.38, 0.16], dolphin: [0.14, 0.055], shark: [0.12, 0.06], seabird: [0.08, 0.05], shorebird: [0.07, 0.04],
  }[kind];
  return minimum + random() * range;
}

function createMembers(seed: number, kind: WildlifeKind, count: number): WildlifeMemberPlan[] {
  const random = seededRandom(stableSeed(seed, kind, "members"));
  const restRandom = seededRandom(stableSeed(seed, kind, "resting-waypoints"));
  const restCount = kind === "penguin" && count > 1
    ? Math.min(count - 1, Math.max(1, Math.floor(count * 0.28)))
    : 0;
  const restingIndices = new Set(Array.from({ length: count }, (_, index) => ({ index, order: restRandom() }))
    .sort((left, right) => left.order - right.order)
    .slice(0, restCount)
    .map(({ index }) => index));
  return Array.from({ length: count }, (_, index) => {
    const bird = kind === "seabird" || kind === "shorebird";
    const shark = kind === "shark";
    const dolphin = kind === "dolphin";
    const angle = random() * Math.PI * 2;
    const spread = bird ? 5 + random() * 12 : 5 + random() * 9;
    return {
      id: `${kind}-${index}`,
      x: Math.cos(angle) * spread + (random() - 0.5) * 3,
      y: bird ? 4.6 + random() * 7.8 : 0.08,
      z: Math.sin(angle) * spread + (random() - 0.5) * 3,
      depth: 1.2 + random() * (kind === "whale" || kind === "shark" ? 3.5 : 2.2),
      scale: memberScale(kind, random),
      heading: random() * Math.PI * 2,
      phase: random() * Math.PI * 2,
      // Sharks and dolphins cross a legible span of water instead of idling
      // beside one wave. Their circuits remain deterministic, closed, and
      // habitat-bounded, with dolphins just below the shark travel envelope.
      speed: shark ? 0.12 + random() * 0.06
        : dolphin ? 0.11 + random() * 0.05
          : (bird ? 0.09 : 0.035) + random() * (bird ? 0.1 : 0.075),
      radius: shark ? 2.2 + random() * 1.6
        : dolphin ? 1.8 + random() * 1.4
          : (bird ? 1.5 : 0.6) + random() * (bird ? 3.8 : 1.6),
      routeEccentricity: 0.34 + random() * 0.42,
      routeDirection: random() < 0.5 ? -1 : 1,
      restingPose: restingIndices.has(index),
    };
  });
}

export function createWildlifePlan(input: WildlifeInput): WildlifePlan {
  const ecology = REGION_ECOLOGY[input.regionId] ?? fallbackEcology(input.climate);
  const random = seededRandom(stableSeed(input.seed, input.regionId, "wildlife-plan"));
  const groups: WildlifeGroupPlan[] = [];
  let remaining = WILDLIFE_LIMITS.maxIndividuals;

  ecology.candidates.slice(0, WILDLIFE_LIMITS.maxGroups).forEach(([kind, maximum]) => {
    if (remaining <= 0) return;
    // Penguins are southern-hemisphere animals in this deliberately broad
    // ecological vocabulary; no fallback may introduce them to Arctic water.
    if (kind === "penguin" && input.climate !== "antarctic") return;
    const suitability = seasonalFactor(kind, input.climate, input.season)
      * timeFactor(kind, input.time)
      * weatherFactor(kind, input)
      * proximityFactor(kind, ecology.proximityToLand, ecology.iceEdge);
    const categoryCap = kind === "penguin" ? WILDLIFE_LIMITS.maxPenguins
      : kind === "seal" ? WILDLIFE_LIMITS.maxSeals
        : kind === "seabird" || kind === "shorebird" ? WILDLIFE_LIMITS.maxBirds
          : WILDLIFE_LIMITS.maxLargeAnimals;
    const expected = Math.min(maximum, categoryCap) * clamp(suitability, 0, 1);
    const count = Math.min(remaining, expected < 0.7 ? 0 : Math.floor(expected + random()));
    if (!count) return;
    const sampledBehavior = behaviorFor(kind, random);
    const behavior = kind === "seal" && sampledBehavior === "resting" && !ecology.iceEdge ? "surfacing" : sampledBehavior;
    groups.push({
      id: `${kind}-${groups.length}`,
      kind,
      label: LABELS[kind],
      behavior,
      count,
      members: createMembers(input.seed, kind, count),
    });
    remaining -= count;
  });

  const individualCount = groups.reduce((sum, group) => sum + group.count, 0);
  const categories = groups.map((group) => `${group.count} ${group.label}`).join(", ");
  const context = `${ecology.proximityToLand.replace("-", " ")}${ecology.iceEdge ? " at an ice edge" : ""}`;
  const description = individualCount
    ? `${individualCount} environmental wildlife forms are visible: ${categories}. This deterministic presentation fits the accepted region, ${input.season} season, ${input.time}, weather, sea state, visibility, and ${context}. Wildlife is non-tactical scenery: it never represents a contact, identity clue, sensing capability, decision, score, or operational claim.`
    : `No recognizable wildlife is visible in this view because the accepted region, ${input.season} season, ${input.time}, weather, sea state, visibility, and ${context} do not support a credible sighting. Wildlife never represents a contact, sensing capability, decision, score, or operational claim.`;
  return { seed: input.seed, regionId: input.regionId, proximityToLand: ecology.proximityToLand, iceEdge: ecology.iceEdge, groups, individualCount, description };
}

function mediumFor(kind: WildlifeKind, behavior: WildlifeBehavior, viewLayer: ViewLayer, iceEdge: boolean): WildlifeMedium | null {
  if (viewLayer === "stars") return null;
  if (kind === "seabird" || kind === "shorebird") return viewLayer === "subsurface" ? null : "air";
  if (viewLayer === "subsurface") return behavior === "resting" && (kind === "penguin" || kind === "seal") ? null : "subsurface";
  // Penguins and seals may use ice, but marine animals never do. This keeps
  // sharks and dolphins from being rendered beached or parked on floes.
  if (kind === "penguin" || kind === "seal") return (behavior === "resting" || behavior === "commuting") && iceEdge ? "ice" : "surface";
  // Sharks seen from above remain below the waterline. A bounded surfacing
  // cycle may reveal the dorsal silhouette, but the avatar engine never
  // places the body on ice or hovering above the sea.
  if (kind === "shark" || kind === "dolphin" || kind === "whale") return "surface";
  return "surface";
}

export function wildlifeForView(plan: WildlifePlan, viewLayer: ViewLayer): VisibleWildlife[] {
  return plan.groups.flatMap((group) => {
    return group.members.flatMap((member) => {
      const memberBehavior = member.restingPose ? "resting" : group.behavior;
      const medium = mediumFor(group.kind, memberBehavior, viewLayer, plan.iceEdge);
      if (!medium) return [];
      return [{
        ...member,
        groupId: group.id,
        kind: group.kind,
        label: group.label,
        medium,
        behavior: medium === "subsurface" ? "swimming" : memberBehavior,
      }];
    });
  });
}

export function describeWildlifeForView(plan: WildlifePlan, viewLayer: ViewLayer) {
  const visible = wildlifeForView(plan, viewLayer);
  const counts = new Map<WildlifeKind, number>();
  visible.forEach((animal) => counts.set(animal.kind, (counts.get(animal.kind) ?? 0) + 1));
  const categories = [...counts.entries()].map(([kind, count]) => `${count} ${LABELS[kind]}`).join(", ");
  const context = `${plan.proximityToLand.replace("-", " ")}${plan.iceEdge ? " at an ice edge" : ""}`;
  if (!visible.length) {
    return `No recognizable wildlife is visible in the ${viewLayer} view. The scenario's validated ecological context remains ${context}. Wildlife never represents a contact, sensing capability, decision, score, or operational claim.`;
  }
  return `${visible.length} environmental wildlife forms are visible in the ${viewLayer} view: ${categories}. The sighting fits the accepted region and ${context}. Wildlife is non-tactical scenery: it never represents a contact, identity clue, sensing capability, decision, score, or operational claim.`;
}

export function wildlifeReactionMessage(animal: Pick<VisibleWildlife, "kind" | "medium"> & Partial<Pick<VisibleWildlife, "restingPose">>) {
  if (animal.kind === "penguin") {
    if (animal.restingPose && animal.medium === "ice") {
      return "The resting penguin braces with its flippers, pushes itself upright, confusedly scratches its head with one flipper, then settles happily back down at its waypoint."
    }
    return animal.medium === "subsurface"
      ? "The penguin darts through the water, loops back, and seems delighted by the attention."
      : "The penguin gives a bright little hop and flutters its flippers on the ice."
  }
  if (animal.kind === "seal") {
    if (animal.medium === "ice") return "The seal lifts a flipper, wiggles happily, and settles back onto the ice."
    if (animal.medium === "subsurface") return "The seal rolls through the water and loops back with an easy flick of its flippers."
    return "The seal bobs above the waves and answers with a cheerful little splash."
  }
  if (animal.kind === "whale") {
    return animal.medium === "subsurface"
      ? "The whale rolls gently through the water, its tail sweeping a broad, calm arc."
      : "The whale rises into a slow, joyful roll and leaves a low faceted splash among the waves."
  }
  if (animal.kind === "dolphin") {
    return animal.medium === "subsurface"
      ? "The dolphin darts ahead, turns neatly, and loops back through a trail of bubbles."
      : "The dolphin arcs playfully over the next wave and slips back into the water."
  }
  if (animal.kind === "shark") {
    return animal.medium === "subsurface"
      ? "The shark sweeps into a smooth turn, flicks its tail, and cruises back through the blue."
      : "The shark lifts its dorsal fin through the next wave, gives a lively tail flick, and slips safely below the surface again."
  }
  if (animal.kind === "shorebird") return "The coastal bird gives an eager wing flutter and hops into a small sea breeze."
  return "The seabird banks toward the breeze, flutters brightly, and settles back into its glide."
}
