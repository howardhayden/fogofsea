import { seededRandom, stableSeed } from "./viewModel";

export type EnvironmentTime = "dawn" | "day" | "dusk" | "night";
export type EnvironmentClouds = "clear" | "scattered" | "broken" | "overcast";
export type EnvironmentPrecipitation = "none" | "rain" | "snow";
export type EnvironmentClimate = "ocean" | "arctic" | "antarctic";

export const ENVIRONMENT_LIMITS = {
  maxWaveComponents: 3,
  maxFoamPatches: 42,
  maxAuroraBands: 7,
  maxFogBanks: 6,
  maxCloudMasses: 10,
  maxCloudLobes: 48,
  // The atmospheric budget is deliberately generous: even the extreme tier
  // remains one compact buffer (17,600 rain vertices or 7,200 snow points),
  // while density is high enough to read as weather rather than decoration.
  maxRainStreaks: 8800,
  maxSnowflakes: 7200,
  maxRainCurtains: 6,
  maxPrecipitationCells: 8,
  waveGridSegments: 30,
} as const;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, Number.isFinite(value) ? value : minimum));
}

function normalizedHeading(value: number) {
  return ((Number.isFinite(value) ? value : 0) % 360 + 360) % 360;
}

function headingVector(heading: number) {
  const radians = normalizedHeading(heading) * Math.PI / 180;
  return { x: Math.sin(radians), y: Math.cos(radians) };
}

function headingLabel(heading: number) {
  const directions = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];
  return directions[Math.round(normalizedHeading(heading) / 45) % directions.length];
}

export type WeatherTier = 0 | 1 | 2 | 3 | 4 | 5;
export type PrecipitationPresentation = "none" | "light" | "steady" | "heavy" | "squall" | "extreme";
export type CloudRegime = "clear" | "cumulus" | "altocumulus" | "stratocumulus" | "stratus" | "nimbostratus" | "cumulonimbus";
export type FogClassification = "clear" | "haze" | "mist" | "fog" | "dense-fog";

export type FogBankPlan = {
  x: number;
  y: number;
  z: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  opacity: number;
  phase: number;
};

export type CloudMassPlan = {
  x: number;
  y: number;
  z: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  lobes: number;
  opacity: number;
  phase: number;
  shapeSeed: number;
  yaw: number;
  pitch: number;
  breathAmplitude: number;
  breathSpeed: number;
  morphAmplitude: number;
  morphSpeed: number;
  driftScale: number;
};

export type PrecipitationCellPlan = {
  cloudIndex: number;
  x: number;
  cloudBaseY: number;
  z: number;
  spreadX: number;
  spreadZ: number;
  driftScale: number;
};

export type AtmospherePlan = {
  seed: number;
  fog: {
    classification: FogClassification;
    horizonDensity: number;
    zenithRatio: number;
    verticalFalloff: number;
    driftX: number;
    driftZ: number;
    speed: number;
    banks: FogBankPlan[];
  };
  precipitation: {
    kind: EnvironmentPrecipitation;
    presentation: PrecipitationPresentation;
    tier: WeatherTier;
    particleCount: number;
    curtainCount: number;
    fallSpeed: number;
    streakLength: number;
    opacity: number;
    particleSize: number;
    driftX: number;
    driftZ: number;
    cells: PrecipitationCellPlan[];
  };
  clouds: {
    regime: CloudRegime;
    masses: CloudMassPlan[];
    lobeCount: number;
    driftX: number;
    driftZ: number;
    speed: number;
  };
  stormLight: {
    visible: boolean;
    color: number;
    baseOpacity: number;
    peakOpacity: number;
    minCycleSeconds: number;
    phase: number;
  };
  description: string;
};

type AtmosphereInput = {
  seed: number;
  climate: EnvironmentClimate;
  time: EnvironmentTime;
  clouds: EnvironmentClouds;
  precipitation: EnvironmentPrecipitation;
  seaState: number;
  visibility: number;
  storming: boolean;
  lightningCapable: boolean;
  windHeading: number;
  windSpeed: number;
};

