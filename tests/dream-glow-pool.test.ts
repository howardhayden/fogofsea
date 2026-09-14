import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { DreamGlowRenderer } from "../app/dreamGlowRenderer";

function stubRenderer(): THREE.WebGLRenderer {
  return { extensions: { has: () => true }, capabilities: { maxSamples: 4 },
    getContext: () => ({ getContextAttributes: () => ({ alpha: true }) }),
  } as unknown as THREE.WebGLRenderer;
}

test("PERF-GLOW-04: source targets reuse exact dimensions without inheriting the largest past crop", () => {
  const renderer = new DreamGlowRenderer(stubRenderer(), []);
  const acquire = Reflect.get(renderer, "acquireSourceTarget").bind(renderer);
  const large = acquire(512, 512); large.used = false;
  const small = acquire(64, 32);
  assert.equal(small.target.width, 64); assert.equal(small.target.height, 32);
  small.used = false;
  assert.equal(acquire(64, 32), small);
  renderer.clearSubjects();
  assert.equal(Reflect.get(renderer, "sourceTargets").length, 2);
  let smallDisposal = 0; let largeDisposal = 0;
  small.target.addEventListener("dispose", () => { smallDisposal++; });
  large.target.addEventListener("dispose", () => { largeDisposal++; });
  renderer.dispose(); renderer.dispose();
  assert.equal(smallDisposal, 1); assert.equal(largeDisposal, 1);
});

test("PERF-GLOW-05: a full source batch defers allocation; unused buffers are evicted within the original ceiling", () => {
  const renderer = new DreamGlowRenderer(stubRenderer(), []);
  const acquire = Reflect.get(renderer, "acquireSourceTarget").bind(renderer);
  const entries = Array.from({ length: 4 }, () => acquire(1024, 1024));
  assert.ok(entries.every(Boolean));
  assert.equal(acquire(1024, 1024), null);
  assert.equal(Reflect.get(renderer, "sourceTargetPixels"), 2048 ** 2);
  let disposed = 0;
  for (const entry of entries) {
    entry.used = false;
    entry.target.addEventListener("dispose", () => { disposed++; });
  }
  assert.ok(acquire(2048, 2048));
  assert.equal(disposed, 4);
  assert.equal(Reflect.get(renderer, "sourceTargetPixels"), 2048 ** 2);
  renderer.dispose();
});
