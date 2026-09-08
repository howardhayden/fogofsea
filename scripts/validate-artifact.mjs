import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultBuildRoot = path.join(projectRoot, "dist");
const runtimeCopy = JSON.parse(
  await readFile(path.join(projectRoot, "app/generated/lattice-copy.runtime.json"), "utf8"),
).copy;
const authoringRequest = JSON.parse(
  await readFile(path.join(projectRoot, "authoring/lattice-copy.requests.json"), "utf8"),
);
const binaryReleaseExtensions = new Set([
  ".avif",
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".mp3",
  ".mp4",
  ".ogg",
  ".otf",
  ".png",
  ".ttf",
  ".wasm",
  ".wav",
  ".webm",
  ".webp",
  ".woff",
  ".woff2",
]);
const requiredFiles = [
  "index.html",
  "_headers",
  "favicon.svg",
  "favicon-day.svg",
  "third-party-notices.txt",
  "third-party-licenses.txt",
];

function ownerIdentifiers(value) {
  const identifiers = new Set();
  const visit = (entry, key = "") => {
    if (Array.isArray(entry)) {
      for (const item of entry) visit(item, key);
      return;
    }
    if (entry && typeof entry === "object") {
      for (const [childKey, child] of Object.entries(entry)) visit(child, childKey);
      return;
    }
    if (typeof entry !== "string") return;
    if (key === "id" || /^(?:fos\.|FOS-(?:COPY|LAT)-|src\.)/u.test(entry)) identifiers.add(entry);
  };
  visit(value);
  return [...identifiers].sort((left, right) => right.length - left.length);
}

