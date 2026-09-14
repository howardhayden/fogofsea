import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidenceRoot = path.join(root, "evidence", "academy-contextual-guidance");
const evidencePrefix = "evidence/academy-contextual-guidance/";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function readJson(name) {
  return JSON.parse(readFileSync(path.join(evidenceRoot, name), "utf8"));
}

function verifyPayloadArtifact(artifact) {
  assert.match(artifact.payloadSha256, /^[a-f0-9]{64}$/);
  assert.equal(sha256(JSON.stringify(artifact.payload)), artifact.payloadSha256);
}

function excludedFromFeatureDiff(value, runtimePrefixes) {
  return value.startsWith(evidencePrefix) || runtimePrefixes.some((prefix) => value.startsWith(prefix));
}

const requirements = JSON.parse(readFileSync(path.join(root, "requirements", "academy-contextual-guidance.json"), "utf8"));
const atomIds = new Set(requirements.atoms.map((atom) => atom.id));

test("the pre-change Academy inventory is content-bound to the authoritative baseline", () => {
  const artifact = readJson("prechange-academy-inventory.json");
  verifyPayloadArtifact(artifact);
  assert.equal(artifact.format, "fog-of-sea-academy-prechange-inventory-v1");
  assert.equal(artifact.payload.baselineRevision, "795ea751b2615f26bd2d3eff2a826fbe079a062a");
  assert.equal(artifact.payload.academy.initialActiveModule, "strategy-grammar");
  assert.equal(artifact.payload.academy.receivedScenarioContext, false);
  assert.equal(artifact.payload.academy.lessonBodyControlled, false);
  assert.equal(artifact.payload.academy.moduleCount, 25);

  const git = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd: root, encoding: "utf8" });
  if (git.status !== 0 || git.stdout.trim() !== "true") return;
  for (const source of artifact.payload.sources) {
    const baseline = spawnSync("git", ["show", `${artifact.payload.baselineRevision}:${source.path}`], {
      cwd: root,
      encoding: null,
    });
    assert.equal(baseline.status, 0, `cannot reproduce baseline ${source.path}`);
    assert.equal(sha256(baseline.stdout), source.sha256, `baseline hash drift for ${source.path}`);
  }
});

test("the atom-to-diff manifest covers and hashes every non-evidence change", () => {
  const raw = readFileSync(path.join(evidenceRoot, "atom-diff-manifest.jsonl"), "utf8").trim().split("\n");
  const [metadata, ...entries] = raw.map((line) => JSON.parse(line));
  assert.equal(metadata.type, "manifest");
  assert.equal(metadata.format, "fog-of-sea-academy-atom-diff-manifest-v1");
  assert.equal(metadata.baselineRevision, "795ea751b2615f26bd2d3eff2a826fbe079a062a");
  assert.deepEqual(metadata.excludedRuntimePrefixes, ["node_modules/", "playwright-report/", "test-results/"]);
  assert.equal(sha256(entries.map((entry) => JSON.stringify(entry)).join("\n")), metadata.entriesSha256);

  const listedPaths = new Set();
  for (const entry of entries) {
    assert.equal(entry.type, "file-change");
    assert.ok(!listedPaths.has(entry.path), `duplicate manifest path ${entry.path}`);
    listedPaths.add(entry.path);
    assert.ok(!entry.path.startsWith(evidencePrefix), `recursive evidence mapping ${entry.path}`);
    if (entry.change === "delete") {
      assert.equal(existsSync(path.join(root, entry.path)), false, `deleted candidate returned for ${entry.path}`);
      const baselinePath = spawnSync("git", ["cat-file", "-e", `${metadata.baselineRevision}:${entry.path}`], { cwd: root });
      assert.equal(baselinePath.status, 0, `deleted path did not exist at baseline: ${entry.path}`);
    } else {
      assert.equal(sha256(readFileSync(path.join(root, entry.path))), entry.candidateSha256, `candidate drift for ${entry.path}`);
    }
    assert.ok(entry.atomIds.length > 0, `unmapped file ${entry.path}`);
    for (const atomId of entry.atomIds) assert.ok(atomIds.has(atomId), `${entry.path} references unknown ${atomId}`);
  }

  const git = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd: root, encoding: "utf8" });
  if (git.status !== 0 || git.stdout.trim() !== "true") return;
  const tracked = spawnSync("git", ["diff", "--name-only", metadata.baselineRevision, "--"], { cwd: root, encoding: "utf8" });
  const untracked = spawnSync("git", ["ls-files", "--others", "--exclude-standard"], { cwd: root, encoding: "utf8" });
  assert.equal(tracked.status, 0);
  assert.equal(untracked.status, 0);
  const changedPaths = new Set(`${tracked.stdout}\n${untracked.stdout}`
    .split("\n")
    .map((value) => value.trim())
    .filter((value) => value && !excludedFromFeatureDiff(value, metadata.excludedRuntimePrefixes)));
  assert.deepEqual([...listedPaths].sort(), [...changedPaths].sort());
});

