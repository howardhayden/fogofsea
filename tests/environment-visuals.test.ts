import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { createCloudMassGeometry, updateAtmosphere, viewLayerSupportsFallingPrecipitation } from "../app/battlefieldScene";
import {
  AURORA_ENGINE_LIMITS,
  AURORA_LUMINANCE_ENVELOPE,
  createAuroraEngine,
  updateAuroraEngine,
} from "../app/auroraEngine";
import {
  AURORA_DARKNESS,
  AURORA_OPACITY_ENVELOPE,
  createAuroraPlan,
  createAtmospherePlan,
  createSubsurfaceOpticsPlan,
  createWaveFieldPlan,
  ENVIRONMENT_LIMITS,
  fogDensityAtView,
  refractSkyDirection,
  sampleWaveField,
  sampleWaveSlope,
} from "../app/environmentVisuals";
import { cloudCoverLabel, cloudCoverPhrase } from "../app/weatherPresentation";
import { stableSeed, VIEW_CONFIG } from "../app/viewModel";

test("weather presentation never exposes the internal broken-cloud token", () => {
  assert.equal(cloudCoverLabel("clear"), "clear");
  assert.equal(cloudCoverLabel("scattered"), "partly cloudy");
  assert.equal(cloudCoverLabel("broken"), "mostly cloudy");
  assert.equal(cloudCoverLabel("overcast"), "overcast");
  assert.equal(cloudCoverPhrase("broken"), "mostly cloudy skies");
  assert.doesNotMatch(["clear", "scattered", "broken", "overcast"].map(cloudCoverPhrase).join(" "), /broken/i);
});

const atmosphereBase = {
  seed: 72,
  climate: "ocean" as const,
  time: "dusk" as const,
  clouds: "broken" as const,
  precipitation: "rain" as const,
  seaState: 1,
  visibility: 8,
  storming: false,
  lightningCapable: false,
  windHeading: 72,
  windSpeed: 8,
};

test("falling rain and snow never enter the stars or subsurface layers", () => {
  assert.equal(viewLayerSupportsFallingPrecipitation("sky"), true);
  assert.equal(viewLayerSupportsFallingPrecipitation("air"), true);
  assert.equal(viewLayerSupportsFallingPrecipitation("surface"), true);
  assert.equal(viewLayerSupportsFallingPrecipitation("subsurface"), false);
  assert.equal(viewLayerSupportsFallingPrecipitation("stars"), false);
});

test("reduced motion resolves precipitation to one static shader pose without removing the weather", () => {
  const plan = createAtmospherePlan({
    ...atmosphereBase,
    climate: "antarctic",
    precipitation: "snow",
    storming: true,
    clouds: "overcast",
    seaState: 7,
    visibility: 2,
    windSpeed: 46,
  });
  assert.equal(plan.precipitation.particleCount, ENVIRONMENT_LIMITS.maxSnowflakes);
  assert.ok(plan.precipitation.opacity > 0);
  // Runtime animation sends zero elapsed time under reduced motion, keeping a
  // dense static depth-tested field instead of deleting important weather.
  assert.match(updateAtmosphere.toString(), /reducedMotion\s*\?\s*0/);
});

test("subsurface celestial light shares one weather-and-surface aperture", () => {
  const clear = createSubsurfaceOpticsPlan({
    body: "moon",
    bodyAboveHorizon: true,
    bodyAltitude: 38,
    moonIllumination: 0.88,
    time: "night",
    clouds: "clear",
    precipitation: "none",
    visibility: 14,
    seaState: 1,
  });
  const closed = createSubsurfaceOpticsPlan({
    body: "sun",
    bodyAboveHorizon: true,
    bodyAltitude: 31,
    moonIllumination: 0,
    time: "day",
    clouds: "overcast",
    precipitation: "rain",
    visibility: 2,
    seaState: 8,
  });
  const belowHorizon = createSubsurfaceOpticsPlan({
    body: "sun",
    bodyAboveHorizon: false,
    bodyAltitude: -9,
    moonIllumination: 0,
    time: "dusk",
    clouds: "clear",
    precipitation: "none",
    visibility: 14,
    seaState: 1,
  });

  assert.equal(clear.surfaceApertureOpen, true);
  assert.equal(clear.activeBodyVisible, true);
  assert.equal(clear.appearance, "direct through the surface");
  assert.match(clear.description, /not a reflection/);
  assert.equal(closed.surfaceApertureOpen, false);
  assert.equal(closed.activeBodyVisible, false);
  assert.equal(closed.starThreshold, 1);
  assert.equal(belowHorizon.activeBodyVisible, false);
});

