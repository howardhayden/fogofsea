import type { StarfieldPlan, StarfieldStar } from "./starfield";

/** Decorative classes never determine admission, placement, color, or motion. */
export type StarAtmosphereClass = "micro" | "standard" | "accent" | "hero";
export type StarAtmosphereConfig = Readonly<{
  enabled: boolean;
  intensity: number;
  /** Existing small fringe; independent from the broader outer bloom. */
  bloomIntensity: number;
  bloomRadius: number;
  /** Absolute strength and radius of the same star's diffuse outer layer. */
  diffuseIntensity: number;
  diffuseRadius: number;
  edgeSoftness: number;
  irregularity: number;
  chromaticVariance: number;
  twinkleAmount: number;
  heroFrequency: number;
}>;

/** Local tuning surface. A zero intensity or disabled switch uses the exact
 * original geometry, material, and animation path for controlled comparison. */
export const STAR_ATMOSPHERE_DEFAULTS: StarAtmosphereConfig = Object.freeze({
  enabled: true,
  intensity: 1,
  bloomIntensity: 0.055,
  bloomRadius: 3.2,
  diffuseIntensity: 0.165,
  diffuseRadius: 6.4,
  edgeSoftness: 0.38,
  irregularity: 0.16,
  chromaticVariance: 0.06,
  twinkleAmount: 0,
  heroFrequency: 0.02,
});

export const STAR_ATMOSPHERE_BUDGET = Object.freeze({
  additionalVerticesPerStar: 12,
  additionalTrianglesPerStar: 4,
  additionalFloatsPerStar: 4,
  maximumShapeFamilies: 6,
  additionalDrawCalls: 0,
});

function bounded(value: number, fallback: number, minimum: number, maximum: number) {
  return Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, value)) : fallback;
}

export function normalizeStarAtmosphereConfig(config: StarAtmosphereConfig): StarAtmosphereConfig {
  return {
    enabled: config.enabled === true,
    intensity: bounded(config.intensity, 0, 0, 1),
    bloomIntensity: bounded(config.bloomIntensity, 0, 0, 0.12),
    bloomRadius: bounded(config.bloomRadius, 3.2, 1.6, 4.2),
    diffuseIntensity: bounded(config.diffuseIntensity, 0, 0, 0.24),
    diffuseRadius: bounded(config.diffuseRadius, 6.4, 1.6, 8),
    edgeSoftness: bounded(config.edgeSoftness, 0.38, 0.05, 0.7),
    irregularity: bounded(config.irregularity, 0.16, 0, 0.35),
    chromaticVariance: bounded(config.chromaticVariance, 0.06, 0, 0.12),
    twinkleAmount: bounded(config.twinkleAmount, 0, 0, 0.06),
    heroFrequency: bounded(config.heroFrequency, 0.02, 0.01, 0.03),
  };
}

function hash(star: StarfieldStar, salt: number) {
  const value = Math.sin(star.x * 12.9898 + star.y * 78.233 + star.z * 37.719 + star.rotation * 19.19 + salt) * 43_758.5453;
  return value - Math.floor(value);
}

export type StarAtmosphereAdornment = Readonly<{
  starClass: StarAtmosphereClass;
  classIndex: 0 | 1 | 2 | 3;
  strength: number;
  shape: number;
  variation: number;
}>;

/** Rank a separate decorative index, retaining every source star and its exact
 * properties. Heroes are selected only from the existing bright jewel cohort.
 * No random generator used by the canonical field is advanced here. */
export function createStarAtmosphereAdornments(
  plan: StarfieldPlan,
  config: StarAtmosphereConfig = STAR_ATMOSPHERE_DEFAULTS,
): readonly StarAtmosphereAdornment[] {
  const resolved = normalizeStarAtmosphereConfig(config);
  const ranks = plan.stars.map((star, index) => ({ star, index }))
    .sort((left, right) => right.star.brightness - left.star.brightness || left.index - right.index);
  const heroes = new Set(ranks.filter(({ star }) => star.prominence === "jewel")
    .slice(0, Math.round(plan.stars.length * resolved.heroFrequency)).map(({ index }) => index));
  const accents = new Set(ranks.filter(({ index }) => !heroes.has(index))
    .slice(0, Math.round(plan.stars.length * 0.1)).map(({ index }) => index));
  const standards = new Set(ranks.filter(({ index }) => !heroes.has(index) && !accents.has(index))
    .slice(0, Math.round(plan.stars.length * (0.4 - resolved.heroFrequency))).map(({ index }) => index));
  return plan.stars.map((star, index) => {
    const classIndex = heroes.has(index) ? 3 : accents.has(index) ? 2 : standards.has(index) ? 1 : 0;
    const shapeHash = hash(star, 31.71);
    const shape = classIndex === 0 ? 0 : classIndex === 1 ? Math.floor(shapeHash * 2)
      : classIndex === 2 ? 1 + Math.floor(shapeHash * 4) : Math.floor(shapeHash * 6);
    // Low-order directional composition varies only added halo strength. The
    // original harmonic density field, star locations and rhythms are intact.
    const radius = Math.hypot(star.x, star.y, star.z) || 1;
    const cluster = 0.87 + 0.13 * Math.sin(star.x / radius * 3.7 + star.z / radius * 2.3 + plan.seed % 17);
    return {
      starClass: (["micro", "standard", "accent", "hero"] as const)[classIndex],
      classIndex,
      strength: (0.8 + hash(star, 27.19) * 0.2) * cluster,
      shape,
      variation: hash(star, 37.11),
    };
  });
}
