import { createScenarioMatrix, isScenarioMatrix, type IllicitNetworkType, type ScenarioMatrix } from "./scenarioMatrix";
import { cloudCoverPhrase } from "./weatherPresentation";

export type Warfare = "air-defense" | "surface-operations" | "undersea-operations" | "land-attack" | "electromagnetic-operations" | "reconnaissance" | "mine-countermeasures" | "missile-defense" | "maritime-interdiction";
export type TimeOfDay = "dawn" | "day" | "dusk" | "night";
export type Climate = "ocean" | "arctic" | "antarctic";
export type Clouds = "clear" | "scattered" | "broken" | "overcast";
export type Precipitation = "none" | "rain" | "snow";
export type Season = "winter" | "spring" | "summer" | "autumn" | "wet" | "dry";
export type Hemisphere = "north" | "south";
export type SoundProfile = "island-arc" | "equatorial-current" | "temperate-strait" | "boreal-ice" | "polar-archipelago" | "southern-ice" | "austral-corridor";
export type Difficulty = "guided" | "standard" | "challenge";
export type EndState = "access" | "protection" | "denial" | "limited-compellence" | "status-quo";
export type TheoryLens = "sun-tzu" | "clausewitz" | "mahan" | "aube" | "corbett" | "richmond" | "wegener" | "castex" | "panikkar" | "gorshkov" | "liu-huaqing" | "till" | "galula";
export type Guardrail = "escalation" | "civilian" | "coalition" | "legitimacy" | "sustainability";
export type AviationKind = "catapult" | "short-deck" | "rotary" | "uncrewed-fixed-wing" | "uncrewed-vertical";
export type VisualSignature = "standard" | "low";
export type TrackingMethod =
  | "active radar"
  | "passive emitter"
  | "cooperative network"
  | "electro-optical"
  | "infrared"
  | "active acoustic"
  | "passive acoustic"
  | "magnetic anomaly"
  | "bathymetric comparison"
  | "distress beacon"
  | "fixed-coordinate reference"
  | "scene correlation";

export function evaluateWarfareIdentification(required: Warfare[], recommended: Warfare[], selected: Warfare[]) {
  return {
    missed: required.filter((area) => !selected.includes(area)),
    unsupported: selected.filter((area) => !required.includes(area) && !recommended.includes(area)),
  };
}

export type Scenario = {
  id: number;
  operation: string;
  region: string;
  climate: Climate;
  time: TimeOfDay;
  clouds: Clouds;
  precipitation: Precipitation;
  seaState: number;
  visibility: number;
  regionId: string;
  hemisphere: Hemisphere;
  observerLatitude: number;
  observerLongitude: number;
  scenarioDate: string;
  season: Season;
  storming: boolean;
  lightningCapable: boolean;
  windHeading: number;
  windSpeed: number;
  currentHeading: number;
  currentSpeed: number;
  waveHeading: number;
  soundProfile: SoundProfile;
  budget: 100;
  brief: string;
  geography: string;
  friendlySituation: string;
  opposingSituation: string;
  /** Missing in earlier saves and interpreted as one opposing actor. */
  adversaryCount?: number;
  /** Missing in earlier saves and derived from the scenario identity when needed. */
  matrix?: ScenarioMatrix;
  /** Present only when the generated problem concerns an illicit maritime network. */
  illicitNetworkType?: IllicitNetworkType;
  civilianContext: string;
  constraints: string;
  timing: string;
  successConditions: string;
  navalProblem: string;
  objective: string;
  intelligence: string;
  history: string;
  required: Warfare[];
  recommended: Warfare[];
  minimumEscort: number;
  minimumAirDefense: number;
  minimumAsw: number;
  minimumUncrewed: number;
  politicalAim: string;
  endState: EndState;
  lenses: TheoryLens[];
  guardrail: Guardrail;
};

export type ScenarioCoexistenceFacet =
  | "identity"
  | "region-climate"
  | "season-date"
  | "weather-cloud-precipitation"
  | "sea-wind-current-visibility"
  | "aurora-celestial"
  | "mission-geography-objective"
  | "forces"
  | "difficulty-matrix"
  | "narrative";

export type ScenarioCoexistenceIssue = {
  facet: ScenarioCoexistenceFacet;
  code: string;
  message: string;
};

export type ScenarioCoexistenceValidation = {
  valid: boolean;
  issues: ScenarioCoexistenceIssue[];
  checkedFacets: readonly ScenarioCoexistenceFacet[];
  derived: {
    missionFamily: string | null;
    threatFamily: string | null;
    /** Environmental eligibility only. Seeded space weather still decides whether an aurora occurs. */
    auroraEnvironmentEligible: boolean;
  };
};

export type Platform = {
  id: string;
  name: string;
  short: string;
  role: string;
  points: number;
  crew: number;
  aviationCapacity: number;
  aviationKinds: AviationKind[];
  armamentSlots: number;
  armamentIds: string[];
  capabilities: string[];
  screenUnit: boolean;
  airDefenseValue: number;
  aswValue: number;
  warfare: Warfare[];
  note: string;
  visualSignature?: VisualSignature;
};

export type Aircraft = {
  id: string;
  name: string;
  short: string;
  role: string;
  points: number;
  aircrew: number;
  supportCrew: number;
  kind: AviationKind;
  armamentSlots: number;
  armamentIds: string[];
  capabilities: string[];
  warfare: Warfare[];
  missionReach: string;
  trackCapacity: number;
  trackingMethods: TrackingMethod[];
  visualSignature?: VisualSignature;
};

export type Armament = {
  id: string;
  name: string;
  short: string;
  role: string;
  points: number;
  hostIds: string[];
  warfare: Warfare[];
  reach: string;
  trackCapacity: number;
  trackingMethods: TrackingMethod[];
};

export const ARMAMENTS: Armament[] = [
  {
    id: "area-air-interceptor-pack",
    name: "Area air-defence interceptor pack",
    short: "AREA AIR INTERCEPTORS",
    role: "Extends the defended air volume and protects a task group against coordinated air attack.",
    points: 1.2,
    hostIds: ["area-defense-destroyer", "multirole-frigate"],
    warfare: ["air-defense"],
    reach: "extended air-defence band · 45–110 invented nautical miles",
    trackCapacity: 12,
    trackingMethods: ["active radar", "cooperative network", "infrared"],
  },
  {
    id: "airborne-emitter-homing-pack",
    name: "Airborne emitter-homing mission pack",
    short: "EMITTER-HOMING MISSION",
    role: "Uses a confirmed emitter track to support bounded stand-off effects or suppression from a compatible strike aircraft.",
    points: 0.65,
    hostIds: ["deck-long-range-strike-aircraft", "short-deck-strike-aircraft", "electromagnetic-support-aircraft", "long-endurance-uncrewed-strike", "low-signature-uncrewed-scout"],
    warfare: ["electromagnetic-operations", "land-attack", "surface-operations"],
    reach: "extended stand-off band · 70–260 invented nautical miles",
    trackCapacity: 6,
    trackingMethods: ["passive emitter", "cooperative network", "scene correlation"],
  },
  {
    id: "airborne-extended-interceptor-pack",
    name: "Airborne extended-interceptor mission pack",
    short: "EXTENDED INTERCEPTOR",
    role: "Configures a dedicated or multirole aircraft for distant interception and an outer missile-defence contribution.",
    points: 0.6,
    hostIds: ["deck-interceptor-aircraft", "deck-multirole-aircraft", "short-takeoff-aircraft"],
    warfare: ["air-defense", "missile-defense"],
    reach: "outer air band · 65–170 invented nautical miles",
    trackCapacity: 8,
    trackingMethods: ["active radar", "infrared", "cooperative network"],
  },
  {
    id: "missile-defense-interceptor-pack",
    name: "Long-range missile-defence interceptor pack",
    short: "MISSILE DEFENCE",
    role: "Adds an upper defensive layer against long-range guided threats; it requires a large area-defence combatant.",
    points: 1.5,
    hostIds: ["area-defense-destroyer"],
    warfare: ["missile-defense", "air-defense"],
    reach: "upper defensive band · 70–160 invented nautical miles",
    trackCapacity: 10,
    trackingMethods: ["active radar", "cooperative network", "infrared"],
  },
  {
    id: "airborne-mine-sensing-pack",
    name: "Airborne mine-sensing and marking pack",
    short: "AIRBORNE MINE SENSING",
    role: "Maps, marks, and rechecks a bounded suspected mine lane from compatible rotary or vertical-flight systems.",
    points: 0.45,
    hostIds: ["mine-countermeasure-rotorcraft", "uncrewed-surveillance-rotorcraft"],
    warfare: ["mine-countermeasures", "reconnaissance"],
    reach: "local lane band · 0–70 invented nautical miles from host",
    trackCapacity: 16,
    trackingMethods: ["magnetic anomaly", "bathymetric comparison", "electro-optical"],
  },
  {
    id: "surface-guided-effect-pack",
    name: "Surface-launched anti-ship guided-effect pack",
    short: "SURFACE ANTI-SHIP",
    role: "Provides stand-off effects against confirmed surface combatants from an escort or littoral combatant.",
    points: 1,
    hostIds: ["area-defense-destroyer", "multirole-frigate", "stealth-littoral-corvette"],
    warfare: ["surface-operations"],
    reach: "over-horizon band · 55–140 invented nautical miles",
    trackCapacity: 5,
    trackingMethods: ["cooperative network", "active radar", "passive emitter"],
  },
  {
    id: "surface-land-effect-pack",
    name: "Surface-launched land-effect pack",
    short: "SURFACE LAND EFFECT",
    role: "Provides bounded conventional effects against a confirmed objective ashore from a large escort.",
    points: 1.25,
    hostIds: ["area-defense-destroyer", "multirole-frigate"],
    warfare: ["land-attack"],
    reach: "deep stand-off band · 160–420 invented nautical miles",
    trackCapacity: 4,
    trackingMethods: ["fixed-coordinate reference", "scene correlation", "cooperative network"],
  },
  {
    id: "airborne-relay-pack",
    name: "Airborne cooperative-relay pack",
    short: "COOPERATIVE RELAY",
    role: "Extends track custody and command exchange between dispersed sensors without adding an offensive effect.",
    points: 0.35,
    hostIds: ["command-relay-aircraft", "fixed-wing-surveillance-aircraft", "rotary-surveillance-aircraft", "low-signature-uncrewed-scout"],
    warfare: ["reconnaissance", "electromagnetic-operations"],
    reach: "wide relay band · 120–450 invented nautical miles",
    trackCapacity: 48,
    trackingMethods: ["cooperative network", "passive emitter"],
  },
  {
    id: "shipborne-asw-pack",
    name: "Shipborne anti-submarine effect pack",
    short: "SHIPBORNE ASW",
    role: "Pairs acoustic localization with lightweight underwater effects from an escort or undersea support ship.",
    points: 0.9,
    hostIds: ["area-defense-destroyer", "multirole-frigate", "stealth-littoral-corvette", "undersea-systems-tender"],
    warfare: ["undersea-operations"],
    reach: "local undersea band · 4–22 invented nautical miles",
    trackCapacity: 8,
    trackingMethods: ["active acoustic", "passive acoustic", "cooperative network"],
  },
  {
    id: "submarine-acoustic-deception-pack",
    name: "Acoustic deception and evasion pack",
    short: "ACOUSTIC DECEPTION",
    role: "Provides bounded undersea self-protection and false acoustic cues from a compatible patrol submarine.",
    points: 0.55,
    hostIds: ["air-independent-submarine", "long-endurance-submarine"],
    warfare: ["undersea-operations", "electromagnetic-operations"],
    reach: "self-protection band · 0–42 invented nautical miles",
    trackCapacity: 6,
    trackingMethods: ["active acoustic", "passive acoustic"],
  },
  {
    id: "mine-neutralization-pack",
    name: "Remote mine-neutralization pack",
    short: "MINE NEUTRALIZATION",
    role: "Searches, marks, and neutralizes a bounded mine lane through remote surface, airborne, or underwater systems.",
    points: 0.8,
    hostIds: ["autonomous-mine-support-ship", "undersea-systems-tender", "stealth-littoral-corvette"],
    warfare: ["mine-countermeasures", "reconnaissance"],
    reach: "close lane band · 0–8 invented nautical miles",
    trackCapacity: 14,
    trackingMethods: ["bathymetric comparison", "magnetic anomaly", "electro-optical"],
  },
  {
    id: "vessel-close-defense-effect-pack",
    name: "Close-defence guided-effect pack",
    short: "CLOSE DEFENCE",
    role: "Adds a final local defensive layer against aircraft and guided threats around a compatible surface host.",
    points: 0.75,
    hostIds: ["fleet-aviation-ship", "short-deck-aviation-ship", "expeditionary-aviation-dock", "uncrewed-aviation-ship", "area-defense-destroyer", "multirole-frigate", "stealth-littoral-corvette"],
    warfare: ["air-defense", "missile-defense"],
    reach: "close defensive band · 1–18 invented nautical miles",
    trackCapacity: 10,
    trackingMethods: ["active radar", "electro-optical", "infrared"],
  },
  {
    id: "submarine-heavy-effect-pack",
    name: "Submarine heavyweight effect pack",
    short: "SUBMARINE HEAVY EFFECT",
    role: "Supports covert engagement of confirmed surface or undersea contacts from a patrol submarine.",
    points: 1.1,
    hostIds: ["air-independent-submarine", "long-endurance-submarine"],
    warfare: ["surface-operations", "undersea-operations"],
    reach: "subsurface stand-off band · 12–48 invented nautical miles",
    trackCapacity: 3,
    trackingMethods: ["passive acoustic", "active acoustic", "cooperative network"],
  },
  {
    id: "submarine-guided-surface-effect-pack",
    name: "Underwater-launched guided surface-effect pack",
    short: "UNDERWATER GUIDED EFFECT",
    role: "Provides a covert stand-off option against a positively identified surface contact from a compatible submarine.",
    points: 1.2,
    hostIds: ["air-independent-submarine", "long-endurance-submarine"],
    warfare: ["surface-operations"],
    reach: "extended maritime band · 80–230 invented nautical miles",
    trackCapacity: 4,
    trackingMethods: ["passive emitter", "cooperative network", "active radar"],
  },
  {
    id: "submarine-land-effect-pack",
    name: "Submarine-launched land-effect pack",
    short: "SUBMARINE LAND EFFECT",
    role: "Provides a limited long-range conventional effect against a confirmed objective ashore.",
    points: 1.3,
    hostIds: ["long-endurance-submarine"],
    warfare: ["land-attack"],
    reach: "deep stand-off band · 220–520 invented nautical miles",
    trackCapacity: 4,
    trackingMethods: ["fixed-coordinate reference", "scene correlation", "cooperative network"],
  },
  {
    id: "submarine-offboard-scout-pack",
    name: "Undersea offboard scout pack",
    short: "OFFBOARD UNDERSEA SCOUT",
    role: "Deploys a recoverable remote scout to extend covert sensing and contact classification around a submarine.",
    points: 0.7,
    hostIds: ["air-independent-submarine", "long-endurance-submarine", "undersea-systems-tender"],
    warfare: ["undersea-operations", "surface-operations", "reconnaissance"],
    reach: "local scouting band · 0–160 invented nautical miles",
    trackCapacity: 10,
    trackingMethods: ["passive acoustic", "electro-optical", "cooperative network"],
  },
  {
    id: "air-to-air-mission-pack",
    name: "Air-to-air mission pack",
    short: "AIR-TO-AIR MISSION",
    role: "Configures a supported combat aircraft for local interception and task-group air defence.",
    points: 0.45,
    hostIds: ["deck-multirole-aircraft", "deck-interceptor-aircraft", "short-takeoff-aircraft", "uncrewed-combat-aircraft"],
    warfare: ["air-defense"],
    reach: "medium air band · 25–75 invented nautical miles",
    trackCapacity: 6,
    trackingMethods: ["active radar", "infrared", "cooperative network"],
  },
  {
    id: "airborne-anti-surface-pack",
    name: "Airborne anti-surface mission pack",
    short: "AIR ANTI-SURFACE",
    role: "Configures a supported aircraft for stand-off or compact effects against identified surface contacts.",
    points: 0.55,
    hostIds: ["deck-multirole-aircraft", "deck-long-range-strike-aircraft", "short-takeoff-aircraft", "short-deck-strike-aircraft", "maritime-mission-helicopter", "maritime-patrol-aircraft", "uncrewed-combat-aircraft", "long-endurance-uncrewed-strike", "low-signature-uncrewed-scout"],
    warfare: ["surface-operations"],
    reach: "stand-off maritime band · 45–130 invented nautical miles",
    trackCapacity: 4,
    trackingMethods: ["active radar", "passive emitter", "cooperative network"],
  },
  {
    id: "airborne-land-effect-pack",
    name: "Airborne precision land-effect pack",
    short: "AIR LAND EFFECT",
    role: "Configures a supported combat aircraft for a bounded precision effect ashore.",
    points: 0.6,
    hostIds: ["deck-multirole-aircraft", "deck-long-range-strike-aircraft", "short-takeoff-aircraft", "short-deck-strike-aircraft", "uncrewed-combat-aircraft", "long-endurance-uncrewed-strike", "low-signature-uncrewed-scout"],
    warfare: ["land-attack"],
    reach: "stand-off land band · 35–115 invented nautical miles",
    trackCapacity: 4,
    trackingMethods: ["fixed-coordinate reference", "scene correlation", "cooperative network"],
  },
  {
    id: "airborne-electromagnetic-pack",
    name: "Airborne electromagnetic-effects pack",
    short: "AIR ELECTROMAGNETIC",
    role: "Adds emitter location, stand-off disruption, decoys, and protection to a supported specialist aircraft.",
    points: 0.55,
    hostIds: ["electromagnetic-support-aircraft", "command-relay-aircraft", "uncrewed-combat-aircraft", "low-signature-uncrewed-scout"],
    warfare: ["electromagnetic-operations", "reconnaissance"],
    reach: "support radius · 60–180 invented nautical miles",
    trackCapacity: 18,
    trackingMethods: ["passive emitter", "cooperative network"],
  },
  {
    id: "airborne-acoustic-pack",
    name: "Airborne acoustic search-and-effect pack",
    short: "AIRBORNE ACOUSTIC",
    role: "Adds acoustic search, localization, and a lightweight underwater effect to a supported maritime aircraft.",
    points: 0.5,
    hostIds: ["maritime-mission-helicopter", "maritime-patrol-aircraft", "uncrewed-surveillance-rotorcraft"],
    warfare: ["undersea-operations", "reconnaissance"],
    reach: "local prosecution band · 3–18 invented nautical miles",
    trackCapacity: 12,
    trackingMethods: ["active acoustic", "passive acoustic", "cooperative network"],
  },
  {
    id: "airborne-rescue-support-pack",
    name: "Airborne rescue-support mission pack",
    short: "RESCUE SUPPORT",
    role: "Adds beacon location, scene mapping, flotation, and recovery support to compatible rotorcraft.",
    points: 0.3,
    hostIds: ["shipborne-rescue-rotorcraft", "heavy-utility-rotorcraft", "maritime-mission-helicopter"],
    warfare: ["reconnaissance", "surface-operations"],
    reach: "recovery radius · 0–105 invented nautical miles",
    trackCapacity: 10,
    trackingMethods: ["distress beacon", "electro-optical", "infrared"],
  },
  {
    id: "airborne-decoy-pack",
    name: "Airborne decoy and self-protection pack",
    short: "AIR DECOY / PROTECTION",
    role: "Improves survivability and complicates hostile sensing without adding an offensive effect.",
    points: 0.3,
    hostIds: ["deck-multirole-aircraft", "deck-long-range-strike-aircraft", "deck-interceptor-aircraft", "short-takeoff-aircraft", "short-deck-strike-aircraft", "electromagnetic-support-aircraft", "fixed-wing-surveillance-aircraft", "maritime-patrol-aircraft", "rotary-surveillance-aircraft", "maritime-mission-helicopter", "heavy-utility-rotorcraft", "shipborne-rescue-rotorcraft", "command-relay-aircraft", "uncrewed-combat-aircraft", "long-endurance-uncrewed-strike", "low-signature-uncrewed-scout", "uncrewed-surveillance-rotorcraft", "uncrewed-logistics-aircraft"],
    warfare: ["electromagnetic-operations"],
    reach: "escort and self-protection band · 15–90 invented nautical miles",
    trackCapacity: 8,
    trackingMethods: ["passive emitter", "infrared", "cooperative network"],
  },
  {
    id: "vessel-electromagnetic-deception-pack",
    name: "Maritime electromagnetic-deception pack",
    short: "MARITIME DECEPTION",
    role: "Creates false cues and protects a surface group without adding an independent offensive effect.",
    points: 0.7,
    hostIds: ["fleet-aviation-ship", "short-deck-aviation-ship", "area-defense-destroyer", "multirole-frigate", "stealth-littoral-corvette"],
    warfare: ["electromagnetic-operations", "air-defense", "missile-defense"],
    reach: "task-group support band · 0–85 invented nautical miles",
    trackCapacity: 18,
    trackingMethods: ["passive emitter", "cooperative network"],
  },
  {
    id: "vessel-long-baseline-acoustic-pack",
    name: "Long-baseline acoustic coordination pack",
    short: "LONG-BASELINE ACOUSTIC",
    role: "Fuses separated acoustic sensors to hold a wider undersea search barrier from compatible surface hosts.",
    points: 0.85,
    hostIds: ["area-defense-destroyer", "multirole-frigate", "undersea-systems-tender", "autonomous-mine-support-ship"],
    warfare: ["undersea-operations", "reconnaissance"],
    reach: "distributed search band · 25–110 invented nautical miles",
    trackCapacity: 12,
    trackingMethods: ["active acoustic", "passive acoustic", "cooperative network"],
  },
  {
    id: "vessel-passive-surface-tracking-pack",
    name: "Passive maritime tracking pack",
    short: "PASSIVE MARITIME TRACKING",
    role: "Maintains surface track custody through passive bearings, optical correlation, and cooperative reports.",
    points: 0.65,
    hostIds: ["area-defense-destroyer", "multirole-frigate", "stealth-littoral-corvette", "undersea-systems-tender"],
    warfare: ["surface-operations", "reconnaissance", "electromagnetic-operations"],
    reach: "wide surveillance band · 40–190 invented nautical miles",
    trackCapacity: 24,
    trackingMethods: ["passive emitter", "electro-optical", "cooperative network"],
  },
  {
    id: "maritime-safeguarding-pack",
    name: "Maritime inspection and safeguarding pack",
    short: "SAFEGUARDING SUPPORT",
    role: "Adds non-lethal scene documentation, evidence custody, rescue support, and coordinated handoff to a compatible vessel or rotorcraft.",
    points: 0.4,
    hostIds: ["expeditionary-aviation-dock", "multirole-frigate", "stealth-littoral-corvette", "autonomous-mine-support-ship", "maritime-mission-helicopter", "shipborne-rescue-rotorcraft"],
    warfare: ["maritime-interdiction", "surface-operations", "reconnaissance"],
    reach: "local safeguarding radius · 0–45 invented nautical miles",
    trackCapacity: 14,
    trackingMethods: ["electro-optical", "cooperative network", "distress beacon"],
  },
];