test("runtime exclusions cannot hide an unmapped governed product path", () => {
  const runtimePrefixes = ["node_modules/", "playwright-report/", "test-results/"];
  assert.equal(excludedFromFeatureDiff("node_modules/@esbuild/linux-x64/bin/esbuild", runtimePrefixes), true);
  assert.equal(excludedFromFeatureDiff("test-results/example/trace.zip", runtimePrefixes), true);
  for (const productPath of [
    "app/unmapped.ts",
    "dist/assets/unmapped.js",
    "docs/design/unmapped.md",
    "requirements/unmapped.json",
    "tests/unmapped.test.ts",
  ]) assert.equal(excludedFromFeatureDiff(productPath, runtimePrefixes), false, productPath);
});

test("the Academy corpus report proves complete mappings and bounded generated coverage", () => {
  const artifact = readJson("academy-guidance-corpus-report.json");
  verifyPayloadArtifact(artifact);
  assert.equal(artifact.format, "fog-of-sea-academy-guidance-corpus-v1");
  assert.equal(artifact.payload.baselineRevision, "795ea751b2615f26bd2d3eff2a826fbe079a062a");
  assert.equal(artifact.payload.theoryLensCount, 13);
  assert.equal(Object.keys(artifact.payload.theoryModuleMap).length, 13);
  assert.equal(new Set(artifact.payload.gameplayPhases).size, 4);
  assert.deepEqual(artifact.payload.workspaceContexts, ["mission", "decisions", "force", "command", "visualization"]);
  assert.deepEqual(artifact.payload.generatedScenarioSample, {
    seed: 27183,
    count: 480,
    result: "pass",
    minimumMappedTheoryCount: 2,
    mappedProblemCount: 30,
    maximumContextLessonCount: 1,
    unresolvedModuleCount: 0,
  });
  assert.equal(artifact.payload.verification.focusedTestFileCases, 18);
  assert.equal(artifact.payload.verification.structuralRenderingTests, 4);
});

test("the visual report separates rendered evidence from the blocked browser gate", () => {
  const artifact = readJson("visual-verification-report.json");
  verifyPayloadArtifact(artifact);
  assert.equal(artifact.format, "fog-of-sea-academy-visual-verification-v1");
  assert.equal(artifact.payload.structuralRendering.result, "pass");
  assert.equal(artifact.payload.structuralRendering.cases, 4);
  assert.equal(artifact.payload.browserSpecification.discoveredCases, 6);
  assert.equal(artifact.payload.browserSpecification.intendedExecutedCases, 3);
  assert.equal(artifact.payload.browserExecution.result, "environment-blocked-before-product-assertion");
  assert.equal(artifact.payload.browserExecution.launched, false);
  assert.equal(artifact.payload.browserExecution.assertionsExecuted, 0);
  assert.equal(artifact.payload.overallStatus, "implemented-pending-browser-verification");
  assert.notEqual(artifact.payload.overallStatus, "pass");
});
