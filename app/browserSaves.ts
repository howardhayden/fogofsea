import { minimizePortableSaveForBrowser, parsePortableSave, type PortableSave } from "./saveGame";
import { INPUT_LIMITS, isSafeIdentifier, parseUntrustedJson, sanitizeSaveName, sanitizeText } from "./inputSecurity";

const SAVE_INDEX_KEY = "fog-of-sea-save-index-v1";
const SAVE_SLOT_PREFIX = "fog-of-sea-save-v1:";

export type SaveSlotMeta = {
  id: string;
  name: string;
  updatedAt: string;
  operation: string;
  exercise: number;
  /** Undefined identifies a slot created before per-slot retention policy existed. */
  includeWrittenAnalysis?: boolean;
};

export type BrowserSaveWrite = {
  slotId: string;
  name: string;
  save: PortableSave;
  includeWrittenAnalysis: boolean;
};

function storageOrThrow(storage?: Storage) {
  const resolved = storage ?? window.localStorage;
  if (!resolved) throw new Error("Browser storage is unavailable.");
  return resolved;
}

export function readSaveIndex(storage?: Storage): SaveSlotMeta[] {
  try {
    const parsed = parseUntrustedJson(storageOrThrow(storage).getItem(SAVE_INDEX_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is SaveSlotMeta => {
      if (!item || typeof item !== "object") return false;
      const candidate = item as Record<string, unknown>;
      return isSafeIdentifier(candidate.id)
        && typeof candidate.name === "string" && candidate.name.length <= INPUT_LIMITS.saveName
        && typeof candidate.updatedAt === "string"
        && typeof candidate.operation === "string"
        && Number.isInteger(candidate.exercise)
        && (candidate.includeWrittenAnalysis === undefined || typeof candidate.includeWrittenAnalysis === "boolean");
    }).slice(0, 100).map((item) => ({
      ...item,
      name: sanitizeSaveName(item.name),
      operation: sanitizeText(item.operation, { maxLength: INPUT_LIMITS.scenarioText }),
    })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export function createSlotId() {
  return `game-${Date.now()}-${crypto.getRandomValues(new Uint32Array(1))[0].toString(16)}`;
}

export function portableSaveContainsWrittenAnalysis(save: PortableSave) {
  const current = [save.game.theorySynthesis, save.game.rationale, save.game.assumptions, save.game.termination];
  const historical = save.game.history.flatMap((entry) => [entry.theorySynthesis, entry.rationale, entry.assumptions, entry.termination]);
  return [...current, ...historical].some((value) => Boolean(value?.trim()));
}

export function resolveWrittenAnalysisPolicy(slot: SaveSlotMeta, save: PortableSave) {
  return slot.includeWrittenAnalysis ?? portableSaveContainsWrittenAnalysis(save);
}

export function readBrowserSave(slotId: string, storage?: Storage) {
  if (!isSafeIdentifier(slotId)) throw new Error("This browser save identifier is invalid.");
  const raw = storageOrThrow(storage).getItem(`${SAVE_SLOT_PREFIX}${slotId}`);
  if (!raw) throw new Error("This browser save is missing.");
  if (new TextEncoder().encode(raw).byteLength > INPUT_LIMITS.portableSaveBytes) throw new Error("This browser save exceeds the local size limit.");
  return parsePortableSave(raw);
}

export function writeBrowserSave(input: BrowserSaveWrite, storage?: Storage) {
  if (!isSafeIdentifier(input.slotId)) throw new Error("This browser save identifier is invalid.");
  const target = storageOrThrow(storage);
  const persistedSave = input.includeWrittenAnalysis ? input.save : minimizePortableSaveForBrowser(input.save);
  target.setItem(`${SAVE_SLOT_PREFIX}${input.slotId}`, JSON.stringify(persistedSave));
  const meta: SaveSlotMeta = {
    id: input.slotId,
    name: sanitizeSaveName(input.name).trim() || "Untitled game",
    updatedAt: persistedSave.savedAt,
    operation: persistedSave.game.scenario.operation,
    exercise: persistedSave.game.scenario.id,
    includeWrittenAnalysis: input.includeWrittenAnalysis,
  };
  const next = [meta, ...readSaveIndex(target).filter((item) => item.id !== input.slotId)]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  target.setItem(SAVE_INDEX_KEY, JSON.stringify(next));
  return { save: persistedSave, meta, index: next };
}

export function deleteBrowserSave(slotId: string, storage?: Storage) {
  if (!isSafeIdentifier(slotId)) throw new Error("This browser save identifier is invalid.");
  const target = storageOrThrow(storage);
  target.removeItem(`${SAVE_SLOT_PREFIX}${slotId}`);
  const next = readSaveIndex(target).filter((item) => item.id !== slotId);
  target.setItem(SAVE_INDEX_KEY, JSON.stringify(next));
  return next;
}

export function clearBrowserSaves(storage?: Storage) {
  const target = storageOrThrow(storage);
  const keys = Array.from({ length: target.length }, (_, index) => target.key(index))
    .filter((key): key is string => Boolean(key?.startsWith(SAVE_SLOT_PREFIX)));
  for (const key of keys) target.removeItem(key);
  target.removeItem(SAVE_INDEX_KEY);
}