export function emptyCounts<T extends { id: string }>(catalog: T[]) {
  return Object.fromEntries(catalog.map((item) => [item.id, 0])) as Record<string, number>;
}

function uniqueWarfare(areas: Warfare[]) {
  return [...new Set(areas)];
}

export function aircraftAffiliations(aircraft: Aircraft, armaments: Armament[]) {
  return uniqueWarfare([
    ...aircraft.warfare,
    ...armaments.filter((armament) => armament.hostIds.includes(aircraft.id)).flatMap((armament) => armament.warfare),
  ]);
}

export function platformAffiliations(platform: Platform, aircraft: Aircraft[], armaments: Armament[]) {
  const compatibleAircraft = aircraft.filter((item) => platform.aviationKinds.includes(item.kind));
  return uniqueWarfare([
    ...platform.warfare,
    ...armaments.filter((armament) => armament.hostIds.includes(platform.id)).flatMap((armament) => armament.warfare),
    ...compatibleAircraft.flatMap((item) => aircraftAffiliations(item, armaments)),
  ]);
}

export function hasSelectedAffiliation(areas: Warfare[], selectedWarfare: Warfare[]) {
  const selected = new Set(selectedWarfare);
  return areas.some((area) => selected.has(area));
}

export function restrictCountsToWarfare<T extends { id: string }>(
  catalog: T[],
  counts: Record<string, number>,
  selectedWarfare: Warfare[],
  affiliations: (item: T) => Warfare[],
) {
  return Object.fromEntries(catalog.map((item) => [
    item.id,
    hasSelectedAffiliation(affiliations(item), selectedWarfare) ? Math.max(0, Math.floor(counts[item.id] || 0)) : 0,
  ])) as Record<string, number>;
}

export function evaluateAviationFit(platforms: Platform[], aircraft: Aircraft[], fleet: Record<string, number>, airWing: Record<string, number>) {
  const decks = platforms
    .filter((platform) => platform.aviationCapacity > 0 && (fleet[platform.id] || 0) > 0)
    .map((platform) => ({
      id: platform.id,
      kinds: platform.aviationKinds,
      remaining: platform.aviationCapacity * (fleet[platform.id] || 0),
    }));
  const supportedByAircraft: Record<string, number> = {};
  const deficitsByAircraft: Record<string, number> = {};
  const assignmentsByAircraft: Record<string, Record<string, number>> = {};
  const orderedAircraft = [...aircraft].sort((a, b) => (
    decks.filter((deck) => deck.kinds.includes(a.kind)).length - decks.filter((deck) => deck.kinds.includes(b.kind)).length
  ));

  for (const item of orderedAircraft) {
    let needed = airWing[item.id] || 0;
    const requested = needed;
    const candidates = decks
      .filter((deck) => deck.kinds.includes(item.kind))
      .sort((a, b) => a.kinds.length - b.kinds.length || b.remaining - a.remaining || a.id.localeCompare(b.id));
    const assignments: Record<string, number> = {};
    for (const deck of candidates) {
      const assigned = Math.min(needed, deck.remaining);
      deck.remaining -= assigned;
      needed -= assigned;
      if (assigned) assignments[deck.id] = (assignments[deck.id] || 0) + assigned;
      if (!needed) break;
    }
    supportedByAircraft[item.id] = requested - needed;
    deficitsByAircraft[item.id] = needed;
    assignmentsByAircraft[item.id] = assignments;
  }

  const totalAircraft = aircraft.reduce((sum, item) => sum + (airWing[item.id] || 0), 0);
  const supportedAircraft = Object.values(supportedByAircraft).reduce((sum, value) => sum + value, 0);
  const totalCapacity = platforms.reduce((sum, platform) => sum + platform.aviationCapacity * (fleet[platform.id] || 0), 0);
  return {
    supportedByAircraft,
    deficitsByAircraft,
    assignmentsByAircraft,
    deficit: totalAircraft - supportedAircraft,
    totalAircraft,
    supportedAircraft,
    totalCapacity,
  };
}

export function evaluateArmamentFit(
  platforms: Platform[],
  aircraft: Aircraft[],
  armaments: Armament[],
  fleet: Record<string, number>,
  supportedAircraft: Record<string, number>,
  selectedArmaments: Record<string, number>,
) {
  const hostSlots = new Map<string, number>();
  for (const platform of platforms) hostSlots.set(platform.id, (fleet[platform.id] || 0) * platform.armamentSlots);
  for (const item of aircraft) hostSlots.set(item.id, (supportedAircraft[item.id] || 0) * item.armamentSlots);

  const creditedByArmament: Record<string, number> = {};
  const deficitsByArmament: Record<string, number> = {};
  const assignmentsByArmament: Record<string, Record<string, number>> = {};
  const ordered = [...armaments].sort((a, b) => a.hostIds.length - b.hostIds.length);
  for (const armament of ordered) {
    let needed = selectedArmaments[armament.id] || 0;
    const requested = needed;
    const candidates = armament.hostIds
      .filter((id) => (hostSlots.get(id) || 0) > 0)
      .sort((a, b) => (hostSlots.get(b) || 0) - (hostSlots.get(a) || 0) || a.localeCompare(b));
    const assignments: Record<string, number> = {};
    for (const hostId of candidates) {
      const available = hostSlots.get(hostId) || 0;
      const assigned = Math.min(needed, available);
      hostSlots.set(hostId, available - assigned);
      needed -= assigned;
      if (assigned) assignments[hostId] = (assignments[hostId] || 0) + assigned;
      if (!needed) break;
    }
    creditedByArmament[armament.id] = requested - needed;
    deficitsByArmament[armament.id] = needed;
    assignmentsByArmament[armament.id] = assignments;
  }

  const totalSelected = armaments.reduce((sum, item) => sum + (selectedArmaments[item.id] || 0), 0);
  const totalCredited = Object.values(creditedByArmament).reduce((sum, value) => sum + value, 0);
  return {
    creditedByArmament,
    deficitsByArmament,
    assignmentsByArmament,
    deficit: totalSelected - totalCredited,
    totalSelected,
    totalCredited,
  };
}

export function calculateCreditedForcePoints(
  platforms: Platform[],
  aircraft: Aircraft[],
  armaments: Armament[],
  fleet: Record<string, number>,
  supportedAircraft: Record<string, number>,
  creditedArmaments: Record<string, number>,
) {
  const { platformPoints, airPoints, armamentPoints } = calculatePointBreakdown(
    platforms,
    aircraft,
    armaments,
    fleet,
    supportedAircraft,
    creditedArmaments,
  );
  return { platformPoints, airPoints, armamentPoints, total: platformPoints + airPoints + armamentPoints };
}

function weightedCatalogPoints<T extends { id: string; points: number }>(
  catalog: readonly T[],
  counts: Readonly<Record<string, number>>,
) {
  return catalog.reduce((sum, item) => sum + item.points * (counts[item.id] || 0), 0);
}

function calculatePointBreakdown(
  platforms: readonly Platform[],
  aircraft: readonly Aircraft[],
  armaments: readonly Armament[],
  fleet: Readonly<Record<string, number>>,
  airWing: Readonly<Record<string, number>>,
  selectedArmaments: Readonly<Record<string, number>>,
) {
  return {
    platformPoints: weightedCatalogPoints(platforms, fleet),
    airPoints: weightedCatalogPoints(aircraft, airWing),
    armamentPoints: weightedCatalogPoints(armaments, selectedArmaments),
  };
}

export function calculateMissionCreditedForcePoints(
  platforms: Platform[],
  aircraft: Aircraft[],
  armaments: Armament[],
  fleet: Record<string, number>,
  supportedAircraft: Record<string, number>,
  creditedArmaments: Record<string, number>,
  aircraftAssignments: Record<string, Record<string, number>>,
  armamentAssignments: Record<string, Record<string, number>>,
  selectedWarfare: Warfare[],
  objectiveSelected: boolean,
) {
  if (!objectiveSelected || selectedWarfare.length === 0) {
    return {
      platformPoints: 0,
      airPoints: 0,
      armamentPoints: 0,
      total: 0,
      ready: false,
      creditedPlatforms: emptyCounts(platforms),
      creditedAircraft: emptyCounts(aircraft),
      missionCreditedArmaments: emptyCounts(armaments),
    };
  }
  const selected = new Set(selectedWarfare);
  const isRelevant = (areas: Warfare[]) => areas.some((area) => selected.has(area));
  const missionCreditedArmaments = Object.fromEntries(armaments.map((item) => [
    item.id,
    isRelevant(item.warfare) ? creditedArmaments[item.id] || 0 : 0,
  ])) as Record<string, number>;

  const relevantArmamentAssignmentsForHost = (hostId: string) => armaments.reduce((sum, armament) => (
    sum + ((missionCreditedArmaments[armament.id] || 0) > 0 ? armamentAssignments[armament.id]?.[hostId] || 0 : 0)
  ), 0);
  const creditedAircraft = Object.fromEntries(aircraft.map((item) => {
    const supported = supportedAircraft[item.id] || 0;
    if (isRelevant(item.warfare)) return [item.id, supported];
    const assignedRelevantPacks = relevantArmamentAssignmentsForHost(item.id);
    const connectedAircraft = item.armamentSlots > 0 ? Math.ceil(assignedRelevantPacks / item.armamentSlots) : 0;
    return [item.id, Math.min(supported, connectedAircraft)];
  })) as Record<string, number>;
  const relevantAircraftByPlatform: Record<string, number> = {};
  for (const craft of aircraft) {
    let remaining = creditedAircraft[craft.id] || 0;
    const assignments = Object.entries(aircraftAssignments[craft.id] || {}).sort(([left], [right]) => left.localeCompare(right));
    for (const [platformId, assigned] of assignments) {
      const connected = Math.min(remaining, assigned);
      relevantAircraftByPlatform[platformId] = (relevantAircraftByPlatform[platformId] || 0) + connected;
      remaining -= connected;
      if (!remaining) break;
    }
  }
  const creditedPlatforms = Object.fromEntries(platforms.map((item) => {
    const selectedCount = fleet[item.id] || 0;
    if (isRelevant(item.warfare)) return [item.id, selectedCount];
    const aviationHostsNeeded = item.aviationCapacity > 0 ? Math.ceil((relevantAircraftByPlatform[item.id] || 0) / item.aviationCapacity) : 0;
    const loadoutHostsNeeded = item.armamentSlots > 0 ? Math.ceil(relevantArmamentAssignmentsForHost(item.id) / item.armamentSlots) : 0;
    return [item.id, Math.min(selectedCount, Math.max(aviationHostsNeeded, loadoutHostsNeeded))];
  })) as Record<string, number>;

  const { platformPoints, airPoints, armamentPoints } = calculatePointBreakdown(
    platforms,
    aircraft,
    armaments,
    creditedPlatforms,
    creditedAircraft,
    missionCreditedArmaments,
  );
  return {
    platformPoints,
    airPoints,
    armamentPoints,
    total: platformPoints + airPoints + armamentPoints,
    ready: true,
    creditedPlatforms,
    creditedAircraft,
    missionCreditedArmaments,
  };
}

export function calculateDecisionCompletion(input: {
  selectedWarfare: string[];
  selectedEndState: string;
  selectedLens: string;
  selectedPartnerLens: string;
  selectedGuardrail: string;
}) {
  const milestones = [
    [input.selectedWarfare.length > 0, 20],
    [Boolean(input.selectedEndState), 20],
    [Boolean(input.selectedLens), 20],
    [Boolean(input.selectedPartnerLens), 20],
    [Boolean(input.selectedGuardrail), 20],
  ] as const;
  return milestones.reduce((sum, [complete, weight]) => sum + (complete ? weight : 0), 0);
}

