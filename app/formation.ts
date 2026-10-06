import { AIRCRAFT, PLATFORMS } from "./catalog";
import { stableSeed } from "./viewModel";
import { FIXED_WING_PATROL_RATE, FORMATION_GROUP_ADVANCE, formationMotionProfile } from "./propulsion";

export type FormationPosition = readonly [number, number, number];
export type FormationDomain = "surface" | "subsurface" | "air";
export type FormationRole = "aviation-core" | "support-core" | "surface-screen" | "undersea-screen" | "rotary-support" | "fixed-wing-screen";
export type FormationUnit = {
  key: string;
  type: string;
  ordinal: number;
  domain: FormationDomain;
  role: FormationRole;
  position: FormationPosition;
  heading: number;
  visualScale: number;
  clearanceRadius: number;
};

/** Presentation-space distances, never tactical ranges or adjudication inputs. */
export const FORMATION_BOUNDS = { horizontal: 10.5, minimumY: -4.8, maximumY: 7.1 } as const;
const SUBMARINE_TYPES = new Set(["air-independent-submarine", "long-endurance-submarine"]);
const AVIATION_SHIPS = new Set(["fleet-aviation-ship", "short-deck-aviation-ship", "expeditionary-aviation-dock", "uncrewed-aviation-ship"]);
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function selectedCount(value: number | undefined) {
  if (value === undefined) return 0;
  // Match the save-format count domain. Reject invalid input instead of quietly
  // truncating a valid selection to a renderer-specific per-type/total limit.
  if (!Number.isInteger(value) || value < 0 || value > 99) throw new RangeError("Formation counts must be whole numbers from 0 to 99.");
  return value;
}

function unit(type: string, ordinal: number, domain: FormationDomain, role: FormationRole, radius: number): FormationUnit {
  return {
    key: `${domain}:${type}:${ordinal}`,
    type,
    ordinal,
    domain,
    role,
    position: [0, 0, 0],
    heading: -0.16,
    visualScale: 1,
    clearanceRadius: radius,
  };
}

function placeRing(units: FormationUnit[], xRadius: number, zRadius: number, y: number, phase: number, centerSingle = false) {
  units.forEach((member, index) => {
    const angle = phase + index * Math.PI * 2 / units.length;
    member.position = centerSingle && units.length === 1 ? [0, y, 0] : [Math.cos(angle) * xRadius, y, Math.sin(angle) * zRadius];
  });
}

function placeAir(units: FormationUnit[], innerRadius: number, outerRadius: number, y: number, phase: number) {
  units.forEach((member, index) => {
    // A filled, staggered disc keeps large legal detachments individually
    // represented instead of stacking models into a fixed repeating grid.
    const radius = Math.sqrt(innerRadius ** 2 + (index + 0.5) / units.length * (outerRadius ** 2 - innerRadius ** 2));
    const angle = phase + index * GOLDEN_ANGLE;
    member.position = [Math.cos(angle) * radius, y + Math.sin(angle * 2) * 0.28, Math.sin(angle) * radius * 0.78];
    member.heading = -0.16 + Math.sin(angle) * 0.12;
  });
}

function distance(a: FormationPosition, b: FormationPosition) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

type ClearanceNode = {
  member: FormationUnit;
  axis: 0 | 1 | 2;
  minimum: FormationPosition;
  maximum: FormationPosition;
  lower: ClearanceNode | null;
  upper: ClearanceNode | null;
};

function clearanceIndex(members: FormationUnit[]): ClearanceNode | null {
  if (!members.length) return null;
  const minimum = [Infinity, Infinity, Infinity];
  const maximum = [-Infinity, -Infinity, -Infinity];
  for (const member of members) for (let axis = 0; axis < 3; axis++) {
    minimum[axis] = Math.min(minimum[axis], member.position[axis]);
    maximum[axis] = Math.max(maximum[axis], member.position[axis]);
  }
  // Choose actual spatial spread, so flat sea-level rings do not repeatedly
  // split on their identical Y coordinates and degenerate into full scans.
  let axis: 0 | 1 | 2 = maximum[1] - minimum[1] > maximum[0] - minimum[0] ? 1 : 0;
  if (maximum[2] - minimum[2] > maximum[axis] - minimum[axis]) axis = 2;
  members.sort((a, b) => a.position[axis] - b.position[axis]);
  const middle = Math.floor(members.length / 2);
  return { member: members[middle], axis,
    minimum: minimum as unknown as FormationPosition, maximum: maximum as unknown as FormationPosition,
    lower: clearanceIndex(members.slice(0, middle)),
    upper: clearanceIndex(members.slice(middle + 1)) };
}

