import assert from "node:assert/strict";
import test from "node:test";
import { advanceRenderDeadline, summarizeFrameIntervals, updateVisualGovernor, type VisualGovernorState } from "../app/visualPerformance";

test("frame evidence reports pacing distributions and hitch clusters", () => {
  assert.deepEqual(summarizeFrameIntervals([16, 17, 120, 130, 18, 110, 20]), { count: 7, p50Ms: 20, p95Ms: 130, p99Ms: 130, maxMs: 130, hitchClusters: 2 });
});

test("deadline scheduler is monotonic across non-divisible display cadence", () => {
  let deadline = advanceRenderDeadline(0, 1_000, 30);
  for (const now of [1_011.1, 1_022.2, 1_033.3, 1_044.4, 1_088.8]) {
    const next = advanceRenderDeadline(deadline, now, 30);
    assert.ok(next >= deadline);
    assert.ok(next > now);
    deadline = next;
  }
});

test("governor changes only adjacent tiers after hysteresis and cooldown", () => {
  let state: VisualGovernorState = { tier: "strong", poorWindows: 0, goodWindows: 0, lastChangeMs: 0 };
  state = updateVisualGovernor(state, 60, 21_000);
  state = updateVisualGovernor(state, 60, 22_000);
  assert.equal(state.tier, "strong");
  state = updateVisualGovernor(state, 60, 23_000);
  assert.equal(state.tier, "balanced");
  for (let index = 0; index < 8; index += 1) state = updateVisualGovernor(state, 30, 24_000 + index * 1_000);
  assert.equal(state.tier, "balanced");
  for (let index = 0; index < 8; index += 1) state = updateVisualGovernor(state, 30, 44_000 + index * 1_000);
  assert.equal(state.tier, "strong");
});

