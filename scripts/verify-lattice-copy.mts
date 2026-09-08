import { createHash } from "node:crypto";
import { readdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import ts from "typescript";

import { validateLatticeSchemas } from "./validate-lattice-schemas.mjs";

type Data = Record<string, any>;

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, "..");

const PATHS = Object.freeze({
  request: "authoring/lattice-copy.requests.json",
  generated: "app/generated/lattice-copy.json",
  runtime: "app/generated/lattice-copy.runtime.json",
  evidence: "evidence/lattice/current.json",
  index: "evidence/lattice/index.json",
  academySource: "app/academyData.ts",
});

const SCHEMAS = Object.freeze({
  request: "fog-of-sea.lattice-copy.requests.v2",
  generated: "fog-of-sea.lattice-copy.generated.v2",
  runtime: "fog-of-sea.lattice-copy.runtime.v1",
  evidence: "fog-of-sea.lattice-copy.evidence.v2",
  index: "fog-of-sea.lattice-copy.index.v2",
  academyCorpus: "fog-of-sea.lattice-copy.academy-corpus.v1",
});

const PIN = Object.freeze({
  engineName: "Lattice — Layered Register Engine",
  engineVersion: "0.1.1",
  profileId: "relational-systems",
  profileVersion: "v1.0.0",
  profileDigest: "379ed01484574edc779efdc502ffbd6d9b8ffef3c9154fb027b0f0c8475ed21a",
  ownerPackageDigest: "58648d097c863090a95f48ebca2b20d5a6f6c2b832c915b9bac04f479d51d3b0",
});

const PROVENANCE = Object.freeze({
  fogBaselineCommit: "70907a77cba735c151e52929dd5a56d795c3d04f",
  latticeCommit: "d6cc85b275e3f14163a5a547f626832fd21b27b0",
  requestAuthority: "FOG OF SEA source-controlled authoring contract",
});

// Deliberately independent of the compiler/corpus module. The offline verifier
// reconstructs the declared owner-package digest from this closed manifest;
// only the owner compiler can additionally compare these hashes to a clean
// pinned Lattice checkout.
const OWNER_PACKAGE_MANIFEST = Object.freeze({
  format: "fog-of-sea.lattice-owner-package-manifest.v1",
  algorithm: "sha256-stable-json-v1",
  commit: PROVENANCE.latticeCommit,
  files: Object.freeze([
    Object.freeze({ path: "dist/constants.js", sha256: "b47b91835e07fff4bc48ec8abe98ef996b1b2bb6d30108604f9fcb87f0544cde" }),
    Object.freeze({ path: "dist/context.js", sha256: "2511c4c96f85d838411e5177d1268790ef62146411dfa4ecb541508b30406982" }),
    Object.freeze({ path: "dist/engine.js", sha256: "9602ff94f53908a4ef4bec1a28e74012b93062b9b064ce47976f0a2172e33061" }),
    Object.freeze({ path: "dist/errors.js", sha256: "d85382fc69178d24f3312429a6deead695d0fe5dacf2575f8cde0332cafcee4b" }),
    Object.freeze({ path: "dist/index.js", sha256: "96b5b69b14b32726a38768f19040c8d5501b9ad91efbd627d4ff6a05fbc20c4e" }),
    Object.freeze({ path: "dist/predicates.js", sha256: "433b56d41b862ad626c49786f4d6168b63df7fa5213962c4f0ec1224f39ca788" }),
    Object.freeze({ path: "dist/profile.js", sha256: "a64e52a99cd5cf3c2c3d0fb1b20d274addf9ef956aeb597cbe5004bb8fc3b75f" }),
    Object.freeze({ path: "dist/relational-systems.js", sha256: "26e5f0f461da14d55b8a176be5062c8e13cb57a0cb743b7548c30e0fb03fc5e4" }),
    Object.freeze({ path: "dist/semantic.js", sha256: "4510c2e8269f0a78b603fdead8e8091bfd5cf5af6ac7b2e61839e7b15768eac3" }),
    Object.freeze({ path: "dist/util.js", sha256: "9951fa8eafdb9316303a52c24f6e9127cd1772b8c5bed5a4ee3c9c1356083ba7" }),
    Object.freeze({ path: "dist/validators.js", sha256: "d08c62412eacc996192553d1ca53d7360b0505f1270794cab7c2c19a196d50d5" }),
    Object.freeze({ path: "package.json", sha256: "5ae1e33376032d0ecdb2ee429f9e07c65b6155a54cbc77f2e9597943a9e2efed" }),
    Object.freeze({ path: "profiles/relational-systems.profile.json", sha256: "1868a428c0f3ffd55671cf8de5d1b549ffd309a920aaf01ff1db24e93536a996" }),
  ]),
});

const IMPLEMENTATION_AUTHORITY_PATHS = Object.freeze([
  "package-lock.json",
  "package.json",
  "requirements/lattice-adoption.schema.json",
  "requirements/lattice-copy-inventory.schema.json",
  "schemas/lattice-copy-evidence.schema.json",
  "schemas/lattice-copy-generated.schema.json",
  "schemas/lattice-copy-index.schema.json",
  "schemas/lattice-copy-requests.schema.json",
  "schemas/lattice-copy-runtime.schema.json",
  "scripts/compile-lattice-copy.mjs",
  "scripts/lattice-copy-corpus.mjs",
  "scripts/validate-lattice-schemas.d.mts",
  "scripts/validate-lattice-schemas.mjs",
  "scripts/verify-lattice-copy.mts",
]);

// These identities are repeated deliberately. The verifier must not accept a
// compiler/corpus edit that quietly substitutes a different bounded slice.
const EXPECTED_REQUEST_IDS = Object.freeze([
  "fos.academy.compare-intro",
  "fos.academy.independent-status",
  "fos.academy.language-system",
  "fos.academy.model-boundary",
  "fos.academy.sources-intro",
  "fos.game.guide.command-turns",
  "fos.game.guide.mission-credit",
  "fos.game.guide.mission-learning",
  "fos.game.guide.model-boundary",
  "fos.game.guide.scenario-acceptance",
  "fos.game.guide.strategic-fit",
  "fos.game.guide.uncrewed-undersea",
  "fos.game.learning.outcome-adjustment",
  "fos.game.learning.outcome-clear",
  "fos.game.learning.outcome-pending",
  "fos.game.learning.outcome-uncertainty",
  "fos.game.learning.turn-clear",
  "fos.game.learning.turn-uncertainty",
  "fos.game.outcome.unscored-writing",
]);

const EXPECTED_PUBLISH_IDS = Object.freeze([
  "academy.compare.intro",
  "academy.sources.independentStatus",
  "academy.sources.intro",
  "academy.sources.languageSystem",
  "academy.sources.modelBoundary",
  "game.guide.commandTurns.interpretive",
  "game.guide.commandTurns.operative",
  "game.guide.missionCredit.interpretive",
  "game.guide.missionCredit.operative",
  "game.guide.missionLearning.interpretive",
  "game.guide.missionLearning.operative",
  "game.guide.modelBoundary.interpretive",
  "game.guide.modelBoundary.operative",
  "game.guide.scenarioAcceptance.interpretive",
  "game.guide.scenarioAcceptance.operative",
  "game.guide.strategicFit.interpretive",
  "game.guide.strategicFit.operative",
  "game.guide.uncrewedUndersea.interpretive",
  "game.guide.uncrewedUndersea.operative",
  "game.learning.outcome.adjustment",
  "game.learning.outcome.clear",
  "game.learning.outcome.pending",
  "game.learning.outcome.uncertainty",
  "game.learning.turn.clear",
  "game.learning.turn.uncertainty",
  "game.outcome.unscoredWriting",
]);

const EXPECTED_SOURCE_IDS = Object.freeze([
  "src.academy.comparison",
  "src.academy.modules",
  "src.academy.sources",
  "src.catalog.aircraft",
  "src.catalog.platforms",
  "src.game.final-outcome",
  "src.game.outcome-learning",
  "src.game.turn-learning",
  "src.model.armaments",
  "src.model.mission-credit",
  "src.model.scenario-coexistence",
  "src.planning.readiness-gaps",
]);

const BOUNDARY = Object.freeze({
  ownerCompilerRequired: true,
  runtimeEngineIncluded: false,
  runtimeProfileIncluded: false,
  receiptsIncluded: false,
  ruleDecisionsIncluded: false,
});

const identifierPattern = /^[A-Za-z][A-Za-z0-9._:@-]*$/u;
const digestPattern = /^[a-f0-9]{64}$/u;
const symbolPattern = /^[A-Za-z_$][A-Za-z0-9_$]*$/u;
const semanticVersionPattern = /^[0-9]+\.[0-9]+\.[0-9]+$/u;
const provenanceIdPattern = /^PROV-[0-9]{3}$/u;
const requirementIdPattern = /^FOS-LAT-[A-Z]+-[0-9]{3}$/u;
const inventoryIdPattern = /^FOS-COPY-[A-Z]+-[0-9]{3}$/u;
const criterionIdPattern = /^FOS-LAT-[A-Z]+-[0-9]{3}-AC-[0-9]{2}$/u;
const testIdPattern = /^FOS-LAT-[A-Z]+-[0-9]{3}-T-[PNB][0-9]{2}$/u;
const layers = ["operative", "experiential", "interpretive"];
const representations = ["standard", "accessibility-equivalent"];
const inventoryRepresentations = new Set([...representations, "both"]);
const surfaces = new Set(["instruction", "prompt", "transition", "reflection", "summary", "report", "tooltip", "tutorial", "after-action", "public-notice", "narration"]);
const modes = new Set(["briefing", "consequence", "environment", "analysis", "action", "exposition", "aftermath", "technical", "institutional", "reflection"]);
const stakes = new Set(["ambient", "consequential", "urgent", "safety-critical"]);
const targetAssurances = new Set(["strong", "advisory", "controlled-literal"]);
const declarationKinds = new Set(["variable", "function", "class", "interface", "type-alias", "enum", "namespace"]);
const provenanceKinds = new Set(["user-directive", "repository", "profile", "implementation-audit", "project-policy"]);
const requirementPriorities = new Set(["mandatory", "high", "advisory"]);
const requirementStatuses = new Set(["planned", "implemented", "verified", "blocked", "exempt", "superseded"]);
const testKinds = new Set(["positive", "negative", "boundary"]);
const evidenceMethods = new Set(["schema-validation", "static-analysis", "unit-test", "red-team-mutation", "build-artifact-inspection", "manual-review-not-claimed", "browser-inventory-only"]);
const inventoryFamilies = new Set(["debrief", "field-guide", "academy", "shell", "privacy", "scenario", "planning", "force", "command", "contact", "accessibility", "save", "error"]);
const inventoryStatuses = new Set(["adopted", "advisory", "exempt", "blocked", "out-of-scope"]);
const conformanceRank: Data = Object.freeze({ literal: 0, degraded: 1, full: 2 });
const findingStatuses = new Set(["pass", "warn", "fail", "unknown", "not-applicable"]);
const academyRoots = new Set(["PATHS", "ACADEMY_MODULE_DEFINITIONS", "THINKER_COMPARISON", "THINKER_CLUSTERS", "SOURCE_GROUPS"]);
const excludedAcademyRoles = new Set(["id", "paths", "href"]);
const zeroWidthPattern = /[\u200B-\u200D\u2060\uFEFF]/gu;

function fail(message: string, details: string[] = []): never {
  const suffix = details.length ? `\n${details.map((detail) => `- ${detail}`).join("\n")}` : "";
  throw new Error(`Lattice copy verification failed: ${message}${suffix}`);
}

