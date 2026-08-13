# 07 — Service Blueprint

## 1. Service definition

FOG OF SEA is delivered as a self-contained static browser application. There is no application backend, account service, telemetry pipeline, or cloud-save operator. The “service” is therefore the coordinated behavior of the player’s browser, local application code, local storage choice, portable files, build/release process, and documentation.

## 2. Blueprint lanes

- **Player actions:** what the player does.
- **Frontstage:** visible interface, copy, graphics, sound, and feedback.
- **Backstage:** client-side models and state transitions not directly manipulated.
- **Local support:** browser capabilities, storage, filesystem download/upload, loopback server.
- **Release support:** build, tests, dependency controls, artifacts, documentation.
- **Evidence and recovery:** how correctness is observed and how failure is contained.

## 3. End-to-end blueprint

| Stage | Player actions | Frontstage | Backstage | Local / release support | Evidence and recovery |
| --- | --- | --- | --- | --- | --- |
| Acquire and start | Extract archive; run `npm run play`; open loopback URL | Printed local address; app shell | Static launcher validates path/method/host and serves `dist` | Node.js, loopback port 5173, bundled assets | Port-in-use stops safely; headers/build verified |
| Establish trust | Read privacy; choose difficulty and storage mode | Modal disclosure; session/save choices; saved-slot list | Hydration, preference setup, slot index parse | Memory or `localStorage` only | Invalid index rejected; no write before opt-in |
| Generate exercise | Start or request new scenario | Atomic new brief and world | Compose candidate; validate 10 coupled facets; retry/fallback | Local entropy; deterministic fallback | No partial candidate; validator diagnostics in tests |
| Understand mission | Read summary/brief; inspect plot; open help | Conditions, narrative, five views, disclosures | Derive environment, celestial, contact, operational frames | WebGL or semantic fallback; Web Audio by choice | Text alternatives; reduced motion; Field Guide |
| Enter compact Visualization | Choose Visualization from workspace menu | Menu disappears; plot becomes current named region | Commit destination, close menu, remove sheet from hit testing, focus plot | Responsive state and CSS | One atomic transition; current game state retained |
| Frame strategy | Select warfare areas, end state, theories, guardrail; optionally write | Ordered steps, lock reasons, completion | Reducer actions; decision completion; text sanitization | Browser memory; optional auto-save | Invalid dependency blocked; prose never scores |
| Build force | Search/add/remove platforms, aircraft, packs | Catalog cards, counters, credit/capacity messages | Host, slot, affiliation, reach, tracking, point and coverage derivation | Local catalogs | Legal state preserved; actionable repair message |
| Review readiness | Inspect gaps; commit or return | Planning recap, environment fit, readiness | Planning assessment and rigid readiness derivation | None beyond client | Return is non-destructive; calculations unit-tested |
| Command | Choose orders; resolve; review report; undo | State grid, situation, matrix range, reports, actions | Activate precommitted matrix; deterministic turn resolution | In-memory state; optional local auto-save | One-turn exact undo; same orders cannot reroll |
| Debrief | Review outcome, evidence, timeline; retry/learn | Score, thresholds, findings, lesson links | Canonical outcome, diagnostics, history record | Optional saved history | Undo final, same-scenario retry, return, new scenario |
| Learn | Browse Academy; answer checks; write notes | Paths, modules, concepts, quiz feedback | Progress state, bounded notes | Stored only under chosen policy | No credit claim; keyboard tabs; local progress reset |
| Persist | Enable/disable/save/load/delete slots | Save manager, status, confirmation | Minimized save, slot policy, canonical parse | Unencrypted `localStorage` | Current session remains if load fails; reset is explicit |
| Export | Download TXT | Readable record and format note | Serialize human report + versioned machine block | Browser download | Active commitments encoded, not encrypted |
| Import | Choose TXT file | Status and restored phase | Size, JSON, shape, allowlist, state replay checks | Browser file API | Atomic rejection; legacy migration bounded |
| Maintain release | Run checks/build/audit/package | Documentation and release notes | Deterministic build scripts | npm registry only during installation/audit | Lint, types, units, browser inventory, licenses, SBOM, artifact validation |

## 4. Lines of interaction and visibility

### Line of interaction

All player actions cross semantic React controls. Direct manipulation of the Three.js scene changes only camera telemetry. It cannot bypass scenario, planning, or command state rules.

### Line of visibility

The player sees explanations and derived summaries, not internal reducer actions, raw catalog indexes, or unrevealed matrix commitments. The TXT machine block is an explicit portability exception and remains bounded/versioned.

### Line of internal interaction

Domain modules exchange typed data. Presentation must not reverse-engineer rules from labels or CSS classes. Persistence must not trust a structurally plausible object without domain and replay validation.

## 5. Blueprint by failure mode

| Failure | Frontstage containment | Backstage containment | Recovery promise |
| --- | --- | --- | --- |
| Incompatible scenario facets | Never displayed | Whole candidate rejected | Fresh candidate; bounded validated fallback |
| Illegal force change | Blocked with reason | Existing legal roster unchanged | Remove dependency or add required host |
| Storage quota/availability | Status message | Session state remains in memory | Disable saving or export TXT |
| Corrupt local slot index | Slot omitted/reported | Safe parser rejects entry | Other valid slots/session remain |
| Malformed or tampered TXT | Import error | No reducer action occurs | Keep current session; choose another file |
| WebGL context failure | Fallback scene | Game rules remain independent | Continue complete play |
| Audio failure | No sound | No rule depends on sound | Continue complete play |
| Missing blur/filter | Opaque panels | Layout/semantics unchanged | Continue complete play |
| Browser test unavailable | Release notes say evidence missing | Source checks still run | Install compatible browser; do not claim pass |

## 6. Privacy blueprint

```text
player chooses session-only
  -> state in memory
  -> optional TXT download under player control

player opts into browser saving
  -> named slot + explicit prose policy
  -> minimized state to localStorage
  -> no network transmission
  -> load validates before reducer

player imports TXT
  -> untrusted file boundary
  -> bounded parser + canonical replay
  -> restore only on complete acceptance
```

The hosting layer may receive ordinary request metadata when serving the static app. The application sends no decisions, save content, or telemetry endpoint request.

## 7. Operational ownership

| Area | Owner responsibility |
| --- | --- |
| Product/design | Phase, disclosure, copy, ethics, journey coherence |
| Domain engineering | Scenario, credit, readiness, matrix, command invariants |
| Visual engineering | Depth, performance, occlusion, fallbacks, reduced motion |
| Security | Input boundary, storage, headers, dependencies, artifacts |
| Accessibility | Semantics, focus, reflow, alternatives, human testing |
| Content/learning | Fictional integrity, lesson provenance, bounded claims |
| Release | Build freshness, evidence, archive integrity, version alignment |

One person may perform several roles, but every release still reviews each responsibility.

## 8. Service-level promises

- A session can be completed without enabling browser storage.
- No gameplay action requires network access after the local release is installed.
- An invalid import cannot partially mutate the current game.
- A visual fallback preserves the complete decision service.
- A loss includes evidence and recovery paths.
- A hidden event cannot be exposed through TXT’s readable section before reveal.
- A scenario is accepted only as a coherent whole.
- A repeated state/order pair cannot produce a different result.
