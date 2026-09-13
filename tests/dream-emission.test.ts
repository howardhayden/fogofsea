import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { attachDreamEmission, createDreamEmissionProfile, dreamEmissionVisibilityLift, getDreamEmissionRuntime, sampleDreamEmission, updateDreamEmission } from "../app/dreamEmission";

test("NDCG profiles are deterministic and gain-only for all five classes", () => {
  for (const kind of ["ship", "submarine", "aircraft", "wildlife", "sea-creature"] as const) {
    const profile = createDreamEmissionProfile(72, "night", kind);
    assert.deepEqual(profile, createDreamEmissionProfile(72, "night", kind));
    assert.equal(profile.primaryPeriod, 31); assert.equal(profile.secondaryPeriod, 47);
    for (let t = 0; t < 1000; t += .5) {
      const value = sampleDreamEmission(profile, t, false);
      assert.equal(value.coreFactor, 1); assert.equal(value.haloScale, 1);
      assert.ok(value.haloFactor >= .97 && value.haloFactor <= 1.03);
    }
    assert.deepEqual(sampleDreamEmission(profile, 194, true), { coreFactor: 1, haloFactor: 1, haloScale: 1 });
    assert.equal(createDreamEmissionProfile(72, "day", kind).enabled, false);
  }
});

test("weather gain stays bounded and rejects nonfinite source state", () => {
  assert.equal(dreamEmissionVisibilityLift(0, 0), 1);
  assert.equal(dreamEmissionVisibilityLift(999, 999), 1.22);
  assert.throws(() => dreamEmissionVisibilityLift(Infinity, 99), RangeError);
  const profile = createDreamEmissionProfile(1, "night", "ship", 999);
  assert.equal(profile.haloStrength, .28 * 1.22);
});

test("animated child geometry is registered without modifying native geometry or core opacity", () => {
  const root = new THREE.Group(); const joint = new THREE.Group(); root.add(joint);
  const core = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1), new THREE.MeshStandardMaterial({ color: 0x426ab4, transparent: true, opacity: .82 }));
  joint.add(core); attachDreamEmission(root, createDreamEmissionProfile(9, "night", "wildlife"));
  const runtime = getDreamEmissionRuntime(root)!; const geometry = core.geometry;
  const reference = runtime.referenceSize; const fixedColor = core.material.color.getHex();
  const fixedEmission = core.material.emissiveIntensity;
  joint.rotation.z = .7; updateDreamEmission([root], 40, false);
  assert.equal(runtime.sources[0].mesh, core); assert.equal(core.geometry, geometry);
  assert.equal(core.material.opacity, .82); assert.equal(core.material.color.getHex(), fixedColor);
  assert.equal(core.material.emissiveIntensity, fixedEmission); assert.equal(runtime.referenceSize, reference);
  attachDreamEmission(root, createDreamEmissionProfile(9, "night", "wildlife"));
  assert.equal(getDreamEmissionRuntime(root), runtime);
});
