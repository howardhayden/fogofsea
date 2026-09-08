export type LatticeSchemaDialect = "draft-07" | "2020-12";

export interface LatticeSchemaDocumentRoute {
  readonly schemaPath: string;
  readonly documentPath: string;
  readonly dialect: LatticeSchemaDialect;
}

export interface LatticeSchemaValidationInput extends LatticeSchemaDocumentRoute {
  schema: Record<string, unknown>;
  document: unknown;
}

export interface LatticeSchemaValidatorIdentity {
  readonly engine: "ajv";
  readonly version: "8.17.1";
  readonly dialects: readonly LatticeSchemaDialect[];
  readonly options: Readonly<{
    allErrors: true;
    strictSchema: true;
    strictNumbers: true;
    strictTypes: false;
    strictRequired: false;
    strictTuples: false;
    validateSchema: true;
  }>;
}

export const LATTICE_SCHEMA_VALIDATOR: LatticeSchemaValidatorIdentity;
export const LATTICE_SCHEMA_DOCUMENTS: readonly LatticeSchemaDocumentRoute[];

export function validateLatticeDocument(input: LatticeSchemaValidationInput): true;

export function validateLatticeSchemas(repositoryRoot?: string): Promise<{
  documentCount: number;
  validator: LatticeSchemaValidatorIdentity;
}>;
