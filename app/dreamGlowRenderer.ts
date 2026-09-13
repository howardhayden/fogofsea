/** SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
 * NDCG v0.1 native-color candidate. Source-local convolution; no scene bright
 * pass, enlarged hulls, aura spheres, light objects, or per-frame random noise.
 */
import * as THREE from "three";
import { DREAM_EMISSION_LIMITS, dreamSourceVisible, getDreamEmissionRuntime, type DreamEmissionRuntime, type DreamSourceMaterial } from "./dreamEmission";
import { finite, NDCG_KERNEL_TAPS, NDCG_SEED } from "./dreamGlowMath";

type Camera = THREE.PerspectiveCamera | THREE.OrthographicCamera;
type SourceProxy = { original: THREE.Mesh; mesh: THREE.Mesh; authored: DreamSourceMaterial[]; materials: THREE.ShaderMaterial[] };
type Subject = { original: THREE.Group; runtime: DreamEmissionRuntime; root: THREE.Group; proxies: SourceProxy[] };
export type DreamGlowDiagnostics = {
  profile: string;
  registered: number;
  rendered: number;
  reducedSubjects: number;
  sourceMeshes: number;
  haloMeshes: number;
};

const DEPTH_GLSL = `
  uniform float uNear;
  uniform float uFar;
  uniform bool uOrthographic;
  float viewDepth(float d) {
    return uOrthographic ? mix(uNear, uFar, d) : uNear * uFar / (uFar - d * (uFar - uNear));
  }
  float depthTolerance(float d) { return max(0.0001, d * 0.00001); }
`;

const SOURCE_VERTEX = `
  varying vec4 vGlobalClip;
  varying float vSourceDepth;
  varying vec2 vUv;
  #include <color_pars_vertex>
  uniform mat4 uGlobalProjection;
  void main() {
    #include <color_vertex>
    vUv = uv;
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    vSourceDepth = -view.z;
    vGlobalClip = uGlobalProjection * view;
    gl_Position = projectionMatrix * view;
  }
`;

const SOURCE_FRAGMENT = `
  ${DEPTH_GLSL}
  uniform sampler2D uSceneDepth;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uEmissionGain;
  uniform float uAlphaTest;
  uniform float uFogDensity;
  uniform vec2 uFogRange;
  uniform int uFogMode;
  uniform sampler2D uMap;
  uniform sampler2D uAlphaMap;
  uniform mat3 uMapTransform;
  uniform mat3 uAlphaTransform;
  varying vec4 vGlobalClip;
  varying float vSourceDepth;
  varying vec2 vUv;
  #include <color_pars_fragment>
  void main() {
    vec2 screenUv = vGlobalClip.xy / vGlobalClip.w * .5 + .5;
    if (any(lessThan(screenUv, vec2(0.0))) || any(greaterThan(screenUv, vec2(1.0)))) discard;
    float foreground = viewDepth(texture2D(uSceneDepth, screenUv).r);
    if (vSourceDepth > foreground + depthTolerance(foreground)) discard;
    vec4 native = vec4(uColor, uOpacity);
    #ifdef SOURCE_MAP
      native *= texture2D(uMap, (uMapTransform * vec3(vUv, 1.0)).xy);
    #endif
    #ifdef SOURCE_ALPHA_MAP
      native.a *= texture2D(uAlphaMap, (uAlphaTransform * vec3(vUv, 1.0)).xy).g;
    #endif
    #ifdef USE_COLOR_ALPHA
      native *= vColor;
    #elif defined(USE_COLOR)
      native.rgb *= vColor;
    #endif
    if (native.a <= 0.0 || native.a < uAlphaTest) discard;
    float transmission = uFogMode == 2 ? exp(-uFogDensity * uFogDensity * vSourceDepth * vSourceDepth)
      : uFogMode == 1 ? 1.0 - smoothstep(uFogRange.x, uFogRange.y, vSourceDepth) : 1.0;
    // Fog removes radiance; it must never add fogColor to the emission source.
    gl_FragColor = vec4(native.rgb * native.a * uEmissionGain * transmission, native.a);
  }
`;