const PRECIPITATION_PROFILES = {
  rain: [
    { count: 0, fallSpeed: 0, streakLength: 0, opacity: 0, particleSize: 1, curtains: 0 },
    { count: 900, fallSpeed: 9, streakLength: 0.75, opacity: 0.43, particleSize: 1, curtains: 0 },
    { count: 2000, fallSpeed: 14, streakLength: 1.15, opacity: 0.52, particleSize: 1, curtains: 1 },
    { count: 3800, fallSpeed: 21, streakLength: 1.85, opacity: 0.62, particleSize: 1, curtains: 2 },
    { count: 6200, fallSpeed: 30, streakLength: 2.9, opacity: 0.72, particleSize: 1, curtains: 4 },
    { count: ENVIRONMENT_LIMITS.maxRainStreaks, fallSpeed: 42, streakLength: 4.4, opacity: 0.8, particleSize: 1, curtains: ENVIRONMENT_LIMITS.maxRainCurtains },
  ],
  snow: [
    { count: 0, fallSpeed: 0, streakLength: 0, opacity: 0, particleSize: 1, curtains: 0 },
    { count: 800, fallSpeed: 2.2, streakLength: 0, opacity: 0.62, particleSize: 3.1, curtains: 0 },
    { count: 1900, fallSpeed: 3.2, streakLength: 0, opacity: 0.68, particleSize: 4.6, curtains: 0 },
    { count: 3600, fallSpeed: 4.7, streakLength: 0, opacity: 0.74, particleSize: 6.5, curtains: 0 },
    { count: 5400, fallSpeed: 6.6, streakLength: 0, opacity: 0.8, particleSize: 8.8, curtains: 0 },
    { count: ENVIRONMENT_LIMITS.maxSnowflakes, fallSpeed: 9, streakLength: 0, opacity: 0.86, particleSize: 11.6, curtains: 0 },
  ],
} as const;

function precipitationTier(input: AtmosphereInput): WeatherTier {
  if (input.precipitation === "none") return 0;
  const seaState = clamp(input.seaState, 0, 9);
  const windSpeed = clamp(input.windSpeed, 0, 90);
  const visibility = clamp(input.visibility, 0, 20);
  if (input.storming && windSpeed >= 44 && seaState >= 7) return 5;
  if (input.storming && windSpeed >= 38) return 4;
  // A validated storm must never present as merely "heavy" decorative rain.
  // Its lowest visual tier is a squall; wind/sea extremes promote it again.
  if (input.storming) return 4;
  if (windSpeed >= 24 || seaState >= 5 || visibility <= 3) return 3;
  if (windSpeed >= 17 || seaState >= 3 || visibility <= 5) return 2;
  return 1;
}

function cloudRegime(input: AtmosphereInput): CloudRegime {
  if (input.storming) return "cumulonimbus";
  // The scenario validator requires broken/overcast cover for precipitation;
  // the visual planner additionally fails closed to a rain/snow-bearing deck
  // if it ever receives malformed legacy input rather than drawing weather
  // from an empty or decorative cloud field.
  if (input.precipitation !== "none") return "nimbostratus";
  if (input.clouds === "overcast") return "stratus";
  if (input.clouds === "broken") return "stratocumulus";
  if (input.clouds === "scattered") return input.windSpeed >= 22 ? "altocumulus" : "cumulus";
  return "clear";
}

function fogClassification(amount: number): FogClassification {
  if (amount >= 0.8) return "dense-fog";
  if (amount >= 0.58) return "fog";
  if (amount >= 0.32) return "mist";
  if (amount > 0.08) return "haze";
  return "clear";
}

/**
 * One bounded weather presentation derived from the existing scenario. It
 * changes geometry and motion without introducing another persisted setting.
 */
