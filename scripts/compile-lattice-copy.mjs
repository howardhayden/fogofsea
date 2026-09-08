import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, realpath, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

import ts from "typescript";

import {
  LATTICE_COPY_EVIDENCE_SCHEMA,
  LATTICE_COPY_GENERATED_SCHEMA,
  LATTICE_COPY_INDEX_SCHEMA,
  LATTICE_COPY_PATHS,
  LATTICE_COPY_PIN,
  LATTICE_COPY_PUBLISH_IDS,
  LATTICE_COPY_PROVENANCE,
  LATTICE_COPY_REQUEST_IDS,
  LATTICE_COPY_REQUEST_SCHEMA,
  LATTICE_COPY_RUNTIME_SCHEMA,
  LATTICE_COPY_SOURCE_IDS,
  LATTICE_IMPLEMENTATION_AUTHORITY_PATHS,
  LATTICE_OWNER_PACKAGE_MANIFEST,
  createAcademyCopyCorpus,
  createAcademyLintBatches,
  digestFiles,
  jsonFileText,
  sha256,
  stableStringify,
} from "./lattice-copy-corpus.mjs";
import {
  LATTICE_SCHEMA_DOCUMENTS,
  validateLatticeDocument,
} from "./validate-lattice-schemas.mjs";

const execFileAsync = promisify(execFile);
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const identifierPattern = /^[A-Za-z][A-Za-z0-9._:@-]*$/u;
const digestPattern = /^[a-f0-9]{64}$/u;
const symbolPattern = /^[A-Za-z_$][A-Za-z0-9_$]*$/u;
const semanticVersionPattern = /^[0-9]+\.[0-9]+\.[0-9]+$/u;
const provenanceIdPattern = /^PROV-[0-9]{3}$/u;
const requirementIdPattern = /^FOS-LAT-[A-Z]+-[0-9]{3}$/u;
const inventoryIdPattern = /^FOS-COPY-[A-Z]+-[0-9]{3}$/u;
const criterionIdPattern = /^FOS-LAT-[A-Z]+-[0-9]{3}-AC-[0-9]{2}$/u;
const testIdPattern = /^FOS-LAT-[A-Z]+-[0-9]{3}-T-[PNB][0-9]{2}$/u;
const layers = new Set(["operative", "experiential", "interpretive"]);
const representations = new Set(["standard", "accessibility-equivalent"]);
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
const findingStatuses = new Set(["pass", "warn", "fail", "unknown", "not-applicable"]);
const conformanceRank = Object.freeze({ literal: 0, degraded: 1, full: 2 });

function fail(message, details = []) {
  const suffix = details.length ? `\n${details.map((detail) => `- ${detail}`).join("\n")}` : "";
  throw new Error(`Lattice copy compilation failed: ${message}${suffix}`);
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactFields(value, expectedFields, label) {
  if (!isObject(value)) fail(`${label} must be an object.`);
  const expected = [...expectedFields].sort((left, right) => left.localeCompare(right, "en"));
  const observed = Object.keys(value).sort((left, right) => left.localeCompare(right, "en"));
  if (stableStringify(expected) !== stableStringify(observed)) {
    fail(`${label} fields do not match the closed contract.`, [
      `expected ${expected.join(", ")}`,
      `received ${observed.join(", ")}`,
    ]);
  }
}

function identifier(value, label) {
  if (typeof value !== "string" || value.length > 128 || !identifierPattern.test(value)) {
    fail(`${label} must be a stable ASCII identifier of at most 128 characters.`);
  }
  return value;
}

function digest(value, label) {
  if (typeof value !== "string" || !digestPattern.test(value)) fail(`${label} must be a lowercase SHA-256 digest.`);
  return value;
}

function metadataText(value, label, maximum = 1_000) {
  if (typeof value !== "string" || !value || value.length > maximum || value.trim() !== value || value.normalize("NFKC") !== value) {
    fail(`${label} must be non-empty, trimmed, NFKC text of at most ${maximum} characters.`);
  }
  return value;
}

function uniqueTextList(value, label, { minimum = 0, maximum = 256, pattern } = {}) {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
    fail(`${label} must contain between ${minimum} and ${maximum} entries.`);
  }
  const entries = value.map((entry, index) => {
    if (pattern) {
      if (typeof entry !== "string" || !pattern.test(entry)) fail(`${label}[${index}] is invalid.`);
      return entry;
    }
    return metadataText(entry, `${label}[${index}]`, 10_000);
  });
  if (new Set(entries).size !== entries.length) fail(`${label} contains duplicates.`);
  return entries;
}

function sameSet(left, right) {
  return stableStringify([...left].sort((a, b) => a.localeCompare(b, "en")))
    === stableStringify([...right].sort((a, b) => a.localeCompare(b, "en")));
}

function canonicalPath(value, label) {
  if (typeof value !== "string" || !value || value.includes("\\") || value.includes("\0") || path.posix.isAbsolute(value)) {
    fail(`${label} must be a canonical repository-relative POSIX path.`);
  }
  const normalized = path.posix.normalize(value);
  if (normalized !== value || normalized === "." || normalized === ".." || normalized.startsWith("../")) {
    fail(`${label} must not contain traversal or redundant segments.`);
  }
  return value;
}

function referenceList(value, label, pattern = identifierPattern) {
  if (!Array.isArray(value) || !value.length) fail(`${label} must be a non-empty identifier array.`);
  const entries = value.map((entry, index) => {
    if (typeof entry !== "string" || !pattern.test(entry)) fail(`${label}[${index}] is invalid.`);
    return entry;
  });
  if (new Set(entries).size !== entries.length) fail(`${label} contains duplicates.`);
  return [...entries].sort((left, right) => left.localeCompare(right, "en"));
}

function parseJson(text, relativePath) {
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(`${relativePath} is not valid JSON.`, [error instanceof Error ? error.message : String(error)]);
  }
}

async function readRequired(relativePath, instruction) {
  try {
    return await readFile(path.join(repositoryRoot, relativePath), "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") fail(`${relativePath} does not exist.`, [instruction]);
    fail(`Could not read ${relativePath}.`, [error instanceof Error ? error.message : String(error)]);
  }
}

const schemaEntriesByDocumentPath = new Map(
  LATTICE_SCHEMA_DOCUMENTS.map((entry) => [entry.documentPath, entry]),
);
const schemaDocuments = new Map();

async function validateAgainstRepositorySchema(documentPath, document) {
  const entry = schemaEntriesByDocumentPath.get(documentPath);
  if (!entry) fail(`No closed Lattice schema route exists for ${documentPath}.`);
  let schema = schemaDocuments.get(entry.schemaPath);
  if (!schema) {
    schema = parseJson(
      await readRequired(entry.schemaPath, `Restore the governed schema for ${documentPath}.`),
      entry.schemaPath,
    );
    schemaDocuments.set(entry.schemaPath, schema);
  }
  try {
    validateLatticeDocument({ ...entry, schema, document });
  } catch (error) {
    fail(`JSON Schema rejected ${documentPath}.`, [error instanceof Error ? error.message : String(error)]);
  }
}

async function containedRealPath(relativePath, label) {
  const root = await realpath(repositoryRoot);
  const resolved = await realpath(path.join(repositoryRoot, relativePath));
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) fail(`${label} resolves outside the repository.`);
  return resolved;
}

function topLevelDeclarations(source, relativePath) {
  const sourceFile = ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  if (sourceFile.parseDiagnostics.length) {
    fail(`${relativePath} has TypeScript parse diagnostics.`, sourceFile.parseDiagnostics.map((diagnostic) =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")));
  }
  const declarations = new Map();
  const add = (name, kind, exported) => {
    if (!ts.isIdentifier(name)) return;
    const records = declarations.get(name.text) ?? [];
    records.push({ kind, exported });
    declarations.set(name.text, records);
  };
  for (const statement of sourceFile.statements) {
    const exported = Boolean(ts.getModifiers(statement)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword));
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) add(declaration.name, "variable", exported);
    } else if (ts.isFunctionDeclaration(statement)) add(statement.name, "function", exported);
    else if (ts.isClassDeclaration(statement)) add(statement.name, "class", exported);
    else if (ts.isInterfaceDeclaration(statement)) add(statement.name, "interface", exported);
    else if (ts.isTypeAliasDeclaration(statement)) add(statement.name, "type-alias", exported);
    else if (ts.isEnumDeclaration(statement)) add(statement.name, "enum", exported);
    else if (ts.isModuleDeclaration(statement)) add(statement.name, "namespace", exported);
  }
  return declarations;
}

