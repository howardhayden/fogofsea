export const VIEW_LAYERS = ["stars", "sky", "air", "surface", "subsurface"] as const;

export type ViewLayer = (typeof VIEW_LAYERS)[number];

type ViewConfig = {
  camera: readonly [number, number, number];
  target: readonly [number, number, number];
  minDistance: number;
  maxDistance: number;
  minPolarAngle: number;
  maxPolarAngle: number;
};

export const VIEW_CONFIG: Record<ViewLayer, ViewConfig> = {
  stars: {
    camera: [0, 0.8, 15],
    target: [0, 1.2, 0],
    minDistance: 8,
    maxDistance: 22,
    minPolarAngle: 0.08,
    maxPolarAngle: 3.06,
  },
  sky: {
    camera: [0, 1.2, 15],
    target: [0, 7, 0],
    minDistance: 12,
    maxDistance: 22,
    minPolarAngle: 1.68,
    maxPolarAngle: 1.95,
  },
  air: {
    camera: [14, 17.6, 17],
    target: [0, 5.6, 0],
    minDistance: 9,
    maxDistance: 34,
    minPolarAngle: 0.24,
    maxPolarAngle: 1.49,
  },
  surface: {
    camera: [14, 12, 17],
    target: [0, 0, 0],
    minDistance: 9,
    maxDistance: 34,
    minPolarAngle: 0.24,
    maxPolarAngle: 1.49,
  },
  subsurface: {
    camera: [9.5, -2.5, 10.5],
    target: [0, -4.2, 0],
    minDistance: 8,
    maxDistance: 12,
    minPolarAngle: 1.41,
    maxPolarAngle: 1.82,
  },
};

export function nextViewLayer(current: ViewLayer, direction: -1 | 1) {
  const currentIndex = VIEW_LAYERS.indexOf(current);
  const nextIndex = Math.max(0, Math.min(VIEW_LAYERS.length - 1, currentIndex + direction));
  return VIEW_LAYERS[nextIndex];
}

export function headingToCompass(heading: number) {
  const points = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return points[Math.round((((heading % 360) + 360) % 360) / 45) % points.length];
}

export function viewTelemetryFromDirection(x: number, y: number, z: number) {
  const magnitude = Math.hypot(x, y, z) || 1;
  const nx = x / magnitude;
  const ny = y / magnitude;
  const nz = z / magnitude;
  const heading = Math.round(((Math.atan2(nx, -nz) * 180 / Math.PI) + 360) % 360) % 360;
  const elevation = Math.round(Math.asin(Math.max(-1, Math.min(1, ny))) * 180 / Math.PI);
  return { heading, elevation, direction: headingToCompass(heading) };
}

