import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { createSubsurfaceOpticsPlan } from "../app/environmentVisuals";
import {
  createStarfield,
  createStarfieldPlan,
  describeStarfield,
  evaluateStarfieldDensity,
  sampleStarWander,
  sphericalFibonacciDirection,
  STARFIELD_LIMITS,
  updateStarfield,
  visibleStarfieldPlan,
  type StarfieldPlan,
  type StarfieldStar,
} from "../app/starfield";
import { createStarPlacements, stableSeed, type ViewLayer } from "../app/viewModel";

function plan(
  seed = stableSeed(19, "glass-sounder", "arctic", "stars"),
  visibleCount: number = STARFIELD_LIMITS.fieldStars,
) {
  return createStarfieldPlan({
    seed,
    theme: "dark",
    placements: createStarPlacements(seed, STARFIELD_LIMITS.fieldStars),
    visibleCount,
  });
}

function radius(star: Pick<StarfieldStar, "x" | "y" | "z">) {
  return Math.hypot(star.x, star.y, star.z);
}

function unitDirection(star: Pick<StarfieldStar, "x" | "y" | "z">) {
  const magnitude = radius(star) || 1;
  return { x: star.x / magnitude, y: star.y / magnitude, z: star.z / magnitude };
}

function equalAreaCell(direction: { x: number; y: number; z: number }) {
  const latitudeBand = Math.min(5, Math.floor((direction.y + 1) * 3));
  const longitude = (Math.atan2(direction.z, direction.x) + Math.PI * 2) % (Math.PI * 2);
  const longitudeBand = Math.min(11, Math.floor(longitude / (Math.PI * 2) * 12));
  return latitudeBand * 12 + longitudeBand;
}

function visibleNight(field: StarfieldPlan, viewLayer: ViewLayer) {
  return visibleStarfieldPlan(field, {
    viewLayer,
    time: "night",
    clouds: "clear",
    precipitation: "none",
    visibility: 18,
    seaState: 1,
    maximumVisible: STARFIELD_LIMITS.maxStars,
  });
}

test("starfield plans are deterministic while different exercise seeds remain distinct", () => {
  const seed = stableSeed(5, "southern-ice", "stars");
  const first = plan(seed, 517);
  const repeated = plan(seed, 517);
  const different = plan(seed + 1, 517);
  const nebulaPointCount = STARFIELD_LIMITS.nebulaCount * STARFIELD_LIMITS.starsPerNebula;

  assert.deepEqual(repeated, first);
  assert.notDeepEqual(different.stars.slice(0, 12), first.stars.slice(0, 12));
  assert.notDeepEqual(different.nebulae, first.nebulae);
  assert.equal(first.counts.field, 517);
  assert.equal(first.counts.nebula, nebulaPointCount);
  assert.equal(first.stars.length, 517 + nebulaPointCount);
  assert.equal(first.counts.near + first.counts.far, first.stars.length);
  assert.equal(first.counts.still + first.counts.swirling, first.stars.length);
  assert.equal(first.counts.field + first.counts.nebula, first.stars.length);
});

