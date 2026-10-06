import * as THREE from "three";
import type { StarfieldStar } from "../../app/starfield";

type Point = Readonly<{ x: number; y: number }>;
export type NativeStarFootprint = {
  sourceIndex: number;
  center: Point;
  hull: Point[];
};

const cross = (origin: Point, left: Point, right: Point) => (
  (left.x - origin.x) * (right.y - origin.y) - (left.y - origin.y) * (right.x - origin.x)
);

function convexHull(points: Point[]): Point[] {
  const sorted = points.toSorted((left, right) => left.x - right.x || left.y - right.y);
  const half = (input: Point[]) => {
    const result: Point[] = [];
    for (const point of input) {
      while (result.length >= 2 && cross(result.at(-2)!, result.at(-1)!, point) <= 0) result.pop();
      result.push(point);
    }
    return result.slice(0, -1);
  };
  return [...half(sorted), ...half(sorted.toReversed())];
}

/** Independent release geometry, deliberately not read from renderer buffers,
 * culling bounds, atmosphere radii or production constants. The fixed native
 * octahedral halo is radius 1.5; projected at the initial still Stars camera.
 * Thus enlarging a shader halo or adding a diffuse patch cannot enlarge the
 * test's acceptance region. Source scale remains capped at the authored 1.92.
 */
export function projectNativeStarFootprints(
  stars: readonly StarfieldStar[], width: number, height: number,
): NativeStarFootprint[] {
  if (![width, height].every((value) => Number.isSafeInteger(value) && value > 0)) {
    throw new RangeError("A positive integer raster is required");
  }
  const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 450);
  camera.position.set(0, 0.8, 15);
  camera.lookAt(0, 1.2, 0);
  camera.updateMatrixWorld();
  const toPixel = (point: THREE.Vector3) => {
    const projected = point.add(camera.position).project(camera);
    return { x: (projected.x + 1) * width / 2, y: (1 - projected.y) * height / 2 };
  };
  const footprints: NativeStarFootprint[] = [];
  stars.forEach((star, sourceIndex) => {
    if (star.prominence !== "jewel" || !(star.scale > 0 && star.scale <= 1.92)) return;
    const source = new THREE.Vector3(star.x, star.y, star.z);
    const depth = source.clone().add(camera.position).applyMatrix4(camera.matrixWorldInverse).z;
    if (depth >= -4) return;
    const center = toPixel(source.clone());
    if (center.x < -50 || center.x > width + 50 || center.y < -50 || center.y > height + 50) return;
    const hash = (salt: number) => {
      const value = Math.sin(star.x * 12.9898 + star.y * 78.233 + star.z * 37.719 + star.rotation * 19.19 + salt) * 43_758.5453;
      return value - Math.floor(value);
    };
    // The original time-zero waveform and uploaded float precision. No wander
    // occurs at t=0; the reduced-motion fixture asserts that pose separately.
    const phase = Math.fround(star.rotation + hash(2.31) * Math.PI * 2);
    const pulse = 1 + (Math.sin(phase) * 0.55 + Math.sin(phase * 1.71) * 0.28
      + Math.sin(phase * 0.47) * 0.17) * Math.fround(0.1 + hash(7.73) * 0.21);
    const rotation = new THREE.Euler(star.rotation, star.rotation * 0.61, star.rotation * 1.37);
    const vertices = [[1.5, 0, 0], [-1.5, 0, 0], [0, 1.5, 0], [0, -1.5, 0], [0, 0, 1.5], [0, 0, -1.5]];
    const hull = convexHull(vertices.map(([x, y, z]) => toPixel(new THREE.Vector3(
      x * star.scale * pulse, y * star.scale * 0.94 * pulse, z * star.scale * 0.86 * pulse,
    ).applyEuler(rotation).add(source))));
    footprints.push({ sourceIndex, center, hull });
  });
  return footprints;
}

function containsPixel(point: Point, hull: readonly Point[]): boolean {
  if (hull.length < 3 || !hull.every((vertex) => Number.isFinite(vertex.x) && Number.isFinite(vertex.y))) return false;
  if (hull.every((start, index) => cross(start, hull[(index + 1) % hull.length], point) >= 0)) return true;
  // Two physical raster pixels cover antialiasing and GPU float differences;
  // this margin does not grow with a source's size or a diffuse glow radius.
  return hull.some((start, index) => {
    const end = hull[(index + 1) % hull.length];
    const dx = end.x - start.x; const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    if (!lengthSquared) return false;
    const fraction = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
    return Math.hypot(point.x - (start.x + fraction * dx), point.y - (start.y + fraction * dy)) <= 2;
  });
}

/** Every pixel must fit ONE original native silhouette and the observed core
 * must coincide with that source's center. Taking a union of different stars
 * would let a merged luminous patch pass, so it is deliberately disallowed.
 */
export function matchNativeStarComponent(
  pixels: readonly number[], width: number, height: number, footprints: readonly NativeStarFootprint[],
): NativeStarFootprint | null {
  if (!pixels.length || ![width, height].every((value) => Number.isSafeInteger(value) && value > 0)
    || pixels.some((index) => !Number.isSafeInteger(index) || index < 0 || index >= width * height)) return null;
  const points = pixels.map((index) => ({ x: index % width + 0.5, y: Math.floor(index / width) + 0.5 }));
  return footprints.find(({ center, hull }) => points.some((point) => Math.hypot(point.x - center.x, point.y - center.y) <= 2)
    && points.every((point) => containsPixel(point, hull))) ?? null;
}
