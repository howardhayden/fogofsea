import * as THREE from "three";
import { sampleFormationMotion, type FormationMotionState, type FormationSample, type FormationUnit } from "./formation";
import type { ViewLayer } from "./viewModel";
import { formationMotionProfile } from "./propulsion";

export function formationUnitForView(unit: FormationUnit, view: ViewLayer) {
  return view === "subsurface" ? unit.domain === "subsurface"
    : view === "surface" || view === "air" ? unit.domain !== "subsurface" : false;
}

/** Apply the travel pose first; wave heave and articulation layer on afterward. */
export function applyFormationPose(group: THREE.Group, sample: FormationSample) {
  group.position.fromArray(sample.position);
  // Models point along local +X: yaw about Y, nose-up pitch about Z, bank
  // about the resulting forward X axis. Do not confuse banking with pitch.
  group.rotation.set(sample.bank, sample.heading, sample.pitch, "YZX");
  group.scale.setScalar(sample.visualScale);
  group.userData.baseY = sample.position[1];
}

/** Fit endpoints plus their bowed travel envelope while preserving viewing
 * direction. This only sets the automatic opening/roster/resize framing;
 * subsequent user orbit and zoom remain under OrbitControls. */
export function formationFrameDistance(
  camera: THREE.PerspectiveCamera,
  target: THREE.Vector3,
  state: FormationMotionState,
  now: number,
  view: ViewLayer,
) {
  const backward = camera.position.clone().sub(target).normalize();
  const right = new THREE.Vector3().crossVectors(camera.up, backward).normalize();
  const up = new THREE.Vector3().crossVectors(backward, right).normalize();
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const tanH = tanV * Math.max(0.1, camera.aspect);
  let distance = camera.position.distanceTo(target);
  for (const transition of state.values()) {
    if (!formationUnitForView(transition.target, view)) continue;
    const profile = formationMotionProfile(transition.target.type);
    if (profile.handling === "fast-fixed-wing" || profile.handling === "persistent-fixed-wing") {
      // Fixed-wing patrol continues after station relocation. Frame the full
      // circuit, so ordinary flight cannot leave the automatic opening view.
      const radius = Math.max(Math.hypot(transition.from.position[0], transition.from.position[2]),
        Math.hypot(transition.target.position[0], transition.target.position[2]))
        + transition.target.clearanceRadius + 1.1;
      const height = Math.max(transition.from.position[1], transition.target.position[1]);
      for (const x of [-radius, radius]) for (const z of [-radius, radius]) {
        const offset = new THREE.Vector3(x, height, z).sub(target);
        distance = Math.max(distance, offset.dot(backward)
          + Math.max(Math.abs(offset.dot(right)) / tanH, (Math.abs(offset.dot(up)) + transition.target.clearanceRadius) / tanV));
      }
    }
    const remaining = Math.max(0, transition.startedAt + transition.duration - now);
    // Outboard turns can sweep beyond both endpoints. Include their path and
    // the current model size when a denser selection is shrinking neighbors.
    for (let step = 0; step <= (remaining > 0 ? 16 : 0); step++) {
      const sample = sampleFormationMotion(transition, now + remaining * step / 16);
      const radius = transition.target.clearanceRadius / transition.target.visualScale * sample.visualScale + 1.1;
      const offset = new THREE.Vector3().fromArray(sample.position).sub(target);
      distance = Math.max(distance, offset.dot(backward)
        + Math.max((Math.abs(offset.dot(right)) + radius) / tanH, (Math.abs(offset.dot(up)) + radius) / tanV));
    }
  }
  return distance;
}
