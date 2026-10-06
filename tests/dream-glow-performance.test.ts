import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as THREE from "three";
import { DreamGlowRenderer } from "../app/dreamGlowRenderer";
import { attachDreamEmission, createDreamEmissionProfile, detachDreamEmission } from "../app/dreamEmission";
import { advanceRenderDeadline } from "../app/visualPerformance";

// No GL is needed to verify retained-resource ownership and disposal here. The
// focused browser fixture separately exercises live shader compilation plus
// core and outside-support framebuffer identity, not actual-scene equivalence.
function stubRenderer(): THREE.WebGLRenderer {
  return { extensions: { has: () => true }, capabilities: { maxSamples: 4 },
    getContext: () => ({ getContextAttributes: () => ({ alpha: true }) }),
  } as unknown as THREE.WebGLRenderer;
}

function renderPathStub(render: (scene: THREE.Scene, camera: THREE.Camera) => void): THREE.WebGLRenderer {
  let target: THREE.WebGLRenderTarget | null = null;
  const viewport = new THREE.Vector4(0, 0, 96, 64);
  const scissor = viewport.clone();
  const clearColor = new THREE.Color(0x102030);
  let clearAlpha = 1;
  let scissorTest = false;
  return {
    extensions: { has: () => true },
    capabilities: { maxSamples: 4, maxTextureSize: 4096 },
    outputColorSpace: THREE.SRGBColorSpace,
    autoClear: true,
    toneMapping: THREE.NoToneMapping,
    getContext: () => ({ getContextAttributes: () => ({ alpha: true }), getError: () => 0, NO_ERROR: 0 }),
    getDrawingBufferSize: (value: THREE.Vector2) => value.set(96, 64),
    getRenderTarget: () => target,
    setRenderTarget: (value: THREE.WebGLRenderTarget | null) => { target = value; },
    getViewport: (value: THREE.Vector4) => value.copy(viewport),
    setViewport: (value: THREE.Vector4) => { viewport.copy(value); },
    getScissor: (value: THREE.Vector4) => value.copy(scissor),
    setScissor: (value: THREE.Vector4) => { scissor.copy(value); },
    getScissorTest: () => scissorTest,
    setScissorTest: (value: boolean) => { scissorTest = value; },
    getClearColor: (value: THREE.Color) => value.copy(clearColor),
    setClearColor: (value: THREE.ColorRepresentation, alpha?: number) => {
      clearColor.set(value);
      if (alpha !== undefined) clearAlpha = alpha;
    },
    getClearAlpha: () => clearAlpha,
    clear: () => {},
    render,
  } as unknown as THREE.WebGLRenderer;
}

function addEmptyGlowSubject(renderer: DreamGlowRenderer) {
  Reflect.get(renderer, "subjects").push({
    root: new THREE.Group(),
    runtime: {},
    scene: new THREE.Scene(),
    parts: [],
    captureRect: new THREE.Vector4(),
    sourceBounds: new THREE.Vector4(),
  });
}

test("PERF-GLOW-01: scene replacement retains GPU-target and full-screen-material ownership", () => {
  const renderer = new DreamGlowRenderer(stubRenderer(), []);
  const retained = ["base", "emission", "accumulation", "glowMaterial", "compositeMaterial"];
  const resources = retained.map((key) => Reflect.get(renderer, key));
  const disposal = resources.map(() => 0);
  resources.forEach((resource, index) => resource.addEventListener("dispose", () => { disposal[index]++; }));
  for (let i = 0; i < 25; i++) {
    const group = new THREE.Group();
    const geometry = new THREE.BoxGeometry(1, 0.2, 3);
    const material = new THREE.MeshStandardMaterial({ color: 0x538781, metalness: 0.4, roughness: 0.3 });
    group.add(new THREE.Mesh(geometry, material));
    attachDreamEmission(group, createDreamEmissionProfile(i, "night", "ship"));
    renderer.setSubjects([group]);
    assert.equal(Reflect.get(renderer, "subjects").length, 1);
    renderer.clearSubjects();
    assert.equal(Reflect.get(renderer, "subjects").length, 0);
    resources.forEach((resource, index) => assert.equal(Reflect.get(renderer, retained[index]), resource));
    assert.deepEqual(disposal, [0, 0, 0, 0, 0]);
    detachDreamEmission(group); geometry.dispose(); material.dispose();
  }
  renderer.dispose(); renderer.dispose();
  assert.deepEqual(disposal, [1, 1, 1, 1, 1]);
  assert.throws(() => renderer.setSubjects([]), /disposed/);
});

