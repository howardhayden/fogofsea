import assert from "node:assert/strict";
import test from "node:test";
import { compactEdgeResponse, compactKernel, compactTaper, createKernelQuadrature, limitGlow, linearLuminance, NDCG_KERNEL_TAPS } from "../app/dreamGlowMath";

test("compact kernel has unit mass, finite support, a smooth positive tail", () => {
  const step = .002; let mass = 0;
  for (let r = step / 2; r < 3; r += step) mass += 2 * Math.PI * r * compactKernel(r, 0, 1) * step;
  assert.ok(Math.abs(mass - 1) < 1e-5);
  assert.equal(compactKernel(3, 0, 1), 0); assert.equal(compactKernel(40, 0, 1), 0);
  assert.equal(compactTaper(2.5), 1); assert.equal(compactTaper(3), 0);
  assert.ok(compactTaper(2.999) < .00002);
  assert.throws(() => compactKernel(0, 0, 0), RangeError);
});

test("edge oracle includes positive near-light, restrained far-tail, and a dark two-source gap", () => {
  assert.ok(Math.abs(compactEdgeResponse(0) - .14) < 1e-6);
  assert.ok(compactEdgeResponse(.01) > .05 && compactEdgeResponse(.01) < .10);
  assert.ok(compactEdgeResponse(.1) <= .002);
  assert.ok(2 * compactEdgeResponse(.05) <= .025);
  assert.equal(compactEdgeResponse(.225), 0);
  let previous = Infinity;
  for (let d = 0; d < .23; d += .001) { const value = compactEdgeResponse(d); assert.ok(value <= previous); previous = value; }
});

test("production quadrature is positive, deterministic, centered, normalized, and finite", () => {
  assert.deepEqual(NDCG_KERNEL_TAPS, createKernelQuadrature());
  const sum = (f: (v: typeof NDCG_KERNEL_TAPS[number]) => number) => NDCG_KERNEL_TAPS.reduce((a, tap) => a + f(tap), 0);
  assert.ok(Math.abs(sum(t => t.weight) - 1) < 1e-10);
  assert.ok(Math.abs(sum(t => t.weight * t.x)) < 1e-10);
  assert.ok(Math.abs(sum(t => t.weight * t.y)) < 1e-10);
  assert.ok(Math.abs(sum(t => t.weight * (t.x * t.x - t.y * t.y))) < 1e-10);
  assert.ok(NDCG_KERNEL_TAPS.every(t => t.weight > 0 && Math.hypot(t.x, t.y) < 3));
  assert.throws(() => createKernelQuadrature(0, 16), RangeError);
  assert.throws(() => createKernelQuadrature(8, 15), RangeError);
});

test("overlap shoulder preserves RGB ratios without exceeding its luminance cap", () => {
  for (const scale of [.01, .1, 1, 10, 100]) {
    const source = [scale, scale * .4, scale * .2]; const limited = limitGlow(source);
    assert.ok(linearLuminance(limited) <= .5);
    assert.ok(Math.abs(limited[1] / limited[0] - .4) < 1e-10);
    assert.ok(Math.abs(limited[2] / limited[0] - .2) < 1e-10);
  }
  assert.deepEqual(limitGlow([0, 0, 0]), [0, 0, 0]);
  assert.throws(() => limitGlow([NaN, 0, 0]), RangeError);
  assert.throws(() => limitGlow([1, 1, 1], .5, .3), RangeError);
});
