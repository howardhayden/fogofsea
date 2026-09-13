import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { buildSceneContents, BATTLEFIELD_PALETTES } from "../app/battlefieldScene";
import { getDreamEmissionRuntime } from "../app/dreamEmission";
import { createAtmospherePlan, createAuroraPlan, createWaveFieldPlan } from "../app/environmentVisuals";
import { createStarfieldPlan } from "../app/starfield";
import { createContactVisualizationPlan } from "../app/contactVisualization";
import { createWildlifePlan, wildlifeForView } from "../app/wildlife";
import { getSubsurfaceLifeProfile } from "../app/viewModel";

const weather = { seed: 719, regionId: "austral-research-corridor", climate: "antarctic" as const, season: "summer", time: "night" as const,
  clouds: "clear" as const, precipitation: "none" as const, storming: false, windSpeed: 9, seaState: 2, visibility: 11, lightningCapable: false, windHeading: 0 };
const wildlifePlan = createWildlifePlan(weather);
const starfieldPlan = createStarfieldPlan({ seed: 1, theme: "dark", placements: [], visibleCount: 0 });
// The NDCG scope is entity enrollment; keep costly, unrelated celestial meshes out of this fixture.
starfieldPlan.stars = []; starfieldPlan.nebulae = [];

for (const viewLayer of ["surface", "subsurface", "air", "sky", "stars"] as const) {
  test(`scene ${viewLayer}: every admitted operational/biological entity uses the shared renderer`, () => {
    const scene = new THREE.Scene();
    const content = buildSceneContents({
      scene, colors: BATTLEFIELD_PALETTES.dark.night, theme: "dark", viewLayer,
      starfieldPlan, contactPlan: createContactVisualizationPlan(9, { surface: true, subsurface: true, air: true }, []),
      atmospherePlan: createAtmospherePlan(weather),
      auroraPlan: createAuroraPlan({ ...weather, latitude: -62 }),
      wavePlan: createWaveFieldPlan({ ...weather, waveHeading: 0, currentHeading: 0, currentSpeed: 1 }),
      time: "night", climate: "antarctic", region: "Austral research corridor", exerciseId: 719,
      lifeProfile: getSubsurfaceLifeProfile("antarctic", "Austral research corridor", 719), wildlifePlan,
      displayedFleet: { "fleet-aviation-ship": 1, "air-independent-submarine": 1, "long-endurance-submarine": 1 },
      displayedAirWing: { "maritime-mission-helicopter": 1, "fixed-wing-surveillance-aircraft": 1 }, result: null,
    });
    assert.equal(content.wildlife.length, wildlifeForView(wildlifePlan, viewLayer).length);
    for (const [kind, objects] of [["wildlife", content.wildlife], ["sea-creature", content.seaCreatures], ["aircraft", content.aircraft]] as const) {
      for (const object of objects) {
        const emission = getDreamEmissionRuntime(object); assert.ok(emission);
        assert.equal(emission.profile.kind, kind); assert.ok(emission.sources.length > 0);
        assert.ok(emission.sources.every(source => !source.mesh.name.includes("reaction")));
      }
    }
    for (const ship of content.ships) {
      const emission = getDreamEmissionRuntime(ship); assert.ok(emission); assert.ok(emission.sources.length > 0);
      assert.ok(emission.sources.every(source => source.mesh !== ship.userData.ring && source.mesh !== ship.userData.wake));
    }
    if (viewLayer === "subsurface") {
      assert.equal(content.aircraft.length, 0); assert.equal(content.ships.length, 2); assert.ok(content.seaCreatures.length > 0);
      assert.ok(content.ships.every(ship => getDreamEmissionRuntime(ship)?.profile.kind === "submarine"));
    }
    if (viewLayer !== "subsurface" && viewLayer !== "stars") {
      assert.equal(content.ships.length, 3); assert.equal(content.aircraft.length, 2);
      assert.equal(content.ships.filter(ship => getDreamEmissionRuntime(ship)?.profile.kind === "ship").length, 1);
      assert.equal(content.ships.filter(ship => getDreamEmissionRuntime(ship)?.profile.kind === "submarine").length, 2);
    }
    if (viewLayer === "stars") assert.equal(content.ships.length + content.aircraft.length + content.wildlife.length + content.seaCreatures.length, 0);
    scene.traverse(object => { if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.LineSegments) {
      object.geometry.dispose(); const materials = Array.isArray(object.material) ? object.material : [object.material]; materials.forEach(material => material.dispose());
    } });
  });
}


import { createWildlifeAvatar } from "../app/wildlifeAvatar";
import { attachDreamEmission, createDreamEmissionProfile } from "../app/dreamEmission";
import type { VisibleWildlife, WildlifeKind } from "../app/wildlife";
for (const kind of ["penguin", "seal", "whale", "dolphin", "shark", "seabird", "shorebird"] as const) {
  test(`actual ${kind} anatomy emits without reaction motes or oversized hit targets`, () => {
    const plan: VisibleWildlife = { id: kind, groupId: kind, kind: kind as WildlifeKind, label: kind,
      medium: kind.includes("bird") ? "air" : kind === "penguin" ? "ice" : "subsurface", behavior: "swimming",
      x: 0, y: 0, z: 0, depth: 3, scale: .4, heading: 0, phase: 0, speed: 1, radius: 1,
      routeEccentricity: .4, routeDirection: 1, restingPose: false };
    const animal = createWildlifeAvatar(plan, "dark");
    const allMeshes = animal.getObjectsByProperty("isMesh", true).length;
    attachDreamEmission(animal, createDreamEmissionProfile(73, "night", "wildlife"));
    const runtime = getDreamEmissionRuntime(animal)!;
    assert.ok(runtime.sources.length > 1); assert.ok(runtime.sources.length < allMeshes);
    assert.ok(runtime.sources.every(source => !/reaction|hit-target/.test(source.mesh.name)));
    assert.ok(runtime.sources.every(source => source.materials.some(material => material.colorWrite)));
  });
}
