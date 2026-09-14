import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { createStarPlacements } from "../app/viewModel";
import { createStarfield, createStarfieldPlan, prepareStarfieldForCamera, updateStarfield, STARFIELD_LIMITS } from "../app/starfield";

function fixture() {
  const seed = 0xc0ffee;
  const plan = createStarfieldPlan({ seed, theme: "dark", placements: createStarPlacements(seed, 3072), visibleCount: 3072 });
  const scene = new THREE.Scene(); const runtime = createStarfield(scene, plan);
  const camera = new THREE.PerspectiveCamera(42, 1.5, 0.1, 450);
  const mesh = runtime.starBatches[0].mesh;
  return { runtime, plan, camera, mesh };
}

function attributes(mesh: THREE.InstancedMesh): THREE.BufferAttribute[] {
  return [mesh.instanceMatrix, mesh.instanceColor!, mesh.geometry.getAttribute("aTwinkleProfile") as THREE.BufferAttribute,
    mesh.geometry.getAttribute("aShiftProfile") as THREE.BufferAttribute, mesh.geometry.getAttribute("aBaseAlpha") as THREE.BufferAttribute];
}

function dispose(mesh: THREE.InstancedMesh) {
  mesh.dispose(); mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose();
}

test("STAR-PERF-01: all 15,360 canonical lights remain; only provably outside envelopes are not submitted", () => {
  const { runtime, plan, camera, mesh } = fixture();
  const originals = attributes(mesh).map(a => Array.from(a.array));
  const geometry = mesh.geometry; const material = mesh.material;
  assert.equal(mesh.count, STARFIELD_LIMITS.maxStars);
  prepareStarfieldForCamera(runtime, camera);
  assert.equal(plan.stars.length, 15360);
  assert.ok(mesh.count > 500 && mesh.count < 5000, `submitted ${mesh.count}`);
  assert.equal(mesh.geometry, geometry); assert.equal(mesh.material, material);
  const frustum = new THREE.Frustum().setFromProjectionMatrix(camera.projectionMatrix);
  const originalMatrices = originals[0];
  const selected = new Set<string>();
  for (let i = 0; i < mesh.count; i++) selected.add(Array.from(mesh.instanceMatrix.array.slice(i * 16, i * 16 + 16)).join(","));
  // Independent geometric check: every original center within the camera is
  // retained. Boundary sweeps below check animated facet vertices as well.
  for (let i = 0; i < plan.stars.length; i++) {
    const p = new THREE.Vector3(...originalMatrices.slice(i * 16 + 12, i * 16 + 15) as [number, number, number]);
    if (frustum.containsPoint(p)) assert.ok(selected.has(originalMatrices.slice(i * 16, i * 16 + 16).join(",")));
  }
  // Restore an invalid projection conservatively rather than deleting sources.
  camera.projectionMatrix.elements[0] = NaN;
  prepareStarfieldForCamera(runtime, camera);
  assert.equal(mesh.count, plan.stars.length);
  attributes(mesh).forEach((a, i) => assert.deepEqual(Array.from(a.array), originals[i]));
  dispose(mesh);
});

test("STAR-PERF-02: camera turns restore canonical data in order and stationary animation uploads nothing", () => {
  const { runtime, camera, mesh } = fixture();
  prepareStarfieldForCamera(runtime, camera);
  const first = attributes(mesh).map(a => Array.from(a.array.slice(0, mesh.count * a.itemSize)));
  const count = mesh.count; const versions = attributes(mesh).map(a => a.version);
  for (const t of [0, 0.001, 10, 500, 100000]) {
    updateStarfield(runtime, t, false, camera.position); prepareStarfieldForCamera(runtime, camera);
    assert.deepEqual(attributes(mesh).map(a => a.version), versions);
  }
  camera.rotation.y = Math.PI; prepareStarfieldForCamera(runtime, camera);
  camera.rotation.y = 0; prepareStarfieldForCamera(runtime, camera);
  assert.equal(mesh.count, count);
  attributes(mesh).forEach((a, i) => assert.deepEqual(Array.from(a.array.slice(0, count * a.itemSize)), first[i]));
  updateStarfield(runtime, 20, true); assert.equal(runtime.starBatches[0].material.uniforms.uTime.value, 0);
  dispose(mesh);
});

test("STAR-PERF-03: conservative envelopes retain all extreme pulse/wander vertices across seams, FOV and roll", () => {
  const { runtime, camera, mesh } = fixture();
  const original = new Float32Array(mesh.instanceMatrix.array);
  const shift = new Float32Array(mesh.geometry.getAttribute("aShiftProfile").array);
  const twinkle = new Float32Array(mesh.geometry.getAttribute("aTwinkleProfile").array);
  const vertices = mesh.geometry.getAttribute("position");
  const matrix = new THREE.Matrix4(); const point = new THREE.Vector3();
  for (let pose = 0; pose < 8; pose++) {
    camera.rotation.set((pose - 3) * 0.22, pose * Math.PI / 4, pose * 0.3);
    camera.fov = pose % 2 ? 80 : 28; camera.aspect = pose % 3 ? 1.5 : 0.4; camera.updateProjectionMatrix();
    prepareStarfieldForCamera(runtime, camera);
    const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const selected = new Set<string>();
    for (let i = 0; i < mesh.count; i++) selected.add(Array.from(mesh.instanceMatrix.array.slice(i * 16, i * 16 + 16)).join(","));
    for (let i = 0; i < runtime.plan.stars.length; i += 7) {
      const key = Array.from(original.slice(i * 16, i * 16 + 16)).join(",");
      if (selected.has(key)) continue;
      matrix.fromArray(original, i * 16);
      for (let sign = 0; sign < 8; sign++) for (let v = 0; v < vertices.count; v += 3) {
        point.fromBufferAttribute(vertices, v).multiplyScalar(1 + twinkle[i * 4 + 3]).applyMatrix4(matrix);
        point.x += (sign & 1 ? 1 : -1) * shift[i * 4 + 3];
        point.y += (sign & 2 ? 1 : -1) * shift[i * 4 + 3];
        point.z += (sign & 4 ? 1 : -1) * shift[i * 4 + 3];
        assert.equal(frustum.containsPoint(point), false, `lost animated facet: pose ${pose} source ${i}`);
      }
    }
  }
  dispose(mesh);
});

test("STAR-PERF-04: empty fields remain valid and the star material cannot affect the depth-only pass", () => {
  const empty = createStarfield(new THREE.Scene(), { seed: 0, theme: "dark", appearance: "direct sky", stars: [], nebulae: [], counts: { near: 0, far: 0, still: 0, swirling: 0, field: 0, nebula: 0 } });
  prepareStarfieldForCamera(empty, new THREE.PerspectiveCamera());
  const { mesh } = fixture(); assert.equal((mesh.material as THREE.Material).depthWrite, false); dispose(mesh);
});
