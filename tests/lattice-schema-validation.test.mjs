import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  validateLatticeDocument,
  validateLatticeSchemas,
} from "../scripts/validate-lattice-schemas.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const canonicalDocuments = Object.freeze([
  {
    schemaPath: "requirements/lattice-adoption.schema.json",
    documentPath: "requirements/lattice-adoption.json",
    dialect: "draft-07",
  },
  {
    schemaPath: "requirements/lattice-copy-inventory.schema.json",
    documentPath: "requirements/lattice-copy-inventory.json",
    dialect: "draft-07",
  },
  {
    schemaPath: "schemas/lattice-copy-requests.schema.json",
    documentPath: "authoring/lattice-copy.requests.json",
    dialect: "2020-12",
  },
  {
    schemaPath: "schemas/lattice-copy-generated.schema.json",
    documentPath: "app/generated/lattice-copy.json",
    dialect: "2020-12",
  },
  {
    schemaPath: "schemas/lattice-copy-runtime.schema.json",
    documentPath: "app/generated/lattice-copy.runtime.json",
    dialect: "2020-12",
  },
  {
    schemaPath: "schemas/lattice-copy-evidence.schema.json",
    documentPath: "evidence/lattice/current.json",
    dialect: "2020-12",
  },
  {
    schemaPath: "schemas/lattice-copy-index.schema.json",
    documentPath: "evidence/lattice/index.json",
    dialect: "2020-12",
  },
]);

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(repositoryRoot, relativePath), "utf8"));
}

async function loadRequestValidationInput() {
  const schemaPath = "schemas/lattice-copy-requests.schema.json";
  const documentPath = "authoring/lattice-copy.requests.json";
  const [schema, document] = await Promise.all([
    readJson(schemaPath),
    readJson(documentPath),
  ]);
  return { schema, document, schemaPath, documentPath, dialect: "2020-12" };
}

async function expectRequestSchemaFailure(document, expectedPath, expectedRule) {
  const input = await loadRequestValidationInput();
  await assert.rejects(
    async () => validateLatticeDocument({ ...input, document }),
    (error) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /authoring\/lattice-copy\.requests\.json/u);
      assert.match(error.message, expectedPath);
      assert.match(error.message, expectedRule);
      return true;
    },
  );
}

test("all seven canonical Lattice governance documents satisfy their executable schemas", async () => {
  assert.equal(canonicalDocuments.length, 7);

  for (const entry of canonicalDocuments) {
    const [schema, document] = await Promise.all([
      readJson(entry.schemaPath),
      readJson(entry.documentPath),
    ]);
    await validateLatticeDocument({ ...entry, schema, document });
  }

  await validateLatticeSchemas(repositoryRoot);
});

test("request revision is rejected by the schema's version pattern", async () => {
  const { document } = await loadRequestValidationInput();
  document.revision = "!";

  await expectRequestSchemaFailure(document, /\/revision/u, /pattern/u);
});

test("request review authority is rejected unless it matches the schema constant", async () => {
  const { document } = await loadRequestValidationInput();
  document.requests[0].review.authority = "arbitrary authority";

  await expectRequestSchemaFailure(
    document,
    /\/requests\/0\/review\/authority/u,
    /(?:const|constant)/u,
  );
});

test("the pinned validator rejects unknown schema keywords", async () => {
  const input = await loadRequestValidationInput();
  input.schema.requried = ["schemaVersion"];

  assert.throws(
    () => validateLatticeDocument(input),
    /unknown keyword: "requried"/u,
  );
});

test("the pinned validator rejects non-finite in-memory numbers", async () => {
  const input = await loadRequestValidationInput();
  input.document.requests[0].context.audience.readingLevel = Number.POSITIVE_INFINITY;

  assert.throws(
    () => validateLatticeDocument(input),
    /\/requests\/0\/context\/audience\/readingLevel must be integer/u,
  );
});
