import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import Ajv from "ajv";
import Ajv2020 from "ajv/dist/2020.js";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultRepositoryRoot = path.resolve(scriptDirectory, "..");
const require = createRequire(import.meta.url);
const ajvPackage = require("ajv/package.json");

const DIALECT_URIS = Object.freeze({
  "draft-07": "http://json-schema.org/draft-07/schema#",
  "2020-12": "https://json-schema.org/draft/2020-12/schema",
});

export const LATTICE_SCHEMA_VALIDATOR = Object.freeze({
  engine: "ajv",
  version: "8.17.1",
  dialects: Object.freeze(Object.keys(DIALECT_URIS)),
  options: Object.freeze({
    allErrors: true,
    strictSchema: true,
    strictNumbers: true,
    strictTypes: false,
    strictRequired: false,
    strictTuples: false,
    validateSchema: true,
  }),
});

export const LATTICE_SCHEMA_DOCUMENTS = Object.freeze([
  Object.freeze({
    schemaPath: "requirements/lattice-adoption.schema.json",
    documentPath: "requirements/lattice-adoption.json",
    dialect: "draft-07",
  }),
  Object.freeze({
    schemaPath: "requirements/lattice-copy-inventory.schema.json",
    documentPath: "requirements/lattice-copy-inventory.json",
    dialect: "draft-07",
  }),
  Object.freeze({
    schemaPath: "schemas/lattice-copy-requests.schema.json",
    documentPath: "authoring/lattice-copy.requests.json",
    dialect: "2020-12",
  }),
  Object.freeze({
    schemaPath: "schemas/lattice-copy-generated.schema.json",
    documentPath: "app/generated/lattice-copy.json",
    dialect: "2020-12",
  }),
  Object.freeze({
    schemaPath: "schemas/lattice-copy-runtime.schema.json",
    documentPath: "app/generated/lattice-copy.runtime.json",
    dialect: "2020-12",
  }),
  Object.freeze({
    schemaPath: "schemas/lattice-copy-evidence.schema.json",
    documentPath: "evidence/lattice/current.json",
    dialect: "2020-12",
  }),
  Object.freeze({
    schemaPath: "schemas/lattice-copy-index.schema.json",
    documentPath: "evidence/lattice/index.json",
    dialect: "2020-12",
  }),
]);

function assertValidatorIdentity() {
  if (ajvPackage.version !== LATTICE_SCHEMA_VALIDATOR.version) {
    throw new Error(
      `Lattice schema validation requires ${LATTICE_SCHEMA_VALIDATOR.engine} ${LATTICE_SCHEMA_VALIDATOR.version}; resolved ${String(ajvPackage.version)}.`,
    );
  }
}

function createValidator(dialect) {
  const options = { ...LATTICE_SCHEMA_VALIDATOR.options };
  if (dialect === "draft-07") return new Ajv(options);
  if (dialect === "2020-12") return new Ajv2020(options);
  throw new Error(`Unsupported Lattice JSON Schema dialect ${String(dialect)}.`);
}

function formatErrors(errors) {
  return (errors ?? []).map((error) => {
    const location = error.instancePath || "/";
    return `${location} ${error.message ?? "is invalid"} (${error.schemaPath})`;
  });
}

async function readJson(repositoryRoot, relativePath) {
  let text;
  try {
    text = await readFile(path.join(repositoryRoot, relativePath), "utf8");
  } catch (error) {
    throw new Error(`Could not read ${relativePath} for Lattice schema validation: ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${relativePath} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function validateLatticeDocument({ schema, document, schemaPath, documentPath, dialect }) {
  assertValidatorIdentity();
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    throw new Error(`${schemaPath} must contain a JSON Schema object.`);
  }
  const expectedDialect = DIALECT_URIS[dialect];
  if (!expectedDialect || schema.$schema !== expectedDialect) {
    throw new Error(
      `${schemaPath} must declare ${expectedDialect ?? "a supported JSON Schema dialect"}; received ${String(schema.$schema)}.`,
    );
  }

  const engine = createValidator(dialect);
  let validate;
  try {
    validate = engine.compile(schema);
  } catch (error) {
    throw new Error(`${schemaPath} could not be compiled by the pinned validator: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!validate(document)) {
    const details = formatErrors(validate.errors);
    throw new Error(
      `Lattice schema validation failed for ${documentPath} against ${schemaPath}${details.length ? `:\n- ${details.join("\n- ")}` : "."}`,
    );
  }
  return true;
}

export async function validateLatticeSchemas(repositoryRoot = defaultRepositoryRoot) {
  const root = path.resolve(repositoryRoot);
  for (const entry of LATTICE_SCHEMA_DOCUMENTS) {
    const [schema, document] = await Promise.all([
      readJson(root, entry.schemaPath),
      readJson(root, entry.documentPath),
    ]);
    validateLatticeDocument({ ...entry, schema, document });
  }
  return { documentCount: LATTICE_SCHEMA_DOCUMENTS.length, validator: LATTICE_SCHEMA_VALIDATOR };
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  const result = await validateLatticeSchemas();
  console.log(
    `Validated ${result.documentCount} Lattice documents with ${result.validator.engine} ${result.validator.version} across ${result.validator.dialects.join(" and ")}.`,
  );
}
