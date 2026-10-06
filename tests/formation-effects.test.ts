import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import {
  createFormationEffects, FORMATION_EFFECT_LIMITS, updateFormationEffects,
  type FormationEffectUnit,
} from "../app/formationEffects";
import { attachDreamEmission, createDreamEmissionProfile, type DreamEmissionRuntime } from "../app/dreamEmission";

function subject(domain: FormationEffectUnit["domain"], rotor = false): FormationEffectUnit {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 0.2, 0.3), new THREE.MeshStandardMaterial({ color: 0x83aaa3 })));
  if (domain === "surface") {
    const wake = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xe7f5ef, opacity: 0.26, transparent: true }));
    wake.position.x = -1.25; wake.name = "surface-vessel-wake";
    group.add(wake); group.userData.wake = wake;
    group.position.y = 0.16;
  }
  if (domain === "subsurface") group.position.y = -4;
  if (domain === "air") group.position.y = 3;
  if (rotor) {
    const rotorMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.02, 0.1), new THREE.MeshBasicMaterial({ color: 0x52646a }));
    group.userData.rotor = rotorMesh; group.add(rotorMesh);
  }
  const type = rotor ? "maritime-mission-helicopter" : domain === "surface" ? "fleet-aviation-ship"
    : domain === "subsurface" ? "air-independent-submarine" : "deck-multirole-aircraft";
  return { key: `${domain}:${rotor}`, type, domain, group };
}

test("formation travel reuses the authored surface wake and restores its exact resting appearance", () => {
  const scene = new THREE.Scene(); const unit = subject("surface"); scene.add(unit.group);
  const wake = unit.group.userData.wake as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  const initialColor = wake.material.color.clone(); const geometry = wake.geometry; const material = wake.material;
  const beforeChildren = unit.group.children.length;
  const runtime = createFormationEffects(scene, [unit], { surfaceWakeOpacity: 0.3 });
  const moving = new Map([[unit.key, { moving: true, motionStrength: 0.8 }]]);
  updateFormationEffects(runtime, 1, false, moving);
  assert.equal(runtime.units[0].wake, wake);
  assert.equal(wake.geometry, geometry); assert.equal(wake.material, material);
  assert.equal(unit.group.children.length, beforeChildren);
  assert.ok(wake.scale.x > 1.4 && wake.scale.x < 1.5);
  assert.ok(wake.material.opacity > 0.3 && wake.material.opacity < 0.55);
  updateFormationEffects(runtime, 2, false, new Map([[unit.key, { moving: false, motionStrength: 0 }]]));
  assert.deepEqual(wake.scale.toArray(), [1, 1, 1]);
  assert.ok(wake.material.color.equals(initialColor)); assert.equal(wake.material.opacity, 0.3);
});

test("surface and underwater disturbances retain the traveled curve, then decay with bounded storage", () => {
  for (const domain of ["surface", "subsurface"] as const) {
    const scene = new THREE.Scene(); const unit = subject(domain); scene.add(unit.group);
    const runtime = createFormationEffects(scene, [unit]);
    const samples = new Map([[unit.key, { moving: true, motionStrength: 1 }]]);
    for (let frame = 0; frame < 200; frame++) {
      const t = frame / 30;
      unit.group.position.x = t * 0.6;
      unit.group.position.z = Math.sin(t * 0.7);
      unit.group.rotation.y = Math.atan2(-Math.cos(t * 0.7) * 0.7, 0.6);
      updateFormationEffects(runtime, t, false, samples);
    }
    const effect = runtime.units[0]; const trail = effect.trail!;
    assert.ok(trail.visible);
    assert.ok(effect.history.length <= FORMATION_EFFECT_LIMITS.trailPoints);
    assert.ok(effect.history.length >= 3);
    const oldPoint = effect.history[0].position.clone();
    const lastPoint = effect.history[effect.history.length - 1].position;
    assert.ok(Math.abs(oldPoint.z - lastPoint.z) > 0.1, "wake must record a real curve, not rotate a rigid strip");
    assert.ok(trail.material.opacity > 0 && trail.material.opacity <= 0.18);
    assert.ok(trail.geometry.drawRange.count > 0);
    assert.ok(Array.from(trail.geometry.getAttribute("position").array).every(Number.isFinite));
    updateFormationEffects(runtime, 7, false, new Map([[unit.key, { moving: false, motionStrength: 0 }]]));
    assert.ok(effect.history.some((point) => point.position.equals(oldPoint)) || effect.history[0].at >= 7 - FORMATION_EFFECT_LIMITS.trailLifetime - 1e-9);
    updateFormationEffects(runtime, 10, false, new Map([[unit.key, { moving: false, motionStrength: 0 }]]));
    assert.equal(effect.history.length, 0); assert.equal(trail.visible, false);
  }
});

