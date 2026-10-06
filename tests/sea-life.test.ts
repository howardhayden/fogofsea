import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { createSeaLife, updateSeaLife } from "../app/seaLifeBehavior";
import { createWildlifeIceSupports } from "../app/battlefieldScene";
import { createWildlifePlan, wildlifeForView } from "../app/wildlife";
import { createWildlifeAvatar, triggerWildlifeAvatarReaction, updateWildlifeAvatars } from "../app/wildlifeAvatar";
import { createWaveFieldPlan } from "../app/environmentVisuals";
import { getSubsurfaceLifeProfile, type SubsurfaceLifeProfile } from "../app/viewModel";

const reef: SubsurfaceLifeProfile = { key: "reef-shelf", solitaryCount: 7, schoolCount: 34, seabedY: -6.35, depthLabel: "reef edge" };

function pose(creatures: readonly THREE.Group[]) {
  return creatures.map((creature) => {
    const joints: number[][] = [];
    creature.traverse((part) => {
      if (part.name.endsWith("-joint")) joints.push(part.rotation.toArray().slice(0, 3) as number[]);
    });
    return { position: creature.position.toArray(), rotation: creature.rotation.toArray(), joints };
  });
}

test("schools share a coherent route, keep small scale, and articulate recognizable tails/fins", () => {
  const creatures = createSeaLife(reef, 719, 0x7da8aa);
  assert.equal(creatures.length, 41);
  assert.deepEqual(pose(creatures), pose(createSeaLife(reef, 719, 0x7da8aa)));
  const schools = new Map<string, THREE.Group[]>();
  for (const creature of creatures) {
    assert.ok(creature.getObjectByName("sea-life-tail-joint"));
    assert.ok(creature.getObjectByName("sea-life-left-fin-joint"));
    assert.ok(creature.getObjectByName("sea-life-right-fin-joint"));
    assert.ok(creature.scale.x <= 0.42);
    if (!creature.userData.schoolMember) continue;
    const school = schools.get(creature.userData.groupId) ?? [];
    school.push(creature);
    schools.set(creature.userData.groupId, school);
  }
  assert.equal(schools.size, 4);
  const first = creatures[0];
  const tail = first.getObjectByName("sea-life-tail-joint")!;
  updateSeaLife(creatures, 7, false);
  const priorTail = tail.rotation.y;
  updateSeaLife(creatures, 7.25, false);
  assert.notEqual(tail.rotation.y, priorTail);
  for (const school of schools.values()) {
    assert.ok(school.length <= 10);
    for (const member of school) {
      assert.ok(Number.isFinite(member.rotation.y));
      assert.ok(member.position.distanceTo(school[0].position) < 1.4, "members stay in a coherent detail");
      assert.equal(member.userData.behaviorPhase, school[0].userData.behaviorPhase);
    }
  }
});

test("sea life autonomously cruises, turns, regroups and forages without snapping at phase boundaries", () => {
  const creatures = createSeaLife(reef, 89, 0x7da8aa);
  const first = creatures[0];
  const offset = first.userData.seaLife.route.clockOffset as number;
  const stages: Array<[number, string]> = [[5, "cruise"], [16.5, "turn"], [22, "regroup"], [28.5, "forage"]];
  const spacing: number[] = [];
  for (const [phase, expected] of stages) {
    updateSeaLife(creatures, 32 + phase - offset, false);
    assert.equal(first.userData.behaviorPhase, expected);
    spacing.push(first.position.distanceTo(creatures[1].position));
  }
  assert.ok(spacing[2] < spacing[0] * 0.65, "regrouping visibly tightens the school");
  assert.ok(first.position.y < first.userData.baseY - 0.28, "foraging dips within the water column");
  for (const boundary of [14, 19, 25, 32, 64]) {
    updateSeaLife(creatures, 32 + boundary - offset - 0.0001, false);
    const before = first.position.clone();
    const direction = new THREE.Vector3(1, 0, 0).applyQuaternion(first.quaternion);
    updateSeaLife(creatures, 32 + boundary - offset + 0.0001, false);
    assert.ok(first.position.distanceTo(before) < 0.0003, `position jumps at ${boundary}`);
    assert.ok(direction.distanceTo(new THREE.Vector3(1, 0, 0).applyQuaternion(first.quaternion)) < 0.0003, `heading jumps at ${boundary}`);
  }
});