test("sixteen observable harmonic fields overlap across one continuous layered canopy", () => {
  const field = plan();
  assert.ok(field.counts.near > 0);
  assert.ok(field.counts.far > 0);
  assert.ok(field.counts.still > 0);
  assert.ok(field.counts.swirling > 0);
  assert.ok(field.counts.swirling / field.stars.length >= 0.8, "a large majority of the canopy must visibly wander");
  assert.ok(field.counts.still / field.stars.length <= 0.2, "still lights are only a quiet counterpoint");
  assert.equal(field.nebulae.length, STARFIELD_LIMITS.nebulaCount);
  assert.equal(field.counts.nebula, STARFIELD_LIMITS.nebulaCount * STARFIELD_LIMITS.starsPerNebula);
  assert.deepEqual(new Set(field.nebulae.map((nebula) => nebula.colorFamily)), new Set(["white", "pastel", "vibrant"]));
  assert.deepEqual(
    field.nebulae.map((nebula) => nebula.densityField.index),
    Array.from({ length: STARFIELD_LIMITS.nebulaCount }, (_, index) => index),
  );

  const aggregateCellCounts = Array.from({ length: 72 }, () => 0);
  const aggregateCellFields = Array.from({ length: 72 }, () => new Set<string>());
  const highDensitySupports: Array<Set<number>> = [];

  for (const nebula of field.nebulae) {
    const points = field.stars.filter((star) => star.nebulaId === nebula.id);
    assert.equal(points.length, STARFIELD_LIMITS.starsPerNebula, `${nebula.id} must remain a dense bounded field`);
    assert.equal(new Set(points.map((star) => `${star.x}:${star.y}:${star.z}`)).size, points.length);
    assert.ok(points.every((star) => star.population === "nebula"));
    assert.ok(points.some((star) => star.depth === "near"));
    assert.ok(points.some((star) => star.depth === "far"));
    assert.equal(points.filter((star) => star.motion === "swirling").length, 744);

    const evaluationGrid = Array.from({ length: 4_096 }, (_, index) => evaluateStarfieldDensity(
      nebula.densityField,
      sphericalFibonacciDirection(index, 4_096, 0.123),
    ));
    const sortedDensity = [...evaluationGrid].sort((left, right) => left - right);
    assert.ok(evaluationGrid.every((density) => (
      Number.isFinite(density)
      && density > STARFIELD_LIMITS.minDensity
      && density < STARFIELD_LIMITS.maxDensity
    )));
    assert.ok(sortedDensity[3_686] - sortedDensity[409] >= 0.45, `${nebula.id} needs visible low-frequency contrast`);

    const selectedDensity = points.map((star) => evaluateStarfieldDensity(nebula.densityField, star));
    const selectedMean = selectedDensity.reduce((sum, density) => sum + density, 0) / selectedDensity.length;
    const gridMean = evaluationGrid.reduce((sum, density) => sum + density, 0) / evaluationGrid.length;
    assert.ok(selectedMean >= gridMean * 1.07, `${nebula.id} must be spatially density-weighted rather than palette-only`);
    const lowerQuartile = sortedDensity[1_024];
    const upperQuartile = sortedDensity[3_072];
    const lowerSelected = selectedDensity.filter((density) => density <= lowerQuartile).length;
    const upperSelected = selectedDensity.filter((density) => density >= upperQuartile).length;
    assert.ok(upperSelected / lowerSelected >= 1.75, `${nebula.id} needs an observable but globally supported luminance structure`);

    const occupiedCells = new Set<number>();
    let upperHemisphere = 0;
    let lowerHemisphere = 0;
    points.forEach((star) => {
      const direction = unitDirection(star);
      const cell = equalAreaCell(direction);
      occupiedCells.add(cell);
      aggregateCellCounts[cell] += 1;
      aggregateCellFields[cell].add(nebula.id);
      if (direction.y >= 0) upperHemisphere += 1;
      else lowerHemisphere += 1;
    });
    assert.ok(occupiedCells.size >= 68, `${nebula.id} must retain global support without an oval boundary`);
    assert.ok(upperHemisphere >= 280 && lowerHemisphere >= 280, `${nebula.id} must overlap both hemispheres`);
    const radialDistances = points.map(radius);
    assert.ok(Math.max(...radialDistances) - Math.min(...radialDistances) >= 310, `${nebula.id} must span radically layered radial depth`);

    const supportGrid = Array.from({ length: 2_048 }, (_, index) => ({
      index,
      density: evaluateStarfieldDensity(
        nebula.densityField,
        sphericalFibonacciDirection(index, 2_048, 0.123),
      ),
    }));
    const supportCutoff = [...supportGrid]
      .sort((left, right) => left.density - right.density)[1_331].density;
    highDensitySupports.push(new Set(
      supportGrid.filter((sample) => sample.density >= supportCutoff).map((sample) => sample.index),
    ));
  }

  assert.ok(aggregateCellCounts.every((count) => count >= 100), "the aggregate canopy must have no empty or weak equal-area cell");
  assert.ok(aggregateCellFields.every((ids) => ids.size >= 14), "fields must overlap throughout the global canopy");
  const overlaps: number[] = [];
  const overlappingPeers = Array.from({ length: STARFIELD_LIMITS.nebulaCount }, () => 0);
  for (let left = 0; left < highDensitySupports.length; left += 1) {
    for (let right = left + 1; right < highDensitySupports.length; right += 1) {
      const leftSupport = highDensitySupports[left];
      const rightSupport = highDensitySupports[right];
      let intersection = 0;
      leftSupport.forEach((index) => {
        if (rightSupport.has(index)) intersection += 1;
      });
      const jaccard = intersection / (leftSupport.size + rightSupport.size - intersection);
      overlaps.push(jaccard);
      if (jaccard >= 0.06) {
        overlappingPeers[left] += 1;
        overlappingPeers[right] += 1;
      }
    }
  }
  overlaps.sort((left, right) => left - right);
  assert.ok(overlaps[Math.floor(overlaps.length / 2)] >= 0.17, "broad field lobes must overlap rather than tile the sphere");
  assert.ok(overlappingPeers.every((count) => count >= 8), "every field must materially overlap many peers");

  for (const viewLayer of ["sky", "air", "surface"] as const) {
    const visible = visibleNight(field, viewLayer);
    assert.ok(visible.nebulae.length >= 10, `${viewLayer} must retain many above-horizon nebulae on a clear night`);
    assert.ok(visible.counts.nebula >= 5_800, `${viewLayer} must retain a dense above-horizon stellar field after geometric clipping`);
    assert.ok(visible.stars.every((star) => star.y > 0));
  }

  const daylight = visibleStarfieldPlan(field, {
    viewLayer: "sky",
    time: "day",
    clouds: "clear",
    precipitation: "none",
    visibility: 18,
    seaState: 1,
    maximumVisible: STARFIELD_LIMITS.maxStars,
  });
  assert.equal(daylight.nebulae.length, 0);
  assert.equal(daylight.counts.nebula, 0);
  assert.match(describeStarfield(field), /radically layered near and far depth/);
  assert.match(describeStarfield(field), /overlap across 16 real irregular low-frequency harmonic density and luminance fields/);
  assert.match(describeStarfield(field), /without separate oval panels, painted clouds, radial kernels, hard islands, or empty gaps/);
  assert.match(describeStarfield(field), /scene depth and atmospheric fog keep the canopy behind clouds, waves, vessels, and aircraft/);
  assert.match(describeStarfield(field), /Exuberant independent non-flashing scintillation/);
});