export function createAtmospherePlan(input: AtmosphereInput): AtmospherePlan {
  const random = seededRandom(stableSeed(input.seed, "layered-atmosphere"));
  const windSpeed = clamp(input.windSpeed, 0, 90);
  const direction = headingVector(input.windHeading);
  const driftScale = 0.018 + windSpeed / 600;
  const driftX = direction.x * driftScale;
  const driftZ = -direction.y * driftScale;
  const fogAmount = clamp(
    (10 - clamp(input.visibility, 0, 20)) / 8
      + (input.clouds === "overcast" ? 0.08 : 0)
      + (input.precipitation !== "none" ? 0.06 : 0),
    0,
    1,
  );
  const bankCount = Math.min(ENVIRONMENT_LIMITS.maxFogBanks, Math.round(fogAmount * ENVIRONMENT_LIMITS.maxFogBanks));
  const banks = Array.from({ length: bankCount }, (_, index): FogBankPlan => ({
    x: -24 + random() * 48,
    y: 0.45 + random() * 3.1 + index * 0.08,
    z: -25 + random() * 45,
    scaleX: 7 + random() * 8,
    scaleY: 0.28 + random() * 0.5,
    scaleZ: 2.8 + random() * 4.8,
    opacity: 0.025 + fogAmount * (0.035 + random() * 0.035),
    phase: random() * Math.PI * 2,
  }));

  const tier = precipitationTier(input);
  const presentation = (["none", "light", "steady", "heavy", "squall", "extreme"] as const)[tier];
  const precipitationProfile = input.precipitation === "none"
    ? PRECIPITATION_PROFILES.rain[0]
    : PRECIPITATION_PROFILES[input.precipitation][tier];
  const particleCount = precipitationProfile.count;
  const curtainCount = precipitationProfile.curtains;
  const regime = cloudRegime(input);
  const massTarget = {
    clear: 0,
    cumulus: 6,
    altocumulus: 9,
    stratocumulus: 8,
    stratus: 7,
    nimbostratus: 8,
    cumulonimbus: 8,
  }[regime];
  let remainingLobes = ENVIRONMENT_LIMITS.maxCloudLobes;
  const masses = Array.from({ length: Math.min(ENVIRONMENT_LIMITS.maxCloudMasses, massTarget) }, (_, index): CloudMassPlan => {
    // `lobes` now describes the bounded low-frequency swells carved into one
    // continuous shell. It no longer means a pile of overlapping spheres.
    const desiredLobes = regime === "cumulonimbus" ? 7 : regime === "stratus" || regime === "nimbostratus" ? 6 : 5;
    // The shell itself remains valid with zero extra deformation swells. Once
    // the global budget is exhausted, do not manufacture a final descriptor
    // beyond the published and tested limit.
    const lobes = Math.max(0, Math.min(desiredLobes, remainingLobes));
    remainingLobes -= lobes;
    const layered = regime === "stratus" || regime === "nimbostratus";
    const cellular = regime === "stratocumulus";
    const highPatch = regime === "altocumulus";
    const tower = regime === "cumulonimbus";
    const horizontalScale = tower
      ? 6.8 + random() * 3.2
      : layered
        ? 10 + random() * 6
        : cellular
          ? 4.6 + random() * 2.4
          : highPatch
            ? 3 + random() * 1.6
            : 4 + random() * 2.1;
    const verticalScale = tower
      ? 4.8 + random() * 3.4
      : layered
        ? 0.75 + random() * 0.55
        : cellular
          ? 2.05 + random() * 1.15
          : highPatch
            ? 0.9 + random() * 0.55
            : 1.9 + random() * 1.15;
    return {
      x: -22 + (index / Math.max(1, massTarget - 1)) * 44 + (random() - 0.5) * 5,
      y: tower
        ? 8.5 + (index % 2) * 1.5 + random() * 4
        : layered
          ? 8 + (index % 2) * 1.2 + random() * 2.5
          : highPatch
            ? 13 + (index % 3) * 2.4 + random() * 1.6
            : cellular
              ? 8 + (index % 3) * 3 + random() * 1.8
              : 8 + (index % 3) * 2.6 + random() * 2,
      // Dry layers remain distant. Active weather has lower, nearer source
      // shells so rain and snow can visibly descend from their bases without
      // returning to the giant translucent foreground bubbles removed in v13.
      z: input.precipitation === "none"
        ? -52 + ((index * 13.7) % 22) + (random() - 0.5) * 5
        : -33 + tier * 0.8 + ((index * 11.7) % 23) + (random() - 0.5) * 3,
      scaleX: horizontalScale,
      scaleY: verticalScale,
      scaleZ: layered
        ? 4.5 + random() * 3.2
        : tower
          ? 4 + random() * 2.8
          : highPatch
            ? 2 + random() * 1.4
            : cellular
              ? 2.4 + random() * 1.8
              : 2.3 + random() * 1.7,
      lobes,
      opacity: regime === "nimbostratus" || regime === "cumulonimbus"
        ? 0.82
        : layered || cellular
          ? 0.7
          : 0.64,
      phase: random() * Math.PI * 2,
      shapeSeed: Math.floor(random() * 0x7fffffff),
      yaw: (random() - 0.5) * (layered ? 0.16 : 0.28),
      pitch: (random() - 0.5) * (tower ? 0.06 : 0.12),
      breathAmplitude: 0.028 + random() * 0.027,
      breathSpeed: 0.068 + random() * 0.046,
      morphAmplitude: (layered ? 0.038 : tower ? 0.07 : 0.055) + random() * 0.03,
      morphSpeed: 0.052 + random() * 0.052,
      driftScale: 0.72 + random() * 0.56,
    };
  });
  const lobeCount = masses.reduce((total, mass) => total + mass.lobes, 0);
  const cellTarget = tier === 0
    ? 0
    : Math.min(ENVIRONMENT_LIMITS.maxPrecipitationCells, masses.length, 3 + tier);
  const cells = Array.from({ length: cellTarget }, (_, index): PrecipitationCellPlan => {
    // Distribute cells across the cloud field instead of taking one contiguous
    // slice, then bind every cell to an actual low cloud base.
    const cloudIndex = Math.min(masses.length - 1, Math.floor(index * masses.length / Math.max(1, cellTarget)));
    const mass = masses[cloudIndex];
    return {
      cloudIndex,
      x: mass.x,
      cloudBaseY: Math.max(4.2, mass.y - mass.scaleY * (regime === "cumulonimbus" ? 0.42 : 0.32)),
      z: mass.z,
      spreadX: Math.max(2.2, mass.scaleX * 0.88),
      spreadZ: Math.max(1.8, mass.scaleZ * 0.9),
      driftScale: mass.driftScale,
    };
  });
  const stormLightVisible = input.storming && input.lightningCapable && regime === "cumulonimbus";

  return {
    seed: input.seed,
    fog: {
      classification: fogClassification(fogAmount),
      horizonDensity: 0.004 + fogAmount * 0.052,
      zenithRatio: 0.22,
      verticalFalloff: 0.035,
      driftX,
      driftZ,
      speed: driftScale,
      banks,
    },
    precipitation: {
      kind: input.precipitation,
      presentation,
      tier,
      particleCount,
      curtainCount,
      fallSpeed: precipitationProfile.fallSpeed,
      streakLength: precipitationProfile.streakLength,
      opacity: precipitationProfile.opacity,
      particleSize: precipitationProfile.particleSize,
      driftX: direction.x * (0.2 + windSpeed * 0.025),
      driftZ: -direction.y * (0.2 + windSpeed * 0.025),
      cells,
    },
    clouds: {
      regime,
      masses,
      lobeCount,
      driftX,
      driftZ,
      speed: driftScale * 0.58,
    },
    stormLight: {
      visible: stormLightVisible,
      color: input.climate === "ocean" ? 0xb6cae8 : 0xc8d9e8,
      baseOpacity: stormLightVisible ? 0.035 : 0,
      peakOpacity: stormLightVisible ? 0.13 : 0,
      minCycleSeconds: 12 + random() * 5,
      phase: random() * Math.PI * 2,
    },
    description: `A ${fogClassification(fogAmount).replace("-", " ")} atmosphere uses ${banks.length} drifting low-poly veil${banks.length === 1 ? "" : "s"}; ${regime} clouds form ${masses.length} cohesive faceted shell${masses.length === 1 ? "" : "s"}, not overlapping bubble lobes. Their taxonomy-specific proportions drift with the wind while every shell visibly breathes and changes shape inside a bounded range. ${input.precipitation === "none" ? "No precipitation is falling" : `${input.precipitation === "snow" && tier === 1 ? "Flurries" : presentation} ${input.precipitation} uses ${particleCount} depth-tested ${input.precipitation === "rain" ? "streaks" : "flakes"} emitted from ${cells.length} actual cloud base${cells.length === 1 ? "" : "s"}${curtainCount ? ` and ${curtainCount} broad rain curtain${curtainCount === 1 ? "" : "s"}` : ""}`}. Particle size, density, fall speed, wind slant, and cloud coverage rise sharply with severity; every particle terminates at the water surface. Fog thins smoothly with upward view angle and observer altitude; localized storm light remains eased and non-flashing.`,
  };
}

