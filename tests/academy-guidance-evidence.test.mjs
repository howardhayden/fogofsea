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
const baselineRevision = "795ea751b2615f26bd2d3eff2a826fbe079a062a";
const baselineRepository = "https://github.com/howardhayden/fogofsea.git";

function runGit(args, timeout = 10_000) {
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.toUpperCase().startsWith("GIT_")),
  );
  return spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    env: {
      ...environment,
      GIT_NO_LAZY_FETCH: "1",
      GIT_NO_REPLACE_OBJECTS: "1",
      GIT_TERMINAL_PROMPT: "0",
    },
    killSignal: "SIGKILL",
    maxBuffer: 512 * 1024,
    shell: false,
    timeout,
  });
}

function failureSummary(result) {
  if (result.error?.code === "ETIMEDOUT") return "timed out";
  if (result.error?.code) return result.error.code;
  return `exit ${result.status ?? "unknown"}`;
}

function probeBaseline() {
  const result = runGit(["rev-parse", "--verify", "--quiet", `${baselineRevision}^{commit}`]);
  const output = String(result.stdout ?? "").trim();
  if (result.status === 0 && output === baselineRevision) return true;
  if (result.status === 1 && output === "") return false;
  throw new Error(`Cannot verify the Academy evidence baseline (${failureSummary(result)}).`);
}

function ensureBaseline() {
  const topLevel = runGit(["rev-parse", "--show-toplevel"]);
  if (topLevel.status !== 0 || path.resolve(String(topLevel.stdout ?? "").trim()) !== root) {
    throw new Error(`Academy evidence requires the repository root (${failureSummary(topLevel)}).`);
  }
  if (probeBaseline()) return;

  const shallow = runGit(["rev-parse", "--is-shallow-repository"]);
  if (shallow.status !== 0 || String(shallow.stdout ?? "").trim() !== "true") {
    throw new Error("The Academy evidence baseline is absent from a checkout that is not verifiably shallow.");
  }

  const fetched = runGit([
    "-c", "protocol.allow=never",
    "-c", "protocol.https.allow=always",
    "-c", "credential.helper=",
    "-c", "fetch.fsckObjects=true",
    "fetch",
    "--no-write-fetch-head",
    "--no-tags",
    "--no-recurse-submodules",
    "--no-auto-maintenance",
    "--no-write-commit-graph",
    "--depth=1",
    baselineRepository,
    baselineRevision,
  ], 45_000);
  if (fetched.status !== 0) {
    throw new Error(`Cannot fetch the immutable Academy evidence baseline (${failureSummary(fetched)}).`);
  }
  if (!probeBaseline()) throw new Error("The Academy evidence baseline is unavailable after the bounded fetch.");
}

