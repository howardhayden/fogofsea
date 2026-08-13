import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { seededRandom, stableSeed } from "./viewModel";

export type DreamEmissionTime = "dawn" | "day" | "dusk" | "night";
export type DreamEmissionKind = "ship" | "aircraft" | "submarine";

export type DreamEmissionProfile = {
  enabled: boolean;
  coreStrength: number;
  haloStrength: number;
  haloScale: number;
  outerHaloStrength: number;
  outerHaloScale: number;
  primaryPeriod: number;
  secondaryPeriod: number;
  primaryPhase: number;
  secondaryPhase: number;
};

export type DreamEmissionSample = {
  coreFactor: number;
  haloFactor: number;
  haloScale: number;
};

type DreamEmissionRuntime = {
  profile: DreamEmissionProfile;
  coreMaterials: THREE.MeshStandardMaterial[];
  halos: Array<{
    mesh: THREE.Mesh;
    material: THREE.ShaderMaterial;
    baseScale: number;
    baseStrength: number;
  }>;
};

export const DREAM_EMISSION_LIMITS = {
  haloMeshesPerSubject: 2,
  maxSubjects: 42,
  maxHaloMeshes: 84,
} as const;

const STRENGTH_BY_TIME = {
  // The shell is still a small fraction of a fully opaque material, but must
  // survive antialiasing when an aircraft is only a few screen pixels wide.
  dawn: { core: 0.14, halo: 0.32, outerHalo: 0.075 },
  day: { core: 0, halo: 0, outerHalo: 0 },
  dusk: { core: 0.18, halo: 0.38, outerHalo: 0.09 },
  night: { core: 0.22, halo: 0.44, outerHalo: 0.11 },
} as const;

const HALO_SCALE_BY_KIND = {
  ship: { inner: 1.09, outer: 1.17 },
  submarine: { inner: 1.11, outer: 1.19 },
  aircraft: { inner: 1.16, outer: 1.26 },
} as const;

/** A bounded lift keeps nearby subjects enjoyable to read in poor weather,
 * but is intentionally too small to cancel exponential fog or depth tests. */
export function dreamEmissionVisibilityLift(fogDensity: number, precipitationTier: number) {
  const fog = Math.max(0, Math.min(1, (fogDensity - 0.003) / 0.045));
  const weather = Math.max(0, Math.min(1, precipitationTier / 5));
  return Math.min(1.22, 1 + fog * 0.14 + weather * 0.08);
}

export function createDreamEmissionProfile(
  seed: number,
  time: DreamEmissionTime,
  kind: DreamEmissionKind,
  visibilityLift = 1,
): DreamEmissionProfile {
  const random = seededRandom(stableSeed(seed, kind, "dream-emission"));
  const strength = STRENGTH_BY_TIME[time];
  const scale = HALO_SCALE_BY_KIND[kind];
  const boundedLift = Math.max(1, Math.min(1.22, Number.isFinite(visibilityLift) ? visibilityLift : 1));
  return {
    enabled: time !== "day",
    coreStrength: strength.core * boundedLift,
    haloStrength: strength.halo * boundedLift,
    haloScale: scale.inner,
    outerHaloStrength: strength.outerHalo * boundedLift,
    outerHaloScale: scale.outer,
    primaryPeriod: 24 + random() * 14,
    secondaryPeriod: 57 + random() * 26,
    primaryPhase: random() * Math.PI * 2,
    secondaryPhase: random() * Math.PI * 2,
  };
}

export function sampleDreamEmission(profile: DreamEmissionProfile, elapsed: number, reducedMotion: boolean): DreamEmissionSample {
  const time = reducedMotion ? 0 : Math.max(0, Number.isFinite(elapsed) ? elapsed : 0);
  const primary = Math.sin(time / profile.primaryPeriod * Math.PI * 2 + profile.primaryPhase);
  const secondary = Math.sin(time / profile.secondaryPeriod * Math.PI * 2 + profile.secondaryPhase);
  const coreFactor = 1 + primary * 0.045 + secondary * 0.015;
  const haloFactor = 1 + primary * 0.085 + secondary * 0.025;
  return {
    coreFactor,
    haloFactor,
    haloScale: profile.haloScale + (reducedMotion ? 0 : primary * 0.003 + secondary * 0.001),
  };
}

