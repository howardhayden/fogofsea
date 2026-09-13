import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import {
  attachDreamEmission, createDreamEmissionProfile, detachDreamEmission,
  DREAM_EMISSION_LIMITS, dreamEmissionVisibilityLift, dreamSourceVisible,
  sampleDreamEmission, updateDreamEmission, type DreamEmissionKind, type DreamEmissionRuntime,
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
    assert.equal(material.emissive.getHex(), 0, "shared original material was mutated");
    assert.ok((mesh.material as THREE.MeshStandardMaterial).emissive.r > 0);
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
  assert.deepEqual(sampleDreamEmission(a, 900, true), { coreFactor: 1, haloFactor: 1 });
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
