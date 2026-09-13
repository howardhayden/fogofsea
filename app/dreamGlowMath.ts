/** SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
 * NDCG v0.1: proposed reconstruction, not the original game's shader.
 * Pure reference math is intentionally independent of Three.js and the GPU.
 */
export const NDCG_SEED = Object.freeze({
  ratios: Object.freeze([0.012, 0.035, 0.075] as const),
  weights: Object.freeze([0.65, 0.30, 0.05] as const),
  gain: 0.28,
  knee: 0.30,
  cap: 0.50,
  support: 3,
});

export function finite(value: number, name: string, minimum = -Infinity): number {
  if (!Number.isFinite(value) || value < minimum) throw new RangeError(`${name} must be finite and >= ${minimum}`);
  return value;
}

export function compactTaper(q: number): number {
  finite(q, "kernel distance", 0);
  if (q <= 2.5) return 1;
  if (q >= 3) return 0;
  const s = (q - 2.5) / 0.5;
  return 1 - s * s * (3 - 2 * s);
}

function radialDensity(q: number): number {
  return q * Math.exp(-q * q / 2) * compactTaper(q);
}

// A single deterministic CDF serves both the quadrature and numerical oracle.
const steps = 4096;
const dq = 3 / steps;
const cdf = new Float64Array(steps + 1);
for (let i = 1; i <= steps; i++) {
  cdf[i] = cdf[i - 1] + (radialDensity((i - 1) * dq) + radialDensity(i * dq)) * dq / 2;
}
export const COMPACT_KERNEL_MASS = 2 * Math.PI * cdf[steps];
for (let i = 0; i <= steps; i++) cdf[i] /= cdf[steps] || 1;

export function compactKernel(x: number, y: number, sigma: number): number {
  finite(x, "x"); finite(y, "y"); finite(sigma, "sigma", Number.MIN_VALUE);
  const q = Math.hypot(x, y) / sigma;
  return q >= 3 ? 0 : Math.exp(-q * q / 2) * compactTaper(q) / (COMPACT_KERNEL_MASS * sigma * sigma);
}

export type KernelTap = Readonly<{ x: number; y: number; weight: number }>;
/** Positive, centered radial quadrature. Radius samples follow the *tapered*
 * radial mass, not a uniform disk. Every ring has antipodal pairs, unit total
 * mass, zero first moment, and equal x/y second moments. Never random per frame.
 * This is an approximation qualified by pixel output, not by its sample count.
 */
export function createKernelQuadrature(rings = 8, angles = 16): readonly KernelTap[] {
  if (!Number.isInteger(rings) || rings < 1 || rings > 64 || !Number.isInteger(angles) || angles < 4 || angles > 64 || angles % 2) {
    throw new RangeError("kernel quadrature requires 1..64 rings and an even 4..64 angular count");
  }
  const taps: KernelTap[] = [];
  for (let ring = 0; ring < rings; ring++) {
    const probability = (ring + 0.5) / rings;
    let lo = 0; let hi = steps;
    while (hi - lo > 1) { const mid = (lo + hi) >>> 1; if (cdf[mid] < probability) lo = mid; else hi = mid; }
    const q = (lo + (probability - cdf[lo]) / (cdf[hi] - cdf[lo])) * dq;
    for (let angle = 0; angle < angles; angle++) {
      const theta = 2 * Math.PI * angle / angles + ring * 2.399963229728653;
      taps.push(Object.freeze({ x: q * Math.cos(theta), y: q * Math.sin(theta), weight: 1 / (rings * angles) }));
    }
  }
  return Object.freeze(taps);
}

export const NDCG_KERNEL_TAPS = createKernelQuadrature();

/** Independent radial integral of the uniform half-plane source. */
export function compactEdgeResponse(distanceOverReference: number): number {
  finite(distanceOverReference, "edge distance", 0);
  return NDCG_SEED.gain * NDCG_SEED.ratios.reduce((sum, ratio, layer) => {
    const threshold = distanceOverReference / ratio;
    if (threshold >= 3) return sum;
    let mass = 0;
    for (let i = 1; i <= steps; i++) {
      const q = (i - 0.5) * dq;
      if (q > threshold) mass += radialDensity(q) * Math.acos(threshold / q) / Math.PI * dq;
    }
    return sum + NDCG_SEED.weights[layer] * mass * 2 * Math.PI / COMPACT_KERNEL_MASS;
  }, 0);
}

export function linearLuminance(rgb: readonly number[]): number {
  if (rgb.length !== 3) throw new RangeError("RGB must have three components");
  return finite(rgb[0], "red", 0) * .2126 + finite(rgb[1], "green", 0) * .7152 + finite(rgb[2], "blue", 0) * .0722;
}

export function limitGlow(rgb: readonly number[], knee: number = NDCG_SEED.knee, cap: number = NDCG_SEED.cap): [number, number, number] {
  finite(knee, "knee", 0); finite(cap, "cap", 0);
  if (cap <= knee) throw new RangeError("cap must exceed knee");
  const y = linearLuminance(rgb);
  const limited = y <= knee ? y : knee + (cap - knee) * (1 - Math.exp(-(y - knee) / (cap - knee)));
  const scale = y > 0 ? limited / y : 0;
  return [rgb[0] * scale, rgb[1] * scale, rgb[2] * scale];
}