const QUAD_VERTEX = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const HALO_FRAGMENT = `
  ${DEPTH_GLSL}
  uniform sampler2D uEmission;
  uniform sampler2D uSourceDepth;
  uniform sampler2D uSceneDepth;
  uniform vec2 uSceneSize;
  uniform vec2 uSourceTexel;
  uniform vec4 uRect;
  uniform vec2 uDepthRange;
  uniform float uReferencePixels;
  uniform float uGain;
  uniform vec2 uKernel[${NDCG_KERNEL_TAPS.length}];
  varying vec2 vUv;
  vec4 sourceAt(vec2 uv) {
    if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return vec4(0.0);
    return texture2D(uEmission, uv);
  }
  float farthestSampleDepth(vec2 uv) {
    // Conservative four-neighbor depth gate for the bilinear color sample.
    // Never allow a nearer neighbor's depth to authorize a farther color.
    vec2 p = (floor(uv / uSourceTexel - .5) + .5) * uSourceTexel;
    float d = max(max(texture2D(uSourceDepth, p).r, texture2D(uSourceDepth, p + vec2(uSourceTexel.x, 0.0)).r),
                  max(texture2D(uSourceDepth, p + vec2(0.0, uSourceTexel.y)).r, texture2D(uSourceDepth, p + uSourceTexel).r));
    return viewDepth(d);
  }
  vec3 layer(vec2 uv, float sigma, float destinationDepth, bool gateDepth) {
    vec3 value = vec3(0.0);
    for (int i = 0; i < ${NDCG_KERNEL_TAPS.length}; i++) {
      vec2 sampleUv = uv + uKernel[i] * sigma / uRect.zw;
      vec4 source = sourceAt(sampleUv);
      if (source.a <= 0.0) continue;
      if (gateDepth && farthestSampleDepth(sampleUv) > destinationDepth + depthTolerance(destinationDepth)) continue;
      value += source.rgb;
    }
    // Fixed pre-visibility normalization: occlusion does not redistribute light.
    return value / ${NDCG_KERNEL_TAPS.length.toFixed(1)};
  }
  void main() {
    vec2 uv = (vUv * uSceneSize - uRect.xy) / uRect.zw;
    float destinationDepth = viewDepth(texture2D(uSceneDepth, vUv).r);
    float core = sourceAt(uv).a;
    vec3 glow = vec3(0.0);
    if (destinationDepth + depthTolerance(destinationDepth) >= uDepthRange.x) {
      bool gateDepth = destinationDepth < uDepthRange.y + depthTolerance(destinationDepth);
      glow = uGain * (
        .65 * layer(uv, .012 * uReferencePixels, destinationDepth, gateDepth) +
        .30 * layer(uv, .035 * uReferencePixels, destinationDepth, gateDepth) +
        .05 * layer(uv, .075 * uReferencePixels, destinationDepth, gateDepth));
    }
    // RGB accumulates radiance; separate alpha factors accumulate coverage union.
    gl_FragColor = vec4(glow, core);
  }
`;

