import type { Climate, Difficulty, Season } from "./gameModel";

export type EnvironmentalHazardKind = "severe-weather" | "tsunami";
export type EnvironmentalHazardMechanics = {
  availabilityMultiplier: number;
  permanentLossFraction: number;
  opposingPressureMultiplier: number;
};

/**
 * Canonical, committed model truth. Renderers receive a separately derived
 * presentation and must never infer this state from sea height or weather.
 */
export type EnvironmentalHazardState = {
  id: string;
  kind: EnvironmentalHazardKind;
  startsTurn: number;
  endsTurn: number;
  minimumDifficulty: Difficulty;
  intensity: "major" | "extreme";
  affectedDomains: readonly ("surface" | "air" | "subsurface" | "communications")[];
  mechanics: EnvironmentalHazardMechanics;
  /** Signed, bounded N-wave phases. Meaning remains available without motion or color. */
  nWave?: readonly [number, number, number];
};

const LEVEL: Readonly<Record<Difficulty, number>> = { guided: 0, standard: 1, challenge: 2 };

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomFrom(seed: number) {
  let state = seed >>> 0;
  return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
}

export function createEnvironmentalHazardTimeline(input: {
  exerciseId: number;
  climate: Climate;
  regionId: string;
  season: Season;
  weatherStartsTurn: number;
  weatherEndsTurn: number;
  weatherExtreme: boolean;
  weatherMinimumDifficulty: Difficulty;
}): EnvironmentalHazardState[] {
  const weather: EnvironmentalHazardState = {
    id: "hazard-weather-window",
    kind: "severe-weather",
    startsTurn: input.weatherStartsTurn,
    endsTurn: input.weatherEndsTurn,
    minimumDifficulty: input.weatherMinimumDifficulty,
    intensity: input.weatherExtreme ? "extreme" : "major",
    affectedDomains: input.climate === "ocean"
      ? ["air", "surface", "communications"]
      : ["air", "surface", "subsurface", "communications"],
    mechanics: {
      availabilityMultiplier: input.weatherExtreme ? 0.64 : 0.78,
      permanentLossFraction: input.weatherExtreme ? 0.08 : 0,
      opposingPressureMultiplier: input.weatherExtreme ? 0.72 : 0.84,
    },
  };
  const random = randomFrom(hashText(`${input.exerciseId}|${input.climate}|${input.regionId}|${input.season}|tsunami-v1`));
  if (input.climate !== "ocean" || random() >= 0.08) return [weather];
  const startsTurn = 2 + Math.floor(random() * 4);
  const amplitude = Math.round((0.55 + random() * 0.35) * 100) / 100;
  return [weather, {
    id: "hazard-tsunami-window",
    kind: "tsunami",
    startsTurn,
    endsTurn: Math.min(6, startsTurn + 1),
    minimumDifficulty: "challenge",
    intensity: amplitude >= 0.76 ? "extreme" : "major",
    affectedDomains: ["surface", "subsurface", "communications"],
    mechanics: {
      availabilityMultiplier: amplitude >= 0.76 ? 0.58 : 0.7,
      permanentLossFraction: amplitude >= 0.76 ? 0.1 : 0.04,
      opposingPressureMultiplier: amplitude >= 0.76 ? 0.68 : 0.78,
    },
    nWave: [-amplitude, amplitude, -Math.round(amplitude * 0.42 * 100) / 100],
  }];
}

export function activeEnvironmentalHazards(
  timeline: readonly EnvironmentalHazardState[],
  difficulty: Difficulty,
  turn: number,
) {
  return timeline.filter((hazard) => LEVEL[hazard.minimumDifficulty] <= LEVEL[difficulty]
    && hazard.startsTurn <= turn && hazard.endsTurn >= turn);
}

export function environmentalHazardsForDifficulty(
  timeline: readonly EnvironmentalHazardState[],
  difficulty: Difficulty,
) {
  return timeline.filter((hazard) => LEVEL[hazard.minimumDifficulty] <= LEVEL[difficulty]);
}

export function isEnvironmentalHazardState(value: unknown): value is EnvironmentalHazardState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const own = (key: string) => Object.prototype.hasOwnProperty.call(value, key)
    ? Object.getOwnPropertyDescriptor(value, key)
    : undefined;
  const data = (key: string) => {
    const descriptor = own(key);
    return descriptor && "value" in descriptor ? descriptor.value : undefined;
  };
  const mechanics = data("mechanics");
  if (!mechanics || typeof mechanics !== "object" || Array.isArray(mechanics)) return false;
  const mechanic = (key: string) => {
    const descriptor = Object.prototype.hasOwnProperty.call(mechanics, key)
      ? Object.getOwnPropertyDescriptor(mechanics, key) : undefined;
    return descriptor && "value" in descriptor ? descriptor.value : undefined;
  };
  const kind = data("kind");
  const nWave = data("nWave");
  return typeof data("id") === "string"
    && (kind === "severe-weather" || kind === "tsunami")
    && Number.isInteger(data("startsTurn")) && data("startsTurn") >= 1 && data("startsTurn") <= 6
    && Number.isInteger(data("endsTurn")) && data("endsTurn") >= data("startsTurn") && data("endsTurn") <= 6
    && ["guided", "standard", "challenge"].includes(String(data("minimumDifficulty")))
    && ["major", "extreme"].includes(String(data("intensity")))
    && Array.isArray(data("affectedDomains")) && data("affectedDomains").length > 0
    && data("affectedDomains").every((item: unknown) => ["surface", "air", "subsurface", "communications"].includes(String(item)))
    && [mechanic("availabilityMultiplier"), mechanic("opposingPressureMultiplier")].every((item) => typeof item === "number" && Number.isFinite(item) && item >= 0.5 && item <= 1)
    && typeof mechanic("permanentLossFraction") === "number" && mechanic("permanentLossFraction") >= 0 && mechanic("permanentLossFraction") <= 0.5
    && (kind === "tsunami"
      ? Array.isArray(nWave) && nWave.length === 3 && nWave.every((item: unknown) => typeof item === "number" && Number.isFinite(item) && Math.abs(item) <= 1) && nWave[0] < 0 && nWave[1] > 0 && nWave[2] < 0
      : nWave === undefined);
}
