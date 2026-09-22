import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const registerUrl = new URL("../requirements/academy-contextual-guidance.json", import.meta.url);
const register = JSON.parse(readFileSync(registerUrl, "utf8"));
const effectiveAtom = (atom) => ({ ...register.atomDefaults, ...atom });

test("Academy contextual-guidance requirements compile into complete atomic records", () => {
  assert.equal(register.version, "1.2.0");
  assert.ok(Array.isArray(register.atoms) && register.atoms.length >= 48);
  assert.match(register.inheritance, /may not be discarded/i);
  assert.equal(register.implementationStatus, "implemented-local-browser-verified-hosted-public-pending");
  assert.equal(register.atomDefaults.status, "implemented-local-browser-verified-hosted-public-pending");

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

test("the register contains the non-negotiable authority, disclosure, atomization, glass, and release gates", () => {
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
    "ACA-NAV-002",
    "ACA-WELCOME-001",
    "ACA-AGENCY-001",
    "ACA-ACCESS-001",
    "ACA-SCOPE-001",
    "ACA-GATE-001",
    "ACA-TRIGGER-001",
    "ACA-TRIGGER-002",
    "ACA-ATOM-001",
    "ACA-ATOM-002",
    "ACA-PHASE-007",
    "ACA-DISC-001",
    "ACA-GUIDE-001",
    "ACA-SAFE-001",
    "ACA-SAFE-002",
    "ACA-ORG-001",
    "ACA-LAT-001",
    "ACA-LAT-002",
    "ACA-LAT-003",
    "ACA-GLASS-001",
    "ACA-GLASS-002",
    "ACA-GLASS-003",
  ]) assert.ok(atoms.has(id), `missing required atom ${id}`);

  for (const id of [
    "ACA-REL-001",
    "ACA-NAV-002",
    "ACA-TRIGGER-001",
    "ACA-ATOM-001",
    "ACA-PHASE-007",
    "ACA-DISC-001",
    "ACA-GUIDE-001",
    "ACA-SAFE-001",
    "ACA-ORG-001",
    "ACA-LAT-001",
    "ACA-LAT-003",
    "ACA-GLASS-001",
    "ACA-GLASS-002",
  ]) assert.equal(atoms.get(id).modality, "MUST", `${id} must remain mandatory`);

  for (const id of [
    "ACA-AGENCY-001",
    "ACA-SCOPE-001",
    "ACA-TRIGGER-002",
    "ACA-ATOM-002",
    "ACA-SAFE-002",
    "ACA-LAT-002",
    "ACA-GLASS-003",
  ]) assert.equal(atoms.get(id).modality, "MUST_NOT", `${id} must remain prohibitive`);

  assert.match(atoms.get("ACA-TRIGGER-001").requirement, /explicit Academy open action/i);
  assert.match(atoms.get("ACA-TRIGGER-002").requirement, /elapsed time.*click frequency.*quiz failure/i);
  assert.match(atoms.get("ACA-ATOM-001").requirement, /one unique, stable theory-\* atom.*thirteen TheoryLens/i);
  assert.match(atoms.get("ACA-PHASE-007").requirement, /every new Academy mount.*gameplay-phase transition/i);
  assert.match(atoms.get("ACA-DISC-001").requirement, /open exactly the five first-phase methods.*relevant premise atoms/i);
  assert.match(atoms.get("ACA-LAT-001").requirement, /029ca14570b3ebe5703f504ab4b4baed90883f84/);
  assert.match(atoms.get("ACA-LAT-002").requirement, /unknown/i);
  assert.match(atoms.get("ACA-GLASS-001").requirement, /light and dark color modes.*visually transparent/i);
  assert.match(atoms.get("ACA-GLASS-003").requirement, /keyboard focus outlines.*forced-colors/i);
  assert.match(atoms.get("ACA-NAV-002").requirement, /every context-relevant module.*theory atom.*provenance label/i);
  assert.ok(
    atoms.get("ACA-NAV-002").acceptance.some((criterion) => /NAMED IN THE BRIEF.*YOUR RECORDED THEORY.*CURRENT PHASE/i.test(criterion)),
  );

  for (const term of ["helpSeekingSignal", "theoryAtom", "safeScenarioContext", "firstPhaseDecisionAtom", "invisibleCosmeticBorder", "latestLattice"]) {
    assert.equal(typeof register.terms[term], "string", `missing ${term} definition`);
  }
  assert.match(register.terms.theoryAtom, /twenty-five module identifiers/i);
  assert.match(register.terms.latestLattice, /relational-systems profile v1\.1\.0/i);
});