test("PERF-GLOW-01A: the depth-only scene target does not resolve unused half-float color", () => {
  const renderer = new DreamGlowRenderer(stubRenderer(), []);
  assert.equal(Reflect.get(renderer, "base").texture.type, THREE.UnsignedByteType);
  assert.equal(Reflect.get(renderer, "emission").texture.type, THREE.HalfFloatType);
  assert.equal(Reflect.get(renderer, "accumulation").texture.type, THREE.HalfFloatType);
  renderer.dispose();
});

for (const hz of [60, 90, 120]) test(`PERF-GLOW-02: quantized ${hz} Hz callbacks retain a 30 Hz render phase`, () => {
  const frames: number[] = []; let next = 0;
  for (let i = 1; i <= hz * 20; i++) {
    const timestamp = Math.round(i * 1000 / hz);
    if (timestamp + 1 < next) continue;
    next = advanceRenderDeadline(next, Math.max(timestamp, next), 30);
    frames.push(timestamp);
  }
  assert.ok(Math.abs(frames.length - 600) <= 1);
  assert.ok(Math.max(...frames.slice(1).map((t, i) => t - frames[i])) <= 35);
});

test("PERF-GLOW-03: a stalled/background frame skips missed deadlines, not a burst of catch-up draws", () => {
  const next = advanceRenderDeadline(100, 10000, 30);
  assert.ok(next > 10000 && next <= 10000 + 1000 / 30 + 1e-9);
});

test("PERF-GLOW-06: non-depth-writing stars skip only the discarded depth pass", () => {
  const renderer = readFileSync(new URL("../app/dreamGlowRenderer.ts", import.meta.url), "utf8");
  const battlefield = readFileSync(new URL("../app/Battlefield.tsx", import.meta.url), "utf8");
  const depthTarget = renderer.indexOf("renderer.setRenderTarget(this.base)");
  const hideStars = renderer.indexOf("nonDepthWritingStars.visible = false", depthTarget);
  const depthRender = renderer.indexOf("renderer.render(scene, camera)", hideStars);
  const restoreStars = renderer.indexOf("nonDepthWritingStars.visible = starsVisible", depthRender);
  const displayRender = renderer.indexOf("renderer.render(scene, camera)", restoreStars);
  assert.ok(depthTarget >= 0 && depthTarget < hideStars);
  assert.ok(hideStars < depthRender && depthRender < restoreStars && restoreStars < displayRender);
  assert.match(renderer.slice(depthTarget, restoreStars + 80), /try[\s\S]*finally/);
  assert.match(battlefield, /prepareStarfieldForCamera\(starfield, camera\);\s*dreamGlow\.render\(scene, camera, starfield\?\.root\);/);
});

test("PERF-GLOW-06A: the depth pass restores the exact prior star visibility before display rendering", () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const stars = new THREE.Group();
  scene.add(stars);
  const visibility: boolean[] = [];
  const renderer = new DreamGlowRenderer(renderPathStub((renderedScene) => {
    if (renderedScene === scene) visibility.push(stars.visible);
  }), []);
  addEmptyGlowSubject(renderer);
  renderer.render(scene, camera, stars);
  assert.deepEqual(visibility, [false, true]);
  assert.equal(stars.visible, true);
  renderer.dispose();

  stars.visible = false;
  const failing = new DreamGlowRenderer(renderPathStub(() => { throw new Error("depth render failed"); }), []);
  addEmptyGlowSubject(failing);
  assert.throws(() => failing.render(scene, camera, stars), /depth render failed/);
  assert.equal(stars.visible, false);
  failing.dispose();
});

