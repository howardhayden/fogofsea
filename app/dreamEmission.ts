import * as THREE from "three";
import { seededRandom, stableSeed } from "./viewModel";
import { DREAM_GLOW_MODEL, dreamGlowBreathing } from "./dreamGlowMath";
import { sampleStarShimmer } from "./starPulse";

export type DreamEmissionTime = "dawn" | "day" | "dusk" | "night";
export type DreamEmissionKind = "ship" | "aircraft" | "submarine" | "creature";
export type DreamEmissionProfile = Readonly<{
  kind: DreamEmissionKind;
  enabled: boolean;
  haloStrength: number;
  primaryPeriod: number;
  secondaryPeriod: number;
  primaryPhase: number;
  secondaryPhase: number;
}>;
export type DreamEmissionSample = Readonly<{ haloFactor: number }>;
export type DreamSourceMaterial = THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
export type DreamSourcePart = { mesh: THREE.Mesh; material: DreamSourceMaterial };
export type DreamEmissionRuntime = {
  profile: DreamEmissionProfile;
  parts: DreamSourcePart[];
  referenceBox: THREE.Box3;
  referenceSphere: THREE.Sphere;
  haloFactor: number;
  movementIntensity: number;
};

/** Formation travel adds gentle gain variation to the existing native-color
 * glow. It does not resize the source, change its color, or create a clock. */
export const DREAM_MOVEMENT_PULSE = Object.freeze({ frequencyHz: 0.24, amplitude: 0.1 });

/** No per-entity shell geometry. Sources include environmental creatures, so
 * the former 42-subject cap must not silently exclude the additional families.
 */
export const DREAM_EMISSION_LIMITS = Object.freeze({
  haloMeshesPerSubject: 0,
  maxHaloMeshes: 0,
  maxSourceTextureSize: 2048,
  maxBufferPixels: 8_388_608,
});

/** Existing caller compatibility: fog is attenuation, never an excuse to
 * increase emission. Kept as a neutral function rather than reversing fog.
 */
export function dreamEmissionVisibilityLift(_fogDensity: number, _precipitationTier: number): number {
  return 1;
}

export function createDreamEmissionProfile(
  seed: number,
  time: DreamEmissionTime,
  kind: DreamEmissionKind,
  _visibilityLift = 1,
): DreamEmissionProfile {
  if (!["ship", "submarine", "aircraft", "creature"].includes(kind)) throw new RangeError("Unknown dream-emission kind");
  if (!["dawn", "day", "dusk", "night"].includes(time)) throw new RangeError("Unknown dream-emission time");
  if (!Number.isFinite(seed)) throw new RangeError("Invalid dream-emission seed");
  const random = seededRandom(stableSeed(seed, kind, "dream-emission"));
  const enabled = time !== "day";
  return Object.freeze({ kind, enabled,
    haloStrength: enabled ? DREAM_GLOW_MODEL.gain : 0,
    primaryPeriod: DREAM_GLOW_MODEL.primaryPeriod,
    secondaryPeriod: DREAM_GLOW_MODEL.secondaryPeriod,
    primaryPhase: random() * Math.PI * 2,
    secondaryPhase: random() * Math.PI * 2,
  });
}

function boundedMovementIntensity(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

export function sampleDreamEmission(
  profile: DreamEmissionProfile,
  elapsed: number,
  reducedMotion: boolean,
  movementIntensity = 0,
): DreamEmissionSample {
  const resting = dreamGlowBreathing(elapsed, profile.primaryPhase, profile.secondaryPhase, reducedMotion);
  const movement = boundedMovementIntensity(movementIntensity);
  if (reducedMotion || !profile.enabled || profile.kind === "creature" || movement === 0
    || ![elapsed, profile.primaryPhase, profile.secondaryPhase].every(Number.isFinite)) return { haloFactor: resting };
  const shimmer = sampleStarShimmer(Math.max(0, elapsed), profile.primaryPhase, DREAM_MOVEMENT_PULSE.frequencyHz);
  return { haloFactor: resting + shimmer * DREAM_MOVEMENT_PULSE.amplitude * movement };
}

/** Call with normalized formation travel, not wave bob, wing articulation, or
 * camera motion. A resting target must receive zero on its next update. */
export function setDreamEmissionMovement(target: THREE.Group, intensity: number): void {
  const runtime = target.userData.dreamEmission as DreamEmissionRuntime | undefined;
  if (runtime) runtime.movementIntensity = runtime.profile.kind === "creature" ? 0 : boundedMovementIntensity(intensity);
}

export function dreamSourceVisible(object: THREE.Object3D): boolean {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (!current.visible || current.userData.dreamEmissionAuthorized === false) return false;
    current = current.parent;
  }
  return true;
}

