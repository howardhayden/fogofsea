export const INPUT_LIMITS = {
  portableSaveBytes: 2_000_000,
  saveName: 60,
  searchQuery: 120,
  academyNote: 4_000,
  writtenDecision: 6_000,
  scenarioText: 12_000,
  recordText: 12_000,
  shortIdentifier: 120,
  jsonDepth: 40,
  jsonNodes: 25_000,
  objectKeys: 1_000,
  arrayItems: 5_000,
} as const;

const UNSAFE_JSON_KEYS = new Set(["__proto__", "prototype", "constructor"]);
function stripUnsafeFormatControls(value: string) {
  return [...value].filter((character) => {
    const code = character.codePointAt(0) ?? 0;
    return !(
      code <= 0x08
      || code === 0x0b
      || code === 0x0c
      || code >= 0x0e && code <= 0x1f
      || code >= 0x7f && code <= 0x9f
      || code >= 0x202a && code <= 0x202e
      || code >= 0x2066 && code <= 0x2069
      || code === 0xfeff
    );
  }).join("");
}

type TextOptions = {
  maxLength: number;
  multiline?: boolean;
};

/**
 * Normalizes text without treating it as markup. React still performs the
 * output escaping; this removes invisible direction overrides, terminal
 * controls, and unbounded payloads before they enter application state.
 */
export function sanitizeText(value: string, { maxLength, multiline = false }: TextOptions) {
  const normalized = stripUnsafeFormatControls(value
    .normalize("NFC")
    .replace(/\r\n?/gu, "\n"));
  const shaped = multiline
    ? normalized.replace(/\t/gu, "  ")
    : normalized.replace(/[\n\t]+/gu, " ");
  return shaped.slice(0, maxLength);
}

export function sanitizeSaveName(value: string) {
  return sanitizeText(value, { maxLength: INPUT_LIMITS.saveName }).replace(/\s{2,}/gu, " ");
}

export function sanitizeSearchQuery(value: string) {
  return sanitizeText(value, { maxLength: INPUT_LIMITS.searchQuery }).replace(/\s{2,}/gu, " ");
}

export function sanitizeWrittenDecision(value: string) {
  return sanitizeText(value, { maxLength: INPUT_LIMITS.writtenDecision, multiline: true });
}

export function sanitizeAcademyNote(value: string) {
  return sanitizeText(value, { maxLength: INPUT_LIMITS.academyNote, multiline: true });
}

export function isBoundedCleanText(value: unknown, maxLength: number, multiline = true): value is string {
  return typeof value === "string"
    && value.length <= maxLength
    && sanitizeText(value, { maxLength, multiline }) === value;
}

export function isSafeIdentifier(value: unknown): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= INPUT_LIMITS.shortIdentifier
    && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value)
    && !UNSAFE_JSON_KEYS.has(value);
}

function assertJsonShape(root: unknown) {
  const stack: Array<{ value: unknown; depth: number }> = [{ value: root, depth: 0 }];
  let nodes = 0;
  while (stack.length) {
    const current = stack.pop();
    if (!current) break;
    nodes += 1;
    if (nodes > INPUT_LIMITS.jsonNodes) throw new Error("Save data is too complex.");
    if (current.depth > INPUT_LIMITS.jsonDepth) throw new Error("Save data is nested too deeply.");
    if (!current.value || typeof current.value !== "object") continue;
    if (Array.isArray(current.value)) {
      if (current.value.length > INPUT_LIMITS.arrayItems) throw new Error("Save data contains an oversized list.");
      current.value.forEach((value) => stack.push({ value, depth: current.depth + 1 }));
      continue;
    }
    const keys = Object.keys(current.value);
    if (keys.length > INPUT_LIMITS.objectKeys) throw new Error("Save data contains an oversized object.");
    for (const key of keys) {
      if (UNSAFE_JSON_KEYS.has(key)) throw new Error("Save data contains an unsafe object key.");
      stack.push({ value: (current.value as Record<string, unknown>)[key], depth: current.depth + 1 });
    }
  }
}

export function parseUntrustedJson(text: string): unknown {
  if (new TextEncoder().encode(text).byteLength > INPUT_LIMITS.portableSaveBytes) {
    throw new Error("Save data exceeds the 2 MB local limit.");
  }
  const value: unknown = JSON.parse(text, (key, candidate: unknown) => {
    if (UNSAFE_JSON_KEYS.has(key)) throw new Error("Save data contains an unsafe object key.");
    return candidate;
  });
  assertJsonShape(value);
  return value;
}
