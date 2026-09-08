import runtimePayload from "./generated/lattice-copy.runtime.json";

export const LATTICE_COPY_IDS = [
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
] as const;

export type LatticeCopyId = typeof LATTICE_COPY_IDS[number];

export const LATTICE_LEARNING_COPY_IDS = [
  "game.learning.turn.clear",
  "game.learning.turn.uncertainty",
  "game.learning.outcome.pending",
  "game.learning.outcome.clear",
  "game.learning.outcome.uncertainty",
  "game.learning.outcome.adjustment",
] as const satisfies readonly LatticeCopyId[];

export type LatticeLearningCopyId = typeof LATTICE_LEARNING_COPY_IDS[number];

function loadRuntimeCopy(): Readonly<Record<LatticeCopyId, string>> {
  const payload = runtimePayload as unknown;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("The compiled Lattice copy payload is invalid.");
  }
  const record = payload as Record<string, unknown>;
  const envelopeFields = Object.keys(record).sort((left, right) => left.localeCompare(right, "en"));
  if (envelopeFields.join("\n") !== ["copy", "copySha256", "schemaVersion", "snapshotId"].join("\n")
    || record.schemaVersion !== "fog-of-sea.lattice-copy.runtime.v1"
    || typeof record.snapshotId !== "string"
    || !/^lattice-copy-[a-f0-9]{24}$/u.test(record.snapshotId)
    || typeof record.copySha256 !== "string"
    || !/^[a-f0-9]{64}$/u.test(record.copySha256)
    || !record.copy || typeof record.copy !== "object" || Array.isArray(record.copy)) {
    throw new Error("The compiled Lattice copy payload is invalid.");
  }
  const copy = record.copy as Record<string, unknown>;
  const expectedIds = [...LATTICE_COPY_IDS].sort((left, right) => left.localeCompare(right, "en"));
  const receivedIds = Object.keys(copy).sort((left, right) => left.localeCompare(right, "en"));
  if (expectedIds.length !== receivedIds.length || expectedIds.some((id, index) => id !== receivedIds[index])) {
    throw new Error("The compiled Lattice copy payload does not match the application contract.");
  }
  for (const id of LATTICE_COPY_IDS) {
    const text = copy[id];
    if (typeof text !== "string" || !text.trim()) {
      throw new Error(`The compiled Lattice copy payload is missing ${id}.`);
    }
  }
  return copy as Record<LatticeCopyId, string>;
}

const runtimeCopy = loadRuntimeCopy();

/** Return only publishable text; owner-engine metadata never enters app code. */
export function latticeCopy(id: LatticeCopyId): string {
  return runtimeCopy[id];
}

/** Split the closed one-line-heading/one-line-summary learning contract. */
export function latticeLearningCopy(id: LatticeLearningCopyId): { heading: string; summary: string } {
  const text = latticeCopy(id);
  const lines = text.split("\n");
  if (lines.length !== 2 || !lines[0].trim() || !lines[1].trim()) {
    throw new Error(`The compiled Lattice learning copy is invalid for ${id}.`);
  }
  return { heading: lines[0], summary: lines[1] };
}
