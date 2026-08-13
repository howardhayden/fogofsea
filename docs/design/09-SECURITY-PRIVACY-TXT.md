# 09 — Security, Privacy, and TXT Interchange

This document complements the concise root [Security model](../../SECURITY.md). It describes the product-facing threat model, player journeys, and design requirements around storage and portable files.

## 1. Security and privacy objectives

1. Run as a self-contained static application with no application account, server, database, advertising, or gameplay telemetry.
2. Write no new browser data until the player explicitly opts in.
3. Minimize browser-saved content and exclude free-form writing by default.
4. Treat browser storage, typed text, and imported TXT as untrusted inputs.
5. Prevent malformed or tampered state from entering the session reducer.
6. Preserve a human-readable record without casually exposing unrevealed command commitments.
7. Describe limits accurately; never present encoding or local storage as confidentiality.

## 2. Assets and adversaries

### Assets

- current session and phase;
- saved rosters, decisions, command state, and history;
- free-form analysis and Academy notes;
- unrevealed scenario commitments;
- player trust in deterministic adjudication;
- integrity of the local release and dependency graph.

### Threats considered

- malformed, oversized, deeply nested, or prototype-oriented imported data;
- unknown catalog IDs and invalid domain values;
- altered turn reports, deltas, probability commitments, draws, or outcomes;
- stale or corrupt localStorage index/slot data;
- accidental persistence of written analysis;
- casual disclosure of future events in active TXT records;
- external asset/network injection;
- dependency or license drift;
- accidental serving beyond loopback or through an unexpected Host header.

### Explicitly outside application control

- compromised browser, extension, operating system, local machine, or dependency registry;
- physical access to an unlocked browser profile or exported file;
- user redistribution of TXT content;
- ordinary request metadata visible to a hosting provider;
- defects in browser security primitives.

## 3. Data inventory

| Data | Session only | Browser save | TXT export | Scored? |
| --- | --- | --- | --- | --- |
| Scenario and environment | Memory | Yes | Yes | Conditions affect rules |
| Strategic selections | Memory | Yes | Yes | Yes, discrete choices only |
| Force/aviation/packs | Memory | Yes | Yes | Yes |
| Command orders/state/reports | Memory | Yes | Yes | Yes |
| Theme/difficulty/stage/guidance | Memory | Yes | Yes | Difficulty affects rules; others do not |
| Academy completion | Memory | Yes when saving enabled | Yes | No |
| Theory synthesis/rationale/assumptions/termination | Memory | Excluded by default; explicit per-slot opt-in | Always readable | Never |
| Unrevealed matrix commitments | Memory | In canonical state | Encoded inside active resume block | Used when turn arrives |

Browser storage and TXT files are unencrypted. Anyone with access to the profile or file may be able to read them.

## 4. Runtime boundary

The bundled launcher:

- binds to `127.0.0.1` only;
- serves the optimized `dist` release;
- rejects unexpected Host headers and unsupported methods;
- disables caching;
- applies restrictive content-security, framing, referrer, permissions, resource, and MIME-sniffing policies;
- stops on port conflict rather than terminating another process or choosing a silent replacement.

Production assets are bundled locally. The application initiates no remote runtime request. Package installation and dependency auditing contact the configured npm registry outside gameplay.

## 5. Input normalization

All persistent or searchable text crosses one bounded normalization layer:

- Unicode normalization to NFC;
- terminal control and bidirectional override/isolate removal;
- field-specific single-line or multiline handling;
- field-specific maximum length;
- framework output escaping rather than markup insertion;
- safe-identifier constraints for IDs.

Current principal limits include:

| Input | Maximum |
| --- | ---: |
| Imported TXT | 2 MB |
| Save name | 60 characters |
| Search | 120 characters |
| Academy note | 4,000 characters |
| Written decision field | 6,000 characters |
| Scenario/record text | 12,000 characters |
| Parsed nesting | 40 levels |
| Parsed nodes | 25,000 |
| Object keys | 1,000 |
| Array items | 5,000 |

The safe parser rejects prototype-related keys and non-finite or structurally excessive values.

## 6. Browser-save lifecycle