function nearestClearanceScale(node: ClearanceNode | null, member: FormationUnit, denominator: number, scale: number): number {
  if (!node) return scale;
  // Whole bounds matter when two radius classes occupy different altitudes
  // or concentric rings; a split-plane test alone scans most of a distant class.
  const [x, y, z] = member.position;
  const lowerBound = Math.hypot(
    Math.max(0, node.minimum[0] - x, x - node.maximum[0]),
    Math.max(0, node.minimum[1] - y, y - node.maximum[1]),
    Math.max(0, node.minimum[2] - z, z - node.maximum[2]),
  );
  if (lowerBound / denominator > scale) return scale;
  if (node.member !== member) scale = Math.min(scale, distance(member.position, node.member.position) / denominator);
  const delta = member.position[node.axis] - node.member.position[node.axis];
  scale = nearestClearanceScale(delta <= 0 ? node.lower : node.upper, member, denominator, scale);
  // A point on the other side cannot be closer than the split-plane gap.
  // Keep ties, and compare distances directly rather than squared/rounded
  // surrogates, preserving the exhaustive planner's exact floating values.
  if (Math.abs(delta) / denominator <= scale) scale = nearestClearanceScale(delta <= 0 ? node.upper : node.lower, member, denominator, scale);
  return scale;
}

function fitFormationClearance(units: FormationUnit[]) {
  if (units.length <= 64) {
    // Small ordinary rosters are cheaper without building an index.
    for (let a = 0; a < units.length; a++) for (let b = a + 1; b < units.length; b++) {
      const scale = Math.min(1, distance(units[a].position, units[b].position) / ((units[a].clearanceRadius + units[b].clearanceRadius) * 1.08));
      units[a].visualScale = Math.min(units[a].visualScale, scale);
      units[b].visualScale = Math.min(units[b].visualScale, scale);
    }
    return;
  }
  const classes = new Map<number, FormationUnit[]>();
  for (const member of units) {
    const group = classes.get(member.clearanceRadius) ?? [];
    group.push(member);
    classes.set(member.clearanceRadius, group);
  }
  const indices = new Map([...classes].map(([radius, members]) => [radius, clearanceIndex(members)]));
  // For a fixed radius class the denominator is constant. Its nearest member
  // therefore gives the exact minimum clearance ratio for that entire class.
  // Original radii remain unchanged until every query has finished.
  for (const member of units) {
    // Its own class usually supplies a close neighbor first. Later classes
    // can skip whole bounds whose best possible ratio cannot reduce its size.
    member.visualScale = nearestClearanceScale(indices.get(member.clearanceRadius)!, member, (member.clearanceRadius + member.clearanceRadius) * 1.08, member.visualScale);
    for (const [radius, root] of indices) {
      if (radius === member.clearanceRadius) continue;
      member.visualScale = nearestClearanceScale(root, member, (member.clearanceRadius + radius) * 1.08, member.visualScale);
    }
  }
}

/**
 * A stylized task-group tableau using the catalog's fictional roles: aviation
 * and support near the center, escorts around them, submarines outboard below,
 * rotary support nearer/lower, and fixed-wing aircraft higher/outboard.
 * Every selected catalog instance is represented. This changes no game state,
 * aircraft-host allocation, operational readiness, or real-world doctrine.
 */
