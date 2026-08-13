import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as THREE from "three";
import { createWildlifeAvatar, restingPenguinReactionStage, RESTING_PENGUIN_SEQUENCE, triggerWildlifeAvatarReaction, updateWildlifeAvatars, WILDLIFE_AVATAR_ENGINE } from "../app/wildlifeAvatar";
import { TACTICAL_GRID_PRESENTATION } from "../app/battlefieldScene";
import { createWaveFieldPlan, sampleWaveField } from "../app/environmentVisuals";
import { createWildlifePlan, describeWildlifeForView, wildlifeForView, wildlifeReactionMessage, WILDLIFE_LIMITS, type WildlifeKind } from "../app/wildlife";

const clearDay = {
  seed: 719,
  regionId: "austral-research-corridor",
  climate: "antarctic" as const,
  season: "summer" as const,
  time: "day" as const,
  clouds: "clear" as const,
  precipitation: "none" as const,
  storming: false,
  windSpeed: 9,
  seaState: 2,
  visibility: 11,
};

function countKind(plan: ReturnType<typeof createWildlifePlan>, kind: WildlifeKind) {
  return plan.groups.find((group) => group.kind === kind)?.count ?? 0;
}

test("wildlife presentation is deterministic, bounded, and explicitly non-tactical", () => {
  const plan = createWildlifePlan(clearDay);
  assert.deepEqual(plan, createWildlifePlan(clearDay));
  assert.ok(plan.individualCount > 0 && plan.individualCount <= WILDLIFE_LIMITS.maxIndividuals);
  assert.ok(plan.groups.length <= WILDLIFE_LIMITS.maxGroups);
  assert.equal(plan.individualCount, plan.groups.reduce((sum, group) => sum + group.members.length, 0));
  assert.ok(plan.groups.every((group) => group.count === group.members.length));
  assert.ok(countKind(plan, "penguin") > 0);
  assert.ok(countKind(plan, "seal") > 0);
  assert.match(plan.description, /region, summer season, day, weather, sea state, visibility/i);
  assert.match(plan.description, /non-tactical scenery/i);
  assert.match(plan.description, /never represents a contact.*sensing capability.*score/i);
});

test("only a deterministic minority of a multi-penguin group lies down", () => {
  const plan = createWildlifePlan(clearDay);
  const penguins = wildlifeForView(plan, "surface").filter((animal) => animal.kind === "penguin");
  assert.ok(penguins.length > 1);
  const resting = penguins.filter((animal) => animal.restingPose);
  assert.ok(resting.length >= 1, "a large Antarctic group gets a funny resting individual");
  assert.ok(resting.length < penguins.length, "the entire penguin group must never lie down");
  assert.deepEqual(
    penguins.map((animal) => animal.restingPose),
    wildlifeForView(createWildlifePlan(clearDay), "surface").filter((animal) => animal.kind === "penguin").map((animal) => animal.restingPose),
  );
  assert.ok(penguins.filter((animal) => !animal.restingPose).every((animal) => animal.behavior !== "resting"));
  const lonePenguin = wildlifeForView(createWildlifePlan({
    ...clearDay,
    seed: 1,
    season: "autumn",
    time: "night",
    clouds: "overcast",
    precipitation: "snow",
    windSpeed: 20,
    seaState: 4,
    visibility: 3,
  }), "surface").filter((animal) => animal.kind === "penguin");
  assert.equal(lonePenguin.length, 1);
  assert.equal(lonePenguin[0].restingPose, false, "a lone visible penguin needs somewhere to go and may not be the whole resting group");
});

test("regional ecology never puts penguins in the Arctic or ice fauna in tropical passages", () => {
  const arctic = createWildlifePlan({ ...clearDay, regionId: "polar-archipelago", climate: "arctic" });
  const tropical = createWildlifePlan({ ...clearDay, regionId: "western-tropical-passage", climate: "ocean", season: "wet" });
  assert.equal(countKind(arctic, "penguin"), 0);
  assert.equal(countKind(tropical, "penguin"), 0);
  assert.equal(countKind(tropical, "seal"), 0);
  assert.ok(countKind(tropical, "seabird") > 0);
  assert.ok(countKind(tropical, "dolphin") > 0);
  assert.equal(arctic.iceEdge, true);
  assert.equal(tropical.iceEdge, false);
});

