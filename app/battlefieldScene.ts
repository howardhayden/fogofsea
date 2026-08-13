import * as THREE from "three";
import {
  seededRandom,
  stableSeed,
  type CelestialProminence,
  type SubsurfaceLifeProfile,
  type ViewLayer,
} from "./viewModel";
import {
  sampleWaveField,
  type AtmospherePlan,
  type AuroraPlan,
  type CloudMassPlan,
  type CloudRegime,
  type WaveFieldPlan,
} from "./environmentVisuals";
import { createStarfield, type StarfieldPlan, type StarfieldRuntime } from "./starfield";
import { createAuroraEngine, type AuroraEngineRuntime } from "./auroraEngine";
import {
  attachDreamEmission,
  createDreamEmissionProfile,
  dreamEmissionVisibilityLift,
} from "./dreamEmission";
import {
  contactsForView,
  type ContactVisualizationPlan,
  type UnknownContact,
} from "./contactVisualization";
import { wildlifeForView, type VisibleWildlife, type WildlifePlan } from "./wildlife";
import { createWildlifeAvatar } from "./wildlifeAvatar";

export type BattlefieldTheme = "light" | "dark";
export type BattlefieldTime = "dawn" | "day" | "dusk" | "night";
export type BattlefieldClimate = "ocean" | "arctic" | "antarctic";

export const BATTLEFIELD_PALETTES = {
  light: {
    dawn: [0xf5d9cc, 0x9eb7bd, 0x557c85],
    day: [0xdcebed, 0xa9ced2, 0x4f8b91],
    dusk: [0xeacac7, 0x9c9aaa, 0x4b6175],
    night: [0x303b52, 0x637789, 0x273b50],
  },
  dark: {
    dawn: [0x5c5059, 0xa57a70, 0x314c59],
    day: [0x667d83, 0x789da0, 0x365d64],
    dusk: [0x493e52, 0x8c6872, 0x2d4152],
    night: [0x101827, 0x344758, 0x16273a],
  },
} satisfies Record<BattlefieldTheme, Record<BattlefieldTime, readonly [number, number, number]>>;

const SUBMARINE_TYPES = ["air-independent-submarine", "long-endurance-submarine"];
const AVIATION_SHIPS = ["fleet-aviation-ship", "short-deck-aviation-ship", "expeditionary-aviation-dock", "uncrewed-aviation-ship"];
export const ROTORCRAFT = ["rotary-surveillance-aircraft", "maritime-mission-helicopter", "mine-countermeasure-rotorcraft", "shipborne-rescue-rotorcraft", "heavy-utility-rotorcraft", "uncrewed-surveillance-rotorcraft", "uncrewed-logistics-aircraft"];

/** Falling precipitation exists only in views with an atmosphere above the
 * waterline. Subsurface weather still affects the surface aperture and sea. */
export function viewLayerSupportsFallingPrecipitation(viewLayer: ViewLayer) {
  return viewLayer !== "subsurface" && viewLayer !== "stars";
}

export function listedUnits(values: Record<string, number>, eachLimit: number, totalLimit: number) {
  return Object.entries(values)
    .flatMap(([id, count]) => Array.from({ length: Math.min(count, eachLimit) }, () => id))
    .slice(0, totalLimit);
}

function createShip(type: string, color: number) {
  const group = new THREE.Group();
  const submarine = SUBMARINE_TYPES.includes(type);
  const scale = AVIATION_SHIPS.includes(type) ? 1.6 : submarine ? 0.75 : 1;
  const nativeColor = new THREE.Color(submarine ? 0x466b72 : color);
  const raisedColor = nativeColor.clone().lerp(new THREE.Color(0xd2dfdb), submarine ? 0.14 : 0.28);
  const mastColor = nativeColor.clone().multiplyScalar(0.67);
  const hull = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.38 * scale, 2.2 * scale, 4, 8),
    new THREE.MeshStandardMaterial({ color: nativeColor, roughness: 0.72, metalness: 0.18 }),
  );
  hull.rotation.z = Math.PI / 2;
  hull.scale.y = 0.48;
  group.add(hull);

  if (AVIATION_SHIPS.includes(type)) {
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(3.9, 0.12, 1.02),
      new THREE.MeshStandardMaterial({ color: raisedColor, roughness: 0.9 }),
    );
    deck.position.y = 0.3;
    group.add(deck);
    const island = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.56, 0.42), new THREE.MeshStandardMaterial({ color: raisedColor.clone().lerp(new THREE.Color(0xe0e8e4), 0.2) }));
    island.position.set(0.55, 0.6, -0.27);
    group.add(island);
  } else if (submarine) {
    const sail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 0.28), new THREE.MeshStandardMaterial({ color: raisedColor }));
    sail.position.y = 0.33;
    group.add(sail);
  } else {
    const superstructure = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.5, 0.6), new THREE.MeshStandardMaterial({ color: raisedColor, roughness: 0.8 }));
    superstructure.position.set(0.12, 0.46, 0);
    group.add(superstructure);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.95, 5), new THREE.MeshStandardMaterial({ color: mastColor }));
    mast.position.set(-0.1, 1.05, 0);
    group.add(mast);
  }

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.62 * scale, 0.67 * scale, 48),
    new THREE.MeshBasicMaterial({ color: 0x9ccfc6, transparent: true, opacity: 0.72, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = submarine ? -0.24 : 0.05;
  group.add(ring);
  group.userData.ring = ring;
  if (!submarine) {
    const wakeShape = new THREE.Shape();
    wakeShape.moveTo(0.2, 0);
    wakeShape.lineTo(-2.4 * scale, 0.62 * scale);
    wakeShape.lineTo(-1.5 * scale, 0);
    wakeShape.lineTo(-2.4 * scale, -0.62 * scale);
    wakeShape.closePath();
    const wake = new THREE.Mesh(
      new THREE.ShapeGeometry(wakeShape),
      new THREE.MeshBasicMaterial({ color: 0xe7f5ef, transparent: true, opacity: 0.26, depthWrite: false, side: THREE.DoubleSide }),
    );
    wake.rotation.x = -Math.PI / 2;
    wake.position.set(-1.25 * scale, -0.02, 0);
    wake.name = "surface-vessel-wake";
    group.add(wake);
    group.userData.wake = wake;
  }
  return group;
}

function createAircraft(type: string, color: number) {
  const group = new THREE.Group();
  const rotorcraft = ROTORCRAFT.includes(type);
  const uncrewed = type.includes("uncrewed");
  const scale = uncrewed ? 0.78 : 1;
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.58, metalness: 0.12 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.13 * scale, 0.82 * scale, 4, 7), material);
  body.rotation.z = Math.PI / 2;
  group.add(body);

  if (rotorcraft) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.9 * scale, 0.07, 0.08), material);
    tail.position.x = -0.6 * scale;
    group.add(tail);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(1.55 * scale, 0.025, 0.07), new THREE.MeshBasicMaterial({ color: 0x52646a }));
    rotor.position.y = 0.24;
    group.add(rotor);
    group.userData.rotor = rotor;
  } else {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.55 * scale, 0.045, 1.35 * scale), material);
    wing.position.x = -0.04;
    group.add(wing);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.26 * scale, 0.04, 0.58 * scale), material);
    tail.position.x = -0.58 * scale;
    group.add(tail);
  }

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.42 * scale, 0.46 * scale, 32),
    new THREE.MeshBasicMaterial({ color: 0xa9d9cf, transparent: true, opacity: 0.58, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -0.25;
  group.add(ring);
  group.userData.ring = ring;
  return group;
}

function createSeaCreature(scale: number, color: number, variant: number) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.92, flatShading: true, transparent: true, opacity: 0.58 });
  const bodyGeometry = variant % 3 === 0
    ? new THREE.OctahedronGeometry(0.32 * scale, 0)
    : variant % 3 === 1
      ? new THREE.DodecahedronGeometry(0.25 * scale, 0)
      : new THREE.TetrahedronGeometry(0.34 * scale, 0);
  const body = new THREE.Mesh(bodyGeometry, material);
  body.scale.set(1.75, variant % 3 === 1 ? 0.42 : 0.68, variant % 3 === 0 ? 0.48 : 0.72);
  group.add(body);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.23 * scale, 0.48 * scale, 3), material);
  tail.rotation.z = -Math.PI / 2;
  tail.position.x = -0.48 * scale;
  group.add(tail);
  if (variant % 3 === 1) {
    const wing = new THREE.Mesh(new THREE.CircleGeometry(0.42 * scale, 5), material);
    wing.rotation.x = -Math.PI / 2;
    wing.scale.y = 0.45;
    group.add(wing);
  }
  return group;
}

