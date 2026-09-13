/** NDCG v0.1 spatial model. Values are reconstruction parameters, not game shader data. */
export const DREAM_GLOW_MODEL = Object.freeze({
  version: "ndcg-0.1-native",
  rho: Object.freeze([0.012, 0.035, 0.075] as const),
  weights: Object.freeze([0.65, 0.30, 0.05] as const),
  gain: 0.28,
  taperStart: 2.5,
  support: 3,
  knee: 0.3,
  ceiling: 0.5,
  captureReferencePixels: 48,
  captureSize: 128,
});

export function requireFinite(value: number, name: string, minimum = 0) {
  if (!Number.isFinite(value) || value < minimum) throw new RangeError(`${name} must be finite and >= ${minimum}`);
  return value;
}

export function compactGaussian(radiusInSigma: number) {
  requireFinite(radiusInSigma, "radiusInSigma");
  if (radiusInSigma >= 3) return 0;
  const s = Math.max(0, (radiusInSigma - 2.5) / 0.5);
  return Math.exp(-0.5 * radiusInSigma * radiusInSigma) * (1 - s * s * (3 - 2 * s));
}

/** Discrete, normalized radial kernel; no square-tail/separable substitution. */
export function createDreamGlowKernel(referencePixels: number = DREAM_GLOW_MODEL.captureReferencePixels) {
  requireFinite(referencePixels, "referencePixels", 1);
  if (referencePixels > 48) throw new RangeError("The qualified capture reference is at most 48 pixels");
  const radius = Math.ceil(3 * DREAM_GLOW_MODEL.rho[2] * referencePixels);
  const width = radius * 2 + 1;
  const data = new Float32Array(width * width);
  DREAM_GLOW_MODEL.rho.forEach((rho, layer) => {
    const sigma = referencePixels * rho;
    const values = new Float64Array(data.length);
    let mass = 0;
    for (let y = -radius; y <= radius; y++) {
      for (let x = -radius; x <= radius; x++) {
        const index = (y + radius) * width + x + radius;
        const value = compactGaussian(Math.hypot(x, y) / sigma);
        values[index] = value;
        mass += value;
      }
    }
    for (let index = 0; index < data.length; index++) data[index] += values[index] / mass * DREAM_GLOW_MODEL.weights[layer];
  });
  return { data, radius, width, referencePixels };
}

export function dreamGlowShoulder(luminance: number, knee: number = DREAM_GLOW_MODEL.knee, ceiling: number = DREAM_GLOW_MODEL.ceiling) {
  requireFinite(luminance, "luminance");
  requireFinite(knee, "knee");
  requireFinite(ceiling, "ceiling");
  if (ceiling <= knee) throw new RangeError("ceiling must exceed knee");
  return luminance <= knee ? luminance : knee + (ceiling - knee) * -Math.expm1(-(luminance - knee) / (ceiling - knee));
}

export function sampleDreamGlowPulse(elapsed: number, primaryPhase: number, secondaryPhase: number, reducedMotion: boolean) {
  requireFinite(primaryPhase, "primaryPhase");
  requireFinite(secondaryPhase, "secondaryPhase");
  if (reducedMotion) return 1;
  const t = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
  return 1 + 0.02 * Math.sin(2 * Math.PI * (t % 31) / 31 + primaryPhase)
    + 0.01 * Math.sin(2 * Math.PI * (t % 47) / 47 + secondaryPhase);
}
