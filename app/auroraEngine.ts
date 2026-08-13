import * as THREE from "three";
import { type AuroraBandPlan, type AuroraPlan } from "./environmentVisuals";

/**
 * The flow field in this independent aurora engine adapts the progressive
 * domain-warp organization and smooth vector-grid interpolation documented by
 * FastNoise Lite's GLSL implementation (MIT, Jordan Peck and contributors):
 * https://github.com/Auburn/FastNoiseLite/blob/master/GLSL/FastNoiseLite.glsl
 *
 * FOG OF SEA supplies original WebGL-1-compatible hashing, three-dimensional
 * spline-curtain geometry, faceting, colour, fog integration, lifecycle, and
 * reduced-motion behavior. FastNoise Lite is not bundled as a dependency.
 */

export const AURORA_ENGINE_LIMITS = {
  horizontalSegments: 72,
  verticalSegments: 10,
  veilCount: 5,
  maxCurtains: 7,
  maxTriangles: 50_400,
  maxVertices: 151_200,
} as const;

/** Bounded color-energy lift: brighter than the prior muted veil without
 * additive blending, white clipping, or foreground competition. */
export const AURORA_LUMINANCE_ENVELOPE = {
  base: 0.9,
  textureContribution: 0.26,
  darknessContribution: 0.06,
  textureMinimum: 0.28,
  textureMaximum: 1,
  minimum: 0.9728,
  maximum: 1.22,
} as const;

export type AuroraEngineRuntime = {
  root: THREE.Group;
  curtains: THREE.Mesh[];
  plan: AuroraPlan;
  source: "fastnoise-lite-domain-warp-mit-adaptation";
};

function curtainVertexIndex(veil: number, column: number, row: number) {
  const rows = AURORA_ENGINE_LIMITS.verticalSegments + 1;
  const veilVertices = (AURORA_ENGINE_LIMITS.horizontalSegments + 1) * rows;
  return veil * veilVertices + column * rows + row;
}