test("proximity to land increases coastal-bird presence", () => {
  const coastal = createWildlifePlan({ ...clearDay, regionId: "western-tropical-passage", climate: "ocean", season: "wet" });
  const nearLand = createWildlifePlan({ ...clearDay, regionId: "equatorial-convergence", climate: "ocean", season: "wet" });
  assert.equal(coastal.proximityToLand, "coastal");
  assert.equal(nearLand.proximityToLand, "near-land");
  assert.ok(countKind(nearLand, "shorebird") > countKind(coastal, "shorebird"));
});

test("season, light, weather, wind, sea state, and visibility suppress sightings coherently", () => {
  const summer = createWildlifePlan(clearDay);
  const winter = createWildlifePlan({ ...clearDay, season: "winter" });
  const night = createWildlifePlan({ ...clearDay, time: "night" });
  const storm = createWildlifePlan({
    ...clearDay,
    time: "dusk",
    clouds: "overcast",
    precipitation: "snow",
    storming: true,
    windSpeed: 46,
    seaState: 7,
    visibility: 2,
  });
  assert.ok(countKind(summer, "penguin") > countKind(winter, "penguin"));
  assert.ok(countKind(summer, "seabird") > countKind(night, "seabird"));
  assert.equal(countKind(storm, "seabird"), 0);
  assert.ok(storm.individualCount < summer.individualCount);
});

test("view filtering keeps wildlife out of space and birds out of the submarine layer", () => {
  const plan = createWildlifePlan(clearDay);
  assert.equal(wildlifeForView(plan, "stars").length, 0);
  assert.ok(wildlifeForView(plan, "sky").every((animal) => animal.medium !== "subsurface"));
  assert.ok(wildlifeForView(plan, "surface").some((animal) => animal.kind === "penguin"));
  const subsurface = wildlifeForView(plan, "subsurface");
  assert.ok(subsurface.every((animal) => animal.kind !== "seabird" && animal.kind !== "shorebird"));
  assert.ok(subsurface.every((animal) => animal.medium === "subsurface"));
  assert.match(describeWildlifeForView(plan, "stars"), /No recognizable wildlife.*stars view/i);
  assert.doesNotMatch(describeWildlifeForView(plan, "subsurface"), /seabirds|coastal birds/i);
});

test("marine wildlife never receives an ice medium or a beached placement", () => {
  const ocean = createWildlifePlan({
    ...clearDay,
    regionId: "western-tropical-passage",
    climate: "ocean",
    season: "wet",
  });
  const visible = wildlifeForView(ocean, "surface").filter((animal) => ["shark", "dolphin", "whale"].includes(animal.kind));
  assert.ok(visible.length > 0);
  assert.ok(visible.every((animal) => animal.medium === "surface"), "marine bodies stay in the water layer, never on ice");
  assert.ok(visible.every((animal) => animal.behavior !== "resting"), "marine wildlife is always actively moving");
});

test("the avatar boundary repairs malformed marine ice/resting records", () => {
  const ocean = createWildlifePlan({
    ...clearDay,
    climate: "ocean" as const,
    season: "wet",
    regionId: "western-tropical-passage",
  });
  const wave = createWaveFieldPlan({ seed: 85, climate: "ocean", precipitation: "none", seaState: 3, windHeading: 90, windSpeed: 12, currentHeading: 74, currentSpeed: 1.1, waveHeading: 82, storming: false });
  for (const kind of ["shark", "dolphin"] as const) {
    const source = wildlifeForView(ocean, "surface").find((animal) => animal.kind === kind);
    assert.ok(source);
    const malformed = { ...source, medium: "ice" as const, behavior: "resting" as const, restingPose: true };
    const marine = createWildlifeAvatar(malformed, "dark");
    assert.equal(marine.userData.medium, "surface");
    assert.equal(marine.userData.behavior, "swimming");
    assert.equal(marine.userData.restingPose, false);
    updateWildlifeAvatars([marine], wave, 16, false);
    const waveY = sampleWaveField(wave, marine.position.x, -marine.position.z, 16);
    assert.ok(marine.position.y <= waveY + 1e-6, `${kind} remains in the water rather than on an ice floe`);
  }
});

