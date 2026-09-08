import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { verifyLatticeCopy } from "../../scripts/verify-lattice-copy.mjs";

type Data = Record<string, any>;

interface FixtureBundle {
  generated: Data;
  runtime: Data;
  evidence: Data;
  index: Data;
}

interface RebindOptions {
  claimedRealizationSha256?: string;
  seedRealizationSha256?: string;
  forcedSnapshotId?: string;
}

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const paths = Object.freeze({
  request: "authoring/lattice-copy.requests.json",
  adoption: "requirements/lattice-adoption.json",
  generated: "app/generated/lattice-copy.json",
  runtime: "app/generated/lattice-copy.runtime.json",
  evidence: "evidence/lattice/current.json",
  index: "evidence/lattice/index.json",
  academySource: "app/academyData.ts",
  inventory: "requirements/lattice-copy-inventory.json",
});

function canonicalize(value: any): any {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort((left, right) => left.localeCompare(right, "en"))
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function stableStringify(value: any): string {
  return JSON.stringify(canonicalize(value));
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function jsonFileText(value: any): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function changedDigest(value: string): string {
  assert.match(value, /^[a-f0-9]{64}$/u);
  return `${value[0] === "0" ? "1" : "0"}${value.slice(1)}`;
}

async function readJson(root: string, relativePath: string): Promise<Data> {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8")) as Data;
}

async function writeJson(root: string, relativePath: string, value: Data): Promise<void> {
  await writeFile(path.join(root, relativePath), jsonFileText(value), "utf8");
}

async function loadBundle(root: string): Promise<FixtureBundle> {
  const [generated, runtime, evidence, index] = await Promise.all([
    readJson(root, paths.generated),
    readJson(root, paths.runtime),
    readJson(root, paths.evidence),
    readJson(root, paths.index),
  ]);
  return { generated, runtime, evidence, index };
}

async function copyFixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "fog-lattice-verifier-"));
  try {
    await Promise.all([
      ...["app", "authoring", "requirements", "evidence", "schemas", "scripts"].map((directory) =>
        cp(path.join(repositoryRoot, directory), path.join(root, directory), { recursive: true })),
      ...["package.json", "package-lock.json"].map((file) =>
        cp(path.join(repositoryRoot, file), path.join(root, file))),
    ]);
    return root;
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}

async function withFixture(run: (root: string) => Promise<void>): Promise<void> {
  const root = await copyFixture();
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function expectVerificationFailure(root: string, pattern: RegExp): Promise<void> {
  await assert.rejects(
    () => verifyLatticeCopy(root),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, pattern);
      return true;
    },
  );
}

function findEvidenceOutput(evidence: Data, publishId: string): Data {
  for (const request of evidence.requests as Data[]) {
    const output = (request.outputs as Data[]).find((entry) => entry.publishId === publishId);
    if (output) return output;
  }
  throw new Error(`Fixture evidence does not contain ${publishId}.`);
}

