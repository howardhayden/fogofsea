import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  perspectiveSolidAngle, referenceFieldCount, referenceFieldPinpoints, referenceProjectedArea,
  STARFIELD_DENSITY_REFERENCE,
} from "./helpers/starfield-density";

const minimum = STARFIELD_DENSITY_REFERENCE.minimumPinpoints;

test("MOBILE-GATE-01: reference FOV is bound to the actual application camera", () => {
  const source = readFileSync(new URL("../app/Battlefield.tsx", import.meta.url), "utf8");
  assert.match(source, /new THREE\.PerspectiveCamera\(42, container\.clientWidth \/ container\.clientHeight,/);
  assert.equal(STARFIELD_DENSITY_REFERENCE.verticalFovDegrees, 42);
  assert.equal(minimum, 300);
});

test("MOBILE-GATE-02: a 90-degree square frustum subtends one sixth of the sphere", () => {
  assert.ok(Math.abs(perspectiveSolidAngle(100, 100, 90) - 2 * Math.PI / 3) < 1e-12);
});

test("MOBILE-GATE-03: desktop count and strict existing threshold are unchanged", () => {
  assert.equal(referenceFieldPinpoints(300, 1280, 648), 300);
  assert.equal(referenceFieldPinpoints(305, 1280, 648), 305);
  assert.equal(referenceFieldPinpoints(300, 1280, 648) > minimum, false);
  assert.equal(referenceFieldPinpoints(301, 1280, 648) > minimum, true);
});

test("MOBILE-GATE-04: density is independent of viewport pixel scale, not aspect ratio", () => {
  assert.equal(perspectiveSolidAngle(320, 681, 42), perspectiveSolidAngle(640, 1362, 42));
  assert.ok(perspectiveSolidAngle(320, 681, 42) < perspectiveSolidAngle(1280, 648, 42));
  const relative = perspectiveSolidAngle(320, 681, 42) / perspectiveSolidAngle(1280, 648, 42);
  assert.ok(Math.abs(relative - 0.29166727914918156) < 1e-12);
});

test("MOBILE-GATE-05: observed portrait density exceeds the same desktop minimum", () => {
  assert.ok(Math.abs(referenceFieldPinpoints(99, 320, 681) - 339.4278586504166) < 1e-9);
  assert.ok(referenceFieldPinpoints(99, 320, 681) > referenceFieldPinpoints(305, 1280, 648));
  assert.ok(referenceFieldPinpoints(110, 320, 681) > minimum);
});

test("MOBILE-GATE-06: component abundance uses the same field-of-view comparison", () => {
  assert.ok(referenceFieldCount(213, 320, 681) > 650);
  assert.ok(referenceFieldCount(216, 320, 681) > 450);
  assert.equal(referenceFieldCount(650, 1280, 648) > 650, false);
  assert.equal(referenceFieldCount(651, 1280, 648) > 650, true);
});

test("MOBILE-GATE-07: empty and genuinely sparse portrait skies still fail", () => {
  for (const count of [0, 1, 50, 87]) assert.equal(referenceFieldPinpoints(count, 320, 681) > minimum, false);
  assert.equal(referenceFieldPinpoints(88, 320, 681) > minimum, true);
  assert.equal(referenceFieldPinpoints(200, 1280, 648) > minimum, false);
});

test("MOBILE-GATE-08: invalid counts and projection data fail closed", () => {
  for (const count of [-1, 1.5, NaN, Infinity]) assert.throws(() => referenceFieldPinpoints(count, 320, 681), RangeError);
  for (const dimension of [0, -1, 0.5, NaN, Infinity]) {
    assert.throws(() => referenceFieldPinpoints(99, dimension, 681), RangeError);
    assert.throws(() => referenceFieldPinpoints(99, 320, dimension), RangeError);
  }
  for (const fov of [0, -1, 180, NaN, Infinity]) assert.throws(() => referenceFieldPinpoints(99, 320, 681, fov), RangeError);
});

test("MOBILE-GATE-09: local component area is compared at the reference focal length", () => {
  assert.equal(referenceProjectedArea(260, 648), 260);
  assert.ok(Math.abs(referenceProjectedArea(279, 681) - 252.61549806904847) < 1e-9);
  assert.equal(referenceProjectedArea(1_040, 1_296), 260);
  assert.ok(referenceProjectedArea(287, 681) <= 260);
  assert.ok(referenceProjectedArea(288, 681) > 260);

  for (const area of [-1, 1.5, NaN, Infinity]) assert.throws(() => referenceProjectedArea(area, 681), RangeError);
  for (const height of [0, -1, 0.5, NaN, Infinity]) assert.throws(() => referenceProjectedArea(279, height), RangeError);
  for (const fov of [0, -1, 180, NaN, Infinity]) assert.throws(() => referenceProjectedArea(279, 681, fov), RangeError);
});
