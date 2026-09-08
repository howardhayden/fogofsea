import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");

export const LATTICE_COPY_REQUEST_SCHEMA = "fog-of-sea.lattice-copy.requests.v2";
export const LATTICE_COPY_GENERATED_SCHEMA = "fog-of-sea.lattice-copy.generated.v2";
export const LATTICE_COPY_RUNTIME_SCHEMA = "fog-of-sea.lattice-copy.runtime.v1";
export const LATTICE_COPY_EVIDENCE_SCHEMA = "fog-of-sea.lattice-copy.evidence.v2";
export const LATTICE_COPY_INDEX_SCHEMA = "fog-of-sea.lattice-copy.index.v2";
export const LATTICE_ACADEMY_CORPUS_SCHEMA = "fog-of-sea.lattice-copy.academy-corpus.v1";

export const LATTICE_COPY_REQUEST_IDS = Object.freeze([
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

export const LATTICE_COPY_PUBLISH_IDS = Object.freeze([
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

export const LATTICE_COPY_SOURCE_IDS = Object.freeze([
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

export const LATTICE_COPY_PATHS = Object.freeze({
  request: "authoring/lattice-copy.requests.json",
  generated: "app/generated/lattice-copy.json",
  runtime: "app/generated/lattice-copy.runtime.json",
  evidence: "evidence/lattice/current.json",
  index: "evidence/lattice/index.json",
  academySource: "app/academyData.ts",
});

export const LATTICE_COPY_PIN = Object.freeze({
  engineName: "Lattice — Layered Register Engine",
  engineVersion: "0.1.1",
  profileId: "relational-systems",
  profileVersion: "v1.0.0",
  profileDigest: "379ed01484574edc779efdc502ffbd6d9b8ffef3c9154fb027b0f0c8475ed21a",
  ownerPackageDigest: "58648d097c863090a95f48ebca2b20d5a6f6c2b832c915b9bac04f479d51d3b0",
});

export const LATTICE_COPY_PROVENANCE = Object.freeze({
  fogBaselineCommit: "70907a77cba735c151e52929dd5a56d795c3d04f",
  latticeCommit: "d6cc85b275e3f14163a5a547f626832fd21b27b0",
  requestAuthority: "FOG OF SEA source-controlled authoring contract",
});

// The owner package identity covers the complete module graph imported from
// dist/index.js, the profile definition loaded by that graph, and package.json.
// The digest is SHA-256 over stableStringify(LATTICE_OWNER_PACKAGE_MANIFEST).
// Keeping this manifest closed makes the compiler prove the bytes it actually
// executes instead of accepting an opaque digest asserted by the host request.
export const LATTICE_OWNER_PACKAGE_MANIFEST = Object.freeze({
  format: "fog-of-sea.lattice-owner-package-manifest.v1",
  algorithm: "sha256-stable-json-v1",
  commit: LATTICE_COPY_PROVENANCE.latticeCommit,
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

export const LATTICE_IMPLEMENTATION_AUTHORITY_PATHS = Object.freeze([
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

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort((left, right) => left.localeCompare(right, "en"))
        .map((key) => [key, canonical(value[key])]),
    );
  }
  return value;
}

export function stableStringify(value) {
  return JSON.stringify(canonical(value));
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function jsonFileText(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export async function digestFiles(relativePaths) {
  const records = [];
  for (const relativePath of [...relativePaths].sort((left, right) => left.localeCompare(right, "en"))) {
    const bytes = await readFile(path.join(repositoryRoot, relativePath));
    records.push({ path: relativePath, sha256: sha256(bytes) });
  }
  return records;
}

const academyRoots = new Set([
  "PATHS",
  "ACADEMY_MODULE_DEFINITIONS",
  "THINKER_COMPARISON",
  "THINKER_CLUSTERS",
  "SOURCE_GROUPS",
]);
const excludedAcademyRoles = new Set(["id", "paths", "href"]);

function propertyName(node, sourceFile) {
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

export async function createAcademyCopyCorpus() {
  const relativePath = LATTICE_COPY_PATHS.academySource;
  const sourceBytes = await readFile(path.join(repositoryRoot, relativePath));
  const sourceText = sourceBytes.toString("utf8");
  const sourceFile = ts.createSourceFile(relativePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const entries = [];
  let sequence = 0;

  const collect = (node, section) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const role = propertyName(node, sourceFile);
      if (!excludedAcademyRoles.has(role)) {
        sequence += 1;
        entries.push({
          id: `academy-copy-${String(sequence).padStart(4, "0")}`,
          text: node.text,
          role,
          section,
          sourcePath: relativePath,
        });
      }
    }
    ts.forEachChild(node, (child) => collect(child, section));
  };

  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !academyRoots.has(declaration.name.text) || !declaration.initializer) continue;
      collect(declaration.initializer, declaration.name.text);
    }
  }

  if (entries.length !== 1_011) {
    throw new Error(`Academy corpus extraction expected 1011 entries but found ${entries.length}.`);
  }
  const roles = {};
  const sections = {};
  for (const entry of entries) {
    roles[entry.role] = (roles[entry.role] ?? 0) + 1;
    sections[entry.section] = (sections[entry.section] ?? 0) + 1;
  }
  return {
    schemaVersion: LATTICE_ACADEMY_CORPUS_SCHEMA,
    source: { path: relativePath, sha256: sha256(sourceBytes) },
    entryCount: entries.length,
    characterCount: entries.reduce((count, entry) => count + entry.text.length, 0),
    roles,
    sections,
    corpusSha256: sha256(stableStringify(entries)),
    entries,
  };
}

export function createAcademyLintBatches(entries) {
  if (!Array.isArray(entries) || entries.length !== 1_011) {
    throw new Error("Academy lint batching requires the canonical 1011-entry corpus.");
  }
  const midpoint = Math.ceil(entries.length / 2);
  return [entries.slice(0, midpoint), entries.slice(midpoint)].map((batchEntries, index) => {
    const text = batchEntries.map((entry) => entry.text).join("\n");
    return Object.freeze({
      id: `academy-lint-${index + 1}-of-2`,
      entryIds: Object.freeze(batchEntries.map((entry) => entry.id)),
      entryCount: batchEntries.length,
      text,
      textSha256: sha256(text),
    });
  });
}
