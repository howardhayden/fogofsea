import * as THREE from "three";
import { sampleWaveField, type WaveFieldPlan } from "./environmentVisuals";
import type { VisibleWildlife, WildlifeKind, WildlifeMedium } from "./wildlife";

export type WildlifeAvatarTheme = "light" | "dark";

export const WILDLIFE_AVATAR_ENGINE = {
  name: "articulated-low-poly-wildlife",
  version: 3,
  reactionSeconds: 1.8,
  restingPenguinReactionSeconds: 4.8,
  routeModel: "bounded-ecological-routes",
  maxSurfaceSharkOffset: 0.035,
} as const;

export type RestingPenguinReactionStage = "resting" | "recover" | "stand" | "scratch" | "lie-down";

export function restingPenguinReactionStage(progress: number): RestingPenguinReactionStage {
  if (!Number.isFinite(progress) || progress < 0) return "resting";
  if (progress < 0.2) return "recover";
  if (progress < 0.42) return "stand";
  if (progress < 0.78) return "scratch";
  if (progress <= 1) return "lie-down";
  return "resting";
}

type AvatarJointName =
  | "modelRoot"
  | "torso"
  | "head"
  | "leftWing"
  | "rightWing"
  | "leftFlipper"
  | "rightFlipper"
  | "leftLeg"
  | "rightLeg"
  | "tail"
  | "leftFluke"
  | "rightFluke";

export type WildlifeAvatarRig = Partial<Record<AvatarJointName, THREE.Group>> & {
  modelRoot: THREE.Group;
  torso: THREE.Group;
};

export const RESTING_PENGUIN_SEQUENCE = [
  { stage: "recover", fromSeconds: 0, toSeconds: 0.96, joints: ["modelRoot", "leftFlipper", "rightFlipper", "leftLeg", "rightLeg"] },
  { stage: "stand", fromSeconds: 0.96, toSeconds: 2.016, joints: ["modelRoot", "leftFlipper", "rightFlipper", "leftLeg", "rightLeg"] },
  { stage: "scratch", fromSeconds: 2.016, toSeconds: 3.744, joints: ["head", "leftFlipper", "rightFlipper"] },
  { stage: "lie-down", fromSeconds: 3.744, toSeconds: 4.8, joints: ["modelRoot", "head", "leftFlipper", "rightFlipper"] },
] as const;

function material(color: number, opacity = 0.82) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.9,
    metalness: 0,
    flatShading: true,
    transparent: opacity < 1,
    opacity,
  });
}

function joint(name: AvatarJointName, parent: THREE.Object3D, x = 0, y = 0, z = 0) {
  const value = new THREE.Group();
  value.name = `wildlife-joint-${name}`;
  value.position.set(x, y, z);
  parent.add(value);
  return value;
}

function mesh(
  name: string,
  geometry: THREE.BufferGeometry,
  appearance: THREE.MeshStandardMaterial,
  parent: THREE.Object3D,
) {
  const value = new THREE.Mesh(geometry, appearance);
  value.name = `wildlife-part-${name}`;
  parent.add(value);
  return value;
}

function createPenguinRig(modelRoot: THREE.Group, body: THREE.MeshStandardMaterial, pale: THREE.MeshStandardMaterial, accent: THREE.MeshStandardMaterial) {
  const torso = joint("torso", modelRoot);
  const bodyMesh = mesh("body", new THREE.DodecahedronGeometry(0.44, 0), body, torso);
  bodyMesh.scale.set(0.72, 1.34, 0.76);
  const chest = mesh("chest", new THREE.OctahedronGeometry(0.29, 0), pale, torso);
  chest.position.set(0.15, -0.04, 0);
  chest.scale.set(0.36, 1.04, 0.72);

  const head = joint("head", torso, 0, 0.58, 0);
  mesh("head", new THREE.DodecahedronGeometry(0.28, 0), body, head);
  const beak = mesh("beak", new THREE.ConeGeometry(0.11, 0.3, 3), accent, head);
  beak.rotation.z = -Math.PI / 2;
  beak.position.x = 0.36;

  const leftFlipper = joint("leftFlipper", torso, 0, 0.06, 0.34);
  const leftFlipperMesh = mesh("left-flipper", new THREE.ConeGeometry(0.12, 0.58, 3), body, leftFlipper);
  leftFlipperMesh.position.z = 0.23;
  leftFlipperMesh.rotation.x = 0.28;
  const rightFlipper = joint("rightFlipper", torso, 0, 0.06, -0.34);
  const rightFlipperMesh = mesh("right-flipper", new THREE.ConeGeometry(0.12, 0.58, 3), body, rightFlipper);
  rightFlipperMesh.position.z = -0.23;
  rightFlipperMesh.rotation.x = -0.28;

  const leftLeg = joint("leftLeg", torso, -0.03, -0.55, 0.17);
  const leftFoot = mesh("left-foot", new THREE.TetrahedronGeometry(0.15, 0), accent, leftLeg);
  leftFoot.scale.set(1.4, 0.34, 0.8);
  leftFoot.position.x = 0.1;
  const rightLeg = joint("rightLeg", torso, -0.03, -0.55, -0.17);
  const rightFoot = mesh("right-foot", new THREE.TetrahedronGeometry(0.15, 0), accent, rightLeg);
  rightFoot.scale.copy(leftFoot.scale);
  rightFoot.position.x = 0.1;
  return { modelRoot, torso, head, leftFlipper, rightFlipper, leftLeg, rightLeg } satisfies WildlifeAvatarRig;
}