/** @deprecated Use createWildlifeAvatar from wildlifeAvatar.ts directly. */
export function createWildlifeIndividual(plan: VisibleWildlife, theme: BattlefieldTheme) {
  return createWildlifeAvatar(plan, theme);
}

function createUnknownContact(contact: UnknownContact, theme: BattlefieldTheme) {
  const group = new THREE.Group();
  const color = theme === "dark" ? 0xf0a1aa : 0xa94f5b;
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.78, side: THREE.DoubleSide });
  if (contact.domain === "air") {
    const body = new THREE.Mesh(new THREE.TetrahedronGeometry(0.28, 0), material);
    body.rotation.z = Math.PI / 4;
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.025, 1.05), material);
    group.add(body, wing);
  } else if (contact.domain === "surface") {
    const hull = new THREE.Mesh(new THREE.DodecahedronGeometry(0.36, 0), material);
    hull.scale.set(1.65, 0.34, 0.58);
    group.add(hull);
  } else {
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.72, 3, 6), material);
    body.rotation.z = Math.PI / 2;
    body.scale.y = 0.55;
    group.add(body);
  }
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.58, 0.64, 24),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.43, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = contact.domain === "air" ? -0.42 : -0.3;
  group.add(ring);
  const uncertainty = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.62, 3), material);
  uncertainty.position.y = contact.domain === "air" ? 0.76 : 0.62;
  uncertainty.rotation.x = Math.PI;
  group.add(uncertainty);
  group.position.set(contact.x, contact.y, contact.z);
  group.rotation.y = contact.heading;
  group.scale.setScalar(contact.scale);
  return group;
}

