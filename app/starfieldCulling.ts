import * as THREE from "three";

type Snapshot = {
  attribute: THREE.InstancedBufferAttribute;
  source: Float32Array;
};

/** Submit only stars whose complete animated envelope can meet this camera.
 * Canonical instance data is retained, not regenerated or density-thinned.
 * Bounds cover both faceted skins, maximum pulse and all possible wander.
 */
export class StarfieldCulling {
  private readonly snapshots: Snapshot[];
  private readonly envelopes: Float64Array;
  private readonly selected: Uint32Array;
  private readonly pending: Uint32Array;
  private readonly projection = new THREE.Matrix4();
  private readonly previous = new THREE.Matrix4();
  private readonly frustum = new THREE.Frustum();
  private hasPrevious = false;
  private selectedCount: number;
  private readonly total: number;

  constructor(private readonly mesh: THREE.InstancedMesh) {
    this.total = mesh.count;
    this.selectedCount = this.total;
    const twinkle = mesh.geometry.getAttribute("aTwinkleProfile") as THREE.InstancedBufferAttribute;
    const shift = mesh.geometry.getAttribute("aShiftProfile") as THREE.InstancedBufferAttribute;
    const alpha = mesh.geometry.getAttribute("aBaseAlpha") as THREE.InstancedBufferAttribute;
    if (!mesh.instanceColor) throw new Error("Starfield requires native instance colors");
    this.snapshots = [mesh.instanceMatrix, mesh.instanceColor, twinkle, shift, alpha].map((attribute) => {
      attribute.setUsage(THREE.DynamicDrawUsage);
      return { attribute, source: new Float32Array(attribute.array) };
    });
    this.envelopes = new Float64Array(this.total * 4);
    this.selected = new Uint32Array(this.total);
    this.pending = new Uint32Array(this.total);
    const vertices = mesh.geometry.getAttribute("position");
    let geometryRadius = 0;
    for (let i = 0; i < vertices.count; i++) {
      geometryRadius = Math.max(geometryRadius, Math.hypot(vertices.getX(i), vertices.getY(i), vertices.getZ(i)));
    }
    const matrices = this.snapshots[0].source;
    for (let i = 0; i < this.total; i++) {
      const m = i * 16;
      const scale = Math.max(Math.hypot(matrices[m], matrices[m + 1], matrices[m + 2]),
        Math.hypot(matrices[m + 4], matrices[m + 5], matrices[m + 6]),
        Math.hypot(matrices[m + 8], matrices[m + 9], matrices[m + 10]));
      const e = i * 4;
      this.envelopes[e] = matrices[m + 12];
      this.envelopes[e + 1] = matrices[m + 13];
      this.envelopes[e + 2] = matrices[m + 14];
      // Each wander component is within +/- amplitude of its rest position.
      // 0.01 local units protects floating-point/raster boundary decisions.
      this.envelopes[e + 3] = geometryRadius * scale * (1 + Math.abs(twinkle.getW(i)))
        + Math.sqrt(3) * Math.abs(shift.getW(i)) + 0.01;
      this.selected[i] = i;
    }
    // Keep the original transparent sorting center, not a camera-dependent
    // center computed later from the compacted prefix.
    mesh.computeBoundingSphere();
  }

  prepare(camera: THREE.Camera): number {
    camera.updateWorldMatrix(true, false);
    this.mesh.updateWorldMatrix(true, false);
    this.projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
      .multiply(this.mesh.matrixWorld);
    if (this.hasPrevious && this.projection.equals(this.previous)) return this.selectedCount;
    const valid = this.projection.elements.every(Number.isFinite);
    if (valid) this.frustum.setFromProjectionMatrix(this.projection, camera.coordinateSystem);
    const planes = this.frustum.planes;
    let count = 0;
    for (let i = 0; i < this.total; i++) {
      const offset = i * 4;
      const x = this.envelopes[offset]; const y = this.envelopes[offset + 1];
      const z = this.envelopes[offset + 2]; const radius = this.envelopes[offset + 3];
      let outside = false;
      if (valid) for (let planeIndex = 0; planeIndex < planes.length; planeIndex++) {
        const plane = planes[planeIndex];
        if (plane.normal.x * x + plane.normal.y * y + plane.normal.z * z + plane.constant < -radius) {
          outside = true; break;
        }
      }
      if (!outside) this.pending[count++] = i;
    }
    let changed = count !== this.selectedCount;
    if (!changed) for (let i = 0; i < count; i++) {
      if (this.pending[i] !== this.selected[i]) { changed = true; break; }
    }
    if (changed) {
      // Preserve canonical order, including translucent additive blend order.
      // Upload only a changed visible prefix; steady animation uploads nothing.
      for (const { attribute, source } of this.snapshots) {
        const target = attribute.array as Float32Array;
        const stride = attribute.itemSize;
        for (let i = 0; i < count; i++) {
          const from = this.pending[i] * stride; const to = i * stride;
          for (let component = 0; component < stride; component++) target[to + component] = source[from + component];
        }
        if (count > 0) {
          attribute.clearUpdateRanges();
          attribute.addUpdateRange(0, count * stride);
          attribute.needsUpdate = true;
        }
      }
      this.selected.set(this.pending.subarray(0, count));
      this.selectedCount = count;
      this.mesh.count = count;
    }
    this.previous.copy(this.projection);
    this.hasPrevious = valid;
    return count;
  }
}
