import * as THREE from "three";
import { formationMotionProfile, type MotionProfile } from "./propulsion";

export type FormationEffectUnit = Readonly<{
  key: string;
  type: string;
  domain: "surface" | "subsurface" | "air";
  group: THREE.Group;
}>;
export type FormationEffectSample = Readonly<{ motionStrength: number; moving: boolean }>;
export type FormationEffectsOptions = Readonly<{
  waterVisible?: boolean;
  surfaceWakeOpacity?: number;
  sampleSurfaceHeight?: (x: number, z: number, elapsed: number) => number;
}>;

/** Local, short-lived disturbances only. These meshes never enter the native
 * glow source list and do not own animation, timers, or simulation state. */
export const FORMATION_EFFECT_LIMITS = Object.freeze({
  trailPoints: 20,
  trailLifetime: 1.6,
  trailSampleInterval: 0.09,
  maxRotorHeight: 6.5,
  maxHistoryStep: 4,
});

type TrailPoint = { position: THREE.Vector3; at: number; strength: number };
type Wake = THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
type UnitEffects = {
  unit: FormationEffectUnit;
  profile: MotionProfile;
  root: THREE.Group;
  wake?: Wake;
  wakeScale?: THREE.Vector3;
  wakeColor?: THREE.Color;
  wakeOpacity: number;
  trail?: Wake;
  rings: Wake[];
  history: TrailPoint[];
  recycledHistory: TrailPoint[];
  anchor: THREE.Vector3;
  lastAt: number;
  sternOffset: number;
  visualScale: number;
};
export type FormationEffectsRuntime = {
  group: THREE.Group;
  units: UnitEffects[];
  options: FormationEffectsOptions;
};

function bounded(value: number, maximum = 1): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(maximum, value)) : 0;
}

const wakeHighlight = new THREE.Color(0xeaf6f1);

function surfaceHeight(options: FormationEffectsOptions, x: number, z: number, elapsed: number, fallback = 0): number {
  const sampled = options.sampleSurfaceHeight?.(x, z, elapsed);
  return sampled !== undefined && Number.isFinite(sampled) ? sampled : fallback;
}

function subjectVisible(group: THREE.Group): boolean {
  let ancestor: THREE.Object3D | null = group;
  while (ancestor) {
    if (!ancestor.visible) return false;
    ancestor = ancestor.parent;
  }
  return true;
}

function nativeColor(group: THREE.Group): THREE.Color {
  const result = new THREE.Color(0x91b6af);
  let found = false;
  group.traverse((object) => {
    if (found || !(object instanceof THREE.Mesh) || object === group.userData.wake || object === group.userData.ring) return;
    const material = object.material;
    if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshBasicMaterial) {
      result.copy(material.color);
      found = true;
    }
  });
  return result;
}

function effectMaterial(color: THREE.Color): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0, depthWrite: false, depthTest: true,
    side: THREE.DoubleSide, fog: true, blending: THREE.NormalBlending,
  });
}

function createTrail(color: THREE.Color): Wake {
  const geometry = new THREE.BufferGeometry();
  const count = FORMATION_EFFECT_LIMITS.trailPoints;
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
  const indices = new Uint16Array((count - 1) * 6);
  for (let index = 0; index < count - 1; index++) {
    const vertex = index * 2;
    indices.set([vertex, vertex + 1, vertex + 2, vertex + 1, vertex + 3, vertex + 2], index * 6);
  }
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.setDrawRange(0, 0);
  const trail = new THREE.Mesh(geometry, effectMaterial(color));
  trail.name = "formation-travel-wake";
  trail.userData.dreamEmissionExcluded = true;
  // The fixed buffer starts empty and changes each frame; no stale bounds may
  // cause a curved wake to disappear as its source crosses a frustum edge.
  trail.frustumCulled = false;
  trail.visible = false;
  return trail;
}

/** Call after model construction. The existing surface-vessel wake is reused
 * by identity; all additional geometry belongs to the scene's normal cleanup. */