function createSealRig(modelRoot: THREE.Group, body: THREE.MeshStandardMaterial) {
  const torso = joint("torso", modelRoot);
  const bodyMesh = mesh("body", new THREE.DodecahedronGeometry(0.5, 0), body, torso);
  bodyMesh.scale.set(1.7, 0.58, 0.72);
  const head = joint("head", torso, 0.67, 0.12, 0);
  const headMesh = mesh("head", new THREE.DodecahedronGeometry(0.3, 0), body, head);
  headMesh.position.x = 0.07;

  const leftFlipper = joint("leftFlipper", torso, 0.1, -0.08, 0.34);
  const left = mesh("left-flipper", new THREE.ConeGeometry(0.16, 0.52, 3), body, leftFlipper);
  left.position.z = 0.25;
  left.rotation.x = 0.86;
  const rightFlipper = joint("rightFlipper", torso, 0.1, -0.08, -0.34);
  const right = mesh("right-flipper", new THREE.ConeGeometry(0.16, 0.52, 3), body, rightFlipper);
  right.position.z = -0.25;
  right.rotation.x = -0.86;

  const tail = joint("tail", torso, -0.74, 0, 0);
  const leftFluke = joint("leftFluke", tail, -0.13, 0, 0.11);
  const leftTail = mesh("left-hind-flipper", new THREE.ConeGeometry(0.14, 0.42, 3), body, leftFluke);
  leftTail.rotation.z = Math.PI / 2;
  leftTail.position.x = -0.19;
  const rightFluke = joint("rightFluke", tail, -0.13, 0, -0.11);
  const rightTail = mesh("right-hind-flipper", new THREE.ConeGeometry(0.14, 0.42, 3), body, rightFluke);
  rightTail.rotation.z = Math.PI / 2;
  rightTail.position.x = -0.19;
  return { modelRoot, torso, head, leftFlipper, rightFlipper, tail, leftFluke, rightFluke } satisfies WildlifeAvatarRig;
}