test("Snell-window transformation admits only above-horizon directions", () => {
  assert.equal(refractSkyDirection({ x: 0.2, y: -0.1, z: -0.9 }), null);
  const refracted = refractSkyDirection({ x: 0.72, y: 0.12, z: -0.68 });
  assert.ok(refracted);
  assert.ok(refracted.y >= Math.cos(48.7 * Math.PI / 180));
  assert.ok(Math.abs(Math.hypot(refracted.x, refracted.y, refracted.z) - 1) < 0.0001);
});

test("aurora requires a dark, open, latitude-and-season-appropriate sky", () => {
  const eligibleInput = {
    climate: "arctic" as const,
    latitude: 72,
    season: "winter",
    time: "night" as const,
    clouds: "clear" as const,
    precipitation: "none" as const,
    storming: false,
  };
  const visible = Array.from({ length: 128 }, (_, seed) => createAuroraPlan({ ...eligibleInput, seed })).find((plan) => plan.visible);
  assert.ok(visible, "a suitable polar night must make aurora possible under at least one bounded space-weather seed");
  assert.ok(visible.bands.length >= 5);
  assert.ok(visible.bands.length <= ENVIRONMENT_LIMITS.maxAuroraBands);
  assert.equal(visible.hemisphere, "northern");
  assert.equal(visible.darknessMultiplier, AURORA_DARKNESS.night);
  assert.match(visible.description, /non-flashing/);
  assert.match(visible.description, /long, tapered, low-poly curtain paths/);
  assert.match(visible.description, /MIT-licensed FastNoise Lite progressive domain-warp/);
  assert.match(visible.description, /five unjoined translucent veils/);
  assert.deepEqual(visible.bands.map((band) => band.layer), visible.bands.map((_, index) => index));
  assert.ok(new Set(visible.bands.map((band) => band.color)).size >= 5);
  assert.ok(new Set(visible.bands.map((band) => band.accentColor)).size >= 5);
  assert.ok(new Set(visible.bands.map((band) => band.lowerEdgeColor)).size >= 5);
  assert.ok(visible.bands.every((band) => band.lowerEdgeColor !== band.color));
  assert.match(visible.description, /distinct complementary color along its lower edge/);
  assert.equal(new Set(visible.bands.map((band) => band.phase.toFixed(6))).size, visible.bands.length);
  assert.ok(visible.bands.every((band) => band.curvature > 0 && band.rippleDepth >= 2.3 && band.thickness >= 0.95 && band.lateralBend >= 3.8));
  assert.ok(visible.bands.every((band) => band.width >= 67 && band.width <= 111 && band.verticalSpan >= 5));
  assert.ok(visible.bands.every((band) => band.width / band.verticalSpan >= 8));
  assert.ok(visible.bands.every((band) => Math.abs(band.pitch) >= 0.03 && Math.abs(band.roll) >= 0.015));
  assert.ok(visible.bands.every((band) => band.waveAmplitude >= 1.9 && band.waveSpeed >= 0.15));
  assert.ok(Math.max(...visible.bands.map((band) => band.height)) - Math.min(...visible.bands.map((band) => band.height)) > 5);
  assert.ok(Math.max(...visible.bands.map((band) => band.depth)) - Math.min(...visible.bands.map((band) => band.depth)) > 10);
  assert.ok(new Set(visible.bands.map((band) => band.primaryPeriod.toFixed(4))).size === visible.bands.length);
  assert.ok(new Set(visible.bands.map((band) => band.secondaryPeriod.toFixed(4))).size === visible.bands.length);
  // Long paths deliberately overlap, but anchors span several screen sectors,
  // yaw families, and meaningful depth so they do not become one stitched line.
  assert.ok(Math.max(...visible.bands.map((band) => band.x)) - Math.min(...visible.bands.map((band) => band.x)) > 25);
  assert.ok(visible.bands.some((band, index) => visible.bands.some((other, otherIndex) => (
    index !== otherIndex
    && Math.max(band.x - band.width / 2, other.x - other.width / 2)
      < Math.min(band.x + band.width / 2, other.x + other.width / 2)
  ))));

  const southern = Array.from({ length: 128 }, (_, seed) => createAuroraPlan({
    ...eligibleInput,
    seed,
    climate: "antarctic",
    latitude: -72,
  })).find((plan) => plan.visible);
  assert.ok(southern);
  assert.equal(southern.hemisphere, "southern");
  assert.ok(southern.bands.every((band) => band.curvature < 0));

  const daylight = createAuroraPlan({ ...eligibleInput, seed: 1, time: "day" });
  const storm = createAuroraPlan({ ...eligibleInput, seed: 1, storming: true });
  const lowLatitude = createAuroraPlan({ ...eligibleInput, seed: 1, climate: "ocean", latitude: 18 });
  assert.equal(daylight.visible, false);
  assert.equal(daylight.darknessMultiplier, 0);
  assert.equal(daylight.bands.length, 0);
  assert.equal(storm.visible, false);
  assert.equal(lowLatitude.visible, false);
});

