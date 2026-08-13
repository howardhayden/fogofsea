import type { Aircraft, Armament, Platform, Scenario } from "./gameModel";
import { largestInventedDistance } from "./catalogMath";

export type ForceAdaptation = {
  score: number;
  profile: "mine-lane" | "heavy-weather" | "restricted-water" | "open-water";
  label: string;
  evidence: string;
  gaps: string[];
};

const BLUE_WATER = new Set([
  "fleet-aviation-ship",
  "short-deck-aviation-ship",
  "area-defense-destroyer",
  "multirole-frigate",
  "long-endurance-submarine",
]);
const LITTORAL = new Set([
  "expeditionary-aviation-dock",
  "stealth-littoral-corvette",
  "autonomous-mine-support-ship",
  "air-independent-submarine",
  "undersea-systems-tender",
]);
const MINE_SPECIALISTS = new Set(["autonomous-mine-support-ship", "undersea-systems-tender"]);
const UNDERSEA_SPECIALISTS = new Set(["air-independent-submarine", "long-endurance-submarine", "undersea-systems-tender"]);
const RESTRICTED_REGIONS = new Set(["equatorial-convergence", "temperate-strait"]);

function countIds(ids: Set<string>, counts: Record<string, number>) {
  return [...ids].reduce((sum, id) => sum + (counts[id] || 0), 0);
}