export function createFormationPlan(fleet: Readonly<Record<string, number>>, airWing: Readonly<Record<string, number>>): FormationUnit[] {
  const core: FormationUnit[] = [];
  const screen: FormationUnit[] = [];
  const subsurface: FormationUnit[] = [];
  const rotary: FormationUnit[] = [];
  const fixedWing: FormationUnit[] = [];
  // Catalog order, not object insertion order, determines layout and identity.
  for (const platform of PLATFORMS) {
    const count = selectedCount(fleet[platform.id]);
    for (let ordinal = 0; ordinal < count; ordinal++) {
      if (SUBMARINE_TYPES.has(platform.id)) subsurface.push(unit(platform.id, ordinal, "subsurface", "undersea-screen", 1.3));
      else if (AVIATION_SHIPS.has(platform.id)) core.push(unit(platform.id, ordinal, "surface", "aviation-core", 2.6));
      else if (platform.screenUnit) screen.push(unit(platform.id, ordinal, "surface", "surface-screen", 1.7));
      else core.push(unit(platform.id, ordinal, "surface", "support-core", 1.7));
    }
  }
  for (const aircraft of AIRCRAFT) {
    const count = selectedCount(airWing[aircraft.id]);
    const isRotary = aircraft.kind === "rotary" || aircraft.kind === "uncrewed-vertical";
    for (let ordinal = 0; ordinal < count; ordinal++) {
      (isRotary ? rotary : fixedWing).push(unit(aircraft.id, ordinal, "air", isRotary ? "rotary-support" : "fixed-wing-screen", aircraft.kind.startsWith("uncrewed") ? 0.88 : 1.1));
    }
  }

  placeRing(core, 3.5, 3.2, 0.16, Math.PI * 0.82, true);
  placeRing(screen, 8.3, 7.3, 0.16, Math.PI * 0.1);
  placeRing(subsurface, 8.8, 6.8, -4.25, Math.PI * 0.3);
  placeAir(rotary, 1.8, 6.7, 3.65, 0.6);
  placeAir(fixedWing, 3.2, 9.2, 6.45, 1.4);
  const units = [...core, ...screen, ...subsurface, ...rotary, ...fixedWing];
  // Fit the actual model envelopes to available space. Dense selections become
  // smaller; no selected unit disappears and no two target envelopes overlap.
  fitFormationClearance(units);
  units.forEach((member) => { member.clearanceRadius *= member.visualScale; });
  return units;
}

export type FormationSample = {
  position: FormationPosition;
  velocity: FormationPosition;
  heading: number;
  /** Radians about local forward X and lateral Z, respectively. */
  bank: number;
  pitch: number;
  visualScale: number;
  speed: number;
  moving: boolean;
  motionStrength: number;
};
export type FormationTransition = {
  target: FormationUnit;
  from: FormationSample;
  startedAt: number;
  duration: number;
  bend: FormationPosition;
  frozen?: boolean;
  patrolOrigin?: number;
  localFrom?: { position: FormationPosition; velocity: FormationPosition };
  polar?: { fromAngle: number; toAngle: number; fromRadius: number; toRadius: number; angularVelocity: number; radialVelocity: number };
};
export type FormationMotionState = Map<string, FormationTransition>;

function settledSample(target: FormationUnit): FormationSample {
  return { position: target.position, velocity: [0, 0, 0], heading: target.heading, bank: 0, pitch: 0, visualScale: target.visualScale, speed: 0, moving: false, motionStrength: 0 };
}

function angleToward(from: number, to: number, amount: number) {
  return from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * amount;
}

function smoothstep(value: number) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function clamp(value: number, limit: number) { return Math.max(-limit, Math.min(limit, value)); }
function rotate(position: FormationPosition, angle: number): FormationPosition {
  const c = Math.cos(angle); const s = Math.sin(angle);
  return [position[0] * c - position[2] * s, position[1], position[0] * s + position[2] * c];
}

/** Quintic arrival has no acceleration step at departure/arrival. Initial
 * velocity is retained when a selection interrupts a maneuver. */
function axisMotion(start: number, velocity: number, end: number, duration: number, t: number, bend: number) {
  const d = end - start; const v = velocity * duration;
  const a = 10 * d - 6 * v; const b = -15 * d + 8 * v; const c = 6 * d - 3 * v;
  const bow = 64 * t ** 3 * (1 - t) ** 3;
  const dBow = 192 * t ** 2 - 768 * t ** 3 + 960 * t ** 4 - 384 * t ** 5;
  const ddBow = 384 * t - 2304 * t ** 2 + 3840 * t ** 3 - 1920 * t ** 4;
  return [start + v * t + a * t ** 3 + b * t ** 4 + c * t ** 5 + bow * bend,
    (v + 3 * a * t ** 2 + 4 * b * t ** 3 + 5 * c * t ** 4 + dBow * bend) / duration,
    (6 * a * t + 12 * b * t ** 2 + 20 * c * t ** 3 + ddBow * bend) / duration ** 2];
}