type Region = {
  id: string;
  climate: Climate;
  label: string;
  terrain: readonly string[];
  navigation: readonly string[];
  hemisphere: Hemisphere;
  latitude: number;
  longitude: number;
  prevailingWind: number;
  prevailingCurrent: number;
  currentSpeed: [number, number];
  soundProfile: SoundProfile;
  equatorial?: boolean;
};

type Threat = {
  key: string;
  required: Warfare[];
  recommended: Warfare[];
  briefPressure: readonly string[];
  opposing: readonly string[];
  intelligence: readonly string[];
};

type MissionContext = {
  distance: number;
  width: number;
  friendlyCount: number;
  startHours: number;
  durationHours: number;
  threatPressure: string;
};

type MissionText = (context: MissionContext) => string;

type Mission = {
  key: string;
  threatKeys: string[];
  required: Warfare[];
  recommended: Warfare[];
  endState: EndState;
  guardrail: Guardrail;
  lenses: TheoryLens[];
  minimumEscort: number;
  minimumAirDefense: number;
  minimumAsw: number;
  minimumUncrewed: number;
  politicalAims: readonly string[];
  histories: readonly string[];
  briefs: readonly MissionText[];
  friendlies: readonly MissionText[];
  objectives: readonly MissionText[];
  constraints: readonly MissionText[];
  successes: readonly MissionText[];
  navalProblems: readonly string[];
};

const REGIONS: Region[] = [
  {
    id: "pelagic-island-arc", climate: "ocean", label: "Pelagic Island Arc · fictional sector",
    terrain: [
      "A chain of steep volcanic islands divides three deep-water passages and casts broad radar shadows across the central route.",
      "An outer basin meets a broken arc of high islands, leaving narrow sensor windows between steep headlands and deep water.",
      "Volcanic ridges split the sector into an exposed windward approach, a sheltered inner passage, and a distant open-water flank.",
    ],
    navigation: [
      "The central passage carries most commercial traffic; the outer passages add distance but offer wider manoeuvre.",
      "A deep eastern route supports heavy traffic, while two western cuts shorten the transit at the cost of compressed reaction time.",
      "Three usable passages trade directness for room to manoeuvre, and none provides continuous line-of-sight sensing.",
    ],
    hemisphere: "north", latitude: 24, longitude: -151, prevailingWind: 248, prevailingCurrent: 286, currentSpeed: [0.5, 1.6], soundProfile: "island-arc",
  },
  {
    id: "western-tropical-passage", climate: "ocean", label: "Western Tropical Passage · fictional sector",
    terrain: [
      "A warm western-ocean passage crosses deep water between a low island chain and an exposed outer bank, leaving few sheltered recovery areas.",
      "A broad tropical basin narrows between scattered volcanic islands, with a steep shelf edge and rapidly moving convective weather.",
      "Low atolls and one high island divide an open approach into a leeward civil route and a longer windward operating lane.",
    ],
    navigation: [
      "Deep-draft traffic follows the leeward route, while smaller vessels disperse through reef passages that close quickly in tropical-cyclone seas.",
      "The central lane offers the best charting but the least shelter; two island passages shorten the route while compressing recovery space.",
      "Commercial traffic can divert around the outer bank, but rescue and repair craft must remain within reach of the island chain.",
    ],
    hemisphere: "north", latitude: 18, longitude: 139, prevailingWind: 78, prevailingCurrent: 302, currentSpeed: [0.7, 1.9], soundProfile: "island-arc",
  },
  {
    id: "equatorial-convergence", climate: "ocean", label: "Equatorial Convergence Gate · fictional sector",
    terrain: [
      "Two reef shelves frame a deep channel whose squalls and strong currents move contacts rapidly across sensor boundaries.",
      "A deep equatorial channel bends between reef plateaus, with rain cells repeatedly hiding the horizon and reopening it minutes later.",
      "Low islands and submerged banks divide a fast current into several converging lanes with abrupt acoustic and visual transitions.",
    ],
    navigation: [
      "Only the surveyed middle lane supports deep-draft shipping, while smaller craft can use numerous reef cuts.",
      "Large hulls must remain inside a dogleg channel; shallow-draft traffic can cross the reef line at several poorly observed gaps.",
      "The surveyed route is reliable but slow, while a narrower lee passage shortens the approach and concentrates traffic near reefs.",
    ],
    hemisphere: "south", latitude: -7, longitude: 83, prevailingWind: 274, prevailingCurrent: 256, currentSpeed: [1.2, 2.8], soundProfile: "equatorial-current", equatorial: true,
  },
  {
    id: "temperate-strait", climate: "ocean", label: "Temperate Strait Network · fictional sector",
    terrain: [
      "A narrow strait bends around wooded islands before opening into a broad commercial basin with dense coastal emissions.",
      "A hooked peninsula and several low islands divide the strait into a blind inner reach and a heavily observed outer roadstead.",
      "Cliff-lined narrows open onto a shallow basin where coastal clutter, ferry routes, and tidal seams complicate classification.",
    ],
    navigation: [
      "Ferries and merchant traffic converge at two traffic-separation junctions, compressing identification time.",
      "Inbound and outbound lanes cross near the sharpest bend, forcing large vessels to commit before the outer basin is fully observed.",
      "A main channel, a shallow service route, and an anchorage entrance meet inside a short decision corridor.",
    ],
    hemisphere: "north", latitude: 43, longitude: 18, prevailingWind: 214, prevailingCurrent: 72, currentSpeed: [0.7, 2.2], soundProfile: "temperate-strait",
  },
  {
    id: "boreal-ice-gate", climate: "arctic", label: "Boreal Ice Gate · fictional sector",
    terrain: [
      "A shelving ice margin and a steep island coast compress the route into shifting leads above acoustically complex shallow water.",
      "Fast ice along one coast faces a mobile ice edge across a shallow trough, producing temporary corridors and abrupt dead ends.",
      "A rocky cape overlooks a narrow lead where pressure ridges, bottom reverberation, and coastal shadow divide the operating picture.",
    ],
    navigation: [
      "Ice drift intermittently closes the northern lane; the southern coast creates radar shadow and short warning times.",
      "The wider lead is exposed to closing ice, while a coastal route remains open longer but passes through successive sensor shadows.",
      "Two charted leads exchange relative safety as the ice moves, so the route decision cannot be fixed before the transit begins.",
    ],
    hemisphere: "north", latitude: 67, longitude: 41, prevailingWind: 232, prevailingCurrent: 118, currentSpeed: [0.3, 1.1], soundProfile: "boreal-ice",
  },
  {
    id: "polar-archipelago", climate: "arctic", label: "Polar Archipelago Reach · fictional sector",
    terrain: [
      "Rocky islands, seasonal pack ice, and deep trenches create alternating barriers and concealed undersea approaches.",
      "A maze of high islands encloses deep basins linked by shallow sills, with pack ice masking several approaches.",
      "Long sounds and steep submarine valleys cross beneath a broken archipelago, producing separated surface and undersea routes.",
    ],
    navigation: [
      "Two ice-free channels remain usable, but neither provides continuous airborne or acoustic coverage.",
      "The direct channel has an unobserved bend; the longer route crosses open water before entering a confined final reach.",
      "Only one passage can support two-way traffic, while the alternate lead requires one formation to wait outside the archipelago.",
    ],
    hemisphere: "north", latitude: 69, longitude: -79, prevailingWind: 286, prevailingCurrent: 154, currentSpeed: [0.2, 0.9], soundProfile: "polar-archipelago",
  },
  {
    id: "southern-ice-margin", climate: "antarctic", label: "Southern Ice Margin · fictional sector",
    terrain: [
      "Mobile pack ice borders a deep ocean trench, and the nearest sheltered anchorage lies beyond a wide exposed recovery box.",
      "A deep trench runs parallel to a shifting ice edge, separating an exposed approach from a small lee-side recovery area.",
      "Scattered icebergs and a steep continental slope create strong depth transitions across an otherwise open southern approach.",
    ],
    navigation: [
      "Navigable leads can close within hours; magnetic and propagation effects complicate orientation and communications.",
      "The shortest lead crosses the ice drift, while the reliable route remains in rougher water along the outer margin.",
      "Recovery craft need a stable open-water box, but the available box moves as the pack rotates across the approach.",
    ],
    hemisphere: "south", latitude: -67, longitude: -34, prevailingWind: 92, prevailingCurrent: 64, currentSpeed: [0.5, 1.5], soundProfile: "southern-ice",
  },
  {
    id: "austral-research-corridor", climate: "antarctic", label: "Austral Research Corridor · fictional sector",
    terrain: [
      "A glacier-fed sound opens into rough water through a single deep channel bordered by drifting ice and uncharted shoals.",
      "An ice-covered bay drains through a deep central groove, with rocky shallows constraining every approach to the inner stations.",
      "A broad research sound narrows between a glacier tongue and a shoal field before reaching the open sea.",
    ],
    navigation: [
      "Research and supply vessels share the marked lead, leaving little room to overtake or reverse.",
      "The marked channel permits only one deep-draft movement at a time, and holding areas are exposed to ice drift.",
      "A narrow inbound lane crosses the route used by small survey craft, concentrating traffic near the least charted water.",
    ],
    hemisphere: "south", latitude: -65, longitude: 112, prevailingWind: 118, prevailingCurrent: 38, currentSpeed: [0.4, 1.2], soundProfile: "austral-corridor",
  },
];

const THREATS: Threat[] = [
  {
    key: "subsurface", required: ["undersea-operations", "reconnaissance"], recommended: ["electromagnetic-operations"],
    briefPressure: [
      "Uncertain undersea activity threatens the route without revealing whether delay or direct attack is intended.",
      "Intermittent acoustic cues force the formation to protect movement and preserve its ability to classify before acting.",
      "A concealed undersea screen may be shaping the route rather than seeking an immediate engagement.",
      "Sparse detections suggest a barrier of quiet platforms and decoys across the likely line of movement.",
    ],
    opposing: [
      "A rival can contest the area with quiet patrol submarines, offboard acoustic decoys, and intermittent long-range cueing. Its likely aim is to delay movement while avoiding an unmistakable first strike.",
      "Quiet undersea platforms can occupy separate approach axes while remote acoustic sources imitate a larger barrier. Their pattern suggests an effort to redirect the force into a more observable route.",
      "A small undersea force can trail slow support vessels, seed false bearings, and exploit layers in the water column. It may value persistent uncertainty more than immediate damage.",
      "Concealed submarines and unattended sensors can pass fragmentary tracks to distant effect systems. The opposing design appears to depend on the friendly force revealing its screen and search rhythm.",
    ],
    intelligence: [
      "Two intermittent subsurface contacts were reported on separated bearings, but one may be biologic or an offboard decoy. The last high-confidence track is several hours old.",
      "A fixed sensor reported a slow contact near the deep route, while a mobile receiver found a second bearing near the shoals. Neither report has enough continuity for classification.",
      "Acoustic conditions support long detection in one layer and almost none below it. A recent contact could be a platform, displaced ice, or a deliberately replayed signature.",
      "One contact has consistent machinery features but uncertain location; another has a precise bearing and no stable signature. The two reports may not describe separate objects.",
    ],
  },
  {
    key: "missile", required: ["air-defense", "missile-defense", "reconnaissance"], recommended: ["electromagnetic-operations"],
    briefPressure: [
      "Distant launch systems can compress warning time unless the force sustains a layered track beyond the immediate objective.",
      "The formation must protect the task while testing whether sparse air and emitter reports indicate a raid or a feint.",
      "Long-range guided threats make sensor continuity and defensive depth as important as the position of the protected group.",
      "The opposing force can trade uncrewed scouts for brief targeting windows, creating repeated pressure without closing visibly.",
    ],
    opposing: [
      "A rival can combine distant maritime aircraft, uncrewed scouts, and long-range guided raids while keeping its principal launch platforms outside the local picture.",
      "Distant aviation, high-endurance scouts, and surface launch systems can create attacks from several bearings. Their effectiveness depends on a fragile chain of sensing and relay nodes.",
      "The opposing force can send expendable air scouts ahead of crewed aircraft and hold launch platforms beyond the visible sector. It may use the first raid mainly to expose defensive emissions.",
      "Long-reach effect systems can threaten the protected route from outside local sensor range, but only while airborne relays maintain track custody through weather and clutter.",
    ],
    intelligence: [
      "Low-power emitters and several air tracks may be decoys. Target-quality data will depend on a chain of offboard sensors whose continuity remains uncertain.",
      "Two distant launch-capable contacts are assessed with moderate confidence, but the air picture contains duplicated tracks and unexplained gaps at the edge of coverage.",
      "A brief relay transmission preceded an unidentified air contact, yet no launch signature followed. The report may indicate a rehearsal, a sensor test, or deliberate defensive conditioning.",
      "Weather has separated airborne observations into short fragments. Analysts agree that a guided threat is present but disagree about its bearing, scale, and readiness.",
    ],
  },
  {
    key: "surface", required: ["surface-operations", "reconnaissance"], recommended: ["electromagnetic-operations", "undersea-operations"],
    briefPressure: [
      "Surface contacts can hide among routine traffic and concentrate only after the protected movement commits to a route.",
      "A dispersed surface screen is testing classification standards and the force’s ability to maintain custody without escalation.",
      "Fast combatants and ambiguous auxiliaries can threaten the objective from separate axes before combining briefly.",
      "The opposing surface pattern rewards patient identification but punishes a force that waits until every contact is certain.",
    ],
    opposing: [
      "Distributed surface combatants and disguised auxiliaries can disperse among neutral traffic, exchange intermittent targeting data, and mass only long enough to threaten the objective.",
      "Fast surface combatants can operate in pairs beyond the main traffic lane while auxiliary-looking hulls collect observations closer to the objective. Their command relationships are unclear.",
      "A dispersed group of low-signature vessels can alternate between shadowing, blocking, and withdrawal. It seeks a local advantage without presenting a single decisive formation.",
      "Several surface units can use islands, weather, and routine traffic to break contact, then exchange tracks through short relay bursts before approaching from different directions.",
    ],
    intelligence: [
      "Several surface tracks repeat similar signatures, and one large contact is assessed with only moderate confidence. Civilian traffic prevents classification by behavior alone.",
      "Imagery confirms two armed hulls but leaves three auxiliary-like contacts unresolved. Automatic identification records are incomplete and may have been copied between vessels.",
      "A low-signature contact has crossed the route twice without closing, while two faster tracks remain outside visual range. Their behavior could indicate scouting, escort, or unrelated passage.",
      "Passive bearings imply more emitters than visible hulls, but reflections from the coast can duplicate the same source. The apparent formation may be smaller than reported.",
    ],
  },
  {
    key: "mines", required: ["mine-countermeasures", "reconnaissance"], recommended: ["surface-operations", "undersea-operations"],
    briefPressure: [
      "Reports of sea mines and drifting devices make verified access, not rapid movement, the immediate problem.",
      "The route may be closed by a sparse device field whose uncertainty is more disruptive than its actual density.",
      "Remote boats and shore observers can reseed doubt after each survey pass unless the force preserves custody of the cleared lane.",
      "Possible devices along the approach force the group to balance deliberate clearance against a narrowing time window.",
    ],
    opposing: [
      "Influence mines, drifting devices, remote boats, and shore observers can close the approach without requiring a visible opposing fleet.",
      "A sparse mix of bottom devices, drifting objects, and uncrewed surface craft can make every cleared segment temporary unless the route remains observed.",
      "The opposing system relies on ambiguous seabed objects, remote cueing, and small craft that can renew uncertainty faster than a single survey can remove it.",
      "Older device fields may have been supplemented by remotely placed obstacles and false markers. The design is intended to slow verification and exhaust specialist systems.",
    ],
    intelligence: [
      "Mine reports are credible but the field boundary is incomplete. Some objects may be wreckage or devices displaced from an older field by current and weather.",
      "Three seabed anomalies align with the marked lane, while several others follow a pattern consistent with storm debris. No source confirms when either group arrived.",
      "A remote craft was observed near the approach after the last survey. Analysts cannot determine whether it placed a device, inspected an older field, or merely recorded traffic.",
      "The inner lane has one verified device and several magnetic anomalies; the outer lane has no confirmed device but has not been surveyed since the current shifted.",
    ],
  },
  {
    key: "electromagnetic", required: ["electromagnetic-operations", "reconnaissance"], recommended: ["air-defense", "surface-operations"],
    briefPressure: [
      "Deceptive emissions and brief interference can distort the contact picture without producing an obvious attack.",
      "The force must preserve trusted exchange while an opposing network alternates silence, imitation, and short bursts of denial.",
      "False concentration in the electromagnetic picture may conceal a smaller physical movement elsewhere in the sector.",
      "Interference timed to key reports threatens decision quality more than continuous loss of communications.",
    ],
    opposing: [
      "A rival can alternate silence, deceptive emissions, intermittent interference, and uncrewed relays to create false concentration and conceal its actual manoeuvre.",
      "Distributed emitters and mobile relays can imitate a large formation, then fall silent while a smaller surface or undersea element changes position.",
      "The opposing network can corrupt timing, duplicate tracks, and force repeated authentication without attempting continuous denial. Its physical centre remains uncertain.",
      "Uncrewed relays, coastal reflections, and disciplined emission control can produce several plausible pictures at once, each demanding a different allocation of attention.",
    ],
    intelligence: [
      "Repeated signatures suggest deliberate duplication. Interference appears timed to data bursts rather than continuous denial, so the source and operational purpose remain ambiguous.",
      "Authentication failures cluster around two reporting windows, but equipment faults cannot yet be excluded. A passive receiver places the strongest source well away from the apparent contacts.",
      "Three emitters share an implausibly exact rhythm, suggesting replay or relay. One unrelated low-power signal may be the only observation of a physical platform.",
      "The network picture changes whenever the force alters its own emission pattern. This may reveal responsive deception, ordinary propagation, or both operating together.",
    ],
  },
  {
    key: "trafficking-network", required: ["maritime-interdiction", "reconnaissance", "surface-operations"], recommended: ["electromagnetic-operations"],
    briefPressure: [
      "A trafficking network mixes coerced crews, exploited passengers, decoy movements, and legitimate coastal traffic, making safeguarding and corroborated identification inseparable.",
      "Small craft change routes among fishing grounds, ferry lanes, and isolated anchorages while incomplete reports leave both criminal activity and people in distress uncertain.",
      "A dispersed network uses documentation fraud, route switching, and intimidation rather than a single armed formation; stopping one craft cannot by itself protect the route.",
      "Irregular movement and false manifests suggest organized exploitation, but silence, nationality, vessel type, or an unusual course cannot establish criminal intent.",
    ],
    opposing: [
      "Several network cells can alter departure times, transfer people between craft, and exploit gaps between civil authorities. Some persons aboard may be coerced, so protection and evidence quality matter more than rapid attribution.",
      "Coordinators ashore can redirect small craft through reef passages while decoy traffic draws attention toward a busier route. The network adapts when patrol patterns become predictable.",
      "A trafficking network can conceal control through debt, threats, false papers, and intermediaries. Its resilience depends on replacing routes and facilitators rather than defending one vessel.",
      "Multiple facilitators can share weak communications and use ordinary commercial services, creating a fragmented picture in which aggressive action against an ambiguous contact can harm the people the mission is meant to protect.",
    ],
    intelligence: [
      "Reports identify two possible transfer points and several altered manifests, but no single indicator is conclusive. A distress report may involve exploitation, equipment failure, or both.",
      "A small craft changed course after meeting a larger vessel, while another broadcast inconsistent passenger numbers. Both remain mixed with routine fishing traffic.",
      "Civil partners have partial route, financial, and survivor-report information that becomes meaningful only when correlated; no sensor alone can identify a trafficking event.",
      "Several tracks disappear near a coastal communications shadow. One may be a network transfer, while the others follow ordinary seasonal movement.",
    ],
  },
];