const COMPOSITE_FRAGMENT = `
  uniform sampler2D uScene;
  uniform sampler2D uGlow;
  uniform vec2 uCropScale;
  uniform vec2 uCropOffset;
  uniform float uKnee;
  uniform float uCap;
  varying vec2 vUv;
  void main() {
    vec2 uv = vUv * uCropScale + uCropOffset;
    vec4 crisp = texture2D(uScene, uv);
    vec4 field = texture2D(uGlow, uv);
    float y = dot(field.rgb, vec3(.2126, .7152, .0722));
    float limited = y <= uKnee ? y : uKnee + (uCap - uKnee) * (1.0 - exp(-(y - uKnee) / (uCap - uKnee)));
    vec3 glow = y > 0.0 ? field.rgb * (limited / y) : vec3(0.0);
    gl_FragColor = vec4(crisp.rgb + (1.0 - clamp(field.a, 0.0, 1.0)) * glow, crisp.a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function depthUniforms() {
  return { uNear: { value: .1 }, uFar: { value: 450 }, uOrthographic: { value: false } };
}

function target(width: number, height: number, withDepth: boolean, samples = 0) {
  const value = new THREE.WebGLRenderTarget(width, height, {
    type: THREE.HalfFloatType, format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    depthBuffer: withDepth, stencilBuffer: false, samples,
  });
  value.texture.colorSpace = THREE.LinearSRGBColorSpace;
  if (withDepth) value.depthTexture = new THREE.DepthTexture(width, height, THREE.UnsignedIntType);
  return value;
}

/** Does not own the source geometry, scene, renderer, or original materials. */
export class DreamGlowRenderer {
  readonly diagnostics: DreamGlowDiagnostics;
  private readonly subjects: Subject[] = [];
  private readonly sourceScene = new THREE.Scene();
  private readonly quadScene = new THREE.Scene();
  private readonly quadCamera = new THREE.Camera();
  private readonly quadGeometry = new THREE.PlaneGeometry(2, 2);
  private readonly quad: THREE.Mesh;
  private readonly sceneTarget = target(1, 1, true, 4);
  private readonly sourceTarget = target(DREAM_EMISSION_LIMITS.sourceTextureSize, DREAM_EMISSION_LIMITS.sourceTextureSize, true, 4);
  private readonly glowTarget = target(1, 1, false);
  private readonly halo: THREE.ShaderMaterial;
  private readonly composite: THREE.ShaderMaterial;
  private extendedCamera?: Camera;
  private sourceCamera?: Camera;
  private readonly size = new THREE.Vector2();
  private readonly oldViewport = new THREE.Vector4();
  private readonly oldScissor = new THREE.Vector4();
  private readonly oldClear = new THREE.Color();
  private readonly box = new THREE.Box3();
  private readonly worldBox = new THREE.Box3();
  private readonly corner = new THREE.Vector3();
  private readonly center = new THREE.Vector3();
  private readonly worldScale = new THREE.Vector3();
  private readonly crop = new THREE.Matrix4();
  private readonly rect = new THREE.Vector4();
  private readonly sourceDepthRange = new THREE.Vector2();
  private disposed = false;
  private readonly capable: boolean;
  enabled = true;

  constructor(private readonly renderer: THREE.WebGLRenderer, groups: readonly THREE.Group[]) {
    this.capable = renderer.extensions.has("EXT_color_buffer_float");
    this.diagnostics = { profile: this.capable ? "ndcg-v0.1-native-candidate" : "core-only-no-float-target", registered: 0, rendered: 0, reducedSubjects: 0, sourceMeshes: 0, haloMeshes: 0 };
    for (const original of new Set(groups)) {
      const runtime = getDreamEmissionRuntime(original);
      if (!runtime) continue;
      const root = new THREE.Group(); root.visible = false;
      const proxies: SourceProxy[] = [];
      for (const source of runtime.sources) {
        const materials = source.materials.map((native) => this.sourceMaterial(native));
        const proxy = new THREE.Mesh(source.mesh.geometry, Array.isArray(source.mesh.material) ? materials : materials[0]);
        proxy.matrixAutoUpdate = false;
        // Culling uses the current ROI camera and original, unchanged geometry.
        root.add(proxy);
        proxies.push({ original: source.mesh, mesh: proxy, authored: source.materials, materials });
      }
      this.sourceScene.add(root);
      this.subjects.push({ original, runtime, root, proxies });
    }
    this.diagnostics.registered = this.subjects.length;
    this.diagnostics.sourceMeshes = this.subjects.reduce((sum, subject) => sum + subject.proxies.length, 0);
    this.halo = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERTEX, fragmentShader: HALO_FRAGMENT,
      uniforms: {
        ...depthUniforms(), uEmission: { value: this.sourceTarget.texture }, uSourceDepth: { value: this.sourceTarget.depthTexture },
        uSceneDepth: { value: this.sceneTarget.depthTexture }, uSceneSize: { value: new THREE.Vector2() },
        uSourceTexel: { value: new THREE.Vector2(1 / DREAM_EMISSION_LIMITS.sourceTextureSize, 1 / DREAM_EMISSION_LIMITS.sourceTextureSize) },
        uRect: { value: this.rect }, uDepthRange: { value: this.sourceDepthRange }, uReferencePixels: { value: 1 }, uGain: { value: 0 },
        uKernel: { value: NDCG_KERNEL_TAPS.map((tap) => new THREE.Vector2(tap.x, tap.y)) },
      },
      depthTest: false, depthWrite: false, transparent: true, toneMapped: false,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      blendEquationAlpha: THREE.AddEquation, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    this.composite = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERTEX, fragmentShader: COMPOSITE_FRAGMENT,
      uniforms: {
        uScene: { value: this.sceneTarget.texture }, uGlow: { value: this.glowTarget.texture },
        uCropScale: { value: new THREE.Vector2(1, 1) }, uCropOffset: { value: new THREE.Vector2() },
        uKnee: { value: NDCG_SEED.knee }, uCap: { value: NDCG_SEED.cap },
      },
      depthTest: false, depthWrite: false, blending: THREE.NoBlending,
    });
    this.quad = new THREE.Mesh(this.quadGeometry, this.composite);
    this.quad.frustumCulled = false; this.quadScene.add(this.quad);
  }

  private sourceMaterial(native: DreamSourceMaterial) {
    return new THREE.ShaderMaterial({
      vertexShader: SOURCE_VERTEX, fragmentShader: SOURCE_FRAGMENT,
      uniforms: {
        ...depthUniforms(), uSceneDepth: { value: this.sceneTarget.depthTexture }, uGlobalProjection: { value: new THREE.Matrix4() },
        uColor: { value: native.color }, uOpacity: { value: native.opacity }, uEmissionGain: { value: 1 },
        uAlphaTest: { value: native.alphaTest }, uMap: { value: native.map }, uAlphaMap: { value: native.alphaMap },
        uMapTransform: { value: new THREE.Matrix3() }, uAlphaTransform: { value: new THREE.Matrix3() },
        uFogMode: { value: 0 }, uFogDensity: { value: 0 }, uFogRange: { value: new THREE.Vector2(0, 1) },
      },
      defines: { ...(native.map ? { SOURCE_MAP: 1 } : {}), ...(native.alphaMap ? { SOURCE_ALPHA_MAP: 1 } : {}) },
      vertexColors: native.vertexColors, side: native.side,
      depthTest: true, depthWrite: true, blending: THREE.NoBlending, toneMapped: false,
    });
  }

  private configureCamera(source: Camera, destination: Camera, sx: number, sy: number, tx = 0, ty = 0) {
    destination.copy(source, false);
    destination.matrixAutoUpdate = false;
    destination.matrixWorld.copy(source.matrixWorld); destination.matrixWorldInverse.copy(source.matrixWorldInverse);
    this.crop.set(sx, 0, 0, tx, 0, sy, 0, ty, 0, 0, 1, 0, 0, 0, 0, 1);
    destination.projectionMatrix.multiplyMatrices(this.crop, source.projectionMatrix);
    destination.projectionMatrixInverse.copy(destination.projectionMatrix).invert();
  }

  private setDepthUniforms(material: THREE.ShaderMaterial, camera: Camera) {
    material.uniforms.uNear.value = camera.near;
    material.uniforms.uFar.value = camera.far;
    material.uniforms.uOrthographic.value = camera instanceof THREE.OrthographicCamera;
  }

  private prepare(subject: Subject, camera: Camera, scene: THREE.Scene, width: number, height: number): number {
    if (!dreamSourceVisible(subject.original) || !subject.runtime.profile.enabled) return 0;
    this.center.copy(subject.runtime.referenceCenter).applyMatrix4(subject.original.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
    subject.original.getWorldScale(this.worldScale);
    const referenceWorld = subject.runtime.referenceSize * Math.max(Math.abs(this.worldScale.x), Math.abs(this.worldScale.y), Math.abs(this.worldScale.z));
    const h = referenceWorld * Math.abs(camera.projectionMatrix.elements[5]) * height / 2
      / (camera instanceof THREE.PerspectiveCamera ? -this.center.z : 1);
    if (!Number.isFinite(h) || h <= 0 || h > DREAM_EMISSION_LIMITS.maxReferencePixels || -this.center.z <= camera.near) return -1;
    let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
    let nearDepth = Infinity; let farDepth = -Infinity;
    for (const proxy of subject.proxies) {
      proxy.mesh.visible = dreamSourceVisible(proxy.original) && proxy.original.layers.test(camera.layers);
      if (!proxy.mesh.visible) continue;
      proxy.mesh.matrix.copy(proxy.original.matrixWorld);
      const bounds = proxy.original.geometry.boundingBox;
      if (!bounds) continue;
      this.box.copy(bounds); this.worldBox.copy(bounds).applyMatrix4(proxy.original.matrixWorld);
      for (let i = 0; i < 8; i++) {
        this.corner.set(i & 1 ? this.worldBox.max.x : this.worldBox.min.x, i & 2 ? this.worldBox.max.y : this.worldBox.min.y, i & 4 ? this.worldBox.max.z : this.worldBox.min.z);
        this.corner.applyMatrix4(camera.matrixWorldInverse);
        const depth = -this.corner.z;
        if (depth <= camera.near || !Number.isFinite(depth)) return -1;
        nearDepth = Math.min(nearDepth, depth); farDepth = Math.max(farDepth, depth);
        this.corner.applyMatrix4(camera.projectionMatrix);
        const x = (this.corner.x * .5 + .5) * width; const y = (this.corner.y * .5 + .5) * height;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
      proxy.materials.forEach((material, index) => {
        const native = proxy.authored[index]; const uniforms = material.uniforms;
        material.visible = native.visible && native.colorWrite;
        this.setDepthUniforms(material, camera);
        uniforms.uGlobalProjection.value.copy(camera.projectionMatrix);
        uniforms.uOpacity.value = finite(native.opacity, "source opacity", 0);
        if (native.opacity > 1) throw new RangeError("source opacity exceeds one");
        for (const channel of [native.color.r, native.color.g, native.color.b]) finite(channel, "native source color", 0);
        uniforms.uAlphaTest.value = finite(native.alphaTest, "alpha test", 0);
        uniforms.uEmissionGain.value = finite(proxy.original.userData.dreamEmissionGain ?? 1, "regional emission gain", 0);
        if (native.map) { native.map.updateMatrix(); uniforms.uMapTransform.value.copy(native.map.matrix); }
        if (native.alphaMap) { native.alphaMap.updateMatrix(); uniforms.uAlphaTransform.value.copy(native.alphaMap.matrix); }
        uniforms.uFogMode.value = scene.fog instanceof THREE.FogExp2 ? 2 : scene.fog instanceof THREE.Fog ? 1 : 0;
        uniforms.uFogDensity.value = scene.fog instanceof THREE.FogExp2 ? scene.fog.density : 0;
        if (scene.fog instanceof THREE.Fog) uniforms.uFogRange.value.set(scene.fog.near, scene.fog.far);
      });
    }
    if (!Number.isFinite(minX)) return 0;
    const padding = NDCG_SEED.support * NDCG_SEED.ratios[2] * h + 2;
    if (maxX + padding < 0 || minX - padding > width || maxY + padding < 0 || minY - padding > height) return 0;
    this.rect.set(minX - padding, minY - padding, maxX - minX + padding * 2, maxY - minY + padding * 2);
    this.sourceDepthRange.set(nearDepth, farDepth);
    return h;
  }

  render(scene: THREE.Scene, camera: Camera): void {
    if (this.disposed) throw new Error("DreamGlowRenderer has been disposed");
    const renderer = this.renderer;
    const admitted = this.subjects.some(subject => subject.runtime.profile.enabled && dreamSourceVisible(subject.original));
    if (!this.capable || !this.enabled || !admitted) {
      this.diagnostics.rendered = 0;
      this.diagnostics.reducedSubjects = 0;
      this.diagnostics.profile = !this.capable ? "core-only-no-float-target" : !this.enabled ? "core-only-effects-disabled" : "core-only-no-emitting-subjects";
      renderer.render(scene, camera); return;
    }
    const previousTarget = renderer.getRenderTarget();
    if (previousTarget) this.size.set(previousTarget.width, previousTarget.height); else renderer.getDrawingBufferSize(this.size);
    const width = this.size.x; const height = this.size.y;
    // Fixed guard band avoids reallocating render targets as the camera moves.
    const padding = Math.ceil(.225 * DREAM_EMISSION_LIMITS.maxReferencePixels) + 2;
    const fullWidth = width + padding * 2; const fullHeight = height + padding * 2;
    if (fullWidth > renderer.capabilities.maxTextureSize || fullHeight > renderer.capabilities.maxTextureSize) {
      this.diagnostics.profile = "core-only-target-size-limit";
      this.diagnostics.rendered = 0; renderer.render(scene, camera); return;
    }
    if (this.sceneTarget.width !== fullWidth || this.sceneTarget.height !== fullHeight) {
      this.sceneTarget.setSize(fullWidth, fullHeight); this.glowTarget.setSize(fullWidth, fullHeight);
    }
    if (!this.extendedCamera || this.extendedCamera.type !== camera.type) {
      this.extendedCamera = camera.clone(); this.sourceCamera = camera.clone();
    }
    camera.updateWorldMatrix(true, false); scene.updateMatrixWorld(true);
    this.configureCamera(camera, this.extendedCamera, width / fullWidth, height / fullHeight);
    const expanded = this.extendedCamera; const localCamera = this.sourceCamera!;
    renderer.getViewport(this.oldViewport); renderer.getScissor(this.oldScissor); renderer.getClearColor(this.oldClear);
    const oldScissorTest = renderer.getScissorTest(); const oldAlpha = renderer.getClearAlpha();
    const oldAutoClear = renderer.autoClear; const oldToneMapping = renderer.toneMapping;
    this.diagnostics.rendered = 0; this.diagnostics.reducedSubjects = 0;
    this.diagnostics.profile = "ndcg-v0.1-native-candidate";
    try {
      renderer.setScissorTest(false); renderer.autoClear = true; renderer.toneMapping = THREE.NoToneMapping;
      renderer.setRenderTarget(this.sceneTarget); renderer.render(scene, expanded);
      renderer.setClearColor(0, 0); renderer.setRenderTarget(this.glowTarget); renderer.clear();
      renderer.autoClear = false;
      this.setDepthUniforms(this.halo, expanded);
      this.halo.uniforms.uSceneSize.value.set(fullWidth, fullHeight);
      for (const subject of this.subjects) {
        const h = this.prepare(subject, expanded, scene, fullWidth, fullHeight);
        if (h < 0) { this.diagnostics.reducedSubjects++; continue; }
        if (!h) continue;
        if (this.diagnostics.rendered >= DREAM_EMISSION_LIMITS.maxSubjects) { this.diagnostics.reducedSubjects++; continue; }
        this.configureCamera(expanded, localCamera, fullWidth / this.rect.z, fullHeight / this.rect.w,
          (fullWidth - 2 * this.rect.x - this.rect.z) / this.rect.z, (fullHeight - 2 * this.rect.y - this.rect.w) / this.rect.w);
        renderer.setScissorTest(false); renderer.setRenderTarget(this.sourceTarget); renderer.clear();
        subject.root.visible = true;
        try { renderer.render(this.sourceScene, localCamera); } finally { subject.root.visible = false; }
        renderer.setRenderTarget(this.glowTarget);
        const left = Math.max(0, Math.floor(this.rect.x)); const bottom = Math.max(0, Math.floor(this.rect.y));
        const right = Math.min(fullWidth, Math.ceil(this.rect.x + this.rect.z)); const top = Math.min(fullHeight, Math.ceil(this.rect.y + this.rect.w));
        const pixelRatio = renderer.getPixelRatio();
        renderer.setScissor(left / pixelRatio, bottom / pixelRatio, (right - left) / pixelRatio, (top - bottom) / pixelRatio); renderer.setScissorTest(true);
        this.halo.uniforms.uReferencePixels.value = h;
        this.halo.uniforms.uGain.value = subject.runtime.profile.haloStrength * subject.runtime.haloFactor;
        this.quad.material = this.halo; renderer.render(this.quadScene, this.quadCamera);
        this.diagnostics.rendered++;
      }
      if (this.diagnostics.reducedSubjects) this.diagnostics.profile = "ndcg-candidate-with-core-only-range-fallback";
      this.composite.uniforms.uCropScale.value.set(width / fullWidth, height / fullHeight);
      this.composite.uniforms.uCropOffset.value.set(padding / fullWidth, padding / fullHeight);
      renderer.setScissorTest(false); renderer.setRenderTarget(previousTarget);
      renderer.setViewport(this.oldViewport); renderer.toneMapping = oldToneMapping;
      this.quad.material = this.composite; renderer.render(this.quadScene, this.quadCamera);
    } finally {
      renderer.setRenderTarget(previousTarget); renderer.setViewport(this.oldViewport);
      renderer.setScissor(this.oldScissor); renderer.setScissorTest(oldScissorTest);
      renderer.setClearColor(this.oldClear, oldAlpha); renderer.autoClear = oldAutoClear; renderer.toneMapping = oldToneMapping;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const subject of this.subjects) for (const proxy of subject.proxies) for (const material of proxy.materials) material.dispose();
    this.sceneTarget.dispose(); this.sourceTarget.dispose(); this.glowTarget.dispose();
    this.quadGeometry.dispose(); this.halo.dispose(); this.composite.dispose();
    this.sourceScene.clear(); this.quadScene.clear(); this.subjects.length = 0;
  }
}
