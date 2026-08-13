import * as THREE from "three";
import { refractSkyDirection, type SubsurfaceOpticsPlan } from "./environmentVisuals";
import { seededRandom, type StarPlacement, type ViewLayer } from "./viewModel";

export type StarDepth = "near" | "far";
export type StarMotion = "still" | "swirling";
export type StarPopulation = "field" | "nebula";
export type StarProminence = "ambient" | "jewel";
export type NebulaColorFamily = "white" | "pastel" | "vibrant";

export const STARFIELD_LIMITS = {
  fieldStars: 3_072,
  nebulaCount: 16,
  starsPerNebula: 768,
  densityCandidatesPerField: 3_072,
  maxStars: 15_360,
  maxStarBatches: 1,
  maxMeshes: 1,
  minTwinkleHz: 0.22,
  maxTwinkleHz: 0.72,
  maxTwinkleAmplitude: 0.46,
  maxPulseAmplitude: 0.31,
  minShiftHz: 0.18,
  maxShiftHz: 0.48,
  minShiftWorldUnits: 2.8,
  maxShiftWorldUnits: 9.6,
  minRadius: 88,
  nearRadiusMax: 206,
  maxRadius: 404,
  haloRadius: 1.5,
  haloAlphaFactor: 0.26,
  maxHaloAlpha: 0.23,
  minDensity: 0.28,
  maxDensity: 1,
  minJewelFraction: 0.085,
  maxJewelFraction: 0.105,
  whiteColorIndexMax: 5,
  minWhiteFraction: 0.76,
  minPureWhiteFraction: 0.24,
  maxAmbientScale: 0.96,
  minJewelScale: 1.12,
  nebulaJewelScaleSpan: 0.64,
  fieldJewelScaleSpan: 0.62,
  // Large crystalline punctuation remains unmistakable, but no single facet
  // should merge hundreds of pixels into a foreground-scale object.
  maxJewelScale: 1.92,
} as const;

type UnitVector = Readonly<{ x: number; y: number; z: number }>;

/** Parameters for one global-support, low-order harmonic light field. The
 * vectors form an orthonormal frame; none of them denotes an oval boundary or
 * a radial falloff. */
export type StarfieldDensityField = Readonly<{
  index: number;
  axis: UnitVector;
  tangent: UnitVector;
  bitangent: UnitVector;
  sharedAxis: UnitVector;
  candidatePhase: number;
  sampleOffset: number;
}>;

export type StarfieldStar = {
  x: number;
  y: number;
  z: number;
  scale: number;
  colorIndex: number;
  depth: StarDepth;
  motion: StarMotion;
  population: StarPopulation;
  prominence: StarProminence;
  nebulaId?: string;
  twinkleBand: 0 | 1 | 2;
  rotation: number;
  /** Relative apparent luminance used for atmospheric and underwater visibility. */
  brightness: number;
};

export type StarfieldNebula = {
  id: string;
  densityField: StarfieldDensityField;
  colorFamily: NebulaColorFamily;
  colorIndex: number;
};

export type StarfieldPlan = {
  seed: number;
  theme: "light" | "dark";
  appearance: "direct sky" | "direct through the water surface";
  stars: StarfieldStar[];
  nebulae: StarfieldNebula[];
  counts: {
    near: number;
    far: number;
    still: number;
    swirling: number;
    field: number;
    nebula: number;
  };
};

type CreateStarfieldPlanInput = {
  seed: number;
  theme: "light" | "dark";
  placements: StarPlacement[];
  visibleCount: number;
};

const STAR_PALETTES = {
  dark: [
    0xffffff,
    0xfffdf4,
    0xf5fbff,
    0xfff6ec,
    0xf6f0ff,
    0xf0fff9,
    0xffddea,
    0xd9f3ff,
    0xe5dcff,
    0xffe1c7,
    0xe1ffd6,
    0xfff4b8,
    0x8adfff,
    0xb69aff,
    0xff8ac8,
    0xffaf78,
  ],
  light: [
    0xffffff,
    0xfffbed,
    0xedf8ff,
    0xfff1e6,
    0xf1eaff,
    0xeafff6,
    0xffd4e5,
    0xcceeff,
    0xdccfff,
    0xffd5b5,
    0xd8fbc9,
    0xffedaa,
    0x64c8ed,
    0x9875e8,
    0xe963ad,
    0xe98c5e,
  ],
} as const;

const NEBULA_FAMILIES: readonly NebulaColorFamily[] = [
  "white", "pastel", "white", "white", "pastel", "white", "pastel", "white",
  "vibrant", "pastel", "white", "pastel", "pastel", "white", "pastel", "vibrant",
];