test("the canopy is white-dominant with restrained color and a substantial crystalline jewel population", () => {
  const field = plan();
  const ambient = field.stars.filter((star) => star.prominence === "ambient");
  const jewels = field.stars.filter((star) => star.prominence === "jewel");
  const white = field.stars.filter((star) => star.colorIndex <= STARFIELD_LIMITS.whiteColorIndexMax);
  const pureWhite = field.stars.filter((star) => star.colorIndex === 0);
  const colorAccents = field.stars.filter((star) => star.colorIndex > STARFIELD_LIMITS.whiteColorIndexMax);
  const jewelFraction = jewels.length / field.stars.length;

  assert.ok(ambient.length > jewels.length * 8, "ambient facets remain the majority without reducing jewels to rare particles");
  assert.ok(jewelFraction >= STARFIELD_LIMITS.minJewelFraction);
  assert.ok(jewelFraction <= STARFIELD_LIMITS.maxJewelFraction);
  assert.ok(white.length / field.stars.length >= STARFIELD_LIMITS.minWhiteFraction);
  assert.ok(pureWhite.length / field.stars.length >= STARFIELD_LIMITS.minPureWhiteFraction);
  assert.ok(white.length > colorAccents.length * 3, "white and near-white lights must clearly dominate the canopy");
  assert.ok(colorAccents.length > 2_000, "restrained color variety must remain visible in aggregate");
  assert.ok(ambient.every((star) => star.scale <= STARFIELD_LIMITS.maxAmbientScale));
  assert.ok(jewels.every((star) => star.scale >= 0.8 && star.scale <= STARFIELD_LIMITS.maxJewelScale));
  assert.ok(jewels.filter((star) => star.scale >= STARFIELD_LIMITS.minJewelScale).length > jewels.length * 0.8);
  assert.equal(STARFIELD_LIMITS.maxAmbientScale, 0.96);
  assert.equal(STARFIELD_LIMITS.minJewelScale, 1.12);
  assert.equal(STARFIELD_LIMITS.nebulaJewelScaleSpan, 0.64);
  assert.equal(STARFIELD_LIMITS.fieldJewelScaleSpan, 0.62);
  assert.equal(STARFIELD_LIMITS.maxJewelScale, 1.92);
  assert.deepEqual(new Set(field.stars.map((star) => star.colorIndex)), new Set(Array.from({ length: 16 }, (_, index) => index)));
  assert.ok(jewels.some((star) => star.colorIndex === 0), "the largest landmark glints should be white rather than saturated icons");
  assert.ok(jewels.some((star) => star.population === "field"));
  for (const nebula of field.nebulae) {
    const nebulaJewels = jewels.filter((star) => star.nebulaId === nebula.id);
    assert.ok(nebulaJewels.length >= 69 && nebulaJewels.length <= 71, `${nebula.id} must visibly resolve many crystalline facets`);
  }
  assert.match(describeStarfield(field), /artistically enlarged faceted lights/);
  assert.match(describeStarfield(field), /sky-covering white-dominant crystalline canopy/);
  assert.match(describeStarfield(field), /restrained pale cyan, lavender, rose, peach, mint, gold, and jewel-color accents/);
});

