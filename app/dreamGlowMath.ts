/** NDCG spatial/temporal model. Linear-light inputs; screen-pixel distances.
 * The constants are reconstruction parameters, not recovered game shaders.
 */
export const DREAM_GLOW_MODEL = Object.freeze({
  version: "ndcg-0.1-native-color",
  sigmaRatios: Object.freeze([0.012, 0.035, 0.075]),
  weights: Object.freeze([0.65, 0.30, 0.05]),
  gain: 0.28,
  supportSigmas: 3,
  taperStart: 2.5,
  primaryPeriod: 31,
  secondaryPeriod: 47,
  luminanceKnee: 0.22,
  luminanceCeiling: 0.35,
});

export type GlowTap = Readonly<{ x: number; y: number; weight: number }>;

export function compactGlowKernel(radiusInSigmas: number): number {
  if (!Number.isFinite(radiusInSigmas) || radiusInSigmas < 0) return 0;
  if (radiusInSigmas >= DREAM_GLOW_MODEL.supportSigmas) return 0;
  const t = Math.max(0, (radiusInSigmas - DREAM_GLOW_MODEL.taperStart) / 0.5);
  const window = 1 - t * t * (3 - 2 * t);
  return Math.exp(-0.5 * radiusInSigmas * radiusInSigmas) * window;
}

/** Symmetric finite quadrature, normalized BEFORE any visibility rejection.
 * This is a sampled radial kernel, not a square/separable blur or a disk mask.
 */
export function createGlowTaps(step = 0.5): readonly GlowTap[] {
  if (!Number.isFinite(step) || step < 0.25 || step > 0.5) throw new RangeError("Invalid glow quadrature step");
  const taps: GlowTap[] = [];
  const extent = Math.ceil(DREAM_GLOW_MODEL.supportSigmas / step);
  let mass = 0;
  for (let y = -extent; y <= extent; y++) {
    for (let x = -extent; x <= extent; x++) {
      const weight = compactGlowKernel(Math.hypot(x * step, y * step));
      if (weight === 0) continue;
      taps.push({ x: x * step, y: y * step, weight });
      mass += weight;
    }
  }
  return Object.freeze(taps.map((tap) => Object.freeze({ ...tap, weight: tap.weight / mass })));
}

export const DREAM_GLOW_TAPS = createGlowTaps();

export function dreamGlowBreathing(elapsed: number, primaryPhase: number, secondaryPhase: number, reducedMotion: boolean): number {
  if (reducedMotion) return 1;
  if (![elapsed, primaryPhase, secondaryPhase].every(Number.isFinite)) return 1;
  const t = Math.max(0, elapsed);
  return 1 + 0.02 * Math.sin((t % DREAM_GLOW_MODEL.primaryPeriod) * Math.PI * 2 / DREAM_GLOW_MODEL.primaryPeriod + primaryPhase % (Math.PI * 2))
    + 0.01 * Math.sin((t % DREAM_GLOW_MODEL.secondaryPeriod) * Math.PI * 2 / DREAM_GLOW_MODEL.secondaryPeriod + secondaryPhase % (Math.PI * 2));
}

export function glowLuminanceShoulder(luminance: number): number {
  if (!Number.isFinite(luminance) || luminance < 0) return 0;
  const { luminanceKnee: knee, luminanceCeiling: ceiling } = DREAM_GLOW_MODEL;
  return luminance <= knee ? luminance : knee + (ceiling - knee) * (1 - Math.exp(-(luminance - knee) / (ceiling - knee)));
}

export function projectedGlowReference(worldDiameter: number, viewDepth: number, projectionY: number, viewportHeight: number): number {
  if (![worldDiameter, viewDepth, projectionY, viewportHeight].every((value) => Number.isFinite(value) && value > 0)) return 0;
  const projected = worldDiameter * projectionY * viewportHeight / (2 * viewDepth);
  return Number.isFinite(projected) ? projected : 0;
}

/** Test oracle: integrate the radial field outside a uniform straight edge.
 * Deliberately independent of GPU tap generation, so a bad quadrature cannot
 * certify itself. The integration is in sigma-normalized coordinates.
 */
export function referenceGlowEdge(distanceOverHeight: number, resolution = 320): number {
  if (!Number.isFinite(distanceOverHeight) || distanceOverHeight < 0 || !Number.isInteger(resolution) || resolution < 32 || resolution > 1024) {
    throw new RangeError("Invalid glow edge fixture");
  }
  const step = 6 / resolution;
  let result = 0;
  for (let k = 0; k < DREAM_GLOW_MODEL.weights.length; k++) {
    const boundary = distanceOverHeight / DREAM_GLOW_MODEL.sigmaRatios[k];
    let total = 0;
    let exterior = 0;
    for (let yi = 0; yi < resolution; yi++) {
      const y = -3 + (yi + 0.5) * step;
      for (let xi = 0; xi < resolution; xi++) {
        const x = -3 + (xi + 0.5) * step;
        const weight = compactGlowKernel(Math.hypot(x, y));
        total += weight;
        // Fraction of this integration cell on the emitting half-plane.
        exterior += weight * Math.max(0, Math.min(1, (x + step / 2 - boundary) / step));
      }
    }
    result += DREAM_GLOW_MODEL.weights[k] * exterior / total;
  }
  return DREAM_GLOW_MODEL.gain * result;
}
