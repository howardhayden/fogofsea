# Security model

FOG OF SEA is a local static application. It has no account, application server, database, telemetry endpoint, advertising code, or third-party runtime asset. The bundled launcher binds only to `127.0.0.1`, rejects an unexpected Host header and unsupported methods, disables caching, and applies a restrictive response policy that blocks external connections, scripts, frames, media, objects, and form submission.

## Input trust boundary

All text typed into saved-game names, catalog search, Academy notes, and written decisions passes through one bounded normalization layer before entering application state. It normalizes Unicode, removes terminal controls and bidirectional override or isolate controls, restricts line structure by field, and enforces field-specific length limits. Text remains text: the interface relies on the browser framework’s output escaping and does not evaluate or insert user content as markup.

Portable save imports are treated as untrusted data. Files are limited to two megabytes; parsing rejects prototype-related keys, excessive nesting, oversized arrays or objects, unsafe identifiers, unknown catalog entries, invalid domain values, malformed history, non-finite ranges, and inconsistent game state. The current or resumable command record in a current-format save is also replayed from roster-derived readiness and its exact recorded orders; altered committed draws, probability ranges, matrix inputs, reports, deltas, state, or outcomes are rejected even when the altered fields are internally self-consistent. Older archived decision-history entries are bounded and sanitized but are not replay-verifiable because their schema does not retain the complete matrix commitment; they are non-authoritative notes and never determine the restored current game. The same validation applies before imported data reaches the reducer. Browser-save index entries use the same safe parser and identifier policy.

Exports are plain text with an embedded versioned data block. During an active command, unrevealed events and objectives remain only inside a base64-encoded resume payload; encoding prevents casual preview but is not encryption. Completed exports disclose the full resolved record. Exports never execute imported text. Players should still treat files received from other people as untrusted and should not rename them to executable formats.

## Storage and privacy

Session-only play keeps state in memory. Opt-in browser saving uses unencrypted `localStorage` on the stable loopback origin. Anyone with access to the same browser profile may be able to read it. Free-form analysis is excluded by default; inclusion is a per-slot policy restored before automatic saving. The game never attempts to read unrelated browser storage.

## Dependency and browser boundary

Direct package versions are exact, lockfile integrity values are retained, dependency licenses are allowlisted, notices and software inventories are generated, and known-vulnerability checks are part of release review. The production build emits no source maps and references only bundled local assets. No application code requests a remote origin.

Browser and operating-system defects, compromised extensions, a compromised local machine, and physical access to an unlocked browser profile remain outside the application’s control. This document describes implemented defenses and automated evidence, not an absolute guarantee.
