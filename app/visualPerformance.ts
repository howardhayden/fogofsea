export type VisualDeviceProfile = "strong" | "weak";
export type VisualQualityTier = "constrained" | "balanced" | "strong";

export const VISUAL_PERFORMANCE_BUDGETS = Object.freeze({
  strong: Object.freeze({ targetFps: 30, frameIntervalP95Ms: 41.7 }),
  weak: Object.freeze({ targetFps: 24, frameIntervalP95Ms: 55 }),
  reducedMotion: Object.freeze({ autonomousFramesAfterSettle: 0 }),
});

export function summarizeFrameIntervals(samples: readonly number[]) {
  const valid = samples.filter((sample) => Number.isFinite(sample) && sample >= 0).sort((a, b) => a - b);
  const percentile = (ratio: number) => valid.length ? valid[Math.min(valid.length - 1, Math.ceil(valid.length * ratio) - 1)] : null;
  const hitchThreshold = 100;
  let clusters = 0;
  let inCluster = false;
  for (const interval of samples) {
    const hitch = Number.isFinite(interval) && interval >= hitchThreshold;
    if (hitch && !inCluster) clusters += 1;
    inCluster = hitch;
  }
  return Object.freeze({ count: valid.length, p50Ms: percentile(0.5), p95Ms: percentile(0.95), p99Ms: percentile(0.99), maxMs: valid.at(-1) ?? null, hitchClusters: clusters });
}

/** Monotonic deadlines avoid modulo cadence aliasing at 60/90/120 Hz. */
export function advanceRenderDeadline(previousDeadlineMs: number, nowMs: number, targetFps: number) {
  const interval = 1_000 / Math.max(1, targetFps);
  if (!Number.isFinite(previousDeadlineMs) || previousDeadlineMs <= 0) return nowMs + interval;
  if (nowMs < previousDeadlineMs) return previousDeadlineMs;
  return previousDeadlineMs + (Math.floor((nowMs - previousDeadlineMs) / interval) + 1) * interval;
}

const TIERS: readonly VisualQualityTier[] = ["constrained", "balanced", "strong"];
export type VisualGovernorState = Readonly<{ tier: VisualQualityTier; poorWindows: number; goodWindows: number; lastChangeMs: number }>;

export function updateVisualGovernor(state: VisualGovernorState, p95Ms: number, nowMs: number): VisualGovernorState {
  const poorThreshold = state.tier === "constrained" ? 55 : 50;
  const goodThreshold = state.tier === "constrained" ? 52 : 36;
  const poor = Number.isFinite(p95Ms) && p95Ms > poorThreshold;
  const good = Number.isFinite(p95Ms) && p95Ms < goodThreshold;
  const next = { ...state, poorWindows: poor ? state.poorWindows + 1 : 0, goodWindows: good ? state.goodWindows + 1 : 0 };
  if (nowMs - state.lastChangeMs < 20_000) return Object.freeze(next);
  const index = TIERS.indexOf(state.tier);
  if (next.poorWindows >= 3 && index > 0) return Object.freeze({ tier: TIERS[index - 1], poorWindows: 0, goodWindows: 0, lastChangeMs: nowMs });
  if (next.goodWindows >= 8 && index < TIERS.length - 1) return Object.freeze({ tier: TIERS[index + 1], poorWindows: 0, goodWindows: 0, lastChangeMs: nowMs });
  return Object.freeze(next);
}

