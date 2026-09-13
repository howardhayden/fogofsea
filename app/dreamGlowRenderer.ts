import * as THREE from "three";
import { createDreamGlowKernel, DREAM_GLOW_MODEL } from "./dreamGlowMath";
import { isDreamEmissionVisible, type DreamEmissionRuntime } from "./dreamEmission";

type SourcePart = { original: THREE.Mesh; proxy: THREE.Mesh; materials: THREE.ShaderMaterial[] };
type Subject = { root: THREE.Group; runtime: DreamEmissionRuntime; proxy: THREE.Group; parts: SourcePart[] };
type Camera = THREE.PerspectiveCamera | THREE.OrthographicCamera;
const SIZE = DREAM_GLOW_MODEL.captureSize;
const REF = DREAM_GLOW_MODEL.captureReferencePixels;

const depthFunctions = `
  uniform sampler2D uSceneDepth;
  uniform vec2 uNearFar;
  uniform bool uPerspective;
  float viewDistance(float d) {
    return uPerspective
      ? uNearFar.x * uNearFar.y / (uNearFar.y - (uNearFar.y - uNearFar.x) * d)
      : mix(uNearFar.x, uNearFar.y, d);
  }
  bool blocked(float sourceDepth, float destinationDepth) {
    float s = viewDistance(sourceDepth);
    return s > viewDistance(destinationDepth) + max(0.001, s * 0.0001);
  }
`;

const sourceVertex = `
  varying float vViewDepth;
  #ifdef USE_COLOR
    varying vec3 vTint;
  #endif
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewDepth = -mv.z;
    #ifdef USE_COLOR
      vTint = color;
    #endif
    gl_Position = projectionMatrix * mv;
  }
`;
const sourceFragment = `
  ${depthFunctions}
  uniform vec4 uCaptureRect;
  uniform vec2 uCaptureViewport;
  uniform vec3 uNativeColor;
  uniform float uOpacity;
  uniform float uAlphaTest;
  uniform bool uMask;
  uniform vec3 uFog;
  uniform float uFogFar;
  varying float vViewDepth;
  #ifdef USE_COLOR
    varying vec3 vTint;
  #endif
  void main() {
    if (uOpacity <= uAlphaTest) discard;
    vec2 screenUv = uCaptureRect.xy + gl_FragCoord.xy / uCaptureViewport * uCaptureRect.zw;
    if (any(lessThan(screenUv, vec2(0.0))) || any(greaterThan(screenUv, vec2(1.0)))) discard;
    if (blocked(gl_FragCoord.z, texture2D(uSceneDepth, screenUv).x)) discard;
    if (uMask) { gl_FragColor = vec4(vec3(uOpacity), uOpacity); return; }
    float transmission = uFog.x > 1.5
      ? exp(-uFog.y * uFog.y * vViewDepth * vViewDepth)
      : uFog.x > 0.5 ? 1.0 - smoothstep(uFog.z, uFogFar, vViewDepth) : 1.0;
    vec3 tint = uNativeColor;
    #ifdef USE_COLOR
      tint *= vTint;
    #endif
    gl_FragColor = vec4(tint * transmission * uOpacity, uOpacity);
  }
`;
const quadVertex = `
  uniform vec4 uRect;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4((uRect.xy + uv * uRect.zw) * 2.0 - 1.0, 0.0, 1.0);
  }
`;

function target(width: number, height: number, depth = false, samples = 0) {
  const result = new THREE.WebGLRenderTarget(width, height, {
    type: THREE.HalfFloatType, format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    depthBuffer: depth, stencilBuffer: false, samples,
  });
  result.texture.colorSpace = THREE.LinearSRGBColorSpace;
  if (depth) result.depthTexture = new THREE.DepthTexture(width, height, THREE.UnsignedIntType);
  return result;
}

/** Native-color, source-local convolution, not a whole-scene bloom threshold.
 * Geometry is borrowed, never enlarged. The bounded capture raster is an
 * explicitly recorded approximation; the crisp scene remains full resolution. */
