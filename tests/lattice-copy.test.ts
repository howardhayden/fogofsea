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
  assert.equal(LATTICE_COPY_IDS.length, 26);
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