test("recognizable animals use bounded low-poly meshes without tactical rings or lights", () => {
  const visible = wildlifeForView(createWildlifePlan(clearDay), "surface");
  const kinds = new Set(visible.map((animal) => animal.kind));
  assert.ok(kinds.has("penguin") && kinds.has("seal") && kinds.has("whale"));
  visible.filter((animal, index) => index === visible.findIndex((candidate) => candidate.kind === animal.kind)).forEach((animal) => {
    const object = createWildlifeAvatar(animal, "dark");
    assert.equal(object.userData.environmentalWildlife, true);
    assert.equal(object.userData.avatarEngine, WILDLIFE_AVATAR_ENGINE.name);
    assert.equal(object.userData.motionState, "active");
    assert.equal(object.getObjectsByProperty("isLight", true).length, 0);
    assert.equal(object.children.some((child) => child.name.includes("ring") || child.name.includes("halo")), false);
    object.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      if (child.name === "wildlife-hit-target") {
        assert.ok(child.material instanceof THREE.MeshBasicMaterial);
        assert.equal(child.material.colorWrite, false);
        assert.equal(child.material.depthWrite, false);
        return;
      }
      assert.ok(child.material instanceof THREE.MeshStandardMaterial);
      assert.equal(child.material.flatShading, true);
      assert.equal(child.material.depthTest, true);
      assert.equal(child.material.depthWrite, child.name !== "wildlife-reaction-mote");
    });
    const reaction = object.getObjectByName("wildlife-happy-reaction");
    assert.ok(reaction instanceof THREE.Group);
    assert.equal(reaction.visible, false);
    assert.equal(reaction.children.length, 5);
  });
});

test("each low-poly wildlife avatar is an articulated rig with active anatomical joints", () => {
  const plans = [
    ...wildlifeForView(createWildlifePlan(clearDay), "surface"),
    ...wildlifeForView(createWildlifePlan({ ...clearDay, climate: "ocean" as const, season: "wet", regionId: "western-tropical-passage" }), "surface"),
  ];
  const distinct = [...new Map(plans.map((plan) => [plan.kind, plan])).values()];
  assert.ok(distinct.some((plan) => plan.kind === "shark"));
  distinct.forEach((plan) => {
    const avatar = createWildlifeAvatar(plan, "dark");
    const joints: THREE.Group[] = [];
    avatar.traverse((part) => {
      if (part instanceof THREE.Group && part.name.startsWith("wildlife-joint-")) joints.push(part);
    });
    assert.ok(joints.some((part) => part.name === "wildlife-joint-torso"));
    assert.ok(joints.some((part) => /Wing|Flipper|tail|Fluke|Leg/.test(part.name)), `${plan.kind} needs an articulated locomotion joint`);
    assert.ok(joints.length >= 4, `${plan.kind} must not be a single rotating primitive`);
  });
});

test("wildlife motion is bounded and reduced motion freezes a stable pose", () => {
  const animalPlan = wildlifeForView(createWildlifePlan(clearDay), "surface")[0];
  assert.ok(animalPlan);
  const animal = createWildlifeAvatar(animalPlan, "dark");
  const wave = createWaveFieldPlan({ seed: 81, climate: "antarctic", precipitation: "none", seaState: 2, windHeading: 90, windSpeed: 9, currentHeading: 74, currentSpeed: 1.1, waveHeading: 82, storming: false });
  updateWildlifeAvatars([animal], wave, 0, true);
  const frozen = animal.position.clone();
  updateWildlifeAvatars([animal], wave, 999, true);
  assert.ok(animal.position.distanceTo(frozen) < 1e-9);
  updateWildlifeAvatars([animal], wave, 24, false);
  assert.ok(animal.position.distanceTo(frozen) > 0.001);
  assert.ok(animal.position.distanceTo(new THREE.Vector3(animal.userData.baseX, animal.userData.baseY, animal.userData.baseZ)) <= animal.userData.radius + 1.2);
  const articulated = animal.getObjectByName("wildlife-joint-leftFlipper") ?? animal.getObjectByName("wildlife-joint-leftWing");
  assert.ok(articulated);
  const movingRotation = articulated.rotation.clone();
  updateWildlifeAvatars([animal], wave, 26, false);
  assert.notDeepEqual(articulated.rotation.toArray(), movingRotation.toArray());
});