test("fixed-wing propulsion does not create unsupported low-altitude condensation trails", () => {
  for (const type of ["deck-multirole-aircraft", "fixed-wing-surveillance-aircraft"]) {
    const scene = new THREE.Scene(); const unit = { ...subject("air"), type }; scene.add(unit.group);
    const runtime = createFormationEffects(scene, [unit]);
    const samples = new Map([[unit.key, { moving: true, motionStrength: 1 }]]);
    for (let frame = 0; frame < 20; frame++) {
      unit.group.position.x = frame * 0.2;
      updateFormationEffects(runtime, frame * 0.1, false, samples);
    }
    assert.equal(runtime.units[0].trail, undefined);
    assert.equal(runtime.units[0].history.length, 0);
    assert.equal(runtime.units[0].rings.length, 0);
  }
});

test("long maneuvers recycle expired wake points instead of allocating a new history forever", () => {
  const scene = new THREE.Scene(); const unit = subject("surface"); scene.add(unit.group);
  const runtime = createFormationEffects(scene, [unit]);
  const samples = new Map([[unit.key, { moving: true, motionStrength: 1 }]]);
  const observedPoints = new Set<object>();
  for (let frame = 0; frame < 900; frame++) {
    const elapsed = frame / 30;
    unit.group.position.x = elapsed * 0.6;
    unit.group.position.z = Math.sin(elapsed * 0.7);
    updateFormationEffects(runtime, elapsed, false, samples);
    for (const point of runtime.units[0].history) observedPoints.add(point);
  }
  const effect = runtime.units[0];
  assert.ok(effect.trail?.visible);
  assert.ok(effect.history.length > 2);
  assert.ok(observedPoints.size <= FORMATION_EFFECT_LIMITS.trailPoints,
    `30 seconds of wake used ${observedPoints.size} separate records`);
  updateFormationEffects(runtime, 30, true, samples);
  assert.equal(effect.history.length, 0);
  unit.group.position.x += 0.2;
  updateFormationEffects(runtime, 30.1, false, samples);
  assert.ok(observedPoints.has(effect.history[0]), "motion resumption reuses cleared history too");
});

test("hovering rotors retain downwash while reduced motion stops it", () => {
  const scene = new THREE.Scene(); const unit = subject("air", true); scene.add(unit.group);
  const runtime = createFormationEffects(scene, [unit], { waterVisible: true });
  const hovering = new Map([[unit.key, { moving: false, motionStrength: 0 }]]);
  updateFormationEffects(runtime, 0.5, false, hovering);
  assert.ok(runtime.units[0].rings.some((ring) => ring.visible && ring.material.opacity > 0));
  updateFormationEffects(runtime, 0.5, true, hovering);
  assert.ok(runtime.units[0].rings.every((ring) => !ring.visible));
});

test("waterjet wash is narrower and submerged propulsor disturbance remains subdued", () => {
  const scene = new THREE.Scene();
  const screw = subject("surface");
  const jet = { ...subject("surface"), key: "jet", type: "stealth-littoral-corvette" };
  const sub = subject("subsurface"); scene.add(screw.group, jet.group, sub.group);
  const runtime = createFormationEffects(scene, [screw, jet, sub]);
  const samples = new Map([screw, jet, sub].map((unit) => [unit.key, { moving: true, motionStrength: 1 }]));
  for (let frame = 0; frame < 10; frame++) {
    for (const unit of [screw, jet, sub]) unit.group.position.x = frame * 0.2;
    updateFormationEffects(runtime, frame * 0.1, false, samples);
  }
  assert.ok(runtime.units[1].wake!.scale.y < runtime.units[0].wake!.scale.y);
  assert.ok(runtime.units[2].trail!.material.opacity < runtime.units[0].trail!.material.opacity * 0.3);
});

test("a relocation or reversed clock clears old wakes instead of drawing across the sea", () => {
  const scene = new THREE.Scene(); const unit = subject("surface"); scene.add(unit.group);
  const runtime = createFormationEffects(scene, [unit]);
  const samples = new Map([[unit.key, { moving: true, motionStrength: 1 }]]);
  updateFormationEffects(runtime, 1, false, samples);
  unit.group.position.x = 0.4; updateFormationEffects(runtime, 1.2, false, samples);
  assert.equal(runtime.units[0].trail?.visible, true);
  unit.group.position.x = 20; updateFormationEffects(runtime, 1.3, false, samples);
  assert.equal(runtime.units[0].history.length, 1); assert.equal(runtime.units[0].trail?.visible, false);
  unit.group.position.x = 20.3; updateFormationEffects(runtime, 1.5, false, samples);
  updateFormationEffects(runtime, 0, false, samples);
  assert.equal(runtime.units[0].history.length, 1); assert.equal(runtime.units[0].trail?.visible, false);
});