/** Five unjoined veils follow one winding 3D centerline, never a closed slab. */
export function createAuroraSplineGeometry(band: AuroraBandPlan) {
  const columns = AURORA_ENGINE_LIMITS.horizontalSegments;
  const rows = AURORA_ENGINE_LIMITS.verticalSegments;
  const vertices: number[] = [];
  const uvs: number[] = [];
  const veilIndices: number[] = [];
  const veilOffsets = [-2, -1, 0, 1, 2] as const;

  veilOffsets.forEach((veilOffset, veil) => {
    for (let column = 0; column <= columns; column += 1) {
      const u = column / columns;
      const centered = u - 0.5;
      const pathPhase = u * Math.PI * 2;
      const centerY = Math.sin(pathPhase * 0.74 + band.phase) * band.verticalSpan * 0.12
        + Math.sin(pathPhase * 2.1 + band.phase * 0.43) * band.verticalSpan * 0.055
        + Math.sin(pathPhase * 0.31 + band.phase * 1.17) * band.verticalSpan * 0.08;
      const centerZ = Math.sin(pathPhase * 0.71 + band.phase * 0.9) * band.curvature
        + Math.sin(pathPhase * 2.37 + band.phase * 0.48) * band.rippleDepth
        + Math.cos(pathPhase * 0.27 + band.phase * 1.36) * band.curvature * 0.26;
      const dzdu = Math.cos(pathPhase * 0.71 + band.phase * 0.9) * band.curvature * Math.PI * 2 * 0.71
        + Math.cos(pathPhase * 2.37 + band.phase * 0.48) * band.rippleDepth * Math.PI * 2 * 2.37;
      const tangentLength = Math.hypot(band.width, dzdu) || 1;
      const normalX = -dzdu / tangentLength;
      const normalZ = band.width / tangentLength;
      const planeOffset = veilOffset * band.thickness * 0.84;
      const endEnvelope = Math.pow(Math.max(0, Math.sin(u * Math.PI)), 0.42);
      const localLength = band.verticalSpan
        * (0.12 + endEnvelope * 0.88)
        * (0.82 + Math.sin(pathPhase * 1.63 + band.phase * 1.31 + veil * 0.9) * 0.12);

      for (let row = 0; row <= rows; row += 1) {
        const v = row / rows;
        const verticalEnvelope = Math.sin(v * Math.PI);
        const fold = Math.sin(pathPhase * 3.15 + v * 4.1 + band.phase + veil * 1.7);
        const x = centered * band.width
          + normalX * planeOffset
          + v * band.verticalSkew * 0.26
          + fold * verticalEnvelope * 0.26
          + Math.sin(pathPhase * 0.43 + band.phase * 0.7) * band.lateralBend;
        const y = centerY - v * localLength
          + verticalEnvelope * Math.sin(pathPhase * 4.3 + band.phase * 0.72 + veil) * 0.18;
        const z = centerZ
          + normalZ * planeOffset
          + fold * verticalEnvelope * band.rippleDepth * 0.25
          + v * Math.sin(pathPhase * 1.2 + band.phase) * 0.78;
        vertices.push(x, y, z);
        uvs.push(u, v);
        veilIndices.push(veil);
      }
    }
  });

  const indices: number[] = [];
  for (let veil = 0; veil < veilOffsets.length; veil += 1) {
    for (let column = 0; column < columns; column += 1) {
      for (let row = 0; row < rows; row += 1) {
        const a = curtainVertexIndex(veil, column, row);
        const b = curtainVertexIndex(veil, column, row + 1);
        const c = curtainVertexIndex(veil, column + 1, row);
        const d = curtainVertexIndex(veil, column + 1, row + 1);
        if ((column + row + veil) % 2 === 0) indices.push(a, b, c, b, d, c);
        else indices.push(a, b, d, a, d, c);
      }
    }
  }

  const indexed = new THREE.BufferGeometry();
  indexed.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  indexed.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  indexed.setAttribute("aVeilIndex", new THREE.Float32BufferAttribute(veilIndices, 1));
  indexed.setIndex(indices);
  const geometry = indexed.toNonIndexed();
  indexed.dispose();

  const positions = geometry.getAttribute("position");
  const facetShade = new Float32Array(positions.count);
  for (let triangle = 0; triangle < positions.count / 3; triangle += 1) {
    const shade = 0.76 + ((triangle * 17 + band.layer * 23) % 9) / 8 * 0.2;
    facetShade.fill(shade, triangle * 3, triangle * 3 + 3);
  }
  geometry.name = "fastnoise-domain-warp-spline-veils";
  geometry.setAttribute("aFacetShade", new THREE.BufferAttribute(facetShade, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

const DOMAIN_WARP_GLSL = `
  // WebGL-safe vector grid following FastNoise Lite's BasicGrid domain-warp
  // organization: Hermite-smoothed cell vectors, progressively accumulated.
  vec2 fnlGridVector(vec2 cell, float seed) {
    float angle = fract(sin(dot(cell + seed, vec2(127.1, 311.7))) * 43758.5453123) * 6.28318530718;
    return vec2(cos(angle), sin(angle));
  }
  vec2 fnlBasicGridWarp(vec2 point, float seed) {
    vec2 cell = floor(point);
    vec2 local = fract(point);
    vec2 hermite = local * local * (3.0 - 2.0 * local);
    vec2 x0 = mix(fnlGridVector(cell, seed), fnlGridVector(cell + vec2(1.0, 0.0), seed), hermite.x);
    vec2 x1 = mix(fnlGridVector(cell + vec2(0.0, 1.0), seed), fnlGridVector(cell + vec2(1.0), seed), hermite.x);
    return mix(x0, x1, hermite.y);
  }
  vec2 fnlProgressiveDomainWarp(vec2 point, float seed, float time) {
    vec2 warped = point;
    float frequency = 0.72;
    float amplitude = 0.52;
    for (int octave = 0; octave < 3; octave++) {
      vec2 drift = vec2(time * (0.08 + float(octave) * 0.027), -time * (0.045 + float(octave) * 0.019));
      warped += fnlBasicGridWarp(warped * frequency + drift, seed + float(octave) * 19.19) * amplitude;
      frequency *= 1.91;
      amplitude *= 0.48;
    }
    return warped - point;
  }
`;

function auroraMaterial(band: AuroraBandPlan, plan: AuroraPlan) {
  return new THREE.ShaderMaterial({
    name: "fastnoise-domain-warp-spline-aurora-material",
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uColor: { value: new THREE.Color(band.color) },
        uAccentColor: { value: new THREE.Color(band.accentColor) },
        uLowerEdgeColor: { value: new THREE.Color(band.lowerEdgeColor) },
        uOpacity: { value: band.opacity },
        uTime: { value: 0 },
        uPhase: { value: band.phase },
        uWaveAmplitude: { value: band.waveAmplitude },
        uWaveSpeed: { value: band.waveSpeed },
        uDarkness: { value: plan.darknessMultiplier },
      },
    ]),
    vertexShader: `
      #include <common>
      #include <fog_pars_vertex>
      uniform float uTime;
      uniform float uPhase;
      uniform float uWaveAmplitude;
      uniform float uWaveSpeed;
      attribute float aFacetShade;
      attribute float aVeilIndex;
      varying vec2 vUv;
      varying float vFacetShade;
      varying float vVeilIndex;
      ${DOMAIN_WARP_GLSL}
      void main() {
        vUv = uv;
        vFacetShade = aFacetShade;
        vVeilIndex = aVeilIndex;
        float time = uTime * uWaveSpeed;
        vec2 warp = fnlProgressiveDomainWarp(vec2(uv.x * 4.6, uv.y * 2.35 + aVeilIndex * 0.71), uPhase * 7.31, time);
        float sideEnvelope = pow(max(0.0, sin(uv.x * 3.14159265)), 0.42);
        float hangingEnvelope = sin(uv.y * 3.14159265) * sideEnvelope;
        float longWave = sin(uv.x * 10.7 + time * 3.2 + uPhase + aVeilIndex * 1.13);
        vec3 transformed = position;
        transformed.z += (warp.x * 1.85 + longWave * 0.54) * uWaveAmplitude * hangingEnvelope;
        transformed.x += warp.y * uWaveAmplitude * 0.68 * (0.25 + hangingEnvelope);
        transformed.y += (warp.y * 0.51 + sin(uv.x * 18.0 + time * 2.1 + uPhase) * 0.18)
          * uWaveAmplitude * sideEnvelope;
        vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: `
      #include <common>
      #include <fog_pars_fragment>
      uniform vec3 uColor;
      uniform vec3 uAccentColor;
      uniform vec3 uLowerEdgeColor;
      uniform float uOpacity;
      uniform float uDarkness;
      uniform float uTime;
      uniform float uPhase;
      uniform float uWaveSpeed;
      varying vec2 vUv;
      varying float vFacetShade;
      varying float vVeilIndex;
      ${DOMAIN_WARP_GLSL}
      void main() {
        float time = uTime * uWaveSpeed;
        vec2 warp = fnlProgressiveDomainWarp(vec2(vUv.x * 5.1, vUv.y * 2.8 + vVeilIndex * 0.83), uPhase * 7.31, time);
        float sideFade = smoothstep(0.0, 0.12, vUv.x) * (1.0 - smoothstep(0.88, 1.0, vUv.x));
        float crownFade = smoothstep(0.0, 0.06, vUv.y);
        float tailFade = 1.0 - smoothstep(0.56 + warp.y * 0.12, 1.0, vUv.y);
        float rays = pow(0.5 + 0.5 * sin((vUv.x + warp.x * 0.055) * 108.0 + uPhase * 3.0), 7.0);
        float broadVeil = 0.54 + 0.46 * sin((vUv.x + warp.y * 0.08) * 17.0 + vUv.y * 2.7 + uPhase);
        float luminance = 0.28 + rays * 0.5 + broadVeil * 0.22;
        float centerDistance = abs(vVeilIndex - 2.0) * 0.5;
        float layerWeight = 0.56 + (1.0 - centerDistance) * 0.24;
        // The plan already applies the monotonic time-of-day multiplier to
        // uOpacity. Applying uDarkness again made Dawn and Dusk needlessly
        // faint; one bounded progression is both clearer and more predictable.
        float alpha = uOpacity * sideFade * crownFade * tailFade * luminance * layerWeight;
        if (alpha < 0.0025) discard;
        float accentMix = smoothstep(0.48, 0.98, rays) * 0.3
          + smoothstep(0.2, 0.82, broadVeil) * (0.08 + 0.04 * centerDistance);
        vec3 bodyColor = mix(uColor, uAccentColor, accentMix);
        float lowerEdgeMix = smoothstep(0.34, 0.82, vUv.y)
          * (0.78 + broadVeil * 0.12);
        vec3 verticalColor = mix(bodyColor, uLowerEdgeColor, clamp(lowerEdgeMix, 0.0, 0.9));
        float colorEnergy = ${AURORA_LUMINANCE_ENVELOPE.base.toFixed(2)}
          + luminance * ${AURORA_LUMINANCE_ENVELOPE.textureContribution.toFixed(2)}
          + uDarkness * ${AURORA_LUMINANCE_ENVELOPE.darknessContribution.toFixed(2)};
        vec3 nativeColor = verticalColor * colorEnergy * vFacetShade;
        gl_FragColor = vec4(nativeColor, alpha);
        #include <fog_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    fog: true,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    toneMapped: false,
  });
}

export function createAuroraEngine(scene: THREE.Scene, plan: AuroraPlan): AuroraEngineRuntime {
  const root = new THREE.Group();
  root.name = "fastnoise-domain-warp-aurora-engine";
  const curtains = plan.visible ? plan.bands.slice(0, AURORA_ENGINE_LIMITS.maxCurtains).map((band, index) => {
    const mesh = new THREE.Mesh(createAuroraSplineGeometry(band), auroraMaterial(band, plan));
    mesh.name = `${plan.hemisphere}-snaking-aurora-${index + 1}`;
    mesh.position.set(band.x, band.height, band.depth);
    mesh.rotation.y = band.tilt;
    mesh.rotation.x = band.pitch;
    mesh.rotation.z = band.roll;
    mesh.renderOrder = -14;
    mesh.frustumCulled = false;
    Object.assign(mesh.userData, {
      baseX: band.x, baseY: band.height, baseZ: band.depth,
      baseRotationX: band.pitch, baseRotationY: band.tilt, baseRotationZ: band.roll,
      baseOpacity: band.opacity, phase: band.phase,
      lowerEdgeColor: band.lowerEdgeColor,
      layer: band.layer, hemisphere: plan.hemisphere,
      lateralDrift: band.lateralDrift, verticalDrift: band.verticalDrift,
      depthDrift: band.depthDrift, primaryPeriod: band.primaryPeriod,
      secondaryPeriod: band.secondaryPeriod, veilCount: AURORA_ENGINE_LIMITS.veilCount,
    });
    root.add(mesh);
    return mesh;
  }) : [];
  scene.add(root);
  return { root, curtains, plan, source: "fastnoise-lite-domain-warp-mit-adaptation" };
}

/** Asynchronous route drift and shallow breathing; reduced motion is stable. */
export function updateAuroraEngine(runtime: AuroraEngineRuntime | null, elapsed: number, reducedMotion: boolean) {
  if (!runtime) return;
  const time = reducedMotion ? 0 : Math.max(0, elapsed);
  runtime.curtains.forEach((curtain, index) => {
    const phase = curtain.userData.phase as number;
    const primary = Math.sin(time / curtain.userData.primaryPeriod * Math.PI * 2 + phase);
    const secondary = Math.sin(time / curtain.userData.secondaryPeriod * Math.PI * 2 + phase * 0.61 + index * 0.37);
    const tertiary = Math.sin(time / (curtain.userData.primaryPeriod * 0.53) * Math.PI * 2 + phase * 1.29);
    const organic = primary * 0.48 + secondary * 0.33 + tertiary * 0.19;
    curtain.position.x = curtain.userData.baseX + (reducedMotion ? 0 : organic * curtain.userData.lateralDrift);
    curtain.position.y = curtain.userData.baseY + (reducedMotion ? 0 : (secondary * 0.67 + tertiary * 0.33) * curtain.userData.verticalDrift);
    curtain.position.z = curtain.userData.baseZ + (reducedMotion ? 0 : (primary * 0.48 - secondary * 0.35 + tertiary * 0.17) * curtain.userData.depthDrift);
    curtain.rotation.y = curtain.userData.baseRotationY + (reducedMotion ? 0 : organic * 0.018);
    curtain.rotation.x = curtain.userData.baseRotationX + (reducedMotion ? 0 : (secondary * 0.021 + tertiary * 0.014));
    curtain.rotation.z = curtain.userData.baseRotationZ + (reducedMotion ? 0 : (primary * 0.018 - secondary * 0.012));
    if (curtain.material instanceof THREE.ShaderMaterial) {
      curtain.material.uniforms.uTime.value = time;
      const breath = reducedMotion ? 0.94 : 0.9 + (organic * 0.5 + 0.5) * 0.1;
      curtain.material.uniforms.uOpacity.value = curtain.userData.baseOpacity * breath;
    }
  });
}
