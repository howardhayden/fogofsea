import type { Climate, EndState, Scenario, Season, SoundProfile, TimeOfDay, Warfare } from "./gameModel";

export type FleetMethod = "fleet-action" | "commerce-pressure";
export type InitiativePosture = "offensive" | "defensive";
export type UncrewedDoctrine = "distributed-scouting" | "deception-swarm" | "attritable-massing" | "autonomous-lane-control";
export type UnderseaDoctrine = "independent-patrol" | "coordinated-wolfpack" | "barrier-ambush" | "protective-screen";

export type OperationalStrategyInput = {
  id: number;
  regionId?: string;
  climate: Climate;
  season?: Season;
  time: TimeOfDay;
  soundProfile?: SoundProfile;
  storming?: boolean;
  seaState: number;
  visibility: number;
  endState?: EndState;
  required: readonly Warfare[];
  recommended: readonly Warfare[];
};

export type OperationalStrategy = {
  friendlyMethod: FleetMethod;
  friendlyPosture: InitiativePosture;
  opposingMethod: FleetMethod;
  opposingPosture: InitiativePosture;
  recommendedUncrewed: UncrewedDoctrine;
  recommendedUndersea: UnderseaDoctrine;
  environmentEffects: string[];
  summary: string;
};

const RESTRICTED_REGIONS = new Set(["equatorial-convergence", "temperate-strait"]);
const POLAR_PROFILES = new Set<SoundProfile>(["boreal-ice", "polar-archipelago", "southern-ice", "austral-corridor"]);

export const FLEET_METHOD_LABELS: Record<FleetMethod, string> = {
  "fleet-action": "Fleet action (guerre d’escadre)",
  "commerce-pressure": "Communications pressure (guerre de course)",
};

export const POSTURE_LABELS: Record<InitiativePosture, string> = {
  offensive: "Offensive initiative",
  defensive: "Defensive preservation",
};

export const UNCREWED_DOCTRINE_OPTIONS: ReadonlyArray<{ value: UncrewedDoctrine; label: string; note: string }> = [
  { value: "distributed-scouting", label: "Distributed scouting", note: "Disperse uncrewed sensors to widen classification and relay coverage without assuming every contact is hostile." },
  { value: "deception-swarm", label: "Deception swarm", note: "Use numerous low-signature and decoy nodes to complicate attribution and draw opposing attention away from the main effort." },
  { value: "attritable-massing", label: "Attritable massing", note: "Concentrate replaceable uncrewed systems for a bounded pulse after the contact picture and political authority are adequate." },
  { value: "autonomous-lane-control", label: "Autonomous lane control", note: "Maintain persistent remote patrols, mine awareness, and local denial around a constrained route or barrier." },
];

export const UNDERSEA_DOCTRINE_OPTIONS: ReadonlyArray<{ value: UnderseaDoctrine; label: string; note: string }> = [
  { value: "independent-patrol", label: "Independent patrols", note: "Separate patrol areas reduce coordination signatures but produce slower concentration and a less complete shared picture." },
  { value: "coordinated-wolfpack", label: "Coordinated wolfpack", note: "Several undersea elements converge from distributed patrols after contact cueing; coordination improves pressure but adds communication and fratricide risk." },
  { value: "barrier-ambush", label: "Barrier ambush", note: "Place undersea sensors and effectors across a predictable route, chokepoint, or depth transition and wait for a classified contact." },
  { value: "protective-screen", label: "Protective undersea screen", note: "Prioritize early warning and exclusion around a convoy, access corridor, or high-value unit rather than pursuit." },
];

function derivePosture(endState: EndState = "denial"): InitiativePosture {
  return endState === "protection" || endState === "status-quo" || endState === "denial" ? "defensive" : "offensive";
}

function deriveMethod(input: OperationalStrategyInput, posture: InitiativePosture): FleetMethod {
  const commerceProblem = input.required.includes("reconnaissance")
    || input.required.includes("mine-countermeasures")
    || input.required.includes("maritime-interdiction")
    || input.recommended.includes("electromagnetic-operations");
  if (input.endState === "limited-compellence" || (posture === "offensive" && input.required.includes("surface-operations"))) return "fleet-action";
  if (commerceProblem || RESTRICTED_REGIONS.has(input.regionId ?? "")) return "commerce-pressure";
  return input.id % 3 === 0 ? "commerce-pressure" : "fleet-action";
}