async function rebindOuterGraph(root: string, bundle: FixtureBundle, options: RebindOptions = {}): Promise<void> {
  const { generated, runtime, evidence, index } = bundle;
  const [requestBytes, academySourceBytes] = await Promise.all([
    readFile(path.join(root, paths.request)),
    readFile(path.join(root, paths.academySource)),
  ]);
  const requestSha256 = sha256(requestBytes);
  const academySourceSha256 = sha256(academySourceBytes);
  const academyCorpusSha256 = evidence.academyCorpus.sha256 as string;
  const academyLintSha256 = sha256(stableStringify(evidence.academyLint));
  const traceabilitySha256 = sha256(stableStringify(generated.traceability));
  const derivedRealizationSha256 = sha256(stableStringify(evidence.requests));
  const realizationSha256 = options.claimedRealizationSha256 ?? derivedRealizationSha256;
  const copySha256 = sha256(stableStringify(runtime.copy));
  const conformance = generated.assurance.conformance as string;
  const outputHashes = Object.fromEntries(
    Object.entries(generated.copy as Data).map(([publishId, output]) => [publishId, (output as Data).textSha256]),
  );
  const source = {
    requestPath: paths.request,
    requestSha256,
    academySourcePath: paths.academySource,
    academySourceSha256,
    academyCorpusSha256,
    academyLintSha256,
    provenance: generated.source.provenance,
  };
  const snapshotSeed = {
    lattice: generated.lattice,
    implementationAuthoritySha256: generated.implementationAuthority.sha256,
    requestSha256,
    academySourceSha256,
    academyCorpusSha256,
    academyLintSha256,
    traceabilitySha256,
    realizationSha256: options.seedRealizationSha256 ?? realizationSha256,
    copySha256,
    conformance,
    outputHashes,
  };
  const snapshotId = options.forcedSnapshotId
    ?? `lattice-copy-${sha256(stableStringify(snapshotSeed)).slice(0, 24)}`;

  for (const artifact of [generated, evidence]) {
    artifact.snapshotId = snapshotId;
    artifact.source = structuredClone(source);
    artifact.traceabilitySha256 = traceabilitySha256;
    artifact.realizationSha256 = realizationSha256;
    artifact.copySha256 = copySha256;
  }
  runtime.snapshotId = snapshotId;
  runtime.copySha256 = copySha256;

  await Promise.all([
    writeJson(root, paths.generated, generated),
    writeJson(root, paths.runtime, runtime),
  ]);
  const [generatedBytes, runtimeBytes] = await Promise.all([
    readFile(path.join(root, paths.generated)),
    readFile(path.join(root, paths.runtime)),
  ]);
  const generatedFileSha256 = sha256(generatedBytes);
  const runtimeFileSha256 = sha256(runtimeBytes);
  evidence.generatedFile = { path: paths.generated, sha256: generatedFileSha256 };
  evidence.runtimeFile = { path: paths.runtime, sha256: runtimeFileSha256 };
  await writeJson(root, paths.evidence, evidence);
  const evidenceFileSha256 = sha256(await readFile(path.join(root, paths.evidence)));

  index.current = { snapshotId, path: paths.evidence, sha256: evidenceFileSha256 };
  assert.ok(Array.isArray(index.entries) && index.entries.length === 1);
  Object.assign(index.entries[0], {
    snapshotId,
    evidencePath: paths.evidence,
    evidenceSha256: evidenceFileSha256,
    generatedPath: paths.generated,
    generatedSha256: generatedFileSha256,
    runtimePath: paths.runtime,
    runtimeSha256: runtimeFileSha256,
    requestSha256,
    academySourceSha256,
    academyCorpusSha256,
    academyLintSha256,
    traceabilitySha256,
    realizationSha256,
    copySha256,
    conformance,
  });
  await writeJson(root, paths.index, index);
}

test("RT-LAT-ID-000: the independent verifier accepts an isolated canonical evidence closure", async () => {
  await withFixture(async (root) => {
    const result = await verifyLatticeCopy(root);
    assert.equal(result.requestCount, 19);
    assert.equal(result.outputCount, 26);
    assert.equal(result.academyEntryCount, 1_011);
    assert.equal(result.academyBatchCount, 2);
  });
});

test("RT-LAT-ID-001: replicated realizationSha256 drift is rejected independently of file references", async () => {
  await withFixture(async (root) => {
    const bundle = await loadBundle(root);
    const forged = changedDigest(bundle.evidence.realizationSha256 as string);
    const derived = sha256(stableStringify(bundle.evidence.requests));
    await rebindOuterGraph(root, bundle, {
      claimedRealizationSha256: forged,
      seedRealizationSha256: derived,
    });
    await expectVerificationFailure(root, /Artifact realization digest/u);
  });
});

test("RT-LAT-ID-002: an arbitrary snapshot ID fails even after every outer file reference is refreshed", async () => {
  await withFixture(async (root) => {
    const bundle = await loadBundle(root);
    await rebindOuterGraph(root, bundle, { forcedSnapshotId: "lattice-copy-ffffffffffffffffffffffff" });
    await expectVerificationFailure(root, /Snapshot identity/u);
  });
});

