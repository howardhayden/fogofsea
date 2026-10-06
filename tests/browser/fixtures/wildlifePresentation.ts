import * as THREE from "three";
import { createWildlifeIceSupports } from "../../../app/battlefieldScene";
import { createWaveFieldPlan } from "../../../app/environmentVisuals";
import { createWildlifePlan, wildlifeForView } from "../../../app/wildlife";
import { createWildlifeAvatar, updateWildlifeAvatars } from "../../../app/wildlifeAvatar";

/** Render the actual articulated squad and actual supporting floe close enough
 * for visual review. This uses the same rig and clock sampler as Battlefield. */
export function renderWildlifePresentation() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(800, 600, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x173a4a);
  scene.add(new THREE.HemisphereLight(0xeaf5ff, 0x526678, 2));
  const light = new THREE.DirectionalLight(0xfff1dc, 2);
  light.position.set(4, 12, 7);
  scene.add(light);
  const plan = createWildlifePlan({ seed: 719, regionId: "austral-research-corridor", climate: "antarctic", season: "summer", time: "day", clouds: "clear", precipitation: "none", storming: false, windSpeed: 9, seaState: 2, visibility: 11 });
  const members = wildlifeForView(plan, "surface").filter((member) => member.kind === "penguin");
  const supports = createWildlifeIceSupports(scene, members, "dark");
  const support = supports.get(members[0].groupId)!;
  const animals = members.map((member) => {
    const animal = createWildlifeAvatar(member, "dark");
    Object.assign(animal.userData, { support, baseX: support.x, baseY: support.topY, baseZ: support.z });
    scene.add(animal);
    return animal;
  });
  const camera = new THREE.PerspectiveCamera(35, 4 / 3, 0.1, 100);
  camera.position.set(support.x + 5, 5.8, support.z + 7);
  camera.lookAt(support.x, 0.2, support.z);
  const wave = createWaveFieldPlan({ seed: 719, seaState: 2, storming: false, precipitation: "none", climate: "antarctic", waveHeading: 45, windHeading: 45, windSpeed: 9, currentHeading: 90, currentSpeed: 1 });
  const capture = (elapsed: number, reducedMotion: boolean) => {
    updateWildlifeAvatars(animals, wave, elapsed, reducedMotion);
    renderer.render(scene, camera);
    return {
      elapsed,
      phases: [...new Set(animals.map((animal) => String(animal.userData.groupActivity)))],
      png: renderer.domElement.toDataURL("image/png").split(",")[1],
      drawCalls: renderer.info.render.calls,
      geometries: renderer.info.memory.geometries,
      programs: renderer.info.programs?.length ?? 0,
      error: renderer.getContext().getError(),
    };
  };
  try {
    const frames = [9, 18, 33, 38, 50, 61].map((time) => capture(time, false));
    const still = [capture(0, true), capture(120, true)];
    return { individuals: animals.length, supports: supports.size, frames, still };
  } finally {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    renderer.dispose();
    renderer.forceContextLoss();
  }
}
