import * as THREE from "three";
import { attachDreamEmission, createDreamEmissionProfile, updateDreamEmission, type DreamEmissionKind } from "../../../app/dreamEmission";
import { DreamGlowRenderer } from "../../../app/dreamGlowRenderer";

export type FixtureOptions = {
  height?: number; dpr?: number; kind?: DreamEmissionKind; block?: "source" | "destination"; hidden?: boolean;
  x?: number; parts?: boolean; gap?: boolean; transparent?: boolean; elapsed?: number; reduced?: boolean;
};

export function fixture(options: FixtureOptions = {}) {
  const h = options.height ?? 128; const dpr = options.dpr ?? 1;
  const size = 360; const physical = size * dpr;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(dpr); renderer.setSize(size, size);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  const canvas = renderer.domElement; document.body.replaceChildren(canvas);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0, 0, 0);
  const camera = new THREE.OrthographicCamera(-size / 2, size / 2, size / 2, -size / 2, .1, 100);
  camera.position.z = 10;
  const group = new THREE.Group(); group.position.x = options.x ?? 0;
  const color = new THREE.Color(.4, .2, .1);
  const make = (width: number, x: number, c = color) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, h), new THREE.MeshBasicMaterial({ color: c, transparent: options.transparent, opacity: options.transparent ? .5 : 1 }));
    mesh.position.x = x; return mesh;
  };
  if (options.parts) group.add(make(h / 2, -h / 4), make(h / 2, h / 4, new THREE.Color(.05, .2, .4)));
  else group.add(make(h, 0));
  attachDreamEmission(group, createDreamEmissionProfile(7, "night", options.kind ?? "ship")); scene.add(group);
  if (options.hidden) group.visible = false;
  const groups = [group];
  if (options.gap) {
    group.position.x = -h * .55;
    const other = new THREE.Group(); other.add(make(h, 0)); other.position.x = h * .55;
    attachDreamEmission(other, createDreamEmissionProfile(7, "night", "ship")); groups.push(other); scene.add(other);
  }
  if (options.block) {
    const block = new THREE.Mesh(new THREE.PlaneGeometry(options.block === "source" ? h * 2 : h, h * 2), new THREE.MeshBasicMaterial({ color: 0x010203 }));
    block.position.z = 2; block.position.x = options.block === "source" ? 0 : h;
    scene.add(block);
  }
  updateDreamEmission(groups, options.elapsed ?? 0, options.reduced ?? true);
  const glow = new DreamGlowRenderer(renderer, groups);
  const target = new THREE.WebGLRenderTarget(physical, physical, { type: THREE.FloatType, depthBuffer: true });
  target.texture.colorSpace = THREE.LinearSRGBColorSpace;
  const read = (on: boolean) => {
    renderer.setRenderTarget(target); renderer.setViewport(0, 0, size, size);
    glow.enabled = on; glow.render(scene, camera);
    const data = new Float32Array(physical * physical * 4);
    renderer.readRenderTargetPixels(target, 0, 0, physical, physical, data); return data;
  };
  const baseline = read(false); const pixels = read(true);
  const gl = renderer.getContext(); const error = gl.getError();
  const samples = Array.from({ length: Math.ceil(h * .25 * dpr) }, (_, i) => {
    const x = Math.floor((size / 2 + (options.x ?? 0) + h / 2) * dpr) + i;
    const y = Math.floor(size / 2 * dpr);
    const offset = (y * physical + x) * 4;
    return { d: (i + .5) / (h * dpr), r: pixels[offset] - baseline[offset], g: pixels[offset + 1] - baseline[offset + 1], b: pixels[offset + 2] - baseline[offset + 2] };
  });
  let interiorMax = 0; let outsideMax = 0; let sum = 0;
  for (let y = 0; y < physical; y++) for (let x = 0; x < physical; x++) {
    const offset = (y * physical + x) * 4;
    const delta = Math.max(Math.abs(pixels[offset] - baseline[offset]), Math.abs(pixels[offset + 1] - baseline[offset + 1]), Math.abs(pixels[offset + 2] - baseline[offset + 2]));
    const inCore = Math.abs(x + .5 - (size / 2 + (options.x ?? 0)) * dpr) < h * dpr / 2 - 2 && Math.abs(y + .5 - size / 2 * dpr) < h * dpr / 2 - 2;
    if (inCore) interiorMax = Math.max(interiorMax, delta); else outsideMax = Math.max(outsideMax, delta);
    sum += delta;
  }
  const at = (x: number, y: number) => {
    const offset = (Math.floor((size / 2 + y) * dpr) * physical + Math.floor((size / 2 + x) * dpr)) * 4;
    return Array.from(pixels.slice(offset, offset + 3)).map((v, i) => v - baseline[offset + i]);
  };
  const center = at(0, 0); const destination = at(h * .55, 0);
  renderer.setRenderTarget(null); glow.render(scene, camera);
  const screenshot = canvas.toDataURL(); const diagnostics = { ...glow.diagnostics };
  glow.dispose(); glow.dispose(); target.dispose(); renderer.dispose(); renderer.forceContextLoss();
  scene.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); (object.material as THREE.Material).dispose(); } });
  return { samples, error, interiorMax, outsideMax, sum, center, destination, diagnostics, screenshot };
}