const MISSIONS: Mission[] = [
  {
    key: "convoy",
    threatKeys: ["subsurface", "missile", "surface"],
    required: ["reconnaissance"], recommended: ["electromagnetic-operations"], endState: "access", guardrail: "escalation",
    lenses: ["corbett", "wegener", "richmond", "clausewitz"], minimumEscort: 3, minimumAirDefense: 1, minimumAsw: 1, minimumUncrewed: 2,
    politicalAims: [
      "Sustain maritime access without converting a protected transit into a wider conflict.",
      "Demonstrate that routine passage can continue while keeping the protective action temporary and bounded.",
      "Move essential shipping through the corridor without creating a permanent claim of control over the surrounding waters.",
    ],
    histories: [
      "Convoy escort, geographic barrier operations, and limited control of maritime communications",
      "Protected merchant movement, layered scouting, and the temporary concentration of escorts at a decisive passage",
      "Route defence, distant cover, and the historical tension between guarding a convoy closely and searching ahead",
    ],
    briefs: [
      ({ friendlyCount, distance, width, threatPressure }) => `${friendlyCount} slow merchant hulls and a command transport must cross a ${distance}-nautical-mile corridor that narrows to ${width} nautical miles. ${threatPressure}`,
      ({ friendlyCount, distance, width, threatPressure }) => `A formation of ${friendlyCount} commercial vessels will enter a ${width}-nautical-mile choke point midway through a ${distance}-nautical-mile passage. ${threatPressure}`,
      ({ friendlyCount, distance, width, threatPressure }) => `Essential cargo is divided among ${friendlyCount} slow vessels whose only supportable route extends ${distance} nautical miles and contracts to ${width} nautical miles. ${threatPressure}`,
    ],
    friendlies: [
      ({ friendlyCount, durationHours }) => `${friendlyCount} merchant hulls approach in two columns with limited damage-control capacity. They cannot reverse inside the narrows without losing formation and need ${durationHours} hours of continuous air, surface, and subsurface awareness.`,
      ({ friendlyCount, width }) => `The ${friendlyCount} escorted vessels differ in speed and turning radius, so the screen must reorganize before the ${width}-nautical-mile passage rather than inside it.`,
      ({ durationHours }) => `The convoy commander can delay once before entry but cannot pause after committing to the channel. Escort, rescue, and relay coverage must remain continuous for about ${durationHours} hours.`,
    ],
    objectives: [
      () => "Establish the degree and duration of local control needed to move the convoy, displace credible threats, and preserve a viable defensive reserve.",
      () => "Create a moving corridor of awareness and protection, concentrate only at the highest-risk segment, and hand the route back to routine traffic after passage.",
      () => "Keep the convoy coherent through the choke point while denying any opposing system a reliable targeting sequence or a useful delay.",
    ],
    constraints: [
      () => "Do not pursue contacts beyond the exit boundary; require positive identification; retain a second-raid reserve; preserve evidence supporting attribution.",
      () => "Keep neutral routes open, avoid pre-emptive action against ambiguous contacts, and retain enough capacity to cover a reversal before the convoy commits.",
      () => "Protect the slowest vessel without fixing every escort to close station; publish navigation warnings; end pursuit when it no longer contributes to passage.",
    ],
    successes: [
      ({ friendlyCount }) => `All ${friendlyCount} merchant hulls clear the corridor, no neutral vessel is engaged, and the force exits with communications, mobility, and a credible defensive reserve intact.`,
      () => "Every protected vessel reaches the handoff on schedule, the route remains usable for following traffic, and the escort can disengage without leaving an uncovered recovery problem.",
      () => "The convoy crosses without loss or misidentification, no opposing contact gains an uninterrupted track, and temporary control ends at the declared boundary.",
    ],
    navalProblems: [
      "Combine Corbett’s limited control of communications with Wegener’s emphasis on position and access. Decide what must concentrate, what can form barriers, and when the combination should dissolve.",
      "Compare Richmond’s concern for preparation and judgement with Clausewitz’s test of political purpose. Explain which escort risks serve the passage and which merely seek an unnecessary encounter.",
      "Set Corbett’s moving protection problem against Wegener’s geographic leverage. Determine whether the decisive element is close escort, an advanced barrier, or the timing that connects them.",
    ],
  },
  {
    key: "relief",
    threatKeys: ["mines", "surface", "electromagnetic"],
    required: ["surface-operations", "reconnaissance"], recommended: ["air-defense"], endState: "protection", guardrail: "legitimacy",
    lenses: ["till", "panikkar", "corbett", "galula"], minimumEscort: 2, minimumAirDefense: 1, minimumAsw: 1, minimumUncrewed: 6,
    politicalAims: [
      "Protect civilian life and reopen access without turning relief presence into territorial control.",
      "Restore a safe relief route while ensuring that local civil direction remains visible and decisive.",
      "Reduce immediate human harm, reopen essential movement, and transfer route management without attaching coercive conditions to aid.",
    ],
    histories: [
      "Expeditionary relief, constabulary sea use, route clearance, and legitimate transition of control",
      "Disaster access, rescue coverage, and the historical challenge of protecting aid without displacing civil authority",
      "Temporary maritime order, clearance of hazardous approaches, and cooperative withdrawal after relief delivery",
    ],
    briefs: [
      ({ distance, width, threatPressure }) => `A relief formation must reopen a ${distance}-nautical-mile approach whose final channel is only ${width} nautical miles wide. ${threatPressure}`,
      ({ friendlyCount, distance, threatPressure }) => `${friendlyCount} isolated communities depend on a relief group crossing ${distance} nautical miles of contested water before the next resupply window closes. ${threatPressure}`,
      ({ width, durationHours, threatPressure }) => `Medical and engineering support must pass through a ${width}-nautical-mile channel and sustain movement for ${durationHours} hours. ${threatPressure}`,
    ],
    friendlies: [
      ({ friendlyCount }) => `A support ship carries medical, engineering, and rotary-wing teams for ${friendlyCount} isolated communities. Escorts must protect slow relief craft while civil authorities visibly direct the reopening effort.`,
      ({ friendlyCount, durationHours }) => `Relief cargo is split between a deep-draft support vessel and ${friendlyCount} smaller distribution craft. Rescue and clearance teams can sustain only ${durationHours} hours of uninterrupted work.`,
      ({ width }) => `Civil pilots lead two slow aid vessels toward the ${width}-nautical-mile channel. The protective group must leave working room for survey craft, rescue teams, and outbound evacuees.`,
    ],
    objectives: [
      () => "Survey and verify a temporary relief corridor, maintain rescue and identification coverage, deliver priority support, and transfer control to civil authorities on an agreed schedule.",
      () => "Open one clearly marked route for aid and evacuation, protect the working area, and build a handoff that local services can maintain after the formation leaves.",
      () => "Separate genuine hazards from coercive obstruction, move the highest-priority relief first, and restore routine civil navigation rather than indefinite protected access.",
    ],
    constraints: [
      () => "Civil authorities approve every marked route; aid cannot be conditioned on concessions; use minimum force against unidentified craft; publish safety data without exposing unrelated tactical information.",
      () => "Keep rescue frequencies clear, protect displaced people and irregular craft, and let civil pilots set the route even when a faster protective option exists.",
      () => "Do not use relief delivery to demand access beyond the agreed corridor; preserve evidence of hazards; reserve uncrewed systems for the civil handoff.",
    ],
    successes: [
      () => "The lane is accepted by civil authorities, priority relief and evacuees move safely, no patrol craft is misidentified, and the protective formation departs on the agreed schedule.",
      () => "Essential aid reaches the distribution point, outbound patients clear the channel, and a locally managed survey picture remains after the temporary screen withdraws.",
      () => "The corridor is independently verified, relief movement continues without coercive conditions, and the transition requires no permanent external patrol.",
    ],
    navalProblems: [
      "Combine Till’s cooperative and constabulary sea use, Panikkar’s concern for regional autonomy, and Corbett’s limited objective. Explain how protection provides order without substituting for legitimate civil authority.",
      "Compare Galula’s emphasis on legitimacy with Till’s cooperative maritime practice. Decide how the formation can create security while leaving agency with the communities that must sustain it.",
      "Test Corbett’s limited control against Panikkar’s regional perspective. Identify the point at which additional protection would cease to support relief and begin to displace civil choice.",
    ],
  },
  {
    key: "island-denial",
    threatKeys: ["missile", "surface", "electromagnetic"],
    required: ["air-defense", "surface-operations", "reconnaissance"], recommended: ["undersea-operations"], endState: "denial", guardrail: "coalition",
    lenses: ["mahan", "aube", "castex", "sun-tzu"], minimumEscort: 3, minimumAirDefense: 2, minimumAsw: 2, minimumUncrewed: 4,
    politicalAims: [
      "Deny coercive control of a maritime junction while preserving partner freedom of decision.",
      "Prevent one force from closing the island passages without demanding exclusive control for the protecting coalition.",
      "Keep the maritime junction open and impose enough uncertainty to deter a follow-on attempt at coercive control.",
    ],
    histories: [
      "Fleet concentration, distributed maritime pressure, over-the-horizon scouting, and bounded sea denial",
      "Island-barrier operations, mobile screening, and the historical contest between concentrated striking power and dispersed observation",
      "Control of maritime junctions, counter-concentration, and the use of geographic depth to preserve a force in being",
    ],
    briefs: [
      ({ distance, threatPressure }) => `An opposing force is manoeuvring beyond a ${distance}-nautical-mile island arc while both sides depend on fragile over-the-horizon sensing. ${threatPressure}`,
      ({ distance, width, threatPressure }) => `A dispersed formation is seeking a firing position across an island network ${distance} nautical miles deep, with a decisive passage only ${width} nautical miles wide. ${threatPressure}`,
      ({ startHours, distance, threatPressure }) => `Scouting reports indicate that a coercive move toward the main junction could begin within ${startHours} hours across a ${distance}-nautical-mile operating area. ${threatPressure}`,
    ],
    friendlies: [
      () => "The task group begins outside the central passage with incomplete shore-based support. It must divide effort among scouting, air defence, undersea protection, and security of its replenishment route.",
      ({ distance }) => `Friendly elements are separated across ${distance} nautical miles: a protected aviation group, a surface screen, and forward uncrewed scouts cannot all remain mutually supporting at once.`,
      ({ durationHours }) => `The main group has adequate defensive depth for one concentrated action but must preserve replenishment and surveillance for another ${durationHours} hours after the first contact.`,
    ],
    objectives: [
      () => "Prevent an opposing firing position against the main commercial passage, preserve friendly aviation and replenishment, and retain enough capacity to deter a follow-on move.",
      () => "Hold the junction at risk from several directions, break the opposing sensing sequence, and deny control without fixing the whole force inside the island arc.",
      () => "Keep two passages usable, prevent a durable opposing screen, and preserve a mobile reserve able to answer a second concentration.",
    ],
    constraints: [
      () => "Respect neutral waters and airspace; preserve one-third of long-range defensive capacity; do not treat an emitter alone as hostile identification; keep a viable withdrawal route.",
      () => "Partners must approve movement into the inner passage; retain an outer air-defence layer; do not trade replenishment security for a short-lived local advantage.",
      () => "Avoid a single irreversible concentration, keep neutral traffic informed, and require corroboration before acting against any contact using coastal clutter.",
    ],
    successes: [
      () => "The opposing force cannot establish effective local control, commercial access remains viable, the protected group and replenishment route remain secure, and the force retains a deterrent reserve.",
      () => "No sustained firing position covers the main passage, at least two friendly routes remain usable, and the coalition can redistribute rather than escalate to recover its position.",
      () => "The attempted concentration dissolves, the junction remains open, and friendly sensing, aviation, and supply retain enough depth to discourage an immediate return.",
    ],
    navalProblems: [
      "Contrast Mahanian concentration with Aube’s distributed cost imposition and Castex’s combinations. Explain what remains concentrated, what disperses, and how the parts create control rather than disconnected activity.",
      "Compare Sun Tzu’s preference for shaping advantage with Mahan’s search for decisive concentration. Decide whether the junction is held by threatening battle, avoiding it, or controlling the information that makes either choice credible.",
      "Use Castex’s combinations to connect Aube’s dispersed pressure with Mahanian mass. Explain where concentration becomes necessary and where it would instead expose the force to defeat in detail.",
    ],
  },
  {
    key: "evacuation",
    threatKeys: ["subsurface", "missile", "electromagnetic"],
    required: ["reconnaissance", "air-defense"], recommended: ["undersea-operations"], endState: "protection", guardrail: "civilian",
    lenses: ["richmond", "corbett", "panikkar", "clausewitz"], minimumEscort: 2, minimumAirDefense: 1, minimumAsw: 1, minimumUncrewed: 3,
    politicalAims: [
      "Complete a cooperative evacuation without creating a claim of permanent coercive control.",
      "Move the exposed population to safety while keeping the protective corridor limited in place, purpose, and duration.",
      "Prevent interference with evacuation, preserve a route back to calm, and leave no continuing claim over the departure area.",
    ],
    histories: [
      "Protected evacuation, restraint under uncertainty, rescue coverage, and temporary maritime control",
      "Noncombatant movement through contested water, close escort, and the tension between predictable routes and protective deception",
      "Emergency withdrawal, sea-based rescue, and the historical problem of ending protection once the vulnerable movement is complete",
    ],
    briefs: [
      ({ friendlyCount, durationHours, threatPressure }) => `A damaged research and transport complex is evacuating ${friendlyCount * 18} people through a ${durationHours}-hour maritime corridor. ${threatPressure}`,
      ({ friendlyCount, distance, threatPressure }) => `${friendlyCount * 16} evacuees must transfer from small craft to a protected transport during a ${distance}-nautical-mile withdrawal. ${threatPressure}`,
      ({ width, durationHours, threatPressure }) => `A medically fragile evacuation will use a ${width}-nautical-mile departure lane that cannot remain open beyond ${durationHours} hours. ${threatPressure}`,
    ],
    friendlies: [
      () => "The evacuation transport has limited medical capacity and must hold a predictable course. The task group must provide air search, rescue, undersea awareness, and communications without crowding the navigable lane.",
      ({ friendlyCount }) => `${friendlyCount} small transfer craft will approach at irregular intervals, and several lack reliable communications. The main transport can slow for recovery but cannot return after leaving the corridor.`,
      ({ durationHours }) => `A rescue vessel, one transport, and rotary-wing teams can sustain continuous recovery for ${durationHours} hours. Protective manoeuvre must not separate them from the people they are meant to cover.`,
    ],
    objectives: [
      () => "Maintain a credible contact picture and uninterrupted rescue coverage while moving every evacuee to the open-water handoff under restrictive engagement authority.",
      () => "Create a safe sequence of pickup, transfer, and withdrawal; prevent interference; and close the corridor immediately after the final handoff.",
      () => "Protect the predictable evacuation route without turning uncertainty into indiscriminate action or allowing the screen to outrun the rescue effort.",
    ],
    constraints: [
      () => "Effects remain withheld unless hostile capability and intent are both established; maintain rescue reserve; preserve shared navigation warnings; do not pursue beyond the protection corridor.",
      () => "The transport may not be used as bait; keep medical and rescue capacity available; accept delay rather than acting on a single ambiguous track.",
      () => "Protect irregular civilian craft, leave the departure channel open to neutral use, and end all forward action when the final transfer clears the handoff line.",
    ],
    successes: [
      () => "All evacuees reach the handoff, rescue coverage never lapses, ambiguous contacts do not trigger accidental escalation, and the force leaves no claim of permanent control.",
      () => "Every transfer is accounted for, the transport exits with medical capacity in reserve, and the protective screen withdraws without widening the declared corridor.",
      () => "The final craft clears before the window closes, no civilian contact is misclassified, and the opposing force gains no leverage over the route or the handoff.",
    ],
    navalProblems: [
      "Use Richmond’s institutional judgement and Corbett’s limited control, then test both against Panikkar’s concern for regional order. Explain how protection remains legitimate under severe uncertainty.",
      "Compare Clausewitz’s insistence on political purpose with Corbett’s temporary local control. Decide which risks are necessary to complete the evacuation and which would widen the task after success is already possible.",
      "Set Panikkar’s regional perspective beside Richmond’s focus on preparation. Explain how command arrangements, rescue capacity, and an explicit endpoint can make protective power credible without making it permanent.",
    ],
  },
  {
    key: "infrastructure",
    threatKeys: ["subsurface", "mines", "electromagnetic"],
    required: ["undersea-operations", "reconnaissance"], recommended: ["surface-operations"], endState: "status-quo", guardrail: "sustainability",
    lenses: ["gorshkov", "liu-huaqing", "castex", "till"], minimumEscort: 2, minimumAirDefense: 1, minimumAsw: 3, minimumUncrewed: 8,
    politicalAims: [
      "Restore essential maritime infrastructure while preserving long-term monitoring capacity and avoiding unsupported attribution.",
      "Return essential services without converting uncertain evidence into an escalatory accusation.",
      "Protect repair work, preserve confidence in the shared seabed corridor, and leave a supportable system for future warning.",
    ],
    histories: [
      "Undersea infrastructure protection, distributed sensing, autonomous inspection, and strategic resilience",
      "Protection of seabed communications, evidence-led repair, and the historical link between maritime systems and endurance ashore",
      "Remote inspection, repair-ship escort, and the transition from temporary protection to persistent but sustainable observation",
    ],
    briefs: [
      ({ distance, threatPressure }) => `A communications and energy corridor has failed across ${distance} nautical miles of seabed, and repair ships require a protected investigation box. ${threatPressure}`,
      ({ distance, width, threatPressure }) => `Two service breaks lie within a ${distance}-nautical-mile seabed corridor whose repair box narrows to ${width} nautical miles near the coast. ${threatPressure}`,
      ({ durationHours, distance, threatPressure }) => `Inspection vehicles need ${durationHours} hours of stable access to a damaged line extending across ${distance} nautical miles of difficult seabed. ${threatPressure}`,
    ],
    friendlies: [
      () => "Slow repair vessels need stable positioning and repeated uncrewed inspection runs. Escorts must protect them while preserving an evidence chain that separates accident, sabotage, and opportunistic observation.",
      ({ durationHours }) => `A cable vessel, a systems tender, and remote inspection craft must remain nearly stationary for ${durationHours} hours. Their work sequence cannot be accelerated without losing evidence.`,
      ({ friendlyCount }) => `Repair teams have divided the corridor into ${friendlyCount} survey blocks. Uncrewed systems can inspect them in parallel, but the crewed ships cannot protect every block simultaneously.`,
    ],
    objectives: [
      () => "Map the failure, secure a bounded repair box, attribute only what the evidence supports, restore service, and leave a sustainable monitoring architecture.",
      () => "Protect inspection long enough to distinguish damage mechanisms, repair the priority line, and establish a repeatable watch that does not require permanent concentration.",
      () => "Keep the repair ships on task, prevent contamination of the evidence, and restore enough service to return the corridor to normal civil management.",
    ],
    constraints: [
      () => "Do not disturb unrelated seabed infrastructure; separate protective action from attribution; maintain repair access; retain uncrewed systems for follow-on monitoring.",
      () => "Publish safety boundaries, avoid active sensing that could damage the inspection, and preserve at least one remote system for post-repair verification.",
      () => "Protect observed facts from premature interpretation, keep the repair lane available to civil traffic, and do not extend the box merely to chase an uncertain contact.",
    ],
    successes: [
      () => "Service is restored, repair ships and civilian infrastructure remain protected, evidence is preserved, and the follow-on monitoring burden is supportable.",
      () => "The priority line returns to operation, every anomaly receives an evidence rating, and a smaller remote watch can replace the concentrated protective group.",
      () => "Inspection explains the failure within stated confidence limits, repairs hold through verification, and no unsupported attribution drives further escalation.",
    ],
    navalProblems: [
      "Combine Gorshkov’s comprehensive sea-power system, Liu Huaqing’s phased development, and Castex’s strategic combinations. Distinguish the force needed for immediate protection from the institutions required for durable resilience.",
      "Compare Till’s broad account of maritime security with Liu Huaqing’s staged development. Decide which sensing, repair, and protection capacities must exist now and which can be built into the transition.",
      "Use Castex’s combinations to test Gorshkov’s system view. Explain why ships, remote sensors, repair capacity, and evidence standards must work as one design rather than as separate inventories.",
    ],
  },
  {
    key: "limited-pressure",
    threatKeys: ["missile", "surface", "electromagnetic"],
    required: ["surface-operations", "air-defense", "reconnaissance"], recommended: ["land-attack", "electromagnetic-operations"], endState: "limited-compellence", guardrail: "escalation",
    lenses: ["aube", "corbett", "castex", "clausewitz"], minimumEscort: 3, minimumAirDefense: 2, minimumAsw: 1, minimumUncrewed: 4,
    politicalAims: [
      "Compel a narrow reversal while preserving a credible path back to the maritime status quo.",
      "End coercive inspections through limited, reversible pressure rather than a contest for permanent dominance.",
      "Restore neutral passage by changing the opposing calculation while keeping demands, geography, and duration explicit.",
    ],
    histories: [
      "Limited maritime coercion, blockade pressure, counter-concentration, and termination under reciprocal risk",
      "Escorted test passage, reversible pressure, and the historical difficulty of connecting sea control to a narrow political demand",
      "Distributed cost imposition, signalling through protected movement, and termination before limited compellence becomes unlimited contest",
    ],
    briefs: [
      ({ distance, threatPressure }) => `An opposing force has imposed an exclusion claim across a ${distance}-nautical-mile commercial approach and is inspecting neutral shipping. ${threatPressure}`,
      ({ distance, startHours, threatPressure }) => `A declared inspection zone covers ${distance} nautical miles of a commercial route, and the next neutral transit reaches it in ${startHours} hours. ${threatPressure}`,
      ({ width, durationHours, threatPressure }) => `Coerced inspections now control a ${width}-nautical-mile junction, but a protected test passage could be organized within ${durationHours} hours. ${threatPressure}`,
    ],
    friendlies: [
      () => "A partner task group can escort test transits, demonstrate local superiority, or impose distributed costs, but participants differ on how much escalation and economic disruption they will accept.",
      ({ friendlyCount }) => `${friendlyCount} neutral merchant vessels are willing to continue passage if an escort remains defensive and predictable. Supporting partners disagree about pressure beyond the route itself.`,
      ({ durationHours }) => `The force can sustain a visible escort and an outer screen for ${durationHours} hours, but it cannot maintain both indefinitely without exposing replenishment and weakening political cohesion.`,
    ],
    objectives: [
      () => "End coerced inspections and restore neutral passage through a bounded combination of escort, denial, signalling, and reversible pressure.",
      () => "Demonstrate that the exclusion claim cannot be enforced at acceptable cost, state the demanded reversal clearly, and preserve an observable route to disengagement.",
      () => "Protect one successful transit, prevent renewed inspection, and convert local maritime advantage into a limited change of behaviour rather than a broader contest.",
    ],
    constraints: [
      () => "Keep demands explicit and limited; preserve neutral passage; withhold effects against civilian infrastructure; retain an observable off-ramp and a defensive reserve.",
      () => "Partners must approve each step beyond escort; do not obstruct unrelated trade; pair every pressure action with a stated condition for ending it.",
      () => "Do not confuse punishment with leverage, preserve evidence of any inspection attempt, and stop escalation once neutral passage resumes.",
    ],
    successes: [
      () => "Coerced inspections stop, neutral passage resumes, partner cohesion survives, and both forces retain a credible path to disengagement.",
      () => "The test vessel passes without inspection, the opposing declaration loses practical effect, and no additional demand prevents termination.",
      () => "Routine traffic returns, pressure measures are removed on schedule, and the protective group retains enough defence to disengage safely.",
    ],
    navalProblems: [
      "Combine Aube’s distributed pressure, Corbett’s limited control, Castex’s combinations, and Clausewitz’s political test. Identify the mechanism expected to change the opposing choice and the point at which more force defeats the limited aim.",
      "Compare Clausewitz’s political test with Aube’s dispersed pressure. Explain what observable decision the pressure is meant to change and why a broader attack might reduce rather than increase leverage.",
      "Use Corbett’s limited control and Castex’s combinations to connect escort, denial, and signalling. Identify the termination condition before selecting the action that is supposed to produce it.",
    ],
  },
  {
    key: "ceasefire-watch",
    threatKeys: ["surface", "electromagnetic", "missile"],
    required: ["surface-operations", "reconnaissance"], recommended: ["air-defense", "electromagnetic-operations"], endState: "status-quo", guardrail: "legitimacy",
    lenses: ["sun-tzu", "corbett", "galula", "richmond"], minimumEscort: 2, minimumAirDefense: 1, minimumAsw: 1, minimumUncrewed: 4,
    politicalAims: [
      "Preserve a fragile maritime pause by making violations observable without creating incentives for a preventive strike.",
      "Keep separated forces apart long enough for civil traffic and verification arrangements to resume.",
      "Deter covert movement across the separation line while preserving the legitimacy of a reciprocal monitoring regime.",
    ],
    histories: [
      "Maritime armistice observation, reciprocal separation measures, and control of incidents among mixed traffic",
      "Buffer-zone patrol, verification by persistent sensing, and the historical problem of deterring violations without provoking them",
      "Ceasefire support at sea, shared reporting, and transition from concentrated watch to routine civil observation",
    ],
    briefs: [
      ({ distance, durationHours, threatPressure }) => `A maritime pause covers ${distance} nautical miles of a mixed-traffic separation line and enters a ${durationHours}-hour verification period. ${threatPressure}`,
      ({ width, startHours, threatPressure }) => `Two opposing formations must remain outside a ${width}-nautical-mile buffer when a shared observation window begins in ${startHours} hours. ${threatPressure}`,
      ({ friendlyCount, distance, threatPressure }) => `${friendlyCount} neutral vessels will cross a monitored line extending ${distance} nautical miles while both sides test the new separation rules. ${threatPressure}`,
    ],
    friendlies: [
      ({ friendlyCount }) => `A small observation group supports ${friendlyCount} neutral transits and two shared reporting points. It has enough endurance to monitor the line but not to escort every contact individually.`,
      ({ durationHours }) => `Surface escorts and uncrewed scouts can maintain overlapping watch for ${durationHours} hours. Their reports must remain releasable to the reciprocal verification channel.`,
      ({ width }) => `The friendly screen begins outside the ${width}-nautical-mile buffer with civil observers embarked on one support vessel. Manoeuvre that appears threatening could collapse the reporting arrangement.`,
    ],
    objectives: [
      () => "Maintain the separation line, classify and document any crossing, protect neutral traffic, and keep the reciprocal reporting mechanism credible.",
      () => "Make covert movement difficult without creating a threatening concentration, then reduce the watch as shared verification becomes reliable.",
      () => "Prevent a local incident from becoming a general breakdown by preserving evidence, communications, and a clear sequence for disengagement.",
    ],
    constraints: [
      () => "Do not enter the reciprocal buffer except for rescue; share releasable tracks; retain corroborating evidence; answer ambiguous movement with observation before interception.",
      () => "Civil observers must be able to verify reports, neutral traffic keeps priority, and no single emitter or track discontinuity establishes a violation.",
      () => "Keep formations dispersed outside the line, use matching responses to minor breaches, and reserve concentrated action for a corroborated threat to protected traffic.",
    ],
    successes: [
      () => "The separation line holds, neutral traffic crosses safely, every suspected violation receives a shared evidence record, and the watch can be reduced on schedule.",
      () => "No opposing formation establishes a concealed position inside the buffer, communications survive, and reciprocal verification continues after the task group leaves.",
      () => "A potential incident is classified without uncontrolled escalation, both sides return outside the line, and routine monitoring replaces the concentrated screen.",
    ],
    navalProblems: [
      "Compare Sun Tzu’s preference for shaping choices with Corbett’s limited local control. Explain how observation can deny advantage without making a threatening concentration necessary.",
      "Set Galula’s legitimacy test beside Richmond’s emphasis on institutional competence. Decide which evidence, liaison, and command arrangements make restraint credible rather than merely passive.",
      "Use Corbett and Richmond to distinguish a temporary monitoring concentration from the routine system that must replace it. Explain how the force can succeed by becoming less necessary.",
    ],
  },
  {
    key: "survey-access",
    threatKeys: ["mines", "subsurface", "electromagnetic"],
    required: ["mine-countermeasures", "reconnaissance"], recommended: ["undersea-operations", "surface-operations"], endState: "access", guardrail: "sustainability",
    lenses: ["liu-huaqing", "gorshkov", "till", "castex"], minimumEscort: 2, minimumAirDefense: 1, minimumAsw: 2, minimumUncrewed: 8,
    politicalAims: [
      "Re-establish trusted access through a poorly charted approach and leave a survey system that routine operators can sustain.",
      "Open a verified route for essential movement without promising permanent protection of every surrounding passage.",
      "Convert uncertain hazards into a bounded navigation problem, restore passage, and transfer the resulting picture to civil route managers.",
    ],
    histories: [
      "Hydrographic access, route clearance, remote survey, and the gradual replacement of specialist protection by routine navigation",
      "Reconnaissance of constrained approaches, verification of safe water, and historical adaptation from crewed clearance to distributed remote sensing",
      "Maritime survey under interference, custody of a cleared lane, and transition from temporary access operations to durable route knowledge",
    ],
    briefs: [
      ({ distance, width, threatPressure }) => `An essential approach extends ${distance} nautical miles through uncertain water and narrows to a ${width}-nautical-mile surveyed gap. ${threatPressure}`,
      ({ friendlyCount, durationHours, threatPressure }) => `${friendlyCount} survey sectors must be checked during a ${durationHours}-hour window before deep-draft traffic enters the approach. ${threatPressure}`,
      ({ width, startHours, threatPressure }) => `The only charted route is ${width} nautical miles wide, and new hazard reports must be resolved within ${startHours} hours. ${threatPressure}`,
    ],
    friendlies: [
      ({ friendlyCount }) => `Remote survey craft divide the approach into ${friendlyCount} blocks while a tender and escorts maintain data custody. Loss of the shared reference picture would force every block to be repeated.`,
      ({ durationHours }) => `A survey tender can support simultaneous surface, subsurface, and rotary-wing searches for ${durationHours} hours before recovering its remote systems.`,
      ({ distance }) => `The specialist group can verify the full ${distance}-nautical-mile route only by moving its screen in stages. Survey speed, escort depth, and evidence quality compete for the same time.`,
    ],
    objectives: [
      () => "Verify one complete access lane, maintain custody after clearance, escort the first transit, and leave route data that routine operators can update.",
      () => "Classify hazards by confidence, open only the water supported by evidence, and prevent renewed uncertainty from closing the route after the survey group departs.",
      () => "Connect remote sensing, physical verification, and a protected test passage into a sustainable access plan rather than a one-time clearance event.",
    ],
    constraints: [
      () => "Do not mark unsurveyed water as safe; protect the evidence chain; retain recovery capacity for remote systems; keep the route boundary narrower than the area actually observed.",
      () => "Civil route managers approve published data, specialist craft cannot be expended merely to save time, and uncertain contacts remain hazards rather than attributed attacks.",
      () => "Maintain a clean reference channel, preserve one reserve survey team, and do not widen the mission beyond the first route that meets the required confidence.",
    ],
    successes: [
      () => "The first deep-draft transit clears a verified lane, no remote system is left unrecovered, and routine route managers can sustain the updated picture.",
      () => "Every published segment has corroborating evidence, the protected test passage succeeds, and later traffic does not depend on the specialist group remaining on station.",
      () => "A bounded route reopens, ambiguous hazards are documented rather than ignored, and the survey architecture can repeat the work at a lower operating burden.",
    ],
    navalProblems: [
      "Compare Liu Huaqing’s phased development with Till’s account of maritime security. Decide how an immediate specialist force should create the conditions for a simpler enduring system.",
      "Use Gorshkov’s system perspective and Castex’s combinations to connect survey craft, escorts, data custody, and the first protected transit. Explain why clearance without continued observation is incomplete.",
      "Set Till’s cooperative practice beside Liu Huaqing’s staged capacity. Identify which knowledge must be transferred so that access survives after the most capable systems depart.",
    ],
  },
  {
    key: "coastal-safeguarding",
    threatKeys: ["surface", "mines", "electromagnetic"],
    required: ["surface-operations", "reconnaissance", "maritime-interdiction"], recommended: ["mine-countermeasures", "electromagnetic-operations"], endState: "protection", guardrail: "legitimacy",
    lenses: ["corbett", "aube", "till", "richmond"], minimumEscort: 2, minimumAirDefense: 0, minimumAsw: 1, minimumUncrewed: 6,
    politicalAims: [
      "Protect coastal movement and restore trusted access without converting a temporary safeguarding presence into permanent control.",
      "Keep an estuary and its civil routes usable while transferring observation and response back to local institutions.",
      "Preserve life, lawful movement, and essential services in confined water while preventing an ambiguous incident from widening the crisis.",
    ],
    histories: [
      "Littoral sea control, coastal safeguarding, route observation, and the transition from concentrated protection to routine civil management",
      "Confined-water patrol, rescue coverage, mine awareness, and Corbettian control of communications near a contested coast",
      "Coastal defence, distributed scouting, small-craft classification, and the limits of fleet concentration in shallow water",
    ],
    briefs: [
      ({ distance, width, threatPressure }) => `A coastal route runs ${distance} nautical miles through an estuary whose usable channel narrows to ${width} nautical miles among ferries, fishing craft, shoals, and shore clutter. ${threatPressure}`,
      ({ friendlyCount, durationHours, threatPressure }) => `${friendlyCount} essential coastal movements require a protected ${durationHours}-hour window through shallow, densely trafficked water. ${threatPressure}`,
      ({ width, startHours, threatPressure }) => `Civil authorities will reopen a port approach ${width} nautical miles wide in ${startHours} hours, but its sensor picture remains fragmented by terrain and routine emissions. ${threatPressure}`,
    ],
    friendlies: [
      ({ friendlyCount }) => `A distributed group of shallow-water vessels, rescue craft, and remote sensors must support ${friendlyCount} civil movements without blocking the channel it protects.`,
      ({ durationHours }) => `Coastal partners can maintain visual reporting for ${durationHours} hours, but require a shared classification picture and a protected rescue lane.`,
      ({ distance }) => `The available force can cover the ${distance}-nautical-mile route only by handing contacts between surface, air, remote, and civil observers rather than concentrating in one place.`,
    ],
    objectives: [
      () => "Establish sufficient local awareness and protection for civil movement, preserve the rescue lane, and leave a sustainable coastal reporting arrangement.",
      () => "Classify small-craft activity without profiling, keep the main channel open, and use remote sensing to reduce crewed exposure and intrusive presence.",
      () => "Prevent local disruption from becoming durable route closure while retaining evidence, proportionality, and a visible path back to civil control.",
    ],
    constraints: [
      () => "Do not infer hostile purpose from vessel type, silence, origin, or an irregular course alone; preserve rescue access; require corroboration before interception.",
      () => "Civil navigation authority remains primary, remote systems may observe but not make final safeguarding judgments, and every restrictive measure needs an expiry condition.",
      () => "Keep large hulls outside the shallowest lanes, avoid displacing risk onto unobserved coastal communities, and preserve records suitable for independent review.",
    ],
    successes: [
      () => "The coastal route reopens without misidentification, rescue coverage remains intact, and civil partners can sustain the shared picture after the task group withdraws.",
      () => "Essential traffic crosses safely, ambiguous contacts are resolved through corroboration, and no temporary control measure becomes an open-ended restriction.",
      () => "The protected movement completes, the channel remains usable, and remote and crewed systems transfer their evidence and watch responsibilities coherently.",
    ],
    navalProblems: [
      "Compare Corbett’s local control of communications with Aube’s emphasis on dispersed littoral threats. Explain why a concentrated fleet may be visible yet poorly suited to the decisive classification problem.",
      "Use Till’s maritime-security framework and Richmond’s institutional emphasis to connect sensing, rescue, civil authority, and sustainable handoff.",
      "Set Corbett’s limited control beside Aube’s coastal asymmetry. Decide which functions should disperse, which decisions must remain human, and when the temporary screen should dissolve.",
    ],
  },
  {
    key: "anti-trafficking-safeguarding",
    threatKeys: ["trafficking-network", "surface", "electromagnetic"],
    required: ["maritime-interdiction", "reconnaissance", "surface-operations"], recommended: ["electromagnetic-operations"], endState: "protection", guardrail: "civilian",
    lenses: ["till", "corbett", "galula", "sun-tzu"], minimumEscort: 2, minimumAirDefense: 0, minimumAsw: 0, minimumUncrewed: 6,
    politicalAims: [
      "Protect people at sea and disrupt an adaptive trafficking network while preserving lawful movement, evidence integrity, and trusted civil handoff.",
      "Reduce exploitation along a coastal route without treating irregular migration, poverty, or undocumented movement as proof of criminal participation.",
      "Create a safeguarding and evidence picture that helps civil partners dismantle a network rather than merely displacing vulnerable people onto a more dangerous route.",
    ],
    histories: [
      "Maritime constabulary practice, network disruption, survivor protection, and the strategic limits of vessel-by-vessel interception",
      "Coastal surveillance, lawful interception, rescue, evidence custody, and coordinated action against adaptive illicit networks",
      "Protection of maritime communications, human security at sea, and transition from temporary patrol concentration to durable civil cooperation",
    ],
    briefs: [
      ({ distance, friendlyCount, threatPressure }) => `Across ${distance} nautical miles of coastal traffic, ${friendlyCount} craft or transfer points require corroboration after reports of coercion and unsafe movement. ${threatPressure}`,
      ({ width, durationHours, threatPressure }) => `A ${width}-nautical-mile archipelagic passage enters a ${durationHours}-hour peak movement period while civil partners compare survivor reports, manifests, and uncertain tracks. ${threatPressure}`,
      ({ startHours, friendlyCount, threatPressure }) => `A safeguarding operation begins in ${startHours} hours around ${friendlyCount} ambiguous small-craft reports mixed with ferries, fishing vessels, and distress traffic. ${threatPressure}`,
    ],
    friendlies: [
      ({ durationHours }) => `Rescue, inspection-support, and civil liaison teams can sustain a shared watch for ${durationHours} hours if aircraft and remote systems preserve track context rather than producing disconnected detections.`,
      ({ friendlyCount }) => `Civil partners hold partial information on ${friendlyCount} reports. The task group can add sensing, rescue, and evidence support but cannot replace legal authority or survivor care.`,
      ({ distance }) => `The route spans ${distance} nautical miles and crosses several reporting jurisdictions. A protected handoff is required whenever a person or record leaves the maritime force’s custody.`,
    ],
    objectives: [
      () => "Protect persons in danger, identify activity through corroborated indicators, preserve an auditable evidence chain, and support a coordinated civil response to the wider network.",
      () => "Distinguish rescue, safeguarding, and suspected facilitation needs; maintain custody of relevant observations; and prevent route displacement from becoming the only result.",
      () => "Create persistent but proportionate awareness, enable lawful civil decisions, and measure success by protection and network disruption rather than by the number of craft stopped.",
    ],
    constraints: [
      () => "Do not profile by origin, language, vessel type, poverty, silence, or route alone; rescue takes priority when life is at risk; remote classification requires human corroboration.",
      () => "Protect survivor privacy, separate care from intelligence collection, record custody transfers, and avoid public disclosure that could expose vulnerable persons or future safeguarding activity.",
      () => "Use the least intrusive effective response, preserve neutral traffic, keep legal and civil authorities visible, and reassess when the network changes routes.",
    ],
    successes: [
      () => "People in danger reach protected care, suspected activity is documented without prejudgment, civil partners receive usable evidence, and the network loses freedom of movement without widespread route closure.",
      () => "The operation distinguishes victims, witnesses, facilitators, and unrelated traffic through due process, while a coordinated follow-on plan addresses route displacement and recovery needs.",
      () => "Safeguarding, rescue, evidence, and partner coordination remain coherent; no person is treated as culpable solely because of their movement or status; and pressure shifts from vulnerable passengers toward the network.",
    ],
    navalProblems: [
      "Use Corbett’s protection of communications and Till’s maritime-security lens to explain why lawful access, rescue, evidence, and coordination are strategic functions rather than administrative details.",
      "Compare Sun Tzu’s preference for disrupting an adversary’s design with Galula’s legitimacy test. Explain why indiscriminate interception can strengthen the network’s adaptation and undermine the mission.",
      "Set Till’s cooperative maritime security against Corbett’s local control. Design a handoff in which distributed drones widen awareness but human and civil authorities retain classification, safeguarding, and legal decisions.",
    ],
  },
];