/** Sample with one persistent presentation clock, including across scene rebuilds.
 * Coordinates are relative to the underway group, not absolute sea positions. */
export function sampleFormationMotion(transition: FormationTransition, nowSeconds: number, reducedMotion = false): FormationSample {
  const { target, from, duration, startedAt, bend } = transition;
  if (reducedMotion || transition.frozen) return settledSample(target);
  const fixedWing = target.role === "fixed-wing-screen";
  const active = duration > 0 && nowSeconds < startedAt + duration;
  if (!active && !fixedWing) return settledSample(target);
  // Returning the retained sample also preserves bank/pitch at a retarget.
  if (active && nowSeconds <= startedAt) return from;
  const t = active ? Math.max(0, Math.min(1, (nowSeconds - startedAt) / duration)) : 1;
  const start = transition.localFrom ?? from;
  let position = target.position;
  let velocity: FormationPosition = [0, 0, 0];
  let acceleration: FormationPosition = [0, 0, 0];
  if (active) {
    const axes = [0, 1, 2].map((axis) => axisMotion(start.position[axis], start.velocity[axis], target.position[axis], duration, t, bend[axis]));
    position = axes.map((axis) => axis[0]) as unknown as FormationPosition;
    velocity = axes.map((axis) => axis[1]) as unknown as FormationPosition;
    acceleration = axes.map((axis) => axis[2]) as unknown as FormationPosition;
    if (transition.polar) {
      const arc = transition.polar;
      const [radius, radialVelocity, radialAcceleration] = axisMotion(arc.fromRadius, arc.radialVelocity, arc.toRadius, duration, t, 0);
      const [angle, angularVelocity, angularAcceleration] = axisMotion(arc.fromAngle, arc.angularVelocity, arc.toAngle, duration, t, 0);
      const c = Math.cos(angle); const s = Math.sin(angle);
      position = [radius * c, position[1], radius * s];
      velocity = [radialVelocity * c - radius * s * angularVelocity, velocity[1], radialVelocity * s + radius * c * angularVelocity];
      acceleration = [(radialAcceleration - radius * angularVelocity ** 2) * c - (2 * radialVelocity * angularVelocity + radius * angularAcceleration) * s,
        acceleration[1], (radialAcceleration - radius * angularVelocity ** 2) * s + (2 * radialVelocity * angularVelocity + radius * angularAcceleration) * c];
    }
  }
  if (fixedWing) {
    const w = FIXED_WING_PATROL_RATE;
    const phase = (nowSeconds - (transition.patrolOrigin ?? 0)) * w;
    acceleration = rotate([acceleration[0] - 2 * w * velocity[2] - w ** 2 * position[0], acceleration[1], acceleration[2] + 2 * w * velocity[0] - w ** 2 * position[2]], phase);
    velocity = rotate([velocity[0] - w * position[2], velocity[1], velocity[2] + w * position[0]], phase);
    position = rotate(position, phase);
  }
  const profile = formationMotionProfile(target.type);
  const speed = Math.hypot(...velocity);
  const horizontalSpeed = Math.hypot(velocity[0], velocity[2]);
  let heading: number; let bank = 0; let pitch = 0;
  if (target.domain !== "air") {
    // A ship making room is still underway with its group. Rudders/planes
    // respond to through-water movement, not to motion relative to the camera.
    const x = velocity[0] + Math.cos(target.heading) * FORMATION_GROUP_ADVANCE;
    const z = velocity[2] - Math.sin(target.heading) * FORMATION_GROUP_ADVANCE;
    // Azimuthing support ships can vector thrust during precise lateral
    // station corrections while holding group course; fixed rudder/screw and
    // jet-steered hulls turn into the resulting underway path.
    heading = profile.propulsion === "azimuth-thruster" ? target.heading : Math.atan2(-z, x);
    pitch = target.domain === "subsurface" ? clamp(Math.atan2(velocity[1], Math.hypot(x, z)), 0.12) : 0;
  } else if (fixedWing) {
    heading = horizontalSpeed > 0.000001 ? Math.atan2(-velocity[2], velocity[0]) : from.heading;
    const yawRate = horizontalSpeed > 0.000001 ? (velocity[2] * acceleration[0] - velocity[0] * acceleration[2]) / horizontalSpeed ** 2 : 0;
    // Coordinated bank follows curvature and speed; presentation gravity is
    // scaled with the miniature scene, not asserted as real-world units.
    bank = clamp(-Math.atan2(horizontalSpeed * yawRate, 1.8), profile.maxBank);
    pitch = clamp(Math.atan2(velocity[1], horizontalSpeed), 0.22);
  } else {
    const travelHeading = horizontalSpeed > 0.00001 ? Math.atan2(-velocity[2], velocity[0]) : from.heading;
    heading = angleToward(from.heading, travelHeading, smoothstep(t / 0.3));
    heading = angleToward(heading, target.heading, smoothstep((t - 0.65) / 0.35));
    // Rotor thrust tilts to accelerate and reverses tilt while braking into a
    // hover. Unlike fixed-wing aircraft, zero forward speed is valid here.
    const forwardAcceleration = acceleration[0] * Math.cos(heading) - acceleration[2] * Math.sin(heading);
    const lateralAcceleration = acceleration[0] * Math.sin(heading) + acceleration[2] * Math.cos(heading);
    pitch = clamp(-Math.atan2(forwardAcceleration, 5), 0.22);
    bank = clamp(Math.atan2(lateralAcceleration, 5), profile.maxBank);
  }
  if (active) {
    const release = smoothstep(t / 0.12);
    heading = angleToward(from.heading, heading, release);
    bank = from.bank + (bank - from.bank) * release;
    pitch = from.pitch + (pitch - from.pitch) * release;
  }
  return { position, velocity, heading, bank, pitch,
    visualScale: from.visualScale + (target.visualScale - from.visualScale) * smoothstep(t),
    speed, moving: active || fixedWing, motionStrength: Math.min(1, speed / profile.relativeSpeed) };
}

