import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { createCelestialWaterReflection, createLowPolyMoon } from "../app/battlefieldScene";
import { horizontalVector, moonIlluminatedPath } from "../app/celestial";
import { getCelestialProminence, getSkyVisibility, viewTelemetryFromDirection } from "../app/viewModel";

test("zero supported aircraft gives the active body commanding prominence in stars view", () => {
  const stars = getCelestialProminence({
    body: "sun",
    viewLayer: "stars",
    supportedAircraftCount: 0,
    aboveHorizon: true,
  });
  const sky = getCelestialProminence({
    body: "sun",
    viewLayer: "sky",
    supportedAircraftCount: 0,
    aboveHorizon: true,
  });

  assert.equal(stars.renderInScene, true);
  assert.equal(stars.label, "commanding");
  assert.ok(stars.bodyRadius >= 4);
  assert.ok(stars.haloRadius > stars.bodyRadius * 2);
  assert.ok(stars.bodyRadius > sky.bodyRadius * 1.8);
});

test("supported aircraft reduce scale and halo modestly without erasing the body", () => {
  const quiet = getCelestialProminence({
    body: "moon",
    viewLayer: "stars",
    supportedAircraftCount: 0,
    aboveHorizon: true,
  });
  const busy = getCelestialProminence({
    body: "moon",
    viewLayer: "stars",
    supportedAircraftCount: 40,
    aboveHorizon: true,
  });

  assert.ok(busy.bodyRadius < quiet.bodyRadius);
  assert.ok(busy.haloRadius < quiet.haloRadius);
  assert.ok(busy.haloOpacity <= quiet.haloOpacity);
  assert.ok(busy.bodyRadius >= quiet.bodyRadius * 0.8);
  assert.equal(busy.renderInScene, true);
});

test("below-horizon bodies remain off-scene and require a truthful direction indicator", () => {
  const below = getCelestialProminence({
    body: "moon",
    viewLayer: "stars",
    supportedAircraftCount: 0,
    aboveHorizon: false,
  });

  assert.equal(below.renderInScene, false);
  assert.equal(below.indicatorRequired, true);
});

test("subsurface bodies render only when the shared transmission model admits them", () => {
  const admitted = getCelestialProminence({
    body: "moon",
    viewLayer: "subsurface",
    supportedAircraftCount: 0,
    aboveHorizon: true,
    subsurfaceTransmission: true,
  });
  const blocked = getCelestialProminence({
    body: "sun",
    viewLayer: "subsurface",
    supportedAircraftCount: 0,
    aboveHorizon: true,
    subsurfaceTransmission: false,
  });

  assert.equal(admitted.renderInScene, true);
  assert.equal(admitted.appearance, "direct through the water surface");
  assert.equal(blocked.renderInScene, false);
});

test("prominence calculations do not alter procedural background star count", () => {
  const skyInput = {
    time: "night" as const,
    clouds: "clear" as const,
    precipitation: "none" as const,
    visibility: 12,
    aircraftCount: 0,
    lowSignatureAircraft: 0,
    vesselCount: 0,
    lowSignatureVessels: 0,
  };
  const before = getSkyVisibility(skyInput);
  getCelestialProminence({ body: "sun", viewLayer: "stars", supportedAircraftCount: 0, aboveHorizon: true });
  getCelestialProminence({ body: "moon", viewLayer: "surface", supportedAircraftCount: 24, aboveHorizon: false });
  const after = getSkyVisibility(skyInput);

  assert.deepEqual(after, before);
});

test("synthetic observer vectors preserve azimuth and altitude exactly enough for the readout", () => {
  const expectedAzimuth = 123;
  const expectedAltitude = 27;
  const vector = horizontalVector(expectedAzimuth, expectedAltitude);
  const telemetry = viewTelemetryFromDirection(vector.x, vector.y, vector.z);

  assert.equal(telemetry.heading, expectedAzimuth);
  assert.equal(telemetry.elevation, expectedAltitude);
});

