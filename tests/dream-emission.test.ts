import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { sampleStarShimmer } from "../app/starPulse";
import {
  attachDreamEmission, createDreamEmissionProfile, detachDreamEmission,
  DREAM_EMISSION_LIMITS, DREAM_MOVEMENT_PULSE, dreamEmissionVisibilityLift, dreamSourceVisible,
  sampleDreamEmission, setDreamEmissionMovement, updateDreamEmission, type DreamEmissionKind, type DreamEmissionRuntime,
} from "../app/dreamEmission";

const kinds: readonly DreamEmissionKind[] = ["ship", "submarine", "aircraft", "creature"];

for (const kind of kinds) {
  test(`NDCG/S01-S06: ${kind} uses its native source meshes, not aura geometry`, () => {
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ color: 0x547f91, flatShading: true });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.3, 0.4), material);
    group.add(mesh);
    const beforeScale = mesh.scale.clone();
    const beforeColor = material.color.clone();
    const geometry = mesh.geometry;
    attachDreamEmission(group, createDreamEmissionProfile(7, "night", kind));
    const runtime = group.userData.dreamEmission as DreamEmissionRuntime;
    assert.equal(runtime.parts.length, 1);
    assert.equal(runtime.parts[0].mesh, mesh);
    assert.equal(mesh.geometry, geometry);
    assert.ok(mesh.scale.equals(beforeScale));
    assert.ok(runtime.parts[0].material.color.equals(beforeColor));
    assert.equal(runtime.parts[0].material, material);
    assert.equal(mesh.material, material, "registration replaced the production material");
    assert.equal(material.emissive.getHex(), 0, "production hard surfaces became emissive");
    assert.equal(group.children.length, 1);
    assert.equal(group.userData.dreamEmissionHaloMeshes, 0);
    assert.equal(group.getObjectsByProperty("isLight", true).length, 0);
    updateDreamEmission([group], 20, false);
    assert.ok(runtime.haloFactor >= 0.97 && runtime.haloFactor <= 1.03);
    updateDreamEmission([group], 999, true);
    assert.equal(runtime.haloFactor, 1);
    assert.ok(mesh.scale.equals(beforeScale));
    detachDreamEmission(group);
    assert.equal(mesh.material, material);
    assert.equal(material.emissive.getHex(), 0);
    assert.equal(group.userData.dreamEmission, undefined);
  });
}

test("NDCG/S03: different source regions retain different native hues", () => {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ color: 0xff0066 })),
    new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({ color: 0x33bbff })));
  attachDreamEmission(group, createDreamEmissionProfile(4, "night", "creature"));
  const runtime = group.userData.dreamEmission as DreamEmissionRuntime;
  assert.equal(runtime.parts[0].material.color.getHex(), 0xff0066);
  assert.equal(runtime.parts[1].material.color.getHex(), 0x33bbff);
  detachDreamEmission(group);
});

test("NDCG/E03-C03: rings, wakes and reaction effects cannot contaminate the emitter", () => {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ color: 0x669988 }));
  const ring = new THREE.Mesh(new THREE.RingGeometry(), new THREE.MeshBasicMaterial());
  const wake = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  wake.name = "surface-vessel-wake";
  const reaction = new THREE.Group(); reaction.name = "wildlife-happy-reaction";
  reaction.add(new THREE.Mesh(new THREE.TetrahedronGeometry(), new THREE.MeshStandardMaterial()));
  group.add(body, ring, wake, reaction);
  group.userData.ring = ring; group.userData.wake = wake;
  attachDreamEmission(group, createDreamEmissionProfile(3, "night", "ship"));
  assert.equal((group.userData.dreamEmission as DreamEmissionRuntime).parts.length, 1);
  detachDreamEmission(group);
});

test("NDCG/V01: explicit authorization and ancestor visibility fail closed", () => {
  const ancestor = new THREE.Group(); const group = new THREE.Group();
  group.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
  ancestor.add(group); ancestor.visible = false;
  assert.equal(dreamSourceVisible(group), false);
  ancestor.visible = true; ancestor.userData.dreamEmissionAuthorized = false;
  assert.equal(dreamSourceVisible(group), false);
  group.userData.dreamEmissionAuthorized = false;
  attachDreamEmission(group, createDreamEmissionProfile(3, "night", "submarine"));
  assert.equal(group.userData.dreamEmission, undefined);
});

test("NDCG/T01-T04: reproducible phase, gain-only breathing, and daylight bypass", () => {
  const a = createDreamEmissionProfile(19, "night", "ship");
  assert.deepEqual(a, createDreamEmissionProfile(19, "night", "ship"));
  assert.notEqual(a.primaryPhase, createDreamEmissionProfile(20, "night", "ship").primaryPhase);
  assert.equal(a.primaryPeriod, 31); assert.equal(a.secondaryPeriod, 47);
  assert.deepEqual(sampleDreamEmission(a, 900, true), { haloFactor: 1 });
  assert.equal(createDreamEmissionProfile(19, "day", "ship").enabled, false);
  const day = new THREE.Group();
  day.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
  attachDreamEmission(day, createDreamEmissionProfile(1, "day", "creature"));
  assert.equal(day.userData.dreamEmission, undefined);
  assert.equal(DREAM_EMISSION_LIMITS.maxHaloMeshes, 0);
});

test("NDCG/V02-Q08: weather cannot amplify emission or propagate nonfinite values", () => {
  for (const density of [0, 0.05, Infinity, NaN]) assert.equal(dreamEmissionVisibilityLift(density, 99), 1);
  assert.deepEqual(createDreamEmissionProfile(1, "night", "ship", 999), createDreamEmissionProfile(1, "night", "ship", 1));
  assert.throws(() => createDreamEmissionProfile(NaN, "night", "ship"), RangeError);
  const group = new THREE.Group();
  const profile = createDreamEmissionProfile(1, "night", "ship");
  attachDreamEmission(group, { ...profile, haloStrength: Infinity });
  assert.equal(group.userData.dreamEmission, undefined);
});