/**
 * Reconcile by stable instance identity. Existing paths survive an unchanged
 * target; changed targets start from their current sampled pose and velocity.
 * New units appear in their own slot or approach from nearby clear water while
 * neighbors make room.
 */
export function reconcileFormationMotion(previous: FormationMotionState | undefined, units: readonly FormationUnit[], nowSeconds: number, reducedMotion = false): FormationMotionState {
  const next: FormationMotionState = new Map();
  const patrolOrigin = [...(previous?.values() ?? [])].find((transition) => transition.target.role === "fixed-wing-screen" && !transition.frozen)?.patrolOrigin ?? nowSeconds;
  const occupied = units.flatMap((target) => {
    const retained = previous?.get(target.key);
    return retained ? [{ target, sample: sampleFormationMotion(retained, nowSeconds, reducedMotion) }] : [];
  });
  for (const target of units) {
    const retained = previous?.get(target.key);
    const unchanged = retained && distance(retained.target.position, target.position) < 0.000001
      && Math.abs(retained.target.heading - target.heading) < 0.000001
      && Math.abs(retained.target.visualScale - target.visualScale) < 0.000001;
    if (unchanged && !reducedMotion && !retained.frozen) {
      next.set(target.key, retained);
      continue;
    }
    let from = retained && !reducedMotion ? sampleFormationMotion(retained, nowSeconds) : settledSample(target);
    if ((!retained || retained.frozen) && !reducedMotion && target.role === "fixed-wing-screen") {
      from = sampleFormationMotion({ target, from, startedAt: nowSeconds, duration: 0, bend: [0, 0, 0], patrolOrigin }, nowSeconds);
    }
    if (!retained && previous?.size && !reducedMotion) {
      const arrivalTarget = from.position;
      const occupiedRadius = (member: (typeof occupied)[number]) => member.target.clearanceRadius / member.target.visualScale * member.sample.visualScale;
      const blocks = (position: FormationPosition) => occupied.some((member) => member.target.domain === target.domain
        && distance(position, member.sample.position) < target.clearanceRadius + occupiedRadius(member) + 0.3);
      if (blocks(arrivalTarget)) {
        // A new core unit or catalog-earlier escort may inherit an occupied
        // slot. Start at nearby clear water instead of intersecting the hull
        // making room. Newly reconciled additions also occupy their start.
        const angle = Math.atan2(arrivalTarget[2], arrivalTarget[0]);
        const departing = occupied.find((member) => member.target.domain === target.domain
          && distance(arrivalTarget, member.sample.position) < target.clearanceRadius + occupiedRadius(member) + 0.3);
        const departingAngle = departing ? Math.atan2(departing.sample.position[2], departing.sample.position[0]) : angle;
        const departingTarget = departing ? Math.atan2(departing.target.position[2], departing.target.position[0]) : angle;
        const departingTurn = Math.atan2(Math.sin(departingTarget - departingAngle), Math.cos(departingTarget - departingAngle));
        const preferredSide = departingTurn === 0 ? -1 : -Math.sign(departingTurn);
        let arrival: FormationPosition | undefined;
        if (target.role === "aviation-core" || target.role === "support-core") {
          // A second carrier enters along its own side of the core while the
          // original carrier moves toward the opposite slot. Candidate sphere
          // exits give the nearest clear radial start, not a large edge jump.
          const directionX = Math.cos(angle);
          const directionZ = Math.sin(angle);
          const targetRadius = Math.hypot(target.position[0], target.position[2]);
          const candidates = occupied.flatMap((member) => {
            if (member.target.domain !== target.domain) return [];
            const [x, y, z] = member.sample.position;
            const projection = x * directionX + z * directionZ;
            const perpendicularSquared = x ** 2 + z ** 2 + (y - target.position[1]) ** 2 - projection ** 2;
            const clearance = target.clearanceRadius + occupiedRadius(member) + 0.3;
            if (perpendicularSquared >= clearance ** 2) return [];
            return [projection + Math.sqrt(clearance ** 2 - perpendicularSquared) + 0.001];
          }).filter((radius) => radius > targetRadius && radius <= 9.2).sort((a, b) => a - b);
          for (const radius of candidates) {
            const candidate: FormationPosition = [directionX * radius, target.position[1], directionZ * radius];
            if (!blocks(candidate)) { arrival = candidate; break; }
          }
        }
        for (const radius of target.domain === "air" ? [10, 8.8, 7.2, 5.5, 3.5] : [9.2, 8, 6.7]) {
          if (arrival) break;
          for (let step = 1; step <= 16 && !arrival; step++) {
            for (const sign of [preferredSide, -preferredSide]) {
              const candidate: FormationPosition = [Math.cos(angle + sign * step * Math.PI / 12) * radius, target.position[1], Math.sin(angle + sign * step * Math.PI / 12) * radius];
              if (!blocks(candidate)) { arrival = candidate; break; }
            }
          }
          if (arrival) break;
        }
        if (arrival) {
          from = { ...from, position: arrival };
          if (target.role === "fixed-wing-screen") {
            const admission = { ...target, position: rotate(arrival, -(nowSeconds - patrolOrigin) * FIXED_WING_PATROL_RATE) };
            from = sampleFormationMotion({ target: admission, from, startedAt: nowSeconds, duration: 0, bend: [0, 0, 0], patrolOrigin }, nowSeconds);
          }
        }
      }
    }
    if (!retained) occupied.push({ target, sample: from });
    const fixedWing = target.role === "fixed-wing-screen";
    const localPosition = fixedWing ? rotate(from.position, -(nowSeconds - patrolOrigin) * FIXED_WING_PATROL_RATE) : from.position;
    const rotatedVelocity = fixedWing ? rotate(from.velocity, -(nowSeconds - patrolOrigin) * FIXED_WING_PATROL_RATE) : from.velocity;
    const localVelocity: FormationPosition = fixedWing
      ? [rotatedVelocity[0] + FIXED_WING_PATROL_RATE * localPosition[2], rotatedVelocity[1], rotatedVelocity[2] - FIXED_WING_PATROL_RATE * localPosition[0]] : rotatedVelocity;
    const travel = distance(localPosition, target.position);
    const profile = formationMotionProfile(target.type);
    const duration = !reducedMotion && (travel > 0.000001 || Math.abs(from.visualScale - target.visualScale) > 0.000001)
      ? Math.max(profile.minimumDuration, travel * 1.9 / profile.relativeSpeed, Math.sqrt(travel * 6 / profile.acceleration)) : 0;
    const dx = target.position[0] - localPosition[0];
    const dz = target.position[2] - localPosition[2];
    const horizontal = Math.hypot(dx, dz) || 1;
    const sign = (stableSeed(target.key) & 1) === 0 ? 1 : -1;
    const curvature = Math.min(0.48, travel * 0.09) * sign;
    const transition: FormationTransition = { target, from, startedAt: nowSeconds, duration, bend: [-dz / horizontal * curvature, 0, dx / horizontal * curvature], frozen: reducedMotion, patrolOrigin: fixedWing ? patrolOrigin : undefined, localFrom: fixedWing ? { position: localPosition, velocity: localVelocity } : undefined };
    if ((target.role === "surface-screen" || target.role === "undersea-screen" || fixedWing) && Math.hypot(localPosition[0], localPosition[2]) > 1) {
      const fromRadius = Math.hypot(localPosition[0], localPosition[2]);
      const fromAngle = Math.atan2(localPosition[2], localPosition[0]);
      const targetAngle = Math.atan2(target.position[2], target.position[0]);
      let shortestArc = Math.atan2(Math.sin(targetAngle - fromAngle), Math.cos(targetAngle - fromAngle));
      // A fixed wing intercepts the next patrol station forward around the
      // circuit. Taking a shorter reverse arc would force a stop/reversal.
      if (fixedWing && shortestArc < -0.000001) shortestArc += Math.PI * 2;
      transition.polar = {
        fromAngle,
        toAngle: fromAngle + shortestArc,
        fromRadius,
        toRadius: Math.hypot(target.position[0], target.position[2]),
        angularVelocity: (localPosition[0] * localVelocity[2] - localPosition[2] * localVelocity[0]) / fromRadius ** 2,
        radialVelocity: (localPosition[0] * localVelocity[0] + localPosition[2] * localVelocity[2]) / fromRadius,
      };
      if (duration > 0) {
        const radius = Math.max(fromRadius, transition.polar.toRadius);
        const durationForArc = (arc: number) => {
          const pathLength = Math.abs(arc) * radius + Math.abs(fromRadius - transition.polar!.toRadius);
          const response = Math.max(duration, pathLength * 1.9 / profile.relativeSpeed, Math.sqrt(pathLength * 6 / profile.acceleration));
          if (!fixedWing) return response;
          const maxAngularRate = Math.sqrt(1.8 * Math.tan(profile.maxBank) / radius);
          return Math.max(response, arc * 1.9 / Math.max(0.04, maxAngularRate - FIXED_WING_PATROL_RATE));
        };
        transition.duration = durationForArc(shortestArc);
        // Preserve forward travel after a rapid retarget too. A close station
        // behind current angular momentum is intercepted on the next circuit,
        // rather than braking through zero and reversing direction midair.
        if (fixedWing && shortestArc < 0.5 * transition.polar.angularVelocity * transition.duration) {
          shortestArc += Math.PI * 2;
          transition.polar.toAngle = fromAngle + shortestArc;
          transition.duration = durationForArc(shortestArc);
        }
      }
    }
    next.set(target.key, transition);
  }
  // The screen opens together at its slowest member's safe response rate.
  // A newly admitted fast hull must not overtake the ship vacating its slot.
  for (const role of ["surface-screen", "undersea-screen", "fixed-wing-screen"] as const) {
    const changing = [...next.values()].filter((transition) => transition.target.role === role && transition.startedAt === nowSeconds && transition.duration > 0 && transition !== previous?.get(transition.target.key));
    const duration = changing.reduce((longest, transition) => Math.max(longest, transition.duration), 0);
    changing.forEach((transition) => { transition.duration = duration; });
  }
  return next;
}
