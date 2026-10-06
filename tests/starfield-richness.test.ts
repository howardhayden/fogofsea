import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import {
  createStarfield, createStarfieldPlan, prepareStarfieldForCamera,
  STARFIELD_LIMITS, visibleStarfieldPlan,
} from "../app/starfield";
import { STAR_ATMOSPHERE_DEFAULTS } from "../app/starAtmosphere";
import { createStarPlacements, getSkyVisibility } from "../app/viewModel";

const seeds = [0, 1, 2, 17, 255_880_124, 0x00c0ffee, 0x7fffffff, 0xffffffff,
  ...Array.from({ length: 24 }, (_, index) => Math.imul(index + 1, 0x9e3779b1) >>> 0)];

function completeCanopy(seed: number) {
  return createStarfieldPlan({ seed, theme: "dark", placements: createStarPlacements(seed, 3072), visibleCount: 3072 });
}

test("every Stars view keeps the full authored canopy across time, weather and maximum traffic obscuration", () => {
  const complete = completeCanopy(255_880_124);
  const original = JSON.stringify(complete);
  for (const time of ["dawn", "day", "dusk", "night"] as const) {
    for (const clouds of ["clear", "scattered", "broken", "overcast"] as const) {
      for (const precipitation of ["none", "rain", "snow"] as const) {
        const { starCount } = getSkyVisibility({
          time, clouds, precipitation, visibility: 0,
          aircraftCount: 99, lowSignatureAircraft: 0, vesselCount: 99, lowSignatureVessels: 0,
        });
        const visible = visibleStarfieldPlan(complete, {
          viewLayer: "stars", time, clouds, precipitation, visibility: 0, seaState: 7, maximumVisible: starCount,
        });
        assert.ok(visible === complete, "conditions cannot allocate/re-sort or thin a dedicated Stars canopy");
        assert.equal(visible.stars.length, 15_360);
        assert.equal(visible.nebulae.length, 16);
        assert.equal(visible.counts.nebula, 12_288);
      }
    }
  }
  assert.equal(JSON.stringify(complete), original, "full presentation preserves native positions, brightness, hues and motion");
  const empty = createStarfieldPlan({ seed: 0, theme: "dark", placements: [], visibleCount: 0 });
  assert.equal(visibleStarfieldPlan(empty, {
    viewLayer: "stars", time: "night", clouds: "clear", precipitation: "none", visibility: 18, seaState: 1, maximumVisible: 0,
  }).stars.length, 0, "an intentionally empty source plan does not invent entities");
});

test("32 independent seeds retain dense overlapping coverage, white dominance and native jewels in every sky sector", () => {
  for (const seed of seeds) {
    const complete = completeCanopy(seed);
    const cells = Array.from({ length: 72 }, () => ({ count: 0, fields: new Set<string>() }));
    let white = 0; let pureWhite = 0; let jewels = 0;
    for (const star of complete.stars) {
      const radius = Math.hypot(star.x, star.y, star.z);
      const latitude = Math.min(5, Math.floor((star.y / radius + 1) * 3));
      const longitude = Math.min(11, Math.floor(((Math.atan2(star.z, star.x) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * 12));
      const cell = cells[latitude * 12 + longitude];
      cell.count++;
      if (star.nebulaId) cell.fields.add(star.nebulaId);
      if (star.colorIndex <= STARFIELD_LIMITS.whiteColorIndexMax) white++;
      if (star.colorIndex === 0) pureWhite++;
      if (star.prominence === "jewel") jewels++;
    }
    assert.equal(complete.stars.length, STARFIELD_LIMITS.maxStars);
    for (const [index, cell] of cells.entries()) {
      assert.ok(cell.count >= 100, `seed ${seed}, equal-area sector ${index}: ${cell.count} stars`);
      assert.ok(cell.fields.size >= 14, `seed ${seed}, sector ${index}: ${cell.fields.size} overlapping fields`);
    }
    assert.ok(white / complete.stars.length >= STARFIELD_LIMITS.minWhiteFraction, `seed ${seed}: white-dominant canopy`);
    assert.ok(pureWhite / complete.stars.length >= STARFIELD_LIMITS.minPureWhiteFraction, `seed ${seed}: pure white facets`);
    assert.ok(jewels / complete.stars.length >= STARFIELD_LIMITS.minJewelFraction);
    assert.ok(jewels / complete.stars.length <= STARFIELD_LIMITS.maxJewelFraction);
  }
});

test("full canopies remain one instanced draw with bounded camera submission across seeds and directions", () => {
  for (const seed of seeds.slice(0, 8)) {
    const complete = completeCanopy(seed);
    const runtime = createStarfield(new THREE.Scene(), complete, STAR_ATMOSPHERE_DEFAULTS);
    const mesh = runtime.starBatches[0].mesh;
    const material = runtime.starBatches[0].material;
    const camera = new THREE.PerspectiveCamera(42, 1280 / 648, 0.1, 450);
    assert.equal(runtime.starBatches.length, 1);
    assert.equal(runtime.root.children.length, 1);
    assert.equal(mesh.geometry.getAttribute("position").count, 60, "no extra billboard layer or separate nebula geometry");
    for (let pose = 0; pose < 8; pose++) {
      camera.rotation.set((pose % 3 - 1) * 0.6, pose * Math.PI / 4, 0);
      prepareStarfieldForCamera(runtime, camera);
      assert.ok(mesh.count > 500 && mesh.count < 5000, `seed ${seed}, pose ${pose}: ${mesh.count} bounded visible envelopes`);
      const version = mesh.instanceMatrix.version;
      prepareStarfieldForCamera(runtime, camera);
      assert.equal(mesh.instanceMatrix.version, version, "steady frames do not upload the dense canonical field again");
    }
    assert.equal(complete.stars.length, 15_360, "culling retains the complete authored model");
    mesh.dispose(); mesh.geometry.dispose(); material.dispose();
  }
});
