import assert from "node:assert/strict";
import test from "node:test";
import { writeBrowserSave } from "../../app/browserSaves";
import { minimalPortableSave } from "./fixtures";

const INDEX_KEY = "fog-of-sea-save-index-v1";
const SLOT_KEY = "fog-of-sea-save-v1:game-red-team";

class FaultStorage implements Storage {
  readonly values = new Map<string, string>();
  failIndexWrite = false;

  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) {
    if (this.failIndexWrite && key === INDEX_KEY) throw new Error("simulated quota failure");
    this.values.set(key, value);
  }
}

test("RT-DATA-005: a failed index write does not strand an unreachable new save", () => {
  const storage = new FaultStorage();
  storage.failIndexWrite = true;

  assert.throws(() => writeBrowserSave({
    slotId: "game-red-team",
    name: "Recovery attack",
    save: minimalPortableSave(),
    includeWrittenAnalysis: false,
  }, storage), /simulated quota failure/);
  assert.equal(storage.getItem(SLOT_KEY), null);
  assert.equal(storage.getItem(INDEX_KEY), null);
});
