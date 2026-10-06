import assert from "node:assert/strict";
import test from "node:test";
import { createStarfieldPlan } from "../app/starfield";
import { createStarPlacements, VIEW_CONFIG } from "../app/viewModel";
import { matchNativeStarComponent, projectNativeStarFootprints } from "./helpers/starfield-native-footprint";
import { RECOVERED_NATIVE_JEWEL as fixture } from "./helpers/starfield-native-jewel-fixture";

const plan = createStarfieldPlan({ seed: 255_880_124, theme: "dark", placements: createStarPlacements(255_880_124, 3_072), visibleCount: 3_072 });
const footprints = projectNativeStarFootprints(plan.stars, fixture.width, fixture.height);
const pixels = fixture.rows.flatMap((row, y) => [...row].flatMap((value, x) => (
  value === "#" ? [(fixture.y + y) * fixture.width + fixture.x + x] : []
)));
const match = (input: number[]) => matchNativeStarComponent(input, fixture.width, fixture.height, footprints);

test("NATIVE-GATE-01: independently projected original jewel explains inherited 582px component", () => {
  assert.deepEqual(VIEW_CONFIG.stars.camera, [0, 0.8, 15]);
  assert.deepEqual(VIEW_CONFIG.stars.target, [0, 1.2, 0]);
  assert.equal(pixels.length, 582);
  assert.equal(pixels.length, fixture.area);
  const proof = match(pixels);
  assert.equal(proof?.sourceIndex, 9_610);
  assert.ok(Math.abs(proof!.center.x - 57.00942) < 0.001);
  assert.ok(Math.abs(proof!.center.y - 371.58813) < 0.001);
  // Locked native geometry bounds, not the optional much wider diffuse quad.
  assert.ok(Math.abs(Math.min(...proof!.hull.map((point) => point.x)) - 40.04218) < 0.001);
  assert.ok(Math.abs(Math.max(...proof!.hull.map((point) => point.y)) - 387.9054) < 0.001);
});

test("NATIVE-GATE-02: inflated and translated pixel shapes fail the native silhouette", () => {
  assert.equal(match(pixels.map((index) => index + 10)), null);
  const center = match(pixels)!.center;
  const inflated = pixels.map((index) => {
    const x = Math.round(center.x + ((index % fixture.width) - center.x) * 1.5);
    const y = Math.round(center.y + (Math.floor(index / fixture.width) - center.y) * 1.5);
    return y * fixture.width + x;
  });
  assert.equal(match(inflated), null);
  const box = Array.from({ length: 32 * 31 }, (_, index) => (
    (fixture.y + Math.floor(index / 32)) * fixture.width + fixture.x + index % 32
  ));
  assert.equal(match(box), null);
});

test("NATIVE-GATE-03: two individually valid facets cannot certify their merged union", () => {
  const original = match(pixels)!;
  const offset = 24;
  const second = { sourceIndex: -1, center: { x: original.center.x + offset, y: original.center.y },
    hull: original.hull.map((point) => ({ x: point.x + offset, y: point.y })) };
  const shifted = pixels.map((index) => index + offset);
  assert.ok(matchNativeStarComponent(shifted, fixture.width, fixture.height, [second]));
  // The two masks overlap, so their union is one connected luminous patch.
  assert.ok(pixels.some((index) => shifted.includes(index)));
  assert.equal(matchNativeStarComponent([...new Set([...pixels, ...shifted])], fixture.width, fixture.height, [original, second]), null);
});

test("NATIVE-GATE-04: missing source, oversized source, invalid masks and off-center patches fail closed", () => {
  assert.equal(matchNativeStarComponent(pixels, fixture.width, fixture.height, []), null);
  assert.equal(match([]), null);
  assert.equal(match([NaN]), null);
  assert.equal(match([-1]), null);
  assert.equal(match([fixture.width * fixture.height]), null);
  const source = plan.stars[9_610];
  assert.deepEqual(projectNativeStarFootprints([{ ...source, scale: 1.93 }], fixture.width, fixture.height), []);
  assert.throws(() => projectNativeStarFootprints(plan.stars, 0, fixture.height), RangeError);
  const corner = pixels.filter((index) => index % fixture.width < 48);
  assert.ok(corner.length);
  assert.equal(match(corner), null);
});