test("aurora event luminance increases monotonically with darkness and remains zero by day", () => {
  const base = {
    seed: 0,
    climate: "arctic" as const,
    latitude: 72,
    season: "winter",
    clouds: "clear" as const,
    precipitation: "none" as const,
    storming: false,
  };
  const plans = (["day", "dawn", "dusk", "night"] as const).map((time) => createAuroraPlan({ ...base, time }));
  assert.deepEqual(plans.map((plan) => plan.darknessMultiplier), [0, 0.4, 0.66, 1]);
  assert.equal(plans[0].visible, false);
  assert.equal(plans[0].bands.length, 0);
  assert.ok(plans.slice(1).every((plan) => plan.visible));
  assert.ok(plans[1].intensity < plans[2].intensity && plans[2].intensity < plans[3].intensity);
  const opacityBounds = (darkness: number) => ({
    minimum: (
      AURORA_OPACITY_ENVELOPE.base
      + AURORA_OPACITY_ENVELOPE.minimumEventStrength * AURORA_OPACITY_ENVELOPE.eventStrength
    ) * darkness,
    maximum: (
      AURORA_OPACITY_ENVELOPE.base
      + AURORA_OPACITY_ENVELOPE.maximumEventStrength * AURORA_OPACITY_ENVELOPE.eventStrength
      + AURORA_OPACITY_ENVELOPE.variation
    ) * darkness,
  });
  plans.slice(1).forEach((plan) => {
    const bounds = opacityBounds(plan.darknessMultiplier);
    assert.ok(plan.bands.every((band) => band.opacity >= bounds.minimum - 0.001));
    assert.ok(plan.bands.every((band) => band.opacity <= bounds.maximum + 0.001));
  });
  assert.ok(Math.min(...plans[3].bands.map((band) => band.opacity)) >= 0.385,
    "night curtains retain a materially bright non-additive alpha floor");
  for (let index = 1; index < plans.length - 1; index++) {
    assert.ok(Math.max(...plans[index].bands.map((band) => band.opacity))
      < Math.min(...plans[index + 1].bands.map((band) => band.opacity)));
  }
});

