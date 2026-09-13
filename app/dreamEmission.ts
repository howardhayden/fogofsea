import * as THREE from "three";
import { seededRandom, stableSeed } from "./viewModel";
import { DREAM_GLOW_MODEL, sampleDreamGlowPulse } from "./dreamGlowMath";

export type DreamEmissionTime = "dawn" | "day" | "dusk" | "night";
export type DreamEmissionKind = "ship" | "aircraft" | "submarine" | "creature";
export type DreamEmissionProfile = Readonly<{
  kind: DreamEmissionKind;
  enabled: boolean;
  coreStrength: number;
  haloStrength: number;
  primaryPeriod: 31;
  secondaryPeriod: 47;
  primaryPhase: number;
  secondaryPhase: number;
}>;
export type DreamEmissionSample = { coreFactor: number; haloFactor: number };
export type DreamEmissionPart = {
  mesh: THREE.Mesh;
  originals: THREE.Material | THREE.Material[];
  owned: THREE.Material[];
};
export type DreamEmissionRuntime = {
  profile: DreamEmissionProfile;
  parts: DreamEmissionPart[];
  referenceSize: number;
  gain: number;
};

// Existing scene population bounds remain authoritative. No subjects are dropped
// to fit a cosmetic quota, and no extra world-space halo meshes are created.
export const DREAM_EMISSION_LIMITS = Object.freeze({ haloMeshesPerSubject: 0, maxHaloMeshes: 0 });
const TIME = {
  dawn: { core: 0.14, halo: 0.65 },
  day: { core: 0, halo: 0 },
  dusk: { core: 0.18, halo: 0.8 },
  night: { core: 0.22, halo: 1 },
} as const;

export function dreamEmissionVisibilityLift(fogDensity: number, precipitationTier: number) {
  const fog = Math.max(0, Math.min(1, ((Number.isNaN(fogDensity) ? 0 : fogDensity) - 0.003) / 0.045));
  const weather = Math.max(0, Math.min(1, (Number.isNaN(precipitationTier) ? 0 : precipitationTier) / 5));
  return Math.min(1.22, 1 + fog * 0.14 + weather * 0.08);
}

export function createDreamEmissionProfile(seed: number, time: DreamEmissionTime, kind: DreamEmissionKind, visibilityLift = 1): DreamEmissionProfile {
  if (!Number.isFinite(seed) || !Object.hasOwn(TIME, time) || !["ship", "submarine", "aircraft", "creature"].includes(kind)) throw new RangeError("Invalid dream-emission profile");
  const random = seededRandom(stableSeed(seed, kind, "dream-emission"));
  const lift = Math.max(1, Math.min(1.22, Number.isFinite(visibilityLift) ? visibilityLift : 1));
  return Object.freeze({
    kind, enabled: time !== "day", coreStrength: TIME[time].core * lift,
    haloStrength: DREAM_GLOW_MODEL.gain * TIME[time].halo * lift,
    primaryPeriod: 31, secondaryPeriod: 47,
    primaryPhase: random() * Math.PI * 2, secondaryPhase: random() * Math.PI * 2,
  });
}

export function sampleDreamEmission(profile: DreamEmissionProfile, elapsed: number, reducedMotion: boolean): DreamEmissionSample {
  return { coreFactor: 1, haloFactor: sampleDreamGlowPulse(elapsed, profile.primaryPhase, profile.secondaryPhase, reducedMotion) };
}

export function isDreamEmissionVisible(object: THREE.Object3D) {
  let node: THREE.Object3D | null = object;
  while (node) {
    if (!node.visible || node.userData.dreamEmissionAuthorized === false) return false;
    node = node.parent;
  }
  return true;
}

function eligiblePart(mesh: THREE.Mesh, root: THREE.Group) {
  if (mesh === root.userData.ring || mesh === root.userData.wake || mesh.geometry.type === "RingGeometry") return false;
  for (let node: THREE.Object3D | null = mesh; node && node !== root; node = node.parent) {
    if (/reaction|mote|halo|aura|wake|hit-target/i.test(node.name) || node.userData.dreamEmissionSource === false) return false;
  }
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return materials.every((m) => m.colorWrite && (m instanceof THREE.MeshStandardMaterial || m instanceof THREE.MeshBasicMaterial));
}

/** Register genuine geometry and a fixed native-color core lift. No shell,
 * point light, duplicated world geometry, radius animation, or palette wash. */
export function attachDreamEmission(group: THREE.Group, profile: DreamEmissionProfile) {
  if (group.userData.dreamEmission || !profile.enabled || group.userData.dreamEmissionAuthorized === false) return;
  const parts: DreamEmissionPart[] = [];
  const cloned = new Map<THREE.Material, THREE.Material>();
  group.updateWorldMatrix(true, true);
  const inverseRoot = group.matrixWorld.clone().invert();
  const localBounds = new THREE.Box3();
  const partBounds = new THREE.Box3();
  const matrix = new THREE.Matrix4();
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || !eligiblePart(object, group)) return;
    const originals = object.material;
    const owned: THREE.Material[] = [];
    const materials = (Array.isArray(originals) ? originals : [originals]).map((original) => {
      let copy = cloned.get(original);
      if (!copy) {
        const created = original.clone() as THREE.Material;
        if (created instanceof THREE.MeshStandardMaterial) {
          // Preserve dark/light regional differences and all shading parameters.
          created.emissive.add(created.color.clone().multiplyScalar(profile.coreStrength / Math.max(1e-6, created.emissiveIntensity)));
        }
        cloned.set(original, created);
        owned.push(created);
        copy = created;
      }
      return copy;
    });
    object.material = Array.isArray(originals) ? materials : materials[0];
    if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
    if (object.geometry.boundingBox) {
      matrix.multiplyMatrices(inverseRoot, object.matrixWorld);
      partBounds.copy(object.geometry.boundingBox).applyMatrix4(matrix);
      localBounds.union(partBounds);
    }
    parts.push({ mesh: object, originals, owned });
  });
  if (!parts.length) return;
  const size = localBounds.getSize(new THREE.Vector3());
  const referenceSize = Math.max(size.x, size.y, size.z, 1e-6);
  group.userData.dreamEmission = { profile, parts, referenceSize, gain: profile.haloStrength } satisfies DreamEmissionRuntime;
  group.userData.dreamEmissionHaloMeshes = 0;
}

export function updateDreamEmission(targets: readonly THREE.Group[], elapsed: number, reducedMotion: boolean) {
  for (const target of targets) {
    const runtime = target.userData.dreamEmission as DreamEmissionRuntime | undefined;
    if (runtime) runtime.gain = runtime.profile.haloStrength * sampleDreamEmission(runtime.profile, elapsed, reducedMotion).haloFactor;
  }
}

export function detachDreamEmission(group: THREE.Group) {
  const runtime = group.userData.dreamEmission as DreamEmissionRuntime | undefined;
  if (!runtime) return;
  for (const part of runtime.parts) {
    part.mesh.material = part.originals;
    for (const material of part.owned) material.dispose();
  }
  delete group.userData.dreamEmission;
  delete group.userData.dreamEmissionHaloMeshes;
}