/** Smooth distance-fog density for the actual camera ray, not a rounded HUD. */
export function fogDensityAtView(plan: AtmospherePlan, elevationDegrees: number, cameraY: number) {
  const progress = clamp((elevationDegrees + 8) / 68, 0, 1);
  const smoother = progress * progress * progress * (progress * (progress * 6 - 15) + 10);
  const altitude = Math.exp(-Math.max(0, Number.isFinite(cameraY) ? cameraY : 0) * plan.fog.verticalFalloff);
  return plan.fog.horizonDensity * altitude * (1 - smoother * (1 - plan.fog.zenithRatio));
}

export type SubsurfaceOpticsPlan = {
  surfaceApertureOpen: boolean;
  transmittance: number;
  activeBodyVisible: boolean;
  starThreshold: number;
  nebulaTransmission: boolean;
  appearance: "direct through the surface" | "not visible";
  description: string;
};

type SubsurfaceOpticsInput = {
  body: "sun" | "moon";
  bodyAboveHorizon: boolean;
  bodyAltitude: number;
  moonIllumination: number;
  time: EnvironmentTime;
  clouds: EnvironmentClouds;
  precipitation: EnvironmentPrecipitation;
  visibility: number;
  seaState: number;
};

/**
 * Models one shared optical path through the moving surface. Stars and the
 * active body use the same aperture, so no sky point can ignore a surface,
 * cloud, precipitation, or horizon condition that would hide a celestial
 * body in the same direction. This is direct refracted light, not a reflection.
 */