test("RT-LAT-ID-003A: reordered generated bytes invalidate the evidence generated-file reference", async () => {
  await withFixture(async (root) => {
    const generated = await readJson(root, paths.generated);
    await writeJson(root, paths.generated, Object.fromEntries(Object.entries(generated).reverse()));
    await expectVerificationFailure(root, /Evidence generated-file reference/u);
  });
});

test("RT-LAT-ID-003B: reordered evidence bytes invalidate both index evidence hashes", async () => {
  await withFixture(async (root) => {
    const evidence = await readJson(root, paths.evidence);
    await writeJson(root, paths.evidence, Object.fromEntries(Object.entries(evidence).reverse()));
    await expectVerificationFailure(root, /Evidence index/u);
  });
});

test("RT-LAT-ID-004: a forged inputDigest fails after realization, snapshot, and file hashes are rebound", async () => {
  await withFixture(async (root) => {
    const bundle = await loadBundle(root);
    const request = (bundle.evidence.requests as Data[])[0];
    request.inputDigest = changedDigest(request.inputDigest as string);
    await rebindOuterGraph(root, bundle);
    await expectVerificationFailure(root, /inputDigest does not bind the normalized owner request/u);
  });
});

test("RT-LAT-ID-005: substituted output text cannot be legalized by rebinding the public digest graph", async () => {
  await withFixture(async (root) => {
    const bundle = await loadBundle(root);
    const selected = Object.entries(bundle.generated.copy as Data).find(([, output]) =>
      (output as Data).source === "provided" && (output as Data).layer !== "operative");
    assert.ok(selected);
    const [publishId, output] = selected as [string, Data];
    output.text = `${output.text as string} Forged after owner selection.`;
    output.textSha256 = sha256(output.text as string);
    bundle.runtime.copy[publishId] = output.text;
    findEvidenceOutput(bundle.evidence, publishId).textSha256 = output.textSha256;
    await rebindOuterGraph(root, bundle);
    await expectVerificationFailure(root, /differs from its selected provided candidate/u);
  });
});

test("RT-LAT-ID-006: forged candidate coverage fails after realization and snapshot rebinding", async () => {
  await withFixture(async (root) => {
    const bundle = await loadBundle(root);
    const request = (bundle.evidence.requests as Data[])[0];
    const output = (request.outputs as Data[])[0];
    output.requiredAtomCount = (output.requiredAtomCount as number) + 1;
    output.coveredAtomCount = 0;
    output.requiredAtomIdsSha256 = changedDigest(output.requiredAtomIdsSha256 as string);
    output.coverageRatio = output.coverageRatio === 0 ? 1 : 0;
    await rebindOuterGraph(root, bundle);
    await expectVerificationFailure(root, /Evidence output .*\.(?:requiredAtomCount|coveredAtomCount|requiredAtomIdsSha256|coverageRatio)/u);
  });
});

test("RT-LAT-ID-007: Academy lint batch membership is derived rather than trusted from rebound evidence", async () => {
  await withFixture(async (root) => {
    const bundle = await loadBundle(root);
    const batch = (bundle.evidence.academyLint.batches as Data[])[0];
    assert.ok(Array.isArray(batch.entryIds) && batch.entryIds.length > 1);
    [batch.entryIds[0], batch.entryIds[1]] = [batch.entryIds[1], batch.entryIds[0]];
    await rebindOuterGraph(root, bundle);
    await expectVerificationFailure(root, /academyLint\.batches\[0\]\.entryIds/u);
  });
});

test("RT-LAT-ID-008: runtime owner metadata is rejected even with refreshed runtime and evidence hashes", async () => {
  await withFixture(async (root) => {
    const bundle = await loadBundle(root);
    bundle.runtime.ownerReceipt = { derivationDigest: "forged-runtime-receipt" };
    await rebindOuterGraph(root, bundle);
    await expectVerificationFailure(
      root,
      /(?:Lattice schema validation failed for app\/generated\/lattice-copy\.runtime\.json|lattice-copy\.runtime\.json fields do not match the closed contract)/u,
    );
  });
});