const forbiddenOwnerIdentifiers = ownerIdentifiers(authoringRequest);
const forbiddenOwnerValues = [
  ["owner engine identity", authoringRequest.lattice?.engineName],
  ["owner profile identity", authoringRequest.lattice?.profileId],
  ["owner profile digest", authoringRequest.lattice?.profileDigest],
  ["owner package digest", authoringRequest.lattice?.ownerPackageDigest],
  ["owner baseline commit", authoringRequest.provenance?.fogBaselineCommit],
  ["owner Lattice commit", authoringRequest.provenance?.latticeCommit],
  ["owner request authority", authoringRequest.provenance?.requestAuthority],
].filter((entry) => typeof entry[1] === "string" && entry[1].length > 0);
const ownerMaterialPatterns = [
  ["owner meaning-contract atoms", /(?:["']atoms["']|\batoms)\s*:/u],
  ["owner candidate atom map", /(?:["']atomIds["']|\batomIds)\s*:/u],
  ["owner meaning contract", /(?:["']contracts?["']|\bcontracts?)\s*:\s*\{/u],
  ["owner candidate collection", /(?:["']candidates["']\s*:|\bcandidates\s*:\s*\[\s*(?:\{|\]))/u],
  ["owner host assertions", /(?:["']hostAssertions["']|\bhostAssertions)\s*:/u],
  ["owner required-layer map", /(?:["']requiredIn["']|\brequiredIn)\s*:/u],
  ["owner prohibited-dependency map", /(?:["']prohibitedDependencies["']|\bprohibitedDependencies)\s*:/u],
  ["owner controlled literal", /(?:["']literalForm["']|\bliteralForm)\s*:/u],
  ["owner protected fields", /(?:["']protectedFields["']|\bprotectedFields)\s*:/u],
  ["owner candidate identity", /(?:["']candidateId["']|\bcandidateId)\s*:/u],
  ["owner candidate coverage", /(?:["'](?:requiredAtomCount|coveredAtomCount|requiredAtomIdsSha256|coverageRatio)["']|\b(?:requiredAtomCount|coveredAtomCount|requiredAtomIdsSha256|coverageRatio))\s*:/u],
  ["owner request assertions", /(?:["'](?:requiredPhrases|prohibitedPhrases|exactText)["']|\b(?:requiredPhrases|prohibitedPhrases|exactText))\s*:/u],
  ["owner source catalog", /(?:["']sourceCatalog["']|\bsourceCatalog)\s*:/u],
  ["owner source references", /(?:["']sourceRefs["']|\bsourceRefs)\s*:/u],
  ["owner authority references", /(?:["'](?:requirementIds|inventoryIds)["']|\b(?:requirementIds|inventoryIds))\s*:/u],
  ["owner input digest", /(?:["']inputDigest["']|\binputDigest)\s*:/u],
  ["owner derivation digest", /(?:["']derivationDigest["']|\bderivationDigest)\s*:/u],
  ["owner realization digest", /(?:["']realizationSha256["']|\brealizationSha256)\s*:/u],
  ["owner traceability digest", /(?:["']traceabilitySha256["']|\btraceabilitySha256)\s*:/u],
  ["owner review metadata", /(?:["'](?:humanStatus|humanReviewStatus)["']|\b(?:humanStatus|humanReviewStatus))\s*:/u],
  ["owner provenance metadata", /(?:["'](?:fogBaselineCommit|latticeCommit|requestAuthority)["']|\b(?:fogBaselineCommit|latticeCommit|requestAuthority))\s*:/u],
  ["owner profile metadata", /(?:["'](?:profileIds?|profileDigest|ownerPackageDigest)["']|\b(?:profileIds?|profileDigest|ownerPackageDigest))\s*:/u],
  ["owner boundary metadata", /(?:["'](?:ownerCompilerRequired|receiptsIncluded|ruleDecisionsIncluded|runtimeEngineIncluded|runtimeProfileIncluded)["']|\b(?:ownerCompilerRequired|receiptsIncluded|ruleDecisionsIncluded|runtimeEngineIncluded|runtimeProfileIncluded))\s*:/u],
  ["owner evidence schema", /fog-of-sea\.lattice-copy\.(?:requests|generated|evidence|index|academy-corpus)\.v\d+/u],
];
const additionalOwnerPatterns = [
  ["owner engine package", /@howardhayden\/lattice-register-engine/u],
  ["owner checkout variable", /LATTICE_OWNER_ROOT/u],
  ["owner receipt schema", /lre\.receipt\.v1/u],
  ["owner profile implementation", /\brelationalSystems(?:Definition|Profile)\b/u],
  ["owner rule identifier", /\bLRE-[A-Z]+-[0-9]{3}\b/u],
  ["owner profile path", /profiles\/relational-systems\.profile\.json/u],
  ["owner request path", /authoring\/lattice-copy\.requests\.json/u],
  ["owner generated path", /app\/generated\/lattice-copy\.json(?!\.runtime)/u],
  ["owner evidence path", /evidence\/lattice\/(?:current|index)\.json/u],
  ["prose learning classifier", /does not address\|outside every\|remains below\|lacks the force or environmental conditions/iu],
];
const allOwnerPatterns = [...ownerMaterialPatterns, ...additionalOwnerPatterns];

function hasBinaryMagic(extension, bytes) {
  const prefix = (...values) => values.every((value, index) => bytes[index] === value);
  const ascii = (offset, value) => bytes.subarray(offset, offset + value.length).toString("ascii") === value;
  if (extension === ".avif") return ascii(4, "ftyp") && ["avif", "avis"].includes(bytes.subarray(8, 12).toString("ascii"));
  if (extension === ".gif") return ascii(0, "GIF87a") || ascii(0, "GIF89a");
  if (extension === ".ico") return prefix(0x00, 0x00, 0x01, 0x00);
  if (extension === ".jpeg" || extension === ".jpg") return prefix(0xff, 0xd8, 0xff);
  if (extension === ".mp3") return ascii(0, "ID3") || bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;
  if (extension === ".mp4") return ascii(4, "ftyp");
  if (extension === ".ogg") return ascii(0, "OggS");
  if (extension === ".otf") return ascii(0, "OTTO");
  if (extension === ".png") return prefix(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  if (extension === ".ttf") return prefix(0x00, 0x01, 0x00, 0x00) || ascii(0, "true") || ascii(0, "typ1");
  if (extension === ".wasm") return prefix(0x00, 0x61, 0x73, 0x6d);
  if (extension === ".wav") return ascii(0, "RIFF") && ascii(8, "WAVE");
  if (extension === ".webm") return prefix(0x1a, 0x45, 0xdf, 0xa3);
  if (extension === ".webp") return ascii(0, "RIFF") && ascii(8, "WEBP");
  if (extension === ".woff") return ascii(0, "wOFF");
  if (extension === ".woff2") return ascii(0, "wOF2");
  return false;
}

export async function validateArtifact(buildRoot = defaultBuildRoot) {
  for (const relative of requiredFiles) {
    assert((await stat(path.join(buildRoot, relative))).isFile(), `Missing release file: ${relative}`);
  }

  const html = await readFile(path.join(buildRoot, "index.html"), "utf8");
  const headers = await readFile(path.join(buildRoot, "_headers"), "utf8");
  assert.match(html, /<title>FOG OF SEA(?: — [^<]+)?<\/title>/);
  assert.doesNotMatch(html, /https?:\/\//i, "Release HTML must not request remote assets");
  assert.doesNotMatch(
    html,
    /LOCAL START REQUIRED|FOG OF SEA has not started|Open this extracted folder|Live Server/i,
    "Release shell must not show local-launch instructions",
  );
  assert.match(headers, /connect-src 'none'/i);
  assert.match(headers, /frame-src 'none'/i);
  assert.match(headers, /object-src 'none'/i);

  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const reference = match[1];
    if (reference.startsWith("//") || /^[a-z][a-z\d+.-]*:/i.test(reference)) continue;
    const localPath = reference.startsWith("/")
      ? path.join(buildRoot, reference.slice(1))
      : path.resolve(buildRoot, reference);
    assert((await stat(localPath)).isFile(), `Broken release reference: ${reference}`);
  }

  const emitted = [];
  async function collect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await collect(absolute);
      else emitted.push(path.relative(buildRoot, absolute));
    }
  }
  await collect(buildRoot);
  assert.equal(emitted.some((file) => file.endsWith(".map")), false, "Release must not contain source maps");
  assert(emitted.some((file) => file.endsWith(".js")), "Release must contain compiled scripts");
  assert(emitted.some((file) => file.endsWith(".css")), "Release must contain compiled styles");
  assert(emitted.some((file) => file.endsWith(".woff2")), "Release must contain the local font files");

  let releaseScripts = "";
  const emittedBytes = new Map();
  for (const relative of emitted) {
    const bytes = await readFile(path.join(buildRoot, relative));
    emittedBytes.set(relative, bytes);
    const extension = path.extname(relative).toLowerCase();
    if (binaryReleaseExtensions.has(extension)) {
      assert(hasBinaryMagic(extension, bytes), `Binary release file has invalid ${extension} magic: ${relative}`);
    }
    const rawByteText = bytes.toString("latin1");
    for (const [label, pattern] of allOwnerPatterns) {
      assert.equal(pattern.test(rawByteText), false, `Release file must not contain the ${label}: ${relative}`);
    }
    for (const identifier of forbiddenOwnerIdentifiers) {
      assert.equal(bytes.includes(Buffer.from(identifier, "utf8")), false, `Release file must not contain owner-only identifier ${identifier}: ${relative}`);
    }
    for (const [label, value] of forbiddenOwnerValues) {
      assert.equal(bytes.includes(Buffer.from(value, "utf8")), false, `Release file must not contain the ${label}: ${relative}`);
    }
  }

  const textualAssets = emitted.filter((file) => !binaryReleaseExtensions.has(path.extname(file).toLowerCase()));
  for (const relative of textualAssets) {
    const source = emittedBytes.get(relative).toString("utf8");
    if (relative.endsWith(".js")) releaseScripts += `${source}\n`;
    assert.doesNotMatch(
      source,
      /LOCAL BUILD|LOCAL START REQUIRED|FOG OF SEA has not started/i,
      `Release file must not expose a local-build or local-start label: ${relative}`,
    );
  }

  assert.equal(Object.keys(runtimeCopy).length, 26, "Runtime Lattice copy must contain the pinned output set");
  for (const [publishId, selectedText] of Object.entries(runtimeCopy)) {
    assert.equal(typeof selectedText, "string", `Runtime Lattice output must be text: ${publishId}`);
    assert(releaseScripts.includes(selectedText), `Release must include selected Lattice output: ${publishId}`);
  }
  return { emittedFileCount: emitted.length, textualAssetCount: textualAssets.length };
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  const result = await validateArtifact();
  console.log(
    `Validated static release artifact with ${result.emittedFileCount} raw-byte-scanned files (${result.textualAssetCount} decoded textual assets) and no remote HTML assets or source maps.`,
  );
}