function excludedPart(mesh: THREE.Mesh, root: THREE.Group): boolean {
  if (mesh === root.userData.ring || mesh === root.userData.wake || mesh.geometry instanceof THREE.RingGeometry) return true;
  let current: THREE.Object3D | null = mesh;
  while (current && current !== root) {
    if (current.userData.dreamEmissionExcluded === true || /(?:wake|reaction|dream-emission-aura|contact-marker)/i.test(current.name)) return true;
    current = current.parent;
  }
  return false;
}

/** Register already-authorized scene geometry. No traversal of undisclosed
 * world-state entities, no copied aura mesh, no material-dependent bright pass.
 */
export function attachDreamEmission(group: THREE.Group, profile: DreamEmissionProfile): void {
  detachDreamEmission(group);
  if (!profile.enabled || group.userData.dreamEmissionAuthorized === false) return;
  if (![profile.haloStrength, profile.primaryPhase, profile.secondaryPhase].every(Number.isFinite)
    || profile.haloStrength < 0 || profile.haloStrength > 1) return;
  group.updateWorldMatrix(true, true);
  const inverseRoot = group.matrixWorld.clone().invert();
  const localBounds = new THREE.Box3();
  const relative = new THREE.Matrix4();
  const parts: DreamSourcePart[] = [];
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh || object instanceof THREE.SkinnedMesh || excludedPart(object, group)) return;
    const original = object.material;
    if (!(original instanceof THREE.MeshStandardMaterial || original instanceof THREE.MeshBasicMaterial)) return;
    // Deformed/multi-material renderers need their own explicitly qualified
    // extraction path; the current generated entity families use this path.
    if (object.morphTargetInfluences?.length) return;
    // The real model remains the crisp, lit scene source. DreamGlowRenderer
    // owns separate emission-only proxies and samples this native material;
    // registration must never make hull or airframe surfaces emissive.
    parts.push({ mesh: object, material: original });
    object.geometry.computeBoundingBox();
    if (object.geometry.boundingBox) {
      relative.multiplyMatrices(inverseRoot, object.matrixWorld);
      localBounds.union(object.geometry.boundingBox.clone().applyMatrix4(relative));
    }
  });
  if (!parts.length || localBounds.isEmpty()) return;
  const referenceBox = localBounds.clone();
  group.userData.dreamEmission = {
    profile,
    parts,
    // Canonical local bounds are frozen at registration. Root/camera projection
    // may change their screen footprint; articulated subparts cannot pump it.
    referenceBox,
    referenceSphere: referenceBox.getBoundingSphere(new THREE.Sphere()),
    haloFactor: 1,
    movementIntensity: 0,
  } satisfies DreamEmissionRuntime;
  group.userData.dreamEmissionHaloMeshes = 0;
}

export function detachDreamEmission(group: THREE.Group): void {
  const runtime = group.userData.dreamEmission as DreamEmissionRuntime | undefined;
  if (!runtime) return;
  delete group.userData.dreamEmission;
  delete group.userData.dreamEmissionHaloMeshes;
}

export function updateDreamEmission(targets: readonly THREE.Group[], elapsed: number, reducedMotion: boolean): void {
  for (const target of targets) {
    const runtime = target.userData.dreamEmission as DreamEmissionRuntime | undefined;
    if (runtime) runtime.haloFactor = sampleDreamEmission(runtime.profile, elapsed, reducedMotion, runtime.movementIntensity).haloFactor;
  }
}
