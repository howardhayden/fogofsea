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
  assert.match(battlefield, /if \(contextLost\) return;[\s\S]*renderer\.getContext\(\)\.isContextLost\(\)[\s\S]*markContextUnavailable\(\)[\s\S]*if \(document\.hidden \|\| !container\.clientWidth \|\| !container\.clientHeight\) return;/);
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
