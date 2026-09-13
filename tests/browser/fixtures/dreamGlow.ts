import * as THREE from "three";
import { attachDreamEmission, createDreamEmissionProfile, detachDreamEmission, updateDreamEmission, type DreamEmissionKind, type DreamEmissionRuntime } from "../../../app/dreamEmission";
import { DreamGlowRenderer } from "../../../app/dreamGlowRenderer";
import { projectedGlowReference } from "../../../app/dreamGlowMath";

function decode(byte: number): number {
  const c = byte / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Browser-only fixture. Not imported by the application or production build. */
export function runDreamGlowFixture(kind: DreamEmissionKind, pixelRatio: number) {
  const canvas = document.createElement("canvas");
  canvas.id = "dream-glow-fixture";
  canvas.style.cssText = "position:fixed;left:0;top:0;z-index:2147483647;width:256px;height:256px";
  document.body.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(256, 256, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.z = 10;
  const group = new THREE.Group();
  const colors = { ship: [0.3, 0.6, 0.4], submarine: [0.2, 0.35, 0.5], aircraft: [0.4, 0.15, 0.25], creature: [0.6, 0.5, 0.15] } as const;
  const sourceColor = colors[kind];
  const native = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(sourceColor[0], sourceColor[1], sourceColor[2]), side: THREE.DoubleSide });
  const geometry = new THREE.PlaneGeometry(2, 3);
  const core = new THREE.Mesh(geometry, native);
  group.add(core); scene.add(group);
  attachDreamEmission(group, createDreamEmissionProfile(41, "night", kind));
  updateDreamEmission([group], 0, true);
  const pipeline = new DreamGlowRenderer(renderer, [group]);
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const gl = renderer.getContext();
  const read = () => {
    const data = new Uint8Array(size.x * size.y * 4);
    gl.readPixels(0, 0, size.x, size.y, gl.RGBA, gl.UNSIGNED_BYTE, data);
    return data;
  };
  const pixel = (data: Uint8Array, x: number, y: number) => Array.from(data.slice((Math.floor(y) * size.x + Math.floor(x)) * 4, (Math.floor(y) * size.x + Math.floor(x)) * 4 + 3));
  renderer.render(scene, camera);
  const baseline = read();
  pipeline.render(scene, camera);
  const illuminated = read();
  const status = pipeline.status;
  const renderedSubjects = pipeline.renderedSubjects;
  const runtime = group.userData.dreamEmission as DreamEmissionRuntime;
  const reference = projectedGlowReference(runtime.referenceSphere.radius * 2, 10, camera.projectionMatrix.elements[5], size.y);
  const edge = (new THREE.Vector3(1, 0, 0).project(camera).x * 0.5 + 0.5) * size.x;
  const sample = (distance: number) => {
    const x = Math.min(size.x - 2, edge + distance * reference - 0.5);
    const left = Math.floor(x); const fraction = x - left;
    const beforeLeft = pixel(baseline, left, size.y / 2); const beforeRight = pixel(baseline, left + 1, size.y / 2);
    const afterLeft = pixel(illuminated, left, size.y / 2); const afterRight = pixel(illuminated, left + 1, size.y / 2);
    return sourceColor.map((source, channel) => (
      (decode(afterLeft[channel]) - decode(beforeLeft[channel])) * (1 - fraction)
        + (decode(afterRight[channel]) - decode(beforeRight[channel])) * fraction
    ) / source);
  };
  const centerBefore = pixel(baseline, size.x / 2, size.y / 2);
  const centerAfter = pixel(illuminated, size.x / 2, size.y / 2);
  const centerDifference = Math.max(...centerBefore.map((value, index) => Math.abs(value - centerAfter[index])));
  const nearChannels = sample(0.01); const near = nearChannels[1]; const far = sample(0.10)[1];
  const hueSpread = Math.max(...nearChannels) - Math.min(...nearChannels);
  group.userData.dreamEmissionAuthorized = false;
  pipeline.render(scene, camera);
  const unauthorized = read();
  const forbiddenPixel = pixel(unauthorized, edge + 0.02 * reference, size.y / 2);
  delete group.userData.dreamEmissionAuthorized;
  const blockerGeometry = new THREE.PlaneGeometry(20, 20);
  const blockerMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const blocker = new THREE.Mesh(blockerGeometry, blockerMaterial);
  blocker.position.z = 2; scene.add(blocker);
  pipeline.render(scene, camera);
  const blocked = read();
  const occludedMaximum = blocked.reduce((maximum, value, index) => index % 4 === 3 ? maximum : Math.max(maximum, value), 0);
  scene.remove(blocker);
  pipeline.render(scene, camera);
  const capture = canvas.toDataURL("image/png");
  const framebufferError = gl.getError();
  pipeline.dispose(); detachDreamEmission(group);
  geometry.dispose(); native.dispose(); blockerGeometry.dispose(); blockerMaterial.dispose();
  renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
  return { kind, pixelRatio, status, renderedSubjects, reference, near, far, hueSpread, centerDifference,
    unauthorizedExteriorMaximum: Math.max(...forbiddenPixel), occludedMaximum, framebufferError, capture };
}