function createMarineRig(modelRoot: THREE.Group, kind: "whale" | "dolphin" | "shark", body: THREE.MeshStandardMaterial, pale: THREE.MeshStandardMaterial) {
  const whale = kind === "whale";
  const shark = kind === "shark";
  const torso = joint("torso", modelRoot);
  const bodyMesh = mesh("body", new THREE.DodecahedronGeometry(0.5, 0), body, torso);
  bodyMesh.scale.set(whale ? 2.25 : shark ? 1.88 : 1.72, whale ? 0.62 : 0.52, whale ? 0.72 : shark ? 0.54 : 0.57);
  const head = joint("head", torso, whale ? 0.92 : 0.76, 0, 0);
  const snout = mesh("snout", new THREE.ConeGeometry(whale ? 0.3 : 0.2, whale ? 0.72 : shark ? 0.48 : 0.56, shark ? 4 : 5), body, head);
  snout.rotation.z = -Math.PI / 2;
  snout.position.x = whale ? 0.28 : 0.22;

  const dorsal = mesh("dorsal-fin", new THREE.ConeGeometry(whale ? 0.22 : shark ? 0.24 : 0.18, whale ? 0.58 : shark ? 0.62 : 0.46, 3), body, torso);
  dorsal.position.set(-0.18, whale ? 0.47 : shark ? 0.44 : 0.38, 0);
  const leftFlipper = joint("leftFlipper", torso, 0.18, -0.05, 0.3);
  const leftFin = mesh("left-pectoral-fin", new THREE.ConeGeometry(whale ? 0.16 : 0.12, whale ? 0.66 : 0.5, 3), shark ? pale : body, leftFlipper);
  leftFin.position.z = whale ? 0.3 : 0.23;
  leftFin.rotation.x = Math.PI / 2;
  const rightFlipper = joint("rightFlipper", torso, 0.18, -0.05, -0.3);
  const rightFin = mesh("right-pectoral-fin", new THREE.ConeGeometry(whale ? 0.16 : 0.12, whale ? 0.66 : 0.5, 3), shark ? pale : body, rightFlipper);
  rightFin.position.z = whale ? -0.3 : -0.23;
  rightFin.rotation.x = -Math.PI / 2;

  const tail = joint("tail", torso, whale ? -0.93 : -0.74, 0, 0);
  const peduncle = mesh("tail-peduncle", new THREE.ConeGeometry(whale ? 0.22 : 0.16, whale ? 0.9 : 0.68, 5), body, tail);
  peduncle.rotation.z = Math.PI / 2;
  peduncle.position.x = whale ? -0.38 : -0.29;
  const leftFluke = joint("leftFluke", tail, whale ? -0.72 : -0.55, 0, 0.04);
  const leftTail = mesh("left-tail-fluke", new THREE.ConeGeometry(whale ? 0.25 : 0.18, whale ? 0.7 : 0.52, 3), body, leftFluke);
  leftTail.rotation.z = Math.PI / 2;
  leftTail.rotation.x = shark ? 0 : 0.62;
  leftTail.position.z = shark ? 0 : 0.22;
  const rightFluke = joint("rightFluke", tail, whale ? -0.72 : -0.55, 0, shark ? 0 : -0.04);
  const rightTail = mesh("right-tail-fluke", new THREE.ConeGeometry(whale ? 0.25 : 0.18, whale ? 0.7 : 0.52, 3), body, rightFluke);
  rightTail.rotation.z = Math.PI / 2;
  rightTail.rotation.x = shark ? Math.PI : -0.62;
  rightTail.position.z = shark ? 0 : -0.22;
  if (shark) {
    leftTail.position.y = 0.17;
    rightTail.position.y = -0.17;
  }
  return { modelRoot, torso, head, leftFlipper, rightFlipper, tail, leftFluke, rightFluke } satisfies WildlifeAvatarRig;
}

function createBirdRig(modelRoot: THREE.Group, body: THREE.MeshStandardMaterial, accent: THREE.MeshStandardMaterial) {
  const torso = joint("torso", modelRoot);
  const bodyMesh = mesh("body", new THREE.OctahedronGeometry(0.28, 0), body, torso);
  bodyMesh.scale.set(1.25, 0.54, 0.62);
  const head = joint("head", torso, 0.35, 0.04, 0);
  mesh("head", new THREE.TetrahedronGeometry(0.19, 0), body, head);
  const beak = mesh("beak", new THREE.ConeGeometry(0.07, 0.3, 3), accent, head);
  beak.rotation.z = -Math.PI / 2;
  beak.position.x = 0.22;

  const leftWing = joint("leftWing", torso, -0.02, 0, 0.23);
  const left = mesh("left-wing", new THREE.ConeGeometry(0.27, 0.9, 3), body, leftWing);
  left.position.z = 0.42;
  left.rotation.x = Math.PI / 2;
  const rightWing = joint("rightWing", torso, -0.02, 0, -0.23);
  const right = mesh("right-wing", new THREE.ConeGeometry(0.27, 0.9, 3), body, rightWing);
  right.position.z = -0.42;
  right.rotation.x = -Math.PI / 2;
  const tail = joint("tail", torso, -0.28, 0, 0);
  const tailMesh = mesh("tail", new THREE.ConeGeometry(0.13, 0.38, 3), body, tail);
  tailMesh.rotation.z = Math.PI / 2;
  tailMesh.position.x = -0.18;
  return { modelRoot, torso, head, leftWing, rightWing, tail } satisfies WildlifeAvatarRig;
}

function reactionColor(medium: WildlifeMedium) {
  return medium === "subsurface" ? 0x9ee0df : medium === "ice" ? 0xf1f4e9 : medium === "air" ? 0xf2d8a0 : 0xb8e1dc;
}

function addReactionMotes(group: THREE.Group, medium: WildlifeMedium) {
  const root = new THREE.Group();
  root.name = "wildlife-happy-reaction";
  root.visible = false;
  for (let index = 0; index < 5; index++) {
    const appearance = material(reactionColor(medium), 0);
    appearance.depthWrite = false;
    const mote = new THREE.Mesh(
      medium === "subsurface" ? new THREE.IcosahedronGeometry(0.075, 0) : new THREE.TetrahedronGeometry(0.09, 0),
      appearance,
    );
    mote.name = "wildlife-reaction-mote";
    const angle = index / 5 * Math.PI * 2;
    mote.position.set(Math.cos(angle) * 0.42, 0.32 + (index % 2) * 0.18, Math.sin(angle) * 0.42);
    mote.userData.basePosition = mote.position.clone();
    root.add(mote);
  }
  group.add(root);
  return root;
}

