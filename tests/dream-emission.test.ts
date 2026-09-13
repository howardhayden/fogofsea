import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import {
  attachDreamEmission, createDreamEmissionProfile, detachDreamEmission,
  DREAM_EMISSION_LIMITS, dreamEmissionVisibilityLift, isDreamEmissionVisible,
  sampleDreamEmission, updateDreamEmission, type DreamEmissionKind, type DreamEmissionRuntime,
} from "../app/dreamEmission";
import { compactGaussian, createDreamGlowKernel, DREAM_GLOW_MODEL, dreamGlowShoulder } from "../app/dreamGlowMath";

// The baseline's shell-existence assertions are deliberately superseded by
// NDCG-S01/H01/C02 and the user's 2026-09-13 application request, not weakened.
test("all four source families use deterministic bounded profiles with no geometric pulse", () => {
  for (const kind of ["ship", "submarine", "aircraft", "creature"] as const) {
    const profile = createDreamEmissionProfile(19, "night", kind);
    assert.deepEqual(profile, createDreamEmissionProfile(19, "night", kind));
    assert.equal(profile.primaryPeriod, 31);
    assert.equal(profile.secondaryPeriod, 47);
    assert.equal(profile.haloStrength, 0.28);
    assert.equal(createDreamEmissionProfile(19, "day", kind).enabled, false);
    for (let time = 0; time < 1000; time += 0.5) {
      const sample = sampleDreamEmission(profile, time, false);
      assert.equal(sample.coreFactor, 1);
      assert.ok(sample.haloFactor >= 0.97 && sample.haloFactor <= 1.03);
    }
    assert.deepEqual(sampleDreamEmission(profile, 0, true), { coreFactor: 1, haloFactor: 1 });
    assert.deepEqual(sampleDreamEmission(profile, 999, true), sampleDreamEmission(profile, 0, true));
  }
  assert.notEqual(createDreamEmissionProfile(19, "night", "ship").primaryPhase, createDreamEmissionProfile(20, "night", "ship").primaryPhase);
});

test("weather lift stays bounded and cannot restore daylight emission", () => {
  assert.equal(dreamEmissionVisibilityLift(0, 0), 1);
  assert.equal(dreamEmissionVisibilityLift(Infinity, 99), 1.22);
  assert.equal(dreamEmissionVisibilityLift(NaN, NaN), 1);
  assert.equal(createDreamEmissionProfile(17, "day", "ship", 999).haloStrength, 0);
  assert.equal(createDreamEmissionProfile(17, "night", "ship", 999).haloStrength, 0.28 * 1.22);
});

function source(kind: DreamEmissionKind = "ship") {
  const group = new THREE.Group();
  const native = new THREE.MeshStandardMaterial({ color: 0x74b9ad });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1, 0.3, 0.4), native);
  const accent = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.4, 0.2), new THREE.MeshStandardMaterial({ color: 0xaa2255 }));
  accent.position.y = 0.3;
  const ring = new THREE.Mesh(new THREE.RingGeometry(1, 1.1), new THREE.MeshBasicMaterial());
  const wake = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial());
  wake.name = "surface-vessel-wake";
  const reaction = new THREE.Group(); reaction.name = "wildlife-happy-reaction";
  reaction.add(new THREE.Mesh(new THREE.TetrahedronGeometry(), native));
  group.add(body, accent, ring, wake, reaction);
  attachDreamEmission(group, createDreamEmissionProfile(7, "night", kind));
  return { group, native, body, accent, runtime: group.userData.dreamEmission as DreamEmissionRuntime };
}

