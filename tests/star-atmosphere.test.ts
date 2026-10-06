import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { createStarPlacements } from "../app/viewModel";
import { createStarfield, createStarfieldPlan, prepareStarfieldForCamera, updateStarfield } from "../app/starfield";
import { createStarAtmosphereAdornments, normalizeStarAtmosphereConfig, STAR_ATMOSPHERE_BUDGET, STAR_ATMOSPHERE_DEFAULTS } from "../app/starAtmosphere";
import { sampleStarShimmer } from "../app/starPulse";

function fixture() {
  const seed = 0xc0ffee;
  return createStarfieldPlan({ seed, theme: "dark", placements: createStarPlacements(seed, 3072), visibleCount: 3072 });
}

function dispose(runtime: ReturnType<typeof createStarfield>) {
  for (const { mesh, material } of runtime.starBatches) {
    mesh.dispose(); mesh.geometry.dispose(); material.dispose();
  }
}

test("STAR-ATM-01: decoration preserves every original model value and concentrates special classes", () => {
  const plan = fixture();
  const original = JSON.stringify(plan);
  const adornments = createStarAtmosphereAdornments(plan);
  assert.equal(JSON.stringify(plan), original);
  assert.deepEqual(createStarAtmosphereAdornments(plan), adornments);
  assert.equal(adornments.length, plan.stars.length);
  const counts = [0, 0, 0, 0];
  for (let index = 0; index < adornments.length; index++) {
    const adornment = adornments[index];
    counts[adornment.classIndex]++;
    assert.ok(adornment.shape >= 0 && adornment.shape < STAR_ATMOSPHERE_BUDGET.maximumShapeFamilies);
    assert.ok(adornment.strength >= 0.59 && adornment.strength <= 1);
    assert.ok(adornment.variation >= 0 && adornment.variation < 1);
    if (adornment.classIndex === 3) assert.equal(plan.stars[index].prominence, "jewel");
    if (adornment.classIndex === 0) assert.equal(adornment.shape, 0);
    if (adornment.classIndex === 1) assert.ok(adornment.shape <= 1);
  }
  for (const [index, expected] of [0.5, 0.38, 0.1, 0.02].entries()) {
    assert.ok(Math.abs(counts[index] / adornments.length - expected) <= 1 / adornments.length);
  }
});