test("active wildlife follows a continuously advancing bounded route and faces its destination", () => {
  const plans = [
    ...wildlifeForView(createWildlifePlan(clearDay), "surface"),
    ...wildlifeForView(createWildlifePlan({ ...clearDay, climate: "ocean" as const, season: "wet", regionId: "western-tropical-passage" }), "surface"),
  ].filter((animal) => !animal.restingPose);
  const wave = createWaveFieldPlan({ seed: 91, climate: "ocean", precipitation: "none", seaState: 3, windHeading: 90, windSpeed: 12, currentHeading: 74, currentSpeed: 1.1, waveHeading: 82, storming: false });
  plans.filter((animal, index) => index === plans.findIndex((candidate) => candidate.kind === animal.kind)).forEach((plan) => {
    const avatar = createWildlifeAvatar(plan, "dark");
    updateWildlifeAvatars([avatar], wave, 11, false);
    const firstProgress = Number(avatar.userData.routeProgress);
    const firstDestination = avatar.userData.routeDestination as { x: number; z: number };
    const firstPosition = avatar.position.clone();
    updateWildlifeAvatars([avatar], wave, 15, false);
    assert.notEqual(avatar.userData.routeProgress, firstProgress, `${plan.kind} needs an advancing destination`);
    assert.notDeepEqual(avatar.userData.routeDestination, firstDestination, `${plan.kind} needs a moving ecological waypoint`);
    assert.ok(avatar.position.distanceTo(firstPosition) > 0.001, `${plan.kind} must travel rather than animate in place`);
    assert.ok(Math.hypot(avatar.position.x - Number(avatar.userData.baseX), avatar.position.z - Number(avatar.userData.baseZ)) <= Number(avatar.userData.routeRadius) + 1e-6);
  });
});

test("a lying penguin normally recovers, stands, scratches, and lies down without spinning", () => {
  assert.deepEqual(RESTING_PENGUIN_SEQUENCE.map(({ stage }) => stage), ["recover", "stand", "scratch", "lie-down"]);
  assert.deepEqual(RESTING_PENGUIN_SEQUENCE.map(({ toSeconds }) => toSeconds), [0.96, 2.016, 3.744, 4.8]);
  const scratchJoints: readonly string[] = RESTING_PENGUIN_SEQUENCE.find(({ stage }) => stage === "scratch")?.joints ?? [];
  assert.ok(scratchJoints.includes("head"));
  assert.ok(scratchJoints.includes("leftFlipper"));
  assert.deepEqual([0.1, 0.3, 0.6, 0.9, 1.1].map(restingPenguinReactionStage), ["recover", "stand", "scratch", "lie-down", "resting"]);
  const restingPlan = wildlifeForView(createWildlifePlan(clearDay), "surface").find((animal) => animal.kind === "penguin" && animal.restingPose);
  assert.ok(restingPlan);
  assert.match(wildlifeReactionMessage(restingPlan), /braces.*pushes itself upright.*scratch.*back down/i);
  const penguin = createWildlifeAvatar(restingPlan, "dark");
  const wave = createWaveFieldPlan({ seed: 93, climate: "antarctic", precipitation: "none", seaState: 2, windHeading: 90, windSpeed: 9, currentHeading: 74, currentSpeed: 1.1, waveHeading: 82, storming: false });
  updateWildlifeAvatars([penguin], wave, 10, false);
  assert.equal(penguin.userData.reactionStage, "resting");
  const restingPosition = penguin.position.clone();
  triggerWildlifeAvatarReaction(penguin, 10);
  const expected: Array<[number, string]> = [[10.48, "recover"], [11.44, "stand"], [12.88, "scratch"], [14.32, "lie-down"]];
  for (const [elapsed, stage] of expected) {
    updateWildlifeAvatars([penguin], wave, elapsed, false);
    assert.equal(penguin.userData.reactionStage, stage);
    const rootRotation = penguin.getObjectByName("wildlife-joint-modelRoot")?.rotation.z ?? Number.POSITIVE_INFINITY;
    assert.ok(rootRotation >= -1.321 && rootRotation <= 0.001, "getting up must follow the shortest anatomical rotation, never a full spin");
  }
  for (let frame = 0; frame <= 120; frame += 1) {
    updateWildlifeAvatars([penguin], wave, 10 + frame * 0.04, false);
    const rootRotation = penguin.getObjectByName("wildlife-joint-modelRoot")?.rotation.z ?? Number.POSITIVE_INFINITY;
    assert.ok(rootRotation >= -1.321 && rootRotation <= 0.001, `frame ${frame} accumulated a non-anatomical turn`);
  }
  updateWildlifeAvatars([penguin], wave, 15, false);
  assert.equal(penguin.userData.reactionStage, "resting");
  assert.ok(penguin.position.distanceTo(restingPosition) < 0.001, "the penguin returns to its safe floe waypoint");
  triggerWildlifeAvatarReaction(penguin, 20);
  updateWildlifeAvatars([penguin], wave, 22, true);
  assert.equal(penguin.userData.reactionStage, "scratch");
  const reducedPose = penguin.getObjectByName("wildlife-joint-modelRoot")?.rotation.toArray();
  updateWildlifeAvatars([penguin], wave, 22, true);
  assert.deepEqual(penguin.getObjectByName("wildlife-joint-modelRoot")?.rotation.toArray(), reducedPose);
});

