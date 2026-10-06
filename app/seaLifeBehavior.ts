import * as THREE from "three";
import { seededRandom, type SubsurfaceLifeProfile } from "./viewModel";

export type SeaLifePhase = "cruise" | "turn" | "regroup" | "forage";

type SeaLifeRig = {
  kind: "fish" | "ray";
  tail: THREE.Group;
  leftFin: THREE.Group;
  rightFin: THREE.Group;
};

type SeaLifeRoute = {
  id: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  eccentricity: number;
  speed: number;
  clockOffset: number;
  headingOffset: number;
};

type SeaLifeMember = {
  route: SeaLifeRoute;
  rig: SeaLifeRig;
  offsetX: number;
  offsetZ: number;
  phase: number;
};

const CYCLE_SECONDS = 32;
const TAU = Math.PI * 2;

function windowStrength(time: number, start: number, end: number) {
  if (time <= start || time >= end) return 0;
  return Math.sin((time - start) / (end - start) * Math.PI) ** 2;
}

/** Integral of the smooth speed window; complete cycles remain continuous. */
function windowTravel(time: number, start: number, end: number) {
  const u = Math.max(0, Math.min(1, (time - start) / (end - start)));
  return (end - start) * (u / 2 - Math.sin(TAU * u) / (TAU * 2));
}

function finGeometry(points: readonly number[]) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** Bounded display fauna, not a census or an operational sensing claim.
 * Geometry/materials are shared within this scene and owned by its traversal. */
export function createSeaLife(profile: SubsurfaceLifeProfile, seed: number, color: number): THREE.Group[] {
  const random = seededRandom(seed);
  const creatures: THREE.Group[] = [];
  const bodyGeometry = new THREE.SphereGeometry(1, 8, 5);
  const tailGeometry = finGeometry([0, 0, 0, -0.26, 0.25, 0, -0.26, -0.25, 0]);
  const fin = finGeometry([0.15, 0, 0, -0.28, 0, 0.34, -0.4, 0, 0]);
  const dorsal = finGeometry([0.13, 0.08, 0, -0.16, 0.33, 0, -0.36, 0.08, 0]);
  const wing = finGeometry([0.35, 0, 0, -0.05, 0, 0.78, -0.43, 0, 0]);
  const bodyMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.82, flatShading: true });
  const finMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.8), roughness: 0.86, flatShading: true, side: THREE.DoubleSide });
  const routes: SeaLifeRoute[] = [];
  const schoolCount = Math.max(0, Math.min(48, Math.floor(profile.schoolCount)));
  const solitaryCount = Math.max(0, Math.min(8, Math.floor(profile.solitaryCount)));
  const groups = Math.ceil(schoolCount / 10);
  for (let index = 0; index < groups + solitaryCount; index++) {
    const school = index < groups;
    const individual = index - groups;
    const angle = individual / Math.max(1, solitaryCount) * TAU + 0.4;
    const radius = school ? 1.8 + random() * 0.45 : 1.1 + random() * 0.5;
    routes.push({
      id: school ? `fish-school-${index}` : `foraging-individual-${individual}`,
      x: school ? (index % 2 === 0 ? -4.2 : 4.2) : Math.cos(angle) * 10,
      y: Math.max((profile.seabedY ?? -12) + 1.1, school ? -2.1 - index * 0.52 : -2.8 - random() * 1.3),
      z: school ? (Math.floor(index / 2) - 0.5) * 7 : Math.sin(angle) * 10,
      radius,
      eccentricity: 0.58 + random() * 0.2,
      speed: school ? 0.11 : 0.065,
      clockOffset: random() * CYCLE_SECONDS,
      headingOffset: random() * TAU,
    });
  }

  for (let index = 0; index < schoolCount + solitaryCount; index++) {
    const school = index < schoolCount;
    const memberIndex = school ? index % 10 : 0;
    const route = routes[school ? Math.floor(index / 10) : groups + index - schoolCount];
    const ray = !school && (index - schoolCount) % 3 === 0;
    // School fish are about 0.18–0.24 units long; individual fish/rays stay
    // below 0.5 units, below the articulated cetaceans and selected vessels.
    const length = school ? 0.18 + random() * 0.06 : 0.3 + random() * 0.12;
    const creature = new THREE.Group();
    creature.name = ray ? "environmental-sea-ray" : "environmental-school-fish";
    creature.scale.setScalar(length);
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.scale.set(0.45, ray ? 0.075 : 0.18, ray ? 0.26 : 0.12);
    body.name = "sea-life-body";
    creature.add(body);

    const tail = new THREE.Group();
    tail.name = "sea-life-tail-joint";
    tail.position.x = -0.36;
    const tailMesh = new THREE.Mesh(tailGeometry, finMaterial);
    if (ray) { tailMesh.rotation.x = Math.PI / 2; tailMesh.scale.set(1.5, 0.24, 1); }
    tail.add(tailMesh);
    const leftFin = new THREE.Group();
    const rightFin = new THREE.Group();
    leftFin.name = "sea-life-left-fin-joint";
    rightFin.name = "sea-life-right-fin-joint";
    leftFin.position.z = ray ? 0.13 : 0.075;
    rightFin.position.z = -leftFin.position.z;
    leftFin.add(new THREE.Mesh(ray ? wing : fin, finMaterial));
    const rightMesh = new THREE.Mesh(ray ? wing : fin, finMaterial);
    rightMesh.scale.z = -1;
    rightFin.add(rightMesh);
    creature.add(tail, leftFin, rightFin);
    if (!ray) creature.add(new THREE.Mesh(dorsal, finMaterial));
    const rig: SeaLifeRig = { kind: ray ? "ray" : "fish", tail, leftFin, rightFin };
    const state: SeaLifeMember = {
      route,
      rig,
      offsetX: school ? -Math.floor(memberIndex / 3) * 0.38 : 0,
      offsetZ: school ? ((memberIndex % 3) - 1) * 0.34 : 0,
      phase: random() * TAU,
    };
    creature.userData.seaLife = state;
    creature.userData.environmentalWildlife = true;
    creature.userData.groupId = route.id;
    creature.userData.schoolMember = school;
    creature.userData.baseX = route.x;
    creature.userData.baseY = route.y;
    creature.userData.baseZ = route.z;
    creature.userData.radius = route.radius + Math.hypot(state.offsetX, state.offsetZ);
    creatures.push(creature);
  }
  // Empty profiles own no drawable resources. Normal profiles share every
  // geometry through actual descendants, so scene cleanup can deduplicate it.
  if (creatures.length === 0) {
    for (const geometry of [bodyGeometry, tailGeometry, fin, dorsal, wing]) geometry.dispose();
    bodyMaterial.dispose();
    finMaterial.dispose();
  } else {
    if (!creatures.some((creature) => (creature.userData.seaLife as SeaLifeMember).rig.kind === "ray")) wing.dispose();
    if (!creatures.some((creature) => (creature.userData.seaLife as SeaLifeMember).rig.kind === "fish")) { fin.dispose(); dorsal.dispose(); }
  }
  updateSeaLife(creatures, 0, true);
  return creatures;
}