function isObject(value: unknown): value is Data {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function canonicalize(value: any): any {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isObject(value)) {
    return Object.fromEntries(Object.keys(value).sort((left, right) => left.localeCompare(right, "en")).filter((key) => value[key] !== undefined).map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function stableStringify(value: any): string {
  return JSON.stringify(canonicalize(value));
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function engineCanonicalize(value: any): any {
  if (Array.isArray(value)) return value.map(engineCanonicalize);
  if (isObject(value)) {
    return Object.fromEntries(Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => [key, engineCanonicalize(value[key])]));
  }
  return value;
}

function engineDigest(value: any): string {
  return sha256(typeof value === "string" ? value : JSON.stringify(engineCanonicalize(value)));
}

function jsonFileText(value: any): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function exactFields(value: unknown, expectedFields: string[], label: string): asserts value is Data {
  if (!isObject(value)) fail(`${label} must be an object.`);
  const expected = [...expectedFields].sort((left, right) => left.localeCompare(right, "en"));
  const observed = Object.keys(value).sort((left, right) => left.localeCompare(right, "en"));
  if (stableStringify(expected) !== stableStringify(observed)) {
    fail(`${label} fields do not match the closed contract.`, [`expected ${expected.join(", ")}`, `received ${observed.join(", ")}`]);
  }
}

function parseJson(text: string, relativePath: string): Data {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    fail(`${relativePath} is not valid JSON.`, [error instanceof Error ? error.message : String(error)]);
  }
  if (!isObject(parsed)) fail(`${relativePath} must contain one JSON object.`);
  return parsed;
}

function identifier(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length > 128 || !identifierPattern.test(value) || value.normalize("NFKC") !== value) {
    fail(`${label} must be a stable NFKC ASCII identifier of at most 128 characters.`);
  }
  return value;
}

function digest(value: unknown, label: string): string {
  if (typeof value !== "string" || !digestPattern.test(value)) fail(`${label} must be a lowercase SHA-256 digest.`);
  return value;
}

function metadataText(value: unknown, label: string, maximum = 1_000): string {
  if (typeof value !== "string" || !value || value.length > maximum || value.trim() !== value || value.normalize("NFKC") !== value) {
    fail(`${label} must be non-empty, trimmed NFKC text of at most ${maximum} characters.`);
  }
  return value;
}

function uniqueTextList(value: unknown, label: string, { minimum = 0, maximum = 256, pattern }: { minimum?: number; maximum?: number; pattern?: RegExp } = {}): string[] {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) fail(`${label} has an invalid number of entries.`);
  const entries = value.map((entry, index) => pattern
    ? (typeof entry === "string" && pattern.test(entry) ? entry : fail(`${label}[${index}] is invalid.`))
    : metadataText(entry, `${label}[${index}]`, 10_000));
  if (new Set(entries).size !== entries.length) fail(`${label} contains duplicates.`);
  return entries;
}

function sameSet(left: Iterable<string>, right: Iterable<string>): boolean {
  return stableStringify([...left].sort((a, b) => a.localeCompare(b, "en")))
    === stableStringify([...right].sort((a, b) => a.localeCompare(b, "en")));
}

function canonicalPath(value: unknown, label: string): string {
  if (typeof value !== "string" || !value || value.includes("\\") || value.includes("\0") || path.posix.isAbsolute(value)) {
    fail(`${label} must be a canonical repository-relative POSIX path.`);
  }
  const normalized = path.posix.normalize(value);
  if (normalized !== value || normalized === "." || normalized === ".." || normalized.startsWith("../")) {
    fail(`${label} must not contain traversal or redundant segments.`);
  }
  return value;
}

function referenceList(value: unknown, label: string, pattern = identifierPattern): string[] {
  if (!Array.isArray(value) || !value.length) fail(`${label} must be a non-empty identifier array.`);
  const entries = value.map((entry, index) => {
    if (typeof entry !== "string" || !pattern.test(entry)) fail(`${label}[${index}] is invalid.`);
    return entry;
  });
  if (new Set(entries).size !== entries.length) fail(`${label} contains duplicates.`);
  return [...entries].sort((left, right) => left.localeCompare(right, "en"));
}

function assertSame(expected: unknown, observed: unknown, label: string): void {
  if (stableStringify(expected) !== stableStringify(observed)) fail(`${label} differs from independently reconstructed authority.`);
}

function normalizeText(value: unknown, label: string): string {
  if (typeof value !== "string") fail(`${label} must be text.`);
  return value.normalize("NFKC").replace(zeroWidthPattern, "").replace(/\r\n?/gu, "\n");
}

async function readJson(repositoryRoot: string, relativePath: string, requireCanonicalEmission: boolean): Promise<{ document: Data; text: string; sha256: string }> {
  const bytes = await readFile(path.join(repositoryRoot, relativePath));
  const text = bytes.toString("utf8");
  const document = parseJson(text, relativePath);
  if (requireCanonicalEmission && text !== jsonFileText(document)) fail(`${relativePath} is not in canonical emitted JSON form.`);
  return { document, text, sha256: sha256(bytes) };
}

async function containedRealPath(repositoryRoot: string, relativePath: string, label: string): Promise<string> {
  const root = await realpath(repositoryRoot);
  const resolved = await realpath(path.join(repositoryRoot, relativePath));
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) fail(`${label} resolves outside the repository.`);
  return resolved;
}

function validateDeclaredOwnerPackage(): void {
  exactFields(OWNER_PACKAGE_MANIFEST, ["format", "algorithm", "commit", "files"], "Owner package manifest");
  if (OWNER_PACKAGE_MANIFEST.format !== "fog-of-sea.lattice-owner-package-manifest.v1"
    || OWNER_PACKAGE_MANIFEST.algorithm !== "sha256-stable-json-v1" || OWNER_PACKAGE_MANIFEST.commit !== PROVENANCE.latticeCommit
    || !Array.isArray(OWNER_PACKAGE_MANIFEST.files) || OWNER_PACKAGE_MANIFEST.files.length !== 13) {
    fail("The independent owner package manifest identity is invalid.");
  }
  const paths = new Set<string>();
  for (const [index, entry] of OWNER_PACKAGE_MANIFEST.files.entries()) {
    exactFields(entry, ["path", "sha256"], `Owner package manifest files[${index}]`);
    const relativePath = canonicalPath(entry.path, `Owner package manifest files[${index}].path`);
    digest(entry.sha256, `Owner package manifest files[${index}].sha256`);
    if (paths.has(relativePath)) fail(`Owner package manifest duplicates ${relativePath}.`);
    paths.add(relativePath);
  }
  if (sha256(stableStringify(OWNER_PACKAGE_MANIFEST)) !== PIN.ownerPackageDigest) {
    fail("The independently derived owner package digest differs from the pin.");
  }
}

async function createImplementationAuthority(repositoryRoot: string): Promise<Data> {
  const files: Data[] = [];
  for (const relativePath of IMPLEMENTATION_AUTHORITY_PATHS) {
    const resolved = await containedRealPath(repositoryRoot, relativePath, `Implementation authority ${relativePath}`);
    files.push({ path: relativePath, sha256: sha256(await readFile(resolved)) });
  }
  files.sort((left, right) => left.path.localeCompare(right.path, "en"));
  const body = { format: "fog-of-sea.lattice-implementation-authority.v1", algorithm: "sha256-stable-json-v1", files };
  return { ...body, sha256: sha256(stableStringify(body)) };
}

