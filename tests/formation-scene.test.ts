import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { createFormationPlan, reconcileFormationMotion, sampleFormationMotion } from "../app/formation";
import { applyFormationPose, formationFrameDistance, formationUnitForView } from "../app/formationScene";
import { VIEW_CONFIG } from "../app/viewModel";

test("formation camera includes dense surface, air and submerged envelopes at desktop and narrow aspects", () => {
  const plan = createFormationPlan({ "fleet-aviation-ship": 1, "stealth-littoral-corvette": 99, "long-endurance-submarine": 99 }, { "uncrewed-logistics-aircraft": 99 });
  const state = reconcileFormationMotion(undefined, plan, 0);
  for (const aspect of [1.8, 0.52]) for (const view of ["surface", "air", "subsurface"] as const) {
    const config = VIEW_CONFIG[view];
    const target = new THREE.Vector3().fromArray(config.target);
    const camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 450);
    camera.position.fromArray(config.camera);
    camera.lookAt(target);
    const distance = formationFrameDistance(camera, target, state, 0, view);
    camera.position.sub(target).setLength(distance).add(target);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    for (const unit of plan.filter((member) => formationUnitForView(member, view))) {
      for (const dx of [-unit.clearanceRadius, unit.clearanceRadius]) for (const dy of [-unit.clearanceRadius, unit.clearanceRadius]) for (const dz of [-unit.clearanceRadius, unit.clearanceRadius]) {
        const point = new THREE.Vector3(unit.position[0] + dx, unit.position[1] + dy, unit.position[2] + dz).project(camera);
        assert.ok(Math.abs(point.x) < 1 && Math.abs(point.y) < 1 && Math.abs(point.z) < 1, `${view}/${aspect}/${unit.key}: ${point.toArray()}`);
      }
    }
  }
});

test("actual group pose keeps its mid-maneuver transform across scene replacement", () => {
  const one = createFormationPlan({ "fleet-aviation-ship": 1 }, {});
  const two = createFormationPlan({ "fleet-aviation-ship": 2 }, {});
  const before = reconcileFormationMotion(undefined, one, 0);
  const moving = reconcileFormationMotion(before, two, 1);
  const group = new THREE.Group();
  applyFormationPose(group, sampleFormationMotion(moving.get(one[0].key)!, 2.2));
  const captured = { position: group.position.toArray(), rotation: group.rotation.y, scale: group.scale.x };
  const retained = reconcileFormationMotion(moving, two, 2.2);
  const rebuilt = new THREE.Group();
  applyFormationPose(rebuilt, sampleFormationMotion(retained.get(one[0].key)!, 2.2));
  assert.deepEqual(rebuilt.position.toArray(), captured.position);
  assert.equal(rebuilt.rotation.y, captured.rotation);
  assert.equal(rebuilt.scale.x, captured.scale);
  applyFormationPose(rebuilt, sampleFormationMotion(retained.get(one[0].key)!, 2.2, true));
  assert.deepEqual(rebuilt.position.toArray(), two[0].position);
});

test("automatic framing retains complete model envelopes throughout an outboard roster-change turn", () => {
  const initial = createFormationPlan({ "fleet-aviation-ship": 1, "multirole-frigate": 1, "long-endurance-submarine": 1 }, {});
  const added = createFormationPlan({ "fleet-aviation-ship": 1, "area-defense-destroyer": 1, "multirole-frigate": 1, "long-endurance-submarine": 2 }, {});
  const state = reconcileFormationMotion(reconcileFormationMotion(undefined, initial, 0), added, 1);
  for (const aspect of [0.52, 1.8]) for (const view of ["surface", "air", "subsurface"] as const) {
    const config = VIEW_CONFIG[view];
    const target = new THREE.Vector3().fromArray(config.target);
    const camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 450);
    camera.position.fromArray(config.camera);
    camera.lookAt(target);
    const distance = formationFrameDistance(camera, target, state, 1, view);
    camera.position.sub(target).setLength(distance).add(target);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    const frustum = new THREE.Frustum().setFromProjectionMatrix(
      new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
    );
    for (const transition of state.values()) {
      if (!formationUnitForView(transition.target, view)) continue;
      // Independently inspect 101 points: the original endpoint-only fit
      // clipped the frigate during this turn. Clearance is spherical, so
      // normalized frustum-plane distance checks its whole model envelope.
      for (let step = 0; step <= 100; step++) {
        const sample = sampleFormationMotion(transition, 1 + transition.duration * step / 100);
        const radius = transition.target.clearanceRadius / transition.target.visualScale * sample.visualScale;
        const point = new THREE.Vector3().fromArray(sample.position);
        for (const plane of frustum.planes) {
          assert.ok(plane.distanceToPoint(point) > radius,
            `${view}/${aspect}/${transition.target.key}/${step}: model sphere crosses a camera plane`);
        }
      }
    }
  }
});

test("fixed-wing patrol remains framed for a complete circuit after relocation ends", () => {
  const plan = createFormationPlan({ "fleet-aviation-ship": 1 }, { "deck-multirole-aircraft": 2, "fixed-wing-surveillance-aircraft": 1 });
  const state = reconcileFormationMotion(undefined, plan, 0);
  for (const aspect of [0.52, 1.8]) {
    const config = VIEW_CONFIG.air;
    const target = new THREE.Vector3().fromArray(config.target);
    const camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 450);
    camera.position.fromArray(config.camera); camera.lookAt(target);
    const distance = formationFrameDistance(camera, target, state, 0, "air");
    camera.position.sub(target).setLength(distance).add(target); camera.lookAt(target); camera.updateMatrixWorld();
    const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    for (const transition of state.values()) {
      if (transition.target.domain !== "air") continue;
      for (let seconds = 0; seconds <= 80; seconds++) {
        const sample = sampleFormationMotion(transition, seconds);
        const center = new THREE.Vector3().fromArray(sample.position);
        for (const plane of frustum.planes) assert.ok(plane.distanceToPoint(center) > transition.target.clearanceRadius);
      }
    }
  }
});

test("flight bank rolls wings around the forward axis while pitch raises the nose", () => {
  const group = new THREE.Group();
  const target = createFormationPlan({ "fleet-aviation-ship": 1 }, { "deck-multirole-aircraft": 1 }).find((unit) => unit.domain === "air")!;
  const base = sampleFormationMotion(reconcileFormationMotion(undefined, [target], 0).get(target.key)!, 0);
  const heading = 0.6; const bank = 0.3; const pitch = 0.2;
  applyFormationPose(group, { ...base, heading, bank, pitch: 0 });
  const nose = new THREE.Vector3(1, 0, 0).applyQuaternion(group.quaternion);
  assert.ok(nose.distanceTo(new THREE.Vector3(Math.cos(heading), 0, -Math.sin(heading))) < 1e-12);
  const wing = new THREE.Vector3(0, 0, 1).applyQuaternion(group.quaternion);
  assert.ok(Math.abs(wing.y + Math.sin(bank)) < 1e-12);
  applyFormationPose(group, { ...base, heading, bank, pitch });
  assert.ok(Math.abs(new THREE.Vector3(1, 0, 0).applyQuaternion(group.quaternion).y - Math.sin(pitch)) < 1e-12);
});