/** Analytic group motion, without timers, integration drift, or frame-local
 * object allocations. Reduced motion always returns the same articulated pose. */
export function updateSeaLife(creatures: readonly THREE.Group[], elapsed: number, reducedMotion: boolean) {
  const time = reducedMotion || !Number.isFinite(elapsed) ? 0 : Math.max(0, elapsed);
  for (let index = 0; index < creatures.length; index++) {
    const creature = creatures[index];
    const state = creature.userData.seaLife as SeaLifeMember;
    const { route, rig } = state;
    const clock = time + route.clockOffset;
    const cycle = clock % CYCLE_SECONDS;
    const turns = Math.floor(clock / CYCLE_SECONDS);
    const regroup = windowStrength(cycle, 19, 25);
    const forage = windowStrength(cycle, 25, 32);
    // Shared speed increases during the turn, contracts the school during
    // regrouping, then slows to dip/feed before the next cruising phase.
    const travel = turns * 35.7 + cycle + 2.1 * windowTravel(cycle, 14, 19)
      + 0.3 * windowTravel(cycle, 19, 25) - 0.7 * windowTravel(cycle, 25, 32);
    const angle = route.headingOffset + route.speed * travel;
    const dx = -Math.sin(angle);
    const dz = Math.cos(angle) * route.eccentricity;
    const leaderHeading = Math.atan2(-dz, dx);
    const cosine = Math.cos(leaderHeading);
    const sine = Math.sin(leaderHeading);
    const spread = 1 - regroup * 0.4;
    // Tighten across the school, keeping its fore/aft spacing. Compressing
    // and then expanding the trailing rows can make them swim backwards.
    const spreadRate = cycle > 19 && cycle < 25
      ? -0.4 * Math.PI / 6 * Math.sin((cycle - 19) / 6 * TAU) : 0;
    const offsetX = cosine * state.offsetX + sine * state.offsetZ * spread;
    const offsetZ = -sine * state.offsetX + cosine * state.offsetZ * spread;
    const angleRate = route.speed * (1 + 2.1 * windowStrength(cycle, 14, 19) + 0.3 * regroup - 0.7 * forage);
    const headingRate = -route.eccentricity * angleRate / (dx * dx + dz * dz);
    // Each rotated slot has its own velocity: the leader tangent alone is
    // incorrect in a turn. Include both rotation and changing school width.
    const velocityX = dx * route.radius * angleRate + headingRate * offsetZ + sine * state.offsetZ * spreadRate;
    const velocityZ = dz * route.radius * angleRate - headingRate * offsetX + cosine * state.offsetZ * spreadRate;
    creature.position.set(
      route.x + Math.cos(angle) * route.radius + offsetX,
      route.y - forage * 0.32 + Math.sin(clock * 0.7 + state.phase) * 0.025,
      route.z + Math.sin(angle) * route.radius * route.eccentricity + offsetZ,
    );
    creature.rotation.set(0, Math.atan2(-velocityZ, velocityX), -forage * 0.16);
    const stroke = Math.sin(time * (rig.kind === "ray" ? 2.2 : 7.2) + state.phase);
    rig.tail.rotation.y = stroke * (rig.kind === "ray" ? 0.14 : 0.45);
    rig.leftFin.rotation.x = stroke * (rig.kind === "ray" ? 0.32 : 0.13);
    rig.rightFin.rotation.x = -rig.leftFin.rotation.x;
    creature.userData.behaviorPhase = cycle < 14 ? "cruise" : cycle < 19 ? "turn" : cycle < 25 ? "regroup" : "forage";
    creature.userData.motionState = reducedMotion ? "active-pose-frozen" : "coordinated-route-active";
  }
}
