import * as THREE from "three";
import { attachDreamEmission, createDreamEmissionProfile, detachDreamEmission, type DreamEmissionTime } from "../../../app/dreamEmission";
import { DreamGlowRenderer } from "../../../app/dreamGlowRenderer";

export function probeGlowScene(time: DreamEmissionTime, alpha: boolean, pixelRatio = 1.8) {
  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  const context = canvas.getContext("webgl2", { alpha, antialias: true, preserveDrawingBuffer: false });
  if (!context) { canvas.remove(); return { time, alpha, available: false }; }
  const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true, alpha: false });
  renderer.setPixelRatio(pixelRatio); renderer.setSize(400, 300, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const backgrounds = { dawn: 0x5c5059, day: 0x667d83, dusk: 0x493e52, night: 0x101827 };
  scene.background = new THREE.Color(backgrounds[time]);
  scene.add(new THREE.HemisphereLight(0xc9e5e5, 0x17364a, 2));
  const key = new THREE.DirectionalLight(0xffffff, 3); key.position.set(-2, 3, 5); scene.add(key);
  const camera = new THREE.PerspectiveCamera(42, 4 / 3, 0.1, 100); camera.position.set(0, 2, 8); camera.lookAt(0, 0, 0);
  const group = new THREE.Group();
  const geometry = new THREE.SphereGeometry(0.9, 24, 16);
  const material = new THREE.MeshStandardMaterial({ color: 0x83aaa3, roughness: 0.25, metalness: 0.45 });
  const core = new THREE.Mesh(geometry, material); group.add(core); scene.add(group);
  const beforeEmissive = { color: material.emissive.getHex(), intensity: material.emissiveIntensity };
  attachDreamEmission(group, createDreamEmissionProfile(41, time, "ship"));
  const pipeline = new DreamGlowRenderer(renderer, [group]);
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const read = () => { const pixels = new Uint8Array(size.x * size.y * 4); context.readPixels(0, 0, size.x, size.y, context.RGBA, context.UNSIGNED_BYTE, pixels); return pixels; };
  const failures: number[] = [];
  const copy = renderer.copyFramebufferToTexture.bind(renderer);
  renderer.copyFramebufferToTexture = (...args) => { copy(...args); failures.push(context.getError()); };
  renderer.render(scene, camera); const before = read(); const beforeCapture = canvas.toDataURL("image/png");
  pipeline.render(scene, camera); const after = read(); const afterCapture = canvas.toDataURL("image/png");
  const readError = context.getError();
  const rgb = (p: Uint8Array, x: number, y: number) => Array.from(p.slice((Math.floor(y) * size.x + Math.floor(x)) * 4, (Math.floor(y) * size.x + Math.floor(x)) * 4 + 3));
  const beforeCore = rgb(before, size.x / 2, size.y / 2); const afterCore = rgb(after, size.x / 2, size.y / 2);
  const beforeBackground = rgb(before, 12, 12); const afterBackground = rgb(after, 12, 12);
  let darkenedPixels = 0; let litPixels = 0;
  for (let i = 0; i < before.length; i += 4) {
    if (after[i] + after[i + 1] + after[i + 2] < before[i] + before[i + 1] + before[i + 2] - 3) darkenedPixels++;
    if (after[i] + after[i + 1] + after[i + 2] > 12) litPixels++;
  }
  const status = pipeline.status;
  const actualContextAlpha = context.getContextAttributes()?.alpha;
  const productionMaterialPreserved = core.material === material;
  const activeMaterial = core.material instanceof THREE.MeshStandardMaterial ? core.material : null;
  const afterEmissive = activeMaterial
    ? { color: activeMaterial.emissive.getHex(), intensity: activeMaterial.emissiveIntensity }
    : null;
  pipeline.dispose(); detachDreamEmission(group); geometry.dispose(); material.dispose(); renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
  return { time, alpha, pixelRatio, available: true, status, actualContextAlpha, beforeCore, afterCore, beforeBackground, afterBackground, darkenedPixels, litPixels, totalPixels: size.x * size.y, failures, readError, productionMaterialPreserved, beforeEmissive, afterEmissive, beforeCapture, afterCapture };
}