test("surface sharks stay in the water and only reveal a bounded dorsal silhouette", () => {
  const ocean = createWildlifePlan({ ...clearDay, climate: "ocean" as const, season: "wet", regionId: "western-tropical-passage" });
  const plan = wildlifeForView(ocean, "surface").find((animal) => animal.kind === "shark");
  assert.ok(plan);
  const shark = createWildlifeAvatar(plan, "dark");
  assert.equal(shark.userData.avatarEngineVersion, 3);
  const wave = createWaveFieldPlan({ seed: 83, climate: "ocean", precipitation: "none", seaState: 3, windHeading: 90, windSpeed: 12, currentHeading: 74, currentSpeed: 1.1, waveHeading: 82, storming: false });
  let priorPosition: THREE.Vector3 | undefined;
  let travelDistance = 0;
  for (const elapsed of [0, 4, 12, 24, 48]) {
    updateWildlifeAvatars([shark], wave, elapsed, false);
    assert.ok(Number(shark.userData.surfaceOffset) <= 0, "an unprompted shark body must remain below its local wave surface");
    if (priorPosition) travelDistance += shark.position.distanceTo(priorPosition);
    priorPosition = shark.position.clone();
  }
  assert.ok(travelDistance > 3, "a shark must visibly travel through its bounded habitat instead of chilling in one place");
  assert.equal(shark.userData.reactionStage, "traveling");
  triggerWildlifeAvatarReaction(shark, 50);
  updateWildlifeAvatars([shark], wave, 50.9, false);
  assert.ok(Number(shark.userData.surfaceOffset) <= WILDLIFE_AVATAR_ENGINE.maxSurfaceSharkOffset + 1e-9);
  assert.match(wildlifeReactionMessage(plan), /dorsal fin.*tail flick.*below the surface/i);
});

test("surface dolphins stay compact and continuously travel with articulated porpoising", () => {
  const ocean = createWildlifePlan({ ...clearDay, climate: "ocean" as const, season: "wet", regionId: "western-tropical-passage" });
  const plans = wildlifeForView(ocean, "surface").filter((animal) => animal.kind === "dolphin");
  assert.ok(plans.length > 0);
  assert.ok(plans.every((plan) => plan.behavior === "swimming" || plan.behavior === "porpoising"));
  assert.ok(plans.every((plan) => plan.scale >= 0.14 && plan.scale <= 0.195));
  assert.ok(plans.every((plan) => plan.speed >= 0.11 && plan.speed <= 0.16));
  assert.ok(plans.every((plan) => plan.radius >= 1.8 && plan.radius <= 3.2));
  const dolphin = createWildlifeAvatar(plans[0], "dark");
  const wave = createWaveFieldPlan({ seed: 84, climate: "ocean", precipitation: "none", seaState: 3, windHeading: 90, windSpeed: 12, currentHeading: 74, currentSpeed: 1.1, waveHeading: 82, storming: false });
  let priorPosition: THREE.Vector3 | undefined;
  let travelDistance = 0;
  let priorTail = 0;
  let tailChanged = false;
  for (const elapsed of [0, 4, 12, 24, 48]) {
    updateWildlifeAvatars([dolphin], wave, elapsed, false);
    if (priorPosition) travelDistance += dolphin.position.distanceTo(priorPosition);
    priorPosition = dolphin.position.clone();
    const tail = dolphin.getObjectByName("wildlife-joint-tail")?.rotation.y ?? 0;
    if (Math.abs(tail - priorTail) > 0.001) tailChanged = true;
    priorTail = tail;
  }
  assert.ok(travelDistance > 3, "a dolphin must traverse its habitat rather than chill at one wave");
  assert.ok(tailChanged, "a traveling dolphin needs articulated propulsion");
  assert.equal(dolphin.userData.reactionStage, "traveling");
});

