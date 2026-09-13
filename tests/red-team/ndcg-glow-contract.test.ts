import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { attachDreamEmission, createDreamEmissionProfile, sampleDreamEmission, type DreamEmissionKind } from "../../app/dreamEmission";

function subject() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1), new THREE.MeshStandardMaterial({ color: 0x2788aa }));
  const accent = new THREE.Mesh(new THREE.BoxGeometry(.3, .3, .3), new THREE.MeshStandardMaterial({ color: 0xcc3377 }));
  accent.position.y = .65;
  group.add(body, accent);
  return { group, body, accent };
}

test("NDCG-S01/H01: no inflated shells, disks, or surrogate aura geometry", () => {
  const { group } = subject();
  const original = group.children.slice();
  attachDreamEmission(group, createDreamEmissionProfile(17, "night", "ship"));
  assert.equal(group.children.length, original.length);
  assert.ok(group.children.every((child, index) => child === original[index]));
});

test("NDCG-S03/S05: register distinct native source regions, excluding tactical rings and wakes", () => {
  const { group, body, accent } = subject();
  const ring = new THREE.Mesh(new THREE.RingGeometry(1, 1.1), new THREE.MeshBasicMaterial());
  const wake = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial());
  group.userData.ring = ring; group.userData.wake = wake;
  group.add(ring, wake);
  attachDreamEmission(group, createDreamEmissionProfile(17, "night", "ship"));
  const sources = group.userData.dreamEmission?.sources;
  assert.ok(Array.isArray(sources), "an explicit source inventory must exist");
  assert.equal(sources.length, 2);
  assert.ok(sources[0].mesh === body && sources[1].mesh === accent);
  assert.notEqual(body.material.color.getHex(), accent.material.color.getHex());
});

test("NDCG-S02: the crisp native core has a fixed luminous component independent of halo", () => {
  const { group, body } = subject();
  attachDreamEmission(group, createDreamEmissionProfile(17, "night", "ship"));
  assert.equal(body.material.emissive.getHex(), body.material.color.getHex());
  assert.ok(body.material.emissiveIntensity > 0);
});

test("NDCG-T02: bounded gain-only breathing never changes the core or radius", () => {
  const profile = createDreamEmissionProfile(17, "night", "aircraft");
  assert.equal(profile.primaryPeriod, 31); assert.equal(profile.secondaryPeriod, 47);
  for (let t = 0; t < 300; t += .25) {
    const sample = sampleDreamEmission(profile, t, false);
    assert.equal(sample.coreFactor, 1); assert.equal(sample.haloScale, 1);
    assert.ok(sample.haloFactor >= .97 && sample.haloFactor <= 1.03);
  }
});

test("NDCG-T04: reduced motion is exactly p=1, not a frozen random bright phase", () => {
  const profile = createDreamEmissionProfile(17, "night", "submarine");
  assert.deepEqual(sampleDreamEmission(profile, 990, true), { coreFactor: 1, haloFactor: 1, haloScale: 1 });
});

test("NDCG-I01: all requested entity families use the same source contract", () => {
  for (const kind of ["ship", "submarine", "aircraft", "wildlife", "sea-creature"]) {
    const { group } = subject();
    attachDreamEmission(group, createDreamEmissionProfile(17, "night", kind as DreamEmissionKind));
    assert.equal(group.userData.dreamEmission?.sources?.length, 2, kind);
  }
});

test("NDCG-Q08: reject nonfinite profile input before evaluation", () => {
  assert.throws(() => createDreamEmissionProfile(NaN, "night", "ship"));
  assert.throws(() => createDreamEmissionProfile(17, "night", "ship", Infinity));
  const invalid = { ...createDreamEmissionProfile(17, "night", "ship"), primaryPeriod: 0 };
  assert.throws(() => sampleDreamEmission(invalid, 1, false));
});

test("NDCG-I02: cosmetic emission creates no conventional scene lights", () => {
  const { group } = subject();
  attachDreamEmission(group, createDreamEmissionProfile(17, "night", "ship"));
  assert.equal(group.getObjectsByProperty("isLight", true).length, 0);
});

test("NDCG-Q07: daylight policy preserves geometry without an exterior field", () => {
  const { group } = subject();
  attachDreamEmission(group, createDreamEmissionProfile(17, "day", "ship"));
  assert.equal(group.children.length, 2);
  assert.equal(group.userData.dreamEmission, undefined);
});