function moonMaterial(
  illuminationDirection: THREE.Vector3,
  theme: BattlefieldTheme,
  alwaysOnTop: boolean,
  haloOpacity = 0,
) {
  const halo = haloOpacity > 0;
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uSunDirection: { value: illuminationDirection.clone().normalize() },
      uLightColor: { value: new THREE.Color(theme === "dark" ? 0xe7eef0 : 0xf5f1dc) },
      uOpacity: { value: halo ? haloOpacity : 1 },
      uHalo: { value: halo ? 1 : 0 },
    }]),
    name: halo ? "moon-illuminated-halo-material" : "moon-illuminated-facets-material",
    transparent: halo,
    depthTest: !alwaysOnTop,
    depthWrite: !halo && !alwaysOnTop,
    side: THREE.FrontSide,
    blending: halo ? THREE.AdditiveBlending : THREE.NormalBlending,
    fog: true,
    vertexShader: `
      #include <fog_pars_vertex>
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      void main() {
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: `
      #include <fog_pars_fragment>
      uniform vec3 uSunDirection;
      uniform vec3 uLightColor;
      uniform float uOpacity;
      uniform float uHalo;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      void main() {
        float lightFacing = dot(normalize(vWorldNormal), normalize(uSunDirection));
        // The unilluminated lunar surface is absent, never painted as a dark
        // disk. Non-indexed face normals keep the terminator crystalline.
        if (lightFacing <= 0.0) discard;
        float facetLight = 0.76 + 0.24 * sqrt(lightFacing);
        float alpha = uOpacity;
        if (uHalo > 0.5) {
          vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
          float rim = 1.0 - max(0.0, dot(normalize(vWorldNormal), viewDirection));
          float outerAura = smoothstep(0.16, 0.82, rim);
          float terminatorAura = (1.0 - smoothstep(0.0, 0.18, lightFacing)) * 0.34;
          alpha *= max(outerAura, terminatorAura);
          if (alpha < 0.004) discard;
        }
        gl_FragColor = vec4(uLightColor * facetLight, alpha);
        #include <fog_fragment>
      }
    `,
  });
}

function lowPolyBodyGeometry(radius: number) {
  const source = new THREE.IcosahedronGeometry(radius, 1);
  const geometry = source.index ? source.toNonIndexed() : source;
  if (geometry !== source) source.dispose();
  geometry.computeVertexNormals();
  return geometry;
}

function createCelestialHalo(color: number, prominence: CelestialProminence, alwaysOnTop: boolean) {
  const halo = new THREE.Mesh(
    lowPolyBodyGeometry(prominence.haloRadius),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: prominence.haloOpacity,
      depthTest: !alwaysOnTop,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      fog: false,
    }),
  );
  halo.renderOrder = alwaysOnTop ? 19 : 0;
  return halo;
}

export function createLowPolySun(time: BattlefieldTime, prominence: CelestialProminence, alwaysOnTop: boolean) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    lowPolyBodyGeometry(prominence.bodyRadius),
    new THREE.MeshStandardMaterial({
      color: time === "day" ? 0xffefb8 : 0xffbf9d,
      emissive: time === "day" ? 0xffd979 : 0xff9e80,
      emissiveIntensity: 1.65,
      flatShading: true,
      roughness: 0.82,
      depthTest: !alwaysOnTop,
      depthWrite: !alwaysOnTop,
      fog: false,
    }),
  );
  body.renderOrder = alwaysOnTop ? 20 : 0;
  group.add(createCelestialHalo(time === "day" ? 0xffe3a8 : 0xffadba, prominence, alwaysOnTop), body);
  return group;
}

export function createLowPolyMoon(
  cameraToMoonDirection: THREE.Vector3,
  sunDirection: THREE.Vector3,
  theme: BattlefieldTheme,
  prominence: CelestialProminence,
  alwaysOnTop: boolean,
) {
  const group = new THREE.Group();
  group.name = "moon-illuminated-phase";
  group.userData.phaseRendering = "illuminated-facets-only";
  // Geometry is centered near the observer, so the astronomical geocentric sun
  // direction cannot be used directly as a world-space surface-light vector.
  // Derive the local direction from the moon's sightline and phase separation:
  // full moon faces the observer; new moon faces away. This prevents the old
  // sign error from leaving only an apparent dark silhouette in WebGL.
  const moonSightline = cameraToMoonDirection.clone().normalize();
  const projectedSun = sunDirection.clone().normalize();
  const illuminatedTowardObserver = -Math.max(-1, Math.min(1, moonSightline.dot(projectedSun)));
  const tangent = projectedSun.addScaledVector(moonSightline, -moonSightline.dot(projectedSun));
  if (tangent.lengthSq() > 1e-8) tangent.normalize();
  const tangentStrength = Math.sqrt(Math.max(0, 1 - illuminatedTowardObserver * illuminatedTowardObserver));
  const illuminationDirection = tangent.multiplyScalar(tangentStrength)
    .addScaledVector(moonSightline, -illuminatedTowardObserver)
    .normalize();
  group.userData.illuminationDirection = illuminationDirection.clone();
  group.userData.illuminatedTowardObserver = illuminatedTowardObserver;
  const body = new THREE.Mesh(lowPolyBodyGeometry(prominence.bodyRadius), moonMaterial(illuminationDirection, theme, alwaysOnTop));
  body.name = "moon-illuminated-facets";
  body.renderOrder = alwaysOnTop ? 20 : 0;
  const halo = new THREE.Mesh(
    lowPolyBodyGeometry(prominence.haloRadius),
    moonMaterial(illuminationDirection, theme, alwaysOnTop, prominence.haloOpacity),
  );
  halo.name = "moon-illuminated-halo";
  // Render the aura before cloud/fog volumes so weather still interrupts it.
  halo.renderOrder = alwaysOnTop ? 19 : -18;
  group.add(halo, body);
  return group;
}

/** Broken, faceted surface glint. The object name and accessibility copy in
 * Battlefield explicitly identify this as a reflection rather than a body. */
export function createCelestialWaterReflection(
  body: "sun" | "moon",
  time: BattlefieldTime,
  theme: BattlefieldTheme,
  direction: THREE.Vector3,
  brightness = 1,
) {
  const group = new THREE.Group();
  group.name = `${body}-water-reflection`;
  group.userData.appearance = "water reflection";
  const visibleBrightness = Math.max(0, Math.min(1, Number.isFinite(brightness) ? brightness : 0));
  group.userData.brightness = visibleBrightness;
  if (visibleBrightness < 0.002) return group;
  const horizontal = new THREE.Vector2(direction.x, direction.z);
  if (horizontal.lengthSq() < 0.001) horizontal.set(0, -1);
  horizontal.normalize();
  const color = body === "moon"
    ? (theme === "dark" ? 0xbddcff : 0xe9f2ff)
    : time === "dawn" || time === "dusk"
      ? 0xffb6a3
      : 0xffedaf;
  for (let index = 0; index < 9; index++) {
    const distance = 2.4 + index * 1.45;
    const facet = new THREE.Mesh(
      new THREE.CircleGeometry(0.32 + index * 0.075, 5),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: Math.max(0.012, 0.38 - index * 0.027) * Math.sqrt(visibleBrightness),
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    facet.rotation.x = -Math.PI / 2;
    facet.scale.set(1 + index * 0.2, 0.28 + (index % 3) * 0.08, 1);
    facet.position.set(horizontal.x * distance + Math.sin(index * 2.2) * 0.48, 0.08, horizontal.y * distance);
    facet.renderOrder = 4;
    group.add(facet);
  }
  return group;
}

const SKY_CANOPY_COLORS = {
  light: {
    dawn: [0x71819b, 0xc09faa, 0xf0c7a9],
    day: [0x89b9c2, 0xb9d7d3, 0xe6ddc5],
    dusk: [0x676686, 0xb28a9e, 0xe5b59f],
    night: [0x444d73, 0x626f92, 0x7d919c],
  },
  dark: {
    dawn: [0x34304f, 0x765e73, 0xaa756f],
    day: [0x456f7a, 0x789ea7, 0xa8c4c1],
    dusk: [0x292746, 0x604d6c, 0x9b6975],
    night: [0x222743, 0x373d63, 0x4d6570],
  },
} satisfies Record<BattlefieldTheme, Record<BattlefieldTime, readonly [number, number, number]>>;

function createSkyCanopy(theme: BattlefieldTheme, time: BattlefieldTime) {
  const indexed = new THREE.IcosahedronGeometry(330, 3);
  const geometry = indexed.index ? indexed.toNonIndexed() : indexed;
  if (geometry !== indexed) indexed.dispose();
  const positions = geometry.getAttribute("position");
  const colors = new Float32Array(positions.count * 3);
  const [topHex, middleHex, horizonHex] = SKY_CANOPY_COLORS[theme][time];
  const top = new THREE.Color(topHex);
  const middle = new THREE.Color(middleHex);
  const horizon = new THREE.Color(horizonHex);
  const color = new THREE.Color();
  for (let face = 0; face < positions.count / 3; face++) {
    const faceShade = 0.965 + ((face * 17) % 9) / 240;
    for (let corner = 0; corner < 3; corner++) {
      const index = face * 3 + corner;
      const normalizedY = Math.max(0, Math.min(1, positions.getY(index) / 330 * 0.5 + 0.5));
      if (normalizedY < 0.5) color.copy(horizon).lerp(middle, normalizedY * 2);
      else color.copy(middle).lerp(top, (normalizedY - 0.5) * 2);
      color.multiplyScalar(faceShade);
      colors[index * 3] = color.r;
      colors[index * 3 + 1] = color.g;
      colors[index * 3 + 2] = color.b;
    }
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const canopy = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.BackSide,
      depthTest: false,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    }),
  );
  canopy.name = "faceted-pastel-sky-canopy";
  canopy.renderOrder = -30;
  canopy.frustumCulled = false;
  return canopy;
}

function precipitationMaterial(plan: AtmospherePlan, snow: boolean) {
  const fogUniforms = THREE.UniformsUtils.clone(THREE.UniformsLib.fog);
  return new THREE.ShaderMaterial({
    uniforms: {
      ...fogUniforms,
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(snow ? 0xe7f1ef : 0xb8d0d7) },
      uOpacity: { value: plan.precipitation.opacity },
      uFallSpeed: { value: plan.precipitation.fallSpeed },
      uStreakLength: { value: plan.precipitation.streakLength },
      uParticleSize: { value: plan.precipitation.particleSize },
      uDrift: { value: new THREE.Vector2(plan.precipitation.driftX, plan.precipitation.driftZ) },
      uCloudDrift: { value: new THREE.Vector2(plan.clouds.driftX, plan.clouds.driftZ) },
    },
    vertexShader: snow ? `
      #include <common>
      #include <fog_pars_vertex>
      uniform float uTime;
      uniform float uFallSpeed;
      uniform float uParticleSize;
      uniform vec2 uDrift;
      uniform vec2 uCloudDrift;
      attribute float aVariation;
      attribute float aDepthScale;
      attribute float aCloudBase;
      attribute float aSourceDrift;
      void main() {
        vec3 transformed = position;
        float fallSpan = aCloudBase + 1.0;
        transformed.y = mod(position.y + 1.0 - uTime * uFallSpeed, fallSpan) - 1.0;
        float fallen = aCloudBase - transformed.y;
        transformed.x = mod(position.x + uTime * uCloudDrift.x * aSourceDrift + 42.0, 84.0) - 42.0
          + fallen * uDrift.x / max(1.0, uFallSpeed)
          + sin(uTime * (1.25 + aVariation * 1.35) + aVariation * 9.0) * (0.24 + aVariation * 0.48);
        transformed.z = mod(position.z + uTime * uCloudDrift.y * aSourceDrift + 52.0, 48.0) - 52.0
          + fallen * uDrift.y / max(1.0, uFallSpeed);
        vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = uParticleSize * aDepthScale * (0.68 + aVariation * 0.92)
          * clamp(36.0 / max(4.0, -mvPosition.z), 0.72, 2.8);
        #include <fog_vertex>
      }
    ` : `
      #include <common>
      #include <fog_pars_vertex>
      uniform float uTime;
      uniform float uFallSpeed;
      uniform float uStreakLength;
      uniform vec2 uDrift;
      uniform vec2 uCloudDrift;
      attribute float aEndpoint;
      attribute float aCloudBase;
      attribute float aSourceDrift;
      void main() {
        vec3 transformed = position;
        float fallSpan = aCloudBase + 1.0;
        float travelY = mod(position.y + 1.0 - uTime * uFallSpeed, fallSpan) - 1.0;
        float fallen = aCloudBase - travelY;
        transformed.x = mod(position.x + uTime * uCloudDrift.x * aSourceDrift + 42.0, 84.0) - 42.0
          + fallen * uDrift.x / max(1.0, uFallSpeed);
        transformed.z = mod(position.z + uTime * uCloudDrift.y * aSourceDrift + 52.0, 48.0) - 52.0
          + fallen * uDrift.y / max(1.0, uFallSpeed);
        transformed += aEndpoint * vec3(uDrift.x * 0.055, -uStreakLength, uDrift.y * 0.055);
        transformed.y += travelY - position.y;
        vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: snow ? `
      #include <common>
      #include <fog_pars_fragment>
      uniform vec3 uColor;
      uniform float uOpacity;
      void main() {
        vec2 point = gl_PointCoord * 2.0 - 1.0;
        float diamond = abs(point.x) + abs(point.y);
        if (diamond > 1.0) discard;
        float feather = 1.0 - smoothstep(0.62, 1.0, diamond);
        gl_FragColor = vec4(uColor, uOpacity * (0.68 + feather * 0.32));
        #include <fog_fragment>
      }
    ` : `
      #include <common>
      #include <fog_pars_fragment>
      uniform vec3 uColor;
      uniform float uOpacity;
      void main() {
        gl_FragColor = vec4(uColor, uOpacity);
        #include <fog_fragment>
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    fog: true,
  });
}

function cloudFacetColor(theme: BattlefieldTheme, regime: CloudRegime, time: BattlefieldTime) {
  const timeColor = {
    dawn: theme === "dark" ? 0xf0d2c9 : 0xffe4d8,
    day: theme === "dark" ? 0xdde9e8 : 0xf2f7f3,
    dusk: theme === "dark" ? 0xe2c8d8 : 0xf3dae6,
    night: theme === "dark" ? 0x9db5cf : 0xc8d6e3,
  }[time];
  const color = new THREE.Color(timeColor);
  if (regime === "nimbostratus" || regime === "cumulonimbus") color.multiplyScalar(theme === "dark" ? 0.7 : 0.8);
  else if (regime === "stratus") color.multiplyScalar(theme === "dark" ? 0.82 : 0.9);
  else if (regime === "stratocumulus") color.multiplyScalar(theme === "dark" ? 0.94 : 0.98);
  return color;
}

/** One continuous, faceted meteorological shell. Low-frequency deformation is
 * applied before tessellation is split into flat-colored triangles, avoiding
 * the translucent piles of icospheres that read as bubbles. */
export function createCloudMassGeometry(mass: CloudMassPlan, regime: CloudRegime) {
  const indexed = new THREE.IcosahedronGeometry(1, 2);
  const positions = indexed.getAttribute("position") as THREE.BufferAttribute;
  const seedPhase = (mass.shapeSeed % 104729) / 104729 * Math.PI * 2;
  const layered = regime === "stratus" || regime === "nimbostratus";
  const tower = regime === "cumulonimbus";
  const cellular = regime === "stratocumulus" || regime === "altocumulus";

  for (let vertex = 0; vertex < positions.count; vertex++) {
    const direction = new THREE.Vector3(
      positions.getX(vertex),
      positions.getY(vertex),
      positions.getZ(vertex),
    ).normalize();
    const azimuth = Math.atan2(direction.z, direction.x);
    const elevation = Math.asin(direction.y);
    const broad = Math.sin(azimuth * mass.lobes + seedPhase)
      * Math.cos(elevation * (layered ? 2 : 3) - seedPhase * 0.41);
    const cross = Math.sin(azimuth * (mass.lobes - 2) - elevation * 4 + seedPhase * 1.37);
    const crown = Math.max(0, direction.y);
    const billow = 0.5 + broad * 0.3 + cross * 0.2;
    let radius = 1 + broad * (layered ? 0.08 : 0.15) + cross * (cellular ? 0.085 : 0.055);
    let horizontal = 1;
    if (tower) {
      const anvilOffset = (direction.y - 0.62) / 0.27;
      const anvil = Math.exp(-(anvilOffset ** 2));
      horizontal += crown * 0.16 + anvil * 0.34;
      radius += crown * Math.sin(azimuth * 4 + seedPhase) * 0.08;
    } else if (!layered) {
      radius += crown * Math.sin(azimuth * mass.lobes + seedPhase * 0.73) * 0.055;
    }
    // A calm shallow base and rolling upper relief make this read as one
    // atmospheric cloud body rather than either a sphere pile or a rock.
    const vertical = direction.y < 0
      ? direction.y * (layered ? 0.2 : 0.3) - 0.035
      : direction.y * (layered ? 0.58 + billow * 0.12 : tower ? 0.95 + billow * 0.34 : 0.76 + billow * 0.28)
        + crown * crown * (tower ? 0.3 : layered ? 0.08 : 0.17);
    positions.setXYZ(
      vertex,
      direction.x * radius * horizontal,
      vertical * radius,
      direction.z * radius * (tower ? 1 + crown * 0.08 : 1),
    );
  }
  positions.needsUpdate = true;
  indexed.computeVertexNormals();
  const geometry = indexed.index ? indexed.toNonIndexed() : indexed;
  if (geometry !== indexed) indexed.dispose();
  const expanded = geometry.getAttribute("position") as THREE.BufferAttribute;
  const facetShade = new Float32Array(expanded.count);
  for (let triangle = 0; triangle < expanded.count / 3; triangle++) {
    const sequence = ((triangle * 19 + mass.shapeSeed * 7) % 17) / 16;
    const shade = 0.84 + sequence * 0.22;
    facetShade.fill(shade, triangle * 3, triangle * 3 + 3);
  }
  geometry.setAttribute("aFacetShade", new THREE.BufferAttribute(facetShade, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function createCloudMaterial(mass: CloudMassPlan, regime: CloudRegime, theme: BattlefieldTheme, time: BattlefieldTime) {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uColor: { value: cloudFacetColor(theme, regime, time) },
        uOpacity: { value: mass.opacity },
        uTime: { value: 0 },
        uPhase: { value: mass.phase },
        uBreathAmplitude: { value: mass.breathAmplitude },
        uBreathSpeed: { value: mass.breathSpeed },
        uMorphAmplitude: { value: mass.morphAmplitude },
        uMorphSpeed: { value: mass.morphSpeed },
      },
    ]),
    vertexShader: `
      #include <common>
      #include <fog_pars_vertex>
      uniform float uTime;
      uniform float uPhase;
      uniform float uBreathAmplitude;
      uniform float uBreathSpeed;
      uniform float uMorphAmplitude;
      uniform float uMorphSpeed;
      attribute float aFacetShade;
      varying float vFacetShade;
      varying float vVerticalShade;
      void main() {
        float breathA = sin(uTime * uBreathSpeed + uPhase);
        float breathB = sin(uTime * uBreathSpeed * 0.61 + uPhase * 1.73);
        float morphA = sin(uTime * uMorphSpeed + position.x * 2.1 + position.z * 1.7 + uPhase);
        float morphB = sin(uTime * uMorphSpeed * 0.67 - position.x * 1.3 + position.y * 2.6 + uPhase * 0.47);
        vec3 transformed = position;
        vec3 radial = normalize(position + vec3(0.0001));
        transformed += radial * uMorphAmplitude * (morphA * 0.68 + morphB * 0.32);
        transformed.xz *= 1.0 + uBreathAmplitude * (breathA * 0.72 + breathB * 0.28);
        transformed.y *= 1.0 + uBreathAmplitude * (breathB * 0.74 - breathA * 0.22);
        vFacetShade = aFacetShade;
        vVerticalShade = clamp(position.y * 0.16 + 0.91, 0.72, 1.1);
        vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: `
      #include <common>
      #include <fog_pars_fragment>
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vFacetShade;
      varying float vVerticalShade;
      void main() {
        gl_FragColor = vec4(uColor * vFacetShade * vVerticalShade, uOpacity);
        #include <fog_fragment>
      }
    `,
    transparent: true,
    depthTest: true,
    // Atmospheric bodies must interrupt stars and aurora instead of behaving
    // like decorative overlays. A cohesive shell can safely own its depth.
    depthWrite: true,
    side: THREE.FrontSide,
    blending: THREE.NormalBlending,
    fog: true,
    toneMapped: false,
  });
}