const CIVILIAN_CONTEXTS = [
  "Neutral fishing vessels continue to operate near the route, and a scheduled passenger service cannot fully clear the sector. Identification standards must remain high despite weather clutter and intermittent emissions.",
  "Container traffic will enter the central junction during the operation, while nearby administrations remain neutral and have not authorized combat inside their waters.",
  "Research, rescue, and subsistence craft from several jurisdictions share the route. Their irregular tracks and weak communications create ambiguity but do not reduce the duty to identify.",
  "Displaced residents and volunteer rescue craft enter the area without reliable communications. Civil authorities retain legal control but have limited operating capacity.",
  "Energy and communications services in several coastal communities depend on the corridor, so delay carries civilian cost even when no vessel is attacked.",
  "Seasonal fishing grounds overlap the outer search area, and many small craft carry only basic navigation lights. Silence or an irregular course cannot by itself establish hostile intent.",
  "A passenger vessel with limited medical support will cross the down-current edge of the sector. Its schedule is public, but weather may force it away from the reported route.",
  "Two civil survey teams are repairing navigation markers near the choke point. Their uncrewed craft use control links that can resemble the intermittent emissions under investigation.",
  "A damaged cargo vessel remains at anchor near the approach with a mixed rescue crew aboard. It cannot move quickly and may obscure contacts arriving from the coast.",
  "Local pilots are guiding deep-draft traffic through the safest known lane. Their authority over navigation continues even when protective units recommend a different route.",
  "Several communities rely on small fuel and food deliveries that cannot wait for complete certainty. Delay, route closure, and false warning each impose a different civilian cost.",
  "A civil cable-repair team is working outside the main corridor, and its remote vehicles periodically surface without predictable timing. The published safety zone must remain available.",
  "A rescue coordination centre is relaying reports from many weak transmitters. Some positions are stale, but excluding them would leave vulnerable craft outside the shared picture.",
  "Routine ferry traffic pauses during the decisive movement but resumes immediately afterward. Any temporary control measure must therefore have a clear expiry and releasable route information.",
  "Ice-edge harvesting and research craft use several languages and incompatible reporting systems. Classification must rely on corroborated behaviour rather than communication failure.",
  "A hospital ship is waiting beyond the handoff line and cannot enter confined water. Medical urgency shortens the timeline without changing the requirement to protect neutral traffic.",
  "Coastal emergency services can sustain only one rescue lane at a time. Protective manoeuvre must not block that lane or draw unidentified craft toward it.",
  "A large convoy has broken into smaller groups to manage weather. Their revised positions will arrive late, making the civil traffic picture incomplete but still operationally important.",
  "Independent observers aboard a civil vessel will document route safety and any use of force. Their access supports legitimacy but limits what tactical information can be shared.",
];