/** Creates an articulated, deterministic low-poly animal avatar. Every
 * recognizable animal has a torso plus independently animated anatomical
 * joints; none is represented by a single rotating primitive. */
export function createWildlifeAvatar(plan: VisibleWildlife, theme: WildlifeAvatarTheme) {
  const group = new THREE.Group();
  group.name = `environmental-wildlife-${plan.kind}`;
  // Keep the scene safe even when an avatar is constructed from imported or
  // future data rather than the validated wildlife plan.  Marine animals are
  // never ice fauna: a malformed `ice`/`resting` record is repaired at the
  // rendering boundary and routed through the water animation below.
  const marine = plan.kind === "shark" || plan.kind === "dolphin" || plan.kind === "whale";
  const medium: WildlifeMedium = marine && plan.medium === "ice" ? "surface" : plan.medium;
  const behavior = marine && plan.behavior === "resting" ? "swimming" : plan.behavior;
  const restingPose = marine ? false : plan.restingPose;
  const dark = theme === "dark";
  const bodyColor = plan.kind === "penguin" ? (dark ? 0x263a45 : 0x314b52)
    : plan.kind === "seal" ? (dark ? 0x78949b : 0x718e91)
      : plan.kind === "whale" ? (dark ? 0x416c78 : 0x587f84)
        : plan.kind === "dolphin" ? (dark ? 0x5f8993 : 0x6d9699)
          : plan.kind === "shark" ? (dark ? 0x496b74 : 0x5d7c80)
            : (dark ? 0xa8b9b7 : 0x667f7d);
  const body = material(bodyColor, medium === "subsurface" ? 0.72 : 0.9);
  const pale = material(dark ? 0xd2ded8 : 0xe8eee8, medium === "subsurface" ? 0.62 : 0.86);
  const accent = material(dark ? 0xb98f59 : 0xa8753f, 0.9);
  const modelRoot = joint("modelRoot", group);
  const rig = plan.kind === "penguin" ? createPenguinRig(modelRoot, body, pale, accent)
    : plan.kind === "seal" ? createSealRig(modelRoot, body)
      : plan.kind === "whale" || plan.kind === "dolphin" || plan.kind === "shark" ? createMarineRig(modelRoot, plan.kind, body, pale)
        : createBirdRig(modelRoot, body, accent);
  const reactionRoot = addReactionMotes(group, medium);
  // The visual model follows physical scale, while the invisible interaction
  // volume has a humane minimum world-space size for small birds. Because the
  // complete group is scaled below, divide here rather than enlarging fauna.
  const targetWorldWidth = plan.kind === "whale" ? 1.9 : plan.kind === "dolphin" || plan.kind === "shark" || plan.kind === "seal" ? 1.05 : 0.62;
  const targetWorldHeight = medium === "air" ? 0.62 : 0.72;
  const targetWorldDepth = medium === "air" ? 0.7 : 0.78;
  const hitTarget = new THREE.Mesh(
    new THREE.BoxGeometry(targetWorldWidth / plan.scale, targetWorldHeight / plan.scale, targetWorldDepth / plan.scale),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, colorWrite: false, depthWrite: false }),
  );
  hitTarget.name = "wildlife-hit-target";
  group.add(hitTarget);

  group.scale.setScalar(plan.scale);
  group.userData.environmentalWildlife = true;
  group.userData.avatarEngine = WILDLIFE_AVATAR_ENGINE.name;
  group.userData.avatarEngineVersion = WILDLIFE_AVATAR_ENGINE.version;
  group.userData.kind = plan.kind;
  group.userData.groupId = plan.groupId;
  group.userData.memberId = plan.id;
  group.userData.label = plan.label;
  group.userData.medium = medium;
  group.userData.behavior = behavior;
  group.userData.baseX = plan.x;
  group.userData.baseY = medium === "subsurface" ? -plan.depth : plan.y;
  group.userData.baseZ = plan.z;
  group.userData.phase = plan.phase;
  group.userData.speed = plan.speed;
  group.userData.radius = plan.radius;
  group.userData.routeRadius = plan.radius;
  group.userData.routeEccentricity = plan.routeEccentricity;
  group.userData.routeDirection = plan.routeDirection;
  group.userData.baseHeading = plan.heading;
  group.userData.restingPose = restingPose;
  group.userData.rig = rig;
  group.userData.reactionRoot = reactionRoot;
  group.userData.reactionStartedAt = Number.NEGATIVE_INFINITY;
  group.userData.reactionStage = restingPose ? "resting" : "traveling";
  group.userData.motionState = "active";
  group.position.set(group.userData.baseX, group.userData.baseY, group.userData.baseZ);
  group.rotation.y = plan.heading;
  return group;
}