function createAtmosphereRuntime(
  scene: THREE.Scene,
  plan: AtmospherePlan,
  theme: BattlefieldTheme,
  time: BattlefieldTime,
  viewLayer: ViewLayer,
): AtmosphereRuntime {
  const fogBanks: THREE.Mesh[] = [];
  const cloudMasses: THREE.Mesh[] = [];
  const rainCurtains: THREE.Mesh[] = [];
  if (viewLayer === "subsurface") {
    return { fogBanks, cloudLayer: null, cloudMasses, precipitation: null, rainCurtains, stormLight: null };
  }
  const random = seededRandom(stableSeed(plan.seed, "atmosphere-geometry"));

  const fogGeometry = new THREE.IcosahedronGeometry(1, 1);
  plan.fog.banks.forEach((bank, index) => {
    const material = new THREE.MeshBasicMaterial({
      color: theme === "dark" ? 0x728693 : 0xd5dedb,
      transparent: true,
      opacity: bank.opacity,
      depthTest: true,
      depthWrite: false,
      fog: true,
    });
    const mesh = new THREE.Mesh(fogGeometry, material);
    mesh.name = `drifting-fog-bank-${index + 1}`;
    mesh.position.set(bank.x, bank.y, bank.z);
    mesh.scale.set(bank.scaleX, bank.scaleY, bank.scaleZ);
    mesh.renderOrder = -8;
    mesh.userData.baseX = bank.x;
    mesh.userData.baseY = bank.y;
    mesh.userData.baseZ = bank.z;
    mesh.userData.phase = bank.phase;
    scene.add(mesh);
    fogBanks.push(mesh);
  });

  let cloudLayer: THREE.Group | null = null;
  if (plan.clouds.masses.length > 0) {
    const layer = new THREE.Group();
    cloudLayer = layer;
    layer.name = `${plan.clouds.regime}-cloud-layer`;
    layer.frustumCulled = false;
    plan.clouds.masses.forEach((mass, index) => {
      const mesh = new THREE.Mesh(
        createCloudMassGeometry(mass, plan.clouds.regime),
        createCloudMaterial(mass, plan.clouds.regime, theme, time),
      );
      mesh.name = `${plan.clouds.regime}-cohesive-cloud-${index + 1}`;
      mesh.position.set(mass.x, mass.y, mass.z);
      mesh.rotation.set(mass.pitch, mass.yaw, (random() - 0.5) * 0.035);
      mesh.scale.set(mass.scaleX, mass.scaleY, mass.scaleZ);
      mesh.renderOrder = -12;
      mesh.frustumCulled = false;
      mesh.userData.baseX = mass.x;
      mesh.userData.baseY = mass.y;
      mesh.userData.baseZ = mass.z;
      mesh.userData.baseYaw = mass.yaw;
      mesh.userData.basePitch = mass.pitch;
      mesh.userData.phase = mass.phase;
      mesh.userData.driftScale = mass.driftScale;
      layer.add(mesh);
      cloudMasses.push(mesh);
    });
    scene.add(layer);
  }

  let precipitation: AtmosphereRuntime["precipitation"] = null;
  const particleCount = viewLayerSupportsFallingPrecipitation(viewLayer)
    ? plan.precipitation.particleCount
    : 0;
  if (particleCount > 0) {
    const snow = plan.precipitation.kind === "snow";
    const geometry = new THREE.BufferGeometry();
    const material = precipitationMaterial(plan, snow);
    if (snow) {
      const positions = new Float32Array(particleCount * 3);
      const variations = new Float32Array(particleCount);
      const cloudBases = new Float32Array(particleCount);
      const sourceDrifts = new Float32Array(particleCount);
      const depthScales = new Float32Array(particleCount);
      for (let index = 0; index < particleCount; index++) {
        const cell = plan.precipitation.cells[index % plan.precipitation.cells.length];
        positions[index * 3] = cell.x + (random() - 0.5) * cell.spreadX * 2;
        positions[index * 3 + 1] = random() * (cell.cloudBaseY + 1) - 1;
        positions[index * 3 + 2] = cell.z + (random() - 0.5) * cell.spreadZ * 2;
        variations[index] = random();
        // A bounded near/mid/far mix makes the snowfall read as volume. Most
        // flakes stay modest; a small foreground share becomes unmistakably
        // large without turning the whole view into opaque confetti.
        const depthDraw = random();
        depthScales[index] = depthDraw < 0.12
          ? 1.45 + random() * 0.8
          : depthDraw < 0.5
            ? 0.92 + random() * 0.48
            : 0.58 + random() * 0.38;
        cloudBases[index] = cell.cloudBaseY;
        sourceDrifts[index] = cell.driftScale;
      }
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("aVariation", new THREE.BufferAttribute(variations, 1));
      geometry.setAttribute("aDepthScale", new THREE.BufferAttribute(depthScales, 1));
      geometry.setAttribute("aCloudBase", new THREE.BufferAttribute(cloudBases, 1));
      geometry.setAttribute("aSourceDrift", new THREE.BufferAttribute(sourceDrifts, 1));
      precipitation = { object: new THREE.Points(geometry, material), material };
    } else {
      const positions = new Float32Array(particleCount * 2 * 3);
      const endpoints = new Float32Array(particleCount * 2);
      const cloudBases = new Float32Array(particleCount * 2);
      const sourceDrifts = new Float32Array(particleCount * 2);
      for (let index = 0; index < particleCount; index++) {
        const cell = plan.precipitation.cells[index % plan.precipitation.cells.length];
        const x = cell.x + (random() - 0.5) * cell.spreadX * 2;
        const y = random() * (cell.cloudBaseY + 1) - 1;
        const z = cell.z + (random() - 0.5) * cell.spreadZ * 2;
        positions.set([x, y, z, x, y, z], index * 6);
        endpoints[index * 2 + 1] = 1;
        cloudBases[index * 2] = cell.cloudBaseY;
        cloudBases[index * 2 + 1] = cell.cloudBaseY;
        sourceDrifts[index * 2] = cell.driftScale;
        sourceDrifts[index * 2 + 1] = cell.driftScale;
      }
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("aEndpoint", new THREE.BufferAttribute(endpoints, 1));
      geometry.setAttribute("aCloudBase", new THREE.BufferAttribute(cloudBases, 1));
      geometry.setAttribute("aSourceDrift", new THREE.BufferAttribute(sourceDrifts, 1));
      precipitation = { object: new THREE.LineSegments(geometry, material), material };
    }
    precipitation.object.name = `${plan.precipitation.presentation}-${plan.precipitation.kind}`;
    precipitation.object.renderOrder = 2;
    scene.add(precipitation.object);
  }

  const rainCurtainCount = viewLayerSupportsFallingPrecipitation(viewLayer)
    ? plan.precipitation.curtainCount
    : 0;
  for (let index = 0; index < rainCurtainCount; index++) {
    const cell = plan.precipitation.cells[index % plan.precipitation.cells.length];
    const curtain = new THREE.Mesh(
      new THREE.PlaneGeometry(cell.spreadX * (1.9 + plan.precipitation.tier * 0.08), cell.cloudBaseY + 1),
      new THREE.MeshBasicMaterial({
        color: theme === "dark" ? 0x76909e : 0xa7bec6,
        transparent: true,
        opacity: 0.035 + plan.precipitation.tier * 0.027,
        depthTest: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: true,
      }),
    );
    curtain.name = `rain-curtain-${index + 1}`;
    curtain.position.set(cell.x, (cell.cloudBaseY - 1) / 2, cell.z);
    curtain.rotation.y = Math.atan2(plan.precipitation.driftX, -plan.precipitation.driftZ || 1);
    curtain.renderOrder = -5;
    curtain.userData.baseX = curtain.position.x;
    curtain.userData.baseZ = curtain.position.z;
    curtain.userData.cloudIndex = cell.cloudIndex;
    scene.add(curtain);
    rainCurtains.push(curtain);
  }

  let stormLight: THREE.Mesh | null = null;
  if (plan.stormLight.visible) {
    stormLight = new THREE.Mesh(
      new THREE.IcosahedronGeometry(5.5, 1),
      new THREE.MeshBasicMaterial({
        color: plan.stormLight.color,
        transparent: true,
        opacity: plan.stormLight.baseOpacity,
        depthTest: true,
        depthWrite: false,
        side: THREE.BackSide,
        blending: THREE.NormalBlending,
        fog: true,
      }),
    );
    stormLight.name = "localized-cloud-interior-storm-light";
    stormLight.position.set(12, 10.5, -18);
    stormLight.scale.set(1.8, 0.72, 1.3);
    stormLight.renderOrder = -7;
    scene.add(stormLight);
  }

  return { fogBanks, cloudLayer, cloudMasses, precipitation, rainCurtains, stormLight };
}

