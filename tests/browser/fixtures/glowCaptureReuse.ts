import * as THREE from "three";
import { attachDreamEmission, createDreamEmissionProfile, detachDreamEmission } from "../../../app/dreamEmission";
import { DreamGlowRenderer } from "../../../app/dreamGlowRenderer";

/** Real GL regression: recurring source variants keep their compiled programs
 * and render the same pixels as a freshly constructed capture pipeline. */
export function runGlowCaptureReuseFixture() {
  const canvas = document.createElement("canvas");
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(192, 128, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const context = renderer.getContext();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x112936);
  scene.fog = new THREE.FogExp2(0x112936, 0.025);
  const camera = new THREE.PerspectiveCamera(42, 1.5, 0.1, 100);
  camera.position.set(0, 0.8, 5);
  camera.lookAt(0, 0, 0);
  const geometry = new THREE.BoxGeometry(1.8, 0.6, 0.5);
  const colors = new Float32Array(geometry.getAttribute("position").count * 3);
  colors.fill(0.75);
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const texture = new THREE.DataTexture(new Uint8Array([
    255, 192, 96, 255, 96, 255, 192, 255,
    192, 96, 255, 255, 255, 255, 255, 255,
  ]), 2, 2);
  texture.needsUpdate = true;
  const alphaMap = new THREE.DataTexture(new Uint8Array([
    255, 255, 255, 255, 255, 80, 255, 255,
    255, 180, 255, 255, 255, 255, 255, 255,
  ]), 2, 2);
  alphaMap.needsUpdate = true;
  const materials = [
    new THREE.MeshBasicMaterial({ color: 0x70b3ae }),
    new THREE.MeshBasicMaterial({ color: 0xba9484, map: texture, alphaMap, alphaTest: 0.4, side: THREE.DoubleSide }),
    new THREE.MeshBasicMaterial({ color: 0x8276ac, opacity: 0.7, transparent: true, vertexColors: true, fog: false }),
  ];
  const pipeline = new DreamGlowRenderer(renderer, []);
  const read = () => {
    const pixels = new Uint8Array(192 * 128 * 4);
    context.readPixels(0, 0, 192, 128, context.RGBA, context.UNSIGNED_BYTE, pixels);
    return pixels;
  };
  const programIds = () => renderer.info.programs!.map((program) => program.id).sort((a, b) => a - b);
  const records = [];
  let warmedPrograms: number[] = [];
  for (let iteration = 0; iteration < 9; iteration++) {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(geometry, materials[iteration % materials.length]));
    scene.add(group);
    attachDreamEmission(group, createDreamEmissionProfile(41, "night", "ship"));
    pipeline.setSubjects([group]);
    pipeline.render(scene, camera);
    const reused = read();
    const freshPipeline = new DreamGlowRenderer(renderer, [group]);
    freshPipeline.render(scene, camera);
    const fresh = read();
    freshPipeline.dispose();
    let changedChannels = 0;
    let maximumDifference = 0;
    for (let index = 0; index < fresh.length; index++) {
      const difference = Math.abs(reused[index] - fresh[index]);
      if (difference) changedChannels++;
      maximumDifference = Math.max(maximumDifference, difference);
    }
    const programsBeforeClear = programIds();
    pipeline.clearSubjects();
    if (iteration === 2) warmedPrograms = programIds();
    records.push({ iteration, changedChannels, maximumDifference, programsBeforeClear, programs: programIds(), error: context.getError() });
    scene.remove(group);
    detachDreamEmission(group);
  }
  pipeline.dispose();
  geometry.dispose();
  materials.forEach((material) => material.dispose());
  texture.dispose(); alphaMap.dispose();
  renderer.dispose(); renderer.forceContextLoss();
  return { warmedPrograms, records };
}