function topLevelDeclarations(source: string, relativePath: string): Map<string, Data[]> {
  const sourceFile = ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true, relativePath.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const parseDiagnostics = (sourceFile as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics;
  if (parseDiagnostics.length) {
    fail(`${relativePath} has TypeScript parse diagnostics.`, parseDiagnostics.map((diagnostic: ts.Diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")));
  }
  const declarations = new Map<string, Data[]>();
  const add = (name: ts.DeclarationName | undefined, kind: string, exported: boolean): void => {
    if (!name || !ts.isIdentifier(name)) return;
    const records = declarations.get(name.text) ?? [];
    records.push({ kind, exported });
    declarations.set(name.text, records);
  };
  for (const statement of sourceFile.statements) {
    const exported = Boolean(ts.canHaveModifiers(statement) && ts.getModifiers(statement)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword));
    if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) add(declaration.name, "variable", exported);
    else if (ts.isFunctionDeclaration(statement)) add(statement.name, "function", exported);
    else if (ts.isClassDeclaration(statement)) add(statement.name, "class", exported);
    else if (ts.isInterfaceDeclaration(statement)) add(statement.name, "interface", exported);
    else if (ts.isTypeAliasDeclaration(statement)) add(statement.name, "type-alias", exported);
    else if (ts.isEnumDeclaration(statement)) add(statement.name, "enum", exported);
    else if (ts.isModuleDeclaration(statement)) add(statement.name, "namespace", exported);
  }
  return declarations;
}

function publicationAnchorCount(source: string, relativePath: string, fragment: string): number {
  let count = topLevelDeclarations(source, relativePath).get(fragment)?.length ?? 0;
  const sourceFile = ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true, relativePath.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = (node: ts.Node): void => {
    if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && node.name.text === "id" && node.initializer
      && ts.isStringLiteral(node.initializer) && node.initializer.text === fragment) count += 1;
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return count;
}

async function normalizeSourceCatalog(repositoryRoot: string, value: unknown): Promise<{ records: Data[]; byId: Map<string, Data> }> {
  if (!Array.isArray(value) || !value.length) fail("sourceCatalog must be a non-empty array.");
  const ids = new Set<string>();
  const locations = new Set<string>();
  const records: Data[] = [];
  for (const [index, raw] of value.entries()) {
    exactFields(raw, ["id", "path", "symbol", "kind", "exported", "sha256"], `sourceCatalog[${index}]`);
    const id = identifier(raw.id, `sourceCatalog[${index}].id`);
    const relativePath = canonicalPath(raw.path, `sourceCatalog[${index}].path`);
    const symbol = identifier(raw.symbol, `sourceCatalog[${index}].symbol`);
    if (!declarationKinds.has(raw.kind)) fail(`sourceCatalog ${id} has an unsupported declaration kind.`);
    if (typeof raw.exported !== "boolean") fail(`sourceCatalog ${id}.exported must be boolean.`);
    const expectedDigest = digest(raw.sha256, `sourceCatalog[${index}].sha256`);
    if (!/^app\/.+\.(?:ts|tsx)$/u.test(relativePath) || /^(?:app\/generated|authoring|dist|evidence|node_modules|requirements|scripts)\//u.test(relativePath)) {
      fail(`sourceCatalog ${id} must identify non-generated application TypeScript.`);
    }
    await containedRealPath(repositoryRoot, relativePath, `sourceCatalog ${id}`);
    const source = await readFile(path.join(repositoryRoot, relativePath));
    if (sha256(source) !== expectedDigest) fail(`sourceCatalog ${id} is stale for ${relativePath}.`);
    const declarations = topLevelDeclarations(source.toString("utf8"), relativePath).get(symbol) ?? [];
    if (!symbolPattern.test(symbol) || declarations.length !== 1
      || declarations[0].kind !== raw.kind || declarations[0].exported !== raw.exported) {
      fail(`sourceCatalog ${id} does not identify exactly one matching top-level TypeScript declaration in ${relativePath}.`);
    }
    const location = `${relativePath}#${symbol}`;
    if (ids.has(id) || locations.has(location)) fail(`sourceCatalog duplicates ${ids.has(id) ? id : location}.`);
    ids.add(id);
    locations.add(location);
    records.push({ id, path: relativePath, symbol, kind: raw.kind, exported: raw.exported, sha256: expectedDigest });
  }
  records.sort((left, right) => left.id.localeCompare(right.id, "en"));
  if (!sameSet(records.map((record) => record.id), EXPECTED_SOURCE_IDS)) fail("sourceCatalog does not match the closed 12-source identity set.");
  return { records, byId: new Map(records.map((record) => [record.id, record])) };
}

function validateAdoptionDocument(adoption: Data, relativePath: string): { requirementIds: Set<string>; supersededIds: Set<string> } {
  exactFields(adoption, ["format", "registerId", "version", "scope", "provenance", "requirements"], relativePath);
  if (adoption.format !== "fog-of-sea-lattice-adoption-requirements-v1" || adoption.registerId !== "FOS-LAT"
    || adoption.version !== "1.0.0" || !semanticVersionPattern.test(adoption.version)) fail(`${relativePath} has an unsupported authority identity.`);
  exactFields(adoption.scope, ["authorized", "excluded", "broadAdoptionStatus", "statement"], `${relativePath} scope`);
  if (uniqueTextList(adoption.scope.authorized, `${relativePath} scope.authorized`, { minimum: 4, maximum: 4 }).length !== 4
    || uniqueTextList(adoption.scope.excluded, `${relativePath} scope.excluded`, { minimum: 4, maximum: 4 }).length !== 4) fail(`${relativePath} scope lists are incomplete.`);
  if (adoption.scope.broadAdoptionStatus !== "blocked") fail(`${relativePath} must keep broad adoption blocked.`);
  metadataText(adoption.scope.statement, `${relativePath} scope.statement`, 10_000);
  if (!Array.isArray(adoption.provenance) || adoption.provenance.length !== 5) fail(`${relativePath} must contain exactly five provenance records.`);
  const provenanceIds = new Set<string>();
  for (const [index, record] of adoption.provenance.entries()) {
    exactFields(record, ["id", "kind", "locator", "revision", "role"], `${relativePath} provenance[${index}]`);
    if (typeof record.id !== "string" || !provenanceIdPattern.test(record.id) || provenanceIds.has(record.id)) fail(`${relativePath} provenance[${index}].id is invalid or duplicated.`);
    if (!provenanceKinds.has(record.kind)) fail(`${relativePath} provenance ${record.id} has an unsupported kind.`);
    for (const field of ["locator", "revision", "role"]) metadataText(record[field], `${relativePath} provenance ${record.id}.${field}`, 10_000);
    provenanceIds.add(record.id);
  }
  if (!Array.isArray(adoption.requirements) || adoption.requirements.length !== 25) fail(`${relativePath} must contain exactly 25 requirements.`);
  const requirementIds = new Set<string>();
  const supersededIds = new Set<string>();
  const requirementsById = new Map<string, Data>();
  for (const [index, record] of adoption.requirements.entries()) {
    exactFields(record, ["id", "title", "statement", "provenanceIds", "priority", "precedence", "dependencies", "conflicts", "owners", "acceptanceCriteria", "tests", "evidenceMethods", "status", "supersedes", "supersession"], `${relativePath} requirements[${index}]`);
    if (typeof record.id !== "string" || !requirementIdPattern.test(record.id) || requirementIds.has(record.id)) fail(`${relativePath} requirements[${index}].id is invalid or duplicated.`);
    metadataText(record.title, `Requirement ${record.id}.title`, 1_000);
    metadataText(record.statement, `Requirement ${record.id}.statement`, 10_000);
    uniqueTextList(record.provenanceIds, `Requirement ${record.id}.provenanceIds`, { minimum: 1, pattern: provenanceIdPattern });
    if (!requirementPriorities.has(record.priority) || !Number.isInteger(record.precedence) || record.precedence < 1) fail(`Requirement ${record.id} has invalid priority or precedence.`);
    uniqueTextList(record.dependencies, `Requirement ${record.id}.dependencies`, { pattern: requirementIdPattern });
    uniqueTextList(record.conflicts, `Requirement ${record.id}.conflicts`);
    uniqueTextList(record.owners, `Requirement ${record.id}.owners`, { minimum: 1 }).forEach((owner, ownerIndex) => canonicalPath(owner, `Requirement ${record.id}.owners[${ownerIndex}]`));
    if (!Array.isArray(record.acceptanceCriteria) || !record.acceptanceCriteria.length) fail(`Requirement ${record.id} needs acceptance criteria.`);
    const criterionIds = new Set<string>();
    for (const [criterionIndex, criterion] of record.acceptanceCriteria.entries()) {
      exactFields(criterion, ["id", "assertion"], `Requirement ${record.id} acceptanceCriteria[${criterionIndex}]`);
      if (typeof criterion.id !== "string" || !criterionIdPattern.test(criterion.id) || !criterion.id.startsWith(`${record.id}-AC-`) || criterionIds.has(criterion.id)) fail(`Requirement ${record.id} has an invalid or duplicated acceptance criterion ID.`);
      metadataText(criterion.assertion, `Requirement ${record.id} criterion ${criterion.id}`, 10_000);
      criterionIds.add(criterion.id);
    }
    if (!Array.isArray(record.tests) || record.tests.length < 3) fail(`Requirement ${record.id} needs positive, negative, and boundary tests.`);
    const testIds = new Set<string>();
    const observedTestKinds = new Set<string>();
    const suffixByKind: Data = { positive: "P", negative: "N", boundary: "B" };
    for (const [testIndex, requirementTest] of record.tests.entries()) {
      exactFields(requirementTest, ["id", "kind", "assertion", "evidence"], `Requirement ${record.id} tests[${testIndex}]`);
      if (typeof requirementTest.id !== "string" || !testIdPattern.test(requirementTest.id) || !requirementTest.id.startsWith(`${record.id}-T-`)
        || !testKinds.has(requirementTest.kind) || !requirementTest.id.startsWith(`${record.id}-T-${suffixByKind[requirementTest.kind]}`) || testIds.has(requirementTest.id)) fail(`Requirement ${record.id} has an invalid or duplicated test identity.`);
      metadataText(requirementTest.assertion, `Requirement ${record.id} test ${requirementTest.id}.assertion`, 10_000);
      metadataText(requirementTest.evidence, `Requirement ${record.id} test ${requirementTest.id}.evidence`, 10_000);
      testIds.add(requirementTest.id);
      observedTestKinds.add(requirementTest.kind);
    }
    if (!sameSet(observedTestKinds, testKinds)) fail(`Requirement ${record.id} must declare positive, negative, and boundary tests.`);
    const methods = uniqueTextList(record.evidenceMethods, `Requirement ${record.id}.evidenceMethods`, { minimum: 1 });
    if (methods.some((method) => !evidenceMethods.has(method))) fail(`Requirement ${record.id} has an unsupported evidence method.`);
    if (!requirementStatuses.has(record.status)) fail(`Requirement ${record.id} has an unsupported status.`);
    uniqueTextList(record.supersedes, `Requirement ${record.id}.supersedes`, { pattern: requirementIdPattern });
    if (record.status === "superseded") {
      exactFields(record.supersession, ["supersededBy", "reason"], `Requirement ${record.id}.supersession`);
      if (typeof record.supersession.supersededBy !== "string" || !requirementIdPattern.test(record.supersession.supersededBy) || record.supersession.supersededBy === record.id) fail(`Requirement ${record.id} has an invalid supersession target.`);
      metadataText(record.supersession.reason, `Requirement ${record.id}.supersession.reason`, 10_000);
      supersededIds.add(record.id);
    } else if (record.supersession !== null) fail(`Active requirement ${record.id} must have null supersession.`);
    requirementIds.add(record.id);
    requirementsById.set(record.id, record);
  }
  if (![...requirementsById.values()].some((record) => record.status === "blocked")) fail(`${relativePath} must retain an explicit blocked requirement.`);
  for (const record of requirementsById.values()) {
    for (const id of record.provenanceIds) if (!provenanceIds.has(id)) fail(`Requirement ${record.id} references unknown provenance ${id}.`);
    for (const id of record.dependencies) if (id === record.id || !requirementsById.has(id) || supersededIds.has(id)) fail(`Requirement ${record.id} has invalid dependency ${id}.`);
    for (const id of record.supersedes) {
      if (id === record.id) fail(`Requirement ${record.id} cannot supersede itself.`);
      const superseded = requirementsById.get(id);
      if (superseded && (superseded.status !== "superseded" || superseded.supersession.supersededBy !== record.id)) fail(`Requirement ${record.id} supersession of ${id} is not bidirectional.`);
    }
    if (record.status === "superseded") {
      const replacement = requirementsById.get(record.supersession.supersededBy);
      if (!replacement || supersededIds.has(replacement.id) || !replacement.supersedes.includes(record.id)) fail(`Requirement ${record.id} supersession is not owned by an active replacement.`);
    }
  }
  return { requirementIds, supersededIds };
}

function validateInventoryDocument(inventory: Data, relativePath: string, requirementIds: Set<string>, supersededIds: Set<string>): Data {
  exactFields(inventory, ["format", "version", "scope", "units"], relativePath);
  if (inventory.format !== "fog-of-sea-lattice-copy-inventory-v1" || inventory.version !== "1.0.0" || !semanticVersionPattern.test(inventory.version)) fail(`${relativePath} has an unsupported authority identity.`);
  exactFields(inventory.scope, ["unitCount", "requestCount", "outputCount", "sourceSymbolCount", "academyLintMode", "broadAdoptionStatus", "statement"], `${relativePath} scope`);
  if (!Array.isArray(inventory.units) || inventory.units.length !== 37 || inventory.scope.unitCount !== inventory.units.length
    || inventory.scope.requestCount !== EXPECTED_REQUEST_IDS.length || inventory.scope.outputCount !== EXPECTED_PUBLISH_IDS.length || inventory.scope.sourceSymbolCount !== 12
    || inventory.scope.academyLintMode !== "advisory-curriculum-data" || inventory.scope.broadAdoptionStatus !== "blocked") fail(`${relativePath} scope does not match the bounded adoption slice.`);
  metadataText(inventory.scope.statement, `${relativePath} scope.statement`, 10_000);
  const inventoryIds = new Set<string>();
  const exemptInventoryIds = new Set<string>();
  const inventoryOwners = new Map<string, Set<string>>();
  const inventoryRoutes = new Map<string, Data>();
  const inventoryUnits = new Map<string, Data>();
  const inventoryOutputOwners = new Map<string, string>();
  for (const [index, record] of inventory.units.entries()) {
    exactFields(record, ["id", "family", "surfaceName", "description", "status", "exemptionReason", "route", "targetAssurance", "owners", "requestIds", "outputTargets", "requirementIds", "risks", "supersedes"], `${relativePath} units[${index}]`);
    if (typeof record.id !== "string" || !inventoryIdPattern.test(record.id) || inventoryIds.has(record.id)) fail(`${relativePath} units[${index}].id is invalid or duplicated.`);
    if (!inventoryFamilies.has(record.family) || !inventoryStatuses.has(record.status)) fail(`Inventory ${record.id} has invalid family or status.`);
    metadataText(record.surfaceName, `Inventory ${record.id}.surfaceName`, 1_000);
    metadataText(record.description, `Inventory ${record.id}.description`, 10_000);
    const requestIds = uniqueTextList(record.requestIds, `Inventory ${record.id}.requestIds`, { pattern: identifierPattern });
    const outputTargets = uniqueTextList(record.outputTargets, `Inventory ${record.id}.outputTargets`, { pattern: identifierPattern });
    const linkedRequirementIds = uniqueTextList(record.requirementIds, `Inventory ${record.id}.requirementIds`, { minimum: 1, pattern: requirementIdPattern });
    uniqueTextList(record.risks, `Inventory ${record.id}.risks`, { minimum: 1 });
    uniqueTextList(record.supersedes, `Inventory ${record.id}.supersedes`, { pattern: inventoryIdPattern });
    for (const requirementId of linkedRequirementIds) if (!requirementIds.has(requirementId) || supersededIds.has(requirementId)) fail(`Inventory ${record.id} references inactive requirement ${requirementId}.`);
    if (!Array.isArray(record.owners) || !record.owners.length) fail(`Inventory ${record.id} has no owners.`);
    const ownerKeys = new Set<string>();
    const ownerPaths = new Set<string>(record.owners.map((owner: unknown, ownerIndex: number) => {
      exactFields(owner, ["path", "role"], `Inventory ${record.id} owner ${ownerIndex}`);
      const ownerPath = canonicalPath(owner.path, `Inventory ${record.id} owner ${ownerIndex}.path`);
      const role = metadataText(owner.role, `Inventory ${record.id} owner ${ownerIndex}.role`, 1_000);
      const key = `${ownerPath}\0${role}`;
      if (ownerKeys.has(key)) fail(`Inventory ${record.id} duplicates owner ${ownerPath}.`);
      ownerKeys.add(key);
      return ownerPath;
    }));
    if (record.status === "adopted") {
      if (record.exemptionReason !== null || !requestIds.length || !outputTargets.length || !targetAssurances.has(record.targetAssurance)) fail(`Adopted inventory ${record.id} must declare a route, review target, requests, and outputs without an exemption.`);
      exactFields(record.route, ["layer", "surface", "mode", "stakes", "representation"], `Inventory ${record.id} route`);
      if (!layers.includes(record.route.layer) || !surfaces.has(record.route.surface) || !modes.has(record.route.mode) || !stakes.has(record.route.stakes) || !inventoryRepresentations.has(record.route.representation)) fail(`Inventory ${record.id} has an unsupported route.`);
      inventoryRoutes.set(record.id, { ...record.route, targetAssurance: record.targetAssurance });
      for (const outputTarget of outputTargets) {
        if (inventoryOutputOwners.has(outputTarget)) fail(`Inventory output target ${outputTarget} has more than one owner.`);
        inventoryOutputOwners.set(outputTarget, record.id);
      }
    } else {
      exemptInventoryIds.add(record.id);
      if (typeof record.exemptionReason !== "string" || !record.exemptionReason || record.route !== null || record.targetAssurance !== "not-applicable" || requestIds.length || outputTargets.length) fail(`Non-adopted inventory ${record.id} must state its reason and have no route, review target, request, or output.`);
      metadataText(record.exemptionReason, `Inventory ${record.id}.exemptionReason`, 10_000);
    }
    inventoryIds.add(record.id);
    inventoryOwners.set(record.id, ownerPaths);
    inventoryUnits.set(record.id, { ...record, requestIds, outputTargets, requirementIds: linkedRequirementIds, ownerPaths });
  }
  for (const record of inventoryUnits.values()) for (const id of record.supersedes) {
    if (id === record.id) fail(`Inventory ${record.id} cannot supersede itself.`);
    if (inventoryUnits.has(id)) fail(`Inventory ${record.id} may supersede only a historical, absent inventory identity.`);
  }
  if (!sameSet(inventoryOutputOwners.keys(), EXPECTED_PUBLISH_IDS)) fail(`${relativePath} adopted outputTargets do not match the closed publication set.`);
  return { inventoryIds, exemptInventoryIds, inventoryOwners, inventoryRoutes, inventoryUnits };
}

async function loadRequirementAuthority(repositoryRoot: string): Promise<Data> {
  const adoptionPath = "requirements/lattice-adoption.json";
  const inventoryPath = "requirements/lattice-copy-inventory.json";
  const [adoptionBytes, inventoryBytes] = await Promise.all([
    readFile(path.join(repositoryRoot, adoptionPath)),
    readFile(path.join(repositoryRoot, inventoryPath)),
  ]);
  const adoption = parseJson(adoptionBytes.toString("utf8"), adoptionPath);
  const inventory = parseJson(inventoryBytes.toString("utf8"), inventoryPath);
  const { requirementIds, supersededIds } = validateAdoptionDocument(adoption, adoptionPath);
  const { inventoryIds, exemptInventoryIds, inventoryOwners, inventoryRoutes, inventoryUnits } = validateInventoryDocument(
    inventory,
    inventoryPath,
    requirementIds,
    supersededIds,
  );
  return {
    authorityFiles: [
      { path: adoptionPath, sha256: sha256(adoptionBytes) },
      { path: inventoryPath, sha256: sha256(inventoryBytes) },
    ],
    requirementIds,
    supersededIds,
    inventoryIds,
    exemptInventoryIds,
    inventoryOwners,
    inventoryRoutes,
    inventoryUnits,
  };
}

function propertyName(node: ts.Node, sourceFile: ts.SourceFile): string {
  let current = node.parent;
  while (current) {
    if (ts.isPropertyAssignment(current)) {
      if (ts.isIdentifier(current.name) || ts.isStringLiteral(current.name)) return current.name.text;
      return current.name.getText(sourceFile);
    }
    if (ts.isVariableDeclaration(current)) break;
    current = current.parent;
  }
  return "text";
}

async function createAcademyCorpus(repositoryRoot: string): Promise<Data> {
  const relativePath = PATHS.academySource;
  const sourceBytes = await readFile(path.join(repositoryRoot, relativePath));
  const sourceFile = ts.createSourceFile(relativePath, sourceBytes.toString("utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const entries: Data[] = [];
  let sequence = 0;
  const collect = (node: ts.Node, section: string): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const role = propertyName(node, sourceFile);
      if (!excludedAcademyRoles.has(role)) {
        sequence += 1;
        entries.push({ id: `academy-copy-${String(sequence).padStart(4, "0")}`, text: node.text, role, section, sourcePath: relativePath });
      }
    }
    ts.forEachChild(node, (child) => collect(child, section));
  };
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && academyRoots.has(declaration.name.text) && declaration.initializer) collect(declaration.initializer, declaration.name.text);
    }
  }
  if (entries.length !== 1_011) fail(`Academy corpus extraction expected 1011 entries but found ${entries.length}.`);
  const roles: Data = {};
  const sections: Data = {};
  for (const entry of entries) {
    roles[entry.role] = (roles[entry.role] ?? 0) + 1;
    sections[entry.section] = (sections[entry.section] ?? 0) + 1;
  }
  return {
    schemaVersion: SCHEMAS.academyCorpus,
    source: { path: relativePath, sha256: sha256(sourceBytes) },
    entryCount: entries.length,
    characterCount: entries.reduce((count, entry) => count + entry.text.length, 0),
    roles,
    sections,
    corpusSha256: sha256(stableStringify(entries)),
    entries,
  };
}