export function createFormationEffects(
  scene: THREE.Scene,
  units: readonly FormationEffectUnit[],
  options: FormationEffectsOptions = {},
): FormationEffectsRuntime {
  const group = new THREE.Group();
  group.name = "formation-environment-reaction";
  group.userData.dreamEmissionExcluded = true;
  scene.add(group);
  const runtimes = units.map((unit): UnitEffects => {
    const root = new THREE.Group();
    root.name = `formation-reaction:${unit.key}`;
    root.userData.dreamEmissionExcluded = true;
    group.add(root);
    const candidate = unit.group.userData.wake;
    const wake = candidate instanceof THREE.Mesh && candidate.material instanceof THREE.MeshBasicMaterial ? candidate as Wake : undefined;
    const rotor = unit.domain === "air" && unit.group.userData.rotor instanceof THREE.Object3D;
    const color = nativeColor(unit.group).lerp(new THREE.Color(unit.domain === "air" ? 0xc7dcd7 : 0xd0e4dc), 0.35);
    const profile = formationMotionProfile(unit.type);
    // Ordinary low-altitude fixed-wing flight does not imply visible
    // condensation. Keep water disturbances; do not invent a persistent
    // white exhaust/contrail for every jet or propeller aircraft.
    const trail = unit.domain === "air" ? undefined : createTrail(color);
    if (trail) root.add(trail);
    const rings = rotor ? Array.from({ length: 2 }, () => {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 36), effectMaterial(color));
      ring.name = "rotor-surface-downwash-reaction";
      ring.userData.dreamEmissionExcluded = true;
      ring.rotation.x = -Math.PI / 2;
      ring.visible = false;
      root.add(ring);
      return ring;
    }) : [];
    return {
      unit, profile, root, wake, wakeScale: wake?.scale.clone(), wakeColor: wake?.material.color.clone(),
      wakeOpacity: options.surfaceWakeOpacity === undefined ? wake?.material.opacity ?? 0 : bounded(options.surfaceWakeOpacity),
      trail, rings, history: [], recycledHistory: [], anchor: new THREE.Vector3(), lastAt: -Infinity, visualScale: 1,
      sternOffset: wake ? Math.abs(wake.position.x) + 0.3 : unit.domain === "subsurface" ? 1.1 : 0.63,
    };
  });
  return { group, units: runtimes, options };
}

function clearTravel(runtime: UnitEffects): void {
  while (runtime.history.length) runtime.recycledHistory.push(runtime.history.pop()!);
  runtime.lastAt = -Infinity;
  if (runtime.trail) {
    runtime.trail.visible = false;
    runtime.trail.geometry.setDrawRange(0, 0);
    runtime.trail.material.opacity = 0;
  }
  runtime.rings.forEach((ring) => { ring.visible = false; ring.material.opacity = 0; });
}

function updateTrail(runtime: UnitEffects, elapsed: number, strength: number, options: FormationEffectsOptions): void {
  const { trail, history, anchor, unit } = runtime;
  if (!trail) return;
  const { trailLifetime, trailSampleInterval, trailPoints, maxHistoryStep } = FORMATION_EFFECT_LIMITS;
  const last = history[history.length - 1];
  if (last && (elapsed < last.at || anchor.distanceToSquared(last.position) > maxHistoryStep ** 2)) clearTravel(runtime);
  while (history.length && elapsed - history[0].at > trailLifetime) runtime.recycledHistory.push(history.shift()!);
  if (strength > 0 && elapsed - runtime.lastAt >= trailSampleInterval) {
    const previous = history[history.length - 1];
    if (!previous || anchor.distanceToSquared(previous.position) > 0.0004) {
      // Age expiry normally occurs before the capacity limit. Reuse those
      // expired records too, so a long maneuver creates no ongoing vector GC.
      const point = history.length >= trailPoints - 1 ? history.shift()!
        : runtime.recycledHistory.pop() ?? { position: new THREE.Vector3(), at: 0, strength: 0 };
      point.position.copy(anchor); point.at = elapsed; point.strength = strength;
      history.push(point);
      runtime.lastAt = elapsed;
    }
  }
  const latest = history[history.length - 1];
  const liveTip = strength > 0 && latest && anchor.distanceToSquared(latest.position) > 0.000001;
  const count = Math.min(trailPoints, history.length + (liveTip ? 1 : 0));
  if (count < 2 || !latest) { trail.visible = false; trail.geometry.setDrawRange(0, 0); return; }
  const positions = trail.geometry.getAttribute("position") as THREE.BufferAttribute;
  const propulsorWidth = runtime.profile.propulsion === "waterjet" ? 0.65
    : runtime.profile.propulsion === "pumpjet" ? 0.6 : runtime.profile.propulsion === "electric-screw" ? 0.75 : 1;
  const width = (unit.domain === "surface" ? 0.24 : 0.11) * runtime.visualScale * propulsorWidth;
  for (let index = 0; index < count; index++) {
    const point = index < history.length ? history[index].position : anchor;
    const before = history[Math.max(0, index - 1)].position;
    const after = index + 1 < history.length ? history[index + 1].position : anchor;
    const dx = after.x - before.x; const dz = after.z - before.z;
    const length = Math.hypot(dx, dz) || 1;
    const age = index < history.length ? bounded((elapsed - history[index].at) / trailLifetime) : 0;
    const fade = 1 - age;
    const taper = index === 0 ? 0 : width * Math.sin(Math.min(1, index / (count - 1)) * Math.PI * 0.7) * fade;
    const turbulence = unit.domain === "subsurface" ? 0.88 + Math.sin(index * 1.7) * 0.12 : 1;
    const offsetX = -dz / length * taper * turbulence;
    const offsetZ = dx / length * taper * turbulence;
    const y = unit.domain === "surface" ? surfaceHeight(options, point.x, point.z, elapsed, point.y - 0.035) + 0.035 : point.y;
    positions.setXYZ(index * 2, point.x + offsetX, y, point.z + offsetZ);
    positions.setXYZ(index * 2 + 1, point.x - offsetX, y, point.z - offsetZ);
  }
  positions.needsUpdate = true;
  trail.geometry.setDrawRange(0, (count - 1) * 6);
  const decay = 1 - bounded((elapsed - latest.at) / trailLifetime);
  trail.material.opacity = (unit.domain === "surface" ? 0.18 : 0.14) * runtime.profile.disturbance * latest.strength * decay;
  trail.visible = trail.material.opacity > 0.001 && (unit.domain !== "surface" || options.waterVisible !== false);
}