test("every regional sea-life profile remains in its habitat for long runs and freezes reproducibly", () => {
  for (const [climate, region] of [["ocean", "reef"], ["ocean", "temperate strait"], ["ocean", "open sea"], ["arctic", "shelf"], ["antarctic", "ice margin"], ["antarctic", "research corridor"]] as const) {
    const profile = getSubsurfaceLifeProfile(climate, region, 72);
    const creatures = createSeaLife(profile, 812, 0x7da8aa);
    for (let time = 0; time < 1_200; time += 3.7) {
      updateSeaLife(creatures, time, false);
      for (const creature of creatures) {
        assert.ok(Math.hypot(creature.position.x - creature.userData.baseX, creature.position.z - creature.userData.baseZ) <= creature.userData.radius + 1e-9);
        assert.ok(creature.position.y < -1.7, "underwater fish never perch above the water");
        if (profile.seabedY !== null) assert.ok(creature.position.y > profile.seabedY + 0.5);
      }
    }
    updateSeaLife(creatures, 3, true);
    const frozen = pose(creatures);
    updateSeaLife(creatures, 900, true);
    assert.deepEqual(pose(creatures), frozen);
  }
});

test("a swimming individual faces along its travel instead of sliding sideways", () => {
  const creatures = createSeaLife({ ...reef, schoolCount: 0 }, 42, 0x7da8aa);
  for (const time of [0, 4, 14, 23, 31, 57]) {
    updateSeaLife(creatures, time, false);
    const before = creatures.map((creature) => creature.position.clone());
    updateSeaLife(creatures, time + 0.001, false);
    creatures.forEach((creature, index) => {
      const travel = creature.position.clone().sub(before[index]).setY(0).normalize();
      const facing = new THREE.Vector3(1, 0, 0).applyQuaternion(creature.quaternion).setY(0).normalize();
      assert.ok(travel.dot(facing) > 0.999);
    });
  }
});

test("all school slots face their actual velocity through tight turns and regroup expansion", () => {
  for (const seed of [2, 3, 7, 719]) {
    const creatures = createSeaLife(reef, seed, 0x7da8aa).filter((creature) => creature.userData.schoolMember);
    const samples = Array.from({ length: 240 }, (_, index) => index * 0.5);
    for (const creature of creatures) {
      const offset = creature.userData.seaLife.route.clockOffset as number;
      for (const boundary of [14, 19, 22, 25, 32]) {
        samples.push(32 + boundary - offset - 0.0001, 32 + boundary - offset + 0.0001);
      }
    }
    for (const time of samples) {
      updateSeaLife(creatures, time, false);
      const before = creatures.map((creature) => creature.position.clone());
      const headings = creatures.map((creature) => new THREE.Vector3(1, 0, 0).applyQuaternion(creature.quaternion).setY(0).normalize());
      updateSeaLife(creatures, time + 0.0001, false);
      creatures.forEach((creature, index) => {
        const travel = creature.position.clone().sub(before[index]).setY(0);
        assert.ok(travel.length() > 0.000001, "a school slot must not reverse through a stationary cusp");
        travel.normalize();
        const facing = new THREE.Vector3(1, 0, 0).applyQuaternion(creature.quaternion).setY(0).normalize();
        assert.ok(travel.dot(facing) > 0.999, `seed ${seed} slot ${index} time ${time}: fish swims sideways or backwards`);
        assert.ok(facing.dot(headings[index]) > 0.999, "no abrupt heading flip while regrouping");
      });
    }
  }
});

test("updates retain every rig, geometry, material and route object", () => {
  const creatures = createSeaLife(reef, 48, 0x7da8aa);
  const resources: unknown[] = [];
  for (const creature of creatures) {
    resources.push(creature.userData.seaLife, creature.userData.seaLife.route);
    creature.traverse((part) => {
      resources.push(part);
      if (part instanceof THREE.Mesh) resources.push(part.geometry, part.material);
    });
  }
  for (let frame = 0; frame < 180; frame++) updateSeaLife(creatures, frame / 60, false);
  const after: unknown[] = [];
  for (const creature of creatures) {
    after.push(creature.userData.seaLife, creature.userData.seaLife.route);
    creature.traverse((part) => {
      after.push(part);
      if (part instanceof THREE.Mesh) after.push(part.geometry, part.material);
    });
  }
  assert.equal(after.length, resources.length);
  after.forEach((resource, index) => assert.equal(resource, resources[index]));
});