export function stableSeed(...parts: Array<string | number>) {
  let hash = 2166136261;
  const text = parts.join("|");
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export type SkyVisibilityInput = {
  time: "dawn" | "day" | "dusk" | "night";
  clouds: "clear" | "scattered" | "broken" | "overcast";
  precipitation: "none" | "rain" | "snow";
  visibility: number;
  aircraftCount: number;
  lowSignatureAircraft: number;
  vesselCount: number;
  lowSignatureVessels: number;
};

const MAX_VISIBLE_CELESTIAL_POINTS = 15_360;
const TWILIGHT_STAR_FLOOR = { dawn: 64, dusk: 96 } as const;

export function getSkyVisibility(input: SkyVisibilityInput) {
  const timeBase = { dawn: 6_400, day: 680, dusk: 11_200, night: MAX_VISIBLE_CELESTIAL_POINTS }[input.time];
  // Geometry, fog, and cloud masses already perform spatial occlusion. These
  // factors remove only the light that the atmosphere extinguishes globally;
  // they must not reduce a broken-cloud night to a sparse handful twice.
  const cloudFactor = { clear: 1, scattered: 0.96, broken: 0.82, overcast: 0.4 }[input.clouds];
  const weatherFactor = input.precipitation === "none" ? 1 : 0.72;
  const visibilityFactor = Math.max(0.5, Math.min(1, input.visibility / 10));
  const standardAircraft = Math.max(0, input.aircraftCount - input.lowSignatureAircraft);
  const standardVessels = Math.max(0, input.vesselCount - input.lowSignatureVessels);
  const allLowSignature = input.aircraftCount + input.vesselCount > 0
    && standardAircraft + standardVessels === 0;
  const trafficPenalty = standardAircraft * 32 + input.lowSignatureAircraft * 6;
  const horizonPenalty = standardVessels * 12 + input.lowSignatureVessels * 4;
  const lowSignatureBonus = allLowSignature ? 180 : 0;
  const computedStarCount = Math.round(timeBase * cloudFactor * weatherFactor * visibilityFactor + lowSignatureBonus - trafficPenalty - horizonPenalty);
  // Dawn and dusk are an explicit part of the celestial aesthetic: even when
  // weather, range, and conventional traffic compound, a small cohort of the
  // brightest crystalline lights remains in the scene for spatial fog/cloud
  // geometry to soften or cover naturally. Daylight retains its rarer rule.
  const twilightFloor = input.time === "dawn" || input.time === "dusk" ? TWILIGHT_STAR_FLOOR[input.time] : 0;
  const starCount = Math.max(twilightFloor, Math.min(MAX_VISIBLE_CELESTIAL_POINTS, computedStarCount));
  const clarity = allLowSignature && starCount > 10_000
    ? "pristine low-signature cosmos"
    : starCount > 12_000
      ? "expansive cosmos"
      : starCount > 7_000
        ? "filtered cosmos"
        : starCount > 2_000
          ? "traffic-obscured sky"
          : "weather-veiled sky";
  return { starCount, standardAircraft, standardVessels, allLowSignature, clarity };
}

export type CelestialProminenceInput = {
  body: "sun" | "moon";
  viewLayer: ViewLayer;
  supportedAircraftCount: number;
  aboveHorizon: boolean;
  subsurfaceTransmission?: boolean;
};

export type CelestialProminence = {
  bodyRadius: number;
  haloRadius: number;
  haloOpacity: number;
  distance: number;
  trafficFactor: number;
  renderInScene: boolean;
  indicatorRequired: boolean;
  label: "commanding" | "prominent" | "clear";
  appearance: "direct" | "direct through the water surface";
};

function rounded(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * Sets only the visual prominence of a correctly positioned celestial body.
 * Direction remains the responsibility of the synthetic observer ephemeris,
 * so this helper cannot move a body to a more convenient azimuth or altitude.
 */
export function getCelestialProminence(input: CelestialProminenceInput): CelestialProminence {
  const supportedAircraftCount = Math.max(0, Math.min(40, Math.floor(Number.isFinite(input.supportedAircraftCount) ? input.supportedAircraftCount : 0)));
  // Even very dense air traffic reduces emphasis by no more than 18 percent.
  const trafficFactor = 1 - Math.min(0.18, supportedAircraftCount * 0.009);
  const viewRadius = input.viewLayer === "stars"
    ? (input.body === "sun" ? 4.2 : 3.8)
    : input.viewLayer === "subsurface"
      ? (input.body === "sun" ? 0.92 : 0.78)
    : input.viewLayer === "sky"
      ? (input.body === "sun" ? 2.15 : 1.9)
      : (input.body === "sun" ? 1.35 : 1.2);
  const bodyRadius = rounded(viewRadius * trafficFactor);
  const haloRadius = rounded(bodyRadius * (input.viewLayer === "stars" ? 2.05 : 1.72));
  const haloOpacity = rounded((input.viewLayer === "stars" ? 0.34 : 0.22) * (0.88 + trafficFactor * 0.12));
  const distance = input.viewLayer === "stars" ? 58 : input.viewLayer === "subsurface" ? 46 : input.viewLayer === "sky" ? 66 : 72;
  const subsurfaceVisible = input.viewLayer !== "subsurface" || input.subsurfaceTransmission === true;
  return {
    bodyRadius,
    haloRadius,
    haloOpacity,
    distance,
    trafficFactor: rounded(trafficFactor),
    renderInScene: input.aboveHorizon && subsurfaceVisible,
    indicatorRequired: !input.aboveHorizon,
    label: input.viewLayer === "stars" ? "commanding" : input.viewLayer === "sky" ? "prominent" : "clear",
    appearance: input.viewLayer === "subsurface" ? "direct through the water surface" : "direct",
  };
}

export type StarPlacement = { x: number; y: number; z: number; scale: number; paletteIndex: number };

export function createStarPlacements(seed: number, count = 960): StarPlacement[] {
  const random = seededRandom(seed);
  return Array.from({ length: count }, () => {
    const azimuth = random() * Math.PI * 2;
    const vertical = random() * 2 - 1;
    const radius = 54 + random() * 72;
    const horizontal = Math.sqrt(Math.max(0, 1 - vertical * vertical));
    return {
      x: Math.cos(azimuth) * horizontal * radius,
      y: vertical * radius,
      z: Math.sin(azimuth) * horizontal * radius,
      scale: 0.45 + random() * 1.85,
      paletteIndex: Math.floor(random() * 5),
    };
  });
}

export type SubsurfaceLifeProfile = {
  key: "reef-shelf" | "temperate-channel" | "pelagic-deep" | "polar-shelf" | "polar-trench" | "glacial-sound";
  solitaryCount: number;
  schoolCount: number;
  depthLabel: string;
  seabedY: number | null;
};

export function getSubsurfaceLifeProfile(climate: "ocean" | "arctic" | "antarctic", region: string, exerciseId: number): SubsurfaceLifeProfile {
  const random = seededRandom(stableSeed(exerciseId, region, climate, "fauna-profile"));
  const lowerRegion = region.toLowerCase();
  let key: SubsurfaceLifeProfile["key"];
  if (lowerRegion.includes("reef")) key = "reef-shelf";
  else if (lowerRegion.includes("temperate") || lowerRegion.includes("strait")) key = "temperate-channel";
  else if (lowerRegion.includes("trench") || lowerRegion.includes("ice margin")) key = climate === "ocean" ? "pelagic-deep" : "polar-trench";
  else if (lowerRegion.includes("glacier") || lowerRegion.includes("research corridor")) key = "glacial-sound";
  else if (climate === "ocean") key = "pelagic-deep";
  else key = "polar-shelf";
  const profile = {
    "reef-shelf": { solitary: [4, 7], school: [18, 34], depthLabel: "upper shelf and reef edge", seabedY: -6.35 },
    "temperate-channel": { solitary: [3, 6], school: [12, 26], depthLabel: "midwater channel", seabedY: -6.35 },
    "pelagic-deep": { solitary: [1, 3], school: [0, 14], depthLabel: "open midwater above deep water", seabedY: null },
    "polar-shelf": { solitary: [2, 4], school: [0, 16], depthLabel: "sparse polar shelf", seabedY: -6.35 },
    "polar-trench": { solitary: [1, 2], school: [0, 8], depthLabel: "cold midwater above a trench", seabedY: null },
    "glacial-sound": { solitary: [2, 4], school: [8, 20], depthLabel: "glacial sound midwater", seabedY: -6.35 },
  }[key];
  const between = ([minimum, maximum]: number[]) => minimum + Math.floor(random() * (maximum - minimum + 1));
  return {
    key,
    solitaryCount: between(profile.solitary),
    schoolCount: between(profile.school),
    depthLabel: profile.depthLabel,
    seabedY: profile.seabedY,
  };
}