test("RT-LAT-ID-009: opaque derivation drift breaks the bound realization while assurance remains narrow", async () => {
  await withFixture(async (root) => {
    const bundle = await loadBundle(root);
    assert.equal(bundle.evidence.assurance.authenticated, false);
    assert.equal(bundle.evidence.assurance.externallyAnchored, false);
    assert.equal(bundle.evidence.assurance.trustScope, "reproducibility-and-conformance-only");
    assert.equal(bundle.generated.boundary.receiptsIncluded, false);
    assert.equal(bundle.evidence.boundary.receiptsIncluded, false);
    assert.deepEqual(Object.keys(bundle.runtime).sort(), ["copy", "copySha256", "schemaVersion", "snapshotId"]);

    const request = (bundle.evidence.requests as Data[])[0];
    request.derivationDigest = changedDigest(request.derivationDigest as string);
    await writeJson(root, paths.evidence, bundle.evidence);
    await expectVerificationFailure(root, /(?:Snapshot identity|Artifact realization digest)/u);
  });
});

test("RT-LAT-ID-010: a route-compatible duplicate cannot conceal an omitted adopted inventory identity", async () => {
  await withFixture(async (root) => {
    const [bundle, authoring, inventory] = await Promise.all([
      loadBundle(root),
      readJson(root, paths.request),
      readJson(root, paths.inventory),
    ]);
    const omittedId = "FOS-COPY-ACADEMY-007";
    const duplicateId = "FOS-COPY-GUIDE-007";
    const academyRequestId = "fos.academy.model-boundary";
    const academyRequest = (authoring.requests as Data[]).find((request) => request.id === academyRequestId);
    const omittedUnit = (inventory.units as Data[]).find((unit) => unit.id === omittedId);
    const duplicateUnit = (inventory.units as Data[]).find((unit) => unit.id === duplicateId);
    assert.ok(academyRequest && omittedUnit && duplicateUnit);
    assert.deepEqual(duplicateUnit.route, omittedUnit.route, "the adversarial replacement starts route-compatible");

    academyRequest.traceability.inventoryIds = [duplicateId];
    duplicateUnit.owners.push(structuredClone(omittedUnit.owners[0]));
    duplicateUnit.requestIds.push(academyRequestId);
    duplicateUnit.outputTargets.push("academy.sources.modelBoundary");
    await Promise.all([
      writeJson(root, paths.request, authoring),
      writeJson(root, paths.inventory, inventory),
    ]);
    const inventorySha256 = sha256(await readFile(path.join(root, paths.inventory)));

    for (const traceability of [bundle.generated.traceability, bundle.evidence.traceability]) {
      const authorityFile = (traceability.authorityFiles as Data[]).find((entry) => entry.path === paths.inventory);
      const requestTrace = (traceability.requests as Data[]).find((entry) => entry.requestId === academyRequestId);
      assert.ok(authorityFile && requestTrace);
      authorityFile.sha256 = inventorySha256;
      requestTrace.inventoryIds = [duplicateId];
    }
    const evidenceRequest = (bundle.evidence.requests as Data[]).find((request) => request.requestId === academyRequestId);
    assert.ok(evidenceRequest);
    evidenceRequest.traceability.inventoryIds = [duplicateId];
    await rebindOuterGraph(root, bundle);

    await expectVerificationFailure(root, /(?:more than one owner|requestIds are not bidirectional|leaves adopted inventory routes unused)/u);
  });
});

test("RT-LAT-ID-011: a source-catalog traversal path is rejected before provenance is trusted", async () => {
  await withFixture(async (root) => {
    const authoring = await readJson(root, paths.request);
    authoring.sourceCatalog[0].path = "../outside.ts";
    await writeJson(root, paths.request, authoring);
    await expectVerificationFailure(root, /(?:\/sourceCatalog\/0\/path|sourceCatalog\[0\]\.path must not contain traversal)/u);
  });
});