test("lunar HUD geometry contains only illuminated facets and respects phase orientation", () => {
  assert.equal(moonIlluminatedPath(0, false), "", "new moon must not paint a dark disk");
  const waxing = moonIlluminatedPath(45, false, 8);
  const waning = moonIlluminatedPath(315, false, 8);
  const southernWaxing = moonIlluminatedPath(45, true, 8);

  assert.ok(waxing.startsWith("M0 -1"));
  assert.ok(waxing.includes("L1 0"), "waxing light must follow the northern right limb");
  assert.ok(waning.includes("L-1 0"), "waning light must follow the northern left limb");
  assert.ok(southernWaxing.includes("L-1 0"), "southern apparent orientation must reverse");
  assert.equal(moonIlluminatedPath(45, false, 8), waxing, "phase geometry must be deterministic");
});

test("full moon illuminated geometry closes over both limbs without a painted dark surface", () => {
  const full = moonIlluminatedPath(180, false, 12);
  assert.ok(full.includes("L-1 0"));
  assert.ok(full.includes("L1 0"));
  assert.ok(full.endsWith(" Z"));
  assert.doesNotMatch(full, /NaN|Infinity/);
});

test("WebGL moon discards unlit fragments instead of coloring a dark hemisphere", () => {
  const prominence = getCelestialProminence({
    body: "moon",
    viewLayer: "sky",
    supportedAircraftCount: 0,
    aboveHorizon: true,
  });
  const moonSightline = new THREE.Vector3(0.1, 0.24, -0.96).normalize();
  const sunDirection = new THREE.Vector3(0.92, -0.03, 0.38).normalize();
  const moon = createLowPolyMoon(moonSightline, sunDirection, "dark", prominence, false);
  assert.equal(moon.userData.phaseRendering, "illuminated-facets-only");
  assert.equal(moon.children.length, 2);
  for (const child of moon.children) {
    assert.ok(child instanceof THREE.Mesh);
    assert.ok(child.material instanceof THREE.ShaderMaterial);
    assert.match(child.material.fragmentShader, /if \(lightFacing <= 0\.0\) discard/);
    assert.doesNotMatch(child.material.fragmentShader, /uDarkColor|mix\s*\(\s*uDark/);
    assert.equal(child.material.depthTest, true);
    assert.equal(child.material.fog, true);
  }
  const halo = moon.getObjectByName("moon-illuminated-halo");
  assert.ok(halo instanceof THREE.Mesh);
  assert.equal(halo.renderOrder, -18, "atmosphere must remain able to occlude the aura");
});

test("WebGL lunar lighting converts astronomical sightlines into a locally visible phase", () => {
  const prominence = getCelestialProminence({ body: "moon", viewLayer: "air", supportedAircraftCount: 1, aboveHorizon: true });
  const moonSightline = new THREE.Vector3(0, 0.2, -1).normalize();
  const oppositeSun = moonSightline.clone().multiplyScalar(-1);
  const full = createLowPolyMoon(moonSightline, oppositeSun, "dark", prominence, false);
  const fullDirection = full.userData.illuminationDirection as THREE.Vector3;
  assert.ok(fullDirection.dot(moonSightline) < -0.999, "full-moon illumination must face the observer-facing surface normals");
  assert.ok((full.userData.illuminatedTowardObserver as number) > 0.999);

  const sameDirectionSun = moonSightline.clone();
  const newMoon = createLowPolyMoon(moonSightline, sameDirectionSun, "dark", prominence, false);
  const newDirection = newMoon.userData.illuminationDirection as THREE.Vector3;
  assert.ok(newDirection.dot(moonSightline) > 0.999, "new-moon illumination must face away instead of painting a dark disk");
  assert.ok((newMoon.userData.illuminatedTowardObserver as number) < -0.999);
});

test("moon water reflection follows illuminated brightness and vanishes at new moon", () => {
  const dark = createCelestialWaterReflection("moon", "night", "dark", new THREE.Vector3(0, 1, -1), 0);
  const crescent = createCelestialWaterReflection("moon", "night", "dark", new THREE.Vector3(0, 1, -1), 0.16);
  const full = createCelestialWaterReflection("moon", "night", "dark", new THREE.Vector3(0, 1, -1), 1);
  assert.equal(dark.children.length, 0, "an unlit moon cannot leave a luminous reflection");
  assert.equal(crescent.children.length, full.children.length);
  const crescentMaterial = (crescent.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial;
  const fullMaterial = (full.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial;
  assert.ok(crescentMaterial.opacity < fullMaterial.opacity);
  assert.equal(createCelestialWaterReflection("moon", "night", "dark", new THREE.Vector3(0, 1, -1), 0).children.length, 0, "reflection threshold is deterministic");
});