const STRATEGIC_TRANSITIONS = [
  "The design must connect temporary control to a credible transition once the immediate danger passes.",
  "Success requires only the local advantage needed for the stated aim, followed by an observable reduction in force.",
  "The commander must preserve choices after contact instead of treating destruction as the measure of progress.",
  "Every concentration should answer a political need, a geographic problem, and a stated condition for ending it.",
  "The plan must distinguish protective leverage from action that would make the desired settlement harder to reach.",
  "The force should create a favourable decision while retaining the capacity and authority to stop at the limited aim.",
] as const;

const END_STATE_TESTS: Record<EndState, readonly string[]> = {
  access: [
    "Access is achieved only if following traffic can use the route without the whole force remaining on station.",
    "The end state is a usable passage and a supportable handoff, not control of every contact in the wider sector.",
    "The route must remain practicable after the decisive movement, with residual hazards documented for routine operators.",
  ],
  protection: [
    "Protection ends when the vulnerable movement and its recovery obligation are complete, not when every uncertainty disappears.",
    "The protected people and craft must reach the handoff with the rescue system and withdrawal route still viable.",
    "The end state requires safety through the declared window and no permanent protective presence afterward.",
  ],
  denial: [
    "Denial succeeds when the opposing design cannot produce usable control, even if opposing units remain in the wider area.",
    "The force need not occupy every passage; it must prevent a reliable position against the junction and preserve alternatives.",
    "The end state is continued freedom of movement and a surviving reserve, not possession of the entire sector.",
  ],
  "limited-compellence": [
    "Compellence succeeds only when the specified behaviour changes and the pressure can stop without adding a new demand.",
    "The end state joins an observable reversal to an equally observable path for disengagement.",
    "Leverage must remain reversible so that compliance, rather than punishment, ends the operation.",
  ],
  "status-quo": [
    "Restoration is complete when routine arrangements can resume and the concentrated response is no longer necessary.",
    "The end state returns responsibility to a sustainable peacetime system without erasing the evidence gathered during the crisis.",
    "Normal movement and reciprocal restraint must survive the withdrawal of temporary protective capacity.",
  ],
};

const GUARDRAIL_LIMITS: Record<Guardrail, readonly string[]> = {
  escalation: [
    "Pair each increase in pressure with a boundary, a decision authority, and a visible path back down.",
    "Keep a defensive reserve and require corroboration before any action that could widen the contest.",
    "Do not let pursuit, attribution, or retaliation outgrow the limited purpose of the operation.",
  ],
  civilian: [
    "Civilian movement, rescue access, and positive identification take precedence over a faster tactical sequence.",
    "Account for irregular craft and delayed reports before changing the protected route or engagement posture.",
    "Preserve rescue capacity and treat communication failure as uncertainty rather than hostile intent.",
  ],
  coalition: [
    "Keep shared decision thresholds explicit and do not create a commitment that participating partners have not accepted.",
    "Preserve partner access to evidence and retain a course of action that does not depend on unanimous escalation.",
    "No local advantage is useful if it removes the coalition’s ability to choose the next step together.",
  ],
  legitimacy: [
    "Make the authority, evidence standard, and endpoint visible to the civil actors whose cooperation sustains the result.",
    "Use only the control needed for the declared task and preserve an independent record of disputed events.",
    "A tactically convenient action that displaces lawful civil direction fails the strategic test.",
  ],
  sustainability: [
    "Reserve people, remote systems, and maintenance capacity for the lower-intensity arrangement that must follow.",
    "Do not solve the immediate task by consuming the sensors or specialists needed to keep the result durable.",
    "The follow-on burden must fit routine support, recovery, and information-sharing capacity.",
  ],
};

const UNCERTAINTY_QUALIFIERS = [
  "Forecast confidence is moderate, and weather may change which reports can be corroborated.",
  "The opposing order of battle is incomplete; absence from the current picture is not evidence that a platform is absent.",
  "Neutral traffic and propagation create plausible alternative explanations for several observations.",
  "Source confidence varies, so the commander must separate confirmed facts, working assessments, and explicit assumptions.",
  "The picture may improve only after the force reveals part of its own sensing pattern, creating a trade-off between knowledge and concealment.",
  "Reports arrive on different timelines, and the most precise position is not necessarily the most reliable classification.",
] as const;

const CLIMATE_HISTORY: Record<Climate, readonly string[]> = {
  ocean: [
    "open-water reach, archipelagic concealment, and weather-driven changes in the value of concentration",
    "oceanic scouting, protection of long communications, and adaptation to dispersed sensing",
    "open approaches, island choke points, and the changing relationship between range, information, and control",
  ],
  arctic: [
    "high-latitude access, ice-limited movement, and the endurance demands of sparse support",
    "seasonal passages, under-ice uncertainty, and geographic barriers that move with weather",
    "cold-region logistics, broken sensor coverage, and the temporary control of shifting leads",
  ],
  antarctic: [
    "southern ice access, long recovery distances, and weather-limited endurance",
    "remote research corridors, mobile pack ice, and protection without nearby support",
    "exposed southern approaches, fragile communications, and the need to recover every specialist system",
  ],
};

const OPERATION_ADJECTIVES = [
  "AMBER", "BRIGHT", "CLEAR", "COLD", "DEEP", "DISTANT", "EVEN", "FAINT",
  "GLASS", "GREY", "HIDDEN", "LUCENT", "NARROW", "OPEN", "PALE", "QUIET",
  "RESOLUTE", "SILENT", "SILVER", "STABLE", "STEADFAST", "STILL", "SWIFT", "TIDAL",
  "WATCHFUL", "WIDE", "WINDWARD", "WINTER", "WOVEN", "CALM", "EASTERN", "WESTERN",
] as const;
const OPERATION_NOUNS = [
  "ANCHOR", "BEACON", "CHANNEL", "COMPASS", "CURRENT", "HARBOR", "HORIZON", "LANTERN",
  "MERIDIAN", "PASSAGE", "REACH", "ROADSTEAD", "SOUNDER", "STRAIT", "TIDE", "WATCH",
  "BARRIER", "CIRCUIT", "CROSSING", "GATE", "HANDOFF", "HEADLAND", "LEAD", "MARGIN",
  "ORBIT", "RELAY", "ROUTE", "SHELF", "SIGNAL", "THRESHOLD", "TRANSIT", "WINDOW",
] as const;

