import assert from "node:assert/strict";
import test from "node:test";
import { AIRCRAFT, PLATFORMS } from "../app/catalog";
import { createFormationPlan, FORMATION_BOUNDS, reconcileFormationMotion, sampleFormationMotion } from "../app/formation";
import { createExhaustiveFormationReference } from "./helpers/formation-exhaustive-reference";

test("every selected instance is represented without the old per-type and overall display caps", () => {
  const fleet = { "stealth-littoral-corvette": 15 };
  const air = { "uncrewed-logistics-aircraft": 99, "shipborne-rescue-rotorcraft": 42 };
  const plan = createFormationPlan(fleet, air);
  assert.equal(plan.length, 156);
  assert.equal(plan.filter((unit) => unit.type === "stealth-littoral-corvette").length, 15);
  assert.equal(plan.filter((unit) => unit.type === "uncrewed-logistics-aircraft").length, 99);
  assert.equal(new Set(plan.map((unit) => unit.key)).size, plan.length);
  assert.deepEqual(fleet, { "stealth-littoral-corvette": 15 });
  assert.deepEqual(air, { "uncrewed-logistics-aircraft": 99, "shipborne-rescue-rotorcraft": 42 });
});

test("catalog order makes unit keys and layout independent of record insertion order", () => {
  const fleet = { "multirole-frigate": 3, "fleet-aviation-ship": 1, "long-endurance-submarine": 2 };
  const reversed = Object.fromEntries(Object.entries(fleet).reverse());
  assert.deepEqual(createFormationPlan(fleet, {}), createFormationPlan(reversed, {}));
  const initial = createFormationPlan({ "multirole-frigate": 3 }, {});
  const added = createFormationPlan({ "area-defense-destroyer": 1, "multirole-frigate": 4 }, {});
  assert.ok(initial.every((unit) => added.some((other) => other.key === unit.key)));
  const removed = createFormationPlan({ "multirole-frigate": 2 }, {});
  assert.deepEqual(removed.map((unit) => unit.key), initial.slice(0, 2).map((unit) => unit.key));
});

test("role layout places the aviation core, surface screen, underwater screen and air support in distinct regions", () => {
  const plan = createFormationPlan({ "fleet-aviation-ship": 1, "multirole-frigate": 4, "long-endurance-submarine": 2 }, { "maritime-mission-helicopter": 2, "deck-multirole-aircraft": 6 });
  const core = plan.find((unit) => unit.role === "aviation-core")!;
  assert.deepEqual(core.position, [0, 0.16, 0]);
  for (const unit of plan) {
    if (unit.role === "surface-screen") assert.ok(Math.hypot(unit.position[0], unit.position[2]) >= 7.3);
    if (unit.domain === "subsurface") assert.ok(unit.position[1] < -4);
    if (unit.role === "rotary-support") assert.ok(unit.position[1] > 3 && unit.position[1] < 4);
    if (unit.role === "fixed-wing-screen") assert.ok(unit.position[1] > 6);
  }
});

test("every catalog type and dense valid count has finite bounded targets with disjoint model envelopes", () => {
  const selections = [
    [Object.fromEntries(PLATFORMS.map((unit) => [unit.id, 1])), Object.fromEntries(AIRCRAFT.map((unit) => [unit.id, 1]))],
    [{ "fleet-aviation-ship": 3, "multirole-frigate": 15, "air-independent-submarine": 10 }, { "uncrewed-logistics-aircraft": 99, "deck-multirole-aircraft": 60 }],
  ];
  for (const [fleet, air] of selections) {
    const plan = createFormationPlan(fleet, air);
    for (const unit of plan) {
      assert.ok(unit.position.every(Number.isFinite));
      assert.ok(Number.isFinite(unit.heading));
      assert.ok(unit.visualScale > 0 && unit.visualScale <= 1);
      assert.ok(Math.hypot(unit.position[0], unit.position[2]) <= FORMATION_BOUNDS.horizontal);
      assert.ok(unit.position[1] >= FORMATION_BOUNDS.minimumY && unit.position[1] <= FORMATION_BOUNDS.maximumY);
    }
    for (let a = 0; a < plan.length; a++) for (let b = a + 1; b < plan.length; b++) {
      const separation = Math.hypot(...plan[a].position.map((value, axis) => value - plan[b].position[axis]));
      assert.ok(separation > plan[a].clearanceRadius + plan[b].clearanceRadius, `${plan[a].key} must not overlap ${plan[b].key}`);
    }
  }
});