function haloMaterial(strength: number, falloff: number) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uStrength: { value: strength },
      uFalloff: { value: falloff },
    },
    vertexShader: `
      #include <common>
      #include <fog_pars_vertex>
      attribute vec3 color;
      varying vec3 vViewNormal;
      varying vec3 vViewPosition;
      varying vec3 vNativeColor;
      void main() {
        vViewNormal = normalize(normalMatrix * normal);
        vNativeColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: `
      #include <common>
      #include <fog_pars_fragment>
      uniform float uStrength;
      uniform float uFalloff;
      varying vec3 vViewNormal;
      varying vec3 vViewPosition;
      varying vec3 vNativeColor;
      void main() {
        float rim = 1.0 - abs(dot(normalize(vViewNormal), normalize(vViewPosition)));
        float alpha = uStrength * pow(smoothstep(0.02, 0.98, max(0.0, rim)), uFalloff);
        gl_FragColor = vec4(vNativeColor, alpha);
        #include <fog_fragment>
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.NormalBlending,
    // The aura keeps the subject's own hue instead of being driven toward the
    // scene's white exposure point. Its low alpha provides the restraint.
    toneMapped: false,
    fog: true,
  });
}

/** Combines the structural parts into one unit-local silhouette while retaining
 * each part's native color as a vertex attribute. Two whole-subject shells then
 * cost exactly two halo draw calls, regardless of the unit's part count. */
function mergedStructuralHaloGeometry(group: THREE.Group, structuralMeshes: readonly THREE.Mesh[]) {
  group.updateWorldMatrix(true, true);
  const groupInverse = group.matrixWorld.clone().invert();
  const sources = structuralMeshes.map((mesh) => {
    mesh.updateWorldMatrix(true, false);
    const geometry = mesh.geometry.clone();
    geometry.applyMatrix4(groupInverse.clone().multiply(mesh.matrixWorld));
    const position = geometry.getAttribute("position");
    const nativeColor = (mesh.material as THREE.MeshStandardMaterial).color;
    const colors = new Float32Array(position.count * 3);
    for (let index = 0; index < position.count; index++) {
      colors[index * 3] = nativeColor.r;
      colors[index * 3 + 1] = nativeColor.g;
      colors[index * 3 + 2] = nativeColor.b;
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geometry;
  });
  const merged = mergeGeometries(sources, false);
  sources.forEach((geometry) => geometry.dispose());
  if (!merged) throw new Error("Dream-emission silhouette geometry could not be merged.");
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

/** Adds two tightly nested same-geometry rim shells. The inner edge stays
 * legible while the much fainter outer shell feathers it by only a few pixels;
 * neither shell emits a point light or changes conventional illumination. */
export function attachDreamEmission(group: THREE.Group, profile: DreamEmissionProfile) {
  if (!profile.enabled) return;
  const structuralMeshes: THREE.Mesh[] = [];
  group.traverse((object) => {
    if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial) structuralMeshes.push(object);
  });
  const coreMaterials = [...new Set(structuralMeshes.map((mesh) => mesh.material as THREE.MeshStandardMaterial))];
  coreMaterials.forEach((material) => {
    material.emissive.copy(material.color);
    material.emissiveIntensity = profile.coreStrength;
  });
  if (!structuralMeshes.length) return;
  const haloGeometry = mergedStructuralHaloGeometry(group, structuralMeshes);
  const halos = [
    {
      name: "dream-emission-halo-inner",
      scale: profile.haloScale,
      strength: profile.haloStrength,
      falloff: 1.22,
      renderOrder: 2,
    },
    {
      name: "dream-emission-halo-outer",
      scale: profile.outerHaloScale,
      strength: profile.outerHaloStrength,
      falloff: 2.15,
      renderOrder: 1,
    },
  ].map((layer) => {
    const material = haloMaterial(layer.strength, layer.falloff);
    const mesh = new THREE.Mesh(haloGeometry, material);
    mesh.name = layer.name;
    mesh.scale.setScalar(layer.scale);
    mesh.renderOrder = layer.renderOrder;
    group.add(mesh);
    return {
      mesh,
      material,
      baseScale: layer.scale,
      baseStrength: layer.strength,
    };
  });
  group.userData.dreamEmission = { profile, coreMaterials, halos } satisfies DreamEmissionRuntime;
  group.userData.dreamEmissionHaloMeshes = halos.length;
}

export function updateDreamEmission(targets: readonly THREE.Group[], elapsed: number, reducedMotion: boolean) {
  targets.forEach((target) => {
    const runtime = target.userData.dreamEmission as DreamEmissionRuntime | undefined;
    if (!runtime) return;
    const sample = sampleDreamEmission(runtime.profile, elapsed, reducedMotion);
    runtime.coreMaterials.forEach((material) => {
      material.emissiveIntensity = runtime.profile.coreStrength * sample.coreFactor;
    });
    runtime.halos.forEach(({ mesh, material, baseScale, baseStrength }) => {
      material.uniforms.uStrength.value = baseStrength * sample.haloFactor;
      mesh.scale.setScalar(baseScale + (sample.haloScale - runtime.profile.haloScale));
    });
  });
}