function academyBatches(entries: Data[]): Data[] {
  if (entries.length !== 1_011) fail("Academy lint batching requires the canonical 1011-entry corpus.");
  const midpoint = Math.ceil(entries.length / 2);
  return [entries.slice(0, midpoint), entries.slice(midpoint)].map((batchEntries, index) => {
    const text = batchEntries.map((entry) => entry.text).join("\n");
    return {
      id: `academy-lint-${index + 1}-of-2`,
      entryIds: batchEntries.map((entry) => entry.id),
      entryCount: batchEntries.length,
      textSha256: sha256(text),
    };
  });
}

function outputTargets(record: Data): Data[] {
  if (!Array.isArray(record.outputs) || !record.outputs.length) fail(`Request ${String(record.id)} has no outputs.`);
  const keys = new Set<string>();
  return record.outputs.map((raw: unknown, index: number) => {
    exactFields(raw, ["publishId", "layer", "representation"], `Request ${String(record.id)} output ${index}`);
    const publishId = identifier(raw.publishId, `Request ${String(record.id)} output ${index}`);
    if (!layers.includes(raw.layer) || !representations.includes(raw.representation)) fail(`Output ${publishId} has an invalid route.`);
    const key = `${raw.layer}:${raw.representation}`;
    if (keys.has(key)) fail(`Request ${String(record.id)} duplicates output route ${key}.`);
    keys.add(key);
    return { publishId, layer: raw.layer, representation: raw.representation, key };
  });
}

async function publicationPaths(repositoryRoot: string, value: unknown, requestId: string): Promise<Set<string>> {
  if (!Array.isArray(value) || !value.length) fail(`Request ${requestId} source must list publication locators.`);
  const locators = new Set<string>();
  const paths = new Set<string>();
  for (const [index, raw] of value.entries()) {
    if (typeof raw !== "string" || !raw) fail(`Request ${requestId} source[${index}] must be text.`);
    const separator = raw.indexOf("#");
    if (separator !== raw.lastIndexOf("#")) fail(`Request ${requestId} source[${index}] has multiple fragments.`);
    const relativePath = canonicalPath(separator < 0 ? raw : raw.slice(0, separator), `Request ${requestId} source[${index}]`);
    const fragment = separator < 0 ? undefined : raw.slice(separator + 1);
    if (fragment === undefined || !fragment || !identifierPattern.test(fragment)) fail(`Request ${requestId} source[${index}] requires a valid fragment.`);
    if (locators.has(raw)) fail(`Request ${requestId} duplicates publication locator ${raw}.`);
    const publicationPath = await containedRealPath(repositoryRoot, relativePath, `Request ${requestId} publication path`);
    if (publicationAnchorCount(await readFile(publicationPath, "utf8"), relativePath, fragment) !== 1) {
      fail(`Request ${requestId} source[${index}] must resolve to exactly one top-level declaration or literal JSX id.`);
    }
    locators.add(raw);
    paths.add(relativePath);
  }
  return paths;
}

function routeMatches(route: Data | undefined, context: Data, target: Data): boolean {
  return Boolean(route) && route?.layer === target.layer && route?.surface === context.surface && route?.mode === context.mode
    && route?.stakes === context.stakes && (route?.representation === "both" || route?.representation === target.representation);
}