```text
undecided
  ├─ session only -> no new browser writes
  └─ saving enabled
       -> bounded game name
       -> per-slot prose inclusion policy
       -> minimized portable state
       -> localStorage slot + bounded index metadata
       -> validated load before state replacement
```

### Required behaviors

- Session-only remains a complete play path.
- Disabling saving stops future writes but does not silently delete slots.
- Prose inclusion is associated with the active slot and restored before automatic saving.
- Turning inclusion off omits current and historical free-form notes from that browser slot.
- Older prose-containing slots infer a safe, explicit policy during migration.
- The app reads only its own bounded keys.
- Delete-one and reset-all use separate destructive confirmations.

## 7. Portable TXT anatomy

```text
FOG OF SEA header and privacy statement
saved time / exercise / difficulty / phase
fixed environment and scenario narrative
strategy and force selections
current rigid state and disclosed turn reports
optional writing
decision history and debrief records
--- machine-data start marker ---
versioned portable save JSON
or encoded active resume payload
--- machine-data end marker ---
```

The readable section is useful for review without importing. The machine section is required for restoration and should remain intact.

### Active command export

If a command is active, the complete resume state includes future precommitted draws and scheduled events. The machine JSON is therefore base64-encoded to avoid casual preview. This is obfuscation for fair play, not encryption or access control.

### Completed export

Completed records disclose resolved commitments in the readable turn record. The machine section remains versioned for restoration.

## 8. Import validation sequence

An import is accepted atomically only after:

1. file size and marker extraction;
2. optional active-payload decoding;
3. bounded untrusted JSON parse;
4. format and supported version check;
5. scenario shape/domain validation or bounded legacy migration;
6. catalog allowlist and roster-count validation;
7. bounded clean text and safe identifier checks;
8. strategic selection and preference validation;
9. result, history, orders, and rigid-state shape validation;
10. scenario matrix recreation and exact equality check;
11. force-readiness derivation from imported roster;
12. canonical replay of the current command chain;
13. exact outcome/result consistency check;
14. reducer/state replacement only after complete success.

For current-format saves, replay rejects altered committed draws, ranges, inputs, reports, deltas, state, and outcomes even when the altered values look internally consistent. Older archived history lacks all modern commitments; it is sanitized, bounded, non-authoritative review content and never controls restored current state.

## 9. Privacy interaction requirements

- Explain storage at the moment of choice, not only in a policy file.
- Use equal visual weight for session-only and browser-saving paths.
- Repeat the unencrypted-profile warning in Save/Load.
- Place the prose-inclusion choice beside the fields it affects and in save controls.
- State that import/export is processed on the device.
- State that TXT always includes written analysis.
- Never auto-upload, email, or sync a save.
- Never imply that clearing app storage removes copies the player exported elsewhere.

## 10. Dependency and release controls

- Exact direct versions and lockfile integrity.
- Allowlisted code licenses and explicit font/data exceptions.
- Generated third-party notices and full license text.
- Complete and production SPDX software bills of materials.
- Known-vulnerability audit in release review.
- Production build without source maps.
- Content scan for prohibited external runtime references or misleading claims.
- Artifact validator checks archive completeness and freshness.

## 11. Security UX error copy

Errors should identify the failed boundary without echoing untrusted content unnecessarily:

- “The file is larger than the 2 MB import limit.”
- “The save format or version is not supported.”
- “The force roster contains an unknown or invalid entry.”
- “The command record does not replay from its committed scenario state.”
- “Browser saving failed; the current session remains active. Download a TXT save if you want a portable copy.”

Do not say “corrupt” when the cause is only unsupported version, and do not expose parser internals or stack traces in player-facing status.

## 12. Review checklist

- Does any new field contain personal or free-form data?
- Is it canonical, derived, browser-saved, exported, or scored?
- Does session-only still write nothing new?
- Does browser minimization remove the new field when appropriate?
- Is import bounded, allowlisted, and replay-validated?
- Can readable export leak an unrevealed commitment?
- Does migration preserve the privacy policy?
- Are runtime requests still local/bundled?
- Are licenses, notices, SBOM, and vulnerability checks current?
- Are residual limits stated without an absolute security claim?

