import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { sampleStarShimmer, STAR_SHIMMER_GLSL } from "../app/starPulse";
import { createStarfield, type StarfieldPlan } from "../app/starfield";

test("shared shimmer retains the historical star waveform and arithmetic order", () => {
  for (const elapsed of [0, 0.01, 2, 37, 5000]) for (const phase of [0, 0.7, Math.PI, 6]) for (const frequency of [0.22, 0.24, 0.72]) {
    const primary = Math.sin(elapsed * 6.28318530718 * frequency + phase);
    const irregular = Math.sin(elapsed * 6.28318530718 * frequency * 0.613 + phase * 1.71);
    const crystalline = Math.sin(elapsed * 6.28318530718 * frequency * 1.731 + phase * 0.47);
    const original = primary * 0.55 + irregular * 0.28 + crystalline * 0.17;
    assert.equal(sampleStarShimmer(elapsed, phase, frequency), original);
    assert.ok(Math.abs(original) <= 1);
  }
  assert.equal(sampleStarShimmer(NaN, 1, 0.24), 0);
  assert.equal(sampleStarShimmer(1, Infinity, 0.24), 0);
  assert.equal(sampleStarShimmer(1, 1, Infinity), 0);
  assert.match(STAR_SHIMMER_GLSL, /elapsed \* 6\.28318530718 \* frequency \* 0\.613 \+ phase \* 1\.71/);
  assert.match(STAR_SHIMMER_GLSL, /elapsed \* 6\.28318530718 \* frequency \* 1\.731 \+ phase \* 0\.47/);
  assert.match(STAR_SHIMMER_GLSL, /return primary \* 0\.55 \+ irregular \* 0\.28 \+ crystalline \* 0\.17/);
});

test("the canonical star material invokes the same shared shimmer primitive", () => {
  const plan: StarfieldPlan = {
    seed: 1, theme: "dark", appearance: "direct sky", nebulae: [],
    counts: { near: 1, far: 0, still: 1, swirling: 0, field: 1, nebula: 0 },
    stars: [{ x: 0, y: 100, z: 0, scale: 0.5, colorIndex: 0, depth: "near", motion: "still", population: "field", prominence: "ambient", twinkleBand: 0, rotation: 0, brightness: 0.5 }],
  };
  const runtime = createStarfield(new THREE.Scene(), plan);
  const batch = runtime.starBatches[0];
  assert.ok(batch.material.vertexShader.includes(STAR_SHIMMER_GLSL));
  assert.match(batch.material.vertexShader, /float shimmer = sampleStarShimmer\(uTime, phase, frequency\)/);
  batch.mesh.geometry.dispose(); batch.material.dispose(); batch.mesh.dispose();
});