function wrappedOffset(value: number, minimum: number, span: number) {
  return ((value - minimum) % span + span) % span + minimum;
}

export function updateAtmosphere(runtime: AtmosphereRuntime, plan: AtmospherePlan, elapsed: number, reducedMotion: boolean) {
  const time = reducedMotion ? 0 : Math.max(0, elapsed);
  runtime.fogBanks.forEach((bank) => {
    bank.position.x = wrappedOffset(bank.userData.baseX + plan.fog.driftX * time, -30, 60);
    bank.position.z = wrappedOffset(bank.userData.baseZ + plan.fog.driftZ * time, -30, 60);
    bank.position.y = bank.userData.baseY + (reducedMotion ? 0 : Math.sin(time * 0.055 + bank.userData.phase) * 0.06);
  });
  runtime.cloudMasses.forEach((cloud, index) => {
    const phase = cloud.userData.phase as number;
    const driftScale = cloud.userData.driftScale as number;
    const primary = Math.sin(time * plan.clouds.speed * 0.54 + phase);
    const secondary = Math.sin(time * plan.clouds.speed * 0.31 + phase * 1.47 + index * 0.29);
    cloud.position.x = reducedMotion
      ? cloud.userData.baseX
      : wrappedOffset(cloud.userData.baseX + plan.clouds.driftX * time * driftScale, -42, 84);
    cloud.position.z = reducedMotion
      ? cloud.userData.baseZ
      : wrappedOffset(cloud.userData.baseZ + plan.clouds.driftZ * time * driftScale, -52, 48);
    cloud.position.y = cloud.userData.baseY + (reducedMotion ? 0 : (primary * 0.68 + secondary * 0.32) * 0.16);
    cloud.rotation.y = cloud.userData.baseYaw + (reducedMotion ? 0 : primary * 0.018);
    cloud.rotation.x = cloud.userData.basePitch + (reducedMotion ? 0 : secondary * 0.009);
    if (cloud.material instanceof THREE.ShaderMaterial) cloud.material.uniforms.uTime.value = time;
  });
  if (runtime.precipitation) runtime.precipitation.material.uniforms.uTime.value = time;
  runtime.rainCurtains.forEach((curtain, index) => {
    const sourceCloud = runtime.cloudMasses[curtain.userData.cloudIndex];
    curtain.position.x = sourceCloud
      ? sourceCloud.position.x + plan.precipitation.driftX * 0.16
      : wrappedOffset(curtain.userData.baseX + plan.precipitation.driftX * time * 0.16, -24, 48);
    curtain.position.z = sourceCloud
      ? sourceCloud.position.z + plan.precipitation.driftZ * 0.16
      : wrappedOffset(curtain.userData.baseZ + plan.precipitation.driftZ * time * 0.16, -28, 48);
    if (curtain.material instanceof THREE.MeshBasicMaterial) {
      curtain.material.opacity = 0.035 + plan.precipitation.tier * 0.027
        + (reducedMotion ? 0 : Math.sin(time * 0.17 + index) * 0.008);
    }
  });
  if (runtime.stormLight?.material instanceof THREE.MeshBasicMaterial) {
    const primary = Math.sin(time / plan.stormLight.minCycleSeconds * Math.PI * 2 + plan.stormLight.phase);
    const secondary = Math.sin(time / (plan.stormLight.minCycleSeconds * 1.73) * Math.PI * 2 + plan.stormLight.phase * 0.61);
    const swell = reducedMotion ? 0 : Math.max(0, Math.min(1, 0.5 + primary * 0.36 + secondary * 0.14));
    const eased = swell * swell * (3 - 2 * swell);
    runtime.stormLight.material.opacity = plan.stormLight.baseOpacity
      + (plan.stormLight.peakOpacity - plan.stormLight.baseOpacity) * eased;
  }
}