test("PERF-GLOW-07: covered fallbacks return on context loss and steady frames avoid unchanged dataset writes", () => {
  const battlefield = readFileSync(new URL("../app/Battlefield.tsx", import.meta.url), "utf8");
  assert.match(battlefield, /function setDatasetIfChanged[\s\S]*element\.dataset\[key\] !== value/);
  assert.match(battlefield, /let contextLost = renderer\.getContext\(\)\.isContextLost\(\);[\s\S]*markContextUnavailable[\s\S]*"webgl", "unavailable"[\s\S]*delete container\.dataset\.renderedLayer/);
  assert.match(battlefield, /onWebGLContextRestored[\s\S]*contextLost = false[\s\S]*"webgl", "initializing"[\s\S]*renderAfterContextRestore\(\)/);
  assert.match(battlefield, /if \(contextLost\) \{ lastPresentationFrame = null; return; \}[\s\S]*renderer\.getContext\(\)\.isContextLost\(\)[\s\S]*markContextUnavailable\(\)[\s\S]*if \(document\.hidden \|\| !container\.clientWidth \|\| !container\.clientHeight\) \{ lastPresentationFrame = null; return; \}/);
  assert.match(battlefield, /trackRestoredContext[\s\S]*rendererContextGeneration\.current \+= 1/);
  assert.match(battlefield, /syncDreamGlowContext[\s\S]*handleContextRestored\(\)[\s\S]*dreamGlowContextGeneration\.current = rendererContextGeneration\.current/);
  assert.match(battlefield, /renderAfterContextRestore = \(\) => \{[\s\S]*syncDreamGlowContext\(\)[\s\S]*renderFrame\(performance\.now\(\), true\)/);
  const displayRender = battlefield.indexOf("dreamGlow.render(scene, camera, starfield?.root)");
  const restoredReady = battlefield.indexOf('setDatasetIfChanged(container, "webgl", "ready")', displayRender);
  assert.ok(displayRender >= 0 && restoredReady > displayRender, "the restored canvas becomes ready only after a completed frame");
  for (const key of ["fogDensity", "dreamGlowProfile", "dreamGlowSources", "renderedLayer", "renderedTheme"]) {
    assert.match(battlefield, new RegExp(`setDatasetIfChanged\\(container, "${key}"`));
  }
});

test("PERF-GLOW-08: context restoration clears only transient framebuffer-copy failures", () => {
  const renderer = new DreamGlowRenderer(stubRenderer(), []);
  Reflect.set(renderer, "displayCopyVerified", true);
  Reflect.set(renderer, "displayCopyFailed", true);
  renderer.handleContextRestored();
  assert.equal(Reflect.get(renderer, "displayCopyVerified"), false);
  assert.equal(Reflect.get(renderer, "displayCopyFailed"), false);
  assert.equal(renderer.status, "off");
  renderer.dispose();
});

test("PERF-GLOW-09: early rejection bounds enclose all transformed native source vertices", () => {
  const nativeRenderer = stubRenderer();
  nativeRenderer.capabilities.maxTextureSize = 4096;
  const group = new THREE.Group();
  const hull = new THREE.BoxGeometry(3.2, 0.3, 0.55);
  const wing = new THREE.BoxGeometry(0.45, 0.06, 2.3);
  const material = new THREE.MeshStandardMaterial({ color: 0x70b3ae });
  group.add(new THREE.Mesh(hull, material));
  const articulated = new THREE.Mesh(wing, material);
  articulated.position.set(-0.1, 0.2, 0);
  group.add(articulated);
  attachDreamEmission(group, createDreamEmissionProfile(41, "night", "aircraft"));
  const pipeline = new DreamGlowRenderer(nativeRenderer, [group]);
  Reflect.get(pipeline, "fullSize").set(640, 480);
  const subject = Reflect.get(pipeline, "subjects")[0];
  const prepare = Reflect.get(pipeline, "prepareSubject").bind(pipeline);
  const camera = new THREE.PerspectiveCamera(42, 4 / 3, 0.1, 100);
  for (const distance of [4.5, 10]) for (const yaw of [0, 0.8, 1.6]) {
    camera.position.set(0, distance * 0.3, distance);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    group.position.x = 0.3;
    group.rotation.y = yaw;
    articulated.rotation.x = yaw * 0.2;
    group.updateMatrixWorld(true);
    assert.ok(prepare(subject, camera) > 0);
    assert.ok(subject.nearestDepth > camera.near);
    for (const mesh of [group.children[0] as THREE.Mesh, articulated]) {
      const positions = mesh.geometry.getAttribute("position");
      for (let i = 0; i < positions.count; i++) {
        const vertex = new THREE.Vector3().fromBufferAttribute(positions, i)
          .applyMatrix4(mesh.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
        assert.ok(-vertex.z >= subject.nearestDepth - 1e-9, "no emitted source may be closer than the conservative depth bound");
        vertex.applyMatrix4(camera.projectionMatrix);
        const x = (vertex.x * 0.5 + 0.5) * 640;
        const y = (vertex.y * 0.5 + 0.5) * 480;
        assert.ok(x >= subject.sourceBounds.x + 1 && x <= subject.sourceBounds.z - 1);
        assert.ok(y >= subject.sourceBounds.y + 1 && y <= subject.sourceBounds.w - 1);
      }
    }
  }
  pipeline.dispose(); detachDreamEmission(group);
  hull.dispose(); wing.dispose(); material.dispose();
});

test("PERF-GLOW-10: replacing scenes reuses capture programs and releases prior source texture references", () => {
  const nativeRenderer = stubRenderer();
  const pipeline = new DreamGlowRenderer(nativeRenderer, []);
  const geometry = new THREE.BoxGeometry(1, 0.2, 3);
  const texture = new THREE.Texture();
  const alphaMap = new THREE.Texture();
  const firstMaterial = new THREE.MeshBasicMaterial({
    color: 0x538781, map: texture, alphaMap, alphaTest: 0.25,
    opacity: 0.8, vertexColors: true, side: THREE.DoubleSide, fog: false,
  });
  const nextMaterial = new THREE.MeshBasicMaterial({ color: 0x8276ac, opacity: 0.6 });
  const makeGroup = (material: THREE.MeshBasicMaterial, count: number) => {
    const group = new THREE.Group();
    for (let i = 0; i < count; i++) group.add(new THREE.Mesh(geometry, material));
    attachDreamEmission(group, createDreamEmissionProfile(count, "night", "ship"));
    return group;
  };
  const first = makeGroup(firstMaterial, 3);
  const next = makeGroup(nextMaterial, 1);
  pipeline.setSubjects([first]);
  const materials = Reflect.get(pipeline, "subjects")[0].parts.map((part: { material: THREE.MeshBasicMaterial }) => part.material) as THREE.MeshBasicMaterial[];
  const disposal = materials.map(() => 0);
  materials.forEach((material, index) => material.addEventListener("dispose", () => { disposal[index]++; }));
  const uniforms = { map: { value: texture as THREE.Texture | null }, alphaMap: { value: alphaMap as THREE.Texture | null } };
  materials[0].onBeforeCompile({
    uniforms, fragmentShader: "#include <common>\n#include <fog_fragment>\n#include <opaque_fragment>",
  } as unknown as Parameters<THREE.Material["onBeforeCompile"]>[0], nativeRenderer);
  for (let i = 0; i < 20; i++) {
    pipeline.setSubjects([next]);
    const replacement = Reflect.get(pipeline, "subjects")[0].parts[0].material as THREE.MeshBasicMaterial;
    assert.equal(replacement, materials[0], "capture material keeps its renderer-owned program cache");
    assert.equal(replacement.color.getHex(), nextMaterial.color.getHex());
    assert.equal(replacement.opacity, nextMaterial.opacity);
    assert.equal(replacement.map, null);
    assert.equal(replacement.alphaMap, null);
    assert.equal(replacement.alphaTest, 0);
    assert.equal(replacement.vertexColors, false);
    assert.equal(replacement.side, THREE.FrontSide);
    assert.equal(replacement.fog, true);
    assert.equal(uniforms.map.value, null);
    assert.equal(uniforms.alphaMap.value, null);
    pipeline.setSubjects([first]);
    const restored = Reflect.get(pipeline, "subjects")[0].parts;
    assert.deepEqual(restored.map((part: { material: THREE.MeshBasicMaterial }) => part.material), materials);
    assert.equal(materials[0].map, texture);
    assert.equal(materials[0].alphaMap, alphaMap);
    assert.equal(materials[0].alphaTest, 0.25);
    assert.equal(materials[0].vertexColors, true);
    assert.equal(materials[0].side, THREE.DoubleSide);
    assert.equal(materials[0].fog, false);
    assert.equal(Reflect.get(pipeline, "captureMaterials").length, 3, "pool is bounded by the peak simultaneous source count");
  }
  pipeline.clearSubjects();
  assert.deepEqual(disposal, [0, 0, 0]);
  assert.ok(materials.every((material) => material.map === null && material.alphaMap === null));
  pipeline.dispose(); pipeline.dispose();
  assert.deepEqual(disposal, [1, 1, 1]);
  assert.equal(first.children.length, 3);
  assert.equal(firstMaterial.map, texture, "capture cleanup does not change native source materials");
  detachDreamEmission(first); detachDreamEmission(next);
  geometry.dispose(); firstMaterial.dispose(); nextMaterial.dispose(); texture.dispose(); alphaMap.dispose();
});
