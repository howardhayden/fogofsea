import assert from "node:assert/strict";
import test from "node:test";
import { AIRCRAFT, PLATFORMS } from "../app/catalog";
import { createFormationPlan, reconcileFormationMotion, sampleFormationMotion, type FormationPosition } from "../app/formation";
import { FIXED_WING_PATROL_RATE, FORMATION_GROUP_ADVANCE, formationMotionProfile, PROPULSION_PROFILES } from "../app/propulsion";

const separation = (a: FormationPosition, b: FormationPosition) => Math.hypot(...a.map((value, index) => value - b[index]));
function straightManeuver(type: string) {
  const aircraft = AIRCRAFT.some((entry) => entry.id === type);
  const unit = createFormationPlan(aircraft ? {} : { [type]: 1 }, aircraft ? { [type]: 1 } : {})[0];
  const start = { ...unit, position: [-2, unit.position[1], 0] as FormationPosition, heading: 0 };
  const end = { ...start, position: [2, unit.position[1], 0] as FormationPosition };
  return reconcileFormationMotion(reconcileFormationMotion(undefined, [start], 0), [end], 1).get(unit.key)!;
}

test("every fictional catalog type has an explicit presentation profile without changing catalog propulsion claims", () => {
  assert.deepEqual(Object.keys(PROPULSION_PROFILES).sort(), [...PLATFORMS, ...AIRCRAFT].map((type) => type.id).sort());
  for (const type of [...PLATFORMS, ...AIRCRAFT]) {
    const profile = formationMotionProfile(type.id);
    assert.ok(Object.isFrozen(profile));
    assert.ok(profile.relativeSpeed > 0 && profile.acceleration > 0 && profile.minimumDuration > 0);
  }
  assert.equal(formationMotionProfile("air-independent-submarine").propulsion, "electric-screw");
  assert.equal(formationMotionProfile("long-endurance-submarine").propulsion, "pumpjet");
  assert.match(PLATFORMS.find((type) => type.id === "long-endurance-submarine")!.note!, /deliberately unspecified/);
  assert.throws(() => formationMotionProfile("invented-unknown-type"), RangeError);
});

test("large displacement hull response is slower than a waterjet corvette and AIP patrol differs from ocean attack handling", () => {
  const carrier = straightManeuver("fleet-aviation-ship");
  const corvette = straightManeuver("stealth-littoral-corvette");
  const aip = straightManeuver("air-independent-submarine");
  const ocean = straightManeuver("long-endurance-submarine");
  assert.ok(carrier.duration > corvette.duration);
  assert.ok(aip.duration > ocean.duration);
  assert.ok(sampleFormationMotion(carrier, 2).speed < sampleFormationMotion(corvette, 2).speed);
  // Quintic easing removes the old acceleration step at the route endpoints.
  const initial = sampleFormationMotion(carrier, 1 + 0.0001);
  const arrival = sampleFormationMotion(carrier, 1 + carrier.duration - 0.0001);
  assert.ok(initial.speed < 0.000001 && arrival.speed < 0.000001);
});

test("marine headings follow through-water motion in the group frame and settle without in-place yaw", () => {
  const transition = straightManeuver("fleet-aviation-ship");
  for (const t of [0.2, 0.5, 0.8, 0.99]) {
    const sample = sampleFormationMotion(transition, 1 + transition.duration * t);
    const forward = sample.velocity[0] + FORMATION_GROUP_ADVANCE;
    const heading = Math.atan2(-sample.velocity[2], forward);
    assert.ok(Math.abs(sample.heading - heading) < 0.000001);
    assert.ok(forward > 0, "a station change must not reverse the underway carrier");
  }
  const before = sampleFormationMotion(transition, 1 + transition.duration - 0.0001);
  const after = sampleFormationMotion(transition, 1 + transition.duration);
  assert.ok(Math.abs(before.heading - after.heading) < 0.000001);
});

test("fixed wings keep forward flight through a full circuit, preserve separation and bank toward the turn", () => {
  const plan = createFormationPlan({}, { "deck-multirole-aircraft": 3, "fixed-wing-surveillance-aircraft": 2 });
  const state = reconcileFormationMotion(undefined, plan, 15);
  for (const now of [15, 25, 35, 55, 75, 95]) {
    const samples = plan.map((unit) => sampleFormationMotion(state.get(unit.key)!, now));
    samples.forEach((sample, index) => {
      const radius = Math.hypot(plan[index].position[0], plan[index].position[2]);
      assert.ok(sample.moving && sample.speed > 0.2);
      assert.ok(Math.abs(Math.hypot(sample.position[0], sample.position[2]) - radius) < 0.000001);
      assert.ok(Math.abs(sample.speed - radius * FIXED_WING_PATROL_RATE) < 0.000001);
      const forward = sample.velocity[0] * Math.cos(sample.heading) - sample.velocity[2] * Math.sin(sample.heading);
      assert.ok(Math.abs(forward - sample.speed) < 0.000001, "nose points along flight velocity");
      assert.ok(sample.bank > 0 && sample.bank <= formationMotionProfile(plan[index].type).maxBank);
    });
    for (let a = 0; a < plan.length; a++) for (let b = a + 1; b < plan.length; b++) {
      assert.ok(Math.abs(separation(samples[a].position, samples[b].position) - separation(plan[a].position, plan[b].position)) < 0.000001);
    }
  }
});