test("RT-LAT-ID-012: practical source-byte drift invalidates the cataloged SHA-256 digest", async () => {
  await withFixture(async (root) => {
    const authoring = await readJson(root, paths.request);
    const relativePath = authoring.sourceCatalog[0].path as string;
    const sourcePath = path.join(root, relativePath);
    const source = await readFile(sourcePath, "utf8");
    await writeFile(sourcePath, `${source}\n// adversarial source drift\n`, "utf8");
    await expectVerificationFailure(root, /sourceCatalog .* is stale for app\/catalog\.ts/u);
  });
});

test("RT-LAT-ID-013: a repository-local path cannot hide a symlink to an external source", async () => {
  await withFixture(async (root) => {
    const authoring = await readJson(root, paths.request);
    const relativePath = "app/adversarial-source-link.ts";
    await symlink(path.join(repositoryRoot, "app/catalog.ts"), path.join(root, relativePath));
    authoring.sourceCatalog[0].path = relativePath;
    await writeJson(root, paths.request, authoring);
    await expectVerificationFailure(root, /sourceCatalog .* resolves outside the repository/u);
  });
});

test("RT-LAT-ID-014: a catalog entry cannot name a nonexistent TypeScript declaration", async () => {
  await withFixture(async (root) => {
    const authoring = await readJson(root, paths.request);
    authoring.sourceCatalog[0].symbol = "FORGED_NONEXISTENT_DECLARATION";
    await writeJson(root, paths.request, authoring);
    await expectVerificationFailure(root, /does not identify exactly one matching top-level TypeScript declaration/u);
  });
});

test("RT-LAT-ID-015: governance authority rejects undeclared fields", async () => {
  await withFixture(async (root) => {
    const adoption = await readJson(root, paths.adoption);
    adoption.requirements[0].undeclaredGovernanceEscape = true;
    await writeJson(root, paths.adoption, adoption);
    await expectVerificationFailure(root, /(?:\/requirements\/0|requirements\[0\] fields do not match the closed contract)/u);
  });
});

test("RT-LAT-ID-016: source identity binds declaration kind and export status", async () => {
  await withFixture(async (root) => {
    const authoring = await readJson(root, paths.request);
    authoring.sourceCatalog[0].kind = "function";
    await writeJson(root, paths.request, authoring);
    await expectVerificationFailure(root, /does not identify exactly one matching top-level TypeScript declaration/u);
  });
});

test("RT-LAT-ID-017: candidate evidence cannot escape request traceability", async () => {
  await withFixture(async (root) => {
    const authoring = await readJson(root, paths.request);
    const request = authoring.requests.find((entry: Data) => entry.id === "fos.game.guide.mission-credit");
    assert.ok(request?.candidates?.[0]?.metadata?.claims?.[0]);
    request.candidates[0].metadata.claims[0].evidenceRefs = ["src.logic.final-outcome"];
    await writeJson(root, paths.request, authoring);
    await expectVerificationFailure(root, /candidate claim references undeclared source evidence/u);
  });
});

test("RT-LAT-ID-018: executable schema drift invalidates implementation authority", async () => {
  await withFixture(async (root) => {
    const schemaPath = path.join(root, "schemas/lattice-copy-runtime.schema.json");
    const schema = await readFile(schemaPath, "utf8");
    await writeFile(schemaPath, `${schema}\n`, "utf8");
    await expectVerificationFailure(root, /(?:Snapshot identity|Artifact implementation authority) differs/u);
  });
});

test("RT-LAT-ID-019: the verifier executes the request revision schema constraint", async () => {
  await withFixture(async (root) => {
    const authoring = await readJson(root, paths.request);
    authoring.revision = "!";
    await writeJson(root, paths.request, authoring);
    await expectVerificationFailure(root, /\/revision must match pattern/u);
  });
});

test("RT-LAT-ID-020: the verifier executes the fixed review-authority schema constraint", async () => {
  await withFixture(async (root) => {
    const authoring = await readJson(root, paths.request);
    authoring.requests[0].review.authority = "arbitrary authority";
    await writeJson(root, paths.request, authoring);
    await expectVerificationFailure(root, /\/requests\/0\/review\/authority must be equal to constant/u);
  });
});