test("independent aurora engine builds bounded domain-warped five-veil spline curtains", () => {
  const eligibleInput = {
    climate: "arctic" as const,
    latitude: 72,
    season: "winter",
    time: "night" as const,
    clouds: "clear" as const,
    precipitation: "none" as const,
    storming: false,
  };
  const plan = Array.from({ length: 128 }, (_, seed) => createAuroraPlan({ ...eligibleInput, seed })).find((candidate) => candidate.visible);
  assert.ok(plan);

  let totalVertices = 0;
  let totalTriangles = 0;

  const scene = new THREE.Scene();
  const runtime = createAuroraEngine(scene, plan);
  assert.equal(runtime.source, "fastnoise-lite-domain-warp-mit-adaptation");
  assert.equal(runtime.root.name, "fastnoise-domain-warp-aurora-engine");
  assert.equal(runtime.curtains.length, plan.bands.length);
  plan.bands.forEach((band, index) => {
    const curtain = runtime.curtains[index];
    const positions = curtain.geometry.getAttribute("position") as THREE.BufferAttribute;
    const material = curtain.material as THREE.ShaderMaterial;
    const bounds = curtain.geometry.boundingBox;
    assert.ok(bounds);
    assert.equal(curtain.geometry.index, null);
    assert.equal(curtain.geometry.name, "fastnoise-domain-warp-spline-veils");
    assert.ok(bounds.max.z - bounds.min.z > band.curvature * 1.25, "winding centerlines and veil offsets must create genuine depth");
    assert.ok(bounds.max.y - bounds.min.y > 3.2, "the curtain must span meaningful elevation without becoming a tall slab");
    assert.ok((bounds.max.x - bounds.min.x) / (bounds.max.y - bounds.min.y) > 6, "every path must stay long rather than card-shaped");
    assert.ok(new Set(Array.from({ length: positions.count }, (_, vertex) => positions.getZ(vertex).toFixed(4))).size > AURORA_ENGINE_LIMITS.horizontalSegments);
    assert.ok(curtain.geometry.getAttribute("normal"));
    const facetShade = curtain.geometry.getAttribute("aFacetShade") as THREE.BufferAttribute;
    const veilIndex = curtain.geometry.getAttribute("aVeilIndex") as THREE.BufferAttribute;
    assert.equal(facetShade.count, positions.count);
    assert.equal(veilIndex.count, positions.count);
    assert.deepEqual(new Set(Array.from({ length: veilIndex.count }, (_, vertex) => veilIndex.getX(vertex))), new Set([0, 1, 2, 3, 4]));
    assert.equal(curtain.userData.veilCount, AURORA_ENGINE_LIMITS.veilCount);
    assert.ok(new Set(Array.from({ length: facetShade.count }, (_, vertex) => facetShade.getX(vertex).toFixed(3))).size >= 8);
    for (let triangle = 0; triangle < positions.count / 3; triangle++) {
      assert.equal(facetShade.getX(triangle * 3), facetShade.getX(triangle * 3 + 1));
      assert.equal(facetShade.getX(triangle * 3), facetShade.getX(triangle * 3 + 2));
    }
    assert.equal(material.depthTest, true);
    assert.equal(material.depthWrite, false);
    assert.equal(material.fog, true);
    assert.equal(material.blending, THREE.NormalBlending);
    assert.match(material.vertexShader, /aFacetShade/);
    assert.match(material.vertexShader, /uWaveAmplitude/);
    assert.match(material.vertexShader, /fnlBasicGridWarp/);
    assert.match(material.vertexShader, /fnlProgressiveDomainWarp/);
    assert.match(material.vertexShader, /for \(int octave = 0; octave < 3/);
    assert.doesNotMatch(material.vertexShader, /valueNoise|float fbm/);
    assert.match(material.fragmentShader, /tailFade/);
    assert.match(material.fragmentShader, /float rays/);
    assert.match(material.fragmentShader, /uDarkness/);
    assert.match(material.fragmentShader, /uLowerEdgeColor/);
    assert.match(material.fragmentShader, /lowerEdgeMix = smoothstep\(0\.34, 0\.82, vUv\.y\)/);
    assert.match(material.fragmentShader, /verticalColor = mix\(bodyColor, uLowerEdgeColor/);
    assert.ok(material.uniforms.uLowerEdgeColor.value instanceof THREE.Color);
    assert.equal(material.uniforms.uLowerEdgeColor.value.getHex(), band.lowerEdgeColor);
    assert.notEqual(band.lowerEdgeColor, band.color);
    const bodyColor = new THREE.Color(band.color);
    const lowerColor = new THREE.Color(band.lowerEdgeColor);
    assert.ok(Math.hypot(
      bodyColor.r - lowerColor.r,
      bodyColor.g - lowerColor.g,
      bodyColor.b - lowerColor.b,
    ) >= 0.18,
      "the lower edge must be visibly chromatic rather than a near-identical tint");
    assert.equal(curtain.userData.lowerEdgeColor, band.lowerEdgeColor);
    assert.deepEqual(AURORA_LUMINANCE_ENVELOPE, {
      base: 0.9,
      textureContribution: 0.26,
      darknessContribution: 0.06,
      textureMinimum: 0.28,
      textureMaximum: 1,
      minimum: 0.9728,
      maximum: 1.22,
    });
    assert.ok(material.uniforms.fogColor);
    assert.ok(material.uniforms.fogDensity);
    assert.ok(curtain.renderOrder < 0);
    assert.equal(curtain.position.z, band.depth);
    assert.equal(curtain.userData.layer, band.layer);
    assert.equal(curtain.userData.hemisphere, plan.hemisphere);
    totalVertices += positions.count;
    totalTriangles += positions.count / 3;
    curtain.geometry.dispose();
    material.dispose();
  });

  assert.ok(totalVertices <= AURORA_ENGINE_LIMITS.maxVertices);
  assert.ok(totalTriangles <= AURORA_ENGINE_LIMITS.maxTriangles);
});

test("aurora curtain canopies remain legible from sky and surface projections", () => {
  const eligibleInput = {
    seed: stableSeed(2, "Southern Ice Margin · fictional sector", "2030-10-21"),
    climate: "antarctic" as const,
    latitude: -67,
    season: "spring",
    time: "night" as const,
    clouds: "clear" as const,
    precipitation: "none" as const,
    storming: false,
  };
  const plan = createAuroraPlan(eligibleInput);
  assert.equal(plan.visible, true);

  const projectedBounds = (camera: THREE.PerspectiveCamera, curtain: THREE.Mesh) => {
    curtain.updateMatrixWorld();
    const positions = curtain.geometry.getAttribute("position") as THREE.BufferAttribute;
    const point = new THREE.Vector3();
    let visible = 0;
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (let vertex = 0; vertex < positions.count; vertex++) {
      point.fromBufferAttribute(positions, vertex).applyMatrix4(curtain.matrixWorld).project(camera);
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
      if (Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1 && point.z >= -1 && point.z <= 1) visible += 1;
    }
    return { minX, maxX, minY, maxY, visibleRatio: visible / positions.count };
  };
  const cameraFor = (aspect: number, position: readonly [number, number, number], target: readonly [number, number, number]) => {
    const camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 360);
    camera.position.fromArray(position);
    camera.lookAt(new THREE.Vector3(...target));
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
    return camera;
  };
  const desktopSkyCamera = cameraFor(1024 / 441, VIEW_CONFIG.sky.camera, VIEW_CONFIG.sky.target);
  const mobileSkyCamera = cameraFor(567 / 604, VIEW_CONFIG.sky.camera, VIEW_CONFIG.sky.target);
  const surfaceCamera = cameraFor(1024 / 441, VIEW_CONFIG.surface.camera, VIEW_CONFIG.surface.target);
  const runtime = createAuroraEngine(new THREE.Scene(), plan);
  const curtains = runtime.curtains;
  const desktopSky = curtains.map((curtain) => projectedBounds(desktopSkyCamera, curtain));
  const mobileSky = curtains.map((curtain) => projectedBounds(mobileSkyCamera, curtain));
  const surface = curtains.map((curtain) => projectedBounds(surfaceCamera, curtain));
  assert.ok(desktopSky.filter(({ visibleRatio }) => visibleRatio >= 0.45).length >= 4);
  assert.ok(mobileSky.filter(({ visibleRatio }) => visibleRatio >= 0.3).length >= 4);
  for (const bounds of desktopSky) {
    assert.ok(bounds.maxX - bounds.minX >= 0.85, "each aurora must read as a long sky-crossing path");
    assert.ok(bounds.maxY - bounds.minY >= 0.18, "each aurora must retain a flowing vertical span");
  }
  assert.ok(Math.min(...desktopSky.map((bounds) => bounds.minX)) < -0.5);
  assert.ok(Math.max(...desktopSky.map((bounds) => bounds.maxX)) > 0.5);
  assert.ok(Math.min(...desktopSky.map((bounds) => bounds.minY)) < -0.15);
  assert.ok(Math.max(...desktopSky.map((bounds) => bounds.maxY)) > 0.65);
  assert.ok(plan.bands.filter((band) => band.depth > -40).length >= 2, "at least two aurorae must occupy a near atmospheric plane");
  assert.ok(plan.bands.filter((band) => band.depth < -45).length >= 2, "at least two aurorae must recede into distant sky planes");
  assert.ok(Math.max(...plan.bands.map((band) => band.width)) > 90, "the event must include a sky-spanning path rather than only isolated ribbons");
  assert.ok(surface.filter((bounds) => bounds.visibleRatio >= 0.15).length >= 2, "multiple low independent arcs must enter the surface-view sky");
  curtains.forEach((curtain) => {
    curtain.geometry.dispose();
    (curtain.material as THREE.Material).dispose();
  });
});

test("aurora curtains wave, drift, and breathe slowly, then freeze at one reduced-motion pose", () => {
  const eligibleInput = {
    climate: "arctic" as const,
    latitude: 72,
    season: "winter",
    time: "night" as const,
    clouds: "clear" as const,
    precipitation: "none" as const,
    storming: false,
  };
  const plan = Array.from({ length: 128 }, (_, seed) => createAuroraPlan({ ...eligibleInput, seed })).find((candidate) => candidate.visible);
  assert.ok(plan);
  const runtime = createAuroraEngine(new THREE.Scene(), plan);
  const curtains = runtime.curtains;
  const rest = curtains.map((curtain) => curtain.position.clone());

  updateAuroraEngine(runtime, 19, false);
  assert.ok(curtains.some((curtain, index) => curtain.position.distanceTo(rest[index]) > 0.8));
  assert.ok(Math.max(...curtains.map((curtain, index) => curtain.position.distanceTo(rest[index]))) > 1.4);
  assert.ok(curtains.every((curtain) => curtain.material instanceof THREE.ShaderMaterial && curtain.material.uniforms.uTime.value === 19));
  assert.ok(curtains.every((curtain) => {
    const material = curtain.material as THREE.ShaderMaterial;
    const ratio = material.uniforms.uOpacity.value / curtain.userData.baseOpacity;
    return ratio >= 0.89 && ratio <= 1;
  }));

  updateAuroraEngine(runtime, 999, true);
  curtains.forEach((curtain, index) => {
    assert.equal(curtain.position.x, rest[index].x);
    assert.equal(curtain.position.y, rest[index].y);
    assert.equal(curtain.position.z, rest[index].z);
    assert.equal((curtain.material as THREE.ShaderMaterial).uniforms.uTime.value, 0);
    curtain.geometry.dispose();
    (curtain.material as THREE.ShaderMaterial).dispose();
  });
});

test("wave spectrum is bounded, seeded, directionally coherent, and responsive to sea state", () => {
  const calmInput = {
    seed: 91,
    seaState: 1,
    storming: false,
    precipitation: "none" as const,
    climate: "ocean" as const,
    waveHeading: 70,
    windHeading: 62,
    windSpeed: 8,
    currentHeading: 84,
    currentSpeed: 0.6,
  };
  const roughInput = { ...calmInput, seaState: 7, storming: true, precipitation: "rain" as const, windSpeed: 38, currentSpeed: 3.2 };
  const calm = createWaveFieldPlan(calmInput);
  const repeated = createWaveFieldPlan(calmInput);
  const rough = createWaveFieldPlan(roughInput);

  assert.deepEqual(repeated, calm);
  assert.equal(calm.travelHeading, 70);
  assert.ok(calm.components.length <= ENVIRONMENT_LIMITS.maxWaveComponents);
  assert.ok(calm.foamPatches.length <= ENVIRONMENT_LIMITS.maxFoamPatches);
  assert.ok(rough.peakToTrough > calm.peakToTrough);
  assert.ok(rough.whitecapFraction > calm.whitecapFraction);
  assert.ok(rough.foamPatches.length > calm.foamPatches.length);
  assert.match(rough.description, /Narrow crests, broad troughs, and a forward lip/);
  assert.match(rough.description, /Surface vessels heave and roll/);

  const samples = [0, 1, 2, 3].map((elapsed) => sampleWaveField(rough, 4, -3, elapsed));
  assert.ok(new Set(samples.map((value) => value.toFixed(5))).size > 2);
  const slope = sampleWaveSlope(rough, 4, -3, 1.5);
  assert.ok(Number.isFinite(slope.x));
  assert.ok(Number.isFinite(slope.y));
});

test("hostile wave inputs fail into fixed geometry and draw budgets", () => {
  const plan = createWaveFieldPlan({
    seed: Number.POSITIVE_INFINITY,
    seaState: Number.POSITIVE_INFINITY,
    storming: true,
    precipitation: "snow",
    climate: "antarctic",
    waveHeading: Number.NaN,
    windHeading: Number.NEGATIVE_INFINITY,
    windSpeed: Number.POSITIVE_INFINITY,
    currentHeading: Number.NaN,
    currentSpeed: Number.POSITIVE_INFINITY,
  });
  assert.equal(plan.components.length, ENVIRONMENT_LIMITS.maxWaveComponents);
  assert.ok(plan.foamPatches.length <= ENVIRONMENT_LIMITS.maxFoamPatches);
  assert.equal(plan.gridSegments, ENVIRONMENT_LIMITS.waveGridSegments);
  assert.ok(plan.components.every((component) => Object.values(component).every(Number.isFinite)));
  assert.ok(Number.isFinite(sampleWaveField(plan, Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE)));
});

test("atmosphere tiers change rain and snow presentation within fixed budgets", () => {
  const light = createAtmospherePlan(atmosphereBase);
  const steady = createAtmospherePlan({ ...atmosphereBase, seaState: 3, windSpeed: 18, visibility: 5 });
  const heavy = createAtmospherePlan({ ...atmosphereBase, seaState: 5, windSpeed: 27, visibility: 3 });
  const squall = createAtmospherePlan({ ...atmosphereBase, seaState: 6, windSpeed: 40, visibility: 2, storming: true, lightningCapable: true });
  const extreme = createAtmospherePlan({ ...atmosphereBase, seaState: 7, windSpeed: 46, visibility: 2, storming: true, lightningCapable: true });
  const plans = [light, steady, heavy, squall, extreme];

  assert.deepEqual(plans.map((plan) => plan.precipitation.tier), [1, 2, 3, 4, 5]);
  assert.deepEqual(plans.map((plan) => plan.precipitation.presentation), ["light", "steady", "heavy", "squall", "extreme"]);
  assert.ok(plans.every((plan, index) => index === 0 || plan.precipitation.particleCount > plans[index - 1].precipitation.particleCount));
  assert.equal(extreme.precipitation.particleCount, ENVIRONMENT_LIMITS.maxRainStreaks);
  assert.equal(extreme.precipitation.curtainCount, ENVIRONMENT_LIMITS.maxRainCurtains);
  assert.equal(extreme.precipitation.cells.length, ENVIRONMENT_LIMITS.maxPrecipitationCells);
  assert.ok(extreme.precipitation.cells.every((cell) => {
    const cloud = extreme.clouds.masses[cell.cloudIndex];
    return cloud && cell.x === cloud.x && cell.z === cloud.z && cell.cloudBaseY < cloud.y;
  }));
  assert.ok(extreme.precipitation.fallSpeed >= light.precipitation.fallSpeed * 4.6);
  assert.ok(extreme.precipitation.streakLength >= light.precipitation.streakLength * 5.8);
  assert.ok(extreme.precipitation.particleCount >= light.precipitation.particleCount * 9.7);
  assert.equal(extreme.clouds.regime, "cumulonimbus");
  assert.equal(extreme.stormLight.visible, true);
  assert.ok(extreme.stormLight.peakOpacity <= 0.13);
  assert.ok(extreme.stormLight.minCycleSeconds >= 12);

  const snow = createAtmospherePlan({ ...atmosphereBase, precipitation: "snow", seaState: 7, windSpeed: 46, visibility: 2, storming: true });
  assert.equal(snow.precipitation.particleCount, ENVIRONMENT_LIMITS.maxSnowflakes);
  assert.equal(snow.precipitation.curtainCount, 0);
  assert.ok(snow.precipitation.particleSize >= 11);
  assert.ok(snow.precipitation.fallSpeed >= 9);
  assert.ok(snow.precipitation.particleCount >= 7000);
});

test("snow tiers become markedly larger, denser, and faster without exceeding one bounded buffer", () => {
  const inputs = [
    { seaState: 1, windSpeed: 10, visibility: 8, storming: false },
    { seaState: 3, windSpeed: 18, visibility: 5, storming: false },
    { seaState: 5, windSpeed: 27, visibility: 3, storming: false },
    { seaState: 6, windSpeed: 40, visibility: 2, storming: true },
    { seaState: 7, windSpeed: 46, visibility: 2, storming: true },
  ] as const;
  const plans = inputs.map((input) => createAtmospherePlan({
    ...atmosphereBase,
    ...input,
    climate: "antarctic",
    precipitation: "snow",
  }));
  assert.deepEqual(plans.map((plan) => plan.precipitation.tier), [1, 2, 3, 4, 5]);
  for (let index = 1; index < plans.length; index += 1) {
    assert.ok(plans[index].precipitation.particleCount > plans[index - 1].precipitation.particleCount);
    assert.ok(plans[index].precipitation.particleSize > plans[index - 1].precipitation.particleSize);
    assert.ok(plans[index].precipitation.fallSpeed > plans[index - 1].precipitation.fallSpeed);
  }
  const [lightSnow, , , , extremeSnow] = plans;
  assert.ok(extremeSnow.precipitation.particleCount >= lightSnow.precipitation.particleCount * 9);
  assert.ok(extremeSnow.precipitation.particleSize >= lightSnow.precipitation.particleSize * 3.7);
  assert.ok(extremeSnow.precipitation.fallSpeed >= lightSnow.precipitation.fallSpeed * 4);
  assert.ok(plans.every((plan) => plan.precipitation.particleCount <= ENVIRONMENT_LIMITS.maxSnowflakes));
  assert.ok(plans.every((plan) => plan.precipitation.cells.every((cell) => {
    const source = plan.clouds.masses[cell.cloudIndex];
    return source && cell.x === source.x && cell.z === source.z && cell.cloudBaseY < source.y;
  })));
});

test("every validated storm enters at least the squall presentation tier", () => {
  const minimumStorm = createAtmospherePlan({
    ...atmosphereBase,
    clouds: "overcast",
    storming: true,
    seaState: 5,
    windSpeed: 30,
    visibility: 4,
  });
  assert.equal(minimumStorm.precipitation.tier, 4);
  assert.equal(minimumStorm.precipitation.presentation, "squall");
  assert.ok(minimumStorm.precipitation.particleCount >= 6000);
  assert.equal(minimumStorm.clouds.regime, "cumulonimbus");
});

test("malformed wet inputs fail closed into a precipitation-bearing cloud deck", () => {
  const wetClear = createAtmospherePlan({ ...atmosphereBase, clouds: "clear" });
  assert.equal(wetClear.clouds.regime, "nimbostratus");
  assert.ok(wetClear.clouds.masses.length > 0);
  assert.ok(wetClear.precipitation.cells.length > 0);
  assert.match(wetClear.description, /actual cloud bases?/i);
});

test("all storm climates use towering convective cloud geometry even without lightning", () => {
  const polarStorm = createAtmospherePlan({
    ...atmosphereBase,
    climate: "antarctic",
    precipitation: "snow",
    clouds: "overcast",
    storming: true,
    lightningCapable: false,
    seaState: 7,
    visibility: 2,
    windSpeed: 44,
  });
  assert.equal(polarStorm.clouds.regime, "cumulonimbus");
  assert.equal(polarStorm.stormLight.visible, false);
  assert.ok(polarStorm.precipitation.cells.length >= 6);
  assert.ok(polarStorm.clouds.lobeCount <= ENVIRONMENT_LIMITS.maxCloudLobes);
  assert.equal(
    polarStorm.clouds.lobeCount,
    polarStorm.clouds.masses.reduce((total, mass) => total + mass.lobes, 0),
  );
});

test("fog thins continuously with view elevation and observer altitude", () => {
  const plan = createAtmospherePlan({ ...atmosphereBase, clouds: "overcast", visibility: 2 });
  assert.ok(plan.fog.banks.length <= ENVIRONMENT_LIMITS.maxFogBanks);
  const horizon = fogDensityAtView(plan, 0, 1);
  const adjacent = fogDensityAtView(plan, 1, 1);
  const highView = fogDensityAtView(plan, 60, 1);
  const highObserver = fogDensityAtView(plan, 0, 18);
  assert.ok(horizon > adjacent);
  assert.ok(adjacent > highView);
  assert.ok(horizon > highObserver);
  assert.ok(Math.abs(horizon - adjacent) < plan.fog.horizonDensity * 0.02);
  assert.ok(highView > 0);
  assert.equal(plan.clouds.regime, "nimbostratus");
  assert.ok(plan.clouds.masses.length <= ENVIRONMENT_LIMITS.maxCloudMasses);
  assert.ok(plan.clouds.lobeCount <= ENVIRONMENT_LIMITS.maxCloudLobes);
  assert.match(plan.description, /cohesive faceted shells?/i);
  assert.match(plan.description, /not overlapping bubble lobes/i);
  plan.clouds.masses.forEach((mass) => {
    assert.ok(mass.breathAmplitude > 0 && mass.breathAmplitude < 0.06);
    assert.ok(mass.morphAmplitude > 0 && mass.morphAmplitude < 0.11);
    const geometry = createCloudMassGeometry(mass, plan.clouds.regime);
    const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
    const facetShade = geometry.getAttribute("aFacetShade") as THREE.BufferAttribute;
    assert.equal(geometry.index, null);
    assert.ok(positions.count >= 240);
    assert.equal(facetShade.count, positions.count);
    assert.ok(new Set(Array.from({ length: facetShade.count }, (_, vertex) => facetShade.getX(vertex).toFixed(3))).size >= 12);
    geometry.dispose();
  });
  assert.match(plan.description, /thins smoothly/i);
});

test("dry and hostile atmospheric inputs remain deterministic and finite", () => {
  const dry = createAtmospherePlan({ ...atmosphereBase, precipitation: "none", clouds: "clear" });
  assert.equal(dry.precipitation.tier, 0);
  assert.equal(dry.precipitation.particleCount, 0);
  assert.equal(dry.clouds.regime, "clear");
  assert.equal(dry.clouds.lobeCount, 0);

  const hostileInput = {
    ...atmosphereBase,
    seed: Number.POSITIVE_INFINITY,
    seaState: Number.POSITIVE_INFINITY,
    visibility: Number.NEGATIVE_INFINITY,
    windHeading: Number.NaN,
    windSpeed: Number.POSITIVE_INFINITY,
    storming: true,
    lightningCapable: true,
  };
  const first = createAtmospherePlan(hostileInput);
  const repeated = createAtmospherePlan(hostileInput);
  assert.deepEqual(first, repeated);
  assert.ok(first.precipitation.particleCount <= ENVIRONMENT_LIMITS.maxRainStreaks);
  assert.ok(first.fog.banks.length <= ENVIRONMENT_LIMITS.maxFogBanks);
  assert.ok(Number.isFinite(fogDensityAtView(first, Number.NaN, Number.POSITIVE_INFINITY)));
});
