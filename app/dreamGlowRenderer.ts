import * as THREE from "three";
import {
  DREAM_GLOW_MODEL,
  DREAM_GLOW_TAPS,
  projectedConvexHullArea,
  projectedGlowReference,
  viewConditionedGlowReference,
  type GlowPoint2,
} from "./dreamGlowMath";
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
  uniform vec4 uSourceBounds;
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
    float coverage = sourceAt(centerUv).a;
    // The final composite discards every halo contribution at an opaque core.
    // Preserve that mask but do not evaluate 327 samples that cannot be shown.
    if (coverage >= 1.0) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, coverage);
      return;
    }
    vec3 spread = vec3(0.0);
    for (int scaleIndex = 0; scaleIndex < 3; scaleIndex++) {
      float radius = uReference * uSigmaRatios[scaleIndex];
      // A conservative projected source rectangle plus the exact finite
      // kernel support. The two-pixel source margin includes raster/filter edges.
      float support = 3.0 * radius;
      if (any(lessThan(gl_FragCoord.xy, uSourceBounds.xy - support)) ||
          any(greaterThan(gl_FragCoord.xy, uSourceBounds.zw + support))) continue;
      vec2 sigma = radius / uSourceSize;
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
type Subject = {
  root: THREE.Group; runtime: DreamEmissionRuntime; scene: THREE.Scene; parts: CapturedPart[];
  captureRect: THREE.Vector4; sourceBounds: THREE.Vector4;
};
type SourceTarget = {
  target: THREE.WebGLRenderTarget; captureRect: THREE.Vector4; sourceBounds: THREE.Vector4;
  reference: number; gain: number; used: boolean; lastUsed: number;
};
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
 * Bounded source targets are cropped/padded in unclipped screen coordinates.
 * Captures are accumulated in batches, avoiding full-frame target switches for
 * every small source. The source-pixel budget equals the former maximum single
 * source allocation; larger workloads use multiple batches, not fewer entities.
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
  private readonly sourceBounds = new THREE.Vector4();
  private readonly point = new THREE.Vector3();
  private readonly center = new THREE.Vector3();
  private readonly worldScale = new THREE.Vector3();
  private readonly referenceSize = new THREE.Vector3();
  private readonly worldBox = new THREE.Box3();
  private readonly scratchBox = new THREE.Box3();
  private readonly referencePoints: THREE.Vector2[] = Array.from({ length: 8 }, () => new THREE.Vector2());
  private disposed = false;
  private displayCopyVerified = false;
  private displayCopyFailed = false;
  private readonly sourceTargets: SourceTarget[] = [];
  private readonly pendingSources: SourceTarget[] = [];
  private sourceTargetPixels = 0;
  private sourceUseSerial = 0;

  constructor(private readonly renderer: THREE.WebGLRenderer, roots: readonly THREE.Group[]) {
    // RGBA storage is required by the display-copy path on WebKit. An
    // externally supplied opaque context must retain its native scene instead.
    this.supported = renderer.extensions.has("EXT_color_buffer_float")
      && renderer.getContext().getContextAttributes()?.alpha === true;
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
        uSourceBounds: { value: this.sourceBounds },
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
    this.setSubjects(roots);
  }

  /** Keep framebuffer allocations and the compiled full-screen programs while
   * the current view changes. Only the scene-owned source registrations change.
   */
  setSubjects(roots: readonly THREE.Group[]): void {
    if (this.disposed) throw new Error("DreamGlowRenderer has been disposed");
    this.clearSubjects();
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
      this.subjects.push({ root, runtime, scene: sourceScene, parts, captureRect: new THREE.Vector4(), sourceBounds: new THREE.Vector4() });
    }
  }

  private projectedReference(subject: Subject, camera: THREE.PerspectiveCamera): number {
    const { root, runtime } = subject;
    this.center.copy(runtime.referenceSphere.center).applyMatrix4(root.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
    root.getWorldScale(this.worldScale);
    const maximumScale = Math.max(Math.abs(this.worldScale.x), Math.abs(this.worldScale.y), Math.abs(this.worldScale.z));
    const sphereDiameterWorld = runtime.referenceSphere.radius * 2 * maximumScale;
    const sphereReference = projectedGlowReference(sphereDiameterWorld, -this.center.z, camera.projectionMatrix.elements[5], this.fullSize.y);
    if (!sphereReference) return 0;

    runtime.referenceBox.getSize(this.referenceSize);
    const worldSizeX = Math.abs(this.referenceSize.x * this.worldScale.x);
    const worldSizeY = Math.abs(this.referenceSize.y * this.worldScale.y);
    const worldSizeZ = Math.abs(this.referenceSize.z * this.worldScale.z);
    for (let corner = 0; corner < 8; corner++) {
      this.point.set(
        corner & 1 ? runtime.referenceBox.max.x : runtime.referenceBox.min.x,
        corner & 2 ? runtime.referenceBox.max.y : runtime.referenceBox.min.y,
        corner & 4 ? runtime.referenceBox.max.z : runtime.referenceBox.min.z,
      ).applyMatrix4(root.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
      // Do not invent a projected footprint for a source crossing the near
      // plane. Degrade this subject instead of clipping its reference scale.
      if (-this.point.z <= camera.near) return 0;
      this.point.applyMatrix4(camera.projectionMatrix);
      this.referencePoints[corner].set(
        (this.point.x * 0.5 + 0.5) * this.fullSize.x,
        (this.point.y * 0.5 + 0.5) * this.fullSize.y,
      );
    }
    const projectedArea = projectedConvexHullArea(this.referencePoints as readonly GlowPoint2[]);
    return viewConditionedGlowReference(
      sphereReference,
      projectedArea,
      worldSizeX,
      worldSizeY,
      worldSizeZ,
      sphereDiameterWorld,
    );
  }

  private prepareSubject(subject: Subject, camera: THREE.PerspectiveCamera): number {
    const root = subject.root;
    if (!dreamSourceVisible(root)) return 0;
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
    const reference = this.projectedReference(subject, camera);
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
    this.sourceBounds.set(left - 2, bottom - 2, right + 2, top + 2);
    const padding = DREAM_GLOW_MODEL.supportSigmas * DREAM_GLOW_MODEL.sigmaRatios[2] * reference + 2;
    left = Math.floor(left - padding); bottom = Math.floor(bottom - padding);
    right = Math.ceil(right + padding); top = Math.ceil(top + padding);
    if (right <= 0 || top <= 0 || left >= this.fullSize.x || bottom >= this.fullSize.y) return 0;
    const width = right - left; const height = top - bottom;
    const maximum = Math.min(DREAM_EMISSION_LIMITS.maxSourceTextureSize, this.renderer.capabilities.maxTextureSize);
    if (width > maximum || height > maximum) { this.skippedForBudget++; return 0; }
    this.captureRect.set(left, bottom, width, height);
    subject.captureRect.copy(this.captureRect);
    subject.sourceBounds.copy(this.sourceBounds);
    return reference;
  }

  /** Reuse exact-sized power-of-two targets, not the largest previous crop for
   * every subsequent tiny emitter. Unused entries are evicted before exceeding
   * the same pixel ceiling as the former single 2048-by-2048 source target.
   * A full batch returns null: the caller flushes it and retries without dropping
   * or weakening the incoming source.
   */
  private acquireSourceTarget(width: number, height: number): SourceTarget | null {
    const pixels = width * height;
    const maximum = DREAM_EMISSION_LIMITS.maxSourceTextureSize ** 2;
    if (pixels > maximum) return null;
    const reusable = this.sourceTargets.find((entry) => !entry.used && entry.target.width === width && entry.target.height === height);
    if (reusable) {
      reusable.used = true;
      reusable.lastUsed = ++this.sourceUseSerial;
      return reusable;
    }
    while (this.sourceTargetPixels + pixels > maximum) {
      let oldest = -1;
      for (let index = 0; index < this.sourceTargets.length; index++) {
        const entry = this.sourceTargets[index];
        if (!entry.used && (oldest < 0 || entry.lastUsed < this.sourceTargets[oldest].lastUsed)) oldest = index;
      }
      if (oldest < 0) return null;
      const [removed] = this.sourceTargets.splice(oldest, 1);
      this.sourceTargetPixels -= removed.target.width * removed.target.height;
      removed.target.dispose();
    }
    const target = renderTarget(true, this.emission.samples);
    target.setSize(width, height);
    const entry: SourceTarget = {
      target, captureRect: new THREE.Vector4(), sourceBounds: new THREE.Vector4(),
      reference: 0, gain: 0, used: true, lastUsed: ++this.sourceUseSerial,
    };
    this.sourceTargets.push(entry);
    this.sourceTargetPixels += pixels;
    return entry;
  }

  private flushSources(): void {
    if (!this.pendingSources.length) return;
    const renderer = this.renderer;
    const pixelRatio = renderer.getPixelRatio();
    this.accumulation.scissorTest = false;
    renderer.setRenderTarget(this.accumulation);
    renderer.setScissorTest(true);
    renderer.autoClear = false;
    this.screenMesh.material = this.glowMaterial;
    for (const entry of this.pendingSources) {
      this.captureRect.copy(entry.captureRect);
      this.sourceBounds.copy(entry.sourceBounds);
      this.sourceSize.set(entry.target.width, entry.target.height);
      this.glowMaterial.uniforms.uEmission.value = entry.target.texture;
      this.glowMaterial.uniforms.uSourceDepth.value = entry.target.depthTexture;
      this.glowMaterial.uniforms.uReference.value = entry.reference;
      this.glowMaterial.uniforms.uGain.value = entry.gain;
      const x = Math.max(0, this.captureRect.x); const y = Math.max(0, this.captureRect.y);
      const width = Math.min(this.fullSize.x, this.captureRect.x + this.captureRect.z) - x;
      const height = Math.min(this.fullSize.y, this.captureRect.y + this.captureRect.w) - y;
      // Three accepts logical scissor units and applies DPR internally. Divide
      // once so these exact physical-pixel rectangles retain fractional-DPR parity.
      renderer.setScissor(x / pixelRatio, y / pixelRatio, width / pixelRatio, height / pixelRatio);
      renderer.render(this.screenScene, this.screenCamera);
      entry.used = false;
      this.renderedSubjects++;
    }
    this.pendingSources.length = 0;
    renderer.setScissorTest(false);
  }

  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
    if (this.disposed) throw new Error("DreamGlowRenderer has been disposed");
    const renderer = this.renderer;
    this.renderedSubjects = 0;
    this.skippedForBudget = 0;
    renderer.getDrawingBufferSize(this.fullSize);
    if (this.fullSize.x < 1 || this.fullSize.y < 1) { this.status = "off"; return; }
    const supportedOutput = renderer.getRenderTarget() === null && renderer.outputColorSpace === THREE.SRGBColorSpace;
    if (!this.subjects.length || !this.supported || this.displayCopyFailed || !supportedOutput || this.fullSize.x * this.fullSize.y > DREAM_EMISSION_LIMITS.maxBufferPixels) {
      this.status = !this.subjects.length ? "off" : !this.supported || this.displayCopyFailed || !supportedOutput ? "core-only-capability" : "core-only-budget";
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
      this.displayCopyVerified = false;
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
        const width = THREE.MathUtils.ceilPowerOfTwo(subject.captureRect.z);
        const height = THREE.MathUtils.ceilPowerOfTwo(subject.captureRect.w);
        let entry = this.acquireSourceTarget(width, height);
        if (!entry) {
          this.flushSources();
          entry = this.acquireSourceTarget(width, height);
        }
        // prepareSubject has already enforced these dimensions. No workload
        // budget causes a hidden source cap or silent quality reduction.
        if (!entry) throw new Error("Validated glow source exceeds allocation ceiling");
        entry.captureRect.copy(subject.captureRect);
        entry.sourceBounds.copy(subject.sourceBounds);
        entry.reference = reference;
        entry.gain = subject.runtime.profile.haloStrength * subject.runtime.haloFactor;
        this.captureRect.copy(entry.captureRect);
        this.sourceBounds.copy(entry.sourceBounds);
        subject.scene.fog = scene.fog;
        this.cropCamera.copy(camera, false);
        this.cropCamera.setViewOffset(this.fullSize.x, this.fullSize.y, this.captureRect.x,
          this.fullSize.y - this.captureRect.y - this.captureRect.w, this.captureRect.z, this.captureRect.w);
        entry.target.viewport.set(0, 0, this.captureRect.z, this.captureRect.w);
        renderer.setScissorTest(false);
        renderer.setRenderTarget(entry.target);
        // Automatic clear resets the depth write mask; only this small target
        // is cleared/resolved, never a historical maximum crop for every bird.
        renderer.autoClear = true;
        renderer.render(subject.scene, this.cropCamera);
        renderer.autoClear = false;
        this.pendingSources.push(entry);
      }
      this.flushSources();
      if (this.skippedForBudget > 0) this.status = this.renderedSubjects > 0 ? "partial-core-only-budget" : "core-only-budget";
      renderer.setScissorTest(false);
      renderer.setRenderTarget(previous.target);
      renderer.setViewport(previous.viewport);
      renderer.toneMapping = previous.toneMapping;
      // Preserve the existing display pipeline as authority. The first scene
      // pass supplies depth only; legacy custom shaders are not assumed to
      // follow the same output-transfer convention as standard materials.
      renderer.autoClear = true;
      renderer.setClearColor(previous.clearColor, previous.clearAlpha);
      renderer.render(scene, camera);
      if (this.renderedSubjects === 0) return;
      renderer.copyFramebufferToTexture(this.displayBase, new THREE.Vector2(0, 0));
      // Validate each new snapshot allocation once, not on every frame. If
      // capture fails, the just-rendered lit scene remains the output; never
      // cover it with an empty texture. Retry only with a new renderer instance.
      if (!this.displayCopyVerified) {
        const context = renderer.getContext();
        if (context.getError() !== context.NO_ERROR) {
          this.displayCopyFailed = true;
          this.status = "core-only-capability";
          return;
        }
        this.displayCopyVerified = true;
      }
      renderer.autoClear = false;
      this.screenMesh.material = this.compositeMaterial;
      renderer.render(this.screenScene, this.screenCamera);
    } finally {
      for (const entry of this.sourceTargets) entry.used = false;
      this.pendingSources.length = 0;
      renderer.setRenderTarget(previous.target);
      renderer.setViewport(previous.viewport);
      renderer.setScissor(previous.scissor);
      renderer.setScissorTest(previous.scissorTest);
      renderer.setClearColor(previous.clearColor, previous.clearAlpha);
      renderer.autoClear = previous.autoClear;
      renderer.toneMapping = previous.toneMapping;
    }
  }

  /** Release old scene references without dropping renderer-owned programs. */
  clearSubjects(): void {
    for (const subject of this.subjects) {
      for (const part of subject.parts) part.material.dispose();
      subject.scene.clear();
    }
    this.subjects.length = 0;
    this.renderedSubjects = 0;
    this.skippedForBudget = 0;
    this.status = "off";
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.base.dispose(); this.emission.dispose(); this.accumulation.dispose(); this.displayBase.dispose();
    this.glowMaterial.dispose(); this.compositeMaterial.dispose(); this.triangle.dispose();
    for (const entry of this.sourceTargets) entry.target.dispose();
    this.sourceTargets.length = 0;
    this.pendingSources.length = 0;
    this.sourceTargetPixels = 0;
    this.clearSubjects();
    this.screenScene.clear();
    // Original scene geometry/material ownership remains with Battlefield.
  }
}