test("invalid numeric counts are rejected rather than allocating unbounded geometry or silently truncating", () => {
  for (const count of [-1, 0.5, NaN, Infinity, 100, Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => createFormationPlan({ "multirole-frigate": count }, {}), RangeError);
    assert.throws(() => createFormationPlan({}, { "maritime-mission-helicopter": count }), RangeError);
  }
  assert.deepEqual(createFormationPlan({}, {}), []);
});

test("the complete save-format maximum represents all 3,069 instances without a rendering-list cap", () => {
  const fleet = Object.fromEntries(PLATFORMS.map((unit) => [unit.id, 99]));
  const air = Object.fromEntries(AIRCRAFT.map((unit) => [unit.id, 99]));
  const plan = createFormationPlan(fleet, air);
  assert.equal(plan.length, (PLATFORMS.length + AIRCRAFT.length) * 99);
  assert.equal(plan.length, 3069);
  assert.equal(new Set(plan.map((unit) => unit.key)).size, plan.length);
  assert.ok(plan.every((unit) => unit.position.every(Number.isFinite) && unit.visualScale > 0 && unit.visualScale <= 1));
});

test("clearance optimization exactly preserves the frozen exhaustive planner on this runtime", () => {
  // A JSON hash captured on one JS engine can change when another engine's
  // Math implementation rounds a result differently. Evaluate the frozen
  // original on this runtime instead: every field must still match exactly,
  // with no rounding, numeric tolerance, or list of accepted output hashes.
  const compare = (fleet: Record<string, number>, air: Record<string, number>, label: string) => {
    const actual = createFormationPlan(fleet, air);
    const expected = createExhaustiveFormationReference(fleet, air);
    assert.equal(actual.length, expected.length, `${label}: instance count`);
    for (let index = 0; index < expected.length; index++) {
      assert.deepEqual(actual[index], expected[index], `${label}: instance ${index} (${expected[index].key})`);
    }
  };
  compare({ "fleet-aviation-ship": 1, "multirole-frigate": 4, "long-endurance-submarine": 2 },
    { "maritime-mission-helicopter": 2, "deck-multirole-aircraft": 6 }, "ordinary mixed roster");
  for (const count of [1, 5, 20, 99]) {
    const fleet = Object.fromEntries(PLATFORMS.map((unit) => [unit.id, count]));
    const air = Object.fromEntries(AIRCRAFT.map((unit) => [unit.id, count]));
    compare(fleet, air, `all types at ${count}`);
  }
});

test("spatial clearance agrees exactly with an independent exhaustive oracle across heterogeneous rosters", () => {
  for (let seed = 0; seed < 12; seed++) {
    const fleet = Object.fromEntries(PLATFORMS.map((unit, index) => [unit.id, (index * 17 + seed * 13) % 100]));
    const air = Object.fromEntries(AIRCRAFT.map((unit, index) => [unit.id, (index * 19 + seed * 23) % 100]));
    const plan = createFormationPlan(fleet, air);
    const radii = plan.map((unit) => unit.role === "aviation-core" ? 2.6 : unit.domain === "subsurface" ? 1.3
      : unit.domain === "surface" ? 1.7 : AIRCRAFT.find((aircraft) => aircraft.id === unit.type)!.kind.startsWith("uncrewed") ? 0.88 : 1.1);
    const expected = new Array<number>(plan.length).fill(1);
    for (let left = 0; left < plan.length; left++) for (let right = left + 1; right < plan.length; right++) {
      const a = plan[left].position, b = plan[right].position;
      const factor = Math.min(1, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / ((radii[left] + radii[right]) * 1.08));
      expected[left] = Math.min(expected[left], factor);
      expected[right] = Math.min(expected[right], factor);
    }
    for (let index = 0; index < plan.length; index++) {
      assert.equal(plan[index].visualScale, expected[index], `seed ${seed}, ${plan[index].key}`);
      assert.equal(plan[index].clearanceRadius, radii[index] * expected[index]);
    }
  }
});