export function createSubsurfaceOpticsPlan(input: SubsurfaceOpticsInput): SubsurfaceOpticsPlan {
  const cloudFactor = { clear: 1, scattered: 0.82, broken: 0.48, overcast: 0.1 }[input.clouds];
  const weatherFactor = input.precipitation === "none" ? 1 : input.precipitation === "snow" ? 0.32 : 0.4;
  const rangeFactor = clamp(input.visibility / 12, 0.18, 1);
  const surfaceFactor = clamp(1.08 - clamp(input.seaState, 0, 9) * 0.105, 0.14, 1);
  const transmittance = Math.round(cloudFactor * weatherFactor * rangeFactor * surfaceFactor * 1000) / 1000;
  const surfaceApertureOpen = transmittance >= 0.24;
  const altitudeFactor = input.bodyAboveHorizon
    ? clamp((input.bodyAltitude + 3) / 20, 0.18, 1)
    : 0;
  const bodyBrightness = input.body === "sun"
    ? 1
    : clamp(0.2 + input.moonIllumination * 0.8, 0.2, 1);
  const activeBodyVisible = surfaceApertureOpen && transmittance * altitudeFactor * bodyBrightness >= 0.13;
  // An apparent-luminance floor applied after atmospheric and water losses.
  const starThreshold = surfaceApertureOpen
    ? clamp(0.82 + (1 - transmittance) * 0.17, 0.82, 0.995)
    : 1;
  const nebulaTransmission = surfaceApertureOpen
    && input.time === "night"
    && input.clouds === "clear"
    && input.precipitation === "none"
    && input.seaState <= 2
    && transmittance >= 0.72;
  const appearance = activeBodyVisible ? "direct through the surface" : "not visible";
  return {
    surfaceApertureOpen,
    transmittance,
    activeBodyVisible,
    starThreshold,
    nebulaTransmission,
    appearance,
    description: !surfaceApertureOpen
      ? "The shared celestial sightline is closed by the surface and weather, so no sun, moon, star, or nebula is visible underwater."
      : activeBodyVisible
        ? `Brightness-qualified celestial light is seen directly through the water surface at ${Math.round(transmittance * 100)} percent modeled transmission; it is not a reflection.`
        : "The water aperture is open, but the active sun or moon fails the horizon or apparent-brightness condition; no sun, moon, star, or nebula is visible underwater.",
  };
}

/** Refracts an above-horizon air direction into Snell's window for an
 * underwater observer. A nonpositive vertical component fails closed. */
export function refractSkyDirection<T extends { x: number; y: number; z: number }>(direction: T) {
  const magnitude = Math.hypot(direction.x, direction.y, direction.z) || 1;
  const x = direction.x / magnitude;
  const y = direction.y / magnitude;
  const z = direction.z / magnitude;
  if (y <= 0) return null;
  const horizontalMagnitude = Math.hypot(x, z);
  const airZenithAngle = Math.acos(clamp(y, -1, 1));
  const waterZenithAngle = Math.asin(Math.sin(airZenithAngle) / 1.333);
  const refractedHorizontal = Math.sin(waterZenithAngle);
  const horizontalX = horizontalMagnitude ? x / horizontalMagnitude : 0;
  const horizontalZ = horizontalMagnitude ? z / horizontalMagnitude : -1;
  return {
    x: horizontalX * refractedHorizontal,
    y: Math.cos(waterZenithAngle),
    z: horizontalZ * refractedHorizontal,
  };
}

export type AuroraBandPlan = {
  layer: number;
  x: number;
  height: number;
  depth: number;
  width: number;
  verticalSpan: number;
  verticalSkew: number;
  curvature: number;
  rippleDepth: number;
  lateralBend: number;
  thickness: number;
  tilt: number;
  pitch: number;
  roll: number;
  phase: number;
  color: number;
  accentColor: number;
  lowerEdgeColor: number;
  opacity: number;
  waveAmplitude: number;
  waveSpeed: number;
  lateralDrift: number;
  verticalDrift: number;
  depthDrift: number;
  primaryPeriod: number;
  secondaryPeriod: number;
};

export type AuroraPlan = {
  visible: boolean;
  hemisphere: "northern" | "southern";
  intensity: number;
  darknessMultiplier: number;
  temperatureProxyCelsius: number;
  bands: AuroraBandPlan[];
  description: string;
};

type AuroraInput = {
  seed: number;
  climate: EnvironmentClimate;
  latitude: number;
  season: string;
  time: EnvironmentTime;
  clouds: EnvironmentClouds;
  precipitation: EnvironmentPrecipitation;
  storming: boolean;
};

const AURORA_COLORS = [
  0xa7e2c6, // mint
  0x94d5e3, // pale cyan
  0xbbaee2, // lavender
  0xe2acc8, // rose
  0xe5d49b, // pale gold
  0x91cdbf, // sea glass
  0xc5b6db, // soft violet
] as const;

const AURORA_ACCENTS = [
  0x79bea8,
  0x72b8ce,
  0x9d91cc,
  0xcd89aa,
  0xcfb672,
  0x6eb5aa,
  0xa491c4,
] as const;