function traceRequest(record: Data, targets: Data[], sourceCatalog: Data, authority: Data, publishedAt: Set<string>): Data {
  exactFields(record.traceability, ["requirementIds", "inventoryIds", "sourceRefs"], `Request ${record.id} traceability`);
  const requirementIds = referenceList(record.traceability.requirementIds, `Request ${record.id} requirementIds`, requirementIdPattern);
  const inventoryIds = referenceList(record.traceability.inventoryIds, `Request ${record.id} inventoryIds`, inventoryIdPattern);
  const sourceRefs = referenceList(record.traceability.sourceRefs, `Request ${record.id} sourceRefs`);
  const problems = [
    ...requirementIds.filter((id) => !authority.requirementIds.has(id)).map((id) => `unknown requirement ${id}`),
    ...requirementIds.filter((id) => authority.supersededIds.has(id)).map((id) => `superseded requirement ${id}`),
    ...inventoryIds.filter((id) => !authority.inventoryIds.has(id)).map((id) => `unknown inventory ${id}`),
    ...inventoryIds.filter((id) => authority.exemptInventoryIds.has(id)).map((id) => `exempt inventory ${id}`),
    ...sourceRefs.filter((id) => !sourceCatalog.byId.has(id)).map((id) => `unknown source ${id}`),
  ];
  if (problems.length) fail(`Request ${record.id} has invalid traceability.`, problems);
  const inventoryWithoutPublication = inventoryIds.filter((id) => ![...authority.inventoryOwners.get(id)].some((owner: string) => publishedAt.has(owner)));
  const publicationWithoutInventory = [...publishedAt].filter((publicationPath) => !inventoryIds.some((id) => authority.inventoryOwners.get(id).has(publicationPath)));
  if (inventoryWithoutPublication.length || publicationWithoutInventory.length) fail(`Request ${record.id} publication ownership is incomplete.`, [...inventoryWithoutPublication, ...publicationWithoutInventory]);
  if (!isObject(record.context)) fail(`Request ${record.id} context must be an object.`);
  const usedInventory = new Set<string>();
  for (const target of targets) {
    const matching = inventoryIds.filter((id) => routeMatches(authority.inventoryRoutes.get(id), record.context, target));
    if (matching.length !== 1) fail(`Request ${record.id} output ${target.publishId} must match exactly one linked inventory route.`, matching);
    usedInventory.add(matching[0]);
  }
  const unused = inventoryIds.filter((id) => !usedInventory.has(id));
  if (unused.length) fail(`Request ${record.id} links unused inventory routes.`, unused);
  for (const inventoryId of inventoryIds) {
    const unit = authority.inventoryUnits.get(inventoryId);
    if (!unit.requestIds.includes(record.id)) fail(`Inventory ${inventoryId} does not declare request owner ${record.id}.`);
  }
  for (const target of targets) {
    const inventoryId = [...usedInventory].find((id) => routeMatches(authority.inventoryRoutes.get(id), record.context, target));
    if (!authority.inventoryUnits.get(inventoryId).outputTargets.includes(target.publishId)) fail(`Inventory ${inventoryId} does not own output target ${target.publishId}.`);
  }
  return { requirementIds, inventoryIds, sourceRefs };
}

function validateBidirectionalInventory(authority: Data, requestLinks: Map<string, Data>): void {
  for (const [inventoryId, unit] of authority.inventoryUnits as Map<string, Data>) {
    if (unit.status !== "adopted") continue;
    const linkedRequests = [...requestLinks.values()].filter((request) => request.inventoryIds.includes(inventoryId));
    if (!sameSet(linkedRequests.map((request) => request.requestId), unit.requestIds)) fail(`Inventory ${inventoryId} requestIds are not bidirectional.`);
    const observedTargets = linkedRequests.flatMap((request) => request.targets
      .filter((target: Data) => routeMatches(authority.inventoryRoutes.get(inventoryId), request.context, target))
      .map((target: Data) => target.publishId));
    if (!sameSet(observedTargets, unit.outputTargets)) fail(`Inventory ${inventoryId} outputTargets are not bidirectional.`);
    const linkedRequirementIds = new Set<string>(linkedRequests.flatMap((request) => request.requirementIds));
    const missing = unit.requirementIds.filter((requirementId: string) => !linkedRequirementIds.has(requirementId));
    if (missing.length) fail(`Inventory ${inventoryId} requirementIds are not covered by its linked requests.`, missing);
  }
}

function verifyCandidateEvidenceRefs(record: Data, traceability: Data): void {
  if (!Array.isArray(record.candidates)) return;
  const allowed = new Set<string>(traceability.sourceRefs);
  for (const [candidateIndex, candidate] of record.candidates.entries()) {
    if (!isObject(candidate) || !isObject(candidate.metadata) || !Array.isArray(candidate.metadata.claims)) continue;
    for (const [claimIndex, claim] of candidate.metadata.claims.entries()) {
      if (!isObject(claim) || !Array.isArray(claim.evidenceRefs) || !claim.evidenceRefs.length) fail(`Request ${record.id} candidate ${candidateIndex} claim ${claimIndex} must declare evidenceRefs.`);
      const evidenceRefs = referenceList(claim.evidenceRefs, `Request ${record.id} candidate ${candidateIndex} claim ${claimIndex} evidenceRefs`);
      const unknown = evidenceRefs.filter((sourceRef) => !allowed.has(sourceRef));
      if (unknown.length) fail(`Request ${record.id} candidate claim references undeclared source evidence.`, unknown);
    }
  }
}

function normalizeReview(value: unknown, requestId: string): Data {
  exactFields(value, ["authority", "humanStatus", "claimScope"], `Request ${requestId} review`);
  if (typeof value.authority !== "string" || !value.authority || value.authority.trim() !== value.authority
    || value.authority.normalize("NFKC") !== value.authority || value.authority.length > 1_000
    || typeof value.claimScope !== "string" || !value.claimScope || value.claimScope.trim() !== value.claimScope
    || value.claimScope.normalize("NFKC") !== value.claimScope || value.claimScope.length > 1_000
    || value.humanStatus !== "not-claimed") {
    fail(`Request ${requestId} has unsupported review metadata.`);
  }
  return { authority: value.authority, humanStatus: "not-claimed", claimScope: value.claimScope };
}

function normalizePhraseMap(value: unknown, label: string): Data {
  if (value === undefined) return {};
  if (!isObject(value)) fail(`${label} must be keyed by publishId.`);
  const result: Data = {};
  for (const [publishId, phrases] of Object.entries(value)) {
    identifier(publishId, `${label} publishId`);
    if (!Array.isArray(phrases) || !phrases.length || phrases.some((phrase) => typeof phrase !== "string" || !phrase) || new Set(phrases).size !== phrases.length) {
      fail(`${label}.${publishId} is invalid.`);
    }
    result[publishId] = [...phrases];
  }
  return result;
}

function normalizeAssertions(value: unknown, label: string): Data {
  if (value === undefined) return { requiredPhrases: {}, prohibitedPhrases: {}, exactText: {} };
  if (!isObject(value)) fail(`${label} must be an object.`);
  const unknown = Object.keys(value).filter((key) => !["requiredPhrases", "prohibitedPhrases", "exactText"].includes(key));
  if (unknown.length) fail(`${label} has unsupported fields.`, unknown);
  const exactText: Data = {};
  if (value.exactText !== undefined) {
    if (!isObject(value.exactText)) fail(`${label}.exactText must be keyed by publishId.`);
    for (const [publishId, text] of Object.entries(value.exactText)) {
      identifier(publishId, `${label}.exactText publishId`);
      if (typeof text !== "string" || !text) fail(`${label}.exactText.${publishId} must be text.`);
      exactText[publishId] = text;
    }
  }
  return {
    requiredPhrases: normalizePhraseMap(value.requiredPhrases, `${label}.requiredPhrases`),
    prohibitedPhrases: normalizePhraseMap(value.prohibitedPhrases, `${label}.prohibitedPhrases`),
    exactText,
  };
}

function mergeAssertions(sets: Data[]): Data {
  const merged: Data = { requiredPhrases: {}, prohibitedPhrases: {}, exactText: {} };
  for (const assertions of sets) {
    for (const field of ["requiredPhrases", "prohibitedPhrases"]) {
      for (const [publishId, phrases] of Object.entries(assertions[field])) {
        merged[field][publishId] = [...new Set([...(merged[field][publishId] ?? []), ...(phrases as string[])])];
      }
    }
    for (const [publishId, text] of Object.entries(assertions.exactText)) {
      if (merged.exactText[publishId] !== undefined && merged.exactText[publishId] !== text) fail(`Conflicting exactText assertions exist for ${publishId}.`);
      merged.exactText[publishId] = text;
    }
  }
  return merged;
}

function validateAssertions(assertions: Data, copy: Data): void {
  const known = new Set(Object.keys(copy));
  for (const field of ["requiredPhrases", "prohibitedPhrases", "exactText"]) {
    for (const publishId of Object.keys(assertions[field])) if (!known.has(publishId)) fail(`hostAssertions.${field} references unknown output ${publishId}.`);
  }
  for (const [publishId, phrases] of Object.entries(assertions.requiredPhrases)) for (const phrase of phrases as string[]) if (!copy[publishId].text.includes(phrase)) fail(`${publishId} lacks required phrase ${JSON.stringify(phrase)}.`);
  for (const [publishId, phrases] of Object.entries(assertions.prohibitedPhrases)) for (const phrase of phrases as string[]) if (copy[publishId].text.includes(phrase)) fail(`${publishId} contains prohibited phrase ${JSON.stringify(phrase)}.`);
  for (const [publishId, text] of Object.entries(assertions.exactText)) if (copy[publishId].text !== text) fail(`${publishId} differs from its exactText assertion.`);
}

function assertionSummary(assertions: Data): Data {
  const publishIds = new Set([...Object.keys(assertions.requiredPhrases), ...Object.keys(assertions.prohibitedPhrases), ...Object.keys(assertions.exactText)]);
  return {
    sha256: sha256(stableStringify(assertions)),
    publishIds: [...publishIds].sort((left, right) => left.localeCompare(right, "en")),
    requiredPhraseCount: Object.values(assertions.requiredPhrases).reduce((count: number, entries: any) => count + entries.length, 0),
    prohibitedPhraseCount: Object.values(assertions.prohibitedPhrases).reduce((count: number, entries: any) => count + entries.length, 0),
    exactTextCount: Object.keys(assertions.exactText).length,
  };
}

function requiredAtoms(record: Data, target: Data): Data[] {
  if (!isObject(record.contract) || !Array.isArray(record.contract.atoms)) fail(`Request ${record.id} has no semantic atoms.`);
  return record.contract.atoms.filter((atom: unknown) => isObject(atom) && Array.isArray(atom.requiredIn)
    && atom.requiredIn.includes(target.layer) && atom.delivery?.[target.layer] !== "optional");
}