function unitDraw(random: () => number) {
  const value = random();
  if (!Number.isFinite(value)) return 0.5;
  return Math.max(0, Math.min(1 - Number.EPSILON, value));
}

function pick<T>(values: readonly T[], random: () => number) {
  return values[Math.floor(unitDraw(random) * values.length)];
}

function integer(minimum: number, maximum: number, random: () => number) {
  return minimum + Math.floor(unitDraw(random) * (maximum - minimum + 1));
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function normalizeHeading(value: number) {
  return Math.round(((value % 360) + 360) % 360);
}

function variedHeading(base: number, spread: number, random: () => number) {
  return normalizeHeading(base + (unitDraw(random) * 2 - 1) * spread);
}

export function combinedWaveHeading(windHeading: number, windSpeed: number, currentHeading: number, currentSpeed: number) {
  const windRadians = windHeading * Math.PI / 180;
  const currentRadians = currentHeading * Math.PI / 180;
  const east = Math.sin(windRadians) * windSpeed + Math.sin(currentRadians) * currentSpeed * 4;
  const north = Math.cos(windRadians) * windSpeed + Math.cos(currentRadians) * currentSpeed * 4;
  return normalizeHeading(Math.atan2(east, north) * 180 / Math.PI);
}

function describeGeography(region: Region, context: MissionContext, random: () => number) {
  const extent = pick([
    `The decisive working area extends roughly ${context.distance} nautical miles and compresses to ${context.width} nautical miles at its narrowest usable point.`,
    `From the outer search boundary to the handoff is ${context.distance} nautical miles; the route’s most restrictive segment is ${context.width} nautical miles wide.`,
    `The operating picture spans ${context.distance} nautical miles, but movement, sensing, and neutral traffic converge inside a ${context.width}-nautical-mile choke point.`,
    `Staging and recovery areas are separated by ${context.distance} nautical miles, with only ${context.width} nautical miles of manoeuvrable water at the key junction.`,
    `The force must connect observations across ${context.distance} nautical miles before committing to a passage that narrows to ${context.width} nautical miles.`,
  ], random);
  return `${pick(region.terrain, random)} ${pick(region.navigation, random)} ${extent}`;
}

function describeWeatherWindow(input: {
  precipitation: Precipitation;
  storming: boolean;
  clouds: Clouds;
  windSpeed: number;
  currentSpeed: number;
  waveHeading: number;
}, random: () => number) {
  const waveMotion = `${input.windSpeed}-knot winds and a ${input.currentSpeed}-knot current drive waves toward ${input.waveHeading}°`;
  const cloudCover = cloudCoverPhrase(input.clouds);
  if (input.precipitation === "none") {
    return pick([
      `${cloudCover} permits intermittent long-range sensing but does not remove radar shadow or deceptive contacts; ${waveMotion}`,
      `under ${cloudCover}, visual and infrared ranges will vary across the route while ${waveMotion}`,
      `${cloudCover} leaves useful observation windows, although coastal clutter and horizon limits remain; ${waveMotion}`,
    ], random);
  }
  const weather = input.storming ? "a seasonal storm" : `a ${input.precipitation} band`;
  return pick([
    `${weather} under ${cloudCover} will reduce aviation continuity and identification range; ${waveMotion}`,
    `${weather} will cross the working area beneath ${cloudCover}, shortening reliable detection windows as ${waveMotion}`,
    `${cloudCover} and ${weather} will interrupt visual classification and remote-system recovery; ${waveMotion}`,
  ], random);
}

function describeTiming(context: MissionContext, weatherWindow: string, random: () => number) {
  return pick([
    `The force has ${context.startHours} hours before the decisive movement begins and must sustain the task for about ${context.durationHours} hours. During that window, ${weatherWindow}.`,
    `The decisive movement starts in ${context.startHours} hours, followed by roughly ${context.durationHours} hours of continuous task demand. Forecasts indicate that ${weatherWindow}.`,
    `A ${context.startHours}-hour warning period precedes the first commitment; once it begins, protection and sensing must persist for ${context.durationHours} hours. At the same time, ${weatherWindow}.`,
    `Planning, staging, and classification must finish within ${context.startHours} hours. The force then carries the main burden for about ${context.durationHours} hours while ${weatherWindow}.`,
    `There are ${context.startHours} hours to shape the operating picture and no reliable pause during the following ${context.durationHours}-hour task window. Weather will matter because ${weatherWindow}.`,
  ], random);
}

function scenarioCalendarDate(region: Region, season: Season, exerciseId: number, random: () => number) {
  const northMonth: Record<Exclude<Season, "wet" | "dry">, number> = { winter: 11, spring: 4, summer: 8, autumn: 10 };
  const southMonth: Record<Exclude<Season, "wet" | "dry">, number> = { winter: 5, spring: 10, summer: 2, autumn: 4 };
  const month = season === "wet"
    ? (region.hemisphere === "north" ? 5 : 11)
    : season === "dry"
      ? (region.hemisphere === "north" ? 1 : 7)
      : (region.hemisphere === "north" ? northMonth : southMonth)[season];
  const year = 2028 + exerciseId % 5;
  const day = integer(6, 22, random);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function precipitationChance(region: Region, season: Season) {
  if (region.equatorial) return season === "wet" ? 0.91 : 0.38;
  if (region.climate !== "ocean") return { winter: 0.78, spring: 0.58, summer: 0.39, autumn: 0.72 }[season as Exclude<Season, "wet" | "dry">];
  return { winter: 0.75, spring: 0.62, summer: 0.48, autumn: 0.73 }[season as Exclude<Season, "wet" | "dry">];
}

function stormChance(region: Region, season: Season) {
  if (region.equatorial) return season === "wet" ? 0.5 : 0.16;
  if (region.climate !== "ocean") return { winter: 0.4, spring: 0.23, summer: 0.13, autumn: 0.36 }[season as Exclude<Season, "wet" | "dry">];
  return { winter: 0.44, spring: 0.29, summer: 0.2, autumn: 0.46 }[season as Exclude<Season, "wet" | "dry">];
}

export type ScenarioEnvironment = Pick<Scenario,
  "regionId" | "hemisphere" | "observerLatitude" | "observerLongitude" | "scenarioDate" |
  "season" | "storming" | "lightningCapable" | "windHeading" | "windSpeed" |
  "currentHeading" | "currentSpeed" | "waveHeading" | "soundProfile"
>;

function deterministicRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function deriveScenarioEnvironment(input: { id: number; region: string; climate: Climate }): ScenarioEnvironment {
  const region = REGIONS.find((item) => item.label === input.region)
    ?? REGIONS.find((item) => item.climate === input.climate)
    ?? REGIONS[0];
  const random = deterministicRandom(input.id * 7919 + region.id.length * 104729);
  const season = region.equatorial ? pick<Season>(["wet", "dry"], random) : pick<Season>(["winter", "spring", "summer", "autumn"], random);
  const storming = random() < stormChance(region, season);
  const windHeading = variedHeading(region.prevailingWind, storming ? 62 : 38, random);
  const windSpeed = storming ? integer(30, 48, random) : integer(input.climate === "ocean" ? 8 : 10, input.climate === "ocean" ? 27 : 31, random);
  const currentHeading = variedHeading(region.prevailingCurrent, 24, random);
  const currentSpeed = Math.round((region.currentSpeed[0] + random() * (region.currentSpeed[1] - region.currentSpeed[0])) * 10) / 10;
  return {
    regionId: region.id,
    hemisphere: region.hemisphere,
    observerLatitude: region.latitude,
    observerLongitude: region.longitude,
    scenarioDate: scenarioCalendarDate(region, season, input.id, random),
    season,
    storming,
    lightningCapable: storming && input.climate === "ocean" && (season === "wet" || season === "summer" || season === "autumn"),
    windHeading,
    windSpeed,
    currentHeading,
    currentSpeed,
    waveHeading: combinedWaveHeading(windHeading, windSpeed, currentHeading, currentSpeed),
    soundProfile: region.soundProfile,
  };
}

const ILLICIT_NETWORK_FRAMES: Readonly<Record<IllicitNetworkType, {
  label: string;
  protectedInterest: string;
  evidence: string;
  handoff: string;
}>> = {
  "trafficking-in-persons": {
    label: "trafficking in persons",
    protectedInterest: "protect people from coercion and exploitation without treating irregular movement as culpability",
    evidence: "survivor accounts, control indicators, manifests, financial links, and corroborated transfer patterns",
    handoff: "protected survivor care and an accountable civil investigation",
  },
  "forced-labor": {
    label: "forced-labor exploitation at sea",
    protectedInterest: "protect workers whose freedom, pay, documents, or movement may be controlled",
    evidence: "labor conditions, document control, recruitment debt, pay records, safety reports, and corroborated testimony",
    handoff: "worker protection, labor inspection, and an accountable civil investigation",
  },
  arms: {
    label: "illicit arms movement",
    protectedInterest: "protect lawful traffic while preventing material support from reaching organized violence",
    evidence: "cargo records, custody anomalies, route changes, financial links, and legally authorized inspection findings",
    handoff: "safe custody, evidence preservation, and the competent civil authority",
  },
  "controlled-contraband": {
    label: "controlled-contraband movement",
    protectedInterest: "disrupt a harmful supply network without profiling crews, passengers, or ordinary coastal trade",
    evidence: "lawful cargo inspection, manifests, packaging evidence, financial links, and corroborated network reporting",
    handoff: "safe evidence custody and the competent health, customs, or civil authority",
  },
  wildlife: {
    label: "trafficking in protected wildlife",
    protectedInterest: "protect living cargo, ecosystems, crews, and lawful subsistence activity",
    evidence: "species expertise, permits, welfare observations, custody records, and corroborated route reporting",
    handoff: "specialist animal care, evidence preservation, and environmental authorities",
  },
  "cultural-property": {
    label: "trafficking in cultural property",
    protectedInterest: "protect cultural heritage and lawful trade without assuming that origin or appearance proves theft",
    evidence: "provenance records, custody gaps, specialist assessment, financial links, and corroborated loss reports",
    handoff: "protected storage, provenance review, and the competent cultural authority",
  },
  "stolen-goods": {
    label: "movement of stolen goods",
    protectedInterest: "interrupt a resale and transport network while preserving lawful commerce and due process",
    evidence: "ownership records, serial or cargo data, custody gaps, financial links, and authorized inspection findings",
    handoff: "evidence custody, owner-protection procedures, and an accountable civil investigation",
  },
  "sanctions-evasion": {
    label: "sanctions-evasion logistics",
    protectedInterest: "enforce only applicable authority while protecting neutral commerce and avoiding guilt by association",
    evidence: "ownership and insurance records, cargo documentation, transfer patterns, financial links, and jurisdiction-specific authority",
    handoff: "documented civil, customs, and financial review under the applicable authority",
  },
  mixed: {
    label: "a mixed illicit maritime network",
    protectedInterest: "separate distinct harms, authorities, and protection duties rather than treating every suspicious movement as the same offence",
    evidence: "category-specific indicators, custody records, financial links, protected testimony, and independently corroborated observations",
    handoff: "separate specialist care, evidence, customs, and civil-authority pathways",
  },
};

const SCENARIO_COEXISTENCE_FACETS = [
  "identity",
  "region-climate",
  "season-date",
  "weather-cloud-precipitation",
  "sea-wind-current-visibility",
  "aurora-celestial",
  "mission-geography-objective",
  "forces",
  "difficulty-matrix",
  "narrative",
] as const satisfies readonly ScenarioCoexistenceFacet[];

const VALID_TIMES: readonly TimeOfDay[] = ["dawn", "day", "dusk", "night"];
const VALID_CLOUDS: readonly Clouds[] = ["clear", "scattered", "broken", "overcast"];
const VALID_PRECIPITATION: readonly Precipitation[] = ["none", "rain", "snow"];
const POLAR_SEASONS: readonly Season[] = ["winter", "spring", "summer", "autumn"];
const EQUATORIAL_SEASONS: readonly Season[] = ["wet", "dry"];

type MissionThreatPair = { mission: Mission; threat: Threat };

function sameOrderedValues<T>(left: readonly T[], right: readonly T[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameSet<T>(left: readonly T[], right: readonly T[]) {
  return left.length === right.length && left.every((value) => right.includes(value));
}

function missionThreatPairsForScenario(scenario: Scenario): MissionThreatPair[] {
  const pairs: MissionThreatPair[] = [];
  for (const mission of MISSIONS) {
    for (const threat of THREATS.filter((item) => mission.threatKeys.includes(item.key))) {
      const required = unique([...mission.required, ...threat.required]);
      const recommended = unique([...mission.recommended, ...threat.recommended]).filter((item) => !required.includes(item));
      if (scenario.endState !== mission.endState
        || scenario.guardrail !== mission.guardrail
        || !sameOrderedValues(scenario.lenses, mission.lenses)
        || !sameSet(scenario.required, required)
        || !sameSet(scenario.recommended, recommended)
        || scenario.minimumEscort !== mission.minimumEscort
        || scenario.minimumAirDefense !== Math.max(mission.minimumAirDefense, threat.key === "missile" ? 2 : 0)
        || scenario.minimumAsw !== mission.minimumAsw + (threat.key === "subsurface" ? 1 : 0)
        || scenario.minimumUncrewed !== mission.minimumUncrewed + (threat.key === "mines" || threat.key === "electromagnetic" ? 2 : 0)) continue;
      pairs.push({ mission, threat });
    }
  }
  return pairs;
}

function expectedSeasonMonth(season: Season, hemisphere: Hemisphere) {
  const northern: Readonly<Record<Season, number>> = { winter: 11, spring: 4, summer: 8, autumn: 10, wet: 5, dry: 1 };
  const southern: Readonly<Record<Season, number>> = { winter: 5, spring: 10, summer: 2, autumn: 4, wet: 11, dry: 7 };
  return (hemisphere === "north" ? northern : southern)[season];
}

function expectedAdversaryCount(exerciseId: number) {
  const roll = (((exerciseId + 1) * 2654435761) >>> 0) / 4294967296;
  return roll < 0.16 ? 3 : roll < 0.54 ? 2 : 1;
}

function narrativeFrame(value: string) {
  return value.toLocaleLowerCase().replace(/\d+(?:\.\d+)?/gu, "#").replace(/\s+/gu, " ").trim();
}

/**
 * Pure whole-scenario validation. A candidate is never considered presentable
 * merely because each field is individually well typed: all coupled facets
 * must describe one mutually possible environment and strategic problem.
 */
export function validateScenarioCoexistence(scenario: Scenario): ScenarioCoexistenceValidation {
  const issues: ScenarioCoexistenceIssue[] = [];
  const issue = (facet: ScenarioCoexistenceFacet, code: string, message: string) => issues.push({ facet, code, message });
  const region = REGIONS.find((item) => item.id === scenario.regionId);
  const pairs = missionThreatPairsForScenario(scenario);

  if (!Number.isInteger(scenario.id) || scenario.id < 1) issue("identity", "exercise-id", "Exercise identity must be a positive integer.");
  const operationParts = scenario.operation.trim().split(/\s+/u);
  if (operationParts.length !== 2
    || !OPERATION_ADJECTIVES.includes(operationParts[0] as typeof OPERATION_ADJECTIVES[number])
    || !OPERATION_NOUNS.includes(operationParts[1] as typeof OPERATION_NOUNS[number])) {
    issue("identity", "operation-name", "Operation name must be composed from one validated adjective and noun.");
  }

  if (!region) {
    issue("region-climate", "unknown-region", "Region identity is not part of the geographic model.");
  } else {
    if (scenario.region !== region.label || scenario.climate !== region.climate) issue("region-climate", "region-climate", "Region label and climate must identify the same modeled place.");
    if (scenario.hemisphere !== region.hemisphere
      || scenario.observerLatitude !== region.latitude
      || scenario.observerLongitude !== region.longitude
      || scenario.soundProfile !== region.soundProfile) {
      issue("region-climate", "observer-region", "Observer, hemisphere, and acoustic profile must belong to the selected region.");
    }
    if ((region.equatorial && !EQUATORIAL_SEASONS.includes(scenario.season))
      || (!region.equatorial && !POLAR_SEASONS.includes(scenario.season))) {
      issue("season-date", "regional-season", "Season vocabulary must match the selected climatic region.");
    }
  }

  const date = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(scenario.scenarioDate);
  if (!date
    || Number(date[1]) !== 2028 + scenario.id % 5
    || Number(date[2]) !== expectedSeasonMonth(scenario.season, scenario.hemisphere)
    || Number(date[3]) < 6
    || Number(date[3]) > 22) {
    issue("season-date", "season-date", "Calendar year, month, and bounded day must coexist with the exercise identity, hemisphere, and season.");
  }

  if (!VALID_TIMES.includes(scenario.time)) issue("aurora-celestial", "time-of-day", "Celestial time must be dawn, day, dusk, or night.");
  if ((scenario.hemisphere === "north" && scenario.observerLatitude < 0)
    || (scenario.hemisphere === "south" && scenario.observerLatitude > 0)
    || scenario.observerLatitude < -90 || scenario.observerLatitude > 90
    || scenario.observerLongitude < -180 || scenario.observerLongitude > 180) {
    issue("aurora-celestial", "celestial-observer", "Celestial and auroral calculations require a valid observer in the declared hemisphere.");
  }

  if (!VALID_CLOUDS.includes(scenario.clouds) || !VALID_PRECIPITATION.includes(scenario.precipitation)) {
    issue("weather-cloud-precipitation", "weather-enum", "Cloud and precipitation regimes must be recognized.");
  }
  if ((scenario.climate === "ocean" && scenario.precipitation === "snow")
    || (scenario.climate !== "ocean" && scenario.precipitation === "rain")) {
    issue("weather-cloud-precipitation", "climate-precipitation", "Rain belongs to modeled ocean regions and snow to modeled polar regions.");
  }
  if (scenario.precipitation !== "none" && !["broken", "overcast"].includes(scenario.clouds)) {
    issue("weather-cloud-precipitation", "precipitation-clouds", "Precipitation requires broken or overcast cloud cover.");
  }
  const supportsLightning = scenario.storming
    && scenario.climate === "ocean"
    && ["wet", "summer", "autumn"].includes(scenario.season);
  if (scenario.lightningCapable !== supportsLightning) issue("weather-cloud-precipitation", "lightning", "Lightning capability must follow storm, climate, and season together.");
  if (scenario.storming && (scenario.precipitation === "none"
    || scenario.clouds !== "overcast"
    || scenario.seaState < 5 || scenario.seaState > 7
    || scenario.visibility < 2 || scenario.visibility > 4
    || scenario.windSpeed < 30 || scenario.windSpeed > 48)) {
    issue("weather-cloud-precipitation", "storm-regime", "A storm requires precipitation, overcast sky, high sea state, low visibility, and storm-force wind together.");
  }
  if (!scenario.storming) {
    const minimumWind = scenario.climate === "ocean" ? 8 : 10;
    const maximumWind = scenario.climate === "ocean" ? 27 : 31;
    const maximumSea = scenario.climate === "ocean" ? 6 : 5;
    const expectedSeaState = Math.max(1, Math.min(maximumSea, Math.round(scenario.windSpeed / 6)));
    if (scenario.windSpeed < minimumWind || scenario.windSpeed > maximumWind || scenario.seaState !== expectedSeaState) {
      issue("sea-wind-current-visibility", "wind-sea-state", "Non-storm wind and sea state must remain within the climate-specific coupled range.");
    }
    const visibilityRange: readonly [number, number] = scenario.precipitation === "none" ? [7, 11] : [3, 6];
    if (scenario.visibility < visibilityRange[0] || scenario.visibility > visibilityRange[1]) {
      issue("sea-wind-current-visibility", "weather-visibility", "Visibility must match the active precipitation and storm regime.");
    }
  }
  if (region) {
    if (!Number.isInteger(scenario.windHeading) || scenario.windHeading < 0 || scenario.windHeading >= 360
      || !Number.isInteger(scenario.currentHeading) || scenario.currentHeading < 0 || scenario.currentHeading >= 360
      || scenario.currentSpeed < region.currentSpeed[0] || scenario.currentSpeed > region.currentSpeed[1]
      || Math.abs(scenario.currentSpeed * 10 - Math.round(scenario.currentSpeed * 10)) > 1e-8) {
      issue("sea-wind-current-visibility", "wind-current", "Wind and current headings and regional current speed must remain physically bounded.");
    }
    if (scenario.waveHeading !== combinedWaveHeading(scenario.windHeading, scenario.windSpeed, scenario.currentHeading, scenario.currentSpeed)) {
      issue("sea-wind-current-visibility", "wave-vector", "Wave direction must be the disclosed combination of wind and current.");
    }
  }

  if (!pairs.length) {
    issue("mission-geography-objective", "mission-threat-objective", "Mission, threat, objective, theory, guardrail, and capability requirements do not form a supported strategic problem.");
    issue("forces", "force-minimums", "Force minimums must be derived from one compatible mission and threat pair.");
  } else {
    if (!pairs.some(({ mission }) => mission.politicalAims.includes(scenario.politicalAim))) issue("mission-geography-objective", "political-aim", "Political aim must belong to the synthesized mission family.");
    if (!pairs.some(({ mission }) => mission.navalProblems.includes(scenario.navalProblem))) issue("mission-geography-objective", "theory-problem", "The comparative theory problem must belong to the synthesized mission family.");
    if (!pairs.some(({ threat }) => threat.briefPressure.some((clause) => scenario.brief.includes(clause)))) issue("mission-geography-objective", "threat-pressure", "Mission brief must contain the selected compatible threat pressure.");
    if (!pairs.some(({ threat }) => threat.intelligence.some((clause) => scenario.intelligence.includes(clause)))) issue("mission-geography-objective", "intelligence-threat", "Intelligence must concern the selected compatible threat.");
    const requiresIllicitCategory = pairs.every(({ mission }) => mission.key === "anti-trafficking-safeguarding");
    const permitsIllicitCategory = pairs.some(({ mission }) => mission.key === "anti-trafficking-safeguarding");
    if ((requiresIllicitCategory && scenario.illicitNetworkType === undefined)
      || (!permitsIllicitCategory && scenario.illicitNetworkType !== undefined)) {
      issue("mission-geography-objective", "illicit-category", "An illicit-network category appears only when the mission's authority and protection duties require it.");
    }
  }
  if (region && (!region.terrain.some((clause) => scenario.geography.includes(clause))
    || !region.navigation.some((clause) => scenario.geography.includes(clause)))) {
    issue("mission-geography-objective", "geography", "Geography must combine terrain and navigation from the same selected region.");
  }
  if (scenario.budget !== 100 || !scenario.required.includes("reconnaissance")
    || new Set(scenario.required).size !== scenario.required.length
    || new Set(scenario.recommended).size !== scenario.recommended.length
    || scenario.recommended.some((area) => scenario.required.includes(area))) {
    issue("forces", "force-requirements", "Budget, required coverage, and recommended coverage must remain unique, non-overlapping, and catalog-oriented.");
  }

  const adversaryCount = scenario.adversaryCount;
  if (adversaryCount !== expectedAdversaryCount(scenario.id)) {
    issue("difficulty-matrix", "actor-count", "Opposing actor count must be deterministic for the exercise identity.");
  }
  if (!scenario.matrix || !isScenarioMatrix(scenario.matrix)) {
    issue("difficulty-matrix", "matrix-shape", "A generated scenario requires one valid precommitted difficulty matrix.");
  } else if (region) {
    const canonicalMatrix = createScenarioMatrix({
      exerciseId: scenario.id,
      climate: scenario.climate,
      regionId: scenario.regionId,
      season: scenario.season,
      adversaryCount,
    });
    if (JSON.stringify(scenario.matrix) !== JSON.stringify(canonicalMatrix)) issue("difficulty-matrix", "matrix-replay", "Difficulty branches and committed draws must replay exactly from the accepted scenario identity.");
    if (adversaryCount === 1 && scenario.matrix.opponentCoordination !== "none") issue("difficulty-matrix", "single-actor-coordination", "One opposing actor cannot create an inter-actor cooperation frame.");
    if (scenario.illicitNetworkType !== undefined && scenario.illicitNetworkType !== scenario.matrix.illicitNetworkType) issue("difficulty-matrix", "illicit-matrix", "Mission and matrix must name the same illicit-network category.");
  }

  const narrativeValues = [
    scenario.brief, scenario.geography, scenario.friendlySituation, scenario.opposingSituation,
    scenario.civilianContext, scenario.constraints, scenario.timing, scenario.successConditions,
    scenario.navalProblem, scenario.objective, scenario.intelligence, scenario.history, scenario.politicalAim,
  ];
  if (narrativeValues.some((value) => typeof value !== "string" || value.trim().length < 24)) issue("narrative", "thin-field", "Every presented scenario field must contain substantive text.");
  if (new Set(narrativeValues.map(narrativeFrame)).size !== narrativeValues.length) issue("narrative", "duplicate-field", "Scenario fields must not repeat the same structural statement.");

  const auroraEnvironmentEligible = Boolean(region)
    && (Math.abs(scenario.observerLatitude) >= 55 || scenario.climate !== "ocean")
    && scenario.time !== "day"
    && scenario.precipitation === "none"
    && scenario.clouds !== "overcast"
    && !scenario.storming;
  const firstPair = pairs[0];
  return {
    valid: issues.length === 0,
    issues,
    checkedFacets: SCENARIO_COEXISTENCE_FACETS,
    derived: {
      missionFamily: firstPair?.mission.key ?? null,
      threatFamily: firstPair?.threat.key ?? null,
      auroraEnvironmentEligible,
    },
  };
}

function createScenarioCandidate(exerciseId: number, random: () => number): Scenario {
  // Mission families are compositional building blocks, not a finite scenario
  // catalog. The stable coastal cadence prevents rare safeguarding content
  // from disappearing in small samples; every internal clause and every other
  // facet is regenerated before whole-candidate validation.
  const legacyMission = pick(MISSIONS.slice(0, 8), random);
  const coastalIndex = exerciseId % 10;
  const mission = coastalIndex === 8 ? MISSIONS[8] : coastalIndex === 9 ? MISSIONS[9] : legacyMission;
  const climate = pick<Climate>(["ocean", "arctic", "antarctic"], random);
  const region = pick(REGIONS.filter((item) => item.climate === climate), random);
  const threat = pick(THREATS.filter((item) => mission.threatKeys.includes(item.key)), random);
  const time = pick<TimeOfDay>(["dawn", "day", "dusk", "night"], random);
  const season = pick<Season>(region.equatorial ? EQUATORIAL_SEASONS : POLAR_SEASONS, random);
  const storming = unitDraw(random) < stormChance(region, season);
  const precipitation = storming || unitDraw(random) < precipitationChance(region, season) ? (climate === "ocean" ? "rain" : "snow") : "none";
  const clouds = storming ? "overcast" : pick<Clouds>(precipitation === "none" ? ["clear", "scattered", "broken"] : ["broken", "overcast"], random);
  const windHeading = variedHeading(region.prevailingWind, storming ? 62 : 38, random);
  const windSpeed = storming ? integer(30, 48, random) : integer(climate === "ocean" ? 8 : 10, climate === "ocean" ? 27 : 31, random);
  const currentHeading = variedHeading(region.prevailingCurrent, 24, random);
  const currentSpeed = Math.round((region.currentSpeed[0] + unitDraw(random) * (region.currentSpeed[1] - region.currentSpeed[0])) * 10) / 10;
  const waveHeading = combinedWaveHeading(windHeading, windSpeed, currentHeading, currentSpeed);
  const seaState = storming ? integer(5, 7, random) : Math.max(1, Math.min(climate === "ocean" ? 6 : 5, Math.round(windSpeed / 6)));
  const visibility = storming ? integer(2, 4, random) : precipitation === "none" ? integer(7, 11, random) : integer(3, 6, random);
  const lightningCapable = storming && climate === "ocean" && (season === "wet" || season === "summer" || season === "autumn");
  const scenarioDate = scenarioCalendarDate(region, season, exerciseId, random);
  // Actor plurality is derived independently of the selected play mode and
  // force scale. The matrix uses it only to prevent impossible one-actor
  // "cooperation" frames.
  const adversaryCount = expectedAdversaryCount(exerciseId);
  const matrix = createScenarioMatrix({ exerciseId, climate, regionId: region.id, season, adversaryCount });
  const distance = integer(34, 680, random);
  const width = integer(3, 12, random);
  const friendlyCount = integer(4, 9, random);
  const startHours = integer(2, 10, random);
  const durationHours = integer(4, 11, random);
  const context: MissionContext = {
    distance,
    width,
    friendlyCount,
    startHours,
    durationHours,
    threatPressure: pick(threat.briefPressure, random),
  };
  const weatherWindow = describeWeatherWindow({ precipitation, storming, clouds, windSpeed, currentSpeed, waveHeading }, random);
  const required = unique([...mission.required, ...threat.required]);
  const recommended = unique([...mission.recommended, ...threat.recommended]).filter((item) => !required.includes(item));
  const operation = `${pick(OPERATION_ADJECTIVES, random)} ${pick(OPERATION_NOUNS, random)}`;
  const coordinationFrame = {
    none: "are not currently assessed to share timing or information",
    opportunistic: "can coordinate opportunistically while retaining different thresholds and aims",
    selective: "can coordinate selectively while retaining different thresholds and aims",
    integrated: "can use integrated timing and information while retaining different thresholds and aims",
  }[matrix.opponentCoordination];
  const opposingSituation = `${adversaryCount === 1 ? "One opposing actor is assessed." : `${adversaryCount} distinct opposing actors ${coordinationFrame}.`} ${pick(threat.opposing, random)}`;
  const illicitFrame = ILLICIT_NETWORK_FRAMES[matrix.illicitNetworkType];
  const illicitMission = mission.key === "anti-trafficking-safeguarding";

  return {
    id: exerciseId,
    operation,
    region: region.label,
    climate,
    time,
    clouds,
    precipitation,
    seaState,
    visibility,
    regionId: region.id,
    hemisphere: region.hemisphere,
    observerLatitude: region.latitude,
    observerLongitude: region.longitude,
    scenarioDate,
    season,
    storming,
    lightningCapable,
    windHeading,
    windSpeed,
    currentHeading,
    currentSpeed,
    waveHeading,
    soundProfile: region.soundProfile,
    budget: 100,
    brief: `${pick(mission.briefs, random)(context)}${illicitMission ? ` The current assessment concerns ${illicitFrame.label}; the plan must ${illicitFrame.protectedInterest}.` : ""} ${pick(STRATEGIC_TRANSITIONS, random)}`,
    geography: describeGeography(region, context, random),
    friendlySituation: pick(mission.friendlies, random)(context),
    opposingSituation: `${opposingSituation}${illicitMission ? ` The assessed network may move ${illicitFrame.label}; that category changes the relevant harms and authority, and no single indicator establishes it.` : ""}`,
    adversaryCount,
    matrix,
    illicitNetworkType: illicitMission ? matrix.illicitNetworkType : undefined,
    civilianContext: `${pick(CIVILIAN_CONTEXTS, random)}${illicitMission ? ` Category-specific protection requires ${illicitFrame.handoff}.` : ""}`,
    constraints: `${pick(mission.constraints, random)(context)} ${pick(GUARDRAIL_LIMITS[mission.guardrail], random)}${illicitMission ? ` Decisions must distinguish ${illicitFrame.label} from other illicit activity and rely on ${illicitFrame.evidence}.` : ""}`,
    timing: describeTiming(context, weatherWindow, random),
    successConditions: `${pick(mission.successes, random)(context)}${illicitMission ? ` The result also preserves ${illicitFrame.handoff} and does not displace the network without reducing the identified harm.` : ""}`,
    navalProblem: pick(mission.navalProblems, random),
    objective: `${pick(mission.objectives, random)(context)} ${pick(END_STATE_TESTS[mission.endState], random)}`,
    intelligence: `${pick(threat.intelligence, random)} ${pick(UNCERTAINTY_QUALIFIERS, random)}`,
    history: `${pick(mission.histories, random)}; ${pick(CLIMATE_HISTORY[climate], random)}`,
    required,
    recommended,
    minimumEscort: mission.minimumEscort,
    minimumAirDefense: Math.max(mission.minimumAirDefense, threat.key === "missile" ? 2 : 0),
    minimumAsw: mission.minimumAsw + (threat.key === "subsurface" ? 1 : 0),
    minimumUncrewed: mission.minimumUncrewed + (threat.key === "mines" || threat.key === "electromagnetic" ? 2 : 0),
    politicalAim: pick(mission.politicalAims, random),
    endState: mission.endState,
    lenses: mission.lenses,
    guardrail: mission.guardrail,
  };
}

export const SCENARIO_SYNTHESIS_MAX_ATTEMPTS = 32;

export type ScenarioSynthesisResult = {
  scenario: Scenario;
  candidateAttempts: number;
  usedConstructiveFallback: boolean;
};

/**
 * Iteratively composes and validates whole candidates. Every rejection consumes
 * a fresh candidate's entropy. After the fixed attempt budget, a deterministic
 * constructive candidate prevents an impossible or unbounded result; that
 * fallback must still pass the exact same whole-scenario validator.
 */
export function synthesizeScenario(previousId: number, random: () => number = Math.random): ScenarioSynthesisResult {
  const exerciseId = previousId + 1;
  for (let attempt = 1; attempt <= SCENARIO_SYNTHESIS_MAX_ATTEMPTS; attempt += 1) {
    try {
      const scenario = createScenarioCandidate(exerciseId, random);
      if (validateScenarioCoexistence(scenario).valid) {
        return { scenario, candidateAttempts: attempt, usedConstructiveFallback: false };
      }
    } catch {
      // An entropy provider can fail, but generation remains bounded and the
      // validated deterministic fallback never incorporates partial output.
    }
  }

  const fallbackRandom = deterministicRandom((exerciseId * 2654435761 + 0x5ea51ce) >>> 0);
  const scenario = createScenarioCandidate(exerciseId, fallbackRandom);
  const validation = validateScenarioCoexistence(scenario);
  if (!validation.valid) {
    throw new Error(`Constructive scenario invariant failed: ${validation.issues.map((item) => `${item.code}: ${item.message}`).join(" | ")}`);
  }
  return {
    scenario,
    candidateAttempts: SCENARIO_SYNTHESIS_MAX_ATTEMPTS,
    usedConstructiveFallback: true,
  };
}

export function generateScenario(previousId: number, random: () => number = Math.random): Scenario {
  return synthesizeScenario(previousId, random).scenario;
}