test("real geometry and native color survive registration for every family; helpers do not emit", () => {
  for (const kind of ["ship", "submarine", "aircraft", "creature"] as const) {
    const { group, native, body, accent, runtime } = source(kind);
    assert.equal(runtime.parts.length, 2);
    assert.equal(group.children.length, 5);
    assert.equal(body.material.color.getHex(), native.color.getHex());
    assert.notEqual(body.material, native);
    assert.notEqual(body.material.emissive.getHex(), 0);
    assert.equal(native.emissive.getHex(), 0);
    assert.notEqual(body.material.color.getHex(), accent.material.color.getHex());
    assert.equal(group.getObjectsByProperty("isLight", true).length, 0);
    assert.equal(group.userData.dreamEmissionHaloMeshes, 0);
    assert.equal(DREAM_EMISSION_LIMITS.maxHaloMeshes, 0);
    const geometry = body.geometry; const scale = group.scale.clone(); const color = body.material.emissive.clone();
    updateDreamEmission([group], 12, false);
    assert.deepEqual(group.scale, scale);
    assert.deepEqual(body.material.emissive, color);
    assert.equal(body.geometry, geometry);
    assert.ok(runtime.gain > 0);
    detachDreamEmission(group);
    assert.equal(body.material, native);
  }
});

test("registration is idempotent and reference scale excludes helper geometry", () => {
  const { group, runtime } = source();
  attachDreamEmission(group, createDreamEmissionProfile(8, "night", "ship"));
  assert.equal(group.userData.dreamEmission, runtime);
  assert.equal(runtime.referenceSize, 1);
  assert.equal(group.children.length, 5);
});

test("ancestor visibility and explicit authorization are fail-closed, including creatures", () => {
  const { group, body } = source("creature");
  assert.equal(isDreamEmissionVisible(body), true);
  group.visible = false;
  assert.equal(isDreamEmissionVisible(body), false);
  group.visible = true; group.userData.dreamEmissionAuthorized = false;
  assert.equal(isDreamEmissionVisible(body), false);
  const blocked = new THREE.Group(); blocked.userData.dreamEmissionAuthorized = false;
  blocked.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
  attachDreamEmission(blocked, createDreamEmissionProfile(5, "night", "submarine"));
  assert.equal(blocked.userData.dreamEmission, undefined);
});

test("compact radial mixture is nonnegative, symmetric, normalized, and exactly finite", () => {
  const kernel = createDreamGlowKernel();
  assert.ok(Math.abs(kernel.data.reduce((sum, value) => sum + value, 0) - 1) < 1e-6);
  for (let y = 0; y < kernel.width; y++) for (let x = 0; x < kernel.width; x++) {
    const v = kernel.data[y * kernel.width + x];
    assert.ok(v >= 0 && Number.isFinite(v));
    assert.equal(v, kernel.data[x * kernel.width + y]);
    assert.equal(v, kernel.data[(kernel.width - 1 - y) * kernel.width + kernel.width - 1 - x]);
    if (Math.hypot(x - kernel.radius, y - kernel.radius) >= 0.225 * kernel.referencePixels) assert.equal(v, 0);
  }
  assert.equal(compactGaussian(3), 0);
  assert.equal(compactGaussian(4), 0);
  assert.equal(DREAM_GLOW_MODEL.weights.reduce((a, b) => a + b, 0), 1);
});

test("shoulder is continuous, monotone, bounded, and leaves ordinary glow unchanged", () => {
  assert.equal(dreamGlowShoulder(0.14), 0.14);
  assert.ok(Math.abs(dreamGlowShoulder(0.3 + 1e-7) - 0.3) < 1.1e-7);
  let previous = 0;
  for (let x = 0; x <= 20; x += 0.001) {
    const current = dreamGlowShoulder(x);
    assert.ok(current >= previous && current <= 0.5);
    previous = current;
  }
});

test("invalid mathematical and profile inputs are rejected", () => {
  for (const value of [NaN, Infinity, -1]) {
    assert.throws(() => compactGaussian(value), RangeError);
    assert.throws(() => dreamGlowShoulder(value), RangeError);
  }
  assert.throws(() => createDreamGlowKernel(100), RangeError);
  assert.throws(() => dreamGlowShoulder(1, 0.5, 0.3), RangeError);
  assert.throws(() => createDreamEmissionProfile(NaN, "night", "ship"), RangeError);
  assert.throws(() => createDreamEmissionProfile(1, "__proto__" as "day", "ship"), RangeError);
});