const NEBULA_COLOR_INDEXES: Readonly<Record<NebulaColorFamily, readonly number[]>> = {
  white: [0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 5],
  pastel: [0, 0, 0, 0, 0, 1, 1, 2, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  // Saturated jewel tones remain rare accents inside a predominantly white
  // and near-white field, so color enriches the canopy instead of turning the
  // stars into confetti.
  vibrant: [0, 0, 0, 0, 1, 1, 2, 2, 3, 4, 5, 5, 6, 7, 8, 9, 12, 13, 14, 15],
};

const FIELD_COLOR_INDEXES = [
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 4, 4, 5, 5,
  6, 7, 8, 9, 10, 11,
] as const;
const JEWEL_COLOR_INDEXES = [
  // Large facets carry far more projected area than ambient glints. Bias
  // their vocabulary more strongly toward white so native-colour halos stay
  // occasional punctuation rather than turning the canopy into confetti.
  0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2,
  3, 3, 3, 4, 4, 4, 5, 5, 5, 5, 5, 5,
  6, 7, 8, 9, 10, 11, 13, 15,
] as const;

function finiteCount(value: number, maximum: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(maximum, Math.floor(value)));
}

function normalizeVector(x: number, y: number, z: number) {
  const magnitude = Math.hypot(x, y, z) || 1;
  return { x: x / magnitude, y: y / magnitude, z: z / magnitude };
}

function fractional(value: number) {
  return value - Math.floor(value);
}

