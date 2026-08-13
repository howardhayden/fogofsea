import assert from "node:assert/strict";
import test from "node:test";
import {
  readBrowserSave,
  readSaveIndex,
  resolveWrittenAnalysisPolicy,
  writeBrowserSave,
} from "../app/browserSaves";
import { generateScenario } from "../app/gameModel";
import type { PortableSave } from "../app/saveGame";

class MemoryStorage implements Storage {
  #values = new Map<string, string>();
  get length() { return this.#values.size; }
  clear() { this.#values.clear(); }
  getItem(key: string) { return this.#values.get(key) ?? null; }
  key(index: number) { return [...this.#values.keys()][index] ?? null; }
  removeItem(key: string) { this.#values.delete(key); }
  setItem(key: string, value: string) { this.#values.set(key, value); }
}

function sampleSave(): PortableSave {
  return {
    format: "fog-of-sea-save",
    version: 3,
    savedAt: "2026-08-10T12:00:00.000Z",
    game: {
      scenario: generateScenario(0, () => 0.31),
      fleet: {},
      airWing: {},
      selectedArmaments: {},
      selectedWarfare: [],
      selectedEndState: "",
      selectedLens: "",
      selectedPartnerLens: "",
      selectedGuardrail: "",
      theorySynthesis: "Compare the two mechanisms.",
      rationale: "Preserve access without unnecessary commitment.",
      assumptions: "The contact remains responsive to restraint.",
      termination: "The corridor is stable.",
      result: null,
      rigidState: null,
      rigidOrders: null,
      history: [],
    },
    preferences: { theme: "dark", difficulty: "standard", planningStage: "strategy", guidance: { checklistCollapsed: false } },
    academyProgress: [],
  };
}

test("per-slot written-analysis policy survives reload and subsequent autosave", () => {
  const storage = new MemoryStorage();
  const original = sampleSave();
  writeBrowserSave({ slotId: "policy-slot", name: "Policy test", save: original, includeWrittenAnalysis: true }, storage);
  const slot = readSaveIndex(storage)[0];
  const loaded = readBrowserSave(slot.id, storage);
  const policy = resolveWrittenAnalysisPolicy(slot, loaded);
  assert.equal(policy, true);

  writeBrowserSave({ slotId: slot.id, name: slot.name, save: loaded, includeWrittenAnalysis: policy }, storage);
  assert.equal(readBrowserSave(slot.id, storage).game.rationale, original.game.rationale);
  assert.equal(readSaveIndex(storage)[0].includeWrittenAnalysis, true);
});

test("legacy slots containing prose infer inclusion before their first policy-aware save", () => {
  const storage = new MemoryStorage();
  writeBrowserSave({ slotId: "legacy-slot", name: "Legacy", save: sampleSave(), includeWrittenAnalysis: true }, storage);
  const rawIndex = JSON.parse(storage.getItem("fog-of-sea-save-index-v1") || "[]") as Array<Record<string, unknown>>;
  delete rawIndex[0].includeWrittenAnalysis;
  storage.setItem("fog-of-sea-save-index-v1", JSON.stringify(rawIndex));
  const slot = readSaveIndex(storage)[0];
  assert.equal(slot.includeWrittenAnalysis, undefined);
  assert.equal(resolveWrittenAnalysisPolicy(slot, readBrowserSave(slot.id, storage)), true);
});

test("data-minimized slots persist their exclusion policy and omit prose", () => {
  const storage = new MemoryStorage();
  writeBrowserSave({ slotId: "minimal-slot", name: "Minimal", save: sampleSave(), includeWrittenAnalysis: false }, storage);
  const slot = readSaveIndex(storage)[0];
  const loaded = readBrowserSave(slot.id, storage);
  assert.equal(slot.includeWrittenAnalysis, false);
  assert.equal(loaded.game.rationale, "");
  assert.equal(resolveWrittenAnalysisPolicy(slot, loaded), false);
});

test("browser slots retain the exact strategy or force interface stage", () => {
  const storage = new MemoryStorage();
  for (const planningStage of ["strategy", "force"] as const) {
    const save = sampleSave();
    save.preferences.planningStage = planningStage;
    writeBrowserSave({ slotId: `${planningStage}-slot`, name: planningStage, save, includeWrittenAnalysis: false }, storage);
    assert.equal(readBrowserSave(`${planningStage}-slot`, storage).preferences.planningStage, planningStage);
  }
});

test("hostile browser index metadata is rejected or normalized without prototype mutation", () => {
  const storage = new MemoryStorage();
  storage.setItem("fog-of-sea-save-index-v1", '[{"id":"constructor","name":"bad","operation":"x","exercise":1,"updatedAt":"2026-08-10T12:00:00.000Z"}]');
  assert.deepEqual(readSaveIndex(storage), []);
  storage.setItem("fog-of-sea-save-index-v1", '[{"__proto__":{"polluted":true}}]');
  assert.deepEqual(readSaveIndex(storage), []);
  assert.equal((Object.prototype as { polluted?: boolean }).polluted, undefined);
});
