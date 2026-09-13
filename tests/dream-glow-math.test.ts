import assert from "node:assert/strict";
import test from "node:test";
import {
  DREAM_GLOW_MODEL, DREAM_GLOW_TAPS, compactGlowKernel, createGlowTaps,
  dreamGlowBreathing, glowLuminanceShoulder, projectedGlowReference, referenceGlowEdge,
} from "../app/dreamGlowMath";

test("NDCG/H03-H07: normalized positive finite kernel with centered symmetric support", () => {
  assert.equal(DREAM_GLOW_TAPS.length, 109);
  assert.ok(Math.abs(DREAM_GLOW_TAPS.reduce((sum, tap) => sum + tap.weight, 0) - 1) < 1e-12);
  for (const tap of DREAM_GLOW_TAPS) {
    assert.ok(tap.weight > 0 && Math.hypot(tap.x, tap.y) < 3);
    const opposite = DREAM_GLOW_TAPS.find((other) => other.x === -tap.x && other.y === -tap.y);
    assert.equal(opposite?.weight, tap.weight);
  }
  assert.equal(compactGlowKernel(3), 0);
  assert.equal(compactGlowKernel(300), 0);
});

test("NDCG/H07: compact taper is continuous at 2.5 sigma and zero-slope at 3 sigma", () => {
  const h = 1e-5;
  assert.ok(Math.abs(compactGlowKernel(2.5 - h) - compactGlowKernel(2.5 + h)) < 3e-6);
  assert.ok(compactGlowKernel(3 - h) / h < 1e-5);
  assert.equal(compactGlowKernel(3 + h), 0);
});

test("NDCG/Q08: malformed kernel settings fail closed", () => {
  for (const value of [NaN, Infinity, -1]) assert.equal(compactGlowKernel(value), 0);
  for (const value of [NaN, Infinity, -1, 0, 0.1, 1]) assert.throws(() => createGlowTaps(value), RangeError);
  assert.throws(() => referenceGlowEdge(NaN), RangeError);
  assert.throws(() => referenceGlowEdge(0.1, 10_000), RangeError);
});

test("NDCG/H05-H08: radius, gain, and mixture weights have independent roles", () => {
  assert.deepEqual(DREAM_GLOW_MODEL.sigmaRatios, [0.012, 0.035, 0.075]);
  assert.deepEqual(DREAM_GLOW_MODEL.weights, [0.65, 0.30, 0.05]);
  assert.equal(DREAM_GLOW_MODEL.gain, 0.28);
  assert.equal(DREAM_GLOW_MODEL.weights.reduce((a, b) => a + b), 1);
});

test("NDCG/Q01-Q03: independent numerical edge oracle rejects absent glow and broad blobs", () => {
  const edge = referenceGlowEdge(0);
  const near = referenceGlowEdge(0.01);
  const gap = 2 * referenceGlowEdge(0.05);
  const far = referenceGlowEdge(0.10);
  assert.ok(Math.abs(edge - 0.14) < 1e-9);
  assert.ok(near >= 0.05 && near <= 0.10, `near=${near}`);
  assert.ok(gap <= 0.025, `gap=${gap}`);
  assert.ok(far <= 0.002, `far=${far}`);
  assert.equal(referenceGlowEdge(0.225), 0);
});

test("NDCG/T02-T04: bounded gain-only motion and exact steady reduced-motion state", () => {
  for (let t = 0; t <= 1000; t += 0.25) {
    const a = dreamGlowBreathing(t, 0.3, 0.7, false);
    const b = dreamGlowBreathing(t + 0.01, 0.3, 0.7, false);
    assert.ok(a >= 0.97 && a <= 1.03);
    assert.ok(Math.abs(b - a) / 0.01 <= 0.005391);
    assert.equal(dreamGlowBreathing(t, 0.3, 0.7, true), 1);
  }
  assert.equal(dreamGlowBreathing(NaN, 0, 0, false), 1);
  assert.ok(Number.isFinite(dreamGlowBreathing(1e308, 1e308, 1e308, false)));
});

test("NDCG/T03: elapsed-time sampling is independent of frame cadence", () => {
  const at60Hz = dreamGlowBreathing(1800 / 60, 1, 2, false);
  const at120Hz = dreamGlowBreathing(3600 / 120, 1, 2, false);
  assert.equal(at60Hz, at120Hz);
  assert.notEqual(at60Hz, dreamGlowBreathing(30, 2, 1, false));
});

test("NDCG/R01-R04: projected scale changes with distance and pixel density, not a minimum bead radius", () => {
  assert.equal(projectedGlowReference(2, 10, 2, 1000), 200);
  assert.equal(projectedGlowReference(2, 20, 2, 1000), 100);
  assert.equal(projectedGlowReference(2, 10, 2, 2000), 400);
  assert.equal(projectedGlowReference(0.00001, 10, 2, 1000), 0.001);
  assert.equal(projectedGlowReference(1e308, 1, 1e308, 1000), 0);
  for (const value of [NaN, Infinity, 0, -1]) assert.equal(projectedGlowReference(2, value, 2, 1000), 0);
});

test("NDCG/C05: luminance shoulder is bounded, continuous and preserves low intensities", () => {
  const { luminanceKnee: knee, luminanceCeiling: ceiling } = DREAM_GLOW_MODEL;
  assert.equal(glowLuminanceShoulder(0.02), 0.02);
  assert.equal(glowLuminanceShoulder(knee), knee);
  assert.ok(glowLuminanceShoulder(1_000_000) <= ceiling);
  assert.ok(Math.abs(glowLuminanceShoulder(knee + 1e-5) - (knee + 1e-5)) < 1e-8);
  assert.equal(glowLuminanceShoulder(Infinity), 0);
});