function dotVector(left: UnitVector, right: UnitVector) {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

function crossVector(left: UnitVector, right: UnitVector) {
  return normalizeVector(
    left.y * right.z - left.z * right.y,
    left.z * right.x - left.x * right.z,
    left.x * right.y - left.y * right.x,
  );
}

/** Exact equal-area, low-discrepancy base used both for the continuous global
 * canopy and for deterministic density-field candidates. */
export function sphericalFibonacciDirection(index: number, count: number, phase = 0): UnitVector {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const safeCount = Math.max(1, Math.floor(count));
  const safeIndex = Math.max(0, Math.min(safeCount - 1, Math.floor(index)));
  const vertical = 1 - ((safeIndex + 0.5) / safeCount) * 2;
  const horizontal = Math.sqrt(Math.max(0, 1 - vertical * vertical));
  const angle = safeIndex * goldenAngle + phase;
  return {
    x: Math.cos(angle) * horizontal,
    y: vertical,
    z: Math.sin(angle) * horizontal,
  };
}

/** Creates one of sixteen deterministic frames. A shared low-order component
 * makes the fields overlap; the individual frames make their density and
 * luminance patterns spatially observable rather than palette-only labels. */
export function createStarfieldDensityField(seed: number, fieldIndex: number): StarfieldDensityField {
  const index = Math.max(0, Math.min(STARFIELD_LIMITS.nebulaCount - 1, Math.floor(fieldIndex)));
  const layoutRandom = seededRandom((seed ^ 0x73a9b451) >>> 0);
  const commonPhase = layoutRandom() * Math.PI * 2;
  const sharedVertical = layoutRandom() * 2 - 1;
  const sharedAngle = layoutRandom() * Math.PI * 2;
  const sharedHorizontal = Math.sqrt(Math.max(0, 1 - sharedVertical * sharedVertical));
  const sharedAxis = normalizeVector(
    Math.cos(sharedAngle) * sharedHorizontal,
    sharedVertical,
    Math.sin(sharedAngle) * sharedHorizontal,
  );
  const fieldRandom = seededRandom((
    seed
    ^ Math.imul(index + 1, 0x9e3779b1)
    ^ 0xa511e9b3
  ) >>> 0);
  const axis = sphericalFibonacciDirection(index, STARFIELD_LIMITS.nebulaCount, commonPhase);
  const helper = Math.abs(axis.y) > 0.84
    ? { x: 1, y: 0, z: 0 }
    : { x: 0, y: 1, z: 0 };
  const firstTangent = crossVector(axis, helper);
  const firstBitangent = crossVector(axis, firstTangent);
  const roll = fieldRandom() * Math.PI * 2;
  const rollCosine = Math.cos(roll);
  const rollSine = Math.sin(roll);
  const tangent = normalizeVector(
    firstTangent.x * rollCosine + firstBitangent.x * rollSine,
    firstTangent.y * rollCosine + firstBitangent.y * rollSine,
    firstTangent.z * rollCosine + firstBitangent.z * rollSine,
  );
  const bitangent = crossVector(axis, tangent);
  // The indexed phase term guarantees distinct candidate lattices; bounded
  // jitter prevents their facets from forming a repeated meridian pattern.
  const candidatePhase = commonPhase
    + ((index + 0.5) / STARFIELD_LIMITS.nebulaCount) * Math.PI * 2
    + (fieldRandom() - 0.5) * 0.16;
  return {
    index,
    axis,
    tangent,
    bitangent,
    sharedAxis,
    candidatePhase,
    sampleOffset: fieldRandom(),
  };
}

/** Smooth, strictly positive, global-support density made only from real
 * spherical harmonics of degree three or lower. It cannot create an oval
 * boundary, radial island, seam, or empty panel. */
export function evaluateStarfieldDensity(field: StarfieldDensityField, direction: UnitVector) {
  const normalized = normalizeVector(direction.x, direction.y, direction.z);
  const shared = dotVector(normalized, field.sharedAxis);
  const x = dotVector(normalized, field.axis);
  const y = dotVector(normalized, field.tangent);
  const z = dotVector(normalized, field.bitangent);
  const signal = 0.42 * 0.5 * (3 * shared * shared - 1)
    + 0.48 * x
    + 0.4 * (2 * y * z)
    + 0.34 * 0.5 * (5 * z * z * z - 3 * z)
    + 0.28 * (x * x - y * y);
  const shaped = signal * 2.2;
  const continuousUnit = 0.5 + 0.5 * shaped / Math.sqrt(1 + shaped * shaped);
  return STARFIELD_LIMITS.minDensity
    + (STARFIELD_LIMITS.maxDensity - STARFIELD_LIMITS.minDensity) * continuousUnit;
}

/** Globally continuous spherical-Fibonacci base with a low-frequency angular
 * warp. The warp changes density gradually without creating kernels, disks,
 * panel boundaries, or unpopulated seams. */
function canopyDirection(index: number, count: number, phase: number) {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const vertical = 1 - ((index + 0.5) / Math.max(1, count)) * 2;
  const latitude = Math.asin(Math.max(-1, Math.min(1, vertical)));
  const longitude = index * goldenAngle + phase;
  const warpedLatitude = Math.max(-Math.PI * 0.497, Math.min(Math.PI * 0.497,
    latitude
      + Math.sin(longitude * 2 + phase * 0.7) * Math.cos(latitude) * 0.13
      + Math.sin(longitude - latitude * 3 - phase) * Math.cos(latitude) * 0.055,
  ));
  const warpedLongitude = longitude
    + Math.sin(latitude * 2.2 + phase) * 0.24
    + Math.sin(longitude * 3 - latitude + phase * 0.4) * 0.075;
  const horizontal = Math.cos(warpedLatitude);
  return normalizeVector(
    Math.cos(warpedLongitude) * horizontal,
    Math.sin(warpedLatitude),
    Math.sin(warpedLongitude) * horizontal,
  );
}

function meanCanopyDensity(fields: readonly StarfieldDensityField[], direction: UnitVector) {
  if (fields.length === 0) return 0.5;
  return fields.reduce((sum, field) => sum + evaluateStarfieldDensity(field, direction), 0) / fields.length;
}

function canopyRadius(index: number, phase: number) {
  const unit = fractional((index + 1) * 0.7548776662466927 + phase / (Math.PI * 2));
  const withinBand = fractional((index + 1) * 0.5698402909980532 + phase / Math.PI);
  // Four substantially overlapping bands make depth a broad continuous
  // volume, independent of every angular density field: 12% close, 28%
  // middle-near, 34% middle-far, and 26% far.
  if (unit < 0.12) return STARFIELD_LIMITS.minRadius + withinBand * (180 - STARFIELD_LIMITS.minRadius);
  if (unit < 0.4) return 150 + withinBand * (270 - 150);
  if (unit < 0.74) return 230 + withinBand * (338 - 230);
  return 310 + withinBand * (STARFIELD_LIMITS.maxRadius - 310);
}

export function summarizeStars(stars: readonly StarfieldStar[]): StarfieldPlan["counts"] {
  return stars.reduce<StarfieldPlan["counts"]>((counts, star) => {
    counts[star.depth] += 1;
    counts[star.motion] += 1;
    counts[star.population] += 1;
    return counts;
  }, { near: 0, far: 0, still: 0, swirling: 0, field: 0, nebula: 0 });
}

type SelectedFieldDirection = Readonly<{
  candidateIndex: number;
  direction: UnitVector;
  density: number;
}>;

/** Exact-count systematic resampling gives every field real spatial density
 * without rejection variance or an unbounded retry loop. The positive density
 * floor makes the target interval wider than any candidate weight, so a
 * candidate cannot be selected twice. */
function selectFieldDirections(field: StarfieldDensityField): SelectedFieldDirection[] {
  const candidateCount = STARFIELD_LIMITS.densityCandidatesPerField;
  const weights = new Float64Array(candidateCount);
  let totalWeight = 0;
  for (let candidateIndex = 0; candidateIndex < candidateCount; candidateIndex += 1) {
    const direction = sphericalFibonacciDirection(candidateIndex, candidateCount, field.candidatePhase);
    const density = evaluateStarfieldDensity(field, direction);
    weights[candidateIndex] = density;
    totalWeight += density;
  }
  const interval = totalWeight / STARFIELD_LIMITS.starsPerNebula;
  const selected: SelectedFieldDirection[] = [];
  let candidateIndex = 0;
  let cumulativeWeight = weights[0];
  for (let starIndex = 0; starIndex < STARFIELD_LIMITS.starsPerNebula; starIndex += 1) {
    const target = (starIndex + field.sampleOffset) * interval;
    while (candidateIndex < candidateCount - 1 && cumulativeWeight < target) {
      candidateIndex += 1;
      cumulativeWeight += weights[candidateIndex];
    }
    selected.push({
      candidateIndex,
      direction: sphericalFibonacciDirection(candidateIndex, candidateCount, field.candidatePhase),
      density: weights[candidateIndex],
    });
  }
  return selected;
}

function createNebulaStars(
  spec: StarfieldNebula,
  random: () => number,
  canopyPhase: number,
): StarfieldStar[] {
  const densityField = spec.densityField;
  const colorIndexes = NEBULA_COLOR_INDEXES[spec.colorFamily];
  const nebulaIndex = densityField.index;
  const selectedDirections = selectFieldDirections(densityField);

  return selectedDirections.map(({ candidateIndex, direction, density }, starIndex): StarfieldStar => {
    const globalIndex = nebulaIndex * STARFIELD_LIMITS.densityCandidatesPerField + candidateIndex;
    const orderedStarIndex = STARFIELD_LIMITS.fieldStars
      + nebulaIndex * STARFIELD_LIMITS.starsPerNebula
      + starIndex;
    const densityStrength = (density - STARFIELD_LIMITS.minDensity)
      / (STARFIELD_LIMITS.maxDensity - STARFIELD_LIMITS.minDensity);
    const starRadius = canopyRadius(globalIndex, canopyPhase + 0.37);
    const nearDepth = starRadius <= STARFIELD_LIMITS.nearRadiusMax;
    const ambientRadialCompensation = 0.62 + (starRadius / STARFIELD_LIMITS.maxRadius) * 0.38;
    const jewelRadialCompensation = 0.78 + (starRadius / STARFIELD_LIMITS.maxRadius) * 0.22;
    const fieldScale = 0.9 + densityStrength * 0.18;
    const landmarkJewel = starIndex === (nebulaIndex * 47) % STARFIELD_LIMITS.starsPerNebula;
    const jewelPoint = landmarkJewel || (starIndex + nebulaIndex * 3) % 11 === 0;
    const scaleRoll = random();
    const brightnessRoll = random();
    return {
      x: direction.x * starRadius,
      y: direction.y * starRadius,
      z: direction.z * starRadius,
      scale: landmarkJewel
        ? STARFIELD_LIMITS.maxJewelScale
        : jewelPoint
          ? (STARFIELD_LIMITS.minJewelScale + Math.pow(scaleRoll, 0.9) * STARFIELD_LIMITS.nebulaJewelScaleSpan)
            * jewelRadialCompensation
            * (0.96 + densityStrength * 0.08)
          : Math.min(
            STARFIELD_LIMITS.maxAmbientScale,
            (0.39 + Math.pow(scaleRoll, 1.34) * 0.44) * fieldScale * ambientRadialCompensation,
          ),
      colorIndex: landmarkJewel
        ? 0
        : jewelPoint
          ? JEWEL_COLOR_INDEXES[(nebulaIndex + starIndex) % JEWEL_COLOR_INDEXES.length]
        : colorIndexes[(spec.colorIndex + starIndex) % colorIndexes.length],
      depth: nearDepth ? "near" : "far",
      motion: orderedStarIndex % 32 === 0 ? "still" : "swirling",
      population: "nebula",
      prominence: jewelPoint ? "jewel" : "ambient",
      nebulaId: spec.id,
      twinkleBand: (starIndex % 3) as 0 | 1 | 2,
      rotation: random() * Math.PI * 2,
      brightness: landmarkJewel
        ? 0.98
        : jewelPoint
          ? Math.min(0.96, 0.7 + Math.pow(brightnessRoll, 0.86) * 0.22 + densityStrength * 0.04)
          : Math.min(0.9, 0.13 + Math.pow(brightnessRoll, 1.18) * 0.61 + densityStrength * 0.13),
    };
  });
}

/**
 * Produces the complete visual plan without touching WebGL. Keeping the model
 * pure makes every exercise repeatable and lets performance and motion limits
 * be verified without relying on screenshots.
 */
export function createStarfieldPlan(input: CreateStarfieldPlanInput): StarfieldPlan {
  const count = finiteCount(input.visibleCount, Math.min(STARFIELD_LIMITS.fieldStars, input.placements.length));
  const random = seededRandom(input.seed ^ 0x51f15e);
  const canopyPhase = random() * Math.PI * 2;
  const densityFields = Array.from({ length: count > 0 ? STARFIELD_LIMITS.nebulaCount : 0 }, (_, index) => (
    createStarfieldDensityField(input.seed, index)
  ));
  const fieldStars = input.placements.slice(0, count).map((placement, index): StarfieldStar => {
    const direction = canopyDirection(index, count, canopyPhase + 1.137);
    const density = meanCanopyDensity(densityFields, direction);
    const radius = canopyRadius(index, canopyPhase + 2.17);
    const depth: StarDepth = radius <= STARFIELD_LIMITS.nearRadiusMax ? "near" : "far";
    const motion: StarMotion = index % 32 === 0 ? "still" : "swirling";
    const sizeFactor = depth === "near" ? 0.24 : 0.15;
    const scaleRoll = random();
    const rawScale = placement.scale * sizeFactor * (0.82 + scaleRoll * 0.38);
    // Radial compensation preserves real parallax/depth without turning the
    // near shell into foreground-sized diamonds. A small residual depth cue
    // remains, while explicitly designated jewel facets carry the occasional
    // large-scale crystalline punctuation defined by this visual system.
    const ambientRadialCompensation = 0.62 + (radius / STARFIELD_LIMITS.maxRadius) * 0.38;
    const jewelRadialCompensation = 0.78 + (radius / STARFIELD_LIMITS.maxRadius) * 0.22;
    const landmarkJewel = index % 211 === 0;
    const jewelPoint = landmarkJewel || index % 11 === 3;
    const scale = landmarkJewel
      ? STARFIELD_LIMITS.maxJewelScale
      : jewelPoint
        ? (STARFIELD_LIMITS.minJewelScale + Math.pow(scaleRoll, 0.9) * STARFIELD_LIMITS.fieldJewelScaleSpan) * jewelRadialCompensation
        : depth === "near"
          ? Math.min(STARFIELD_LIMITS.maxAmbientScale, Math.max(0.48, rawScale * 2.32)) * ambientRadialCompensation
          : Math.min(0.8, Math.max(0.4, rawScale * 2.55)) * ambientRadialCompensation;
    const colorRoll = random();
    const brightnessRoll = random();
    return {
      x: direction.x * radius,
      y: direction.y * radius,
      z: direction.z * radius,
      scale,
      colorIndex: landmarkJewel
        ? 0
        : jewelPoint
          ? JEWEL_COLOR_INDEXES[Math.floor(colorRoll * JEWEL_COLOR_INDEXES.length)]
        : FIELD_COLOR_INDEXES[Math.floor(colorRoll * FIELD_COLOR_INDEXES.length)],
      depth,
      motion,
      population: "field",
      prominence: jewelPoint ? "jewel" : "ambient",
      twinkleBand: (index % 3) as 0 | 1 | 2,
      rotation: random() * Math.PI * 2,
      brightness: landmarkJewel
        ? 0.985
        : jewelPoint
          ? 0.74 + Math.pow(brightnessRoll, 0.84) * 0.2
          : Math.min(0.9, 0.1 + Math.pow(brightnessRoll, 1.5) * 0.7 + density * 0.1),
    };
  });

  const nebulae = densityFields.map((densityField, index): StarfieldNebula => {
    const colorFamily = NEBULA_FAMILIES[index];
    const familyPalette = NEBULA_COLOR_INDEXES[colorFamily];
    return {
      id: `nebula-${index + 1}`,
      densityField,
      colorFamily,
      colorIndex: Math.floor(random() * familyPalette.length),
    };
  });
  const stars = [
    ...fieldStars,
    ...nebulae.flatMap((nebula) => createNebulaStars(nebula, random, canopyPhase)),
  ];

  return {
    seed: input.seed,
    theme: input.theme,
    appearance: "direct sky",
    stars,
    nebulae,
    counts: summarizeStars(stars),
  };
}

export type StarfieldVisibilityInput = {
  viewLayer: ViewLayer;
  time: "dawn" | "day" | "dusk" | "night";
  clouds: "clear" | "scattered" | "broken" | "overcast";
  precipitation: "none" | "rain" | "snow";
  visibility: number;
  seaState: number;
  maximumVisible: number;
  subsurfaceOptics?: SubsurfaceOpticsPlan;
};

/**
 * Applies an apparent-brightness threshold instead of uniformly hiding the
 * sky. Rare brilliant stars can survive daylight; only the brightest survive
 * the severe attenuation of a shallow subsurface view. Underwater directions
 * are restricted to above-horizon light and refracted into Snell's window.
 */
export function visibleStarfieldPlan(plan: StarfieldPlan, input: StarfieldVisibilityInput): StarfieldPlan {
  const timeThreshold = { night: 0.08, dusk: 0.5, dawn: 0.56, day: 0.93 }[input.time];
  const layerThreshold = { stars: 0, sky: 0.01, air: 0.03, surface: 0.02, subsurface: 0.82 }[input.viewLayer];
  const cloudPenalty = { clear: 0, scattered: 0.035, broken: 0.13, overcast: 0.31 }[input.clouds];
  const weatherPenalty = input.precipitation === "none" ? 0 : 0.16;
  const rangePenalty = Math.max(0, 8 - input.visibility) * 0.018;
  const waterPenalty = input.viewLayer === "subsurface" ? Math.max(0, input.seaState - 2) * 0.018 : 0;
  const baseThreshold = timeThreshold + layerThreshold + cloudPenalty + weatherPenalty + rangePenalty + waterPenalty;
  const opticalThreshold = Math.min(0.997, input.viewLayer === "subsurface"
    ? Math.max(baseThreshold, input.subsurfaceOptics?.starThreshold ?? 1)
    : baseThreshold);
  // Global penalties must never erase twilight completely. These caps admit
  // only the brightest dawn/dusk facets; real cloud shells and fog still
  // occlude them spatially because the star mesh remains depth/fog aware.
  const twilightThresholdCap = input.viewLayer === "subsurface"
    ? 1
    : input.time === "dawn"
      ? 0.86
      : input.time === "dusk"
        ? 0.84
        : 1;
  const threshold = Math.min(opticalThreshold, twilightThresholdCap);
  const limit = finiteCount(input.maximumVisible, plan.stars.length);
  const atmosphericNebulaeVisible = input.precipitation === "none"
    && input.clouds !== "overcast"
    && input.time !== "day";
  const admittedNebulae = input.viewLayer === "subsurface"
    ? input.subsurfaceOptics?.activeBodyVisible && input.subsurfaceOptics.nebulaTransmission
      // Every harmonic field has global support above the horizon. Calm clear
      // water admits at most one exceptional field before point-level clipping.
      ? plan.nebulae.slice(0, 1)
      : []
    : atmosphericNebulaeVisible
      // Descriptive fields are interleaved through one continuous spherical
      // canopy, so every field contributes above-horizon points. Geometric
      // clipping below still removes the actual points beneath the horizon.
      ? plan.nebulae
      : [];
  const visibleNebulaIds = new Set(admittedNebulae.map((nebula) => nebula.id));
  const aboveHorizonStars = input.viewLayer === "stars" ? plan.stars : plan.stars.filter((star) => star.y > 0);
  const eligibleStars = input.viewLayer === "subsurface"
    && (!input.subsurfaceOptics?.surfaceApertureOpen || !input.subsurfaceOptics.activeBodyVisible)
    ? []
    : aboveHorizonStars.filter((star) => (
      star.population === "field" || (star.nebulaId !== undefined && visibleNebulaIds.has(star.nebulaId))
    ));
  const stars = eligibleStars
    .filter((star) => star.brightness >= threshold)
    .sort((left, right) => right.brightness - left.brightness)
    .slice(0, limit)
    .flatMap((star) => {
      if (input.viewLayer !== "subsurface") return [star];
      const refracted = refractSkyDirection(star);
      if (!refracted) return [];
      const radius = Math.hypot(star.x, star.y, star.z);
      return [{
        ...star,
        x: refracted.x * radius,
        y: refracted.y * radius,
        z: refracted.z * radius,
        scale: star.scale * (0.72 + (input.subsurfaceOptics?.transmittance ?? 0) * 0.28),
        brightness: star.brightness * (0.42 + (input.subsurfaceOptics?.transmittance ?? 0) * 0.58),
      }];
    });
  const representedNebulaIds = new Set(stars.flatMap((star) => star.nebulaId ? [star.nebulaId] : []));
  const nebulae = admittedNebulae.filter((nebula) => representedNebulaIds.has(nebula.id));
  return {
    ...plan,
    appearance: input.viewLayer === "subsurface" ? "direct through the water surface" : "direct sky",
    stars,
    nebulae,
    counts: summarizeStars(stars),
  };
}

type StarBatchRuntime = {
  mesh: THREE.InstancedMesh;
  material: THREE.ShaderMaterial;
};

export type StarfieldRuntime = {
  root: THREE.Group;
  plan: StarfieldPlan;
  starBatches: StarBatchRuntime[];
  /** Real harmonic-field metadata. Nebulae add no separate screen geometry. */
  nebulae: StarfieldNebula[];
};

function unitHash(star: StarfieldStar, salt: number) {
  const value = Math.sin(
    star.x * 12.9898 + star.y * 78.233 + star.z * 37.719 + star.rotation * 19.19 + salt,
  ) * 43_758.5453;
  return value - Math.floor(value);
}

export type StarWanderProfile = Readonly<{
  clockPhase: number;
  seed: number;
  frequency: number;
  amplitude: number;
}>;

function wanderHash(value: number) {
  let hashed = fractional(value * 0.1031);
  hashed *= hashed + 33.33;
  hashed *= hashed + hashed;
  return fractional(hashed);
}

function wanderTarget(cell: number, seed: number) {
  return {
    x: wanderHash(cell + seed * 1.37 + 0.17) * 2 - 1,
    y: wanderHash(cell + seed * 2.11 + 7.31) * 2 - 1,
    z: wanderHash(cell + seed * 3.17 + 17.73) * 2 - 1,
  };
}

function sampledWander(clock: number, seed: number) {
  const cell = Math.floor(clock);
  const unit = fractional(clock);
  const eased = unit * unit * (3 - 2 * unit);
  const current = wanderTarget(cell, seed);
  const next = wanderTarget(cell + 1, seed);
  return {
    x: current.x + (next.x - current.x) * eased,
    y: current.y + (next.y - current.y) * eased,
    z: current.z + (next.z - current.z) * eased,
  };
}

/** CPU mirror of the shader's independently targeted, non-orbital wander.
 * Time zero is the exact rest pose and every component stays within the
 * declared amplitude from that pose. */
export function sampleStarWander(profile: StarWanderProfile, elapsed: number) {
  const clockOrigin = profile.clockPhase * 2.705;
  const origin = sampledWander(clockOrigin, profile.seed);
  const current = sampledWander(clockOrigin + Math.max(0, elapsed) * profile.frequency, profile.seed);
  const scale = Math.max(0, profile.amplitude) * 0.5;
  return {
    x: (current.x - origin.x) * scale,
    y: (current.y - origin.y) * scale,
    z: (current.z - origin.z) * scale,
  };
}

function starGeometry() {
  const core = new THREE.OctahedronGeometry(0.82, 0);
  const halo = new THREE.OctahedronGeometry(STARFIELD_LIMITS.haloRadius, 0);
  const corePosition = core.getAttribute("position") as THREE.BufferAttribute;
  const haloPosition = halo.getAttribute("position") as THREE.BufferAttribute;
  const position = new Float32Array((corePosition.count + haloPosition.count) * 3);
  position.set(corePosition.array as ArrayLike<number>);
  position.set(haloPosition.array as ArrayLike<number>, corePosition.count * 3);

  const facetLayer = new Float32Array(corePosition.count + haloPosition.count);
  facetLayer.fill(1, corePosition.count);
  const geometry = new THREE.BufferGeometry();
  geometry.name = "paired-octahedral-star-core-and-halo";
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geometry.setAttribute("aFacetHalo", new THREE.BufferAttribute(facetLayer, 1));
  geometry.computeVertexNormals();
  core.dispose();
  halo.dispose();
  return geometry;
}

function facetedPointMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      { uTime: { value: 0 } },
    ]),
    vertexShader: `
      attribute vec4 aTwinkleProfile;
      attribute vec4 aShiftProfile;
      attribute float aBaseAlpha;
      attribute float aFacetHalo;
      varying vec3 vPointColor;
      varying vec3 vViewNormal;
      varying float vAlpha;
      varying float vFacetHalo;
      uniform float uTime;
      #include <fog_pars_vertex>

      float wanderHash(float value) {
        float hashed = fract(value * 0.1031);
        hashed *= hashed + 33.33;
        hashed *= hashed + hashed;
        return fract(hashed);
      }

      vec3 wanderTarget(float cell, float seed) {
        return vec3(
          wanderHash(cell + seed * 1.37 + 0.17),
          wanderHash(cell + seed * 2.11 + 7.31),
          wanderHash(cell + seed * 3.17 + 17.73)
        ) * 2.0 - 1.0;
      }

      vec3 sampledWander(float clock, float seed) {
        float cell = floor(clock);
        float unit = fract(clock);
        float eased = unit * unit * (3.0 - 2.0 * unit);
        return mix(wanderTarget(cell, seed), wanderTarget(cell + 1.0, seed), eased);
      }

      void main() {
        float phase = aTwinkleProfile.x;
        float frequency = aTwinkleProfile.y;
        float primary = sin(uTime * 6.28318530718 * frequency + phase);
        float irregular = sin(uTime * 6.28318530718 * frequency * 0.613 + phase * 1.71);
        float crystalline = sin(uTime * 6.28318530718 * frequency * 1.731 + phase * 0.47);
        float shimmer = primary * 0.55 + irregular * 0.28 + crystalline * 0.17;
        float pulse = 1.0 + shimmer * aTwinkleProfile.w;
        vec4 instancePosition = instanceMatrix * vec4(position * pulse, 1.0);
        // Independently hashed targets create a bounded, non-periodic pocket
        // wander. Subtracting the time-zero sample preserves the exact rest
        // pose without an orbit, directional stream, trail, string, or curl.
        float clockOrigin = aShiftProfile.x * 2.705;
        vec3 shift = (
          sampledWander(clockOrigin + uTime * aShiftProfile.z, aShiftProfile.y)
            - sampledWander(clockOrigin, aShiftProfile.y)
        ) * (aShiftProfile.w * 0.5);
        instancePosition.xyz += shift;
        vec4 mvPosition = modelViewMatrix * instancePosition;
        gl_Position = projectionMatrix * mvPosition;
        vPointColor = instanceColor;
        vViewNormal = normalize(normalMatrix * mat3(instanceMatrix) * normal);
        vAlpha = aBaseAlpha * (1.0 + shimmer * aTwinkleProfile.z);
        vFacetHalo = aFacetHalo;
        #include <fog_vertex>
      }
    `,
    fragmentShader: `
      varying vec3 vPointColor;
      varying vec3 vViewNormal;
      varying float vAlpha;
      varying float vFacetHalo;
      #include <fog_pars_fragment>

      void main() {
        float facetLight = 0.42 + abs(vViewNormal.z) * 0.58;
        // The second octahedral skin is a visible native-colour crystalline
        // flash, not a soft sprite or white bloom. It shares the core's depth,
        // instance, and slow twinkle, so the complete canopy remains one draw.
        float shell = step(0.5, vFacetHalo);
        float layerLight = mix(facetLight, 0.54 + abs(vViewNormal.z) * 0.32, shell);
        float layerAlpha = mix(
          clamp(vAlpha, 0.0, 1.0),
          clamp(vAlpha * ${STARFIELD_LIMITS.haloAlphaFactor.toFixed(2)}, 0.0, ${STARFIELD_LIMITS.maxHaloAlpha.toFixed(2)}),
          shell
        );
        gl_FragColor = vec4(vPointColor * layerLight, layerAlpha);
        #include <fog_fragment>
      }
    `,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    fog: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

