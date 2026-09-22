import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import runtimePayload from "../app/generated/lattice-copy.runtime.json";
import {
  LATTICE_COPY_IDS,
  LATTICE_LEARNING_COPY_IDS,
  latticeCopy,
  latticeLearningCopy,
} from "../app/latticeCopy";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const FIRST_PHASE_DECISION_METHOD_COPY = {
  "academy.strategy.warfareAreas": "Connect every warfare-area choice to a visible task in the mission brief. Name the effect that task requires, distinguish the effect from a platform or threat, and leave an area unselected when no visible evidence supports it. Availability alone is not evidence, and this guide does not identify a scored choice.",
  "academy.strategy.endState": "Frame the end state as an observable political condition, not an activity or force position. Compare each option with the stated political aim, objective, success conditions, and constraints; then ask what must remain true at transition. This guide does not identify a scored choice.",
  "academy.strategy.primaryTheory": "Treat each theory as a causal mechanism, not a famous name. Ask how maritime action is expected to create the chosen political condition, what assumptions it depends on, and what visible evidence would count against it. Study the scenario-relevant premises, then make the selection yourself.",
  "academy.strategy.complementTheory": "Use the second theory to add a missing mechanism or challenge the primary theory with a different prediction. State what each contributes, where their assumptions conflict, and how the strategy resolves that conflict. A second label without a distinct job is not a synthesis, and this guide does not identify a scored pairing.",
  "academy.strategy.guardrail": "Choose the guardrail whose breach would make apparent mission success politically self-defeating. Test each option against the visible constraints, civilian context, partner dependence, authority and trust, and endurance. One guardrail controls the plan, but the others remain obligations; this guide does not identify a scored choice.",
} as const;

test("runtime Lattice payload exposes only the closed text contract", () => {
  assert.deepEqual(
    Object.keys(runtimePayload).sort(),
    ["copy", "copySha256", "schemaVersion", "snapshotId"],
  );
  assert.equal(runtimePayload.schemaVersion, "fog-of-sea.lattice-copy.runtime.v1");
  assert.deepEqual(
    Object.keys(runtimePayload.copy).sort(),
    [...LATTICE_COPY_IDS].sort(),
  );
  assert.equal(LATTICE_COPY_IDS.length, 31);
  for (const id of LATTICE_COPY_IDS) {
    assert.equal(typeof latticeCopy(id), "string", id);
    assert.ok(latticeCopy(id).trim().length > 0, id);
    assert.equal(latticeCopy(id), runtimePayload.copy[id], id);
  }
});

test("learning copy retains one explicit heading and one complete summary", () => {
  assert.equal(LATTICE_LEARNING_COPY_IDS.length, 6);
  for (const id of LATTICE_LEARNING_COPY_IDS) {
    const source = latticeCopy(id);
    const learning = latticeLearningCopy(id);
    assert.equal(source, `${learning.heading}\n${learning.summary}`, id);
    assert.ok(learning.heading.length > 0, id);
    assert.ok(learning.summary.length > 0, id);
  }
});

test("first-phase Academy decision methods remain exact and non-answer-giving", () => {
  for (const id of Object.keys(FIRST_PHASE_DECISION_METHOD_COPY) as (keyof typeof FIRST_PHASE_DECISION_METHOD_COPY)[]) {
    const copy = latticeCopy(id);
    assert.equal(copy, FIRST_PHASE_DECISION_METHOD_COPY[id], id);
    assert.doesNotMatch(copy, /(?:answer key|correct answer|scored (?:warfare areas|end state|primary theory|theory pairing|guardrail) (?:is|are))/iu, id);
  }
});

test("each published string is selected and rendered by its intended application surfaces", async () => {
  const sources = {
    page: await readFile(path.join(repositoryRoot, "app/page.tsx"), "utf8"),
    academy: await readFile(path.join(repositoryRoot, "app/Academy.tsx"), "utf8"),
    kriegsspiel: await readFile(path.join(repositoryRoot, "app/kriegsspiel.ts"), "utf8"),
    commandPanel: await readFile(path.join(repositoryRoot, "app/CommandPanel.tsx"), "utf8"),
    resultDebrief: await readFile(path.join(repositoryRoot, "app/ResultDebrief.tsx"), "utf8"),
  };
  for (const id of LATTICE_COPY_IDS) {
    const expectedSurface = id.startsWith("game.guide.")
      ? "page"
      : id.startsWith("academy.")
        ? "academy"
        : "kriegsspiel";
    assert.ok(sources[expectedSurface].includes(`"${id}"`), `${id} is not selected by ${expectedSurface}`);
  }

  assert.match(sources.commandPanel, /outcomeLearningAssessment\(state\)/u);
  assert.match(sources.commandPanel, /id="pending-review"/u);
  assert.match(sources.commandPanel, /id="last-turn-learning"[\s\S]*turnLearningNote\(latestReport\)/u);
  assert.match(sources.resultDebrief, /id="result-learning"[\s\S]*learning\.heading[\s\S]*learning\.summary/u);
  assert.match(sources.resultDebrief, /id="result-notes"[\s\S]*latticeCopy\("game\.outcome\.unscoredWriting"\)/u);
  assert.match(sources.resultDebrief, /id="turn-timeline-learning"[\s\S]*turnLearningNote\(report\)/u);
});