function normalizeComparable(value: unknown): string {
  return normalizeText(String(value), "Comparable text").toLocaleLowerCase("en-US").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function tokenize(value: string): string[] {
  return normalizeText(value, "Candidate text").toLocaleLowerCase("en-US").match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? [];
}

function splitSentences(value: string): string[] {
  return normalizeText(value, "Candidate text").split(/(?<=[.!?…])\s+(?=["“'‘([]*[A-Z0-9])/u).map((entry) => entry.trim()).filter(Boolean);
}

function requiresControlledLiteral(atom: Data): boolean {
  return ["safety", "operative"].includes(atom.criticality)
    || ["condition", "timing", "prohibition", "uncertainty", "recovery"].includes(atom.kind)
    || atom.frame?.polarity === "negative"
    || ["must", "must-not", "might"].includes(atom.frame?.modality)
    || atom.frame?.value !== undefined
    || atom.frame?.unit !== undefined;
}

function atomCoverage(atom: Data, text: string): boolean {
  const comparable = normalizeComparable(text);
  const includes = (value: unknown): boolean => ` ${comparable} `.includes(` ${normalizeComparable(value)} `);
  if (atom.literalForm && requiresControlledLiteral(atom)) return includes(atom.literalForm);
  const match = isObject(atom.match) ? atom.match : {};
  if ((match.allOf ?? []).some((value: unknown) => !includes(value))) return false;
  if ((match.anyOf ?? []).length && !(match.anyOf ?? []).some((value: unknown) => includes(value))) return false;
  if ((match.noneOf ?? []).some((value: unknown) => includes(value))) return false;
  if ((match.allOf ?? []).length || (match.anyOf ?? []).length) {
    const declaredNegation = [...(match.allOf ?? []), ...(match.anyOf ?? [])].some((value: unknown) => /\b(?:not|no|never|without|cannot|can't|won't|isn't|doesn't|don't)\b/iu.test(String(value)));
    if (atom.frame?.polarity === "positive" && !declaredNegation) {
      const phrases = [...(match.allOf ?? []), ...(match.anyOf ?? [])].map(normalizeComparable).filter(Boolean);
      const relevant = splitSentences(text).filter((sentence) => phrases.some((phrase: string) => normalizeComparable(sentence).includes(phrase)));
      const negations = new Set(["not", "no", "never", "without", "cannot", "can't", "won't", "isn't", "doesn't", "don't"]);
      if (relevant.some((sentence) => tokenize(sentence).some((token) => negations.has(token)))) return false;
    }
    return true;
  }
  const protectedValues = (atom.protectedFields ?? []).map((field: string) => field === "conditions"
    ? (atom.frame?.conditionIds ?? []).join(" ")
    : atom.frame?.[field]).filter((value: unknown) => value !== undefined && value !== "");
  if (protectedValues.length) return protectedValues.every(includes);
  return [atom.frame?.subject, atom.frame?.predicate].every(includes);
}

function validateContractAndCandidates(record: Data, targets: Data[]): void {
  if (!isObject(record.contract) || !Array.isArray(record.contract.atoms) || !record.contract.atoms.length) fail(`Request ${record.id} has no meaning contract.`);
  identifier(record.contract.id, `Request ${record.id} contract ID`);
  if (typeof record.contract.revision !== "string" || !/^[0-9A-Za-z][0-9A-Za-z._+-]*$/u.test(record.contract.revision)) fail(`Request ${record.id} contract revision is invalid.`);
  const atomIds = new Set<string>();
  for (const [index, atom] of record.contract.atoms.entries()) {
    if (!isObject(atom) || !isObject(atom.frame)) fail(`Request ${record.id} atom ${index} is invalid.`);
    const atomId = identifier(atom.id, `Request ${record.id} atom ${index} ID`);
    if (atomIds.has(atomId)) fail(`Request ${record.id} duplicates atom ${atomId}.`);
    atomIds.add(atomId);
    if (!Array.isArray(atom.requiredIn) || atom.requiredIn.some((layer) => !layers.includes(layer))) fail(`Atom ${atomId} has invalid required layers.`);
    if (!isObject(atom.delivery) || Object.keys(atom.delivery).some((layer) => !layers.includes(layer))) fail(`Atom ${atomId} has invalid delivery metadata.`);
    if (!Array.isArray(atom.prohibitedDependencies)) fail(`Atom ${atomId} has invalid prohibited dependencies.`);
  }
  const targetKeys = new Set(targets.map((target) => target.key));
  const candidateIds = new Set<string>();
  for (const [index, candidate] of (record.candidates ?? []).entries()) {
    if (!isObject(candidate)) fail(`Request ${record.id} candidate ${index} is invalid.`);
    const candidateId = identifier(candidate.id, `Request ${record.id} candidate ${index} ID`);
    if (candidateIds.has(candidateId)) fail(`Request ${record.id} duplicates candidate ${candidateId}.`);
    candidateIds.add(candidateId);
    if (!targetKeys.has(`${candidate.layer}:${candidate.representation}`)) fail(`Candidate ${candidateId} targets an undeclared output.`);
    if (typeof candidate.text !== "string" || !candidate.text.trim() || candidate.text !== normalizeText(candidate.text, `Candidate ${candidateId} text`).trim()) fail(`Candidate ${candidateId} text is not normalized.`);
    if (!Array.isArray(candidate.atomIds) || new Set(candidate.atomIds).size !== candidate.atomIds.length
      || candidate.atomIds.some((atomId: unknown) => typeof atomId !== "string" || !atomIds.has(atomId))) fail(`Candidate ${candidateId} has an invalid atom map.`);
  }
}

function literalizedText(record: Data, target: Data): string {
  return requiredAtoms(record, target).map((atom) => {
    if (typeof atom.literalForm === "string" && atom.literalForm) return atom.literalForm;
    const frame = atom.frame;
    if (!isObject(frame)) fail(`Atom ${String(atom.id)} has no frame.`);
    const modality = frame.modality === "is" ? undefined : frame.modality;
    const pieces = [frame.subject, modality, frame.predicate, frame.object, frame.value, frame.unit].filter((value) => value !== undefined && value !== "");
    const last = String(pieces.at(-1));
    return `${pieces.join(" ")}${/[.!?]$/u.test(last) ? "" : "."}`;
  }).join(" ");
}

function validateCountMap(value: unknown, label: string): number {
  if (!isObject(value)) fail(`${label} must be a count map.`);
  let total = 0;
  for (const [key, count] of Object.entries(value)) {
    if (!identifierPattern.test(key) || !Number.isInteger(count) || count < 0) fail(`${label}.${key} is invalid.`);
    total += count;
  }
  return total;
}

function validateFindingSummary(record: Data, label: string): void {
  if (!Number.isInteger(record.findingCount) || record.findingCount < 0) fail(`${label}.findingCount is invalid.`);
  if (!isObject(record.statusCounts) || Object.keys(record.statusCounts).some((status) => !findingStatuses.has(status))) fail(`${label}.statusCounts is invalid.`);
  if (validateCountMap(record.statusCounts, `${label}.statusCounts`) !== record.findingCount) fail(`${label}.statusCounts does not total findingCount.`);
  if (validateCountMap(record.codeCounts, `${label}.codeCounts`) !== record.findingCount) fail(`${label}.codeCounts does not total findingCount.`);
}

function aggregateConformance(outputs: Data[]): string {
  return outputs.reduce((lowest, output) => conformanceRank[output.conformance] < conformanceRank[lowest] ? output.conformance : lowest, "full");
}

function normalizeEngineContract(source: Data): Data {
  const contract = structuredClone(source);
  for (const atom of contract.atoms ?? []) {
    for (const field of ["subject", "predicate"]) atom.frame[field] = normalizeText(atom.frame[field], `Atom ${atom.id} frame.${field}`).trim();
    for (const field of ["object", "unit"]) if (atom.frame[field] !== undefined) atom.frame[field] = normalizeText(atom.frame[field], `Atom ${atom.id} frame.${field}`).trim();
    atom.requiredIn ??= [];
    atom.delivery ??= {};
    atom.protectedFields ??= [];
    atom.prohibitedDependencies ??= [];
    if (atom.literalForm !== undefined) atom.literalForm = normalizeText(atom.literalForm, `Atom ${atom.id} literalForm`).trim();
    if (isObject(atom.match)) for (const field of ["allOf", "anyOf", "noneOf"]) if (Array.isArray(atom.match[field])) atom.match[field] = atom.match[field].map((entry: unknown) => normalizeText(entry, `Atom ${atom.id} match.${field}`).trim());
  }
  contract.relations ??= [];
  contract.prohibitedClaims ??= [];
  for (const claim of contract.prohibitedClaims) claim.literalForm = normalizeText(claim.literalForm, "Prohibited claim literalForm").trim();
  contract.terminology ??= {};
  return contract;
}

function normalizeEngineContext(source: Data): Data {
  const context = structuredClone(source);
  context.locale = normalizeText(context.locale, "Context locale").trim();
  context.audience.knowledgeTags = context.audience.knowledgeTags.map((entry: unknown) => normalizeText(entry, "Audience knowledge tags").trim());
  if (isObject(context.focalizer)) {
    context.focalizer.expertiseTags = (context.focalizer.expertiseTags ?? []).map((entry: unknown) => normalizeText(entry, "Focalizer expertise tags").trim());
    context.focalizer.knowledgeTags = (context.focalizer.knowledgeTags ?? []).map((entry: unknown) => normalizeText(entry, "Focalizer knowledge tags").trim());
  }
  context.limits ??= {};
  return context;
}

function normalizeEngineOutputs(targets: Data[], context: Data): Data[] {
  const values = targets.map(({ layer, representation }) => ({ layer, representation }));
  for (const output of [...values]) if (output.representation === "accessibility-equivalent") values.push({ layer: output.layer, representation: "standard" });
  if (context.stakes === "safety-critical" || context.safetyClass === "critical") {
    values.push({ layer: "operative", representation: "standard" }, { layer: "operative", representation: "accessibility-equivalent" });
  }
  const unique = new Map<string, Data>();
  for (const value of values) unique.set(`${value.layer}:${value.representation}`, value);
  return [...unique.values()].sort((left, right) => layers.indexOf(left.layer) - layers.indexOf(right.layer)
    || representations.indexOf(left.representation) - representations.indexOf(right.representation));
}

function normalizeCandidateMetadata(source: unknown): Data {
  const value = structuredClone(isObject(source) ? source : {});
  for (const field of ["dependencies", "stateChanges", "speakers", "affectedParties", "sensoryAnchors", "narrativeLayers"]) {
    if (Array.isArray(value[field])) value[field] = value[field].map((entry: unknown) => normalizeText(entry, `Candidate metadata.${field}`).trim());
  }
  if (isObject(value.speakerObjectives)) for (const [speaker, objective] of Object.entries(value.speakerObjectives)) value.speakerObjectives[speaker] = normalizeText(objective, `Candidate speaker objective ${speaker}`).trim();
  if (Array.isArray(value.claims)) for (const claim of value.claims) if (Array.isArray(claim.evidenceRefs)) claim.evidenceRefs = claim.evidenceRefs.map((entry: unknown) => normalizeText(entry, "Candidate claim evidence reference").trim());
  return value;
}

function normalizeEngineCandidates(value: unknown): Data[] {
  const candidates = Array.isArray(value) ? value : [];
  return candidates.map((source) => ({
    id: source.id,
    layer: source.layer,
    representation: source.representation,
    text: normalizeText(source.text, `Candidate ${String(source.id)} text`).trim(),
    atomIds: [...source.atomIds],
    metadata: normalizeCandidateMetadata(source.metadata),
    source: { kind: "provided" },
  })).sort((left, right) => engineDigest(left).localeCompare(engineDigest(right)) || left.id.localeCompare(right.id));
}

function expectedInputDigest(record: Data, targets: Data[]): string {
  const contract = normalizeEngineContract(record.contract);
  const context = normalizeEngineContext(record.context);
  const outputs = normalizeEngineOutputs(targets, context);
  const normalized = {
    id: record.id,
    contract,
    context,
    outputs,
    profileIds: [PIN.profileId],
    candidates: normalizeEngineCandidates(record.candidates),
  };
  return engineDigest(normalized);
}

function validateAcademyLint(value: unknown, corpus: Data): Data {
  exactFields(value, ["status", "advisoryOnly", "semanticGuarantee", "corpusSha256", "sourceSha256", "entryCount", "batchCount", "findingCount", "unresolvedFindingCount", "statusCounts", "codeCounts", "batches"], "academyLint");
  if (value.status !== "advisory" || value.advisoryOnly !== true || value.semanticGuarantee !== false) fail("academyLint overstates assurance.");
  if (value.corpusSha256 !== corpus.corpusSha256 || value.sourceSha256 !== corpus.source.sha256 || value.entryCount !== 1_011 || value.batchCount !== 2) fail("academyLint corpus identity is stale.");
  validateFindingSummary(value, "academyLint");
  if (!Number.isInteger(value.unresolvedFindingCount) || value.unresolvedFindingCount !== (value.statusCounts.fail ?? 0) + (value.statusCounts.warn ?? 0) + (value.statusCounts.unknown ?? 0)) fail("academyLint unresolved finding count is invalid.");
  if (!Array.isArray(value.batches) || value.batches.length !== 2) fail("academyLint must contain exactly two batches.");
  const expectedBatches = academyBatches(corpus.entries);
  let batchFindingCount = 0;
  const statusTotals: Data = {};
  const codeTotals: Data = {};
  for (const [index, batch] of value.batches.entries()) {
    exactFields(batch, ["id", "entryIds", "entryCount", "textSha256", "findingCount", "statusCounts", "codeCounts"], `academyLint.batches[${index}]`);
    for (const field of ["id", "entryIds", "entryCount", "textSha256"]) assertSame(expectedBatches[index][field], batch[field], `academyLint.batches[${index}].${field}`);
    validateFindingSummary(batch, `academyLint.batches[${index}]`);
    batchFindingCount += batch.findingCount;
    for (const [key, count] of Object.entries(batch.statusCounts)) statusTotals[key] = (statusTotals[key] ?? 0) + count;
    for (const [key, count] of Object.entries(batch.codeCounts)) codeTotals[key] = (codeTotals[key] ?? 0) + count;
  }
  if (batchFindingCount !== value.findingCount) fail("academyLint batch finding counts do not equal the aggregate.");
  assertSame(value.statusCounts, Object.fromEntries(Object.entries(statusTotals).sort(([left], [right]) => left.localeCompare(right, "en"))), "academyLint status aggregation");
  assertSame(value.codeCounts, Object.fromEntries(Object.entries(codeTotals).sort(([left], [right]) => left.localeCompare(right, "en"))), "academyLint code aggregation");
  return value;
}

async function walkProductionSources(repositoryRoot: string, relativeDirectory: string): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(path.join(repositoryRoot, relativeDirectory), { withFileTypes: true })) {
    const relativePath = path.posix.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      if (relativePath !== "app/generated") result.push(...await walkProductionSources(repositoryRoot, relativePath));
    } else if (/\.(?:ts|tsx|js|jsx)$/u.test(entry.name)) result.push(relativePath);
  }
  return result;
}

async function validateBrowserBoundary(repositoryRoot: string, runtime: Data): Promise<void> {
  exactFields(runtime, ["schemaVersion", "snapshotId", "copySha256", "copy"], PATHS.runtime);
  if (!isObject(runtime.copy) || Object.values(runtime.copy).some((value) => typeof value !== "string")) fail("Runtime copy must be a text-only map.");
  const forbidden = [/@howardhayden\/lattice-register-engine/u, /scripts\/compile-lattice-copy/u, /authoring\/lattice-copy/u, /evidence\/lattice\/current/u, /generated\/lattice-copy\.json(?!\.runtime)/u];
  for (const relativePath of await walkProductionSources(repositoryRoot, "app")) {
    const source = await readFile(path.join(repositoryRoot, relativePath), "utf8");
    for (const pattern of forbidden) if (pattern.test(source)) fail(`${relativePath} crosses the owner-only Lattice browser boundary.`);
  }
}

export async function verifyLatticeCopy(repositoryRoot = DEFAULT_REPOSITORY_ROOT): Promise<Data> {
  const root = await realpath(repositoryRoot);
  await validateLatticeSchemas(root);
  validateDeclaredOwnerPackage();
  const implementationAuthority = await createImplementationAuthority(root);
  const [requestArtifact, generatedArtifact, runtimeArtifact, evidenceArtifact, indexArtifact] = await Promise.all([
    readJson(root, PATHS.request, false),
    readJson(root, PATHS.generated, true),
    readJson(root, PATHS.runtime, true),
    readJson(root, PATHS.evidence, true),
    readJson(root, PATHS.index, true),
  ]);
  const request = requestArtifact.document;
  const generated = generatedArtifact.document;
  const runtime = runtimeArtifact.document;
  const evidence = evidenceArtifact.document;
  const index = indexArtifact.document;

  const requiredRequestFields = ["schemaVersion", "revision", "lattice", "provenance", "sourceCatalog", "requests"];
  const allowedRequestFields = new Set([...requiredRequestFields, "hostAssertions"]);
  const missingRequestFields = requiredRequestFields.filter((field) => !Object.hasOwn(request, field));
  const unknownRequestFields = Object.keys(request).filter((field) => !allowedRequestFields.has(field));
  if (missingRequestFields.length || unknownRequestFields.length) fail("Authoring request fields do not match the v2 contract.", [...missingRequestFields, ...unknownRequestFields]);
  if (request.schemaVersion !== SCHEMAS.request || !Array.isArray(request.requests) || request.requests.length !== 19) fail("Authoring request schema or bounded request count is invalid.");
  if (typeof request.revision !== "string" || !request.revision || request.revision.length > 128
    || request.revision.trim() !== request.revision || request.revision.normalize("NFKC") !== request.revision) fail("Authoring revision is invalid.");
  assertSame(PIN, request.lattice, "Authoring Lattice pin");
  assertSame(PROVENANCE, request.provenance, "Authoring provenance pin");

  const sourceCatalog = await normalizeSourceCatalog(root, request.sourceCatalog);
  const authority = await loadRequirementAuthority(root);
  const corpus = await createAcademyCorpus(root);
  const assertions = [normalizeAssertions(request.hostAssertions, "hostAssertions")];
  const requestIds = new Set<string>();
  const publishIds = new Set<string>();
  const usedSourceRefs = new Set<string>();
  const usedInventoryIds = new Set<string>();
  const requestLinks = new Map<string, Data>();
  const reconstructedCopy: Data = {};
  const traceabilityRequests: Data[] = [];
  const reconstructedEvidenceRequests: Data[] = [];

  exactFields(generated, ["schemaVersion", "snapshotId", "staticOnly", "lattice", "implementationAuthority", "source", "boundary", "assurance", "hostAssertions", "traceabilitySha256", "traceability", "realizationSha256", "copySha256", "copy"], PATHS.generated);
  exactFields(evidence, ["schemaVersion", "snapshotId", "lattice", "implementationAuthority", "source", "boundary", "assurance", "hostAssertions", "traceabilitySha256", "traceability", "realizationSha256", "copySha256", "generatedFile", "runtimeFile", "academyCorpus", "academyLint", "requests"], PATHS.evidence);
  if (generated.schemaVersion !== SCHEMAS.generated || evidence.schemaVersion !== SCHEMAS.evidence || runtime.schemaVersion !== SCHEMAS.runtime || index.schemaVersion !== SCHEMAS.index) fail("A Lattice artifact schema version is unsupported.");
  if (!isObject(generated.copy) || !Array.isArray(evidence.requests)) fail("Generated copy or request evidence is invalid.");

  const evidenceByRequest = new Map<string, Data>();
  for (const entry of evidence.requests) {
    if (!isObject(entry)) fail("Evidence request records must be objects.");
    const id = identifier(entry.requestId, "Evidence request ID");
    if (evidenceByRequest.has(id)) fail(`Duplicate evidence request ${id}.`);
    evidenceByRequest.set(id, entry);
  }

  const records = request.requests.map((record: unknown, index: number) => {
    if (!isObject(record)) fail(`requests[${index}] must be an object.`);
    return record;
  }).sort((left: Data, right: Data) => String(left.id).localeCompare(String(right.id), "en"));

  for (const record of records) {
    exactFields(record, ["id", "source", "traceability", "context", "outputs", "contract", "profileIds", "candidates", "hostAssertions", "review"], `Request ${String(record.id)}`);
    const requestId = identifier(record.id, "Request ID");
    if (requestIds.has(requestId)) fail(`Duplicate request ID ${requestId}.`);
    requestIds.add(requestId);
    const targets = outputTargets(record);
    if (!isObject(record.context)) fail(`Request ${requestId} context must be an object.`);
    validateContractAndCandidates(record, targets);
    const normalizedOutputs = normalizeEngineOutputs(targets, normalizeEngineContext(record.context));
    const targetKeys = new Set(targets.map((target) => target.key));
    if (normalizedOutputs.length !== targets.length
      || normalizedOutputs.some((output) => !targetKeys.has(`${output.layer}:${output.representation}`))) {
      fail(`Request ${requestId} relies on undeclared normalized output routes.`);
    }
    const publishedAt = await publicationPaths(root, record.source, requestId);
    const traceability = traceRequest(record, targets, sourceCatalog, authority, publishedAt);
    verifyCandidateEvidenceRefs(record, traceability);
    const review = normalizeReview(record.review, requestId);
    traceability.sourceRefs.forEach((sourceRef: string) => usedSourceRefs.add(sourceRef));
    traceability.inventoryIds.forEach((inventoryId: string) => usedInventoryIds.add(inventoryId));
    traceabilityRequests.push({ requestId, ...traceability, review });
    requestLinks.set(requestId, { requestId, context: record.context, targets, ...traceability });
    assertions.push(normalizeAssertions(record.hostAssertions, `Request ${requestId} hostAssertions`));
    if (record.profileIds !== undefined) assertSame([PIN.profileId], record.profileIds, `Request ${requestId} profileIds`);
    const evidenceRequest = evidenceByRequest.get(requestId);
    if (!evidenceRequest) fail(`Evidence omits request ${requestId}.`);
    exactFields(evidenceRequest, ["requestId", "traceability", "review", "conformance", "inputDigest", "derivationDigest", "outputs"], `Evidence request ${requestId}`);
    assertSame(traceability, evidenceRequest.traceability, `Evidence request ${requestId} traceability`);
    assertSame(review, evidenceRequest.review, `Evidence request ${requestId} review`);
    if (evidenceRequest.inputDigest !== expectedInputDigest(record, targets)) fail(`Evidence request ${requestId} inputDigest does not bind the normalized owner request.`);
    // Receipts are intentionally absent from the host artifact. This is an
    // opaque owner observation: validate its shape and bind it into the
    // realization/snapshot identities, without claiming authentication or
    // pretending its omitted body can be reconstructed here.
    digest(evidenceRequest.derivationDigest, `Evidence request ${requestId} derivationDigest`);
    if (!Array.isArray(evidenceRequest.outputs) || evidenceRequest.outputs.length !== targets.length) fail(`Evidence request ${requestId} output count is invalid.`);
    const evidenceOutputs = new Map(evidenceRequest.outputs.map((entry: unknown) => {
      if (!isObject(entry)) fail(`Evidence request ${requestId} has an invalid output record.`);
      return [identifier(entry.publishId, `Evidence request ${requestId} publishId`), entry];
    }));
    if (evidenceOutputs.size !== evidenceRequest.outputs.length) fail(`Evidence request ${requestId} duplicates an output record.`);
    const requestOutputRecords: Data[] = [];
    for (const target of targets) {
      if (publishIds.has(target.publishId)) fail(`Duplicate publishId ${target.publishId}.`);
      publishIds.add(target.publishId);
      const atomRecords = requiredAtoms(record, target);
      if (!atomRecords.length) fail(`Output ${target.publishId} has no required atoms.`);
      const missingProtection = atomRecords.filter((atom) => !Array.isArray(atom.prohibitedDependencies) || !atom.prohibitedDependencies.includes("timing-perception"));
      if (missingProtection.length) fail(`Output ${target.publishId} has required atoms without timing-perception protection.`);
      const output = generated.copy[target.publishId];
      if (!isObject(output)) fail(`Generated copy omits ${target.publishId}.`);
      exactFields(output, ["text", "textSha256", "layer", "representation", "conformance", "requestId", "candidateId", "source"], `Generated output ${target.publishId}`);
      if (typeof output.text !== "string" || output.requestId !== requestId || output.layer !== target.layer || output.representation !== target.representation) fail(`Generated output ${target.publishId} identity is invalid.`);
      if (!["provided", "literal"].includes(output.source) || !["degraded", "literal"].includes(output.conformance) || ((output.source === "literal") !== (output.conformance === "literal"))) fail(`Generated output ${target.publishId} source/conformance is invalid.`);
      if (output.textSha256 !== sha256(output.text)) fail(`Generated output ${target.publishId} text digest is stale.`);
      let mappedIds: string[];
      if (output.source === "provided") {
        const candidate = Array.isArray(record.candidates) ? record.candidates.find((entry: unknown) => isObject(entry) && entry.id === output.candidateId && entry.layer === target.layer && entry.representation === target.representation) : undefined;
        if (!isObject(candidate) || candidate.text !== output.text) fail(`Generated output ${target.publishId} differs from its selected provided candidate.`);
        if (target.representation === "accessibility-equivalent" && Array.isArray(candidate.metadata?.dependencies) && candidate.metadata.dependencies.includes("timing-perception")) fail(`Accessibility output ${target.publishId} depends on timing perception.`);
        if (!Array.isArray(candidate.atomIds)) fail(`Candidate ${String(output.candidateId)} has no atom map.`);
        mappedIds = [...candidate.atomIds];
      } else {
        if (output.candidateId !== `literal-${target.layer}-${target.representation}` || output.text !== literalizedText(record, target)) fail(`Generated literal ${target.publishId} differs from contract literalization.`);
        mappedIds = atomRecords.map((atom) => atom.id);
      }
      if (target.layer === "operative") {
        const missingLiteral = atomRecords.filter((atom) => typeof atom.literalForm !== "string" || !atom.literalForm.trim());
        if (missingLiteral.length || output.text !== atomRecords.map((atom) => atom.literalForm).join(" ").trim()) fail(`Operative output ${target.publishId} differs from controlled literals.`);
      }
      const knownAtomIds = new Set(record.contract.atoms.map((atom: Data) => atom.id));
      if (new Set(mappedIds).size !== mappedIds.length || mappedIds.some((id) => !knownAtomIds.has(id))) fail(`Output ${target.publishId} has an invalid selected atom map.`);
      const requiredIds = atomRecords.map((atom) => identifier(atom.id, `${target.publishId} atom ID`));
      const mapped = new Set(mappedIds);
      const coveredIds = atomRecords.filter((atom) => mapped.has(atom.id) && atomCoverage(atom, output.text)).map((atom) => atom.id);
      const mappedRequiredIds = requiredIds.filter((id) => mapped.has(id));
      if (stableStringify(coveredIds) !== stableStringify(mappedRequiredIds)) fail(`Output ${target.publishId} maps a required atom that its text does not cover.`);
      const coverageRatio = requiredIds.length ? coveredIds.length / requiredIds.length : 1;
      const evidenceOutput = evidenceOutputs.get(target.publishId);
      if (!isObject(evidenceOutput)) fail(`Evidence omits output ${target.publishId}.`);
      exactFields(evidenceOutput, ["publishId", "key", "candidateId", "source", "conformance", "textSha256", "requiredAtomCount", "coveredAtomCount", "requiredAtomIdsSha256", "coverageRatio", "findingCount", "statusCounts", "codeCounts"], `Evidence output ${target.publishId}`);
      const derived = {
        publishId: target.publishId,
        key: target.key,
        candidateId: output.candidateId,
        source: output.source,
        conformance: output.conformance,
        textSha256: output.textSha256,
        requiredAtomCount: requiredIds.length,
        coveredAtomCount: coveredIds.length,
        requiredAtomIdsSha256: sha256(stableStringify(requiredIds)),
        coverageRatio,
      };
      for (const [key, value] of Object.entries(derived)) assertSame(value, evidenceOutput[key], `Evidence output ${target.publishId}.${key}`);
      validateFindingSummary(evidenceOutput, `Evidence output ${target.publishId}`);
      reconstructedCopy[target.publishId] = { ...output };
      requestOutputRecords.push({ ...derived, findingCount: evidenceOutput.findingCount, statusCounts: evidenceOutput.statusCounts, codeCounts: evidenceOutput.codeCounts });
    }
    const requestConformance = aggregateConformance(requestOutputRecords);
    if (evidenceRequest.conformance !== requestConformance) fail(`Evidence request ${requestId} conformance is invalid.`);
    reconstructedEvidenceRequests.push({
      requestId,
      traceability,
      review,
      conformance: requestConformance,
      inputDigest: evidenceRequest.inputDigest,
      derivationDigest: evidenceRequest.derivationDigest,
      outputs: requestOutputRecords.sort((left, right) => left.publishId.localeCompare(right.publishId, "en")),
    });
  }

  validateBidirectionalInventory(authority, requestLinks);

  const observedRequestIds = [...requestIds].sort((left, right) => left.localeCompare(right, "en"));
  const observedPublishIds = [...publishIds].sort((left, right) => left.localeCompare(right, "en"));
  if (evidenceByRequest.size !== records.length || Object.keys(generated.copy).length !== EXPECTED_PUBLISH_IDS.length
    || stableStringify(observedRequestIds) !== stableStringify(EXPECTED_REQUEST_IDS)
    || stableStringify(observedPublishIds) !== stableStringify(EXPECTED_PUBLISH_IDS)) {
    fail("The bounded adoption slice has a substituted request or output identity set.");
  }
  const unusedSourceRefs = sourceCatalog.records.map((record) => record.id).filter((id) => !usedSourceRefs.has(id));
  if (unusedSourceRefs.length) fail("sourceCatalog contains unused declarations.", unusedSourceRefs);
  const unusedAdoptedInventory = [...authority.inventoryIds]
    .filter((id) => !authority.exemptInventoryIds.has(id) && !usedInventoryIds.has(id));
  if (unusedAdoptedInventory.length) fail("The authoring contract leaves adopted inventory routes unused.", unusedAdoptedInventory);
  const sortedCopy = Object.fromEntries(Object.entries(reconstructedCopy).sort(([left], [right]) => left.localeCompare(right, "en")));
  assertSame(sortedCopy, generated.copy, "Generated copy map");
  const mergedAssertions = mergeAssertions(assertions);
  validateAssertions(mergedAssertions, sortedCopy);
  const hostAssertions = assertionSummary(mergedAssertions);
  const traceability = {
    authorityFiles: authority.authorityFiles,
    sourceCatalog: sourceCatalog.records,
    requests: traceabilityRequests.sort((left, right) => left.requestId.localeCompare(right.requestId, "en")),
  };
  const traceabilitySha256 = sha256(stableStringify(traceability));
  const runtimeCopy = Object.fromEntries(Object.entries(sortedCopy).map(([publishId, output]) => [publishId, (output as Data).text]));
  const copySha256 = sha256(stableStringify(runtimeCopy));
  const evidenceRequests = reconstructedEvidenceRequests.sort((left, right) => left.requestId.localeCompare(right.requestId, "en"));
  const realizationSha256 = sha256(stableStringify(evidenceRequests));
  const academyLint = validateAcademyLint(evidence.academyLint, corpus);
  const academyLintSha256 = sha256(stableStringify(academyLint));
  const conformance = aggregateConformance(Object.values(sortedCopy));
  const outputHashes = Object.fromEntries(Object.entries(sortedCopy).map(([publishId, output]) => [publishId, (output as Data).textSha256]));
  const snapshotSeed = {
    lattice: PIN,
    implementationAuthoritySha256: implementationAuthority.sha256,
    requestSha256: requestArtifact.sha256,
    academySourceSha256: corpus.source.sha256,
    academyCorpusSha256: corpus.corpusSha256,
    academyLintSha256,
    traceabilitySha256,
    realizationSha256,
    copySha256,
    conformance,
    outputHashes,
  };
  const snapshotId = `lattice-copy-${sha256(stableStringify(snapshotSeed)).slice(0, 24)}`;
  const source = {
    requestPath: PATHS.request,
    requestSha256: requestArtifact.sha256,
    academySourcePath: corpus.source.path,
    academySourceSha256: corpus.source.sha256,
    academyCorpusSha256: corpus.corpusSha256,
    academyLintSha256,
    provenance: PROVENANCE,
  };
  const generatedAssurance = {
    conformance,
    conformanceCeiling: "degraded",
    academyLintStatus: "advisory",
    humanReviewStatus: "not-claimed",
    semanticScope: "declared-contract-and-registered-claims",
    sourceTruthEstablished: false,
  };
  const evidenceAssurance = {
    deterministic: true,
    networkIndependentAtRealization: true,
    authenticated: false,
    externallyAnchored: false,
    trustScope: "reproducibility-and-conformance-only",
    conformance,
    conformanceCeiling: "degraded",
    humanReviewStatus: "not-claimed",
  };
  for (const artifact of [generated, evidence]) {
    assertSame(snapshotId, artifact.snapshotId, "Snapshot identity");
    assertSame(PIN, artifact.lattice, "Artifact Lattice pin");
    assertSame(implementationAuthority, artifact.implementationAuthority, "Artifact implementation authority");
    assertSame(source, artifact.source, "Artifact source identity");
    assertSame(BOUNDARY, artifact.boundary, "Artifact owner/browser boundary");
    assertSame(hostAssertions, artifact.hostAssertions, "Artifact host assertions");
    assertSame(traceability, artifact.traceability, "Artifact traceability");
    assertSame(traceabilitySha256, artifact.traceabilitySha256, "Artifact traceability digest");
    assertSame(realizationSha256, artifact.realizationSha256, "Artifact realization digest");
    assertSame(copySha256, artifact.copySha256, "Artifact copy digest");
  }
  if (generated.staticOnly !== true) fail("Generated owner output must be static-only.");
  assertSame(generatedAssurance, generated.assurance, "Generated assurance");
  assertSame(evidenceAssurance, evidence.assurance, "Evidence assurance");
  assertSame(evidenceRequests, evidence.requests, "Evidence request reconstruction");
  assertSame({ schemaVersion: corpus.schemaVersion, entryCount: corpus.entryCount, characterCount: corpus.characterCount, roles: corpus.roles, sections: corpus.sections, sha256: corpus.corpusSha256 }, evidence.academyCorpus, "Academy corpus evidence");

  await validateBrowserBoundary(root, runtime);
  assertSame(snapshotId, runtime.snapshotId, "Runtime snapshot identity");
  assertSame(copySha256, runtime.copySha256, "Runtime copy digest");
  assertSame(runtimeCopy, runtime.copy, "Runtime copy map");
  assertSame({ path: PATHS.generated, sha256: generatedArtifact.sha256 }, evidence.generatedFile, "Evidence generated-file reference");
  assertSame({ path: PATHS.runtime, sha256: runtimeArtifact.sha256 }, evidence.runtimeFile, "Evidence runtime-file reference");

  exactFields(index, ["schemaVersion", "current", "entries"], PATHS.index);
  const expectedIndex = {
    schemaVersion: SCHEMAS.index,
    current: { snapshotId, path: PATHS.evidence, sha256: evidenceArtifact.sha256 },
    entries: [{
      snapshotId,
      evidencePath: PATHS.evidence,
      evidenceSha256: evidenceArtifact.sha256,
      generatedPath: PATHS.generated,
      generatedSha256: generatedArtifact.sha256,
      runtimePath: PATHS.runtime,
      runtimeSha256: runtimeArtifact.sha256,
      requestSha256: requestArtifact.sha256,
      academySourceSha256: corpus.source.sha256,
      academyCorpusSha256: corpus.corpusSha256,
      academyLintSha256,
      traceabilitySha256,
      realizationSha256,
      copySha256,
      conformance,
      humanReviewStatus: "not-claimed",
      engineVersion: PIN.engineVersion,
      profileVersion: PIN.profileVersion,
      profileDigest: PIN.profileDigest,
      implementationAuthority,
    }],
  };
  assertSame(expectedIndex, index, "Evidence index");

  return { snapshotId, requestCount: records.length, outputCount: publishIds.size, academyEntryCount: corpus.entryCount, academyBatchCount: 2 };
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  const result = await verifyLatticeCopy();
  console.log(`Verified ${result.outputCount} static Lattice copy outputs as ${result.snapshotId}; ${result.academyEntryCount} Academy entries are bound in ${result.academyBatchCount} advisory batches.`);
}