/** Run from the existing render loop after formation transforms and wave bob.
 * Map values can be full FormationSample records: only travel intent is read.
 * Paused scenes need no separate work; reduced motion clears all added motion. */
export function updateFormationEffects(
  runtime: FormationEffectsRuntime,
  elapsed: number,
  reducedMotion: boolean,
  samples: ReadonlyMap<string, FormationEffectSample>,
): void {
  for (const unitRuntime of runtime.units) {
    const { unit, wake, wakeScale, wakeColor, rings, anchor } = unitRuntime;
    const sample = samples.get(unit.key);
    const valid = Number.isFinite(elapsed) && subjectVisible(unit.group) && !!sample;
    const strength = !reducedMotion && valid && sample?.moving ? bounded(sample.motionStrength) : 0;
    if (wake && wakeScale && wakeColor) {
      const wash = strength * unitRuntime.profile.disturbance;
      wake.scale.copy(wakeScale);
      wake.scale.x *= 1 + wash * 0.55;
      wake.scale.y *= 1 + wash * (unitRuntime.profile.propulsion === "waterjet" ? -0.1 : 0.15);
      wake.material.opacity = Math.min(0.55, unitRuntime.wakeOpacity + wash * 0.12);
      wake.material.color.copy(wakeColor).lerp(wakeHighlight, wash * 0.1);
    }
    if (reducedMotion || !valid) { clearTravel(unitRuntime); continue; }
    if (!unitRuntime.trail && !rings.length) continue;
    unit.group.updateWorldMatrix(true, false);
    const elements = unit.group.matrixWorld.elements;
    unitRuntime.visualScale = Math.hypot(elements[0], elements[1], elements[2]);
    anchor.set(-unitRuntime.sternOffset, unit.domain === "surface" ? -0.1 : 0, 0).applyMatrix4(unit.group.matrixWorld);
    if (!Number.isFinite(anchor.x) || !Number.isFinite(anchor.y) || !Number.isFinite(anchor.z)) { clearTravel(unitRuntime); continue; }
    if (unit.domain === "surface") anchor.y = surfaceHeight(runtime.options, anchor.x, anchor.z, elapsed, anchor.y - 0.035) + 0.035;
    updateTrail(unitRuntime, elapsed, strength, runtime.options);
    rings.forEach((ring, index) => {
      const worldX = unit.group.matrixWorld.elements[12];
      const worldY = unit.group.matrixWorld.elements[13];
      const worldZ = unit.group.matrixWorld.elements[14];
      const surface = surfaceHeight(runtime.options, worldX, worldZ, elapsed);
      const height = worldY - surface;
      const altitudeFade = bounded(1 - Math.max(0, height) / FORMATION_EFFECT_LIMITS.maxRotorHeight);
      const phase = ((elapsed * 0.45 + index * 0.5) % 1 + 1) % 1;
      const radius = (0.9 + phase * 1.35) * unitRuntime.visualScale;
      ring.position.set(worldX, surface + 0.045, worldZ);
      ring.scale.set(radius, radius * 0.8, 1);
      // Hover still needs thrust. Keep its low-altitude downwash even when
      // the rotorcraft has completed its horizontal station change.
      const rotorThrust = (0.38 + 0.62 * strength) * unitRuntime.profile.disturbance;
      ring.material.opacity = Math.sin(phase * Math.PI) * 0.16 * rotorThrust * altitudeFade;
      ring.visible = runtime.options.waterVisible !== false && Number.isFinite(surface) && height > 0 && ring.material.opacity > 0.001;
    });
  }
}