export function triggerWildlifeAvatarReaction(animal: THREE.Group, elapsed: number) {
  if (!animal.userData.environmentalWildlife) return false;
  animal.userData.reactionStartedAt = Math.max(0, Number.isFinite(elapsed) ? elapsed : 0);
  animal.userData.reactionCount = (Number(animal.userData.reactionCount) || 0) + 1;
  return true;
}

function animateJoints(
  rig: WildlifeAvatarRig,
  kind: WildlifeKind,
  medium: WildlifeMedium,
  locomotion: number,
  secondary: number,
  reactionActive: boolean,
  reactionProgress: number,
  reducedMotion: boolean,
) {
  const reactionBeat = reactionActive ? Math.sin(reactionProgress * Math.PI * (reducedMotion ? 1 : 6)) : 0;
  const reactionLift = reactionActive ? Math.sin(reactionProgress * Math.PI) : 0;
  rig.modelRoot.rotation.set(0, 0, 0);
  rig.torso.rotation.set(0, 0, 0);
  rig.torso.scale.set(1, 1, 1);
  if (rig.head) rig.head.rotation.set(0, 0, 0);

  if (kind === "seabird" || kind === "shorebird") {
    const flap = 0.16 + locomotion * 0.62 + reactionBeat * 0.52;
    if (rig.leftWing) rig.leftWing.rotation.x = -flap;
    if (rig.rightWing) rig.rightWing.rotation.x = flap;
    if (rig.tail) rig.tail.rotation.y = secondary * 0.22;
    if (rig.head) rig.head.rotation.y = -secondary * 0.12;
    rig.modelRoot.rotation.z = secondary * 0.12;
    rig.torso.rotation.z = secondary * 0.05;
    return;
  }
  if (kind === "penguin") {
    const swimming = medium === "subsurface" || medium === "surface";
    const flap = swimming ? locomotion * 0.78 : locomotion * 0.18;
    if (rig.leftFlipper) rig.leftFlipper.rotation.x = -flap - reactionBeat * 0.48;
    if (rig.rightFlipper) rig.rightFlipper.rotation.x = flap + reactionBeat * 0.48;
    if (rig.leftLeg) rig.leftLeg.rotation.z = locomotion * 0.2;
    if (rig.rightLeg) rig.rightLeg.rotation.z = -locomotion * 0.2;
    if (rig.head) rig.head.rotation.z = secondary * 0.07 - reactionLift * 0.08;
    rig.modelRoot.rotation.z = swimming ? -Math.PI / 2 + locomotion * 0.06 : 0;
    rig.torso.rotation.z = swimming ? 0 : locomotion * 0.025;
    return;
  }
  if (kind === "seal") {
    const swimming = medium !== "ice";
    if (rig.leftFlipper) rig.leftFlipper.rotation.x = locomotion * (swimming ? 0.58 : 0.3) - reactionBeat * 0.3;
    if (rig.rightFlipper) rig.rightFlipper.rotation.x = -locomotion * (swimming ? 0.58 : 0.3) + reactionBeat * 0.3;
    if (rig.tail) rig.tail.rotation.y = secondary * (swimming ? 0.3 : 0.16) + reactionBeat * 0.2;
    if (rig.leftFluke) rig.leftFluke.rotation.z = locomotion * 0.3;
    if (rig.rightFluke) rig.rightFluke.rotation.z = -locomotion * 0.3;
    if (rig.head) rig.head.rotation.z = 0.1 + secondary * 0.11 + reactionLift * 0.24;
    rig.modelRoot.rotation.z = swimming ? secondary * 0.08 : 0;
    rig.torso.rotation.z = swimming ? locomotion * 0.035 : -0.035 + locomotion * 0.02;
    return;
  }

  const shark = kind === "shark";
  const dolphin = kind === "dolphin";
  rig.modelRoot.rotation.z = medium === "subsurface" ? secondary * 0.08 : secondary * 0.035;
  if (rig.tail) rig.tail.rotation.y = locomotion * (shark ? 0.54 : dolphin ? 0.46 : 0.34) + reactionBeat * 0.26;
  if (rig.leftFluke) rig.leftFluke.rotation.y = locomotion * (shark ? 0.3 : dolphin ? 0.24 : 0.14);
  if (rig.rightFluke) rig.rightFluke.rotation.y = locomotion * (shark ? 0.3 : dolphin ? -0.24 : -0.14);
  if (rig.leftFlipper) rig.leftFlipper.rotation.x = 0.04 + secondary * 0.09 + reactionLift * 0.12;
  if (rig.rightFlipper) rig.rightFlipper.rotation.x = -0.04 - secondary * 0.09 - reactionLift * 0.12;
  if (rig.head) rig.head.rotation.y = -locomotion * 0.045;
  rig.torso.rotation.y = -locomotion * (shark ? 0.08 : dolphin ? 0.06 : 0.035);
}