function createStarBatches(plan: StarfieldPlan, root: THREE.Group) {
  if (plan.stars.length === 0) return [];
  const geometry = starGeometry();
  const twinkleProfiles = new Float32Array(plan.stars.length * 4);
  const shiftProfiles = new Float32Array(plan.stars.length * 4);
  const baseAlphas = new Float32Array(plan.stars.length);
  geometry.setAttribute("aTwinkleProfile", new THREE.InstancedBufferAttribute(twinkleProfiles, 4));
  geometry.setAttribute("aShiftProfile", new THREE.InstancedBufferAttribute(shiftProfiles, 4));
  geometry.setAttribute("aBaseAlpha", new THREE.InstancedBufferAttribute(baseAlphas, 1));

  const material = facetedPointMaterial();
  const mesh = new THREE.InstancedMesh(geometry, material, plan.stars.length);
  mesh.name = "distant-faceted-star-points";
  mesh.frustumCulled = false;
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const scale = new THREE.Vector3();
  const position = new THREE.Vector3();
  const color = new THREE.Color();
  const palette = STAR_PALETTES[plan.theme];
  plan.stars.forEach((star, index) => {
    const profileOffset = index * 4;
    const profileHash = unitHash(star, 0.17);
    twinkleProfiles[profileOffset] = star.rotation + unitHash(star, 2.31) * Math.PI * 2;
    twinkleProfiles[profileOffset + 1] = STARFIELD_LIMITS.minTwinkleHz
      + profileHash * (STARFIELD_LIMITS.maxTwinkleHz - STARFIELD_LIMITS.minTwinkleHz);
    twinkleProfiles[profileOffset + 2] = 0.18
      + unitHash(star, 4.91) * (STARFIELD_LIMITS.maxTwinkleAmplitude - 0.18);
    twinkleProfiles[profileOffset + 3] = 0.1
      + unitHash(star, 7.73) * (STARFIELD_LIMITS.maxPulseAmplitude - 0.1);
    shiftProfiles[profileOffset] = unitHash(star, 9.17) * Math.PI * 2;
    shiftProfiles[profileOffset + 1] = unitHash(star, 10.37) * Math.PI * 2;
    shiftProfiles[profileOffset + 2] = STARFIELD_LIMITS.minShiftHz
      + unitHash(star, 11.21) * (STARFIELD_LIMITS.maxShiftHz - STARFIELD_LIMITS.minShiftHz);
    shiftProfiles[profileOffset + 3] = star.motion === "swirling"
      ? STARFIELD_LIMITS.minShiftWorldUnits
        + unitHash(star, 12.43) * (STARFIELD_LIMITS.maxShiftWorldUnits - STARFIELD_LIMITS.minShiftWorldUnits)
      : 0;
    const prominenceBoost = star.prominence === "jewel" ? 0.1 : 0;
    baseAlphas[index] = Math.min(0.98, prominenceBoost + (star.population === "nebula"
      ? 0.39 + star.brightness * 0.57
      : 0.34 + star.brightness * 0.58));
    position.set(star.x, star.y, star.z);
    euler.set(star.rotation, star.rotation * 0.61, star.rotation * 1.37);
    quaternion.setFromEuler(euler);
    scale.set(star.scale, star.scale * 0.94, star.scale * 0.86);
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(index, matrix);
    mesh.setColorAt(index, color.setHex(palette[star.colorIndex % palette.length]));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  // Negative transparent order lets atmospheric and water surfaces composite
  // over the canopy. Opaque vessels and aircraft also occlude it via depth.
  mesh.renderOrder = -20;
  root.add(mesh);
  return [{ mesh, material }];
}

export function createStarfield(scene: THREE.Scene, plan: StarfieldPlan): StarfieldRuntime {
  const root = new THREE.Group();
  root.name = "procedural-starfield";
  scene.add(root);
  const starBatches = createStarBatches(plan, root);
  const nebulae = plan.nebulae;
  return { root, plan, starBatches, nebulae };
}

/**
 * Motion uses independently phased 0.22–0.72 Hz crystalline scintillation and
 * a 2.8–9.6-world-unit per-axis bounded positional shift at distant radii.
 * Reduced-motion mode uses the exact deterministic initial frame and performs
 * no twinkle or rotation at all.
 */
export function updateStarfield(
  runtime: StarfieldRuntime | null,
  elapsed: number,
  reducedMotion: boolean,
  cameraPosition?: THREE.Vector3,
) {
  if (!runtime) return;
  const time = reducedMotion ? 0 : Math.max(0, elapsed);
  if (cameraPosition) runtime.root.position.copy(cameraPosition);
  runtime.starBatches.forEach((batch) => {
    batch.material.uniforms.uTime.value = time;
  });
}

export function describeStarfield(plan: StarfieldPlan) {
  const opticalLabel = plan.appearance === "direct through the water surface"
    ? " These are direct refracted sightlines through the water surface, not reflections."
    : "";
  return `${plan.stars.length} brightness-qualified, artistically enlarged faceted lights spanning radically layered near and far depth, forming one continuous sky-covering white-dominant crystalline canopy with restrained pale cyan, lavender, rose, peach, mint, gold, and jewel-color accents. Abundant irregular glints and occasional larger white jewel facets each carry a visible native-color angular halo; ${plan.counts.nebula} clustered points overlap across ${plan.nebulae.length} real irregular low-frequency harmonic density and luminance fields without separate oval panels, painted clouds, radial kernels, hard islands, or empty gaps. Exuberant independent non-flashing scintillation, strong size breathing, and emphatic bounded non-orbital positional wandering honor reduced-motion preferences without loops, trails, lines, or curls, while scene depth and atmospheric fog keep the canopy behind clouds, waves, vessels, and aircraft.${opticalLabel}`;
}
