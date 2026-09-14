import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const document = JSON.parse(await readFile(new URL("../requirements/visual-smoothness.json", import.meta.url), "utf8"));
assert.equal(document.format, "fog-of-sea-visual-requirements-v1");
assert.ok(Array.isArray(document.precedence) && document.precedence.length >= 5);
assert.equal(document.budgets.strong.frameIntervalP95Ms, 41.7);
assert.equal(document.budgets.weak.frameIntervalP95Ms, 55);
assert.equal(document.budgets.reducedMotion.autonomousFramesAfterSettle, 0);
assert.ok(Array.isArray(document.requirements) && document.requirements.length >= 12);
const ids = new Set();
for (const item of document.requirements) {
  assert.match(item.id, /^VS-[A-Z0-9]+-\d{3}$/);
  assert.ok(!ids.has(item.id), `duplicate requirement ${item.id}`);
  ids.add(item.id);
  for (const key of ["owner", "status", "shall", "acceptance", "negative"]) assert.equal(typeof item[key], "string", `${item.id}.${key}`);
  assert.ok(Array.isArray(item.evidence), `${item.id}.evidence`);
}
console.log(`Visual requirements: ${ids.size} atomic requirements validated.`);