ensureBaseline();

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
  assert.equal(artifact.payload.baselineRevision, baselineRevision);
  assert.equal(artifact.payload.academy.initialActiveModule, "strategy-grammar");
  assert.equal(artifact.payload.academy.receivedScenarioContext, false);
  assert.equal(artifact.payload.academy.lessonBodyControlled, false);
  assert.equal(artifact.payload.academy.moduleCount, 25);

  const git = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd: root, encoding: "utf8" });
  assert.equal(git.status, 0, "Academy baseline evidence requires a Git worktree");
  assert.equal(git.stdout.trim(), "true", "Academy baseline evidence requires a Git worktree");
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
  assert.equal(metadata.baselineRevision, baselineRevision);
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
  assert.equal(git.status, 0, "Academy diff evidence requires a Git worktree");
  assert.equal(git.stdout.trim(), "true", "Academy diff evidence requires a Git worktree");
  const tracked = spawnSync("git", ["diff", "--no-renames", "--name-only", metadata.baselineRevision, "--"], { cwd: root, encoding: "utf8" });
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
  assert.equal(artifact.format, "fog-of-sea-academy-guidance-corpus-v2");
  assert.equal(artifact.payload.baselineRevision, baselineRevision);
  assert.equal(artifact.payload.requirementsVersion, "1.2.0");
  assert.equal(artifact.payload.implementationStatus, "implemented-local-release-and-focused-browser-verified-hosted-public-pending");
  assert.equal(artifact.payload.academyModuleCount, 25);
  assert.deepEqual(artifact.payload.academyViews, ["NOW", "LIBRARY", "COMPARE", "SOURCES"]);

  assert.deepEqual(artifact.payload.firstPhaseDecisionSupport.ids, [
    "first-phase-warfare",
    "first-phase-end-state",
    "first-phase-primary-theory",
    "first-phase-partner-theory",
    "first-phase-guardrail",
  ]);
  assert.equal(artifact.payload.firstPhaseDecisionSupport.count, 5);
  assert.match(artifact.payload.firstPhaseDecisionSupport.defaultPresentation, /all five.*open.*NOW/i);
  assert.match(artifact.payload.firstPhaseDecisionSupport.answerPolicy, /no scored choice.*ranking.*recommendation.*hidden-answer/i);
  assert.deepEqual(artifact.payload.safeScenarioProjection.fields, [
    "brief",
    "friendlySituation",
    "opposingSituation",
    "civilianContext",
    "objective",
    "intelligence",
    "constraints",
    "successConditions",
    "navalProblem",
    "politicalAim",
  ]);
  assert.equal(artifact.payload.safeScenarioProjection.fieldCount, 10);
  for (const hidden of ["required", "recommended", "endState", "guardrail", "lenses", "minimumUncrewed", "matrix", "score"]) {
    assert.ok(artifact.payload.safeScenarioProjection.prohibitedAnswerFields.includes(hidden), hidden);
  }
  assert.match(artifact.payload.safeScenarioProjection.noninterference, /does not change.*guidance.*rendered/i);

  assert.equal(artifact.payload.theoryLensCount, 13);
  assert.equal(Object.keys(artifact.payload.theoryModuleMap).length, 13);

  const theoryAtomEntries = Object.entries(artifact.payload.theoryAtomMap);
  assert.equal(artifact.payload.theoryAtomCount, 13);
  assert.equal(theoryAtomEntries.length, 13);
  assert.deepEqual(
    theoryAtomEntries.map(([lens]) => lens).sort(),
    Object.keys(artifact.payload.theoryModuleMap).sort(),
  );
  const theoryAtomIds = theoryAtomEntries.map(([, mapping]) => mapping.atomId);
  assert.equal(new Set(theoryAtomIds).size, 13);
  for (const [lens, mapping] of theoryAtomEntries) {
    assert.match(mapping.atomId, /^theory-[a-z0-9-]+$/);
    assert.equal(mapping.moduleId, artifact.payload.theoryModuleMap[lens]);
  }
  assert.deepEqual(
    new Set(artifact.payload.sharedModuleDisclosureBoundary["maritime-schools"].theoryAtomIds),
    new Set(["theory-aube", "theory-richmond", "theory-wegener", "theory-castex"]),
  );
  assert.deepEqual(
    new Set(artifact.payload.sharedModuleDisclosureBoundary["global-seapower"].theoryAtomIds),
    new Set(["theory-panikkar", "theory-gorshkov", "theory-liu-huaqing", "theory-till"]),
  );
  assert.deepEqual(artifact.payload.progressCompatibility, {
    moduleCount: 25,
    moduleIdsChanged: false,
    newAtomProgressKeys: false,
    saveSchemaChanged: false,
  });
  assert.equal(artifact.payload.helpSignalPolicy.automaticHelpSignal, "explicit Academy open on a new mount");
  for (const prohibited of ["elapsed time", "click frequency", "analytics", "storage", "network", "model call"]) {
    assert.ok(artifact.payload.helpSignalPolicy.prohibitedInferenceInputs.includes(prohibited), prohibited);
  }
  for (const open of [
    "all five first-phase decision methods in NOW",
    "public-brief-named or completed-selection-recorded strategist premises in NOW",
  ]) assert.ok(artifact.payload.nestedDisclosureDefaults.open.includes(open), open);
  for (const closed of [
    "every Library lesson body unless explicitly requested or opened by the user",
    "unrelated theory atoms",
    "comparison frames",
    "synthesis atoms",
    "knowledge check",
    "optional written-analysis question map",
  ]) {
    assert.ok(artifact.payload.nestedDisclosureDefaults.closed.includes(closed), closed);
  }
  assert.equal(
    artifact.payload.nestedDisclosureDefaults.explicitSharedModule,
    "requested outer Library lesson shell open; every unrelated nested atom closed",
  );
  assert.match(artifact.payload.nestedDisclosureDefaults.relevanceIdentification, /NAMED IN THE BRIEF.*YOUR RECORDED THEORY.*CURRENT PHASE/i);
  assert.match(artifact.payload.nestedDisclosureDefaults.relevanceIdentification, /answer-signalling.*absent/i);
  const academySource = readFileSync(path.join(root, "app", "Academy.tsx"), "utf8");
  const legacySuggestionLabel = ["SUGGESTED", "NOW"].join(" ");
  assert.equal(academySource.includes(legacySuggestionLabel), false);
  assert.deepEqual(artifact.payload.nestedDisclosureDefaults.knowledgeCheck, {
    contentChanged: false,
    answersChanged: false,
    completionSemanticsChanged: false,
    presentationChanged: true,
    defaultPresentation: "closed native details disclosure",
  });
  assert.equal(
    artifact.payload.initialPriority.explicitHelpTarget,
    "LIBRARY at the requested outer module without changing relevance membership",
  );
  assert.match(artifact.payload.phaseContextPolicy.consecutiveMounts, /current phase.*never reuse/i);
  assert.equal(new Set(artifact.payload.gameplayPhases).size, 4);
  assert.deepEqual(artifact.payload.workspaceContexts, ["mission", "decisions", "force", "command", "visualization"]);
  assert.deepEqual(artifact.payload.latestLattice, {
    repository: "howardhayden/lattice",
    commit: "029ca14570b3ebe5703f504ab4b4baed90883f84",
    engineVersion: "0.1.1",
    profileId: "relational-systems",
    profileVersion: "v1.1.0",
    profileDigest: "d28c72daeda482e6fce5f976894181751391ecd819e84c026ea1d4ce9879a468",
    profileFileSha256: "d5145998c2a43f6c1da5e718226dbce38cb81ee2eb3e58feb1fdb07cbf384c11",
    ownerPackageDigest: "68c04a2870951fc7a1e08c17d949b7f60db3010f0c683b4b0534dd3ea325828b",
    snapshotId: "lattice-copy-8f1b56ecaab9b6c4f75509ea",
    implementationAuthorityDigest: "28ec42aa9a69826c388295b14da535920bb322d61eb375502c788670707357bc",
    copyDigest: "b0f1f86c0d4c19c48ceeafc7f18e805987c7b311cdcda0519268522954d7149c",
    realizationDigest: "3f0cf9b2cca3f317d279ebac4a4e18799399efe112093a74aa85ef5e774b14cc",
    requestCount: 24,
    outputCount: 31,
    inventoryUnitCount: 42,
    requestHumanReviewStatus: "not-claimed",
    requestHumanReviewStatusCount: 24,
    scope: "owner-side bounded copy compilation only",
    runtimeEngine: false,
    advisoryControlIds: "RSR-CTL-001 through RSR-CTL-018",
    unknownCanPass: false,
  });
  const latticeEvidence = JSON.parse(readFileSync(path.join(root, "evidence", "lattice", "current.json"), "utf8"));
  const generatedCopy = JSON.parse(readFileSync(path.join(root, "app", "generated", "lattice-copy.json"), "utf8"));
  const copyInventory = JSON.parse(readFileSync(path.join(root, "requirements", "lattice-copy-inventory.json"), "utf8"));
  assert.equal(latticeEvidence.snapshotId, artifact.payload.latestLattice.snapshotId);
  assert.equal(latticeEvidence.implementationAuthority.sha256, artifact.payload.latestLattice.implementationAuthorityDigest);
  assert.equal(latticeEvidence.copySha256, artifact.payload.latestLattice.copyDigest);
  assert.equal(latticeEvidence.realizationSha256, artifact.payload.latestLattice.realizationDigest);
  assert.equal(latticeEvidence.requests.length, 24);
  assert.ok(latticeEvidence.requests.every((request) => request.review.humanStatus === "not-claimed"));
  assert.equal(Object.keys(generatedCopy.copy).length, 31);
  assert.equal(copyInventory.scope.unitCount, 42);
  assert.deepEqual(artifact.payload.generatedScenarioSample, {
    seed: 27183,
    count: 480,
    phase: "strategy",
    result: "pass",
    firstPhaseQuestionCount: 5,
    minimumMappedTheoryCount: 2,
    mappedProblemCount: 30,
    substantivePremiseLensCount: 13,
    maximumContextLessonCount: 1,
    unresolvedModuleCount: 0,
  });
  assert.equal(artifact.payload.verification.focusedTestFileCases, 21);
  assert.equal(artifact.payload.verification.allStrategistPremiseRenderCount, 13);
  assert.equal(artifact.payload.verification.generatedStrategyScenarioCount, 480);
  assert.match(artifact.payload.verification.focusedAcademySuite, /pass: 21 of 21/i);
  assert.deepEqual(artifact.payload.verification.fullReleaseCheck, {
    command: "npm run release:check",
    result: "pass",
    mjsTests: { passed: 40, total: 40 },
    typescriptTests: { passed: 269, total: 269 },
    redTeamTests: { passed: 66, total: 66 },
    totalTests: 375,
    productionBuild: "pass",
    artifactValidation: "pass",
    npmAuditVulnerabilities: 0,
  });
  assert.equal(artifact.payload.verification.hostedPublicStatus, "pending");
  assert.equal(artifact.payload.verification.safariStatus, "unverified");
  assert.match(artifact.payload.granularityBoundary, /distinct nested theory atom/i);
});

