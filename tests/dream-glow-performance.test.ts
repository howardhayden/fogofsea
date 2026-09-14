import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { DreamGlowRenderer } from "../app/dreamGlowRenderer";
import { attachDreamEmission, createDreamEmissionProfile, detachDreamEmission } from "../app/dreamEmission";
import { advanceRenderDeadline } from "../app/visualPerformance";

// No GL is needed to verify ownership. The browser test separately exercises
// allocations, real shader compilation, and complete pixel equivalence.
function stubRenderer(): THREE.WebGLRenderer {
  return { extensions: { has: () => true }, capabilities: { maxSamples: 4 },
    getContext: () => ({ getContextAttributes: () => ({ alpha: true }) }),
  } as unknown as THREE.WebGLRenderer;
}

test("PERF-GLOW-01: scene replacement retains GPU-target and full-screen-material ownership", () => {
  const renderer = new DreamGlowRenderer(stubRenderer(), []);
  const retained = ["base", "emission", "accumulation", "glowMaterial", "compositeMaterial"];
  const resources = retained.map((key) => Reflect.get(renderer, key));
  const disposal = resources.map(() => 0);
  resources.forEach((resource, index) => resource.addEventListener("dispose", () => { disposal[index]++; }));
  for (let i = 0; i < 25; i++) {
    const group = new THREE.Group();
    const geometry = new THREE.BoxGeometry(1, 0.2, 3);
    const material = new THREE.MeshStandardMaterial({ color: 0x538781, metalness: 0.4, roughness: 0.3 });
    group.add(new THREE.Mesh(geometry, material));
    attachDreamEmission(group, createDreamEmissionProfile(i, "night", "ship"));
    renderer.setSubjects([group]);
    assert.equal(Reflect.get(renderer, "subjects").length, 1);
    renderer.clearSubjects();
    assert.equal(Reflect.get(renderer, "subjects").length, 0);
    resources.forEach((resource, index) => assert.equal(Reflect.get(renderer, retained[index]), resource));
    assert.deepEqual(disposal, [0, 0, 0, 0, 0]);
    detachDreamEmission(group); geometry.dispose(); material.dispose();
  }
  renderer.dispose(); renderer.dispose();
  assert.deepEqual(disposal, [1, 1, 1, 1, 1]);
  assert.throws(() => renderer.setSubjects([]), /disposed/);
});

for (const hz of [60, 90, 120]) test(`PERF-GLOW-02: quantized ${hz} Hz callbacks retain a 30 Hz render phase`, () => {
  const frames: number[] = []; let next = 0;
  for (let i = 1; i <= hz * 20; i++) {
    const timestamp = Math.round(i * 1000 / hz);
    if (timestamp + 1 < next) continue;
    next = advanceRenderDeadline(next, Math.max(timestamp, next), 30);
    frames.push(timestamp);
  }
  assert.ok(Math.abs(frames.length - 600) <= 1);
  assert.ok(Math.max(...frames.slice(1).map((t, i) => t - frames[i])) <= 35);
});

test("PERF-GLOW-03: a stalled/background frame skips missed deadlines, not a burst of catch-up draws", () => {
  const next = advanceRenderDeadline(100, 10000, 30);
  assert.ok(next > 10000 && next <= 10000 + 1000 / 30 + 1e-9);
});