test("apparent brightness governs rare daylight and subsurface visibility", () => {
  const complete = plan(0x61ea);
  const openWater = createSubsurfaceOpticsPlan({ body: "moon", bodyAboveHorizon: true, bodyAltitude: 42, moonIllumination: 0.92, time: "night", clouds: "clear", precipitation: "none", visibility: 18, seaState: 1 });
  const closedWater = createSubsurfaceOpticsPlan({ body: "moon", bodyAboveHorizon: true, bodyAltitude: 42, moonIllumination: 0.92, time: "night", clouds: "overcast", precipitation: "rain", visibility: 2, seaState: 7 });
  const openWaterButBodyBelow = createSubsurfaceOpticsPlan({ body: "moon", bodyAboveHorizon: false, bodyAltitude: -12, moonIllumination: 0.92, time: "night", clouds: "clear", precipitation: "none", visibility: 18, seaState: 1 });
  const openWaterButBodyTooDim = createSubsurfaceOpticsPlan({ body: "moon", bodyAboveHorizon: true, bodyAltitude: 0, moonIllumination: 0, time: "night", clouds: "clear", precipitation: "none", visibility: 18, seaState: 5 });
  const night = visibleNight(complete, "surface");
  const day = visibleStarfieldPlan(complete, { viewLayer: "surface", time: "day", clouds: "clear", precipitation: "none", visibility: 18, seaState: 1, maximumVisible: STARFIELD_LIMITS.maxStars });
  const underwater = visibleStarfieldPlan(complete, { viewLayer: "subsurface", time: "night", clouds: "clear", precipitation: "none", visibility: 18, seaState: 1, maximumVisible: STARFIELD_LIMITS.maxStars, subsurfaceOptics: openWater });
  const blockedUnderwater = visibleStarfieldPlan(complete, { viewLayer: "subsurface", time: "night", clouds: "overcast", precipitation: "rain", visibility: 2, seaState: 7, maximumVisible: STARFIELD_LIMITS.maxStars, subsurfaceOptics: closedWater });
  const noBodySightline = visibleStarfieldPlan(complete, { viewLayer: "subsurface", time: "night", clouds: "clear", precipitation: "none", visibility: 18, seaState: 1, maximumVisible: STARFIELD_LIMITS.maxStars, subsurfaceOptics: openWaterButBodyBelow });
  const noDimBodySightline = visibleStarfieldPlan(complete, { viewLayer: "subsurface", time: "night", clouds: "clear", precipitation: "none", visibility: 18, seaState: 5, maximumVisible: STARFIELD_LIMITS.maxStars, subsurfaceOptics: openWaterButBodyTooDim });
  const obscured = visibleStarfieldPlan(complete, { viewLayer: "surface", time: "day", clouds: "overcast", precipitation: "rain", visibility: 2, seaState: 6, maximumVisible: STARFIELD_LIMITS.maxStars });

  assert.ok(night.stars.length > day.stars.length);
  assert.ok(night.stars.every((star) => star.y > 0), "non-cosmos views must not paint stars below the geometric horizon");
  assert.ok(day.stars.length > 0, "rare brilliant field stars should survive a clear daylight threshold");
  assert.equal(day.counts.nebula, 0);
  assert.ok(underwater.stars.length > 0, "the brightest points should remain visible in a shallow subsurface view");
  assert.ok(underwater.stars.every((star) => star.brightness >= 0.8));
  assert.ok(underwater.stars.every((star) => star.y > 0), "all underwater sky points must be inside the refracted overhead window");
  assert.equal(underwater.appearance, "direct through the water surface");
  assert.match(describeStarfield(underwater), /not reflections/);
  assert.equal(blockedUnderwater.stars.length, 0);
  assert.equal(noBodySightline.stars.length, 0, "stars cannot appear where the active sun or moon sightline is not admitted");
  assert.equal(noBodySightline.nebulae.length, 0);
  assert.equal(noDimBodySightline.stars.length, 0);
  assert.equal(noDimBodySightline.nebulae.length, 0);
  assert.ok(obscured.stars.length < day.stars.length);
  assert.equal(day.nebulae.length, 0);
  assert.equal(underwater.nebulae.length, 1, "one exceptionally bright field may transmit through calm, clear water");
  assert.equal(blockedUnderwater.nebulae.length, 0);
});