test("tactical coordinate helpers and the fallback grid are explicitly non-painting", () => {
  assert.deepEqual(TACTICAL_GRID_PRESENTATION, { surfaceVisible: false, depthVisible: false, opacity: 0 });
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.fallback-grid\s*\{\s*display:\s*none;/);
  assert.doesNotMatch(css, /\.fallback-grid\s*\{[^}]*background-image:/s);
});

test("wildlife display scale preserves a plausible hierarchy beneath operational subjects", () => {
  const polar = wildlifeForView(createWildlifePlan(clearDay), "surface");
  const ocean = wildlifeForView(createWildlifePlan({ ...clearDay, climate: "ocean" as const, season: "wet", regionId: "western-tropical-passage" }), "surface");
  const all = [...polar, ...ocean];
  const maximum = (kind: WildlifeKind) => Math.max(0, ...all.filter((animal) => animal.kind === kind).map((animal) => animal.scale));
  assert.ok(maximum("seabird") < maximum("penguin"));
  assert.ok(maximum("dolphin") <= 0.195, "dolphins remain materially compact beside operational subjects");
  assert.ok(maximum("dolphin") <= maximum("penguin"), "dolphins no longer read as oversized scenery");
  assert.ok(maximum("shark") <= maximum("dolphin"), "sharks and dolphins share a compact marine display band");
  assert.ok(maximum("shark") <= 0.18);
  assert.ok(maximum("dolphin") < maximum("whale"));
  assert.ok(maximum("whale") <= 0.54, "large whales stay legible but materially smaller than selected vessels");
});

test("a requested greeting produces a habitat-specific happy pose without tactical meaning", () => {
  const plan = createWildlifePlan(clearDay);
  const wave = createWaveFieldPlan({ seed: 82, climate: "antarctic", precipitation: "none", seaState: 2, windHeading: 90, windSpeed: 9, currentHeading: 74, currentSpeed: 1.1, waveHeading: 82, storming: false });
  const penguinPlan = wildlifeForView(plan, "surface").find((animal) => animal.kind === "penguin");
  const whalePlan = wildlifeForView(plan, "surface").find((animal) => animal.kind === "whale");
  assert.ok(penguinPlan && whalePlan);
  assert.match(wildlifeReactionMessage(penguinPlan), /hop.*flippers.*ice/i);
  assert.match(wildlifeReactionMessage(whalePlan), /roll.*splash.*waves/i);

  const penguin = createWildlifeAvatar(penguinPlan, "dark");
  updateWildlifeAvatars([penguin], wave, 10, false);
  const restingY = penguin.position.y;
  assert.equal(triggerWildlifeAvatarReaction(penguin, 10), true);
  updateWildlifeAvatars([penguin], wave, 10.9, false);
  assert.ok(penguin.position.y > restingY + 0.2);
  assert.equal(penguin.userData.reactionCount, 1);
  assert.equal(penguin.getObjectByName("wildlife-happy-reaction")?.visible, true);
  updateWildlifeAvatars([penguin], wave, 12, false);
  assert.equal(penguin.getObjectByName("wildlife-happy-reaction")?.visible, false);
  assert.equal(penguin.userData.ring, undefined);
  assert.equal(penguin.userData.contact, undefined);

  triggerWildlifeAvatarReaction(penguin, 20);
  updateWildlifeAvatars([penguin], wave, 20, true);
  const reducedPose = penguin.position.clone();
  updateWildlifeAvatars([penguin], wave, 20, true);
  assert.ok(penguin.position.distanceTo(reducedPose) < 1e-9);
  assert.equal(penguin.getObjectByName("wildlife-happy-reaction")?.visible, true);
});