// A separate lower-edge palette keeps each curtain vertically chromatic. The
// pairs are deliberately distinct but remain soft enough to sit behind stars,
// weather, contacts, and the foreground fleet without becoming neon.
const AURORA_LOWER_EDGE_COLORS = [
  0xe8cc91, // pale gold below mint
  0xefb9cf, // rose below cyan
  0x9ddbc7, // mint below lavender
  0x9dcce4, // cyan below rose
  0xd2afe2, // violet below pale gold
  0xefbdad, // peach below sea glass
  0xc4dda2, // yellow-green below soft violet
] as const;

/** Auditable opacity envelope before the existing darkness multiplier. */
export const AURORA_OPACITY_ENVELOPE = {
  base: 0.3,
  eventStrength: 0.17,
  variation: 0.05,
  minimumEventStrength: 0.5,
  maximumEventStrength: 0.96,
} as const;

// Long winding paths cross and recede through the sky at staggered pitch, yaw,
// height, and depth. Their soft tapered ends may overlap but never align into
// the short front-facing cards that made the earlier aurora look drawn on.
const AURORA_CURTAIN_ANCHORS = [
  { x: -11, height: 8.2, depth: -25, width: 76, span: 6.4, skew: 2.8, tilt: -0.36, pitch: 0.1, roll: -0.07 },
  { x: 10, height: 12.8, depth: -34, width: 86, span: 7.1, skew: -3.1, tilt: 0.27, pitch: -0.08, roll: 0.06 },
  { x: -7, height: 24.8, depth: -47, width: 96, span: 8.2, skew: 2.5, tilt: -0.21, pitch: 0.07, roll: 0.05 },
  { x: 14, height: 5.6, depth: -23, width: 72, span: 5.8, skew: -2.2, tilt: 0.39, pitch: -0.12, roll: -0.05 },
  { x: -16, height: 17.2, depth: -57, width: 106, span: 7.6, skew: -2.7, tilt: -0.28, pitch: 0.12, roll: 0.08 },
  { x: 17, height: 29.2, depth: -69, width: 98, span: 8.7, skew: 3.2, tilt: 0.31, pitch: -0.1, roll: -0.08 },
  { x: 2, height: 32.5, depth: -41, width: 88, span: 7.8, skew: -2.4, tilt: 0.14, pitch: 0.14, roll: 0.04 },
] as const;

export const AURORA_DARKNESS = {
  day: 0,
  dawn: 0.4,
  dusk: 0.66,
  night: 1,
} as const satisfies Record<EnvironmentTime, number>;

/** Region, darkness, seasonal temperature, cloud, and seeded space-weather
 * chance all participate. The result is deterministic within one exercise. */
