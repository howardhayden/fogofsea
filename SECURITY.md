# Security model

FOG OF SEA is a local-first static application. It has no account, application server, database, telemetry endpoint, advertising code, or third-party runtime asset. The deployed build is served as Cloudflare Workers static assets; Cloudflare can receive ordinary HTTP request metadata but the application sends it no decisions, saves, Academy progress, or telemetry. The bundled launcher binds only to `127.0.0.1`, rejects an unexpected Host header and unsupported methods, disables caching, and applies the same restrictive response policy that blocks external connections, scripts, frames, media, objects, and form submission.

## Input trust boundary

All text typed into saved-game names, catalog search, Academy notes, and written decisions passes through one bounded normalization layer before entering application state. It normalizes Unicode, removes terminal controls and bidirectional override or isolate controls, restricts line structure by field, and enforces field-specific length limits. Text remains text: the interface relies on the browser framework’s output escaping and does not evaluate or insert user content as markup.

Portable save imports are treated as untrusted data. Files are limited to two megabytes; parsing rejects prototype-related keys, excessive nesting, oversized arrays or objects, unsafe identifiers, unknown catalog entries, invalid domain values, malformed history, non-finite ranges, and inconsistent game state. The current or resumable command record in a current-format save is also replayed from roster-derived readiness and its exact recorded orders; altered committed draws, probability ranges, matrix inputs, reports, deltas, state, or outcomes are rejected even when the altered fields are internally self-consistent. Version 4 additionally requires each resolved current-state turn to retain its typed opposing-action, infliction, and observation-domain arrays, and every post-first-turn report must contain a complete bounded adversary assessment. Structurally valid changes to those typed records still fail canonical replay. Pending partial assessments are accepted only when every present value belongs to the option set derived from the restored public picture. Older archived decision-history entries are bounded and sanitized but are not replay-verifiable because their schema does not retain the complete matrix commitment; they are non-authoritative notes and never determine the restored current game. The same validation applies before imported data reaches the reducer. Browser-save index entries use the same safe parser and identifier policy.

Exports are plain text with an embedded versioned data block. The readable
record contains the player-visible, as-known intelligence log: current
observations, modeled inflictions, recorded staff judgments, and absolute facts
grouped by occurrence and discovery turn. It omits concealed actions, hidden
matrix values, committed draws, raw umpire notes, and internal disruption IDs.
Whenever a command state contains a matrix, the complete restorable payload is
base64-encoded; encoding prevents casual preview but is not encryption.
Completion does not promote concealed world state into readable truth. Exports
never execute imported text. Players should still treat files received from
other people as untrusted and should not rename them to executable formats.

## Storage and privacy

Session-only play keeps state in memory. Opt-in browser saving uses unencrypted `localStorage` on the stable loopback origin. Anyone with access to the same browser profile may be able to read it. Free-form analysis is excluded by default; inclusion is a per-slot policy restored before automatic saving. The game never attempts to read unrelated browser storage.

## Dependency and browser boundary

Direct package versions are exact, lockfile integrity values are retained, dependency licenses are allowlisted, notices and software inventories are generated, and known-vulnerability checks are part of release review. The production build emits no source maps and references only bundled local assets. No application code requests a remote origin.

Browser and operating-system defects, compromised extensions, a compromised local machine, and physical access to an unlocked browser profile remain outside the application’s control. This document describes implemented defenses and automated evidence, not an absolute guarantee.

## Lattice owner/runtime boundary

Lattice is an owner-side static-copy dependency, not a browser runtime
dependency. Compilation is pinned to engine `0.1.1`, relational-systems profile
`v1.0.0`, profile digest
`379ed01484574edc779efdc502ffbd6d9b8ffef3c9154fb027b0f0c8475ed21a`,
and derived owner-package digest
`58648d097c863090a95f48ebca2b20d5a6f6c2b832c915b9bac04f479d51d3b0`.
The release carries only the current canonical text rendering. Request atoms,
candidate sets, assertions, receipts, source-symbol catalog, traceability, and
review metadata remain owner-side and are prohibited from every emitted
textual asset. Source hashes prove identity and drift detection, not semantic
truth, domain approval, or human review.

The derived owner-package digest covers the pinned commit, package metadata,
profile definition, and complete imported engine module graph. The owner
workflow hashes those clean-checkout bytes before and after realization. A
separate fourteen-file implementation-authority digest binds the package
manifest and lockfile, all seven governing schemas, the compiler, corpus
extractor, pinned Ajv schema validator and declaration, and offline verifier;
changing any of those gates or locked dependencies requires a new snapshot.
Both compilation and offline verification execute the declared Draft-07 or
Draft 2020-12 schema before accepting a governed document.