test("aircraft retargets preserve exact pose and velocity and enter the new circuit without stopping", () => {
  let state = reconcileFormationMotion(undefined, createFormationPlan({}, { "deck-multirole-aircraft": 3 }), 0);
  state = reconcileFormationMotion(state, createFormationPlan({}, { "deck-multirole-aircraft": 4 }), 2);
  const key = "air:deck-multirole-aircraft:1";
  const before = sampleFormationMotion(state.get(key)!, 3);
  state = reconcileFormationMotion(state, createFormationPlan({}, { "deck-multirole-aircraft": 5 }), 3);
  const route = state.get(key)!;
  assert.deepEqual(sampleFormationMotion(route, 3), before);
  const near = sampleFormationMotion(route, 3.00001);
  for (let axis = 0; axis < 3; axis++) assert.ok(Math.abs((near.position[axis] - before.position[axis]) / 0.00001 - before.velocity[axis]) < 0.001);
  for (let step = 0; step <= 100; step++) {
    const sample = sampleFormationMotion(route, 3 + route.duration * step / 100);
    assert.ok(sample.position.every(Number.isFinite) && sample.velocity.every(Number.isFinite));
    assert.ok(sample.speed > 0.05, "a fixed wing does not ease down into a hover at its new slot");
    assert.ok(Math.abs(sample.bank) <= formationMotionProfile(route.target.type).maxBank);
  }
  const after = sampleFormationMotion(route, 3 + route.duration + 1);
  assert.ok(after.moving && after.speed > 0);
});

test("rotorcraft tilt into acceleration, brake with opposite pitch and can hold a stationary hover", () => {
  const route = straightManeuver("maritime-mission-helicopter");
  const accelerating = sampleFormationMotion(route, 1 + route.duration * 0.25);
  const braking = sampleFormationMotion(route, 1 + route.duration * 0.75);
  assert.ok(accelerating.pitch < 0);
  assert.ok(braking.pitch > 0);
  const hover = sampleFormationMotion(route, 1 + route.duration);
  assert.equal(hover.speed, 0);
  assert.equal(hover.pitch, 0);
  assert.equal(hover.bank, 0);
  assert.deepEqual(hover.position, route.target.position);
});

test("reduced motion freezes flight and toggling it off resumes from the frozen slot with no phase jump", () => {
  const plan = createFormationPlan({}, { "deck-multirole-aircraft": 2, "maritime-mission-helicopter": 1 });
  const flying = reconcileFormationMotion(undefined, plan, 0);
  const frozen = reconcileFormationMotion(flying, plan, 17, true);
  for (const unit of plan) {
    const sample = sampleFormationMotion(frozen.get(unit.key)!, 30);
    assert.deepEqual(sample.position, unit.position);
    assert.deepEqual(sample, sampleFormationMotion(frozen.get(unit.key)!, 65));
    assert.equal(sample.moving, false);
  }
  const resumed = reconcileFormationMotion(frozen, plan, 30, false);
  for (const unit of plan.filter((unit) => unit.role === "fixed-wing-screen")) {
    const sample = sampleFormationMotion(resumed.get(unit.key)!, 30);
    assert.deepEqual(sample.position, unit.position);
    assert.ok(sample.moving && sample.speed > 0);
    assert.notDeepEqual(sampleFormationMotion(resumed.get(unit.key)!, 31).position, sample.position);
  }
  const retained = reconcileFormationMotion(resumed, plan, 32);
  for (const unit of plan) assert.equal(retained.get(unit.key), resumed.get(unit.key));
});

test("catalog-earlier aircraft enter from clear airspace rather than an occupied flight slot", () => {
  const first = reconcileFormationMotion(undefined, createFormationPlan({}, { "deck-long-range-strike-aircraft": 1 }), 0);
  const second = reconcileFormationMotion(first, createFormationPlan({}, { "deck-multirole-aircraft": 1, "deck-long-range-strike-aircraft": 1 }), 2);
  const incoming = second.get("air:deck-multirole-aircraft:0")!;
  const retained = second.get("air:deck-long-range-strike-aircraft:0")!;
  const start = sampleFormationMotion(incoming, 2);
  const previous = sampleFormationMotion(first.get(retained.target.key)!, 2);
  assert.ok(separation(start.position, previous.position) > incoming.target.clearanceRadius + retained.target.clearanceRadius);
  assert.ok(start.speed > 0 && start.moving);
  assert.ok(Math.hypot(start.position[0], start.position[2]) <= 10.000001);
  const duration = Math.max(incoming.duration, retained.duration);
  for (let step = 0; step <= 200; step++) {
    const now = 2 + duration * step / 200;
    const a = sampleFormationMotion(incoming, now);
    const b = sampleFormationMotion(retained, now);
    assert.ok(separation(a.position, b.position) > incoming.target.clearanceRadius + retained.target.clearanceRadius, "arrival must not overtake the aircraft vacating its station");
  }
});

test("azimuth support uses vectored thrust to hold course during a lateral station correction", () => {
  const unit = createFormationPlan({ "undersea-systems-tender": 1 }, {})[0];
  const start = { ...unit, position: [0, 0.16, -2] as FormationPosition, heading: 0 };
  const end = { ...start, position: [0, 0.16, 2] as FormationPosition };
  const state = reconcileFormationMotion(reconcileFormationMotion(undefined, [start], 0), [end], 1);
  const route = state.get(unit.key)!;
  const sample = sampleFormationMotion(route, 1 + route.duration / 2);
  assert.ok(sample.velocity[2] > 0);
  assert.equal(sample.heading, 0);
});