test("STAR-ATM-02: appended atmosphere retains exact core, inner halo, instance and motion bytes", () => {
  const plan = fixture();
  const baseline = createStarfield(new THREE.Scene(), plan);
  const adorned = createStarfield(new THREE.Scene(), plan, STAR_ATMOSPHERE_DEFAULTS);
  const original = baseline.starBatches[0];
  const added = adorned.starBatches[0];
  assert.equal(adorned.root.children.length, 1);
  assert.equal(adorned.starBatches.length, 1);
  assert.equal(added.mesh.count, plan.stars.length);
  assert.deepEqual(added.mesh.instanceMatrix.array, original.mesh.instanceMatrix.array);
  assert.deepEqual(added.mesh.instanceColor!.array, original.mesh.instanceColor!.array);
  for (const attributeName of ["position", "normal", "aFacetHalo"]) {
    const source = original.mesh.geometry.getAttribute(attributeName).array;
    const next = added.mesh.geometry.getAttribute(attributeName).array;
    assert.deepEqual(Array.from(next).slice(0, source.length), Array.from(source), attributeName);
  }
  for (const attributeName of ["aTwinkleProfile", "aShiftProfile", "aBaseAlpha"]) {
    assert.deepEqual(added.mesh.geometry.getAttribute(attributeName).array, original.mesh.geometry.getAttribute(attributeName).array, attributeName);
  }
  assert.equal(added.mesh.geometry.getAttribute("position").count, 60);
  assert.equal(added.mesh.geometry.getAttribute("position").count / 3, 20);
  assert.equal(added.mesh.geometry.getAttribute("aAtmosphereProfile").array.byteLength, plan.stars.length * 16);
  assert.equal(added.material.depthTest, true);
  assert.equal(added.material.depthWrite, false);
  assert.equal(added.material.fog, true);
  assert.equal(added.mesh.renderOrder, original.mesh.renderOrder);
  assert.match(added.material.vertexShader, /bool adornmentVisible = aAtmosphereProfile\.x > 0\.5\s*&& \(aFacetHalo < 2\.5 \|\| aAtmosphereProfile\.x > 1\.5\)/,
    "unused decorative quads must collapse in the vertex stage rather than consume fragment fill before discard");
  assert.match(added.material.vertexShader, /if \(adornmentVisible\) \{\s*mvPosition\.xy \+=/);
  updateStarfield(adorned, 100, true, new THREE.Vector3(8, 2, 9));
  assert.equal(added.material.uniforms.uTime.value, 0);
  assert.deepEqual(added.mesh.instanceMatrix.array, original.mesh.instanceMatrix.array);
  dispose(baseline); dispose(adorned);
});

test("STAR-ATM-03: disabled, zero-strength and refracted views use exact baseline geometry and shaders", () => {
  const plan = fixture();
  const baseline = createStarfield(new THREE.Scene(), plan);
  for (const [appearance, config] of [
    ["direct sky", { ...STAR_ATMOSPHERE_DEFAULTS, enabled: false }],
    ["direct sky", { ...STAR_ATMOSPHERE_DEFAULTS, intensity: 0 }],
    ["direct through the water surface", STAR_ATMOSPHERE_DEFAULTS],
  ] as const) {
    const candidate = createStarfield(new THREE.Scene(), { ...plan, appearance }, config);
    const batch = candidate.starBatches[0];
    assert.equal(batch.mesh.geometry.getAttribute("position").count, 48);
    assert.equal(batch.mesh.geometry.getAttribute("aAtmosphereProfile"), undefined);
    assert.deepEqual(batch.material.uniforms, baseline.starBatches[0].material.uniforms);
    assert.equal(batch.material.vertexShader, baseline.starBatches[0].material.vertexShader);
    assert.equal(batch.material.fragmentShader, baseline.starBatches[0].material.fragmentShader);
    dispose(candidate);
  }
  dispose(baseline);
});

test("STAR-ATM-04: culling keeps decorations attached to canonical stars, restores them, and avoids steady uploads", () => {
  const runtime = createStarfield(new THREE.Scene(), fixture(), STAR_ATMOSPHERE_DEFAULTS);
  const mesh = runtime.starBatches[0].mesh;
  const profiles = mesh.geometry.getAttribute("aAtmosphereProfile") as THREE.InstancedBufferAttribute;
  const originalProfiles = new Float32Array(profiles.array);
  const originalMatrices = new Float32Array(mesh.instanceMatrix.array);
  const sourceByMatrix = new Map<string, number>();
  for (let i = 0; i < mesh.count; i++) sourceByMatrix.set(Array.from(originalMatrices.slice(i * 16, i * 16 + 16)).join(","), i);
  const camera = new THREE.PerspectiveCamera(42, 1.5, 0.1, 450);
  for (const angle of [0, Math.PI, 0.3, 0]) {
    camera.rotation.y = angle;
    prepareStarfieldForCamera(runtime, camera);
    assert.ok(mesh.count > 500 && mesh.count < 5000);
    for (let i = 0; i < mesh.count; i++) {
      const source = sourceByMatrix.get(Array.from(mesh.instanceMatrix.array.slice(i * 16, i * 16 + 16)).join(","));
      assert.notEqual(source, undefined);
      assert.deepEqual(Array.from(profiles.array.slice(i * 4, i * 4 + 4)), Array.from(originalProfiles.slice(source! * 4, source! * 4 + 4)));
    }
    const version = profiles.version;
    updateStarfield(runtime, 99, false);
    prepareStarfieldForCamera(runtime, camera);
    assert.equal(profiles.version, version);
  }
  camera.projectionMatrix.elements[0] = NaN;
  prepareStarfieldForCamera(runtime, camera);
  assert.deepEqual(profiles.array, originalProfiles);
  dispose(runtime);
});

test("STAR-ATM-05: tuning rejects unbounded inputs and empty star plans allocate no decorative mesh", () => {
  const config = normalizeStarAtmosphereConfig({
    ...STAR_ATMOSPHERE_DEFAULTS, intensity: NaN, bloomIntensity: Infinity, bloomRadius: 900,
    diffuseIntensity: 99, diffuseRadius: 900,
    edgeSoftness: -1, irregularity: 8, chromaticVariance: 4, twinkleAmount: 2, heroFrequency: 2,
  });
  assert.equal(config.intensity, 0);
  assert.equal(config.bloomIntensity, 0);
  assert.equal(config.bloomRadius, 4.2);
  assert.equal(config.diffuseIntensity, 0.24);
  assert.equal(config.diffuseRadius, 8);
  assert.equal(config.edgeSoftness, 0.05);
  assert.equal(config.irregularity, 0.35);
  assert.equal(config.chromaticVariance, 0.12);
  assert.equal(config.twinkleAmount, 0.06);
  assert.equal(config.heroFrequency, 0.03);
  const plan = { ...fixture(), stars: [] };
  assert.deepEqual(createStarAtmosphereAdornments(plan), []);
  const empty = createStarfield(new THREE.Scene(), plan, STAR_ATMOSPHERE_DEFAULTS);
  assert.equal(empty.root.children.length, 0);
});

test("STAR-ATM-06: stronger outer bloom preserves the existing fine fringe and exact original core data", () => {
  const plan = fixture();
  const prior = createStarfield(new THREE.Scene(), plan, {
    ...STAR_ATMOSPHERE_DEFAULTS, diffuseIntensity: 0.055, diffuseRadius: 3.2,
  });
  const next = createStarfield(new THREE.Scene(), plan, STAR_ATMOSPHERE_DEFAULTS);
  const before = prior.starBatches[0]; const after = next.starBatches[0];
  for (const name of ["position", "normal", "aFacetHalo"]) {
    const oldAttribute = before.mesh.geometry.getAttribute(name);
    const newAttribute = after.mesh.geometry.getAttribute(name);
    const preservedComponents = 54 * oldAttribute.itemSize;
    assert.deepEqual(newAttribute.array.slice(0, preservedComponents), oldAttribute.array.slice(0, preservedComponents),
      `${name}: original 48 vertices and 6 fine-fringe vertices remain exact`);
  }
  assert.deepEqual(after.material.uniforms.uAtmosphere.value, before.material.uniforms.uAtmosphere.value);
  assert.deepEqual(after.material.uniforms.uAtmosphereDetail.value, before.material.uniforms.uAtmosphereDetail.value);
  assert.deepEqual(after.material.uniforms.uDiffuseAtmosphere.value.toArray(), [0.165, 6.4]);
  const originalPositions = before.mesh.geometry.getAttribute("position");
  const enlargedPositions = after.mesh.geometry.getAttribute("position");
  for (let index = 54; index < 60; index++) {
    assert.equal(enlargedPositions.getX(index), originalPositions.getX(index) * 2);
    assert.equal(enlargedPositions.getY(index), originalPositions.getY(index) * 2);
    assert.equal(enlargedPositions.getZ(index), 0);
  }
  assert.equal(after.mesh.geometry.getAttribute("position").count, before.mesh.geometry.getAttribute("position").count);
  assert.equal(next.starBatches.length, prior.starBatches.length);
  for (const name of ["aAtmosphereProfile", "aTwinkleProfile", "aShiftProfile", "aBaseAlpha"]) {
    assert.deepEqual(after.mesh.geometry.getAttribute(name).array, before.mesh.geometry.getAttribute(name).array);
  }
  assert.deepEqual(after.mesh.instanceMatrix.array, before.mesh.instanceMatrix.array);
  assert.deepEqual(after.mesh.instanceColor!.array, before.mesh.instanceColor!.array);
  dispose(prior); dispose(next);
});

test("STAR-ATM-07: a diffuse halo crossing the frustum edge remains submitted when its core is outside", () => {
  const source = fixture();
  const star = {
    ...source.stars[0], x: 64.3, y: 0, z: -100, scale: 1, rotation: 0, brightness: 1,
    motion: "still" as const, prominence: "jewel" as const,
  };
  const plan = {
    ...source,
    stars: Array.from({ length: 100 }, (_, index) => ({
      ...star, x: index === 0 ? star.x : 1_000 + index, brightness: index === 0 ? 1 : 0.1,
    })),
  };
  const prior = createStarfield(new THREE.Scene(), plan, { ...STAR_ATMOSPHERE_DEFAULTS, diffuseRadius: 3.2 });
  const next = createStarfield(new THREE.Scene(), plan, STAR_ATMOSPHERE_DEFAULTS);
  const camera = new THREE.PerspectiveCamera(42, 1.5, 0.1, 450);
  const frustum = new THREE.Frustum().setFromProjectionMatrix(camera.projectionMatrix);
  assert.equal(frustum.containsPoint(new THREE.Vector3(star.x, star.y, star.z)), false);
  const profile = next.starBatches[0].mesh.geometry.getAttribute("aTwinkleProfile");
  // Evaluate actual shared shimmer samples at a nonzero point inside the
  // existing Gaussian mask, rather than merely checking a loose quad bound.
  let haloEnters = false;
  for (let time = 0; time < 30; time += 0.1) {
    const pulse = 1 + sampleStarShimmer(time, profile.getX(0), profile.getY(0)) * profile.getW(0);
    const point = new THREE.Vector3(star.x - STAR_ATMOSPHERE_DEFAULTS.diffuseRadius * pulse * 0.9, 0, star.z);
    haloEnters ||= frustum.containsPoint(point);
  }
  assert.equal(haloEnters, true, "the enlarged bloom actually crosses the camera edge during its existing pulse");
  prepareStarfieldForCamera(prior, camera);
  prepareStarfieldForCamera(next, camera);
  assert.equal(prior.starBatches[0].mesh.count, 0);
  assert.equal(next.starBatches[0].mesh.count, 1);
  assert.equal(next.starBatches[0].mesh.geometry.getAttribute("aAtmosphereProfile").getX(0), 3);
  dispose(prior); dispose(next);
});