test("the visual report binds local release and focused browser passes without promoting hosted or Safari gates", () => {
  const artifact = readJson("visual-verification-report.json");
  verifyPayloadArtifact(artifact);
  assert.equal(artifact.format, "fog-of-sea-academy-visual-verification-v2");
  assert.equal(artifact.payload.requirementsVersion, "1.2.0");
  assert.equal(artifact.payload.structuralRendering.cases, 21);
  assert.match(artifact.payload.structuralRendering.result, /pass: 21 of 21/i);
  assert.equal(artifact.payload.browserSpecification.academyDiscoveredCases, 6);
  assert.equal(artifact.payload.browserSpecification.academyIntendedExecutedCases, 3);
  assert.equal(artifact.payload.browserSpecification.academyProjectSkips, 3);
  assert.equal(artifact.payload.browserSpecification.flightGlassDiscoveredCases, 4);
  assert.equal(artifact.payload.browserSpecification.flightGlassIntendedExecutedCases, 2);
  assert.equal(artifact.payload.browserSpecification.flightGlassProjectSkips, 2);
  assert.equal(artifact.payload.browserSpecification.result, "executed-for-current-candidate");
  assert.match(artifact.payload.staticGlassContract.normalColorPolicy, /transparent/i);
  assert.match(artifact.payload.staticGlassContract.normalColorPolicy, /background-clip: border-box/i);
  for (const affordance of [
    "focus-visible outlines",
    "prefers-contrast: more borders",
    "forced-colors system borders",
    "startup fallback border in increased contrast and forced colors",
  ]) {
    assert.ok(artifact.payload.staticGlassContract.retainedAffordances.includes(affordance), affordance);
  }
  assert.match(artifact.payload.staticGlassContract.forcedColorsContract, /static CSS.*Academy summaries and controls.*ButtonText.*Highlight/i);
  assert.ok(artifact.payload.staticGlassContract.notYetProved.some((claim) => /live forced-colors.*Chromium 131.*does not expose/i.test(claim)));

  const execution = artifact.payload.browserExecution;
  const browserExecutable = "/root/.cache/puppeteer/chrome-headless-shell/linux-131.0.6778.204/chrome-headless-shell-linux64/chrome-headless-shell";
  assert.equal(execution.executable, browserExecutable);
  assert.equal(
    execution.command,
    `FOG_TEST_BROWSER_PATH=${browserExecutable} npx playwright test tests/browser/academy-guidance.spec.ts tests/browser/flight-glass.spec.ts --project=desktop-chromium --project=mobile-chromium`,
  );
  assert.equal(execution.result, "pass: 5 passed, 5 intentional project skips");
  assert.equal(execution.launched, true);
  assert.equal(execution.assertionsExecuted, 5);
  assert.equal(typeof execution.durationSeconds, "number");
  assert.ok(execution.durationSeconds > 0);
  assert.deepEqual(execution.academy, {
    passed: 3,
    intentionalProjectSkips: 3,
  });
  assert.deepEqual(execution.flightGlass, {
    passed: 2,
    intentionalProjectSkips: 2,
  });
  assert.equal(execution.mediaCoverage.normalDarkAndLight, "live pass");
  assert.equal(execution.mediaCoverage.prefersContrastMore, "live pass");
  assert.match(execution.mediaCoverage.forcedColors, /not live.*Chromium 131.*static CSS contract/i);
  assert.match(execution.classification, /local focused browser verification passed.*live forced-colors.*hosted\/public.*Safari.*unverified/i);

  assert.equal(artifact.payload.overallStatus, "local-release-and-focused-browser-pass-hosted-public-pending");
  assert.notEqual(artifact.payload.overallStatus, "pass");
  assert.match(artifact.payload.structuralRendering.result, /^pass/);
  assert.match(artifact.payload.staticGlassContract.result, /^pass/);
  assert.deepEqual(artifact.payload.sourceAndReleaseChecks, {
    command: "npm run release:check",
    result: "pass",
    mjsTests: { passed: 40, total: 40 },
    typescriptTests: { passed: 269, total: 269 },
    redTeamTests: { passed: 66, total: 66 },
    totalTests: 375,
    productionBuild: "pass",
    artifactValidation: "pass",
    npmAuditVulnerabilities: 0,
  });
  assert.ok(artifact.payload.unverified.includes("Hosted/public browser confirmation against the deployed candidate."));
  assert.ok(artifact.payload.unverified.includes("Safari interaction and rendering behavior."));
  assert.ok(artifact.payload.unverified.includes("Live forced-colors behavior in a browser that exposes forced-colors emulation."));
  assert.match(artifact.payload.claimRule, /full local release gate and focused Chromium run support only.*executed.*Forced-colors coverage is static-only/i);
});
