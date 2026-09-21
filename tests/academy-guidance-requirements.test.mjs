import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const registerUrl = new URL("../requirements/academy-contextual-guidance.json", import.meta.url);
const register = JSON.parse(readFileSync(registerUrl, "utf8"));
const effectiveAtom = (atom) => ({ ...register.atomDefaults, ...atom });

test("Academy contextual-guidance requirements compile into complete atomic records", () => {
  assert.equal(register.version, "1.0.0");
  assert.ok(Array.isArray(register.atoms) && register.atoms.length >= 20);
  assert.match(register.inheritance, /may not be discarded/i);

  const ids = new Set();
  for (const sourceAtom of register.atoms) {
    const atom = effectiveAtom(sourceAtom);
    assert.match(atom.id, /^ACA-[A-Z]+-\d{3}$/);
    assert.ok(!ids.has(atom.id), `duplicate atom ${atom.id}`);
    ids.add(atom.id);
    assert.ok(["MUST", "MUST_NOT"].includes(atom.modality), `${atom.id} has invalid modality`);
    assert.equal(typeof atom.owner, "string", `${atom.id} has no owner`);
    assert.equal(typeof atom.requirement, "string", `${atom.id} has no requirement`);
    for (const field of ["provenance", "dependencies", "conflicts", "acceptance", "negative", "boundary", "precedence", "evidence"]) {
      assert.ok(Array.isArray(atom[field]), `${atom.id} has no effective ${field}`);
    }
    assert.equal(typeof atom.status, "string", `${atom.id} has no effective status`);
    assert.ok(Object.hasOwn(atom, "supersession"), `${atom.id} has no effective supersession`);
  }

  for (const sourceAtom of register.atoms) {
    const atom = effectiveAtom(sourceAtom);
    for (const dependency of atom.dependencies) {
      if (dependency.startsWith("ACA-")) assert.ok(ids.has(dependency), `${atom.id} depends on missing ${dependency}`);
    }
  }

  const visiting = new Set();
  const visited = new Set();
  const visit = (id) => {
    if (visited.has(id)) return;
    assert.ok(!visiting.has(id), `cyclic Academy dependency at ${id}`);
    visiting.add(id);
    for (const dependency of effectiveAtom(register.atoms.find((atom) => atom.id === id)).dependencies) {
      if (dependency.startsWith("ACA-")) visit(dependency);
    }
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of ids) visit(id);
});

test("the register contains the non-negotiable authority, disclosure, agency, and release gates", () => {
  const atoms = new Map(register.atoms.map((atom) => [atom.id, effectiveAtom(atom)]));
  for (const id of [
    "ACA-REL-001",
    "ACA-REL-002",
    "ACA-REL-003",
    "ACA-GRID-001",
    "ACA-PHASE-006",
    "ACA-OPEN-001",
    "ACA-OPEN-002",
    "ACA-OPEN-004",
    "ACA-NAV-001",
    "ACA-WELCOME-001",
    "ACA-AGENCY-001",
    "ACA-ACCESS-001",
    "ACA-SCOPE-001",
    "ACA-GATE-001",
  ]) assert.ok(atoms.has(id), `missing required atom ${id}`);

  assert.equal(atoms.get("ACA-AGENCY-001").modality, "MUST_NOT");
  assert.equal(atoms.get("ACA-SCOPE-001").modality, "MUST_NOT");
});
