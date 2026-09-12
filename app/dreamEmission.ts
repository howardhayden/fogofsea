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
  cores: Array<{ material: THREE.MeshBasicMaterial; baseOpacity: number }>;
  halos: Array<{
    mesh: THREE.Mesh;
    material: THREE.ShaderMaterial;
    baseScale: number;
    baseStrength: number;
  }>;
};

export const DREAM_EMISSION_LIMITS = {
  emittersPerSubject: 1,
  haloMeshesPerEmitter: 2,
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
      varying vec3 vViewPosition;
      void main() {
        vViewNormal = normalize(normalMatrix * normal);
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
      uniform vec3 uColor;
      varying vec3 vViewNormal;
      varying vec3 vViewPosition;
      void main() {
        float rim = 1.0 - abs(dot(normalize(vViewNormal), normalize(vViewPosition)));
        float alpha = uStrength * pow(smoothstep(0.02, 0.98, max(0.0, rim)), uFalloff);
        gl_FragColor = vec4(uColor, alpha);
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

const EMITTERS: Readonly<Record<DreamEmissionKind, readonly { position: readonly [number, number, number]; color: number }[]>> = {
  ship: [
    { position: [0.12, 0.92, -0.18], color: 0xd8f5ed },
  ],
  aircraft: [
    { position: [-0.12, 0.08, 0], color: 0xc6f5e9 },
  ],
  // Submerged craft do not acquire fantasy bioluminescence merely because
  // Dream emission is enabled for other operational subjects.
  submarine: [],
};

/** Adds sparse, causal sources instead of making the structural model glow. */
export function attachDreamEmission(group: THREE.Group, profile: DreamEmissionProfile) {
  if (!profile.enabled) return;
  const cores: DreamEmissionRuntime["cores"] = [];
  const halos: DreamEmissionRuntime["halos"] = [];
  EMITTERS[profile.kind].slice(0, DREAM_EMISSION_LIMITS.emittersPerSubject).forEach((specification, emitterIndex) => {
    const color = new THREE.Color(specification.color);
    const emitter = new THREE.Group();
    emitter.name = `dream-emission-source-${emitterIndex}`;
    emitter.position.fromArray(specification.position);
    const coreMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: profile.coreStrength, depthTest: true, depthWrite: false, toneMapped: false, fog: true });
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(profile.kind === "aircraft" ? 0.035 : 0.045, 0), coreMaterial);
    core.name = "dream-emission-core";
    emitter.add(core);
    cores.push({ material: coreMaterial, baseOpacity: profile.coreStrength });
    [
      { name: "dream-emission-halo-inner", radius: profile.kind === "aircraft" ? 0.13 : 0.16, scale: profile.haloScale, strength: profile.haloStrength * 0.48, falloff: 1.35, renderOrder: 2 },
      { name: "dream-emission-halo-outer", radius: profile.kind === "aircraft" ? 0.34 : 0.42, scale: profile.outerHaloScale, strength: profile.outerHaloStrength * 0.42, falloff: 2.4, renderOrder: 1 },
    ].forEach((layer) => {
      const material = haloMaterial(color, layer.strength, layer.falloff);
      const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(layer.radius, 1), material);
      mesh.name = layer.name;
      mesh.scale.setScalar(layer.scale);
      mesh.renderOrder = layer.renderOrder;
      emitter.add(mesh);
      halos.push({ mesh, material, baseScale: layer.scale, baseStrength: layer.strength });
    });
    group.add(emitter);
  });
  if (!cores.length) return;
  group.userData.dreamEmission = { profile, cores, halos } satisfies DreamEmissionRuntime;
  group.userData.dreamEmissionHaloMeshes = halos.length;
}

export function updateDreamEmission(targets: readonly THREE.Group[], elapsed: number, reducedMotion: boolean) {
  targets.forEach((target) => {
    const runtime = target.userData.dreamEmission as DreamEmissionRuntime | undefined;
    if (!runtime) return;
    const sample = sampleDreamEmission(runtime.profile, elapsed, reducedMotion);
    runtime.cores.forEach(({ material, baseOpacity }) => {
      material.opacity = baseOpacity * sample.coreFactor;
    });
    runtime.halos.forEach(({ mesh, material, baseScale, baseStrength }) => {
      material.uniforms.uStrength.value = baseStrength * sample.haloFactor;
      mesh.scale.setScalar(baseScale + (sample.haloScale - runtime.profile.haloScale));
    });
  });
}