function publicationAnchorCount(source, relativePath, fragment) {
  const declarations = topLevelDeclarations(source, relativePath);
  let count = declarations.get(fragment)?.length ?? 0;
  const sourceFile = ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const visit = (node) => {
    if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && node.name.text === "id"
      && node.initializer && ts.isStringLiteral(node.initializer) && node.initializer.text === fragment) count += 1;
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return count;
}

async function normalizeSourceCatalog(value) {
  if (!Array.isArray(value) || !value.length) fail("sourceCatalog must be a non-empty array.");
  const ids = new Set();
  const locations = new Set();
  const records = [];
  for (const [index, raw] of value.entries()) {
    exactFields(raw, ["id", "path", "symbol", "kind", "exported", "sha256"], `sourceCatalog[${index}]`);
    const id = identifier(raw.id, `sourceCatalog[${index}].id`);
    const relativePath = canonicalPath(raw.path, `sourceCatalog[${index}].path`);
    const symbol = identifier(raw.symbol, `sourceCatalog[${index}].symbol`);
    if (!declarationKinds.has(raw.kind)) fail(`sourceCatalog ${id} has an unsupported declaration kind.`);
    if (typeof raw.exported !== "boolean") fail(`sourceCatalog ${id}.exported must be boolean.`);
    const expectedDigest = digest(raw.sha256, `sourceCatalog[${index}].sha256`);
    if (!/^app\/.+\.(?:ts|tsx)$/u.test(relativePath)
      || /^(?:app\/generated|authoring|dist|evidence|node_modules|requirements|scripts)\//u.test(relativePath)) {
      fail(`sourceCatalog ${id} must identify non-generated application TypeScript.`);
    }
    await containedRealPath(relativePath, `sourceCatalog ${id}`);
    const source = await readFile(path.join(repositoryRoot, relativePath), "utf8");
    if (sha256(source) !== expectedDigest) fail(`sourceCatalog ${id} is stale for ${relativePath}.`);
    const declarations = topLevelDeclarations(source, relativePath).get(symbol) ?? [];
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
  if (!sameSet(records.map((record) => record.id), LATTICE_COPY_SOURCE_IDS)) fail("sourceCatalog does not match the closed 12-source identity set.");
  return { records, byId: new Map(records.map((record) => [record.id, record])) };
}

async function loadRequirementAuthority() {
  const adoptionPath = "requirements/lattice-adoption.json";
  const inventoryPath = "requirements/lattice-copy-inventory.json";
  const [adoptionBytes, inventoryBytes] = await Promise.all([
    readFile(path.join(repositoryRoot, adoptionPath)),
    readFile(path.join(repositoryRoot, inventoryPath)),
  ]);
  const adoption = parseJson(adoptionBytes.toString("utf8"), adoptionPath);
  const inventory = parseJson(inventoryBytes.toString("utf8"), inventoryPath);
  await validateAgainstRepositorySchema(adoptionPath, adoption);
  await validateAgainstRepositorySchema(inventoryPath, inventory);
  exactFields(adoption, ["format", "registerId", "version", "scope", "provenance", "requirements"], adoptionPath);
  if (adoption.format !== "fog-of-sea-lattice-adoption-requirements-v1" || adoption.registerId !== "FOS-LAT"
    || adoption.version !== "1.0.0" || !semanticVersionPattern.test(adoption.version)) {
    fail(`${adoptionPath} has an unsupported authority identity.`);
  }
  exactFields(adoption.scope, ["authorized", "excluded", "broadAdoptionStatus", "statement"], `${adoptionPath} scope`);
  if (uniqueTextList(adoption.scope.authorized, `${adoptionPath} scope.authorized`, { minimum: 4, maximum: 4 }).length !== 4
    || uniqueTextList(adoption.scope.excluded, `${adoptionPath} scope.excluded`, { minimum: 4, maximum: 4 }).length !== 4) fail(`${adoptionPath} scope lists are incomplete.`);
  if (adoption.scope.broadAdoptionStatus !== "blocked") fail(`${adoptionPath} must keep broad adoption blocked.`);
  metadataText(adoption.scope.statement, `${adoptionPath} scope.statement`, 10_000);
  if (!Array.isArray(adoption.provenance) || adoption.provenance.length !== 5) fail(`${adoptionPath} must contain exactly five provenance records.`);
  const provenanceIds = new Set();
  for (const [index, record] of adoption.provenance.entries()) {
    exactFields(record, ["id", "kind", "locator", "revision", "role"], `${adoptionPath} provenance[${index}]`);
    if (typeof record.id !== "string" || !provenanceIdPattern.test(record.id) || provenanceIds.has(record.id)) {
      fail(`${adoptionPath} provenance[${index}].id is invalid or duplicated.`);
    }
    if (!provenanceKinds.has(record.kind)) fail(`${adoptionPath} provenance ${record.id} has an unsupported kind.`);
    for (const field of ["locator", "revision", "role"]) metadataText(record[field], `${adoptionPath} provenance ${record.id}.${field}`, 10_000);
    provenanceIds.add(record.id);
  }
  if (!Array.isArray(adoption.requirements) || adoption.requirements.length !== 25) fail(`${adoptionPath} must contain exactly 25 requirements.`);
  const requirementIds = new Set();
  const supersededIds = new Set();
  const requirementsById = new Map();
  for (const [index, record] of adoption.requirements.entries()) {
    exactFields(record, ["id", "title", "statement", "provenanceIds", "priority", "precedence", "dependencies", "conflicts", "owners", "acceptanceCriteria", "tests", "evidenceMethods", "status", "supersedes", "supersession"], `${adoptionPath} requirements[${index}]`);
    if (typeof record.id !== "string" || !requirementIdPattern.test(record.id)) fail(`${adoptionPath} requirements[${index}].id is invalid.`);
    if (requirementIds.has(record.id)) fail(`Duplicate requirement ${record.id}.`);
    metadataText(record.title, `Requirement ${record.id}.title`, 1_000);
    metadataText(record.statement, `Requirement ${record.id}.statement`, 10_000);
    uniqueTextList(record.provenanceIds, `Requirement ${record.id}.provenanceIds`, { minimum: 1, pattern: provenanceIdPattern });
    if (!requirementPriorities.has(record.priority) || !Number.isInteger(record.precedence) || record.precedence < 1) {
      fail(`Requirement ${record.id} has invalid priority or precedence.`);
    }
    uniqueTextList(record.dependencies, `Requirement ${record.id}.dependencies`, { pattern: requirementIdPattern });
    uniqueTextList(record.conflicts, `Requirement ${record.id}.conflicts`);
    uniqueTextList(record.owners, `Requirement ${record.id}.owners`, { minimum: 1 }).forEach((owner, ownerIndex) =>
      canonicalPath(owner, `Requirement ${record.id}.owners[${ownerIndex}]`));
    if (!Array.isArray(record.acceptanceCriteria) || !record.acceptanceCriteria.length) fail(`Requirement ${record.id} needs acceptance criteria.`);
    const criterionIds = new Set();
    for (const [criterionIndex, criterion] of record.acceptanceCriteria.entries()) {
      exactFields(criterion, ["id", "assertion"], `Requirement ${record.id} acceptanceCriteria[${criterionIndex}]`);
      if (typeof criterion.id !== "string" || !criterionIdPattern.test(criterion.id)
        || !criterion.id.startsWith(`${record.id}-AC-`) || criterionIds.has(criterion.id)) {
        fail(`Requirement ${record.id} has an invalid or duplicated acceptance criterion ID.`);
      }
      metadataText(criterion.assertion, `Requirement ${record.id} criterion ${criterion.id}`, 10_000);
      criterionIds.add(criterion.id);
    }
    if (!Array.isArray(record.tests) || record.tests.length < 3) fail(`Requirement ${record.id} needs positive, negative, and boundary tests.`);
    const testIds = new Set();
    const observedTestKinds = new Set();
    const suffixByKind = { positive: "P", negative: "N", boundary: "B" };
    for (const [testIndex, test] of record.tests.entries()) {
      exactFields(test, ["id", "kind", "assertion", "evidence"], `Requirement ${record.id} tests[${testIndex}]`);
      if (typeof test.id !== "string" || !testIdPattern.test(test.id) || !test.id.startsWith(`${record.id}-T-`)
        || !testKinds.has(test.kind) || !test.id.startsWith(`${record.id}-T-${suffixByKind[test.kind]}`) || testIds.has(test.id)) {
        fail(`Requirement ${record.id} has an invalid or duplicated test identity.`);
      }
      metadataText(test.assertion, `Requirement ${record.id} test ${test.id}.assertion`, 10_000);
      metadataText(test.evidence, `Requirement ${record.id} test ${test.id}.evidence`, 10_000);
      testIds.add(test.id);
      observedTestKinds.add(test.kind);
    }
    if (!sameSet(observedTestKinds, testKinds)) fail(`Requirement ${record.id} must declare positive, negative, and boundary tests.`);
    const methods = uniqueTextList(record.evidenceMethods, `Requirement ${record.id}.evidenceMethods`, { minimum: 1 });
    if (methods.some((method) => !evidenceMethods.has(method))) fail(`Requirement ${record.id} has an unsupported evidence method.`);
    if (!requirementStatuses.has(record.status)) fail(`Requirement ${record.id} has an unsupported status.`);
    uniqueTextList(record.supersedes, `Requirement ${record.id}.supersedes`, { pattern: requirementIdPattern });
    if (record.status === "superseded") {
      exactFields(record.supersession, ["supersededBy", "reason"], `Requirement ${record.id}.supersession`);
      if (typeof record.supersession.supersededBy !== "string" || !requirementIdPattern.test(record.supersession.supersededBy)
        || record.supersession.supersededBy === record.id) fail(`Requirement ${record.id} has an invalid supersession target.`);
      metadataText(record.supersession.reason, `Requirement ${record.id}.supersession.reason`, 10_000);
      supersededIds.add(record.id);
    } else if (record.supersession !== null) fail(`Active requirement ${record.id} must have null supersession.`);
    requirementIds.add(record.id);
    requirementsById.set(record.id, record);
  }
  if (![...requirementsById.values()].some((record) => record.status === "blocked")) fail(`${adoptionPath} must retain an explicit blocked requirement.`);
  for (const record of requirementsById.values()) {
    for (const id of record.provenanceIds) if (!provenanceIds.has(id)) fail(`Requirement ${record.id} references unknown provenance ${id}.`);
    for (const id of record.dependencies) {
      if (id === record.id || !requirementsById.has(id) || supersededIds.has(id)) fail(`Requirement ${record.id} has invalid dependency ${id}.`);
    }
    for (const id of record.supersedes) {
      if (id === record.id) fail(`Requirement ${record.id} cannot supersede itself.`);
      const superseded = requirementsById.get(id);
      if (superseded && (superseded.status !== "superseded" || superseded.supersession.supersededBy !== record.id)) {
        fail(`Requirement ${record.id} supersession of ${id} is not bidirectional.`);
      }
    }
    if (record.status === "superseded") {
      const replacement = requirementsById.get(record.supersession.supersededBy);
      if (!replacement || supersededIds.has(replacement.id) || !replacement.supersedes.includes(record.id)) {
        fail(`Requirement ${record.id} supersession is not owned by an active replacement.`);
      }
    }
  }

  exactFields(inventory, ["format", "version", "scope", "units"], inventoryPath);
  if (inventory.format !== "fog-of-sea-lattice-copy-inventory-v1"
    || inventory.version !== "1.0.0" || !semanticVersionPattern.test(inventory.version)) {
    fail(`${inventoryPath} has an unsupported authority identity.`);
  }
  exactFields(inventory.scope, ["unitCount", "requestCount", "outputCount", "sourceSymbolCount", "academyLintMode", "broadAdoptionStatus", "statement"], `${inventoryPath} scope`);
  if (!Array.isArray(inventory.units) || inventory.units.length !== 37 || inventory.scope.unitCount !== inventory.units.length
    || inventory.scope.requestCount !== LATTICE_COPY_REQUEST_IDS.length
    || inventory.scope.outputCount !== LATTICE_COPY_PUBLISH_IDS.length || inventory.scope.sourceSymbolCount !== 12
    || inventory.scope.academyLintMode !== "advisory-curriculum-data" || inventory.scope.broadAdoptionStatus !== "blocked") {
    fail(`${inventoryPath} scope does not match the bounded adoption slice.`);
  }
  metadataText(inventory.scope.statement, `${inventoryPath} scope.statement`, 10_000);
  const inventoryIds = new Set();
  const exemptInventoryIds = new Set();
  const inventoryOwners = new Map();
  const inventoryRoutes = new Map();
  const inventoryUnits = new Map();
  const inventoryOutputOwners = new Map();
  for (const [index, record] of inventory.units.entries()) {
    exactFields(record, ["id", "family", "surfaceName", "description", "status", "exemptionReason", "route", "targetAssurance", "owners", "requestIds", "outputTargets", "requirementIds", "risks", "supersedes"], `${inventoryPath} units[${index}]`);
    if (typeof record.id !== "string" || !inventoryIdPattern.test(record.id)) fail(`${inventoryPath} units[${index}].id is invalid.`);
    if (inventoryIds.has(record.id)) fail(`Duplicate inventory unit ${record.id}.`);
    if (!inventoryFamilies.has(record.family) || !inventoryStatuses.has(record.status)) fail(`Inventory ${record.id} has invalid family or status.`);
    metadataText(record.surfaceName, `Inventory ${record.id}.surfaceName`, 1_000);
    metadataText(record.description, `Inventory ${record.id}.description`, 10_000);
    const requestIds = uniqueTextList(record.requestIds, `Inventory ${record.id}.requestIds`, { pattern: identifierPattern });
    const outputTargets = uniqueTextList(record.outputTargets, `Inventory ${record.id}.outputTargets`, { pattern: identifierPattern });
    const linkedRequirementIds = uniqueTextList(record.requirementIds, `Inventory ${record.id}.requirementIds`, { minimum: 1, pattern: requirementIdPattern });
    uniqueTextList(record.risks, `Inventory ${record.id}.risks`, { minimum: 1 });
    uniqueTextList(record.supersedes, `Inventory ${record.id}.supersedes`, { pattern: inventoryIdPattern });
    for (const requirementId of linkedRequirementIds) {
      if (!requirementIds.has(requirementId) || supersededIds.has(requirementId)) fail(`Inventory ${record.id} references inactive requirement ${requirementId}.`);
    }
    inventoryIds.add(record.id);
    if (!Array.isArray(record.owners) || !record.owners.length) fail(`Inventory ${record.id} has no owners.`);
    const ownerKeys = new Set();
    const ownerPaths = new Set(record.owners.map((owner, ownerIndex) => {
      exactFields(owner, ["path", "role"], `Inventory ${record.id} owner ${ownerIndex}`);
      const ownerPath = canonicalPath(owner.path, `Inventory ${record.id} owner ${ownerIndex}.path`);
      const role = metadataText(owner.role, `Inventory ${record.id} owner ${ownerIndex}.role`, 1_000);
      const key = `${ownerPath}\0${role}`;
      if (ownerKeys.has(key)) fail(`Inventory ${record.id} duplicates owner ${ownerPath}.`);
      ownerKeys.add(key);
      return ownerPath;
    }));
    inventoryOwners.set(record.id, ownerPaths);
    if (record.status === "adopted") {
      if (record.exemptionReason !== null || !requestIds.length || !outputTargets.length || !targetAssurances.has(record.targetAssurance)) {
        fail(`Adopted inventory ${record.id} must declare a route, review target, requests, and outputs without an exemption.`);
      }
      exactFields(record.route, ["layer", "surface", "mode", "stakes", "representation"], `Inventory ${record.id} route`);
      if (!layers.has(record.route.layer) || !surfaces.has(record.route.surface) || !modes.has(record.route.mode)
        || !stakes.has(record.route.stakes) || !inventoryRepresentations.has(record.route.representation)) {
        fail(`Inventory ${record.id} has an unsupported route.`);
      }
      inventoryRoutes.set(record.id, { ...record.route, targetAssurance: record.targetAssurance });
      for (const outputTarget of outputTargets) {
        if (inventoryOutputOwners.has(outputTarget)) fail(`Inventory output target ${outputTarget} has more than one owner.`);
        inventoryOutputOwners.set(outputTarget, record.id);
      }
    } else {
      exemptInventoryIds.add(record.id);
      if (typeof record.exemptionReason !== "string" || !record.exemptionReason
        || record.route !== null || record.targetAssurance !== "not-applicable" || requestIds.length || outputTargets.length) {
        fail(`Non-adopted inventory ${record.id} must state its reason and have no route, review target, request, or output.`);
      }
      metadataText(record.exemptionReason, `Inventory ${record.id}.exemptionReason`, 10_000);
    }
    inventoryUnits.set(record.id, { ...record, requestIds, outputTargets, requirementIds: linkedRequirementIds, ownerPaths });
  }
  for (const record of inventoryUnits.values()) {
    for (const id of record.supersedes) {
      if (id === record.id) fail(`Inventory ${record.id} cannot supersede itself.`);
      if (inventoryUnits.has(id)) fail(`Inventory ${record.id} may supersede only a historical, absent inventory identity.`);
    }
  }
  if (!sameSet(inventoryOutputOwners.keys(), LATTICE_COPY_PUBLISH_IDS)) {
    fail(`${inventoryPath} adopted outputTargets do not match the closed publication set.`);
  }
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

async function publicationPaths(value, requestId) {
  if (!Array.isArray(value) || !value.length) fail(`Request ${requestId} source must list publication locators.`);
  const locators = new Set();
  const paths = new Set();
  for (const [index, raw] of value.entries()) {
    if (typeof raw !== "string" || !raw) fail(`Request ${requestId} source[${index}] must be text.`);
    const separator = raw.indexOf("#");
    if (separator !== raw.lastIndexOf("#")) fail(`Request ${requestId} source[${index}] has multiple fragments.`);
    const relativePath = canonicalPath(separator < 0 ? raw : raw.slice(0, separator), `Request ${requestId} source[${index}] path`);
    const fragment = separator < 0 ? undefined : raw.slice(separator + 1);
    if (fragment === undefined || !fragment || !identifierPattern.test(fragment)) fail(`Request ${requestId} source[${index}] requires a valid fragment.`);
    if (locators.has(raw)) fail(`Request ${requestId} source contains duplicate locator ${raw}.`);
    const publicationPath = await containedRealPath(relativePath, `Request ${requestId} publication path`);
    const source = await readFile(publicationPath, "utf8");
    if (publicationAnchorCount(source, relativePath, fragment) !== 1) {
      fail(`Request ${requestId} source[${index}] must resolve to exactly one top-level declaration or literal JSX id.`);
    }
    locators.add(raw);
    paths.add(relativePath);
  }
  return paths;
}

function normalizeReview(value, requestId) {
  exactFields(value, ["authority", "humanStatus", "claimScope"], `Request ${requestId} review`);
  if (value.humanStatus !== "not-claimed") fail(`Request ${requestId} must not claim unregistered human review.`);
  return {
    authority: metadataText(value.authority, `Request ${requestId} review.authority`),
    humanStatus: "not-claimed",
    claimScope: metadataText(value.claimScope, `Request ${requestId} review.claimScope`),
  };
}

function outputTargets(record) {
  if (!Array.isArray(record.outputs) || !record.outputs.length) fail(`Request ${record.id} has no outputs.`);
  const keys = new Set();
  return record.outputs.map((raw, index) => {
    exactFields(raw, ["publishId", "layer", "representation"], `Request ${record.id} output ${index}`);
    const publishId = identifier(raw.publishId, `Request ${record.id} output ${index} publishId`);
    if (!layers.has(raw.layer) || !representations.has(raw.representation)) fail(`Request ${record.id} output ${publishId} has an invalid route.`);
    const key = `${raw.layer}:${raw.representation}`;
    if (keys.has(key)) fail(`Request ${record.id} duplicates output route ${key}.`);
    keys.add(key);
    return { publishId, layer: raw.layer, representation: raw.representation, key };
  });
}

function routeMatches(route, context, target) {
  return route.layer === target.layer
    && route.surface === context.surface
    && route.mode === context.mode
    && route.stakes === context.stakes
    && (route.representation === "both" || route.representation === target.representation);
}

function normalizeTraceability(value, record, targets, sourceCatalog, authority, publishedAt) {
  exactFields(value, ["requirementIds", "inventoryIds", "sourceRefs"], `Request ${record.id} traceability`);
  const requirementIds = referenceList(value.requirementIds, `Request ${record.id} requirementIds`, requirementIdPattern);
  const inventoryIds = referenceList(value.inventoryIds, `Request ${record.id} inventoryIds`, inventoryIdPattern);
  const sourceRefs = referenceList(value.sourceRefs, `Request ${record.id} sourceRefs`);
  const unknownRequirements = requirementIds.filter((id) => !authority.requirementIds.has(id));
  const staleRequirements = requirementIds.filter((id) => authority.supersededIds.has(id));
  const unknownInventory = inventoryIds.filter((id) => !authority.inventoryIds.has(id));
  const exemptInventory = inventoryIds.filter((id) => authority.exemptInventoryIds.has(id));
  const unknownSources = sourceRefs.filter((id) => !sourceCatalog.byId.has(id));
  if (unknownRequirements.length || staleRequirements.length || unknownInventory.length || exemptInventory.length || unknownSources.length) {
    fail(`Request ${record.id} has invalid traceability references.`, [
      ...unknownRequirements.map((id) => `unknown requirement ${id}`),
      ...staleRequirements.map((id) => `superseded requirement ${id}`),
      ...unknownInventory.map((id) => `unknown inventory ${id}`),
      ...exemptInventory.map((id) => `exempt inventory ${id}`),
      ...unknownSources.map((id) => `unknown source ${id}`),
    ]);
  }
  const inventoryWithoutPublication = inventoryIds.filter((id) =>
    ![...authority.inventoryOwners.get(id)].some((ownerPath) => publishedAt.has(ownerPath)));
  const publicationWithoutInventory = [...publishedAt].filter((publicationPath) =>
    !inventoryIds.some((id) => authority.inventoryOwners.get(id).has(publicationPath)));
  if (inventoryWithoutPublication.length || publicationWithoutInventory.length) {
    fail(`Request ${record.id} publication ownership is incomplete.`, [
      ...inventoryWithoutPublication.map((id) => `inventory ${id} has no publication owner in request.source`),
      ...publicationWithoutInventory.map((entry) => `publication ${entry} is not owned by linked inventory`),
    ]);
  }
  if (!isObject(record.context)) fail(`Request ${record.id} context must be an object.`);
  const usedInventory = new Set();
  for (const target of targets) {
    const matching = inventoryIds.filter((id) => routeMatches(authority.inventoryRoutes.get(id), record.context, target));
    if (matching.length !== 1) {
      fail(`Request ${record.id} output ${target.publishId} must match exactly one linked inventory route.`, matching);
    }
    usedInventory.add(matching[0]);
  }
  const unusedInventory = inventoryIds.filter((id) => !usedInventory.has(id));
  if (unusedInventory.length) fail(`Request ${record.id} links inventory routes unused by its outputs.`, unusedInventory);
  for (const inventoryId of inventoryIds) {
    const unit = authority.inventoryUnits.get(inventoryId);
    if (!unit.requestIds.includes(record.id)) fail(`Inventory ${inventoryId} does not declare request owner ${record.id}.`);
  }
  for (const target of targets) {
    const inventoryId = [...usedInventory].find((id) => routeMatches(authority.inventoryRoutes.get(id), record.context, target));
    if (!authority.inventoryUnits.get(inventoryId).outputTargets.includes(target.publishId)) {
      fail(`Inventory ${inventoryId} does not own output target ${target.publishId}.`);
    }
  }
  return { requirementIds, inventoryIds, sourceRefs };
}

function validateBidirectionalInventory(authority, requestLinks) {
  for (const [inventoryId, unit] of authority.inventoryUnits) {
    if (unit.status !== "adopted") continue;
    const linkedRequests = [...requestLinks.values()].filter((request) => request.inventoryIds.includes(inventoryId));
    const observedRequestIds = linkedRequests.map((request) => request.requestId);
    if (!sameSet(observedRequestIds, unit.requestIds)) fail(`Inventory ${inventoryId} requestIds are not bidirectional.`);
    const observedTargets = linkedRequests.flatMap((request) => request.targets
      .filter((target) => routeMatches(authority.inventoryRoutes.get(inventoryId), request.context, target))
      .map((target) => target.publishId));
    if (!sameSet(observedTargets, unit.outputTargets)) fail(`Inventory ${inventoryId} outputTargets are not bidirectional.`);
    const linkedRequirementIds = new Set(linkedRequests.flatMap((request) => request.requirementIds));
    const missing = unit.requirementIds.filter((requirementId) => !linkedRequirementIds.has(requirementId));
    if (missing.length) fail(`Inventory ${inventoryId} requirementIds are not covered by its linked requests.`, missing);
  }
}

function verifyCandidateEvidenceRefs(record, traceability) {
  if (!Array.isArray(record.candidates)) return;
  const allowed = new Set(traceability.sourceRefs);
  for (const [candidateIndex, candidate] of record.candidates.entries()) {
    if (!isObject(candidate) || !isObject(candidate.metadata) || !Array.isArray(candidate.metadata.claims)) continue;
    for (const [claimIndex, claim] of candidate.metadata.claims.entries()) {
      if (!isObject(claim) || !Array.isArray(claim.evidenceRefs) || !claim.evidenceRefs.length) {
        fail(`Request ${record.id} candidate ${candidateIndex} claim ${claimIndex} must declare evidenceRefs.`);
      }
      const evidenceRefs = referenceList(claim.evidenceRefs, `Request ${record.id} candidate ${candidateIndex} claim ${claimIndex} evidenceRefs`);
      const unknown = evidenceRefs.filter((sourceRef) => !allowed.has(sourceRef));
      if (unknown.length) fail(`Request ${record.id} candidate claim references undeclared source evidence.`, unknown);
    }
  }
}

function normalizePhraseMap(value, label) {
  if (value === undefined) return {};
  if (!isObject(value)) fail(`${label} must be keyed by publishId.`);
  const normalized = {};
  for (const [publishId, phrases] of Object.entries(value)) {
    identifier(publishId, `${label} publishId`);
    if (!Array.isArray(phrases) || !phrases.length || phrases.some((phrase) => typeof phrase !== "string" || !phrase)) {
      fail(`${label}.${publishId} must be a non-empty text array.`);
    }
    if (new Set(phrases).size !== phrases.length) fail(`${label}.${publishId} contains duplicates.`);
    normalized[publishId] = [...phrases];
  }
  return normalized;
}

function normalizeAssertions(value, label) {
  if (value === undefined) return { requiredPhrases: {}, prohibitedPhrases: {}, exactText: {} };
  if (!isObject(value)) fail(`${label} must be an object.`);
  const allowed = new Set(["requiredPhrases", "prohibitedPhrases", "exactText"]);
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length) fail(`${label} has unsupported fields.`, unknown);
  const exactText = {};
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

function mergeAssertions(...sets) {
  const merged = { requiredPhrases: {}, prohibitedPhrases: {}, exactText: {} };
  for (const assertions of sets) {
    for (const field of ["requiredPhrases", "prohibitedPhrases"]) {
      for (const [publishId, phrases] of Object.entries(assertions[field])) {
        merged[field][publishId] = [...new Set([...(merged[field][publishId] ?? []), ...phrases])];
      }
    }
    for (const [publishId, text] of Object.entries(assertions.exactText)) {
      if (merged.exactText[publishId] !== undefined && merged.exactText[publishId] !== text) {
        fail(`Conflicting exactText assertions exist for ${publishId}.`);
      }
      merged.exactText[publishId] = text;
    }
  }
  return merged;
}

function validateAssertions(assertions, copy) {
  const known = new Set(Object.keys(copy));
  for (const field of ["requiredPhrases", "prohibitedPhrases", "exactText"]) {
    for (const publishId of Object.keys(assertions[field])) {
      if (!known.has(publishId)) fail(`hostAssertions.${field} references unknown output ${publishId}.`);
    }
  }
  for (const [publishId, phrases] of Object.entries(assertions.requiredPhrases)) {
    for (const phrase of phrases) if (!copy[publishId].text.includes(phrase)) fail(`${publishId} lacks required phrase ${JSON.stringify(phrase)}.`);
  }
  for (const [publishId, phrases] of Object.entries(assertions.prohibitedPhrases)) {
    for (const phrase of phrases) if (copy[publishId].text.includes(phrase)) fail(`${publishId} contains prohibited phrase ${JSON.stringify(phrase)}.`);
  }
  for (const [publishId, text] of Object.entries(assertions.exactText)) {
    if (copy[publishId].text !== text) fail(`${publishId} differs from its exactText assertion.`);
  }
}

function assertionSummary(assertions) {
  const publishIds = new Set([
    ...Object.keys(assertions.requiredPhrases),
    ...Object.keys(assertions.prohibitedPhrases),
    ...Object.keys(assertions.exactText),
  ]);
  return {
    sha256: sha256(stableStringify(assertions)),
    publishIds: [...publishIds].sort((left, right) => left.localeCompare(right, "en")),
    requiredPhraseCount: Object.values(assertions.requiredPhrases).reduce((count, entries) => count + entries.length, 0),
    prohibitedPhraseCount: Object.values(assertions.prohibitedPhrases).reduce((count, entries) => count + entries.length, 0),
    exactTextCount: Object.keys(assertions.exactText).length,
  };
}

function requiredAtoms(record, target) {
  if (!isObject(record.contract) || !Array.isArray(record.contract.atoms)) fail(`Request ${record.id} has no semantic atoms.`);
  return record.contract.atoms.filter((atom) => isObject(atom)
    && Array.isArray(atom.requiredIn)
    && atom.requiredIn.includes(target.layer)
    && atom.delivery?.[target.layer] !== "optional");
}

function verifyRequiredAtomProtections(record, target) {
  const missing = requiredAtoms(record, target)
    .filter((atom) => !Array.isArray(atom.prohibitedDependencies) || !atom.prohibitedDependencies.includes("timing-perception"))
    .map((atom) => String(atom.id));
  if (missing.length) fail(`Output ${target.publishId} has required atoms without timing-perception protection.`, missing);
}

function literalizedText(api, record, target) {
  return api.literalize(record.contract, { layer: target.layer, representation: target.representation });
}

function controlledOperativeText(record, target) {
  if (target.layer !== "operative") return undefined;
  const atoms = requiredAtoms(record, target);
  if (!atoms.length) fail(`Operative output ${target.publishId} has no required atoms.`);
  const missing = atoms.filter((atom) => typeof atom.literalForm !== "string" || !atom.literalForm.trim()).map((atom) => String(atom.id));
  if (missing.length) fail(`Operative output ${target.publishId} lacks controlled literals.`, missing);
  return atoms.map((atom) => atom.literalForm).join(" ").trim();
}

function selectedProvidedCandidate(record, target, output) {
  if (output.source?.kind !== "provided") return undefined;
  const candidate = Array.isArray(record.candidates)
    ? record.candidates.find((entry) => isObject(entry)
      && entry.id === output.candidateId
      && entry.layer === target.layer
      && entry.representation === target.representation)
    : undefined;
  if (!candidate) fail(`Output ${target.publishId} references an absent provided candidate.`);
  if (candidate.text !== output.text) fail(`Output ${target.publishId} differs from its selected provided candidate text.`);
  return candidate;
}

function verifySelection(api, record, target, output) {
  const source = output.source?.kind;
  if (!new Set(["provided", "literal"]).has(source)) fail(`Output ${target.publishId} has an unsupported source.`);
  if ((source === "literal") !== (output.conformance === "literal")) {
    fail(`Output ${target.publishId} literal source and conformance disagree.`);
  }
  const candidate = selectedProvidedCandidate(record, target, output);
  if (source === "literal") {
    if (output.candidateId !== `literal-${target.layer}-${target.representation}`) fail(`Output ${target.publishId} has an invalid literal identity.`);
    if (output.text !== literalizedText(api, record, target)) fail(`Output ${target.publishId} differs from contract literalization.`);
  }
  const operative = controlledOperativeText(record, target);
  if (operative !== undefined && output.text !== operative) fail(`Output ${target.publishId} differs from its controlled operative literal sequence.`);
  if (target.representation === "accessibility-equivalent") {
    const dependencies = isObject(candidate?.metadata) && Array.isArray(candidate.metadata.dependencies)
      ? candidate.metadata.dependencies
      : [];
    if (dependencies.includes("timing-perception")) fail(`Accessibility output ${target.publishId} depends on timing perception.`);
  }
  return candidate;
}

function findingSummary(findings) {
  const statusCounts = {};
  const codeCounts = {};
  for (const finding of findings) {
    if (!isObject(finding) || !findingStatuses.has(finding.status) || typeof finding.code !== "string") {
      fail("Lattice returned an invalid public finding.");
    }
    statusCounts[finding.status] = (statusCounts[finding.status] ?? 0) + 1;
    codeCounts[finding.code] = (codeCounts[finding.code] ?? 0) + 1;
  }
  return {
    statusCounts: Object.fromEntries(Object.entries(statusCounts).sort(([left], [right]) => left.localeCompare(right, "en"))),
    codeCounts: Object.fromEntries(Object.entries(codeCounts).sort(([left], [right]) => left.localeCompare(right, "en"))),
  };
}

function aggregateConformance(outputs) {
  return outputs.reduce((lowest, output) => conformanceRank[output.conformance] < conformanceRank[lowest]
    ? output.conformance
    : lowest, "full");
}

async function assertOwnerCheckout(ownerRoot) {
  const [{ stdout }, { stdout: ownerStatus }] = await Promise.all([
    execFileAsync("git", ["rev-parse", "HEAD"], { cwd: ownerRoot }),
    execFileAsync("git", ["status", "--porcelain=v1", "--untracked-files=all"], { cwd: ownerRoot }),
  ]);
  if (stdout.trim() !== LATTICE_COPY_PROVENANCE.latticeCommit) fail("The owner checkout is not at the pinned Lattice commit.");
  if (ownerStatus.trim()) fail("The pinned owner checkout must have no tracked or untracked changes.");
  exactFields(LATTICE_OWNER_PACKAGE_MANIFEST, ["format", "algorithm", "commit", "files"], "Owner package manifest");
  if (LATTICE_OWNER_PACKAGE_MANIFEST.format !== "fog-of-sea.lattice-owner-package-manifest.v1"
    || LATTICE_OWNER_PACKAGE_MANIFEST.algorithm !== "sha256-stable-json-v1"
    || LATTICE_OWNER_PACKAGE_MANIFEST.commit !== stdout.trim()
    || !Array.isArray(LATTICE_OWNER_PACKAGE_MANIFEST.files) || !LATTICE_OWNER_PACKAGE_MANIFEST.files.length) {
    fail("The owner package manifest identity is invalid.");
  }
  const observedPaths = new Set();
  for (const [index, entry] of LATTICE_OWNER_PACKAGE_MANIFEST.files.entries()) {
    exactFields(entry, ["path", "sha256"], `Owner package manifest files[${index}]`);
    const relativePath = canonicalPath(entry.path, `Owner package manifest files[${index}].path`);
    const expectedDigest = digest(entry.sha256, `Owner package manifest files[${index}].sha256`);
    if (observedPaths.has(relativePath)) fail(`Owner package manifest duplicates ${relativePath}.`);
    observedPaths.add(relativePath);
    const ownerRealRoot = await realpath(ownerRoot);
    const fileRealPath = await realpath(path.join(ownerRoot, relativePath));
    if (!fileRealPath.startsWith(`${ownerRealRoot}${path.sep}`)) fail(`Owner package input ${relativePath} resolves outside the owner checkout.`);
    const observedDigest = sha256(await readFile(fileRealPath));
    if (observedDigest !== expectedDigest) fail(`Owner package input ${relativePath} differs from its closed manifest.`);
  }
  const ownerPackageDigest = sha256(stableStringify(LATTICE_OWNER_PACKAGE_MANIFEST));
  if (ownerPackageDigest !== LATTICE_COPY_PIN.ownerPackageDigest) {
    fail("The derived owner package digest differs from the pinned digest.", [ownerPackageDigest]);
  }
  return ownerPackageDigest;
}

async function loadOwnerEngine() {
  const configured = process.env.LATTICE_OWNER_ROOT;
  if (!configured || !path.isAbsolute(configured)) fail("LATTICE_OWNER_ROOT must name the absolute owner checkout.");
  const ownerRoot = await realpath(configured);
  if (ownerRoot === await realpath(repositoryRoot)) fail("The owner engine must be a separate checkout.");
  const ownerPackageDigest = await assertOwnerCheckout(ownerRoot);
  const packageDocument = parseJson(await readFile(path.join(ownerRoot, "package.json"), "utf8"), "Lattice package.json");
  if (packageDocument.name !== "@howardhayden/lattice-register-engine"
    || packageDocument.version !== LATTICE_COPY_PIN.engineVersion
    || packageDocument.private !== true) fail("The owner package identity is unsupported.");
  const api = await import(pathToFileURL(path.join(ownerRoot, "dist/index.js")).href);
  if (api.ENGINE_NAME !== LATTICE_COPY_PIN.engineName || api.ENGINE_VERSION !== LATTICE_COPY_PIN.engineVersion) {
    fail("The imported owner engine identity differs from the pin.");
  }
  const engine = api.createEngine();
  const profile = engine.profiles.find((entry) => entry.id === LATTICE_COPY_PIN.profileId);
  if (!profile || profile.version !== LATTICE_COPY_PIN.profileVersion || profile.digest !== LATTICE_COPY_PIN.profileDigest) {
    fail("The imported owner profile identity differs from the pin.");
  }
  return { api, engine, ownerRoot, ownerPackageDigest };
}

function lintAcademy(engine, corpus) {
  const batches = createAcademyLintBatches(corpus.entries).map((batch) => {
    const report = engine.lint({
      text: batch.text,
      context: {
        domain: "strategy-education",
        surface: "tutorial",
        mode: "exposition",
        stakes: "consequential",
        safetyClass: "advisory",
        locale: "en-US",
        audience: { knowledgeTags: ["strategy-student"] },
        channel: { visualAvailable: true, audioAvailable: false, spatialInferenceAllowed: false },
        limits: { maxCharacters: 50_000, maxSentences: 1_000, maxCandidates: 1 },
        sceneImportance: "major",
      },
      output: { layer: "interpretive", representation: "standard" },
      profileIds: [LATTICE_COPY_PIN.profileId],
    });
    if (report.advisoryOnly !== true || report.semanticGuarantee !== false) fail(`Academy lint batch ${batch.id} overstates assurance.`);
    const summary = findingSummary(report.findings);
    return {
      id: batch.id,
      entryIds: batch.entryIds,
      entryCount: batch.entryCount,
      textSha256: batch.textSha256,
      findingCount: report.findings.length,
      ...summary,
    };
  });
  const statusCounts = {};
  const codeCounts = {};
  for (const batch of batches) {
    for (const [key, count] of Object.entries(batch.statusCounts)) statusCounts[key] = (statusCounts[key] ?? 0) + count;
    for (const [key, count] of Object.entries(batch.codeCounts)) codeCounts[key] = (codeCounts[key] ?? 0) + count;
  }
  const findingCount = batches.reduce((count, batch) => count + batch.findingCount, 0);
  return {
    status: "advisory",
    advisoryOnly: true,
    semanticGuarantee: false,
    corpusSha256: corpus.corpusSha256,
    sourceSha256: corpus.source.sha256,
    entryCount: corpus.entryCount,
    batchCount: batches.length,
    findingCount,
    unresolvedFindingCount: (statusCounts.fail ?? 0) + (statusCounts.warn ?? 0) + (statusCounts.unknown ?? 0),
    statusCounts: Object.fromEntries(Object.entries(statusCounts).sort(([left], [right]) => left.localeCompare(right, "en"))),
    codeCounts: Object.fromEntries(Object.entries(codeCounts).sort(([left], [right]) => left.localeCompare(right, "en"))),
    batches,
  };
}

async function createImplementationAuthority() {
  const files = await digestFiles(LATTICE_IMPLEMENTATION_AUTHORITY_PATHS);
  const body = {
    format: "fog-of-sea.lattice-implementation-authority.v1",
    algorithm: "sha256-stable-json-v1",
    files,
  };
  return { ...body, sha256: sha256(stableStringify(body)) };
}

async function emitChangedFiles(files) {
  const staged = [];
  try {
    for (const file of files) {
      const destination = path.join(repositoryRoot, file.relativePath);
      await mkdir(path.dirname(destination), { recursive: true });
      try {
        if (await readFile(destination, "utf8") === file.text) continue;
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
      const temporary = `${destination}.${randomUUID()}.tmp`;
      await writeFile(temporary, file.text, { encoding: "utf8", mode: 0o644 });
      staged.push({ destination, temporary });
    }
    for (const file of staged) await rename(file.temporary, file.destination);
  } catch (error) {
    fail("Could not emit the changed static copy files.", [error instanceof Error ? error.message : String(error)]);
  } finally {
    await Promise.all(staged.map(async (file) => {
      try {
        await unlink(file.temporary);
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    }));
  }
}

const requestText = await readRequired(
  LATTICE_COPY_PATHS.request,
  "Create the source-controlled authoring contract before compiling.",
);
const document = parseJson(requestText, LATTICE_COPY_PATHS.request);
await validateAgainstRepositorySchema(LATTICE_COPY_PATHS.request, document);
if (!isObject(document)) fail("The authoring request document must be an object.");
const requiredDocumentFields = ["schemaVersion", "revision", "lattice", "provenance", "sourceCatalog", "requests"];
const allowedDocumentFields = new Set([...requiredDocumentFields, "hostAssertions"]);
const unknownDocumentFields = Object.keys(document).filter((key) => !allowedDocumentFields.has(key));
const missingDocumentFields = requiredDocumentFields.filter((key) => !Object.hasOwn(document, key));
if (unknownDocumentFields.length || missingDocumentFields.length) {
  fail("The authoring request document fields do not match the v2 contract.", [
    ...unknownDocumentFields.map((field) => `unsupported ${field}`),
    ...missingDocumentFields.map((field) => `missing ${field}`),
  ]);
}
if (document.schemaVersion !== LATTICE_COPY_REQUEST_SCHEMA) fail(`Unsupported request schema ${String(document.schemaVersion)}.`);
metadataText(document.revision, "Authoring revision", 128);
if (stableStringify(document.lattice) !== stableStringify(LATTICE_COPY_PIN)) fail("The authoring Lattice pin is incomplete or changed.");
if (stableStringify(document.provenance) !== stableStringify(LATTICE_COPY_PROVENANCE)) fail("The authoring provenance pin is incomplete or changed.");
if (!Array.isArray(document.requests) || !document.requests.length) fail("The authoring request set must not be empty.");

const sourceCatalog = await normalizeSourceCatalog(document.sourceCatalog);
const authority = await loadRequirementAuthority();
const implementationAuthority = await createImplementationAuthority();
const corpus = await createAcademyCopyCorpus();
const { api, engine, ownerRoot, ownerPackageDigest } = await loadOwnerEngine();
if (document.lattice.ownerPackageDigest !== ownerPackageDigest) {
  fail("The authoring ownerPackageDigest was not derived from the pinned clean owner checkout.");
}
const globalAssertions = normalizeAssertions(document.hostAssertions, "hostAssertions");
const requestIds = new Set();
const publishIds = new Set();
const usedSourceRefs = new Set();
const usedInventoryIds = new Set();
const requestLinks = new Map();
const copy = {};
const evidenceRequests = [];
const traceabilityRequests = [];
const assertionSets = [globalAssertions];
const requestRecords = document.requests.map((record, index) => {
  if (!isObject(record)) fail(`requests[${index}] must be an object.`);
  return record;
}).sort((left, right) => String(left.id).localeCompare(String(right.id), "en"));

for (const record of requestRecords) {
  exactFields(
    record,
    ["id", "source", "traceability", "context", "outputs", "contract", "profileIds", "candidates", "hostAssertions", "review"],
    `Request ${String(record.id)}`,
  );
  const requestId = identifier(record.id, "Request ID");
  if (requestIds.has(requestId)) fail(`Duplicate request ID ${requestId}.`);
  requestIds.add(requestId);
  const targets = outputTargets(record);
  const publishedAt = await publicationPaths(record.source, requestId);
  const traceability = normalizeTraceability(record.traceability, record, targets, sourceCatalog, authority, publishedAt);
  verifyCandidateEvidenceRefs(record, traceability);
  const review = normalizeReview(record.review, requestId);
  traceability.sourceRefs.forEach((sourceRef) => usedSourceRefs.add(sourceRef));
  traceability.inventoryIds.forEach((inventoryId) => usedInventoryIds.add(inventoryId));
  traceabilityRequests.push({ requestId, ...traceability, review });
  requestLinks.set(requestId, { requestId, context: record.context, targets, ...traceability });
  if (record.profileIds !== undefined && stableStringify(record.profileIds) !== stableStringify([LATTICE_COPY_PIN.profileId])) {
    fail(`Request ${requestId} may select only the pinned profile.`);
  }
  for (const target of targets) {
    if (publishIds.has(target.publishId)) fail(`Duplicate publishId ${target.publishId}.`);
    publishIds.add(target.publishId);
    verifyRequiredAtomProtections(record, target);
  }
  const assertions = normalizeAssertions(record.hostAssertions, `Request ${requestId} hostAssertions`);
  assertionSets.push(assertions);
  const engineRequest = {
    id: requestId,
    contract: record.contract,
    context: record.context,
    outputs: targets.map(({ layer, representation }) => ({ layer, representation })),
    profileIds: [LATTICE_COPY_PIN.profileId],
    ...(record.candidates === undefined ? {} : { candidates: record.candidates }),
  };
  const result = engine.realize(engineRequest);
  api.verifyResult(result);
  if (result.outputs.length !== targets.length) fail(`Request ${requestId} produced undeclared or missing outputs.`);
  digest(result.receipt.inputDigest, `Request ${requestId} inputDigest`);
  digest(result.receipt.derivationDigest, `Request ${requestId} derivationDigest`);
  const outputs = [];
  for (const target of targets) {
    const output = result.outputs.find((candidate) => candidate.key === target.key);
    if (!output) fail(`Request ${requestId} did not produce ${target.key}.`);
    if (output.conformance === "full") fail(`Output ${target.publishId} unexpectedly claims full conformance while manual-review rules remain unresolved.`);
    const selectedCandidate = verifySelection(api, record, target, output);
    const requiredIds = requiredAtoms(record, target).map((atom) => identifier(atom.id, `${target.publishId} atom ID`));
    const mappedIds = output.source.kind === "literal" ? requiredIds : selectedCandidate.atomIds;
    if (!Array.isArray(mappedIds) || new Set(mappedIds).size !== mappedIds.length) fail(`${target.publishId} has an invalid selected atom map.`);
    const knownAtomIds = new Set(record.contract.atoms.map((atom) => atom.id));
    if (mappedIds.some((atomId) => !knownAtomIds.has(atomId))) fail(`${target.publishId} maps an unknown atom.`);
    const mapped = new Set(mappedIds);
    const coveredIds = requiredIds.filter((atomId) => mapped.has(atomId));
    const coverageRatio = requiredIds.length ? coveredIds.length / requiredIds.length : 1;
    if (stableStringify(output.coverage.requiredIds) !== stableStringify(requiredIds)
      || stableStringify(output.coverage.coveredIds) !== stableStringify(coveredIds)
      || output.coverage.ratio !== coverageRatio) fail(`${target.publishId} coverage differs from the selected atom map.`);
    const textSha256 = sha256(output.text);
    copy[target.publishId] = {
      text: output.text,
      textSha256,
      layer: target.layer,
      representation: target.representation,
      conformance: output.conformance,
      requestId,
      candidateId: output.candidateId,
      source: output.source.kind,
    };
    const summary = findingSummary(output.findings);
    outputs.push({
      publishId: target.publishId,
      key: target.key,
      candidateId: output.candidateId,
      source: output.source.kind,
      conformance: output.conformance,
      textSha256,
      requiredAtomCount: requiredIds.length,
      coveredAtomCount: coveredIds.length,
      requiredAtomIdsSha256: sha256(stableStringify(requiredIds)),
      coverageRatio,
      findingCount: output.findings.length,
      ...summary,
    });
  }
  evidenceRequests.push({
    requestId,
    traceability,
    review,
    conformance: result.conformance,
    inputDigest: result.receipt.inputDigest,
    derivationDigest: result.receipt.derivationDigest,
    outputs: outputs.sort((left, right) => left.publishId.localeCompare(right.publishId, "en")),
  });
}

validateBidirectionalInventory(authority, requestLinks);

const unusedSourceRefs = sourceCatalog.records.map((record) => record.id).filter((id) => !usedSourceRefs.has(id));
if (unusedSourceRefs.length) fail("sourceCatalog contains unused declarations.", unusedSourceRefs);
const unusedAdoptedInventory = [...authority.inventoryIds]
  .filter((id) => !authority.exemptInventoryIds.has(id) && !usedInventoryIds.has(id));
if (unusedAdoptedInventory.length) fail("The authoring contract leaves adopted inventory routes unused.", unusedAdoptedInventory);
const observedRequestIds = [...requestIds].sort((left, right) => left.localeCompare(right, "en"));
const observedPublishIds = [...publishIds].sort((left, right) => left.localeCompare(right, "en"));
if (stableStringify(observedRequestIds) !== stableStringify(LATTICE_COPY_REQUEST_IDS)
  || stableStringify(observedPublishIds) !== stableStringify(LATTICE_COPY_PUBLISH_IDS)) {
  fail("The bounded adoption slice does not match the closed request and publication identity sets.", [
    `expected ${LATTICE_COPY_REQUEST_IDS.length} requests and ${LATTICE_COPY_PUBLISH_IDS.length} outputs`,
  ]);
}
if (requestRecords.length !== 19 || Object.keys(copy).length !== 26) {
  fail("The bounded adoption slice must contain exactly 19 requests and 26 published outputs.");
}

const traceability = {
  authorityFiles: authority.authorityFiles,
  sourceCatalog: sourceCatalog.records,
  requests: traceabilityRequests.sort((left, right) => left.requestId.localeCompare(right.requestId, "en")),
};
const traceabilitySha256 = sha256(stableStringify(traceability));
const assertions = mergeAssertions(...assertionSets);
const sortedCopy = Object.fromEntries(Object.entries(copy).sort(([left], [right]) => left.localeCompare(right, "en")));
validateAssertions(assertions, sortedCopy);
const hostAssertions = assertionSummary(assertions);
const runtimeCopy = Object.fromEntries(Object.entries(sortedCopy).map(([publishId, output]) => [publishId, output.text]));
const copySha256 = sha256(stableStringify(runtimeCopy));
const academyLint = lintAcademy(engine, corpus);
const academyLintSha256 = sha256(stableStringify(academyLint));
const sortedEvidenceRequests = evidenceRequests.sort((left, right) => left.requestId.localeCompare(right.requestId, "en"));
const realizationSha256 = sha256(stableStringify(sortedEvidenceRequests));
const conformance = aggregateConformance(Object.values(sortedCopy));
const requestSha256 = sha256(requestText);
const outputHashes = Object.fromEntries(Object.entries(sortedCopy).map(([publishId, output]) => [publishId, output.textSha256]));
const snapshotSeed = {
  lattice: LATTICE_COPY_PIN,
  implementationAuthoritySha256: implementationAuthority.sha256,
  requestSha256,
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
  requestPath: LATTICE_COPY_PATHS.request,
  requestSha256,
  academySourcePath: corpus.source.path,
  academySourceSha256: corpus.source.sha256,
  academyCorpusSha256: corpus.corpusSha256,
  academyLintSha256,
  provenance: LATTICE_COPY_PROVENANCE,
};
const boundary = {
  ownerCompilerRequired: true,
  runtimeEngineIncluded: false,
  runtimeProfileIncluded: false,
  receiptsIncluded: false,
  ruleDecisionsIncluded: false,
};
const generated = {
  schemaVersion: LATTICE_COPY_GENERATED_SCHEMA,
  snapshotId,
  staticOnly: true,
  lattice: LATTICE_COPY_PIN,
  implementationAuthority,
  source,
  boundary,
  assurance: {
    conformance,
    conformanceCeiling: "degraded",
    academyLintStatus: "advisory",
    humanReviewStatus: "not-claimed",
    semanticScope: "declared-contract-and-registered-claims",
    sourceTruthEstablished: false,
  },
  hostAssertions,
  traceabilitySha256,
  traceability,
  realizationSha256,
  copySha256,
  copy: sortedCopy,
};
const generatedText = jsonFileText(generated);
const generatedFileSha256 = sha256(generatedText);
const runtime = {
  schemaVersion: LATTICE_COPY_RUNTIME_SCHEMA,
  snapshotId,
  copySha256,
  copy: runtimeCopy,
};
const runtimeText = jsonFileText(runtime);
const runtimeFileSha256 = sha256(runtimeText);
const evidence = {
  schemaVersion: LATTICE_COPY_EVIDENCE_SCHEMA,
  snapshotId,
  lattice: LATTICE_COPY_PIN,
  implementationAuthority,
  source,
  boundary,
  assurance: {
    deterministic: true,
    networkIndependentAtRealization: true,
    authenticated: false,
    externallyAnchored: false,
    trustScope: "reproducibility-and-conformance-only",
    conformance,
    conformanceCeiling: "degraded",
    humanReviewStatus: "not-claimed",
  },
  hostAssertions,
  traceabilitySha256,
  traceability,
  realizationSha256,
  copySha256,
  generatedFile: { path: LATTICE_COPY_PATHS.generated, sha256: generatedFileSha256 },
  runtimeFile: { path: LATTICE_COPY_PATHS.runtime, sha256: runtimeFileSha256 },
  academyCorpus: {
    schemaVersion: corpus.schemaVersion,
    entryCount: corpus.entryCount,
    characterCount: corpus.characterCount,
    roles: corpus.roles,
    sections: corpus.sections,
    sha256: corpus.corpusSha256,
  },
  academyLint,
  requests: sortedEvidenceRequests,
};
const evidenceText = jsonFileText(evidence);
const evidenceFileSha256 = sha256(evidenceText);
const index = {
  schemaVersion: LATTICE_COPY_INDEX_SCHEMA,
  current: { snapshotId, path: LATTICE_COPY_PATHS.evidence, sha256: evidenceFileSha256 },
  entries: [{
    snapshotId,
    evidencePath: LATTICE_COPY_PATHS.evidence,
    evidenceSha256: evidenceFileSha256,
    generatedPath: LATTICE_COPY_PATHS.generated,
    generatedSha256: generatedFileSha256,
    runtimePath: LATTICE_COPY_PATHS.runtime,
    runtimeSha256: runtimeFileSha256,
    requestSha256,
    academySourceSha256: corpus.source.sha256,
    academyCorpusSha256: corpus.corpusSha256,
    academyLintSha256,
    traceabilitySha256,
    realizationSha256,
    copySha256,
    conformance,
    humanReviewStatus: "not-claimed",
    engineVersion: LATTICE_COPY_PIN.engineVersion,
    profileVersion: LATTICE_COPY_PIN.profileVersion,
    profileDigest: LATTICE_COPY_PIN.profileDigest,
    implementationAuthority,
  }],
};

await validateAgainstRepositorySchema(LATTICE_COPY_PATHS.generated, generated);
await validateAgainstRepositorySchema(LATTICE_COPY_PATHS.runtime, runtime);
await validateAgainstRepositorySchema(LATTICE_COPY_PATHS.evidence, evidence);
await validateAgainstRepositorySchema(LATTICE_COPY_PATHS.index, index);

const [confirmedSources, confirmedAuthority, confirmedOwnerPackageDigest, confirmedImplementationAuthority] = await Promise.all([
  normalizeSourceCatalog(document.sourceCatalog),
  loadRequirementAuthority(),
  assertOwnerCheckout(ownerRoot),
  createImplementationAuthority(),
]);
if (stableStringify(confirmedSources.records) !== stableStringify(sourceCatalog.records)
  || stableStringify(confirmedAuthority.authorityFiles) !== stableStringify(authority.authorityFiles)
  || confirmedOwnerPackageDigest !== ownerPackageDigest
  || stableStringify(confirmedImplementationAuthority) !== stableStringify(implementationAuthority)) {
  fail("A traceability authority changed during compilation; rerun on one stable working tree.");
}

await emitChangedFiles([
  { relativePath: LATTICE_COPY_PATHS.generated, text: generatedText },
  { relativePath: LATTICE_COPY_PATHS.runtime, text: runtimeText },
  { relativePath: LATTICE_COPY_PATHS.evidence, text: evidenceText },
  { relativePath: LATTICE_COPY_PATHS.index, text: jsonFileText(index) },
]);

console.log(
  `Compiled ${Object.keys(sortedCopy).length} static copy outputs as ${snapshotId}; ${corpus.entryCount} Academy entries received advisory lint coverage in ${academyLint.batchCount} batches.`,
);
