import * as THREE from "three";
import { attachDreamEmission, createDreamEmissionProfile, detachDreamEmission, type DreamEmissionKind, type DreamEmissionRuntime } from "../app/dreamEmission";
import { DreamGlowRenderer } from "../app/dreamGlowRenderer";
import { createShip, createAircraft, createSeaCreature } from "../app/battlefieldScene";
import { createWildlifeAvatar } from "../app/wildlifeAvatar";
import { createWildlifePlan, wildlifeForView } from "../app/wildlife";

export type RenderCase = { kind: string; occluder?: "full" | "half"; hidden?: boolean; dpr?: number; width?: number; height?: number };
function creature(kind: string) {
  const environment = { seed: 719, regionId: "austral-research-corridor", climate: "antarctic" as const, season: "summer", time: "day" as const, clouds: "clear" as const, precipitation: "none" as const, storming: false, windSpeed: 9, seaState: 2, visibility: 11 };
  const members = [
    ...wildlifeForView(createWildlifePlan(environment), "surface"),
    ...wildlifeForView(createWildlifePlan({ ...environment, regionId: "western-tropical-passage", climate: "ocean", season: "wet" }), "surface"),
    ...wildlifeForView(createWildlifePlan({ ...environment, regionId: "equatorial-convergence", climate: "ocean", season: "wet" }), "surface"),
  ];
  const member = members.find((member) => member.kind === kind);
  if (!member) throw new Error(`No real wildlife fixture for ${kind}`);
  return createWildlifeAvatar(member, "dark");
}
const decode = (v: number) => v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4;
function luminance(data: Uint8Array, index: number) { return decode(data[index]) * 0.2126 + decode(data[index + 1]) * 0.7152 + decode(data[index + 2]) * 0.0722; }

export function run(options: RenderCase) {
  const width = options.width ?? 512; const height = options.height ?? 384;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(options.dpr ?? 1); renderer.setSize(width, height); renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x080c16);
  scene.add(new THREE.AmbientLight(0xffffff, 1));
  let root: THREE.Group;
  let kind: DreamEmissionKind = "creature";
  if (options.kind === "ship") { root = createShip("fleet-aviation-ship", 0x83aaa3); kind = "ship"; }
  else if (options.kind === "submarine") { root = createShip("long-endurance-submarine", 0x466b72); kind = "submarine"; }
  else if (options.kind === "aircraft" || options.kind === "rotorcraft") { root = createAircraft(options.kind === "rotorcraft" ? "maritime-mission-helicopter" : "maritime-patrol-aircraft", 0x91b6af); kind = "aircraft"; }
  else if (options.kind === "sea-creature") root = createSeaCreature(1, 0x7da8aa, 1);
  else if (options.kind === "edge") {
    root = new THREE.Group(); root.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(0.1, 0.5, 0.3) })));
  } else root = creature(options.kind);
  root.position.set(0, 0, 0); root.rotation.set(0, 0, 0); scene.add(root);
  attachDreamEmission(root, { ...createDreamEmissionProfile(41, "night", kind), coreStrength: options.kind === "edge" ? 0 : 0.22 });
  scene.updateMatrixWorld(true);
  const runtime = root.userData.dreamEmission as DreamEmissionRuntime;
  const bounds = new THREE.Box3();
  for (const part of runtime.parts) bounds.union(part.mesh.geometry.boundingBox!.clone().applyMatrix4(part.mesh.matrixWorld));
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const span = options.kind === "edge" ? 8 : Math.max(size.x, size.y, size.z) * 2.4;
  const camera = new THREE.OrthographicCamera(-span / 2, span / 2, span * height / width / 2, -span * height / width / 2, 0.1, 100);
  camera.position.copy(center).add(new THREE.Vector3(0, options.kind === "edge" ? 0 : span * 0.25, span * 2)); camera.lookAt(center); camera.updateMatrixWorld(true);
  if (options.occluder) {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(options.occluder === "full" ? span * 2 : span, span * 2), new THREE.MeshBasicMaterial({ color: 0x192831 }));
    panel.quaternion.copy(camera.quaternion);
    panel.position.copy(center).add(camera.position.clone().sub(center).normalize().multiplyScalar(span * 0.8));
    if (options.occluder === "half") panel.position.x -= span * 0.5;
    scene.add(panel);
  }
  if (options.hidden) root.visible = false;
  const gl = renderer.getContext();
  const physical = renderer.getDrawingBufferSize(new THREE.Vector2());
  const read = () => { const pixels = new Uint8Array(physical.x * physical.y * 4); gl.readPixels(0, 0, physical.x, physical.y, gl.RGBA, gl.UNSIGNED_BYTE, pixels); return pixels; };
  renderer.render(scene, camera); const beforePixels = read(); const before = renderer.domElement.toDataURL();
  const pass = new DreamGlowRenderer(renderer, camera, [root]); pass.render(scene, camera); gl.finish();
  const start = performance.now(); pass.render(scene, camera); gl.finish(); const renderMs = performance.now() - start;
  const afterPixels = read(); const after = renderer.domElement.toDataURL();
  let changed = 0; let maximumDifference = 0; let leftChanged = 0;
  for (let index = 0; index < beforePixels.length; index += 4) {
    const delta = Math.abs(afterPixels[index] - beforePixels[index]) + Math.abs(afterPixels[index + 1] - beforePixels[index + 1]) + Math.abs(afterPixels[index + 2] - beforePixels[index + 2]);
    maximumDifference = Math.max(maximumDifference, delta);
    if (delta >= 6) { changed++; if ((index / 4) % physical.x < physical.x / 2 - 2) leftChanged++; }
  }
  const radialProfile = options.kind !== "edge" ? null : [0.01, 0.02, 0.05, 0.1].map((distance) => {
    const h = physical.x / 4;
    const x = Math.floor(physical.x / 2 + h / 2 + distance * h);
    const offset = (Math.floor(physical.y / 2) * physical.x + x) * 4;
    return { normalizedDistance: (x + 0.5 - physical.x / 2 - h / 2) / h, relativeLight: (luminance(afterPixels, offset) - luminance(beforePixels, offset)) / (0.1 * 0.2126 + 0.5 * 0.7152 + 0.3 * 0.0722) };
  });
  const result = { options, mode: pass.mode, registered: pass.subjects.length, rendered: pass.renderedSubjects,
    sourceParts: runtime.parts.length, changed, leftChanged, maximumDifference, radialProfile, renderMs, before, after,
    render: { ...renderer.info.render }, memory: { ...renderer.info.memory }, glError: gl.getError(),
  };
  pass.dispose(); detachDreamEmission(root);
  scene.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); const m = Array.isArray(o.material) ? o.material : [o.material]; m.forEach((v) => v.dispose()); } });
  renderer.dispose(); renderer.forceContextLoss();
  return result;
}