test("bright crystalline stars remain present at dawn and dusk under compounded obscuration", () => {
  const complete = plan(STARFIELD_LIMITS.maxStars);
  for (const [time, maximumVisible, minimum, brightness] of [
    ["dawn", 64, 48, 0.86],
    ["dusk", 96, 72, 0.84],
  ] as const) {
    const twilight = visibleStarfieldPlan(complete, {
      viewLayer: "sky",
      time,
      clouds: "overcast",
      precipitation: "rain",
      visibility: 2,
      seaState: 7,
      maximumVisible,
    });
    assert.ok(twilight.stars.length >= minimum, `${time} must keep a legible brightest-star cohort`);
    assert.ok(twilight.stars.every((star) => star.population === "field"), "overcast twilight retains isolated brilliant stars, not nebula fields");
    assert.ok(twilight.stars.every((star) => star.brightness >= brightness));
    assert.ok(twilight.stars.filter((star) => star.prominence === "jewel").length >= minimum * 0.75);
  }
});

test("star instances, faceted geometry, and mesh budgets remain strictly bounded", () => {
  const seed = 0xabcdef;
  const failedClosed = createStarfieldPlan({
    seed,
    theme: "light",
    placements: createStarPlacements(seed, 4_000),
    visibleCount: Number.POSITIVE_INFINITY,
  });
  assert.equal(failedClosed.stars.length, 0);
  assert.equal(failedClosed.nebulae.length, 0);

  const maximum = createStarfieldPlan({
    seed,
    theme: "light",
    placements: createStarPlacements(seed, 4_000),
    visibleCount: 50_000,
  });
  assert.equal(maximum.counts.field, STARFIELD_LIMITS.fieldStars);
  assert.equal(maximum.counts.nebula, STARFIELD_LIMITS.nebulaCount * STARFIELD_LIMITS.starsPerNebula);
  assert.equal(maximum.stars.length, STARFIELD_LIMITS.maxStars);
  const radialDistances = maximum.stars.map(radius).sort((left, right) => left - right);
  const radialQuantile = (fraction: number) => radialDistances[Math.floor((radialDistances.length - 1) * fraction)];
  assert.ok(radialDistances[0] >= STARFIELD_LIMITS.minRadius);
  assert.ok(radialDistances.at(-1)! <= STARFIELD_LIMITS.maxRadius);
  assert.ok(radialDistances.at(-1)! - radialDistances[0] >= 315);
  assert.ok(radialQuantile(0.05) >= 120 && radialQuantile(0.05) <= 130);
  assert.ok(radialQuantile(0.1) >= 150 && radialQuantile(0.1) <= 160, "the close population must be substantial rather than isolated outliers");
  assert.ok(radialQuantile(0.25) >= 200 && radialQuantile(0.25) <= 210);
  assert.ok(radialQuantile(0.5) >= 260 && radialQuantile(0.5) <= 270);
  assert.ok(radialQuantile(0.75) >= 320 && radialQuantile(0.75) <= 332);
  assert.ok(radialQuantile(0.9) >= 362 && radialQuantile(0.9) <= 372, "the far volume must contain a substantial population");
  assert.ok(radialQuantile(0.95) >= 380 && radialQuantile(0.95) <= 390);
  assert.ok(maximum.stars.every((star) => (
    [star.x, star.y, star.z, star.scale, star.rotation, star.brightness, star.colorIndex].every(Number.isFinite)
    && radius(star) >= STARFIELD_LIMITS.minRadius
    && radius(star) <= STARFIELD_LIMITS.maxRadius
    && star.scale >= 0.14
    && star.scale <= STARFIELD_LIMITS.maxJewelScale
    && star.rotation >= 0
    && star.rotation < Math.PI * 2
    && star.brightness >= 0
    && star.brightness <= 1
    && Number.isInteger(star.colorIndex)
    && star.colorIndex >= 0
    && star.colorIndex < 16
    && (star.prominence === "ambient" || star.prominence === "jewel")
  )));

  const runtime = createStarfield(new THREE.Scene(), maximum);
  assert.equal(runtime.starBatches.length, STARFIELD_LIMITS.maxStarBatches);
  assert.equal(runtime.nebulae.length, STARFIELD_LIMITS.nebulaCount);
  assert.ok(runtime.nebulae.every((nebula) => !("group" in nebula)), "nebula metadata must not allocate separate geometry");
  assert.ok(runtime.nebulae.every((nebula) => nebula.densityField.index >= 0));

  const meshes: THREE.InstancedMesh[] = [];
  const forbiddenGeometry: string[] = [];
  let lineOrPointPrimitives = 0;
  runtime.root.traverse((object) => {
    if (object instanceof THREE.InstancedMesh) meshes.push(object);
    if (object instanceof THREE.Line || object instanceof THREE.LineSegments || object instanceof THREE.Points) lineOrPointPrimitives += 1;
    if (/Torus|Circle|Shape|Ring/i.test((object as THREE.Mesh).geometry?.type ?? "")) {
      forbiddenGeometry.push((object as THREE.Mesh).geometry.type);
    }
  });

  assert.equal(STARFIELD_LIMITS.maxMeshes, 1);
  assert.equal(meshes.length, STARFIELD_LIMITS.maxMeshes);
  assert.equal(lineOrPointPrimitives, 0);
  assert.deepEqual(forbiddenGeometry, []);
  const mesh = meshes[0];
  assert.equal(mesh.count, STARFIELD_LIMITS.maxStars);
  assert.equal(mesh.name, "distant-faceted-star-points");
  assert.equal(mesh.geometry.type, "BufferGeometry");
  assert.equal(mesh.geometry.name, "paired-octahedral-star-core-and-halo");
  assert.equal(mesh.geometry.index, null);
  assert.equal(mesh.geometry.getAttribute("position").count, 48);
  assert.equal(mesh.geometry.getAttribute("position").count / 3, 16);
  const facetHalo = mesh.geometry.getAttribute("aFacetHalo");
  assert.equal(facetHalo.count, 48);
  assert.ok(Array.from({ length: 24 }, (_, index) => facetHalo.getX(index)).every((value) => value === 0));
  assert.ok(Array.from({ length: 24 }, (_, index) => facetHalo.getX(index + 24)).every((value) => value === 1));
  const positions = mesh.geometry.getAttribute("position");
  const coreRadii = Array.from({ length: 24 }, (_, index) => Math.hypot(positions.getX(index), positions.getY(index), positions.getZ(index)));
  const haloRadii = Array.from({ length: 24 }, (_, index) => Math.hypot(positions.getX(index + 24), positions.getY(index + 24), positions.getZ(index + 24)));
  assert.ok(coreRadii.every((value) => Math.abs(value - 0.82) < 1e-5));
  assert.ok(haloRadii.every((value) => Math.abs(value - STARFIELD_LIMITS.haloRadius) < 1e-5));
  assert.ok(STARFIELD_LIMITS.haloRadius / 0.82 >= 1.82 && STARFIELD_LIMITS.haloRadius / 0.82 <= 1.83);
  const normals = mesh.geometry.getAttribute("normal");
  const faceNormals = new Set(Array.from({ length: normals.count }, (_, index) => (
    `${normals.getX(index).toFixed(5)}:${normals.getY(index).toFixed(5)}:${normals.getZ(index).toFixed(5)}`
  )));
  assert.equal(faceNormals.size, 8, "each octahedron triangle must retain a distinct low-poly face normal");
  assert.ok(mesh.material instanceof THREE.ShaderMaterial);
  assert.equal(mesh.material.depthTest, true);
  assert.equal(mesh.material.depthWrite, false);
  assert.equal(mesh.renderOrder, -20);
  assert.equal(mesh.geometry.getAttribute("aTwinkleProfile").count, maximum.stars.length);
  assert.equal(mesh.geometry.getAttribute("aShiftProfile").count, maximum.stars.length);
  assert.equal(mesh.geometry.getAttribute("aBaseAlpha").count, maximum.stars.length);
  assert.match(mesh.material.fragmentShader, /facetLight = 0\.42 \+ abs\(vViewNormal\.z\) \* 0\.58/);
  assert.match(mesh.material.fragmentShader, /vAlpha \* 0\.26/);
  assert.match(mesh.material.fragmentShader, /0\.0, 0\.23/);
  assert.match(mesh.material.vertexShader, /Independently hashed targets create a bounded, non-periodic pocket/);
  assert.match(mesh.material.vertexShader, /instancePosition\.xyz \+= shift/);
  assert.match(mesh.material.vertexShader, /fog_vertex/);
  assert.match(mesh.material.fragmentShader, /fog_fragment/);
  assert.equal(mesh.material.fog, true);
  const jewelIndex = maximum.stars.findIndex((star) => star.prominence === "jewel");
  const jewelMatrix = new THREE.Matrix4();
  const jewelScale = new THREE.Vector3();
  mesh.getMatrixAt(jewelIndex, jewelMatrix);
  jewelMatrix.decompose(new THREE.Vector3(), new THREE.Quaternion(), jewelScale);
  assert.ok(Math.abs(jewelScale.x - maximum.stars[jewelIndex].scale) < 1e-5);
  assert.ok(Math.abs(jewelScale.y / jewelScale.x - 0.94) < 1e-5);
  assert.ok(Math.abs(jewelScale.z / jewelScale.x - 0.86) < 1e-5);
  assert.equal(maximum.stars.length * 16, 245_760, "the complete core-and-halo canopy must stay within its triangle budget");
});

