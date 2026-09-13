import * as THREE from "three";
import { DREAM_GLOW_MODEL, DREAM_GLOW_TAPS, projectedGlowReference } from "./dreamGlowMath";
import {
  DREAM_EMISSION_LIMITS, dreamSourceVisible,
  type DreamEmissionRuntime, type DreamSourcePart,
} from "./dreamEmission";

const FULLSCREEN_VERTEX = `
  varying vec2 vUv;
  void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const DEPTH_FUNCTION = `
  float viewDepth(float d, vec2 nearFar) {
    return nearFar.x * nearFar.y / (nearFar.y - d * (nearFar.y - nearFar.x));
  }
  bool blocked(float source, float destination, vec2 nearFar) {
    float z = viewDepth(source, nearFar);
    return z > viewDepth(destination, nearFar) + max(0.0001, z * 0.00001);
  }
`;
const CAPTURE_DECLARATIONS = `
  uniform sampler2D uSceneDepth;
  uniform vec2 uFullSize;
  uniform vec4 uCaptureRect;
  uniform vec2 uNearFar;
  ${DEPTH_FUNCTION}
`;
const CAPTURE_FOG = `
  #ifdef USE_FOG
    #ifdef FOG_EXP2
      float transmission = exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
    #else
      float transmission = 1.0 - smoothstep(fogNear, fogFar, vFogDepth);
    #endif
    gl_FragColor.rgb *= transmission;
  #endif
`;
const CAPTURE_OUTPUT = `
  vec2 fullUv = (uCaptureRect.xy + gl_FragCoord.xy) / uFullSize;
  if (any(lessThan(fullUv, vec2(0.0))) || any(greaterThan(fullUv, vec2(1.0)))) discard;
  if (blocked(gl_FragCoord.z, texture2D(uSceneDepth, fullUv).r, uNearFar)) discard;
  // RGB with zero coverage is zero BEFORE convolution. Preserve native hues.
  gl_FragColor.rgb *= gl_FragColor.a;
`;

const GLOW_FRAGMENT = `
  precision highp float;
  uniform sampler2D uEmission;
  uniform sampler2D uSourceDepth;
  uniform sampler2D uSceneDepth;
  uniform vec2 uFullSize;
  uniform vec2 uSourceSize;
  uniform vec2 uNearFar;
  uniform vec4 uCaptureRect;
  uniform float uReference;
  uniform float uGain;
  uniform vec3 uSigmaRatios;
  uniform vec3 uWeights;
  uniform vec3 uTaps[${DREAM_GLOW_TAPS.length}];
  ${DEPTH_FUNCTION}
  vec4 sourceAt(vec2 uv) {
    vec2 limit = uCaptureRect.zw / uSourceSize;
    if (any(lessThan(uv, vec2(0.0))) || any(greaterThanEqual(uv, limit))) return vec4(0.0);
    return texture2D(uEmission, uv);
  }
  void main() {
    vec2 fullUv = gl_FragCoord.xy / uFullSize;
    vec2 centerUv = (gl_FragCoord.xy - uCaptureRect.xy) / uSourceSize;
    float destinationDepth = texture2D(uSceneDepth, fullUv).r;
    vec3 spread = vec3(0.0);
    for (int scaleIndex = 0; scaleIndex < 3; scaleIndex++) {
      vec2 sigma = uReference * uSigmaRatios[scaleIndex] / uSourceSize;
      for (int tapIndex = 0; tapIndex < ${DREAM_GLOW_TAPS.length}; tapIndex++) {
        vec3 tap = uTaps[tapIndex];
        vec2 sampleUv = centerUv + tap.xy * sigma;
        vec4 source = sourceAt(sampleUv);
        if (source.a <= 0.0) continue;
        if (blocked(texture2D(uSourceDepth, sampleUv).r, destinationDepth, uNearFar)) continue;
        // No post-occlusion renormalization: blocked light disappears.
        spread += source.rgb * (tap.z * uWeights[scaleIndex]);
      }
    }
    float coverage = sourceAt(centerUv).a;
    gl_FragColor = vec4(spread * uGain, coverage);
  }
