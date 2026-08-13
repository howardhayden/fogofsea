import assert from "node:assert/strict";
import test from "node:test";
import {
  INPUT_LIMITS,
  isSafeIdentifier,
  parseUntrustedJson,
  sanitizeAcademyNote,
  sanitizeSaveName,
  sanitizeWrittenDecision,
} from "../app/inputSecurity";

test("user text is bounded, normalized, and stripped of unsafe control characters", () => {
  assert.equal(sanitizeSaveName("  Fleet\u202E<script>\nName  "), " Fleet<script> Name ");
  assert.equal(sanitizeWrittenDecision("line one\r\nline two\u0000\u2066"), "line one\nline two");
  assert.equal(sanitizeAcademyNote("x".repeat(INPUT_LIMITS.academyNote + 10)).length, INPUT_LIMITS.academyNote);
});

test("untrusted JSON rejects prototype keys and bounded-complexity violations", () => {
  assert.throws(() => parseUntrustedJson('{"__proto__":{"polluted":true}}'), /unsafe object key/i);
  assert.throws(() => parseUntrustedJson('{"constructor":{"prototype":{"polluted":true}}}'), /unsafe object key/i);
  assert.throws(() => parseUntrustedJson(JSON.stringify({ value: "x".repeat(INPUT_LIMITS.portableSaveBytes) })), /2 MB/i);
  const nested = `${"[".repeat(INPUT_LIMITS.jsonDepth + 2)}0${"]".repeat(INPUT_LIMITS.jsonDepth + 2)}`;
  assert.throws(() => parseUntrustedJson(nested), /nested too deeply/i);
});

test("storage identifiers exclude path, markup, and prototype-like keys", () => {
  assert.equal(isSafeIdentifier("game-17234-a9f0"), true);
  assert.equal(isSafeIdentifier("../game"), false);
  assert.equal(isSafeIdentifier("<script>"), false);
  assert.equal(isSafeIdentifier("constructor"), false);
});