export function deriveOperationalStrategy(input: OperationalStrategyInput | Scenario): OperationalStrategy {
  const friendlyPosture = derivePosture(input.endState);
  const friendlyMethod = deriveMethod(input, friendlyPosture);
  const opposingPosture: InitiativePosture = friendlyPosture === "offensive" ? "defensive" : "offensive";
  const opposingMethod: FleetMethod = input.id % 2 === 0 || friendlyMethod === "commerce-pressure" ? "fleet-action" : "commerce-pressure";
  const restricted = RESTRICTED_REGIONS.has(input.regionId ?? "");
  const polar = input.climate !== "ocean" || (input.soundProfile ? POLAR_PROFILES.has(input.soundProfile) : false);
  const poorAir = Boolean(input.storming) || input.seaState >= 5 || input.visibility <= 4;
  const lowLight = input.time === "night" || input.time === "dusk" || input.time === "dawn";

  const recommendedUncrewed: UncrewedDoctrine = input.required.includes("mine-countermeasures") || input.required.includes("maritime-interdiction") || restricted
    ? "autonomous-lane-control"
    : lowLight && input.required.includes("electromagnetic-operations")
      ? "deception-swarm"
      : friendlyPosture === "offensive" && !poorAir
        ? "attritable-massing"
        : "distributed-scouting";
  const recommendedUndersea: UnderseaDoctrine = input.endState === "protection" || input.endState === "status-quo"
    ? "protective-screen"
    : restricted
      ? "barrier-ambush"
      : friendlyMethod === "commerce-pressure" && input.required.includes("undersea-operations")
        ? "coordinated-wolfpack"
        : "independent-patrol";

  const environmentEffects: string[] = [];
  if (lowLight) environmentEffects.push("Low light favors passive sensing, emission discipline, and low-signature uncrewed scouts; visual classification takes longer.");
  else environmentEffects.push("Daylight improves visual classification and airborne scouting, while making exposed uncrewed routes easier to observe.");
  if (poorAir) environmentEffects.push("Heavy weather reduces small-aircraft persistence and relay reliability; sheltered, surface, and undersea autonomous systems gain relative value.");
  else environmentEffects.push("Moderate conditions support persistent airborne relays, but endurance and host capacity still constrain coverage.");
  const season = input.season ?? "summer";
  if (polar) environmentEffects.push(`${season[0].toUpperCase()}${season.slice(1)} conditions alter daylight, icing, acoustic layers, and recovery margins; redundant navigation and communications are essential.`);
  else if (season === "wet") environmentEffects.push("The wet season increases squall, clutter, and maintenance risk, rewarding dispersed sensing with local autonomy.");
  else if (season === "dry") environmentEffects.push("The dry season improves sortie regularity and visual sensing but can expose predictable patrol patterns.");
  else environmentEffects.push(`${season[0].toUpperCase()}${season.slice(1)} currents and weather windows change endurance, routing, and the timing of concentration.`);
  if (input.required.includes("maritime-interdiction")) {
    environmentEffects.push("Coastal clutter and mixed civil traffic make track continuity, corroborated identification, rescue readiness, evidence custody, and coordinated handoff more valuable than the number of contacts intercepted.");
  }

  return {
    friendlyMethod,
    friendlyPosture,
    opposingMethod,
    opposingPosture,
    recommendedUncrewed,
    recommendedUndersea,
    environmentEffects,
    summary: `${FLEET_METHOD_LABELS[friendlyMethod]} under ${POSTURE_LABELS[friendlyPosture].toLowerCase()}; opposition is assessed as ${FLEET_METHOD_LABELS[opposingMethod].toLowerCase()} under ${POSTURE_LABELS[opposingPosture].toLowerCase()}.`,
  };
}

export function uncrewedDoctrineFit(selected: UncrewedDoctrine, recommended: UncrewedDoctrine, available: number) {
  if (available <= 0) return selected === "distributed-scouting" ? -3 : -7;
  if (selected === recommended) return Math.min(8, 3 + available);
  if (available >= 4 && (selected === "distributed-scouting" || selected === "deception-swarm")) return 2;
  return -2;
}

export function underseaDoctrineFit(selected: UnderseaDoctrine, recommended: UnderseaDoctrine, underseaElements: number) {
  if (selected === "coordinated-wolfpack" && underseaElements < 2) return -8;
  if (selected === recommended) return Math.min(8, 3 + underseaElements * 2);
  if (selected === "independent-patrol" && underseaElements > 0) return 1;
  return underseaElements > 0 ? -2 : -5;
}
