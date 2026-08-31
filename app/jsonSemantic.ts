/**
 * Compare JSON-shaped values without treating object insertion order as data.
 * Array order remains significant because it is part of JSON semantics.
 *
 * Callers should validate untrusted input before using this helper: it is an
 * equality check, not a schema validator or a defense against cyclic objects.
 */
export function jsonSemanticEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") return false;

  const leftIsArray = Array.isArray(left);
  if (leftIsArray !== Array.isArray(right)) return false;
  if (leftIsArray) {
    const leftItems = left as unknown[];
    const rightItems = right as unknown[];
    return leftItems.length === rightItems.length
      && leftItems.every((item, index) => jsonSemanticEqual(item, rightItems[index]));
  }

  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => key === rightKeys[index]
      && jsonSemanticEqual(leftRecord[key], rightRecord[key]));
}