test("rotor downwash follows the actual sea height and disappears above its low-altitude range", () => {
  const scene = new THREE.Scene(); const unit = subject("air", true); scene.add(unit.group);
  const runtime = createFormationEffects(scene, [unit], { waterVisible: true, sampleSurfaceHeight: () => 0.2 });
  const samples = new Map([[unit.key, { moving: true, motionStrength: 1 }]]);
  unit.group.position.set(2, 2, -3);
  updateFormationEffects(runtime, 0.5, false, samples);
  assert.equal(runtime.units[0].trail, undefined);
  assert.ok(runtime.units[0].rings.some((ring) => ring.visible));
  for (const ring of runtime.units[0].rings) {
    assert.deepEqual(ring.position.toArray(), [2, 0.245, -3]);
    assert.ok(ring.material.opacity < 0.16);
  }
  unit.group.position.y = 8; updateFormationEffects(runtime, 1.5, false, samples);
  assert.ok(runtime.units[0].rings.every((ring) => !ring.visible));
  unit.group.position.y = 2;
  const noSea = createFormationEffects(scene, [unit], { waterVisible: false });
  updateFormationEffects(noSea, 0.5, false, samples);
  assert.ok(noSea.units[0].rings.every((ring) => !ring.visible));
});

test("dense-formation effects follow model scale and old wake points stay on current waves", () => {
  const scene = new THREE.Scene();
  const ship = subject("surface"); const rotor = subject("air", true);
  scene.add(ship.group, rotor.group);
  ship.group.scale.setScalar(0.2); rotor.group.scale.setScalar(0.2);
  const runtime = createFormationEffects(scene, [ship, rotor], { sampleSurfaceHeight: (x, _z, elapsed) => x * 0.02 + elapsed * 0.1 });
  const samples = new Map([ship, rotor].map((unit) => [unit.key, { moving: true, motionStrength: 1 }]));
  for (let frame = 0; frame < 5; frame++) {
    ship.group.position.x = frame * 0.2;
    updateFormationEffects(runtime, frame * 0.2, false, samples);
  }
  const positions = runtime.units[0].trail!.geometry.getAttribute("position");
  for (let index = 0; index < runtime.units[0].history.length; index++) {
    const a = index * 2; const b = a + 1;
    const midpointX = (positions.getX(a) + positions.getX(b)) / 2;
    assert.ok(Math.abs(positions.getY(a) - (midpointX * 0.02 + 0.08 + 0.035)) < 1e-7);
    assert.ok(Math.hypot(positions.getX(a) - positions.getX(b), positions.getZ(a) - positions.getZ(b)) <= 0.24 * 0.2 * 2 + 1e-7);
  }
  assert.ok(runtime.units[1].rings.every((ring) => ring.scale.x <= 2.25 * 0.2));
});

test("reduced motion, hidden units, missing samples and nonfinite input leave no added disturbance", () => {
  const scene = new THREE.Scene(); const ship = subject("surface"); const rotor = subject("air", true);
  scene.add(ship.group, rotor.group);
  const runtime = createFormationEffects(scene, [ship, rotor]);
  const samples = new Map([ship, rotor].map((unit) => [unit.key, { moving: true, motionStrength: 1 }]));
  updateFormationEffects(runtime, 1, false, samples);
  ship.group.position.x = 0.4; updateFormationEffects(runtime, 1.2, false, samples);
  assert.ok(runtime.units[0].trail?.visible);
  for (const badState of ["reduced", "hidden", "missing", "nonfinite"] as const) {
    ship.group.visible = rotor.group.visible = badState !== "hidden";
    updateFormationEffects(runtime, badState === "nonfinite" ? NaN : 2, badState === "reduced", badState === "missing" ? new Map() : samples);
    assert.ok(runtime.units.every((unit) => unit.history.length === 0 && !unit.trail?.visible && unit.rings.every((ring) => !ring.visible)));
  }
});

test("environment effects remain fogged, depth-tested ordinary transparency outside native glow", () => {
  const scene = new THREE.Scene(); const unit = subject("surface"); scene.add(unit.group);
  const runtime = createFormationEffects(scene, [unit]);
  attachDreamEmission(unit.group, createDreamEmissionProfile(1, "night", "ship"));
  const emission = unit.group.userData.dreamEmission as DreamEmissionRuntime;
  assert.equal(emission.parts.length, 1, "environment wake must never enter native color bloom");
  runtime.group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    assert.equal(object.userData.dreamEmissionExcluded, true);
    const material = object.material as THREE.MeshBasicMaterial;
    assert.equal(material.blending, THREE.NormalBlending);
    assert.equal(material.depthTest, true); assert.equal(material.depthWrite, false); assert.equal(material.fog, true);
    assert.equal("emissive" in material, false);
  });
  attachDreamEmission(unit.group, createDreamEmissionProfile(1, "day", "ship"));
  assert.equal(unit.group.userData.dreamEmission, undefined);
  assert.equal(runtime.group.getObjectsByProperty("isLight", true).length, 0);
});
