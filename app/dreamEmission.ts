import * as THREE from "three";
import { seededRandom, stableSeed } from "./viewModel";
import { finite, NDCG_SEED } from "./dreamGlowMath";

export type DreamEmissionTime = "dawn" | "day" | "dusk" | "night";
export type DreamEmissionKind = "ship" | "aircraft" | "submarine" | "wildlife" | "sea-creature";
export type DreamEmissionProfile = Readonly<{
  kind: DreamEmissionKind;
  enabled: boolean;
  coreStrength: number;
  haloStrength: number;
  primaryPeriod: number;
  secondaryPeriod: number;
  primaryPhase: number;
  secondaryPhase: number;
}>;
export type DreamEmissionSample = { coreFactor: number; haloFactor: number; haloScale: number };
export type DreamSourceMaterial = THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
export type DreamEmissionSource = { mesh: THREE.Mesh; materials: DreamSourceMaterial[] };
export type DreamEmissionRuntime = {
  profile: DreamEmissionProfile;
  sources: DreamEmissionSource[];
  referenceSize: number;
  referenceCenter: THREE.Vector3;
  haloFactor: number;
};

/** These are zero because the new renderer does not add aura meshes to subjects.
 * A shared, bounded source texture is reused across every subject instead. */
export const DREAM_EMISSION_LIMITS = Object.freeze({
  haloMeshesPerSubject: 0,
  maxHaloMeshes: 0,
  maxSubjects: 512,
  sourceTextureSize: 256,
  maxReferencePixels: 512,
});

const STRENGTH_BY_TIME = Object.freeze({ dawn: .70, day: 0, dusk: .85, night: 1 });
const KINDS: readonly DreamEmissionKind[] = ["ship", "aircraft", "submarine", "wildlife", "sea-creature"];

export function dreamEmissionVisibilityLift(fogDensity: number, precipitationTier: number) {
  finite(fogDensity, "fog density", 0); finite(precipitationTier, "precipitation tier", 0);
  const fog = Math.max(0, Math.min(1, (fogDensity - .003) / .045));
  return Math.min(1.22, 1 + fog * .14 + Math.min(1, precipitationTier / 5) * .08);
}

export function createDreamEmissionProfile(seed: number, time: DreamEmissionTime, kind: DreamEmissionKind, visibilityLift = 1): DreamEmissionProfile {
  if (!Number.isSafeInteger(seed)) throw new RangeError("dream emission seed must be a safe integer");
  if (!Object.hasOwn(STRENGTH_BY_TIME, time) || !KINDS.includes(kind)) throw new RangeError("unknown dream emission time or kind");
  finite(visibilityLift, "visibility lift", 0);
  const random = seededRandom(stableSeed(seed, kind, "ndcg-v0.1-native"));
  const strength = STRENGTH_BY_TIME[time] * Math.max(1, Math.min(1.22, visibilityLift));
  return Object.freeze({
    kind, enabled: time !== "day",
    coreStrength: .18 * strength,
    haloStrength: NDCG_SEED.gain * strength,
    primaryPeriod: 31, secondaryPeriod: 47,
    primaryPhase: random() * Math.PI * 2, secondaryPhase: random() * Math.PI * 2,
  });
}

function validateProfile(profile: DreamEmissionProfile) {
  if (!KINDS.includes(profile.kind) || typeof profile.enabled !== "boolean") throw new RangeError("invalid emission profile");
  finite(profile.coreStrength, "core strength", 0); finite(profile.haloStrength, "halo strength", 0);
  finite(profile.primaryPeriod, "primary period", Number.MIN_VALUE); finite(profile.secondaryPeriod, "secondary period", Number.MIN_VALUE);
  finite(profile.primaryPhase, "primary phase"); finite(profile.secondaryPhase, "secondary phase");
}

export function sampleDreamEmission(profile: DreamEmissionProfile, elapsed: number, reducedMotion: boolean): DreamEmissionSample {
  validateProfile(profile); finite(elapsed, "elapsed time", 0);
  return {
    coreFactor: 1,
    haloFactor: reducedMotion ? 1 : 1 + .02 * Math.sin(elapsed * Math.PI * 2 / profile.primaryPeriod + profile.primaryPhase)
      + .01 * Math.sin(elapsed * Math.PI * 2 / profile.secondaryPeriod + profile.secondaryPhase),
    haloScale: 1,
  };
}

export function getDreamEmissionRuntime(group: THREE.Group): DreamEmissionRuntime | undefined {
  return group.userData.dreamEmission as DreamEmissionRuntime | undefined;
}

/** Explicit source enrollment, after the authoritative view has admitted the
 * subject. It neither inserts geometry nor discovers undisclosed world objects.
 * Fixed native emissive fill preserves authored shading and never casts light.
 */
export function attachDreamEmission(group: THREE.Group, profile: DreamEmissionProfile) {
  validateProfile(profile);
  if (!profile.enabled || getDreamEmissionRuntime(group)) return;
  group.updateWorldMatrix(true, true);
  const inverse = group.matrixWorld.clone().invert();
  const bounds = new THREE.Box3();
  const local = new THREE.Box3();
  const transform = new THREE.Matrix4();
  const sources: DreamEmissionSource[] = [];
  const copies = new Map<DreamSourceMaterial, DreamSourceMaterial>();
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh || object instanceof THREE.SkinnedMesh) return;
    if (object === group.userData.ring || object === group.userData.wake || object.geometry.type === "RingGeometry") return;
    for (let parent: THREE.Object3D | null = object; parent && parent !== group.parent; parent = parent.parent) {
      if (parent.userData.dreamEmissionExclude === true) return;
    }
    const authored = Array.isArray(object.material) ? object.material : [object.material];
    if (!authored.every((material) => material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshBasicMaterial)) return;
    const materials = authored.map((material) => {
      const native = material as DreamSourceMaterial;
      let copy = copies.get(native);
      if (!copy) {
        copy = native.clone(); copies.set(native, copy);
        if (copy instanceof THREE.MeshStandardMaterial) {
          copy.emissive.copy(copy.color);
          copy.emissiveIntensity = profile.coreStrength;
        }
      }
      return copy;
    });
    object.material = Array.isArray(object.material) ? materials : materials[0];
    sources.push({ mesh: object, materials });
    object.geometry.computeBoundingBox();
    if (object.geometry.boundingBox) {
      transform.multiplyMatrices(inverse, object.matrixWorld);
      local.copy(object.geometry.boundingBox).applyMatrix4(transform); bounds.union(local);
    }
  });
  if (!sources.length || bounds.isEmpty()) return;
  const size = bounds.getSize(new THREE.Vector3());
  const runtime: DreamEmissionRuntime = {
    profile, sources,
    referenceSize: Math.max(size.x, size.y, size.z),
    referenceCenter: bounds.getCenter(new THREE.Vector3()),
    haloFactor: 1,
  };
  if (!(runtime.referenceSize > 0) || !Number.isFinite(runtime.referenceSize)) return;
  group.userData.dreamEmission = runtime;
  group.userData.dreamEmissionHaloMeshes = 0;
}

export function updateDreamEmission(targets: readonly THREE.Group[], elapsed: number, reducedMotion: boolean) {
  for (const target of targets) {
    const runtime = getDreamEmissionRuntime(target);
    if (runtime) runtime.haloFactor = sampleDreamEmission(runtime.profile, elapsed, reducedMotion).haloFactor;
  }
}