`;
const COMPOSITE_FRAGMENT = `
  uniform sampler2D uBase;
  uniform sampler2D uGlow;
  uniform vec2 uFullSize;
  uniform float uKnee;
  uniform float uCeiling;
  varying vec2 vUv;
  vec3 decodeDisplay(vec3 c) {
    return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
  }
  vec3 encodeDisplay(vec3 c) {
    return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055,
      step(vec3(0.0031308), c));
  }
  void main() {
    // This is the actual original display framebuffer, including custom scene
    // shaders. Treat it as encoded data rather than encoding the whole scene
    // again merely because an unrelated animal has registered emission.
    // A fractional DPR can round the viewport one pixel larger than the
    // floored drawing buffer. Address the copy in physical pixels, not vUv.
    vec2 pixelUv = gl_FragCoord.xy / uFullSize;
    vec4 base = texture2D(uBase, pixelUv);
    vec4 glow = texture2D(uGlow, pixelUv);
    float luminance = dot(glow.rgb, vec3(0.2126, 0.7152, 0.0722));
    if (luminance > uKnee) {
      float limited = uKnee + (uCeiling - uKnee) * (1.0 - exp(-(luminance - uKnee) / (uCeiling - uKnee)));
      glow.rgb *= limited / luminance;
    }
    // Alpha stores the maximum crisp-core coverage, not halo opacity.
    // Opaque source pixels remain exactly the baseline core, including detail.
    vec3 exterior = glow.rgb * (1.0 - clamp(glow.a, 0.0, 1.0));
    if (max(exterior.r, max(exterior.g, exterior.b)) <= 0.0) {
      gl_FragColor = base;
      return;
    }
    gl_FragColor = vec4(encodeDisplay(decodeDisplay(base.rgb) + exterior), base.a);
  }