function smootherStep(value: number) {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * clamped * (clamped * (clamped * 6 - 15) + 10);
}

function applyRestingPenguinPose(
  rig: WildlifeAvatarRig,
  locomotion: number,
  stage: RestingPenguinReactionStage,
  progress: number,
  reducedMotion: boolean,
) {
  const restingAngle = -1.32;
  const breath = reducedMotion ? 0.018 : Math.sin(locomotion * Math.PI) * 0.018;
  rig.torso.scale.y = 1 + breath;
  rig.modelRoot.position.y = 0;
  rig.modelRoot.rotation.z = restingAngle;
  if (rig.head) rig.head.rotation.z = 0.17;
  if (rig.leftFlipper) rig.leftFlipper.rotation.x = -0.16;
  if (rig.rightFlipper) rig.rightFlipper.rotation.x = 0.11;
  if (rig.leftLeg) rig.leftLeg.rotation.z = 0.08;
  if (rig.rightLeg) rig.rightLeg.rotation.z = -0.08;

  if (stage === "resting") return;
  if (reducedMotion) {
    // One readable, stable active pose communicates the whole gag without a
    // forced recovery motion for users who request less animation.
    rig.modelRoot.position.y = 0.12;
    rig.modelRoot.rotation.z = 0;
    if (rig.head) rig.head.rotation.z = -0.24;
    if (rig.leftFlipper) {
      rig.leftFlipper.rotation.x = -0.52;
      rig.leftFlipper.rotation.z = -1.12;
    }
    return;
  }

  if (stage === "recover") {
    const local = smootherStep(progress / 0.2);
    // Brace, tuck the legs, and rotate through the shortest path toward an
    // upright body. Never accumulate a full turn around the model root.
    rig.modelRoot.position.y = local * 0.09;
    rig.modelRoot.rotation.z = restingAngle * (1 - local * 0.54);
    if (rig.leftFlipper) {
      rig.leftFlipper.rotation.x = -0.2 - Math.sin(local * Math.PI) * 0.42;
      rig.leftFlipper.rotation.z = -Math.sin(local * Math.PI) * 0.38;
    }
    if (rig.rightFlipper) {
      rig.rightFlipper.rotation.x = 0.16 + Math.sin(local * Math.PI) * 0.36;
      rig.rightFlipper.rotation.z = Math.sin(local * Math.PI) * 0.32;
    }
    if (rig.leftLeg) rig.leftLeg.rotation.z = 0.08 + local * 0.22;
    if (rig.rightLeg) rig.rightLeg.rotation.z = -0.08 - local * 0.22;
    return;
  }
  if (stage === "stand") {
    const local = smootherStep((progress - 0.2) / 0.22);
    const bracedAngle = restingAngle * 0.46;
    rig.modelRoot.position.y = 0.09 + local * 0.03;
    rig.modelRoot.rotation.z = bracedAngle * (1 - local);
    if (rig.leftFlipper) rig.leftFlipper.rotation.x = -Math.sin(local * Math.PI) * 0.62;
    if (rig.rightFlipper) rig.rightFlipper.rotation.x = Math.sin(local * Math.PI) * 0.62;
    if (rig.leftLeg) rig.leftLeg.rotation.z = 0.3 * (1 - local);
    if (rig.rightLeg) rig.rightLeg.rotation.z = -0.3 * (1 - local);
    return;
  }
  if (stage === "scratch") {
    const local = (progress - 0.42) / 0.36;
    const puzzled = Math.sin(local * Math.PI * 4);
    rig.modelRoot.position.y = 0.12;
    rig.modelRoot.rotation.z = 0;
    if (rig.head) rig.head.rotation.z = -0.2 + puzzled * 0.12;
    if (rig.leftFlipper) {
      rig.leftFlipper.rotation.x = -0.58 + puzzled * 0.12;
      rig.leftFlipper.rotation.z = -1.08 + puzzled * 0.18;
    }
    if (rig.rightFlipper) rig.rightFlipper.rotation.x = 0.16 - puzzled * 0.08;
    return;
  }
  const local = smootherStep((progress - 0.78) / 0.22);
  rig.modelRoot.position.y = 0.12 * (1 - local);
  rig.modelRoot.rotation.z = local * restingAngle;
  if (rig.leftFlipper) rig.leftFlipper.rotation.x = -0.52 + local * 0.36;
  if (rig.rightFlipper) rig.rightFlipper.rotation.x = 0.18 - local * 0.07;
}

