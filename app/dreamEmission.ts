import * as THREE from "three";
import { seededRandom, stableSeed } from "./viewModel";

export type DreamEmissionTime = "dawn" | "day" | "dusk" | "night";
export type DreamEmissionKind = "ship" | "aircraft" | "submarine";

export type DreamEmissionProfile = {
  kind: DreamEmissionKind;
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
  halos: Array<{
    mesh: THREE.Mesh;
    material: THREE.ShaderMaterial;
    baseScale: number;
    baseStrength: number;
  }>;
};

export const DREAM_EMISSION_LIMITS = {
  haloMeshesPerSubject: 3,
  maxSubjects: 42,
  maxHaloMeshes: 126,
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
    kind,
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

function haloMaterial(color: THREE.Color, strength: number, falloff: number) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uStrength: { value: strength },
      uFalloff: { value: falloff },
      uColor: { value: color.clone() },
    },
    vertexShader: `
      #include <common>
      #include <fog_pars_vertex>
      varying vec3 vViewNormal;
      void main() {
        vViewNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: `
      #include <common>
      #include <fog_pars_fragment>
      uniform float uStrength;
      uniform float uFalloff;
      uniform vec3 uColor;
      varying vec3 vViewNormal;
      void main() {
        float facing = abs(vViewNormal.z);
        float alpha = uStrength * pow(smoothstep(0.0, 1.0, facing), uFalloff);
        gl_FragColor = vec4(uColor, alpha);
        #include <fog_fragment>
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: THREE.FrontSide,
    blending: THREE.AdditiveBlending,
    // The aura keeps the subject's own hue instead of being driven toward the
    // scene's white exposure point. Its low alpha provides the restraint.
    toneMapped: false,
    fog: true,
  });
}

const AURA_COLOR: Readonly<Record<DreamEmissionKind, number>> = {
  ship: 0x79dbc8,
  aircraft: 0xa0e9dd,
  submarine: 0x648fa8,
};

const AURA_SHAPE: Readonly<Record<DreamEmissionKind, readonly [number, number, number]>> = {
  ship: [2.6, 1.35, 1.25],
  aircraft: [1.45, 0.78, 1.45],
  submarine: [1.8, 0.86, 0.9],
};

/** A three-scale world-space aura surrounds the authorized subject without
 * turning its hard geometry emissive. Depth and fog continue to occlude it. */
export function attachDreamEmission(group: THREE.Group, profile: DreamEmissionProfile) {
  if (!profile.enabled) return;
  const halos: DreamEmissionRuntime["halos"] = [];
  const color = new THREE.Color(AURA_COLOR[profile.kind]);
  const shape = AURA_SHAPE[profile.kind];
  [
    { name: "dream-emission-aura-tight", radius: 0.72, scale: 1, strength: profile.coreStrength * 0.72, falloff: 0.72, renderOrder: -3 },
    { name: "dream-emission-aura-broad", radius: 1.18, scale: 1.34, strength: profile.haloStrength * 0.28, falloff: 1.4, renderOrder: -4 },
    { name: "dream-emission-aura-atmospheric", radius: 1.72, scale: 1.72, strength: profile.outerHaloStrength * 0.48, falloff: 2.25, renderOrder: -5 },
  ].forEach((layer) => {
    const material = haloMaterial(color, layer.strength, layer.falloff);
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(layer.radius, 2), material);
    mesh.name = layer.name;
    mesh.scale.set(shape[0] * layer.scale, shape[1] * layer.scale, shape[2] * layer.scale);
    mesh.position.y = profile.kind === "ship" ? 0.34 : 0;
    mesh.renderOrder = layer.renderOrder;
    group.add(mesh);
    halos.push({ mesh, material, baseScale: layer.scale, baseStrength: layer.strength });
  });
  group.userData.dreamEmission = { profile, halos } satisfies DreamEmissionRuntime;
  group.userData.dreamEmissionHaloMeshes = halos.length;
}

export function updateDreamEmission(targets: readonly THREE.Group[], elapsed: number, reducedMotion: boolean) {
  targets.forEach((target) => {
    const runtime = target.userData.dreamEmission as DreamEmissionRuntime | undefined;
    if (!runtime) return;
    const sample = sampleDreamEmission(runtime.profile, elapsed, reducedMotion);
    runtime.halos.forEach(({ mesh, material, baseScale, baseStrength }) => {
      material.uniforms.uStrength.value = baseStrength * sample.haloFactor;
      const shape = AURA_SHAPE[runtime.profile.kind];
      const animatedScale = baseScale + (sample.haloScale - runtime.profile.haloScale);
      mesh.scale.set(shape[0] * animatedScale, shape[1] * animatedScale, shape[2] * animatedScale);
    });
  });
}