export class DreamGlowRenderer {
  readonly subjects: Subject[] = [];
  mode: "native-shape-field" | "core-only-fallback" | "off" = "off";
  renderedSubjects = 0;
  private readonly sourceScene = new THREE.Scene();
  private readonly quadScene = new THREE.Scene();
  private readonly quadCamera = new THREE.Camera();
  private readonly geometry = new THREE.PlaneGeometry(2, 2);
  private readonly quad: THREE.Mesh;
  private readonly base = target(1, 1, true, 4);
  private readonly mask = target(1, 1, true, 4);
  private readonly accumulation = target(1, 1);
  private readonly capture = target(SIZE, SIZE, true, 4);
  private readonly filtered = target(SIZE, SIZE);
  private readonly kernel: THREE.DataTexture;
  private readonly convolution: THREE.ShaderMaterial;
  private readonly scatter: THREE.ShaderMaterial;
  private readonly composite: THREE.ShaderMaterial;
  private readonly scratchCamera: Camera;
  private readonly frameSize = new THREE.Vector2();
  private readonly worldBox = new THREE.Box3();
  private readonly partBox = new THREE.Box3();
  private readonly center = new THREE.Vector3();
  private readonly corner = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();
  private readonly clearColor = new THREE.Color();
  private disposed = false;
  private supported: boolean;