export function createAuroraPlan(input: AuroraInput): AuroraPlan {
  const latitude = clamp(input.latitude, -90, 90);
  const absoluteLatitude = Math.abs(latitude);
  const season = input.season.toLowerCase();
  const polarClimate = input.climate !== "ocean";
  const coldSeason = season === "winter" || season === "autumn" || season === "spring";
  const temperatureProxyCelsius = polarClimate
    ? (season === "winter" ? -28 : season === "summer" ? -4 : -15)
    : (coldSeason ? 2 : 12);
  const darknessMultiplier = AURORA_DARKNESS[input.time];
  const darkEnough = darknessMultiplier > 0;
  const skyOpen = input.precipitation === "none" && input.clouds !== "overcast" && !input.storming;
  const latitudeEligible = absoluteLatitude >= 55 || polarClimate;
  const seasonalFactor = coldSeason ? 0.2 : -0.18;
  const chance = clamp(0.2 + (absoluteLatitude - 50) * 0.012 + seasonalFactor, 0.08, 0.88);
  const random = seededRandom(stableSeed(input.seed, "aurora-space-weather"));
  const spaceWeatherActive = random() < chance;
  const eventStrength = clamp(0.55 + random() * 0.36 + (absoluteLatitude - 60) * 0.004, 0.5, 0.96);
  const visible = latitudeEligible && darkEnough && skyOpen && spaceWeatherActive;
  const intensity = visible ? Math.round(eventStrength * darknessMultiplier * 100) / 100 : 0;
  const bandCount = visible ? Math.min(ENVIRONMENT_LIMITS.maxAuroraBands, 5 + Math.floor(random() * 3)) : 0;
  const hemisphere = latitude < 0 ? "southern" : "northern";
  const hemisphereSign = hemisphere === "northern" ? 1 : -1;
  const colorOffset = bandCount ? Math.floor(random() * AURORA_COLORS.length) : 0;
  const phaseOrigin = bandCount ? random() * Math.PI * 2 : 0;
  const bands = Array.from({ length: bandCount }, (_, index): AuroraBandPlan => {
    const anchor = AURORA_CURTAIN_ANCHORS[index];
    return {
      layer: index,
      x: anchor.x + (random() - 0.5) * 3.8,
      height: anchor.height + (random() - 0.5) * 2.6,
      depth: anchor.depth + (random() - 0.5) * 6.4,
      width: anchor.width + (random() - 0.5) * 9.5,
      verticalSpan: anchor.span + (random() - 0.5) * 1.6,
      verticalSkew: hemisphereSign * (anchor.skew + (random() - 0.5) * 1.6),
      curvature: hemisphereSign * (10.5 + random() * 11.5),
      rippleDepth: 2.3 + random() * 3.1,
      lateralBend: hemisphereSign * (3.8 + random() * 5.2),
      thickness: 0.95 + random() * 1.15,
      tilt: hemisphereSign * (anchor.tilt + (random() - 0.5) * 0.14),
      pitch: anchor.pitch + (random() - 0.5) * 0.08,
      roll: hemisphereSign * (anchor.roll + (random() - 0.5) * 0.06),
      phase: (phaseOrigin + index * 2.399963229728653 + random() * 0.12) % (Math.PI * 2),
      // A rotated palette guarantees several native colors instead of allowing
      // seeded random selection to collapse every curtain to one hue.
      color: AURORA_COLORS[(colorOffset + index) % AURORA_COLORS.length],
      accentColor: AURORA_ACCENTS[(colorOffset + index * 2 + 2) % AURORA_ACCENTS.length],
      lowerEdgeColor: AURORA_LOWER_EDGE_COLORS[(colorOffset + index) % AURORA_LOWER_EDGE_COLORS.length],
      opacity: Math.round((
        AURORA_OPACITY_ENVELOPE.base
        + eventStrength * AURORA_OPACITY_ENVELOPE.eventStrength
        + random() * AURORA_OPACITY_ENVELOPE.variation
      ) * darknessMultiplier * 1000) / 1000,
      waveAmplitude: 1.9 + random() * 1.65,
      waveSpeed: 0.15 + random() * 0.12,
      lateralDrift: 1.7 + random() * 2.2,
      verticalDrift: 0.7 + random() * 1.15,
      depthDrift: 1.15 + random() * 2.1,
      primaryPeriod: 13 + random() * 13,
      secondaryPeriod: 25 + random() * 20,
    };
  });
  return {
    visible,
    hemisphere,
    intensity,
    darknessMultiplier,
    temperatureProxyCelsius,
    bands,
    description: visible
      ? `${hemisphere === "northern" ? "Northern" : "Southern"} auroral light forms ${bands.length} long, tapered, low-poly curtain paths expansively across staggered pitch, yaw, elevation, and depth. A separate WebGL engine adapts the MIT-licensed FastNoise Lite progressive domain-warp technique: five unjoined translucent veils follow every curved three-dimensional centerline, producing fibers and spatial volume without closed cloth slabs or hard rectangular ends. Broad paths overlap at different distances, snake across the sky, waver in three axes, breathe, and continually evolve on asynchronous bounded cycles. Each curtain shifts into a distinct complementary color along its lower edge. Luminance follows an explicit darkness scale—zero by day, clearly visible at dawn, brighter at dusk, and brightest at night. Soft native green, cyan, violet, rose, mint, pale gold, and peach remain non-flashing, respect scene fog and depth, and become still under reduced motion.`
      : `No aurora is visible under this latitude, seasonal temperature, local light, cloud, precipitation, and seeded space-weather combination.`,
  };
}

export type WaveComponent = {
  heading: number;
  directionX: number;
  directionY: number;
  amplitude: number;
  frequency: number;
  angularSpeed: number;
  phase: number;
  steepness: number;
};

export type FoamPatch = {
  x: number;
  y: number;
  phaseOffset: number;
  scale: number;
};

export type WaveFieldPlan = {
  seed: number;
  travelHeading: number;
  travelLabel: string;
  components: WaveComponent[];
  foamPatches: FoamPatch[];
  whitecapFraction: number;
  peakToTrough: number;
  gridSegments: number;
  description: string;
};

type WaveFieldInput = {
  seed: number;
  seaState: number;
  storming: boolean;
  precipitation: EnvironmentPrecipitation;
  climate: EnvironmentClimate;
  waveHeading: number;
  windHeading: number;
  windSpeed: number;
  currentHeading: number;
  currentSpeed: number;
};

/** Builds a bounded, seeded crossing-sea spectrum. Constant phase travels in
 * the stated direction; secondary components are aligned to wind and current. */