test("the largest valid roster uses bounded neighbor work instead of an all-pairs scan", () => {
  const fleet = Object.fromEntries(PLATFORMS.map((unit) => [unit.id, 99]));
  const air = Object.fromEntries(AIRCRAFT.map((unit) => [unit.id, 99]));
  const original = Math.hypot;
  let distanceEvaluations = 0;
  let count = 0;
  // Count actual Euclidean-distance work, without adding diagnostic state to
  // production code or relying on machine-dependent execution-time limits.
  Math.hypot = (...values: number[]) => { distanceEvaluations += 1; return original(...values); };
  try { count = createFormationPlan(fleet, air).length; }
  finally { Math.hypot = original; }
  assert.equal(count, 3069);
  assert.ok(distanceEvaluations < count * 100, `${distanceEvaluations} distance evaluations for ${count} units`);
});

test("adding a neighbor preserves existing poses initially and produces a finite curved, eased maneuver", () => {
  const initial = createFormationPlan({ "multirole-frigate": 2 }, {});
  const first = reconcileFormationMotion(undefined, initial, 10);
  const targets = createFormationPlan({ "multirole-frigate": 3 }, {});
  const next = reconcileFormationMotion(first, targets, 12);
  const key = initial[1].key;
  const transition = next.get(key)!;
  assert.ok(transition.duration > 0);
  assert.deepEqual(sampleFormationMotion(transition, 12).position, initial[1].position);
  const middle = sampleFormationMotion(transition, 12 + transition.duration / 2);
  assert.ok(middle.position.every(Number.isFinite));
  assert.ok(middle.speed > 0 && middle.motionStrength > 0 && middle.motionStrength <= 1);
  assert.ok(middle.moving);
  const end = sampleFormationMotion(transition, 12 + transition.duration);
  assert.deepEqual(end.position, transition.target.position);
  assert.equal(end.heading, transition.target.heading);
  assert.equal(end.speed, 0);
  assert.equal(end.moving, false);
  assert.equal(end.motionStrength, 0);
  const newUnit = targets[2];
  assert.deepEqual(sampleFormationMotion(next.get(newUnit.key)!, 12).position, newUnit.position);
});

test("mid-maneuver additions preserve position, velocity and heading instead of restarting from old slots", () => {
  let motion = reconcileFormationMotion(undefined, createFormationPlan({ "multirole-frigate": 2 }, {}), 0);
  motion = reconcileFormationMotion(motion, createFormationPlan({ "multirole-frigate": 3 }, {}), 2);
  const key = "surface:multirole-frigate:1";
  const before = sampleFormationMotion(motion.get(key)!, 3);
  const changed = reconcileFormationMotion(motion, createFormationPlan({ "multirole-frigate": 4 }, {}), 3);
  const after = sampleFormationMotion(changed.get(key)!, 3);
  assert.deepEqual(after.position, before.position);
  assert.deepEqual(after.velocity, before.velocity);
  assert.equal(after.heading, before.heading);
  assert.equal(after.visualScale, before.visualScale);
});

test("a newly introduced destroyer cannot send the existing frigate through the central carrier", () => {
  const firstPlan = createFormationPlan({ "fleet-aviation-ship": 1, "multirole-frigate": 1 }, {});
  const first = reconcileFormationMotion(undefined, firstPlan, 0);
  const secondPlan = createFormationPlan({ "fleet-aviation-ship": 1, "area-defense-destroyer": 1, "multirole-frigate": 1 }, {});
  const second = reconcileFormationMotion(first, secondPlan, 1);
  const carrier = secondPlan.find((unit) => unit.type === "fleet-aviation-ship")!;
  const frigate = second.get("surface:multirole-frigate:0")!;
  const destroyer = second.get("surface:area-defense-destroyer:0")!;
  assert.notDeepEqual(destroyer.from.position, destroyer.target.position, "arrival must not occupy the departing frigate's old slot");
  for (let index = 0; index <= 100; index++) {
    const now = 1 + index / 100 * 8;
    const movingFrigate = sampleFormationMotion(frigate, now);
    const movingDestroyer = sampleFormationMotion(destroyer, now);
    assert.ok(Math.hypot(movingFrigate.position[0], movingFrigate.position[2]) > carrier.clearanceRadius + frigate.target.clearanceRadius);
    assert.ok(Math.hypot(movingDestroyer.position[0], movingDestroyer.position[2]) > carrier.clearanceRadius + destroyer.target.clearanceRadius);
    assert.ok(Math.hypot(...movingFrigate.position.map((value, axis) => value - movingDestroyer.position[axis])) > frigate.target.clearanceRadius + destroyer.target.clearanceRadius);
    assert.ok(Math.hypot(movingFrigate.position[0], movingFrigate.position[2]) <= FORMATION_BOUNDS.horizontal);
    assert.ok(Math.hypot(movingDestroyer.position[0], movingDestroyer.position[2]) <= FORMATION_BOUNDS.horizontal);
  }
});

