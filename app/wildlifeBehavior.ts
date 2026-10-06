/** Decorative group choreography. No random draws, timers, or allocations
 * occur while sampling a frame; elapsed presentation time is the only clock. */
export type PenguinRoutine = "form-ranks" | "march" | "left-face" | "right-face" | "about-face" | "inspection" | "salute" | "disperse" | "forage" | "rest";

const PROGRAM: readonly { routine: PenguinRoutine; seconds: number }[] = [
  { routine: "form-ranks", seconds: 6 },
  { routine: "march", seconds: 7 },
  { routine: "left-face", seconds: 3 },
  { routine: "inspection", seconds: 5 },
  { routine: "right-face", seconds: 3 },
  { routine: "march", seconds: 7 },
  { routine: "about-face", seconds: 4 },
  { routine: "salute", seconds: 5 },
  { routine: "disperse", seconds: 6 },
  { routine: "forage", seconds: 8 },
  { routine: "rest", seconds: 5 },
];

export const PENGUIN_DRILL_SECONDS = PROGRAM.reduce((total, phase) => total + phase.seconds, 0);

type DrillTarget = { x: number; z: number; heading: number };
export type PenguinDrillSample = DrillTarget & {
  routine: PenguinRoutine;
  cycle: number;
  gait: number;
  salute: number;
  forage: number;
  from: DrillTarget;
  to: DrillTarget;
};

export function createPenguinDrillSample(): PenguinDrillSample {
  return { x: 0, z: 0, heading: 0, routine: "form-ranks", cycle: 0, gait: 0, salute: 0, forage: 0,
    from: { x: 0, z: 0, heading: 0 }, to: { x: 0, z: 0, heading: 0 } };
}

function smooth(value: number) {
  return value * value * value * (value * (value * 6 - 15) + 10);
}

function target(out: DrillTarget, phase: number, cycle: number, seed: number, index: number, count: number) {
  const variant = ((cycle + seed) % 3 + 3) % 3;
  const columns = variant === 1 ? 2 : 3;
  const rows = Math.ceil(count / columns);
  const column = index % columns;
  const row = Math.floor(index / columns);
  const rankX = ((rows - 1) / 2 - row) * 0.42;
  const rankZ = (column - (columns - 1) / 2) * 0.44;
  const routine = PROGRAM[phase].routine;
  const direction = variant === 2 ? -1 : 1;
  const travel = phase >= 5 && phase <= 7 ? -0.35 : phase >= 1 && phase <= 4 ? 0.48 : 0;
  out.x = rankX + travel * direction;
  out.z = rankZ + (variant === 1 ? travel * 0.3 : 0);
  out.heading = direction > 0 ? 0 : Math.PI;
  if (routine === "left-face" || routine === "inspection") out.heading += Math.PI / 2;
  if (phase === 5) out.heading += Math.PI;
  if (routine === "disperse" || routine === "forage" || routine === "rest") {
    const angle = index * 2.3999632297 + (seed % 29) * 0.17;
    const radius = 0.48 + Math.sqrt((index + 0.5) / Math.max(1, count)) * 0.8;
    out.x = Math.cos(angle) * radius;
    out.z = Math.sin(angle) * radius;
    out.heading = -angle;
  }
}

/** Members share commands and travel together, with alternate files/rows and
 * march directions on successive cycles. Every phase boundary is continuous,
 * including the final dispersed rest joining the next set of ranks. */
export function samplePenguinDrill(out: PenguinDrillSample, seed: number, index: number, count: number, elapsed: number) {
  const time = Math.max(0, Number.isFinite(elapsed) ? elapsed : 0);
  const cycle = Math.floor(time / PENGUIN_DRILL_SECONDS);
  let local = time % PENGUIN_DRILL_SECONDS;
  let phase = 0;
  while (phase < PROGRAM.length - 1 && local >= PROGRAM[phase].seconds) {
    local -= PROGRAM[phase].seconds;
    phase += 1;
  }
  const seconds = PROGRAM[phase].seconds;
  const progress = local / seconds;
  target(out.from, phase === 0 ? PROGRAM.length - 1 : phase - 1, phase === 0 ? cycle - 1 : cycle, seed, index, count);
  target(out.to, phase, cycle, seed, index, count);
  const dx = out.to.x - out.from.x;
  const dz = out.to.z - out.from.z;
  const traveling = Math.hypot(dx, dz) > 1e-6;
  // Turn in place, walk forward, then dress the ranks at the destination.
  // Blending heading throughout a march would make the squad walk backwards
  // during the first half of an about-turn or a return leg.
  const walkProgress = traveling ? Math.max(0, Math.min(1, (progress - 0.2) / 0.6)) : progress;
  const blend = smooth(walkProgress);
  out.x = out.from.x + dx * blend;
  out.z = out.from.z + dz * blend;
  const travelHeading = traveling ? Math.atan2(-dz, dx) : out.to.heading;
  const fromHeading = progress > 0.8 && traveling ? travelHeading : out.from.heading;
  const toHeading = progress > 0.8 && traveling ? out.to.heading : travelHeading;
  const turnProgress = traveling ? (progress > 0.8 ? (progress - 0.8) / 0.2 : Math.min(1, progress / 0.2)) : progress;
  const headingDelta = Math.atan2(Math.sin(toHeading - fromHeading), Math.cos(toHeading - fromHeading));
  out.heading = fromHeading + headingDelta * smooth(turnProgress);
  out.routine = PROGRAM[phase].routine;
  out.cycle = cycle;
  const velocity = 30 * walkProgress * walkProgress * (walkProgress - 1) * (walkProgress - 1) / (seconds * 0.6);
  out.gait = Math.min(1, Math.hypot(dx, dz) * velocity * 4);
  const envelope = Math.sin(progress * Math.PI) ** 2;
  out.salute = out.routine === "salute" || out.routine === "inspection" ? envelope : 0;
  out.forage = out.routine === "forage" ? envelope : 0;
  return out;
}