type SceneContentsInput = {
  scene: THREE.Scene;
  colors: readonly [number, number, number];
  theme: BattlefieldTheme;
  viewLayer: ViewLayer;
  starfieldPlan: StarfieldPlan;
  contactPlan: ContactVisualizationPlan;
  wavePlan: WaveFieldPlan;
  auroraPlan: AuroraPlan;
  atmospherePlan: AtmospherePlan;
  time: BattlefieldTime;
  climate: BattlefieldClimate;
  region: string;
  exerciseId: number;
  lifeProfile: SubsurfaceLifeProfile;
  wildlifePlan: WildlifePlan;
  displayedFleet: Record<string, number>;
  displayedAirWing: Record<string, number>;
  result: boolean | null;
};

export type AtmosphereRuntime = {
  fogBanks: THREE.Mesh[];
  cloudLayer: THREE.Group | null;
  cloudMasses: THREE.Mesh[];
  precipitation: { object: THREE.LineSegments | THREE.Points; material: THREE.ShaderMaterial } | null;
  rainCurtains: THREE.Mesh[];
  stormLight: THREE.Mesh | null;
};

export type SceneContents = {
  skyCanopy: THREE.Mesh | null;
  water: THREE.Mesh;
  waterGeometry: THREE.PlaneGeometry;
  wavePlan: WaveFieldPlan;
  foamMesh: THREE.InstancedMesh | null;
  auroraEngine: AuroraEngineRuntime | null;
  underseaSilt: THREE.Points | null;
  seaCreatures: THREE.Group[];
  wildlife: THREE.Group[];
  ships: THREE.Group[];
  aircraft: THREE.Group[];
  atmosphere: AtmosphereRuntime;
  starfield: StarfieldRuntime | null;
};

/** The navigation model still exposes its exact heading/range telemetry, but
 * no Cartesian helper lines are painted over the organic sea or seabed. */