test("NDCG/R01: viewport/pose changes do not rewrite the authored reference size", () => {
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshStandardMaterial());
  group.add(mesh);
  attachDreamEmission(group, createDreamEmissionProfile(3, "night", "creature"));
  const runtime = group.userData.dreamEmission as DreamEmissionRuntime;
  const radius = runtime.referenceSphere.radius;
  mesh.rotation.z = 1.2; group.position.x = 30;
  updateDreamEmission([group], 50, false);
  assert.equal(runtime.referenceSphere.radius, radius);
  attachDreamEmission(group, createDreamEmissionProfile(3, "night", "creature"));
  assert.equal(group.children.length, 1, "re-registration leaked geometry");
  detachDreamEmission(group);
});

test("NDCG/M01: formation movement adds bounded smooth gain while resting sources remain exact", () => {
  assert.ok(DREAM_MOVEMENT_PULSE.frequencyHz >= 0.22 && DREAM_MOVEMENT_PULSE.frequencyHz <= 0.3);
  for (const kind of ["ship", "submarine", "aircraft"] as const) {
    const profile = createDreamEmissionProfile(19, "night", kind);
    let previous = sampleDreamEmission(profile, 0, false, 1).haloFactor;
    let minimum = previous; let maximum = previous;
    for (let frame = 0; frame <= 3600; frame++) {
      const elapsed = frame / 60;
      const resting = sampleDreamEmission(profile, elapsed, false).haloFactor;
      const moving = sampleDreamEmission(profile, elapsed, false, 1).haloFactor;
      assert.equal(sampleDreamEmission(profile, elapsed, false, 0).haloFactor, resting);
      assert.ok(moving >= 0.87 && moving <= 1.13);
      assert.ok(Math.abs(moving - previous) < 0.003, "formation pulse must remain continuous and non-flashing");
      assert.ok(Math.abs(moving - resting) <= 0.100000000001);
      assert.equal(moving, resting + sampleStarShimmer(elapsed, profile.primaryPhase, DREAM_MOVEMENT_PULSE.frequencyHz) * DREAM_MOVEMENT_PULSE.amplitude);
      minimum = Math.min(minimum, moving); maximum = Math.max(maximum, moving); previous = moving;
    }
    assert.ok(minimum < 0.93 && maximum > 1.07, "moving glow should visibly pulse beyond resting breathing");
    for (const intensity of [-1, NaN, Infinity]) {
      assert.deepEqual(sampleDreamEmission(profile, 12, false, intensity), sampleDreamEmission(profile, 12, false));
    }
    assert.deepEqual(sampleDreamEmission(profile, 12, false, 99), sampleDreamEmission(profile, 12, false, 1));
    assert.deepEqual(sampleDreamEmission(profile, Infinity, false, 1), { haloFactor: 1 });
    assert.deepEqual(sampleDreamEmission(profile, 12, true, 1), { haloFactor: 1 });
  }
  for (const profile of [createDreamEmissionProfile(19, "night", "creature"), createDreamEmissionProfile(19, "day", "ship")]) {
    assert.deepEqual(sampleDreamEmission(profile, 12, false, 1), sampleDreamEmission(profile, 12, false));
  }
});

test("NDCG/M02: travel setter preserves native materials and bounds, resets at rest, and cannot enable day glow", () => {
  const group = new THREE.Group();
  const readRuntime = (): DreamEmissionRuntime | undefined => group.userData.dreamEmission;
  const geometry = new THREE.BoxGeometry(3, 1, 1);
  const material = new THREE.MeshStandardMaterial({ color: 0x547f91 });
  const mesh = new THREE.Mesh(geometry, material);
  group.add(mesh);
  setDreamEmissionMovement(group, 1);
  assert.equal(group.userData.dreamEmission, undefined);
  attachDreamEmission(group, createDreamEmissionProfile(19, "night", "ship"));
  const runtime = readRuntime();
  assert.ok(runtime);
  const reference = runtime.referenceBox.clone();
  setDreamEmissionMovement(group, 10);
  updateDreamEmission([group], 12, false);
  assert.equal(runtime.movementIntensity, 1);
  assert.equal(runtime.haloFactor, sampleDreamEmission(runtime.profile, 12, false, 1).haloFactor);
  assert.equal(mesh.material, material);
  assert.equal(mesh.geometry, geometry);
  assert.equal(material.color.getHex(), 0x547f91);
  assert.equal(material.emissive.getHex(), 0);
  assert.ok(reference.equals(runtime.referenceBox));
  assert.equal(group.children.length, 1);
  setDreamEmissionMovement(group, 0);
  updateDreamEmission([group], 12, false);
  assert.equal(runtime.haloFactor, sampleDreamEmission(runtime.profile, 12, false).haloFactor);
  setDreamEmissionMovement(group, NaN);
  assert.equal(runtime.movementIntensity, 0);
  attachDreamEmission(group, createDreamEmissionProfile(19, "day", "ship"));
  setDreamEmissionMovement(group, 1);
  updateDreamEmission([group], 12, false);
  assert.equal(group.userData.dreamEmission, undefined);
  attachDreamEmission(group, createDreamEmissionProfile(19, "night", "creature"));
  setDreamEmissionMovement(group, 1);
  assert.equal(readRuntime()?.movementIntensity, 0);
  detachDreamEmission(group); geometry.dispose(); material.dispose();
});