export function createWaveFieldPlan(input: WaveFieldInput): WaveFieldPlan {
  const random = seededRandom(stableSeed(input.seed, "low-poly-wave-field"));
  const seaState = clamp(input.seaState, 0, 9);
  const windSpeed = clamp(input.windSpeed, 0, 90);
  const currentSpeed = clamp(input.currentSpeed, 0, 12);
  const travelHeading = normalizedHeading(input.waveHeading);
  const baseAmplitude = 0.055 + seaState * 0.035 + (input.storming ? 0.12 : 0) + Math.min(0.08, windSpeed * 0.0022);
  const baseFrequency = clamp(0.3 + seaState * 0.026 + (input.storming ? 0.08 : 0), 0.28, 0.64);
  const componentSpecs = [
    { heading: travelHeading, amplitude: baseAmplitude, frequency: baseFrequency, speed: 0.58 + seaState * 0.11 + (input.storming ? 0.36 : 0) },
    { heading: normalizedHeading(input.windHeading + (random() - 0.5) * 12), amplitude: baseAmplitude * (0.18 + Math.min(0.18, windSpeed / 180)), frequency: baseFrequency * (1.42 + random() * 0.18), speed: 0.76 + windSpeed * 0.018 },
    { heading: normalizedHeading(input.currentHeading + (random() - 0.5) * 18), amplitude: baseAmplitude * (0.1 + Math.min(0.13, currentSpeed / 22)), frequency: baseFrequency * (0.62 + random() * 0.13), speed: 0.34 + currentSpeed * 0.16 },
  ];
  const components = componentSpecs.slice(0, ENVIRONMENT_LIMITS.maxWaveComponents).map((component, index): WaveComponent => {
    const direction = headingVector(component.heading);
    return {
      heading: component.heading,
      directionX: direction.x,
      directionY: direction.y,
      amplitude: component.amplitude,
      frequency: component.frequency,
      angularSpeed: component.speed,
      phase: index === 0 ? 0 : random() * Math.PI * 2,
      steepness: clamp(0.18 + seaState * 0.055 + (input.storming ? 0.16 : 0), 0.18, 0.78),
    };
  });
  const whitecapFraction = clamp((seaState - 2) * 0.075 + (windSpeed - 14) * 0.009 + (input.storming ? 0.22 : 0), 0, 0.78);
  const foamCount = Math.min(ENVIRONMENT_LIMITS.maxFoamPatches, Math.round(whitecapFraction * ENVIRONMENT_LIMITS.maxFoamPatches));
  const foamPatches = Array.from({ length: foamCount }, (): FoamPatch => ({
    x: (random() - 0.5) * 72,
    y: (random() - 0.5) * 72,
    phaseOffset: random() * Math.PI * 2,
    scale: 0.45 + random() * 0.95,
  }));
  const peakToTrough = Math.round(components.reduce((sum, component) => sum + component.amplitude, 0) * 2.35 * 100) / 100;
  const foamDescription = foamCount
    ? `${foamCount} low-poly foam and whitecap patches mark the steepest crests`
    : "no persistent whitecaps form in this calm field";
  return {
    seed: input.seed,
    travelHeading,
    travelLabel: headingLabel(travelHeading),
    components,
    foamPatches,
    whitecapFraction,
    peakToTrough,
    gridSegments: ENVIRONMENT_LIMITS.waveGridSegments,
    description: `A seeded ${components.length}-component wave field travels ${headingLabel(travelHeading)} toward ${Math.round(travelHeading)} degrees, combining wind and current. Narrow crests, broad troughs, and a forward lip form a modeled ${peakToTrough.toFixed(2)}-unit peak-to-trough range; ${foamDescription}. Surface vessels heave and roll with the local slope, with pale wakes as non-color-only motion cues.`,
  };
}

/** Samples height in the water plane's local coordinates. Positive local Y
 * maps to north before the plane is rotated into the world. */
export function sampleWaveField(plan: WaveFieldPlan, x: number, y: number, elapsed: number) {
  const safeX = clamp(x, -1_000_000, 1_000_000);
  const safeY = clamp(y, -1_000_000, 1_000_000);
  const safeElapsed = clamp(elapsed, 0, 10_000_000);
  return plan.components.reduce((height, component) => {
    const phase = (safeX * component.directionX + safeY * component.directionY) * component.frequency
      - safeElapsed * component.angularSpeed
      + component.phase;
    const fundamental = Math.sin(phase);
    const stokes = Math.sin(phase * 2) * component.steepness * 0.18;
    const crestLip = (Math.max(0, fundamental) ** 3 - 0.1875) * component.steepness * 0.22;
    return height + component.amplitude * (fundamental + stokes + crestLip);
  }, 0);
}

export function sampleWaveSlope(plan: WaveFieldPlan, x: number, y: number, elapsed: number) {
  const step = 0.22;
  const center = sampleWaveField(plan, x, y, elapsed);
  return {
    x: (sampleWaveField(plan, x + step, y, elapsed) - center) / step,
    y: (sampleWaveField(plan, x, y + step, elapsed) - center) / step,
  };
}