export const TACTICAL_GRID_PRESENTATION = {
  surfaceVisible: false,
  depthVisible: false,
  opacity: 0,
} as const;

export function buildSceneContents(input: SceneContentsInput): SceneContents {
  const {
    scene,
    colors,
    theme,
    viewLayer,
    starfieldPlan,
    contactPlan,
    wavePlan,
    auroraPlan,
    atmospherePlan,
    time,
    climate,
    region,
    exerciseId,
    lifeProfile,
    wildlifePlan,
    displayedFleet,
    displayedAirWing,
    result,
  } = input;

  const skyCanopy = viewLayer === "subsurface" ? null : createSkyCanopy(theme, time);
  if (skyCanopy) scene.add(skyCanopy);
  const starfield = starfieldPlan.stars.length || starfieldPlan.nebulae.length ? createStarfield(scene, starfieldPlan) : null;

  const waterGeometry = new THREE.PlaneGeometry(85, 85, wavePlan.gridSegments, wavePlan.gridSegments);
  const positions = waterGeometry.attributes.position as THREE.BufferAttribute;
  positions.setUsage(THREE.DynamicDrawUsage);
  const waterBaseColor = new THREE.Color(colors[2]);
  const waterColors = new Float32Array(positions.count * 3);
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const height = sampleWaveField(wavePlan, x, y, 0);
    const ratio = Math.max(-1, Math.min(1, height / Math.max(0.08, wavePlan.peakToTrough * 0.5)));
    const crest = Math.max(0, ratio) * 0.48;
    const trough = 1 + Math.min(0, ratio) * 0.25;
    positions.setZ(index, height);
    waterColors[index * 3] = (waterBaseColor.r + (1 - waterBaseColor.r) * crest) * trough;
    waterColors[index * 3 + 1] = (waterBaseColor.g + (1 - waterBaseColor.g) * crest) * trough;
    waterColors[index * 3 + 2] = (waterBaseColor.b + (1 - waterBaseColor.b) * crest) * trough;
  }
  waterGeometry.setAttribute("color", new THREE.BufferAttribute(waterColors, 3).setUsage(THREE.DynamicDrawUsage));
  waterGeometry.computeVertexNormals();
  const waterMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.46, metalness: 0.05, transparent: true, vertexColors: true, flatShading: true,
    opacity: viewLayer === "subsurface" ? 0.38 : viewLayer === "air" || viewLayer === "sky" ? 0.82 : 0.96,
    depthWrite: viewLayer !== "subsurface",
    side: THREE.DoubleSide,
  });
  const water = new THREE.Mesh(waterGeometry, waterMaterial);
  water.name = "low-poly-water";
  // The distant canopy uses a negative transparent render order. Drawing the
  // faceted surface afterward lets animated wave geometry soften or cover it.
  water.renderOrder = 0;
  water.rotation.x = -Math.PI / 2;
  water.receiveShadow = true;
  water.visible = viewLayer !== "stars";
  scene.add(water);

  let foamMesh: THREE.InstancedMesh | null = null;
  if (wavePlan.foamPatches.length && viewLayer !== "subsurface" && viewLayer !== "stars") {
    const foamGeometry = new THREE.RingGeometry(0.4, 0.72, 7, 1, 0, Math.PI * 1.38);
    const foamMaterial = new THREE.MeshBasicMaterial({
      color: theme === "dark" ? 0xd8eee9 : 0xf3fbf7,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    foamMesh = new THREE.InstancedMesh(foamGeometry, foamMaterial, wavePlan.foamPatches.length);
    foamMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    foamMesh.name = "low-poly-whitecaps";
    foamMesh.frustumCulled = false;
    foamMesh.renderOrder = 3;
    scene.add(foamMesh);
  }

  let auroraEngine: AuroraEngineRuntime | null = null;
  if (auroraPlan.visible && viewLayer !== "stars" && viewLayer !== "subsurface") {
    auroraEngine = createAuroraEngine(scene, auroraPlan);
  }

  if (atmospherePlan.stormLight.visible && viewLayer !== "subsurface" && viewLayer !== "stars") {
    const lightningBody = new THREE.TetrahedronGeometry(0.55, 0);
    const lightningEdges = new THREE.EdgesGeometry(lightningBody);
    lightningBody.dispose();
    const bolt = new THREE.LineSegments(
      lightningEdges,
      new THREE.LineBasicMaterial({ color: theme === "dark" ? 0xc9bfd8 : 0x807794, transparent: true, opacity: 0.72 }),
    );
    bolt.scale.set(0.45, 5.6, 0.45);
    bolt.position.set(12, 9, -18);
    bolt.rotation.z = 0.18;
    scene.add(bolt);
  }

  let underseaSilt: THREE.Points | null = null;
  const seaCreatures: THREE.Group[] = [];
  if (viewLayer === "subsurface") {
    const faunaRandom = seededRandom(stableSeed(exerciseId, region, climate, "fauna"));
    const siltRandom = seededRandom(stableSeed(exerciseId, region, climate, "silt"));
    const rockRandom = seededRandom(stableSeed(exerciseId, region, climate, "rocks"));
    if (lifeProfile.seabedY !== null) {
      const seabed = new THREE.Mesh(
        new THREE.PlaneGeometry(90, 90, 16, 16),
        new THREE.MeshStandardMaterial({ color: theme === "dark" ? 0x142b32 : 0x41666a, roughness: 0.98, metalness: 0 }),
      );
      seabed.rotation.x = -Math.PI / 2;
      seabed.position.y = lifeProfile.seabedY;
      seabed.receiveShadow = true;
      scene.add(seabed);
    }

    const siltCount = 520;
    const silt = new Float32Array(siltCount * 3);
    for (let index = 0; index < siltCount; index++) {
      silt[index * 3] = (siltRandom() - 0.5) * 42;
      silt[index * 3 + 1] = -6 + siltRandom() * 5.4;
      silt[index * 3 + 2] = (siltRandom() - 0.5) * 42;
    }
    const siltGeometry = new THREE.BufferGeometry();
    siltGeometry.setAttribute("position", new THREE.BufferAttribute(silt, 3));
    underseaSilt = new THREE.Points(
      siltGeometry,
      new THREE.PointsMaterial({ color: theme === "dark" ? 0x86afb0 : 0xb8d1cb, size: 0.035, transparent: true, opacity: 0.38 }),
    );
    scene.add(underseaSilt);

    const rockMaterial = new THREE.MeshStandardMaterial({ color: theme === "dark" ? 0x233b40 : 0x587678, roughness: 1, flatShading: true });
    for (let index = 0; index < (lifeProfile.seabedY === null ? 5 : 18); index++) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35 + rockRandom() * 0.48, 0), rockMaterial);
      const angle = (index / 18) * Math.PI * 2;
      const radius = 5 + (index % 6) * 2.1;
      rock.position.set(Math.cos(angle) * radius, lifeProfile.seabedY === null ? -9 - rockRandom() * 3 : lifeProfile.seabedY + 0.25, Math.sin(angle) * radius);
      rock.scale.y = 0.38 + rockRandom() * 0.2;
      scene.add(rock);
    }

    const lifeColor = climate === "ocean"
      ? (theme === "dark" ? 0x7da8aa : 0xb7d0c8)
      : (theme === "dark" ? 0x91aebc : 0xc5d8d8);
    const totalForms = lifeProfile.solitaryCount + lifeProfile.schoolCount;
    for (let index = 0; index < totalForms; index++) {
      const inSchool = index >= lifeProfile.solitaryCount;
      const scale = inSchool ? 0.22 + faunaRandom() * 0.13 : 0.55 + faunaRandom() * 0.8;
      const creature = createSeaCreature(scale, lifeColor, index);
      const schoolIndex = Math.max(0, index - lifeProfile.solitaryCount);
      const baseX = inSchool ? -4 + (schoolIndex % 7) * 0.72 + faunaRandom() * 0.3 : (faunaRandom() - 0.5) * 22;
      const baseY = inSchool ? -2.3 - Math.floor(schoolIndex / 7) * 0.38 : -1.4 - faunaRandom() * 4.1;
      const baseZ = inSchool ? -3 + Math.floor(schoolIndex / 7) * 0.9 + faunaRandom() * 0.4 : (faunaRandom() - 0.5) * 20;
      creature.position.set(baseX, baseY, baseZ);
      creature.rotation.y = faunaRandom() * Math.PI * 2;
      creature.userData.baseX = baseX;
      creature.userData.baseY = baseY;
      creature.userData.baseZ = baseZ;
      creature.userData.phase = faunaRandom() * Math.PI * 2;
      creature.userData.speed = (inSchool ? 0.18 : 0.07) + faunaRandom() * 0.12;
      creature.userData.radius = inSchool ? 1.4 : 2.4 + faunaRandom() * 2.2;
      scene.add(creature);
      seaCreatures.push(creature);
    }
  }

  if (climate !== "ocean" && viewLayer !== "subsurface" && viewLayer !== "stars") {
    const iceRandom = seededRandom(stableSeed(exerciseId, region, climate, "ice"));
    const iceMaterial = new THREE.MeshStandardMaterial({ color: theme === "dark" ? 0xb7ced0 : 0xebf5f1, roughness: 0.88, transparent: true, opacity: 0.88 });
    for (let index = 0; index < 15; index++) {
      const ice = new THREE.Mesh(new THREE.CylinderGeometry(0.8 + iceRandom() * 1.7, 1 + iceRandom() * 1.8, 0.16, 7), iceMaterial);
      const angle = (index / 15) * Math.PI * 2;
      const radius = 9 + (index % 4) * 2.2;
      ice.position.set(Math.cos(angle) * radius, 0.02, Math.sin(angle) * radius);
      ice.rotation.y = iceRandom() * Math.PI;
      scene.add(ice);
    }
  }

  const wildlife = wildlifeForView(wildlifePlan, viewLayer).map((member, index) => {
    const animal = createWildlifeAvatar(member, theme);
    if (member.medium === "ice") {
      const floeIndex = index % 15;
      const floeAngle = floeIndex / 15 * Math.PI * 2;
      const floeRadius = 9 + (floeIndex % 4) * 2.2;
      animal.userData.baseX = Math.cos(floeAngle) * floeRadius;
      animal.userData.baseY = 0.24;
      animal.userData.baseZ = Math.sin(floeAngle) * floeRadius;
      // Ice animals travel only inside their assigned floe footprint. A
      // resting penguin occupies a route waypoint rather than drifting over
      // water; commuting penguins and seals use a small closed floe route.
      animal.userData.routeRadius = member.restingPose ? 0 : Math.min(member.radius, 0.34 + (floeIndex % 4) * 0.08);
      animal.userData.routeEccentricity = 0.46;
      animal.position.set(animal.userData.baseX, animal.userData.baseY, animal.userData.baseZ);
    }
    scene.add(animal);
    return animal;
  });

  // Retain the scene helpers as non-painting reference objects so internal
  // coordinate behavior and diagnostics remain available without overlaying
  // a visible graph-paper grid on the water or the submarine layer.
  const surfaceGrid = new THREE.GridHelper(64, 32, 0xffffff, 0xffffff);
  surfaceGrid.name = "non-painting-surface-grid-reference";
  surfaceGrid.position.y = 0.06;
  surfaceGrid.visible = TACTICAL_GRID_PRESENTATION.surfaceVisible;
  (surfaceGrid.material as THREE.LineBasicMaterial).transparent = true;
  (surfaceGrid.material as THREE.LineBasicMaterial).opacity = TACTICAL_GRID_PRESENTATION.opacity;
  (surfaceGrid.material as THREE.LineBasicMaterial).colorWrite = false;
  (surfaceGrid.material as THREE.LineBasicMaterial).depthWrite = false;
  scene.add(surfaceGrid);
  const depthGrid = new THREE.GridHelper(58, 29, 0xffffff, 0xffffff);
  depthGrid.name = "non-painting-depth-grid-reference";
  depthGrid.position.y = -6.18;
  depthGrid.visible = TACTICAL_GRID_PRESENTATION.depthVisible;
  (depthGrid.material as THREE.LineBasicMaterial).transparent = true;
  (depthGrid.material as THREE.LineBasicMaterial).opacity = TACTICAL_GRID_PRESENTATION.opacity;
  (depthGrid.material as THREE.LineBasicMaterial).colorWrite = false;
  (depthGrid.material as THREE.LineBasicMaterial).depthWrite = false;
  scene.add(depthGrid);

  const formations: [number, number][] = [[0, 0], [-5, 3.2], [4.7, 3.7], [-4.8, -3.8], [5.2, -3.1], [0.2, 6], [0, -7.3], [8.5, 0.5], [-8.5, -0.5], [7.8, 6], [-7.5, -6]];
  const dreamVisibilityLift = dreamEmissionVisibilityLift(
    atmospherePlan.fog.horizonDensity,
    atmospherePlan.precipitation.tier,
  );
  const ships: THREE.Group[] = [];
  listedUnits(displayedFleet, 8, 22).forEach((type, index) => {
    if (viewLayer === "stars") return;
    const submarine = SUBMARINE_TYPES.includes(type);
    if (viewLayer === "subsurface" && !submarine) return;
    const ship = createShip(type, result === true ? 0x78b9aa : 0x83aaa3);
    attachDreamEmission(
      ship,
      createDreamEmissionProfile(stableSeed(exerciseId, type, index), time, submarine ? "submarine" : "ship", dreamVisibilityLift),
    );
    const position = formations[index % formations.length];
    const baseY = submarine ? -4.25 - (index % 2) * 0.42 : 0.16;
    ship.position.set(position[0], baseY, position[1]);
    ship.rotation.y = -0.18 + (index % 3) * 0.08;
    ship.userData.baseY = baseY;
    scene.add(ship);
    ships.push(ship);
  });

  const aircraft: THREE.Group[] = [];
  if (viewLayer !== "subsurface" && viewLayer !== "stars") listedUnits(displayedAirWing, 5, 20).forEach((type, index) => {
    const craft = createAircraft(type, result === true ? 0x83c2b6 : 0x91b6af);
    attachDreamEmission(
      craft,
      createDreamEmissionProfile(stableSeed(exerciseId, type, index), time, "aircraft", dreamVisibilityLift),
    );
    const row = Math.floor(index / 7);
    const baseY = 4.8 + row * 1.55 + (index % 3) * 0.22;
    craft.position.set(-9 + (index % 7) * 3, baseY, -4.5 + row * 5.4 + ((index * 3) % 4));
    craft.rotation.y = -0.22 + (index % 4) * 0.13;
    craft.userData.baseY = baseY;
    craft.userData.baseX = craft.position.x;
    scene.add(craft);
    aircraft.push(craft);
  });

  contactsForView(contactPlan, viewLayer).forEach((contact) => scene.add(createUnknownContact(contact, theme)));
  const atmosphere = createAtmosphereRuntime(scene, atmospherePlan, theme, time, viewLayer);

  return {
    skyCanopy,
    water,
    waterGeometry,
    wavePlan,
    foamMesh,
    auroraEngine,
    underseaSilt,
    seaCreatures,
    wildlife,
    ships,
    aircraft,
    atmosphere,
    starfield,
  };
}
