import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { validateArtifact } from "../scripts/validate-artifact.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const authoringRequest = JSON.parse(
  await readFile(path.join(repositoryRoot, "authoring/lattice-copy.requests.json"), "utf8"),
);

test("release validation permits the selected text artifact and rejects partial owner-material injections", async () => {
  const releaseRoot = await mkdtemp(path.join(tmpdir(), "fog-lattice-release-"));
  try {
    await cp(path.join(repositoryRoot, "dist"), releaseRoot, { recursive: true });
    await validateArtifact(releaseRoot);

    const injectedAsset = path.join(releaseRoot, "owner-fragment.txt");
    const cases = [
      ["meaning-contract atoms", "window.fragment={atoms:[]};", /owner meaning-contract atoms/u],
      ["provided candidates", "window.fragment={candidates:[{id:'forged'}]};", /owner candidate collection/u],
      ["meaning contract", "window.fragment={contract:{}};", /owner meaning contract/u],
      ["host assertions", "window.fragment={hostAssertions:{}};", /owner host assertions/u],
      ["required layers", "window.fragment={requiredIn:['operative']};", /owner required-layer map/u],
      ["prohibited dependencies", "window.fragment={prohibitedDependencies:['timing-perception']};", /owner prohibited-dependency map/u],
      ["candidate identity", "window.fragment={candidateId:'mission-credit-operative-v1'};", /owner candidate identity/u],
      ["evidence schema", "fog-of-sea.lattice-copy.evidence.v2", /owner evidence schema/u],
      ["standalone atom identity", "guide.mission-credit.connection.operative", /owner-only identifier/u],
      ["raw profile digest", authoringRequest.lattice.profileDigest, /owner profile digest/u],
      ["raw owner-package digest", authoringRequest.lattice.ownerPackageDigest, /owner package digest/u],
      ["raw baseline commit", authoringRequest.provenance.fogBaselineCommit, /owner baseline commit/u],
      ["raw Lattice commit", authoringRequest.provenance.latticeCommit, /owner Lattice commit/u],
    ];

    for (const [label, injection, expected] of cases) {
      await writeFile(injectedAsset, injection, "utf8");
      await assert.rejects(
        () => validateArtifact(releaseRoot),
        expected,
        `Artifact validation accepted an injected ${label} fragment.`,
      );
    }

    const disguisedBinary = path.join(releaseRoot, "owner-evidence.png");
    await writeFile(disguisedBinary, "window.fragment={atoms:[]};", "utf8");
    await assert.rejects(
      () => validateArtifact(releaseRoot),
      /(?:invalid \.png magic|owner meaning-contract atoms)/u,
      "Artifact validation accepted owner material hidden behind a binary extension.",
    );
  } finally {
    await rm(releaseRoot, { recursive: true, force: true });
  }
});