test("ice groups share actual opaque polygon supports with truthful safe bounds and top planes", () => {
  const plan = createWildlifePlan({ seed: 719, regionId: "austral-research-corridor", climate: "antarctic", season: "summer", time: "day", clouds: "clear", precipitation: "none", storming: false, windSpeed: 9, seaState: 2, visibility: 11 });
  const visible = wildlifeForView(plan, "surface");
  const scene = new THREE.Scene();
  const supports = createWildlifeIceSupports(scene, visible, "dark");
  const ice = visible.filter((member) => member.medium === "ice");
  assert.ok(ice.length > supports.size, "animals should share supports instead of one isolated floe each");
  assert.equal(supports.size, new Set(ice.map((member) => member.groupId)).size);
  for (const member of ice) {
    const support = supports.get(member.groupId)!;
    const floe = scene.getObjectByName(support.id) as THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>;
    assert.ok(floe?.isMesh);
    assert.equal(floe.userData.wildlifeSupport, support);
    assert.equal(floe.material.transparent, false);
    assert.equal(floe.position.y + floe.geometry.parameters.height / 2, support.topY);
    assert.ok(Math.abs(floe.geometry.parameters.radiusTop * Math.cos(Math.PI / floe.geometry.parameters.radialSegments) - support.radius) < 1e-9);
    assert.ok(support.radius >= (member.kind === "penguin" ? 2.6 : 2.1));
  }
  assert.equal(createWildlifeIceSupports(new THREE.Scene(), wildlifeForView(plan, "subsurface"), "dark").size, 0);
});

test("marching and resting rigs stay on the real shared floes through complete routines and greetings", () => {
  const plan = createWildlifePlan({ seed: 719, regionId: "austral-research-corridor", climate: "antarctic", season: "summer", time: "day", clouds: "clear", precipitation: "none", storming: false, windSpeed: 9, seaState: 2, visibility: 11 });
  const ice = wildlifeForView(plan, "surface").filter((member) => member.medium === "ice");
  const supports = createWildlifeIceSupports(new THREE.Scene(), ice, "dark");
  const animals = ice.map((member) => {
    const animal = createWildlifeAvatar(member, "dark");
    const support = supports.get(member.groupId)!;
    Object.assign(animal.userData, { support, baseX: support.x, baseY: support.topY, baseZ: support.z });
    return animal;
  });
  const wave = createWaveFieldPlan({ seed: 91, climate: "antarctic", precipitation: "none", seaState: 2, windHeading: 90, windSpeed: 9, currentHeading: 74, currentSpeed: 1.1, waveHeading: 82, storming: false });
  const point = new THREE.Vector3();
  for (let step = 0; step < 240; step++) {
    const time = step * 0.5;
    if (step === 80) animals.forEach((animal) => triggerWildlifeAvatarReaction(animal, time));
    updateWildlifeAvatars(animals, wave, time, false);
    for (const animal of animals) {
      const support = supports.get(animal.userData.groupId)!;
      animal.updateMatrixWorld(true);
      let lowest = Number.POSITIVE_INFINITY;
      animal.getObjectByName("wildlife-joint-modelRoot")!.traverse((part) => {
        if (!(part instanceof THREE.Mesh)) return;
        const vertices = part.geometry.getAttribute("position");
        for (let index = 0; index < vertices.count; index++) {
          point.fromBufferAttribute(vertices, index).applyMatrix4(part.matrixWorld);
          lowest = Math.min(lowest, point.y);
          assert.ok(Math.hypot(point.x - support.x, point.z - support.z) < support.radius, "a posed vertex leaves the floe safe footprint");
        }
      });
      assert.ok(Math.abs(lowest - support.topY - Number(animal.userData.supportClearance)) < 1e-7, "the lowest visible rig vertex must meet the real top, except its explicit greeting hop");
    }
  }
});