  constructor(private readonly renderer: THREE.WebGLRenderer, camera: Camera, roots: readonly THREE.Group[]) {
    this.scratchCamera = camera.clone();
    this.supported = renderer.extensions.has("EXT_color_buffer_float");
    const kernel = createDreamGlowKernel();
    this.kernel = new THREE.DataTexture(kernel.data, kernel.width, kernel.width, THREE.RedFormat, THREE.FloatType);
    this.kernel.minFilter = this.kernel.magFilter = THREE.NearestFilter;
    this.kernel.needsUpdate = true;
    this.filtered.texture.generateMipmaps = true;
    this.filtered.texture.minFilter = THREE.LinearMipmapLinearFilter;
    const nearFar = new THREE.Vector2(camera.near, camera.far);
    const perspective = camera instanceof THREE.PerspectiveCamera;
    const rect = () => ({ value: new THREE.Vector4(0, 0, 1, 1) });
    this.convolution = new THREE.ShaderMaterial({
      name: "dream-glow-radial-convolution",
      uniforms: {
        uRect: rect(), uSource: { value: this.capture.texture }, uSourceDepth: { value: this.capture.depthTexture },
        uSceneDepth: { value: this.base.depthTexture }, uKernel: { value: this.kernel },
        uNearFar: { value: nearFar.clone() }, uPerspective: { value: perspective },
        uCaptureRect: rect(), uCaptureViewport: { value: new THREE.Vector2() }, uGain: { value: 0 },
      },
      vertexShader: quadVertex,
      fragmentShader: `
        ${depthFunctions}
        uniform sampler2D uSource;
        uniform sampler2D uSourceDepth;
        uniform sampler2D uKernel;
        uniform vec4 uCaptureRect;
        uniform vec2 uCaptureViewport;
        uniform float uGain;
        void main() {
          vec2 screenUv = uCaptureRect.xy + gl_FragCoord.xy / uCaptureViewport * uCaptureRect.zw;
          float destinationDepth = texture2D(uSceneDepth, clamp(screenUv, 0.0, 1.0)).x;
          vec3 total = vec3(0.0);
          for (int y = -${kernel.radius}; y <= ${kernel.radius}; y++) {
            for (int x = -${kernel.radius}; x <= ${kernel.radius}; x++) {
              float weight = texture2D(uKernel, (vec2(float(x), float(y)) + ${kernel.radius}.5) / ${kernel.width}.0).r;
              if (weight <= 0.0) continue;
              vec2 pixel = gl_FragCoord.xy + vec2(float(x), float(y));
              if (any(lessThan(pixel, vec2(0.5))) || any(greaterThan(pixel, uCaptureViewport - 0.5))) continue;
              vec2 uv = pixel / ${SIZE}.0;
              vec4 source = texture2D(uSource, uv);
              if (source.a <= 0.0 || blocked(texture2D(uSourceDepth, uv).x, destinationDepth)) continue;
              total += source.rgb * weight;
            }
          }
          // Visibility removes mass; never normalize the surviving weights.
          gl_FragColor = vec4(total * uGain, 0.0);
        }
      `,
      depthTest: false, depthWrite: false, blending: THREE.NoBlending, toneMapped: false,
    });
    this.scatter = new THREE.ShaderMaterial({
      name: "dream-glow-source-local-accumulation",
      uniforms: {
        uRect: rect(), uField: { value: this.filtered.texture }, uUvScale: { value: new THREE.Vector2() },
        uSceneDepth: { value: this.base.depthTexture }, uNearFar: { value: nearFar.clone() },
        uPerspective: { value: perspective }, uFrameSize: { value: new THREE.Vector2() },
        uSourceFarDistance: { value: 0 },
      },
      vertexShader: quadVertex,
      fragmentShader: `
        ${depthFunctions}
        uniform sampler2D uField;
        uniform vec2 uUvScale;
        uniform vec2 uFrameSize;
        uniform float uSourceFarDistance;
        varying vec2 vUv;
        void main() {
          // Resampling may straddle a foreground edge even when every capture
          // texel passed its own depth test. Guard the final physical pixel.
          // The farthest source bound is conservative: it may trim mixed-depth
          // spill but never admits light from a contributor behind foreground.
          float destination = viewDistance(texture2D(uSceneDepth, gl_FragCoord.xy / uFrameSize).x);
          if (uSourceFarDistance > destination + max(0.001, uSourceFarDistance * 0.0001)) discard;
          gl_FragColor = vec4(texture2D(uField, vUv * uUvScale).rgb, 0.0);
        }
      `,
      transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor,
    });
    this.composite = new THREE.ShaderMaterial({
      name: "dream-glow-core-protected-output",
      uniforms: { uRect: rect(), uBase: { value: this.base.texture }, uMask: { value: this.mask.texture }, uGlow: { value: this.accumulation.texture } },
      vertexShader: quadVertex,
      fragmentShader: `
        uniform sampler2D uBase;
        uniform sampler2D uMask;
        uniform sampler2D uGlow;
        varying vec2 vUv;
        void main() {
          vec3 glow = texture2D(uGlow, vUv).rgb;
          float luminance = dot(glow, vec3(0.2126, 0.7152, 0.0722));
          if (luminance > 0.3) glow *= (0.3 + 0.2 * (1.0 - exp(-(luminance - 0.3) / 0.2))) / luminance;
          float protection = clamp(texture2D(uMask, vUv).a, 0.0, 1.0);
          gl_FragColor = vec4(texture2D(uBase, vUv).rgb + (1.0 - protection) * glow, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      depthTest: false, depthWrite: false, blending: THREE.NoBlending,
    });
    this.quad = new THREE.Mesh(this.geometry, this.composite);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
    for (const root of roots) {
      const runtime = root.userData.dreamEmission as DreamEmissionRuntime | undefined;
      if (!runtime) continue;
      const proxy = new THREE.Group();
      const parts = runtime.parts.map(({ mesh }): SourcePart => {
        const originals = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const materials = originals.map((material) => {
          const native = material as THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
          // Current FOG OF SEA subjects are untextured native-color meshes. Do
          // not falsely qualify a textured/skinned future subject as equivalent.
          if (native.map || native.alphaMap || mesh instanceof THREE.SkinnedMesh || mesh instanceof THREE.InstancedMesh) this.supported = false;
          return new THREE.ShaderMaterial({
            name: "dream-glow-visible-native-source",
            uniforms: {
              uNativeColor: { value: native.color.clone() }, uOpacity: { value: native.opacity },
              uAlphaTest: { value: native.alphaTest }, uSceneDepth: { value: this.base.depthTexture },
              uCaptureRect: rect(), uCaptureViewport: { value: new THREE.Vector2() },
              uNearFar: { value: nearFar.clone() }, uPerspective: { value: perspective },
              uMask: { value: false }, uFog: { value: new THREE.Vector3() }, uFogFar: { value: 1 },
            },
            vertexShader: sourceVertex, fragmentShader: sourceFragment,
            side: native.side, vertexColors: native.vertexColors,
            depthTest: true, depthWrite: true, transparent: true, toneMapped: false,
            blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
            blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
          });
        });
        const copy = new THREE.Mesh(mesh.geometry, Array.isArray(mesh.material) ? materials : materials[0]);
        copy.matrixAutoUpdate = false;
        copy.frustumCulled = false;
        proxy.add(copy);
        return { original: mesh, proxy: copy, materials };
      });
      this.sourceScene.add(proxy);
      this.subjects.push({ root, runtime, proxy, parts });
    }
  }

  private draw(target: THREE.WebGLRenderTarget | null, material: THREE.ShaderMaterial) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.quadCamera);
  }

  private setSourceUniforms(subject: Subject, rect: THREE.Vector4, width: number, height: number, mask: boolean, scene: THREE.Scene, camera: Camera) {
    for (const part of subject.parts) {
      const nativeMaterials = Array.isArray(part.original.material) ? part.original.material : [part.original.material];
      part.proxy.matrix.copy(part.original.matrixWorld);
      part.proxy.visible = isDreamEmissionVisible(part.original);
      part.materials.forEach((material, index) => {
        const native = nativeMaterials[index] as THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
        const u = material.uniforms;
        u.uNativeColor.value.copy(native.color);
        u.uOpacity.value = native.visible ? native.opacity : 0;
        u.uAlphaTest.value = native.alphaTest;
        u.uCaptureRect.value.copy(rect);
        u.uCaptureViewport.value.set(width, height);
        u.uNearFar.value.set(camera.near, camera.far);
        u.uPerspective.value = camera instanceof THREE.PerspectiveCamera;
        u.uMask.value = mask;
        if (native.fog && scene.fog instanceof THREE.FogExp2) u.uFog.value.set(2, scene.fog.density, 0);
        else if (native.fog && scene.fog instanceof THREE.Fog) { u.uFog.value.set(1, 0, scene.fog.near); u.uFogFar.value = scene.fog.far; }
        else u.uFog.value.set(0, 0, 0);
      });
    }
  }

  /** Returns an unclipped crop. Reference scale never comes from screen clipping. */
  private footprint(subject: Subject, camera: Camera, width: number, height: number) {
    this.worldBox.makeEmpty();
    for (const part of subject.parts) {
      if (!isDreamEmissionVisible(part.original)) continue;
      const box = part.original.geometry.boundingBox;
      if (box) this.worldBox.union(this.partBox.copy(box).applyMatrix4(part.original.matrixWorld));
    }
    if (this.worldBox.isEmpty()) return null;
    this.worldBox.getCenter(this.center).applyMatrix4(camera.matrixWorldInverse);
    const distance = -this.center.z;
    if (distance <= camera.near) return null; // near-plane straddling is fail-closed, not a screen-sized aura
    subject.root.getWorldScale(this.scale);
    const worldReference = subject.runtime.referenceSize * Math.max(Math.abs(this.scale.x), Math.abs(this.scale.y), Math.abs(this.scale.z));
    const referencePixels = worldReference * height * camera.projectionMatrix.elements[5] * 0.5
      / (camera instanceof THREE.PerspectiveCamera ? distance : 1);
    if (!Number.isFinite(referencePixels) || referencePixels <= 0) return null;
    let left = Infinity; let right = -Infinity; let bottom = Infinity; let top = -Infinity; let farDistance = 0;
    for (let index = 0; index < 8; index++) {
      this.corner.set(index & 1 ? this.worldBox.max.x : this.worldBox.min.x, index & 2 ? this.worldBox.max.y : this.worldBox.min.y, index & 4 ? this.worldBox.max.z : this.worldBox.min.z);
      this.corner.applyMatrix4(camera.matrixWorldInverse);
      if (-this.corner.z <= camera.near) return null;
      farDistance = Math.max(farDistance, -this.corner.z);
      this.corner.applyMatrix4(camera.projectionMatrix);
      const x = (this.corner.x * 0.5 + 0.5) * width;
      const y = (this.corner.y * 0.5 + 0.5) * height;
      left = Math.min(left, x); right = Math.max(right, x); bottom = Math.min(bottom, y); top = Math.max(top, y);
    }
    const pixelsPerCapturePixel = referencePixels / REF;
    const padding = (Math.ceil(REF * 0.225) + 2) * pixelsPerCapturePixel;
    left -= padding; right += padding; bottom -= padding; top += padding;
    if (right < 0 || left > width || top < 0 || bottom > height) return null;
    const captureWidth = Math.ceil((right - left) / pixelsPerCapturePixel);
    const captureHeight = Math.ceil((top - bottom) / pixelsPerCapturePixel);
    if (captureWidth > SIZE || captureHeight > SIZE) return null;
    // Extend the far edges to preserve exactly REF capture pixels/reference.
    right = left + captureWidth * pixelsPerCapturePixel;
    top = bottom + captureHeight * pixelsPerCapturePixel;
    return { rect: new THREE.Vector4(left / width, bottom / height, (right - left) / width, (top - bottom) / height), captureWidth, captureHeight, farDistance };
  }

  render(scene: THREE.Scene, camera: Camera) {
    if (this.disposed) throw new Error("DreamGlowRenderer has been disposed");
    const renderer = this.renderer;
    this.renderedSubjects = 0;
    if (!this.subjects.length || !this.supported) {
      this.mode = this.subjects.length ? "core-only-fallback" : "off";
      renderer.render(scene, camera);
      return;
    }
    const priorTarget = renderer.getRenderTarget();
    const priorAutoClear = renderer.autoClear;
    const priorClearAlpha = renderer.getClearAlpha();
    renderer.getClearColor(this.clearColor);
    const priorInfoReset = renderer.info.autoReset;
    renderer.getDrawingBufferSize(this.frameSize);
    const width = this.frameSize.x; const height = this.frameSize.y;
    for (const buffer of [this.base, this.mask, this.accumulation]) if (buffer.width !== width || buffer.height !== height) buffer.setSize(width, height);
    const fullRect = new THREE.Vector4(0, 0, 1, 1);
    try {
      renderer.info.reset();
      renderer.info.autoReset = false;
      renderer.autoClear = true;
      renderer.setRenderTarget(this.base);
      renderer.render(scene, camera);
      renderer.setClearColor(0x000000, 0);
      for (const subject of this.subjects) {
        subject.proxy.visible = isDreamEmissionVisible(subject.root);
        this.setSourceUniforms(subject, fullRect, width, height, true, scene, camera);
      }
      renderer.setRenderTarget(this.mask);
      renderer.render(this.sourceScene, camera);
      renderer.setRenderTarget(this.accumulation);
      renderer.clear();
      for (const subject of this.subjects) subject.proxy.visible = false;
      this.scratchCamera.copy(camera);
      for (const subject of this.subjects) {
        if (!isDreamEmissionVisible(subject.root) || subject.runtime.gain <= 0) continue;
        const footprint = this.footprint(subject, camera, width, height);
        if (!footprint) continue;
        const { rect, captureWidth: cw, captureHeight: ch } = footprint;
        this.scratchCamera.setViewOffset(width, height, rect.x * width, (1 - rect.y - rect.w) * height, rect.z * width, rect.w * height);
        this.setSourceUniforms(subject, rect, cw, ch, false, scene, camera);
        subject.proxy.visible = true;
        this.capture.viewport.set(0, 0, cw, ch);
        renderer.autoClear = true;
        renderer.setRenderTarget(this.capture);
        renderer.render(this.sourceScene, this.scratchCamera);
        subject.proxy.visible = false;
        const u = this.convolution.uniforms;
        u.uCaptureRect.value.copy(rect);
        u.uCaptureViewport.value.set(cw, ch);
        u.uNearFar.value.set(camera.near, camera.far);
        u.uPerspective.value = camera instanceof THREE.PerspectiveCamera;
        u.uGain.value = subject.runtime.gain;
        this.filtered.viewport.set(0, 0, cw, ch);
        this.draw(this.filtered, this.convolution);
        this.scatter.uniforms.uRect.value.copy(rect);
        this.scatter.uniforms.uUvScale.value.set(cw / SIZE, ch / SIZE);
        this.scatter.uniforms.uFrameSize.value.set(width, height);
        this.scatter.uniforms.uNearFar.value.set(camera.near, camera.far);
        this.scatter.uniforms.uPerspective.value = camera instanceof THREE.PerspectiveCamera;
        this.scatter.uniforms.uSourceFarDistance.value = footprint.farDistance;
        renderer.autoClear = false;
        this.draw(this.accumulation, this.scatter);
        this.renderedSubjects++;
      }
      renderer.autoClear = true;
      this.draw(priorTarget, this.composite);
      this.mode = "native-shape-field";
    } finally {
      renderer.autoClear = priorAutoClear;
      renderer.info.autoReset = priorInfoReset;
      renderer.setClearColor(this.clearColor, priorClearAlpha);
      renderer.setRenderTarget(priorTarget);
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const subject of this.subjects) for (const part of subject.parts) for (const material of part.materials) material.dispose();
    for (const buffer of [this.base, this.mask, this.accumulation, this.capture, this.filtered]) buffer.dispose();
    this.kernel.dispose();
    this.convolution.dispose(); this.scatter.dispose(); this.composite.dispose();
    this.geometry.dispose();
    this.sourceScene.clear(); this.quadScene.clear();
  }
}