export function evaluateForceAdaptation(
  scenario: Scenario,
  platforms: Platform[],
  aircraft: Aircraft[],
  armaments: Armament[],
  creditedPlatforms: Record<string, number>,
  creditedAircraft: Record<string, number>,
  creditedArmaments: Record<string, number>,
): ForceAdaptation {
  const surfaceCount = platforms.reduce((sum, item) => sum + (creditedPlatforms[item.id] || 0), 0);
  const aircraftCount = aircraft.reduce((sum, item) => sum + (creditedAircraft[item.id] || 0), 0);
  const blueWater = countIds(BLUE_WATER, creditedPlatforms);
  const littoral = countIds(LITTORAL, creditedPlatforms);
  const mineSpecialists = countIds(MINE_SPECIALISTS, creditedPlatforms)
    + (creditedAircraft["mine-countermeasure-rotorcraft"] || 0)
    + armaments.filter((item) => item.warfare.includes("mine-countermeasures"))
      .reduce((sum, item) => sum + (creditedArmaments[item.id] || 0), 0);
  const underseaSpecialists = countIds(UNDERSEA_SPECIALISTS, creditedPlatforms)
    + (creditedAircraft["maritime-patrol-aircraft"] || 0)
    + (creditedAircraft["maritime-mission-helicopter"] || 0);
  const safeguardingAssets = armaments.filter((item) => item.warfare.includes("maritime-interdiction"))
    .reduce((sum, item) => sum + (creditedArmaments[item.id] || 0), 0)
    + (creditedAircraft["shipborne-rescue-rotorcraft"] || 0)
    + (creditedAircraft["maritime-mission-helicopter"] || 0);
  const longRangeAircraft = aircraft.filter((item) => largestInventedDistance(item.missionReach) >= 450)
    .reduce((sum, item) => sum + (creditedAircraft[item.id] || 0), 0);
  const longRangeEffects = armaments.filter((item) => largestInventedDistance(item.reach) >= 450)
    .reduce((sum, item) => sum + (creditedArmaments[item.id] || 0), 0);
  const distinctPlatforms = platforms.filter((item) => (creditedPlatforms[item.id] || 0) > 0).length;
  const largestPlatformGroup = Math.max(0, ...platforms.map((item) => creditedPlatforms[item.id] || 0));
  const dominantShare = surfaceCount ? largestPlatformGroup / surfaceCount : 1;
  const trackingMethods = new Set<string>();
  for (const item of aircraft) if ((creditedAircraft[item.id] || 0) > 0) item.trackingMethods.forEach((method) => trackingMethods.add(method));
  for (const item of armaments) if ((creditedArmaments[item.id] || 0) > 0) item.trackingMethods.forEach((method) => trackingMethods.add(method));

  const profile: ForceAdaptation["profile"] = scenario.required.includes("mine-countermeasures")
    ? "mine-lane"
    : scenario.climate !== "ocean" || scenario.seaState >= 5
      ? "heavy-weather"
      : RESTRICTED_REGIONS.has(scenario.regionId)
        ? "restricted-water"
        : "open-water";
  const labels = {
    "mine-lane": "Specialist lane-opening force",
    "heavy-weather": "Heavy-weather endurance force",
    "restricted-water": "Restricted-water distributed force",
    "open-water": "Open-water reach force",
  } as const;

  let earned = 0;
  let possible = 0;
  const gaps: string[] = [];
  const criterion = (weight: number, ratio: number, gap: string) => {
    possible += weight;
    earned += weight * Math.max(0, Math.min(1, ratio));
    if (ratio < 1) gaps.push(gap);
  };

  if (profile === "mine-lane") {
    criterion(45, mineSpecialists / 3, `Add ${Math.max(0, 3 - mineSpecialists)} credited mine-search, marking, or neutralization specialist${mineSpecialists === 2 ? "" : "s"}.`);
    criterion(20, surfaceCount ? littoral / Math.max(1, surfaceCount * 0.45) : 0, "Shift more of the force toward shallow-water and remote-systems hosts.");
  } else if (profile === "heavy-weather") {
    criterion(45, surfaceCount ? blueWater / Math.max(1, surfaceCount * 0.65) : 0, "Replace part of the small-craft concentration with ocean-endurance platforms.");
    criterion(20, blueWater / 3, `Add ${Math.max(0, 3 - blueWater)} credited ocean-endurance platform${blueWater === 2 ? "" : "s"}.`);
  } else if (profile === "restricted-water") {
    criterion(45, surfaceCount ? littoral / Math.max(1, surfaceCount * 0.55) : 0, "Add shallow-water, reduced-signature, or remote-systems platforms suited to compressed navigation.");
    criterion(20, Math.min(1, (littoral + Math.min(aircraftCount, 4)) / 5), "Distribute sensing through at least five littoral or airborne elements.");
  } else {
    criterion(45, surfaceCount ? blueWater / Math.max(1, surfaceCount * 0.5) : 0, "Increase the share of ocean-endurance platforms.");
    criterion(20, (longRangeAircraft + longRangeEffects) / 2, "Add at least two credited long-range aircraft or effect pairings.");
  }

  if (scenario.required.includes("undersea-operations")) {
    criterion(15, underseaSpecialists / 2, "Add dedicated undersea-search platforms or aircraft rather than relying only on general escorts.");
  }
  if (scenario.required.includes("land-attack")) {
    criterion(15, (longRangeAircraft + longRangeEffects) / 2, "Add two credited long-range aircraft or land-effect pairings.");
  }
  if (scenario.required.includes("maritime-interdiction")) {
    criterion(20, safeguardingAssets / 2, "Add two credited safeguarding, rescue, documentation, or protected-handoff assets.");
    criterion(10, littoral / 2, "Add two credited littoral or support platforms suited to shallow, congested coastal water.");
  }
  criterion(10, trackingMethods.size / 4, "Use at least four distinct tracking methods to reduce dependence on one sensing path.");
  criterion(10, distinctPlatforms >= 2 && dominantShare <= 0.6 ? 1 : Math.min(distinctPlatforms / 2, 0.65), "Avoid concentrating more than sixty percent of selected platforms in one type.");

  const score = Math.round((earned / possible) * 100);
  return {
    score,
    profile,
    label: labels[profile],
    evidence: `${blueWater} ocean-endurance · ${littoral} littoral/support · ${mineSpecialists} mine specialists · ${underseaSpecialists} undersea specialists · ${safeguardingAssets} safeguarding assets · ${longRangeAircraft + longRangeEffects} long-range pairings · ${trackingMethods.size} tracking methods`,
    gaps,
  };
}
