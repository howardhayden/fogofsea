import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import {
  attachDreamEmission,
  createDreamEmissionProfile,
  DREAM_EMISSION_LIMITS,
  dreamEmissionVisibilityLift,
  sampleDreamEmission,
  updateDreamEmission,
} from "../app/dreamEmission";

test("dream-emission profiles are deterministic, selective, slow, and asynchronous", () => {
  const ship = createDreamEmissionProfile(19, "night", "ship");
  const repeated = createDreamEmissionProfile(19, "night", "ship");
  const aircraft = createDreamEmissionProfile(20, "night", "aircraft");
  const day = createDreamEmissionProfile(19, "day", "ship");
  assert.deepEqual(ship, repeated);
  assert.equal(ship.enabled, true);
  assert.equal(day.enabled, false);
  assert.equal(day.coreStrength, 0);
  assert.ok(ship.primaryPeriod >= 24 && ship.primaryPeriod <= 38);
  assert.ok(ship.secondaryPeriod >= 57 && ship.secondaryPeriod <= 83);
  assert.notEqual(ship.primaryPeriod, aircraft.primaryPeriod);
  assert.equal(ship.haloScale, 1.09);
  assert.equal(ship.outerHaloScale, 1.17);
  assert.equal(aircraft.haloScale, 1.16);
  assert.equal(aircraft.outerHaloScale, 1.26);
  assert.ok(ship.coreStrength >= 0.14 && ship.coreStrength <= 0.22);
  assert.ok(ship.haloStrength >= 0.32 && ship.haloStrength <= 0.44);
  assert.ok(ship.outerHaloStrength > 0 && ship.outerHaloStrength < ship.haloStrength * 0.3);
});

test("dream-emission breathing stays shallow and reduced motion freezes it", () => {
  const profile = createDreamEmissionProfile(92, "dusk", "submarine");
  const samples = Array.from({ length: 240 }, (_, index) => sampleDreamEmission(profile, index * 0.5, false));
  assert.ok(samples.every((sample) => sample.coreFactor >= 0.94 && sample.coreFactor <= 1.06));
  assert.ok(samples.every((sample) => sample.haloFactor >= 0.89 && sample.haloFactor <= 1.11));
  assert.ok(samples.every((sample) => sample.haloScale >= 1.106 && sample.haloScale <= 1.114));
  assert.notDeepEqual(samples[0], samples[100]);
  assert.deepEqual(sampleDreamEmission(profile, 0, true), sampleDreamEmission(profile, 999, true));
});

test("adverse-weather visibility support is bounded and cannot defeat occlusion", () => {
  assert.equal(dreamEmissionVisibilityLift(0, 0), 1);
  const foggy = dreamEmissionVisibilityLift(0.052, 4);
  assert.ok(foggy > 1);
  assert.ok(foggy <= 1.22);
  assert.equal(dreamEmissionVisibilityLift(Number.POSITIVE_INFINITY, 99), 1.22);
  const normal = createDreamEmissionProfile(17, "night", "ship");
  const supported = createDreamEmissionProfile(17, "night", "ship", foggy);
  const capped = createDreamEmissionProfile(17, "night", "ship", 999);
  assert.ok(supported.coreStrength > normal.coreStrength);
  assert.ok(supported.haloStrength > normal.haloStrength);
  assert.ok(capped.haloStrength <= normal.haloStrength * 1.22);
  assert.equal(createDreamEmissionProfile(17, "day", "ship", 999).haloStrength, 0);
});

test("same-geometry halo keeps a crisp, fog-aware, native-color core without lights", () => {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: 0x74b9ad });
  const core = new THREE.Mesh(new THREE.BoxGeometry(1, 0.3, 0.4), material);
  const towerMaterial = new THREE.MeshStandardMaterial({ color: 0x547f91 });
  const tower = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.4, 0.2), towerMaterial);
  tower.position.y = 0.3;
  const tacticalRing = new THREE.Mesh(new THREE.RingGeometry(1, 1.1), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  group.add(core, tower, tacticalRing);
  const profile = createDreamEmissionProfile(7, "dawn", "ship");
  attachDreamEmission(group, profile);

  const innerHalo = group.children.find((child) => child.name === "dream-emission-halo-inner");
  const outerHalo = group.children.find((child) => child.name === "dream-emission-halo-outer");
  assert.ok(innerHalo instanceof THREE.Mesh);
  assert.ok(outerHalo instanceof THREE.Mesh);
  for (const halo of [innerHalo, outerHalo]) {
    assert.notEqual(halo.geometry, core.geometry);
    assert.equal(halo.geometry, innerHalo.geometry);
    assert.ok(halo.geometry.getAttribute("color") instanceof THREE.BufferAttribute);
    assert.ok(halo.material instanceof THREE.ShaderMaterial);
    assert.equal(halo.material.side, THREE.BackSide);
    assert.equal(halo.material.depthTest, true);
    assert.equal(halo.material.depthWrite, false);
    assert.equal(halo.material.blending, THREE.NormalBlending);
    assert.equal(halo.material.fog, true);
    assert.equal(halo.material.toneMapped, false);
  }
  assert.equal(innerHalo.scale.x, profile.haloScale);
  assert.equal(outerHalo.scale.x, profile.outerHaloScale);
  assert.equal(group.userData.dreamEmissionHaloMeshes, DREAM_EMISSION_LIMITS.haloMeshesPerSubject);
  assert.equal(DREAM_EMISSION_LIMITS.maxHaloMeshes, DREAM_EMISSION_LIMITS.maxSubjects * DREAM_EMISSION_LIMITS.haloMeshesPerSubject);
  assert.ok((innerHalo.material as THREE.ShaderMaterial).uniforms.uStrength.value > (outerHalo.material as THREE.ShaderMaterial).uniforms.uStrength.value);
  assert.equal(material.emissive.getHex(), material.color.getHex());
  assert.equal(towerMaterial.emissive.getHex(), towerMaterial.color.getHex());
  assert.equal(tacticalRing.children.length, 0);
  assert.equal(group.getObjectsByProperty("isLight", true).length, 0);

  updateDreamEmission([group], 12, false);
  assert.ok(material.emissiveIntensity > 0);
  const frozenStrength = (innerHalo.material as THREE.ShaderMaterial).uniforms.uStrength.value;
  updateDreamEmission([group], 999, true);
  const reducedStrength = (innerHalo.material as THREE.ShaderMaterial).uniforms.uStrength.value;
  updateDreamEmission([group], 0, true);
  assert.equal((innerHalo.material as THREE.ShaderMaterial).uniforms.uStrength.value, reducedStrength);
  assert.notEqual(frozenStrength, 0);

  const daylight = new THREE.Group();
  daylight.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ color: 0xff00aa })));
  attachDreamEmission(daylight, createDreamEmissionProfile(7, "day", "ship"));
  assert.equal(daylight.userData.dreamEmission, undefined);
});