test("every instance receives emphatic independent twinkle and bounded shift profiles while reduced motion freezes shader time", () => {
  assert.equal(STARFIELD_LIMITS.minTwinkleHz, 0.22);
  assert.equal(STARFIELD_LIMITS.maxTwinkleHz, 0.72);
  assert.equal(STARFIELD_LIMITS.maxTwinkleAmplitude, 0.46);
  assert.equal(STARFIELD_LIMITS.maxPulseAmplitude, 0.31);
  assert.equal(STARFIELD_LIMITS.minShiftHz, 0.18);
  assert.equal(STARFIELD_LIMITS.maxShiftHz, 0.48);
  assert.equal(STARFIELD_LIMITS.minShiftWorldUnits, 2.8);
  assert.equal(STARFIELD_LIMITS.maxShiftWorldUnits, 9.6);

  const field = plan();
  assert.equal(field.counts.swirling, 14_880);
  assert.equal(field.counts.still, 480);
  const runtime = createStarfield(new THREE.Scene(), field);
  assert.equal(runtime.starBatches.length, 1);
  const batch = runtime.starBatches[0];
  const twinkle = batch.mesh.geometry.getAttribute("aTwinkleProfile");
  const shift = batch.mesh.geometry.getAttribute("aShiftProfile");
  const alpha = batch.mesh.geometry.getAttribute("aBaseAlpha");
  assert.equal(twinkle.itemSize, 4);
  assert.equal(twinkle.count, field.stars.length);
  assert.equal(shift.itemSize, 4);
  assert.equal(shift.count, field.stars.length);

  const profiles = new Set<string>();
  const sampledPositions = new Set<string>();
  for (let index = 0; index < twinkle.count; index++) {
    const phase = twinkle.getX(index);
    const frequency = twinkle.getY(index);
    const amplitude = twinkle.getZ(index);
    const pulse = twinkle.getW(index);
    const baseAlpha = alpha.getX(index);
    const shiftPhaseX = shift.getX(index);
    const shiftPhaseY = shift.getY(index);
    const shiftFrequency = shift.getZ(index);
    const shiftAmplitude = shift.getW(index);
    assert.ok([phase, frequency, amplitude, pulse, baseAlpha, shiftPhaseX, shiftPhaseY, shiftFrequency, shiftAmplitude].every(Number.isFinite));
    assert.ok(frequency >= STARFIELD_LIMITS.minTwinkleHz && frequency <= STARFIELD_LIMITS.maxTwinkleHz);
    assert.ok(amplitude >= 0.18 && amplitude <= STARFIELD_LIMITS.maxTwinkleAmplitude);
    assert.ok(pulse >= 0.1 && pulse <= STARFIELD_LIMITS.maxPulseAmplitude);
    assert.ok(baseAlpha >= 0.339 && baseAlpha <= 0.981);
    assert.ok(shiftFrequency >= STARFIELD_LIMITS.minShiftHz && shiftFrequency <= STARFIELD_LIMITS.maxShiftHz);
    if (field.stars[index].motion === "still") assert.equal(shiftAmplitude, 0);
    else {
      assert.ok(shiftAmplitude >= STARFIELD_LIMITS.minShiftWorldUnits && shiftAmplitude <= STARFIELD_LIMITS.maxShiftWorldUnits);
      if (index < 96) {
        const profile = {
          clockPhase: shiftPhaseX,
          seed: shiftPhaseY,
          frequency: shiftFrequency,
          amplitude: shiftAmplitude,
        };
        assert.deepEqual(sampleStarWander(profile, 0), { x: 0, y: 0, z: 0 });
        for (const elapsed of [1, 7, 29, 83, 240]) {
          const sampled = sampleStarWander(profile, elapsed);
          assert.ok(Math.abs(sampled.x) <= shiftAmplitude + 1e-9);
          assert.ok(Math.abs(sampled.y) <= shiftAmplitude + 1e-9);
          assert.ok(Math.abs(sampled.z) <= shiftAmplitude + 1e-9);
          sampledPositions.add(`${sampled.x.toFixed(4)}:${sampled.y.toFixed(4)}:${sampled.z.toFixed(4)}`);
        }
      }
    }
    profiles.add(`${phase}:${frequency}:${amplitude}:${pulse}`);
  }
  assert.equal(profiles.size, field.stars.length, "twinkle must remain independently phased instead of synchronizing a batch");
  assert.match(batch.material.vertexShader, /attribute vec4 aTwinkleProfile/);
  assert.match(batch.material.vertexShader, /attribute vec4 aShiftProfile/);
  assert.match(batch.material.vertexShader, /vec3 wanderTarget/);
  assert.match(batch.material.vertexShader, /vec3 sampledWander/);
  assert.match(batch.material.vertexShader, /aShiftProfile\.w \* 0\.5/, "each axis must remain within the declared displacement bound from its rest frame");
  assert.match(batch.material.vertexShader, /vec4 mvPosition = modelViewMatrix \* instancePosition/);
  assert.ok(batch.material.uniforms.fogColor, "fog-enabled custom stars need Three's fog uniform set");
  assert.match(batch.material.vertexShader, /irregular/);
  assert.match(batch.material.vertexShader, /crystalline/);
  assert.doesNotMatch(batch.material.vertexShader, /mat2\(driftCos/);
  assert.doesNotMatch(batch.material.vertexShader, /sin\(shiftTime|cos\(shiftTime/);
  assert.ok(sampledPositions.size >= 300, "moving lights need many independent aperiodic target positions");

  const instanceMatrices = Array.from(batch.mesh.instanceMatrix.array);
  const observer = new THREE.Vector3(9, -2.5, 10.5);
  updateStarfield(runtime, 83, true, observer);
  assert.equal(batch.material.uniforms.uTime.value, 0);
  assert.deepEqual(runtime.root.position.toArray(), observer.toArray());
  assert.deepEqual(Array.from(batch.mesh.instanceMatrix.array), instanceMatrices);

  updateStarfield(runtime, 29, false, new THREE.Vector3(4, 8, 12));
  assert.equal(batch.material.uniforms.uTime.value, 29);
  assert.deepEqual(runtime.root.position.toArray(), [4, 8, 12]);
  assert.deepEqual(Array.from(batch.mesh.instanceMatrix.array), instanceMatrices, "animation must not upload per-instance matrices");

  updateStarfield(runtime, 10_000, true);
  assert.equal(batch.material.uniforms.uTime.value, 0);
  assert.deepEqual(Array.from(batch.mesh.instanceMatrix.array), instanceMatrices);
});