function routeHeading(dx: number, dz: number, fallback: number) {
  if (Math.hypot(dx, dz) < 1e-6) return fallback;
  // Avatar geometry faces local +X. A Y rotation maps +X to (cos(y), -sin(y)).
  return Math.atan2(-dz, dx);
}

function updateReactionMotes(animal: THREE.Group, active: boolean, progress: number, energy: number, reducedMotion: boolean) {
  const root = animal.userData.reactionRoot as THREE.Group | undefined;
  if (!root) return;
  root.visible = active;
  root.position.y = energy * 0.72;
  root.scale.setScalar(0.72 + progress * 0.72);
  root.children.forEach((child, index) => {
    if (!(child instanceof THREE.Mesh)) return;
    const base = child.userData.basePosition as THREE.Vector3;
    child.position.copy(base).multiplyScalar(1 + progress * 0.72);
    child.position.y += progress * (0.3 + index * 0.055);
    child.rotation.x = progress * (index + 1) * 0.65;
    child.rotation.y = progress * (index + 2) * 0.48;
    if (child.material instanceof THREE.MeshStandardMaterial) child.material.opacity = energy * (reducedMotion ? 0.42 : 0.68);
  });
}

/** Drives locomotion, anatomical articulation, and optional greeting actions.
 * Reduced motion selects a visibly active but completely frozen pose. */