test("a second carrier enters from clear water while the original carrier opens the core", () => {
  const first = reconcileFormationMotion(undefined, createFormationPlan({ "fleet-aviation-ship": 1 }, {}), 0);
  const plan = createFormationPlan({ "fleet-aviation-ship": 2 }, {});
  const next = reconcileFormationMotion(first, plan, 1);
  const original = next.get("surface:fleet-aviation-ship:0")!;
  const introduced = next.get("surface:fleet-aviation-ship:1")!;
  const arrivalRadius = Math.hypot(introduced.from.position[0], introduced.from.position[2]);
  assert.ok(arrivalRadius >= 5.5 && arrivalRadius < 5.6, "new carrier should start just beyond the original hull envelope");
  assert.ok(introduced.duration > 0);
  for (let index = 0; index <= 100; index++) {
    const now = 1 + index / 100 * 8;
    const a = sampleFormationMotion(original, now);
    const b = sampleFormationMotion(introduced, now);
    const separation = Math.hypot(...a.position.map((value, axis) => value - b.position[axis]));
    assert.ok(separation > original.target.clearanceRadius + introduced.target.clearanceRadius);
    assert.ok(Math.hypot(b.position[0], b.position[2]) <= arrivalRadius + 0.01);
  }
  const before = sampleFormationMotion(introduced, 2);
  const retargeted = reconcileFormationMotion(next, createFormationPlan({ "fleet-aviation-ship": 3 }, {}), 2);
  const after = sampleFormationMotion(retargeted.get(introduced.target.key)!, 2);
  assert.deepEqual(after.position, before.position);
  assert.deepEqual(after.velocity, before.velocity);
  assert.equal(after.heading, before.heading);
});

test("unchanged plans retain transition identity while removed units leave the motion state", () => {
  const plan = createFormationPlan({ "multirole-frigate": 3 }, {});
  const motion = reconcileFormationMotion(undefined, plan, 0);
  const unchanged = reconcileFormationMotion(motion, createFormationPlan({ "multirole-frigate": 3 }, {}), 5);
  for (const unit of plan) assert.equal(unchanged.get(unit.key), motion.get(unit.key));
  const removed = reconcileFormationMotion(motion, createFormationPlan({ "multirole-frigate": 1 }, {}), 6);
  assert.equal(removed.size, 1);
  assert.equal(removed.has(plan[1].key), false);
});

test("reduced motion snaps to final positions and holds heading, scale and emission motion strength steady", () => {
  const initial = reconcileFormationMotion(undefined, createFormationPlan({ "multirole-frigate": 2 }, {}), 0);
  const targets = createFormationPlan({ "multirole-frigate": 3 }, {});
  const moving = reconcileFormationMotion(initial, targets, 2);
  const reduced = reconcileFormationMotion(moving, targets, 2.5, true);
  for (const target of targets) {
    const fromMoving = sampleFormationMotion(moving.get(target.key)!, 2.5, true);
    const snapped = sampleFormationMotion(reduced.get(target.key)!, 2.5);
    assert.deepEqual(fromMoving, snapped);
    assert.deepEqual(snapped.position, target.position);
    assert.equal(snapped.motionStrength, 0);
    assert.equal(snapped.moving, false);
    assert.deepEqual(snapped, sampleFormationMotion(reduced.get(target.key)!, 20));
  }
});
