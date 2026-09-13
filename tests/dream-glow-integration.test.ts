import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { AIRCRAFT, PLATFORMS } from "../app/catalog";
import { createAircraft, createShip, createSeaCreature } from "../app/battlefieldScene";
import { attachDreamEmission, createDreamEmissionProfile, detachDreamEmission, type DreamEmissionRuntime } from "../app/dreamEmission";

function dispose(root: THREE.Group) {
  detachDreamEmission(root);
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => material.dispose());
  });
}

test("every catalog vessel, submarine and aircraft registers its native body without aura geometry", () => {
  for (const entry of [...PLATFORMS.map((v) => ({ ...v, air: false })), ...AIRCRAFT.map((v) => ({ ...v, air: true }))]) {
    const root = entry.air ? createAircraft(entry.id, 0x638fa2) : createShip(entry.id, 0x638fa2);
    const originalObjects: THREE.Object3D[] = [];
    root.traverse((object) => originalObjects.push(object));
    attachDreamEmission(root, createDreamEmissionProfile(91, "night", entry.air ? "aircraft" : entry.id.includes("submarine") ? "submarine" : "ship"));
    const runtime = root.userData.dreamEmission as DreamEmissionRuntime;
    assert.ok(runtime.parts.length > 0, entry.id);
    assert.ok(Number.isFinite(runtime.referenceSize) && runtime.referenceSize > 0, entry.id);
    assert.ok(runtime.parts.every((part) => part.mesh !== root.userData.ring && part.mesh !== root.userData.wake), entry.id);
    const afterObjects: THREE.Object3D[] = [];
    root.traverse((object) => afterObjects.push(object));
    assert.deepEqual(afterObjects, originalObjects, entry.id);
    dispose(root);
  }
});

test("all three generic sea-creature geometries register and retain authored opacity", () => {
  for (let variant = 0; variant < 3; variant++) {
    const root = createSeaCreature(0.3, 0x7da8aa, variant);
    attachDreamEmission(root, createDreamEmissionProfile(7, "night", "creature"));
    const runtime = root.userData.dreamEmission as DreamEmissionRuntime;
    assert.equal(runtime.parts.length, variant === 1 ? 3 : 2);
    for (const part of runtime.parts) {
      const material = part.mesh.material as THREE.MeshStandardMaterial;
      assert.equal(material.opacity, 0.58);
      assert.equal(material.color.getHex(), 0x7da8aa);
    }
    dispose(root);
  }
});

test("unnamed non-painting click geometry cannot emit or inflate the reference size", () => {
  const root = new THREE.Group();
  root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x819f92 })));
  const hitTarget = new THREE.Mesh(new THREE.BoxGeometry(100, 100, 100), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  root.add(hitTarget);
  attachDreamEmission(root, createDreamEmissionProfile(9, "night", "creature"));
  const runtime = root.userData.dreamEmission as DreamEmissionRuntime;
  assert.equal(runtime.parts.length, 1);
  assert.equal(runtime.referenceSize, 1);
  assert.ok(!runtime.parts.some((part) => part.mesh === hitTarget));
  dispose(root);
});