export function updateWildlifeAvatars(wildlife: readonly THREE.Group[], wavePlan: WaveFieldPlan, elapsed: number, reducedMotion: boolean) {
  wildlife.forEach((animal) => {
    const phase = Number(animal.userData.phase);
    const speed = Number(animal.userData.speed);
    const radius = Number(animal.userData.routeRadius ?? animal.userData.radius);
    const eccentricity = Number(animal.userData.routeEccentricity) || 0.58;
    const routeDirection = Number(animal.userData.routeDirection) < 0 ? -1 : 1;
    const baseX = Number(animal.userData.baseX);
    const baseY = Number(animal.userData.baseY);
    const baseZ = Number(animal.userData.baseZ);
    const medium = animal.userData.medium as WildlifeMedium;
    const behavior = String(animal.userData.behavior);
    const kind = animal.userData.kind as WildlifeKind;
    const restingPenguin = kind === "penguin" && medium === "ice" && Boolean(animal.userData.restingPose);
    const rig = animal.userData.rig as WildlifeAvatarRig;
    const time = reducedMotion ? 0 : Math.max(0, elapsed);
    const locomotion = Math.sin(time * (2.2 + speed * 4.5) + phase);
    const routeAngle = time * speed * routeDirection + phase;
    const primary = Math.cos(routeAngle);
    const secondary = Math.sin(routeAngle);
    const routeX = primary * radius;
    const routeZ = secondary * radius * eccentricity;
    const routeDx = -Math.sin(routeAngle) * radius * speed * routeDirection;
    const routeDz = Math.cos(routeAngle) * radius * eccentricity * speed * routeDirection;
    const fixedActiveLift = reducedMotion ? 0.018 : 0;
    const startedAt = Number(animal.userData.reactionStartedAt);
    const age = Math.max(0, elapsed - startedAt);
    const reactionSeconds = restingPenguin ? WILDLIFE_AVATAR_ENGINE.restingPenguinReactionSeconds : WILDLIFE_AVATAR_ENGINE.reactionSeconds;
    const active = Number.isFinite(startedAt) && age <= reactionSeconds;
    const progress = reducedMotion ? 0.6 : Math.min(1, age / reactionSeconds);
    const penguinStage = restingPenguin && active ? restingPenguinReactionStage(progress) : "resting";
    const energy = active ? Math.sin(progress * Math.PI) : 0;
    animal.rotation.set(0, routeHeading(routeDx, routeDz, Number(animal.userData.baseHeading)), 0);
    animal.userData.motionState = reducedMotion ? "active-pose-frozen" : "active";
    animal.userData.routeProgress = ((routeAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI * 2);
    animal.userData.routeDestination = {
      x: baseX + Math.cos(routeAngle + 0.34 * routeDirection) * radius,
      z: baseZ + Math.sin(routeAngle + 0.34 * routeDirection) * radius * eccentricity,
    };
    animal.userData.reactionStage = restingPenguin ? penguinStage : active ? "greeting" : "traveling";
    if (medium === "air") {
      animal.position.set(
        baseX + routeX,
        baseY + Math.sin(routeAngle * 1.7) * 0.36 + Math.cos(routeAngle * 0.83) * 0.18 + fixedActiveLift,
        baseZ + routeZ,
      );
    } else if (medium === "subsurface") {
      animal.position.set(
        baseX + routeX,
        baseY + Math.sin(routeAngle * 1.43) * 0.22 + fixedActiveLift,
        baseZ + routeZ,
      );
    } else if (medium === "surface") {
      animal.position.x = baseX + routeX;
      animal.position.z = baseZ + routeZ;
      const waveY = sampleWaveField(wavePlan, animal.position.x, -animal.position.z, time);
      if (kind === "shark") {
        const dorsalPass = behavior === "surfacing" ? Math.max(0, Math.sin(routeAngle * 0.73)) * 0.045 : 0;
        animal.position.y = waveY - 0.14 + dorsalPass;
        animal.userData.surfaceOffset = animal.position.y - waveY;
      } else if (kind === "dolphin") {
        // A surface dolphin crosses the water continuously. A porpoising
        // route rises into a short arc, then places the body back beneath the
        // local wave instead of leaving it parked above the surface.
        const porpoiseWave = Math.sin(routeAngle * 1.34 + phase * 0.23);
        const porpoiseLift = behavior === "porpoising" ? Math.pow(Math.max(0, porpoiseWave), 1.65) * 0.34 : 0;
        animal.position.y = waveY - 0.08 + porpoiseLift + fixedActiveLift;
        animal.userData.surfaceOffset = animal.position.y - waveY;
        animal.userData.porpoisePhase = porpoiseWave;
      } else {
        const surfacing = behavior === "surfacing" ? Math.max(0, Math.sin(routeAngle * 0.73)) * 0.22
          : behavior === "porpoising" ? Math.max(0, Math.sin(routeAngle * 1.19)) * 0.38 : 0;
        animal.position.y = baseY + waveY * 0.72 + surfacing + fixedActiveLift;
      }
    } else {
      const hop = kind === "penguin" ? Math.pow(Math.max(0, Math.sin(time * 1.25 + phase)), 8) * 0.11 : 0;
      const scoot = kind === "seal" ? Math.pow(Math.max(0, locomotion), 4) * 0.045 : 0;
      animal.position.set(
        restingPenguin ? baseX : baseX + routeX,
        baseY + (restingPenguin ? 0 : hop + scoot) + fixedActiveLift,
        restingPenguin ? baseZ : baseZ + routeZ,
      );
      if (restingPenguin) animal.rotation.y = Number(animal.userData.baseHeading);
    }

    animateJoints(rig, kind, medium, locomotion, secondary, active, progress, reducedMotion);
    if (kind === "dolphin" && medium === "surface" && !reducedMotion) {
      // Pitch follows the rise and fall of the surface arc while the scene
      // root continues to face the route tangent.
      rig.modelRoot.rotation.z += Math.cos(routeAngle * 1.34 + phase * 0.23) * 0.24;
    }
    if (restingPenguin) applyRestingPenguinPose(rig, locomotion, penguinStage, progress, reducedMotion);

    if (active) {
      const lift = medium === "air" ? 0.62 : medium === "subsurface" ? 0.26 : medium === "ice" ? 0.38
        : kind === "dolphin" ? 0.76 : kind === "whale" ? 0.28 : kind === "shark" ? 0.12 : 0.42;
      if (restingPenguin) {
        // Its rig performs a grounded brace-and-rise; the scene root remains
        // fixed to the safe floe waypoint rather than bobbing or spinning.
      } else if (kind === "shark" && medium === "surface") {
        const waveY = sampleWaveField(wavePlan, animal.position.x, -animal.position.z, time);
        animal.position.y = Math.min(waveY + WILDLIFE_AVATAR_ENGINE.maxSurfaceSharkOffset, animal.position.y + energy * lift);
        animal.userData.surfaceOffset = animal.position.y - waveY;
        rig.modelRoot.rotation.z += energy * 0.13;
      } else {
        animal.position.y += energy * lift;
        if (medium === "subsurface") rig.modelRoot.rotation.x += energy * 0.42;
        else if (medium === "air") rig.modelRoot.rotation.z += Math.sin(progress * Math.PI * 4) * 0.18;
        else rig.modelRoot.rotation.z += Math.sin(progress * Math.PI * 2) * (kind === "whale" ? 0.08 : 0.18);
      }
    }
    updateReactionMotes(animal, active, progress, energy, reducedMotion);
  });
}