`;

type CapturedPart = { source: DreamSourcePart; proxy: THREE.Mesh; material: THREE.MeshBasicMaterial };
type Subject = { root: THREE.Group; runtime: DreamEmissionRuntime; scene: THREE.Scene; parts: CapturedPart[] };
export type DreamGlowStatus = "off" | "sampled-radial-native-color" | "core-only-capability" | "core-only-budget" | "partial-core-only-budget";

function renderTarget(depth: boolean, samples: number): THREE.WebGLRenderTarget {
  const target = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType, format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    depthBuffer: depth, stencilBuffer: false, samples,
  });
  target.texture.colorSpace = THREE.LinearSRGBColorSpace;
  target.texture.generateMipmaps = false;
  if (depth) {
    target.depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
    target.depthTexture.minFilter = THREE.NearestFilter;
    target.depthTexture.magFilter = THREE.NearestFilter;
  }
  return target;
}

/** Explicit scene postprocess. Every source is a registered, authorized group
 * returned by buildSceneContents; undisclosed simulation objects are not read.
 * One reusable source target is cropped/padded in unclipped screen coordinates.
 */
export class DreamGlowRenderer {
  status: DreamGlowStatus = "off";
  renderedSubjects = 0;
  skippedForBudget = 0;
  private readonly subjects: Subject[];
  private readonly base: THREE.WebGLRenderTarget;
  private readonly emission: THREE.WebGLRenderTarget;
  private readonly accumulation: THREE.WebGLRenderTarget;
  private displayBase = new THREE.FramebufferTexture(1, 1);
  private readonly triangle: THREE.BufferGeometry;
  private readonly screenScene = new THREE.Scene();
  private readonly screenCamera = new THREE.Camera();
  private readonly cropCamera = new THREE.PerspectiveCamera();
  private readonly screenMesh: THREE.Mesh;
  private readonly glowMaterial: THREE.ShaderMaterial;
  private readonly compositeMaterial: THREE.ShaderMaterial;
  private readonly supported: boolean;
  private readonly fullSize = new THREE.Vector2();
  private readonly sourceSize = new THREE.Vector2(1, 1);
  private readonly nearFar = new THREE.Vector2();
  private readonly captureRect = new THREE.Vector4();
  private readonly point = new THREE.Vector3();
  private readonly center = new THREE.Vector3();
  private readonly worldScale = new THREE.Vector3();
  private readonly worldBox = new THREE.Box3();
  private readonly scratchBox = new THREE.Box3();
  private disposed = false;

  constructor(private readonly renderer: THREE.WebGLRenderer, roots: readonly THREE.Group[]) {
    this.supported = renderer.extensions.has("EXT_color_buffer_float");
    const samples = Math.min(4, renderer.capabilities.maxSamples);
    this.base = renderTarget(true, samples);
    this.emission = renderTarget(true, samples);
    this.accumulation = renderTarget(false, 0);
    this.displayBase.colorSpace = THREE.NoColorSpace;
    this.triangle = new THREE.BufferGeometry();
    this.triangle.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    this.glowMaterial = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERTEX, fragmentShader: GLOW_FRAGMENT,
      uniforms: {
        uEmission: { value: this.emission.texture }, uSourceDepth: { value: this.emission.depthTexture },
        uSceneDepth: { value: this.base.depthTexture }, uFullSize: { value: this.fullSize },
        uSourceSize: { value: this.sourceSize }, uNearFar: { value: this.nearFar },
        uCaptureRect: { value: this.captureRect }, uReference: { value: 0 }, uGain: { value: 0 },
        uSigmaRatios: { value: new THREE.Vector3().fromArray(DREAM_GLOW_MODEL.sigmaRatios) },
        uWeights: { value: new THREE.Vector3().fromArray(DREAM_GLOW_MODEL.weights) },
        uTaps: { value: DREAM_GLOW_TAPS.map((tap) => new THREE.Vector3(tap.x, tap.y, tap.weight)) },
      },
      depthTest: false, depthWrite: false, transparent: true, toneMapped: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      blendEquation: THREE.AddEquation,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor, blendEquationAlpha: THREE.MaxEquation,
    });
    this.compositeMaterial = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERTEX, fragmentShader: COMPOSITE_FRAGMENT,
      uniforms: {
        uBase: { value: this.displayBase }, uGlow: { value: this.accumulation.texture },
        uFullSize: { value: this.fullSize },
        uKnee: { value: DREAM_GLOW_MODEL.luminanceKnee }, uCeiling: { value: DREAM_GLOW_MODEL.luminanceCeiling },
      },
      depthTest: false, depthWrite: false, blending: THREE.NoBlending, toneMapped: false,
    });
    this.screenMesh = new THREE.Mesh(this.triangle, this.glowMaterial);
    this.screenMesh.frustumCulled = false;
    this.screenScene.add(this.screenMesh);
    this.subjects = [];
    for (const root of new Set(roots)) {
      const runtime = root.userData.dreamEmission as DreamEmissionRuntime | undefined;
      if (!runtime?.profile.enabled) continue;
      const sourceScene = new THREE.Scene();
      const parts: CapturedPart[] = runtime.parts.map((source) => {
        const native = source.material;
        const material = new THREE.MeshBasicMaterial({
          color: native.color, map: native.map, alphaMap: native.alphaMap,
          alphaTest: native.alphaTest, opacity: native.opacity,
          vertexColors: native.vertexColors, side: native.side,
          transparent: true, blending: THREE.NoBlending, depthWrite: true,
          fog: native.fog, toneMapped: false,
        });
        material.onBeforeCompile = (shader) => {
          shader.uniforms.uSceneDepth = { value: this.base.depthTexture };
          shader.uniforms.uFullSize = { value: this.fullSize };
          shader.uniforms.uCaptureRect = { value: this.captureRect };
          shader.uniforms.uNearFar = { value: this.nearFar };
          shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", `#include <common>\n${CAPTURE_DECLARATIONS}`)
            .replace("#include <fog_fragment>", CAPTURE_FOG)
            .replace("#include <opaque_fragment>", `#include <opaque_fragment>\n${CAPTURE_OUTPUT}`);
        };
        material.customProgramCacheKey = () => "ndcg-native-visible-source-v1";
        const proxy = new THREE.Mesh(source.mesh.geometry, material);
        proxy.matrixAutoUpdate = false;
        proxy.frustumCulled = false;
        sourceScene.add(proxy);
        return { source, proxy, material };
      });
      this.subjects.push({ root, runtime, scene: sourceScene, parts });
    }
  }

  private prepareSubject(subject: Subject, camera: THREE.PerspectiveCamera): number {
    if (!dreamSourceVisible(subject.root)) return 0;
    const root = subject.root;
    this.worldBox.makeEmpty();
    let count = 0;
    for (const part of subject.parts) {
      const native = part.source.material;
      part.proxy.visible = dreamSourceVisible(part.source.mesh) && native.visible && native.opacity > 0;
      if (!part.proxy.visible) continue;
      count++;
      part.proxy.matrix.copy(part.source.mesh.matrixWorld);
      part.material.color.copy(native.color);
      part.material.opacity = native.opacity;
      if (part.source.mesh.geometry.boundingBox) {
        this.scratchBox.copy(part.source.mesh.geometry.boundingBox).applyMatrix4(part.source.mesh.matrixWorld);
        this.worldBox.union(this.scratchBox);
      }
    }
    if (!count || this.worldBox.isEmpty()) return 0;
    this.center.copy(subject.runtime.referenceSphere.center).applyMatrix4(root.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
    root.getWorldScale(this.worldScale);
    const diameter = subject.runtime.referenceSphere.radius * 2 * Math.max(Math.abs(this.worldScale.x), Math.abs(this.worldScale.y), Math.abs(this.worldScale.z));
    const reference = projectedGlowReference(diameter, -this.center.z, camera.projectionMatrix.elements[5], this.fullSize.y);
    if (!Number.isFinite(reference) || reference <= 0) return 0;
    let left = Infinity; let right = -Infinity; let bottom = Infinity; let top = -Infinity;
    for (let corner = 0; corner < 8; corner++) {
      this.point.set(corner & 1 ? this.worldBox.max.x : this.worldBox.min.x,
        corner & 2 ? this.worldBox.max.y : this.worldBox.min.y,
        corner & 4 ? this.worldBox.max.z : this.worldBox.min.z).applyMatrix4(camera.matrixWorldInverse);
      // A near-plane intersection cannot be safely projected to a finite crop.
      if (-this.point.z <= camera.near) { this.skippedForBudget++; return 0; }
      this.point.applyMatrix4(camera.projectionMatrix);
      const x = (this.point.x * 0.5 + 0.5) * this.fullSize.x;
      const y = (this.point.y * 0.5 + 0.5) * this.fullSize.y;
      left = Math.min(left, x); right = Math.max(right, x);
      bottom = Math.min(bottom, y); top = Math.max(top, y);
    }
    const padding = DREAM_GLOW_MODEL.supportSigmas * DREAM_GLOW_MODEL.sigmaRatios[2] * reference + 2;
    left = Math.floor(left - padding); bottom = Math.floor(bottom - padding);
    right = Math.ceil(right + padding); top = Math.ceil(top + padding);
    if (right <= 0 || top <= 0 || left >= this.fullSize.x || bottom >= this.fullSize.y) return 0;
    const width = right - left; const height = top - bottom;
    const maximum = Math.min(DREAM_EMISSION_LIMITS.maxSourceTextureSize, this.renderer.capabilities.maxTextureSize);
    if (width > maximum || height > maximum) { this.skippedForBudget++; return 0; }
    this.captureRect.set(left, bottom, width, height);
    const targetWidth = Math.max(this.emission.width, THREE.MathUtils.ceilPowerOfTwo(width));
    const targetHeight = Math.max(this.emission.height, THREE.MathUtils.ceilPowerOfTwo(height));
    this.emission.setSize(targetWidth, targetHeight);
    this.sourceSize.set(targetWidth, targetHeight);
    this.cropCamera.copy(camera, false);
    this.cropCamera.setViewOffset(this.fullSize.x, this.fullSize.y, left, this.fullSize.y - top, width, height);
    return reference;
  }

  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
    if (this.disposed) throw new Error("DreamGlowRenderer has been disposed");
    const renderer = this.renderer;
    this.renderedSubjects = 0;
    this.skippedForBudget = 0;
    renderer.getDrawingBufferSize(this.fullSize);
    if (this.fullSize.x < 1 || this.fullSize.y < 1) { this.status = "off"; return; }
    const supportedOutput = renderer.getRenderTarget() === null && renderer.outputColorSpace === THREE.SRGBColorSpace;
    if (!this.subjects.length || !this.supported || !supportedOutput || this.fullSize.x * this.fullSize.y > DREAM_EMISSION_LIMITS.maxBufferPixels) {
      this.status = !this.subjects.length ? "off" : !this.supported || !supportedOutput ? "core-only-capability" : "core-only-budget";
      renderer.render(scene, camera);
      return;
    }
    const previous = {
      target: renderer.getRenderTarget(), viewport: renderer.getViewport(new THREE.Vector4()),
      scissor: renderer.getScissor(new THREE.Vector4()), scissorTest: renderer.getScissorTest(),
      clearColor: renderer.getClearColor(new THREE.Color()), clearAlpha: renderer.getClearAlpha(),
      autoClear: renderer.autoClear, toneMapping: renderer.toneMapping,
    };
    this.status = "sampled-radial-native-color";
    this.base.setSize(this.fullSize.x, this.fullSize.y);
    this.accumulation.setSize(this.fullSize.x, this.fullSize.y);
    if (this.displayBase.image.width !== this.fullSize.x || this.displayBase.image.height !== this.fullSize.y) {
      this.displayBase.dispose();
      this.displayBase = new THREE.FramebufferTexture(this.fullSize.x, this.fullSize.y);
      this.displayBase.colorSpace = THREE.NoColorSpace;
      this.compositeMaterial.uniforms.uBase.value = this.displayBase;
    }
    this.nearFar.set(camera.near, camera.far);
    try {
      renderer.autoClear = true;
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.setScissorTest(false);
      renderer.setRenderTarget(this.base);
      renderer.render(scene, camera);
      // render(scene) has updated original mesh world matrices, including rigs.
      this.accumulation.scissorTest = false;
      renderer.setRenderTarget(this.accumulation);
      renderer.setClearColor(0x000000, 0);
      renderer.clear(true, false, false);
      renderer.autoClear = false;
      for (const subject of this.subjects) {
        const reference = this.prepareSubject(subject, camera);
        if (!reference) continue;
        subject.scene.fog = scene.fog;
        renderer.setScissorTest(false);
        // Render-target viewports are physical pixels. Renderer.setViewport
        // would multiply these by devicePixelRatio a second time in Three r179.
        this.emission.viewport.set(0, 0, this.captureRect.z, this.captureRect.w);
        renderer.setRenderTarget(this.emission);
        // Automatic clearing resets write masks; a bare depth clear after
        // a depthWrite=false fullscreen pass can leave stale source depth.
        renderer.autoClear = true;
        renderer.render(subject.scene, this.cropCamera);
        renderer.autoClear = false;
        this.glowMaterial.uniforms.uReference.value = reference;
        this.glowMaterial.uniforms.uGain.value = subject.runtime.profile.haloStrength * subject.runtime.haloFactor;
        this.screenMesh.material = this.glowMaterial;
        const x = Math.max(0, this.captureRect.x); const y = Math.max(0, this.captureRect.y);
        this.accumulation.scissor.set(x, y, Math.min(this.fullSize.x, this.captureRect.x + this.captureRect.z) - x,
          Math.min(this.fullSize.y, this.captureRect.y + this.captureRect.w) - y);
        this.accumulation.scissorTest = true;
        renderer.setRenderTarget(this.accumulation);
        renderer.render(this.screenScene, this.screenCamera);
        this.renderedSubjects++;
      }
      if (this.skippedForBudget > 0) this.status = this.renderedSubjects > 0 ? "partial-core-only-budget" : "core-only-budget";
      renderer.setScissorTest(false);
      renderer.setRenderTarget(previous.target);
      renderer.setViewport(previous.viewport);
      renderer.toneMapping = previous.toneMapping;
      // Preserve the existing display pipeline as authority. The first scene
      // pass supplies depth only; legacy custom shaders are not assumed to
      // follow the same output-transfer convention as standard materials.
      renderer.autoClear = true;
      renderer.render(scene, camera);
      if (this.renderedSubjects === 0) return;
      renderer.copyFramebufferToTexture(this.displayBase, new THREE.Vector2(0, 0));
      renderer.autoClear = false;
      this.screenMesh.material = this.compositeMaterial;
      renderer.render(this.screenScene, this.screenCamera);
    } finally {
      renderer.setRenderTarget(previous.target);
      renderer.setViewport(previous.viewport);
      renderer.setScissor(previous.scissor);
      renderer.setScissorTest(previous.scissorTest);
      renderer.setClearColor(previous.clearColor, previous.clearAlpha);
      renderer.autoClear = previous.autoClear;
      renderer.toneMapping = previous.toneMapping;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.base.dispose(); this.emission.dispose(); this.accumulation.dispose(); this.displayBase.dispose();
    this.glowMaterial.dispose(); this.compositeMaterial.dispose(); this.triangle.dispose();
    for (const subject of this.subjects) {
      for (const part of subject.parts) part.material.dispose();
      subject.scene.clear();
    }
    this.screenScene.clear();
    // Original scene geometry/material ownership remains with Battlefield.
  }
}
