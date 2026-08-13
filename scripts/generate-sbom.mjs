import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const checkOnly = process.argv.includes("--check");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lockText = await readFile(path.join(root, "package-lock.json"), "utf8");
const lock = JSON.parse(lockText);
const lockHash = createHash("sha256").update(lockText).digest("hex");

function packageNameFromPath(packagePath) {
  return packagePath ? packagePath.split("node_modules/").at(-1) : lock.name;
}

function packageSpdxId(packagePath) {
  if (!packagePath) return "SPDXRef-Package-root";
  const digest = createHash("sha256").update(packagePath).digest("hex").slice(0, 20);
  return `SPDXRef-Package-${digest}`;
}

function purlName(name) {
  if (!name.startsWith("@")) return encodeURIComponent(name);
  const [scope, packageName] = name.slice(1).split("/");
  return `%40${encodeURIComponent(scope)}/${encodeURIComponent(packageName)}`;
}

function integrityChecksum(integrity) {
  if (!integrity) return [];
  const [first] = integrity.split(/\s+/);
  const separator = first.indexOf("-");
  if (separator < 0) return [];
  const algorithm = first.slice(0, separator).toUpperCase();
  const value = Buffer.from(first.slice(separator + 1), "base64").toString("hex");
  if (!new Set(["SHA1", "SHA256", "SHA384", "SHA512", "MD5"]).has(algorithm)) return [];
  return [{ algorithm, checksumValue: value }];
}

function resolveDependency(fromPath, dependencyName) {
  let base = fromPath;
  while (true) {
    const candidate = `${base ? `${base}/` : ""}node_modules/${dependencyName}`;
    if (lock.packages[candidate]) return candidate;
    if (!base) return null;
    const nestedMarker = base.lastIndexOf("/node_modules/");
    base = nestedMarker < 0 ? "" : base.slice(0, nestedMarker);
  }
}

function packageRecord(packagePath, metadata) {
  const name = packageNameFromPath(packagePath);
  const record = {
    name,
    SPDXID: packageSpdxId(packagePath),
    versionInfo: metadata.version ?? lock.version,
    downloadLocation: metadata.resolved ?? "NOASSERTION",
    filesAnalyzed: false,
    licenseConcluded: metadata.license ?? "NOASSERTION",
    licenseDeclared: metadata.license ?? "NOASSERTION",
    copyrightText: "NOASSERTION",
    primaryPackagePurpose: packagePath ? "LIBRARY" : "APPLICATION",
  };

  const checksums = integrityChecksum(metadata.integrity);
  if (checksums.length) record.checksums = checksums;
  if (packagePath) {
    record.externalRefs = [
      {
        referenceCategory: "PACKAGE-MANAGER",
        referenceType: "purl",
        referenceLocator: `pkg:npm/${purlName(name)}@${encodeURIComponent(metadata.version)}`,
      },
    ];
  }
  return record;
}

function includedPaths(scope) {
  return Object.entries(lock.packages ?? {})
    .filter(([packagePath, metadata]) => packagePath === "" || (metadata.version && (scope === "full" || !metadata.dev)))
    .map(([packagePath]) => packagePath);
}

async function previousCreated(relativePath, namespace) {
  try {
    const existing = JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
    if (existing.documentNamespace === namespace) return existing.creationInfo?.created;
  } catch {
    // The first generation, a changed lockfile, or an invalid prior file gets a new timestamp.
  }
  return undefined;
}

async function createDocument(scope, relativePath) {
  const selectedPaths = includedPaths(scope);
  const selected = new Set(selectedPaths);
  const namespace = `https://fog-of-sea.invalid/sbom/${scope}/${lockHash}`;
  const created = (await previousCreated(relativePath, namespace)) ?? new Date().toISOString();
  const packages = selectedPaths.map((packagePath) => packageRecord(packagePath, lock.packages[packagePath]));
  const relationships = [
    {
      spdxElementId: "SPDXRef-DOCUMENT",
      relationshipType: "DESCRIBES",
      relatedSpdxElement: "SPDXRef-Package-root",
    },
  ];
  const relationshipKeys = new Set(relationships.map((item) => JSON.stringify(item)));

  for (const packagePath of selectedPaths) {
    const metadata = lock.packages[packagePath];
    const dependencies = {
      ...(metadata.dependencies ?? {}),
      ...(metadata.optionalDependencies ?? {}),
      ...(metadata.peerDependencies ?? {}),
      ...(scope === "full" && packagePath === "" ? metadata.devDependencies ?? {} : {}),
    };
    for (const dependencyName of Object.keys(dependencies)) {
      const resolvedPath = resolveDependency(packagePath, dependencyName);
      if (!resolvedPath || !selected.has(resolvedPath)) continue;
      const relationship = {
        spdxElementId: packageSpdxId(packagePath),
        relationshipType: "DEPENDS_ON",
        relatedSpdxElement: packageSpdxId(resolvedPath),
      };
      const key = JSON.stringify(relationship);
      if (!relationshipKeys.has(key)) {
        relationshipKeys.add(key);
        relationships.push(relationship);
      }
    }
  }

  return {
    spdxVersion: "SPDX-2.3",
    dataLicense: "CC0-1.0",
    SPDXID: "SPDXRef-DOCUMENT",
    name: `fog-of-sea-${scope}-dependency-sbom`,
    documentNamespace: namespace,
    creationInfo: {
      created,
      creators: ["Tool: scripts/generate-sbom.mjs"],
      comment: `Generated deterministically from package-lock.json SHA-256 ${lockHash}.`,
    },
    documentDescribes: ["SPDXRef-Package-root"],
    packages,
    relationships,
  };
}

async function emit(scope, relativePath) {
  const content = `${JSON.stringify(await createDocument(scope, relativePath), null, 2)}\n`;
  const outputPath = path.join(root, relativePath);
  if (checkOnly) {
    const existing = await readFile(outputPath, "utf8");
    assert.equal(existing, content, `${relativePath} is stale; run npm run sbom`);
    return JSON.parse(content).packages.length;
  }
  await writeFile(outputPath, content);
  return JSON.parse(content).packages.length;
}

const fullCount = await emit("full", "SBOM.spdx.json");
const productionCount = await emit("production", "SBOM.production.spdx.json");
console.log(
  `${checkOnly ? "Verified" : "Generated"} SPDX 2.3 documents for ${fullCount - 1} complete locked dependencies and ${productionCount - 1} production dependencies.`,
);
