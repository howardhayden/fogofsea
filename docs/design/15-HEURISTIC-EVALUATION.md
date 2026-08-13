# 15 — Heuristic Evaluation

## 1. Method

This expert review uses Nielsen’s ten usability heuristics, supplemented by accessibility, privacy, resilience, learning, and environmental-coherence heuristics appropriate to FOG OF SEA.

The evaluation reflects current source behavior and automated evidence. It is not a substitute for observation with representative players and assistive technologies.

### Severity scale

| Severity | Meaning |
| --- | --- |
| 0 | No usability problem found / positive evidence |
| 1 | Cosmetic or low-frequency issue; fix when convenient |
| 2 | Minor friction; impairs efficiency or comprehension but has a clear recovery |
| 3 | Major problem; likely to block or materially mislead some users |
| 4 | Critical; prevents safe task completion, violates trust, or corrupts state |

### Status

- **Strength:** implemented pattern to preserve.
- **Residual risk:** current mitigation exists, but human evidence or refinement is still needed.
- **Roadmap:** proposed improvement; not currently implemented.

## 2. Executive findings

The present design is unusually strong in privacy-before-play, progressive disclosure, deterministic recovery, input resilience, and evidence-linked debrief. The remaining significant risks are human-evidence gaps rather than known broken core flows: terminology remains demanding, the scene can create perceptual competition under extreme visual conditions, and the breadth of command choices may strain first-time working memory. These should be addressed through testing and layered explanation, not by removing system depth.

| Priority | Finding | Severity | Status |
| --- | --- | ---: | --- |
| P1 | Complete manual assistive-technology evidence is not yet established | 3 | Residual risk |
| P1 | First-time comprehension of hosted vs credited vs readiness-contributing is unproven | 3 | Residual risk |
| P1 | Extreme sky/weather compositions may compete with translucent text surfaces | 3 | Residual risk |
| P2 | Nine command dimensions plus task can overload novices | 2 | Residual risk |
| P2 | Save/TXT/base64 distinctions require observed comprehension | 2 | Residual risk |
| P2 | Long mission and debrief content can impose high scanning cost | 2 | Residual risk |
| P3 | Cross-run comparison requires manual TXT review | 2 | Roadmap |

## 3. H1 — Visibility of system status

### Strengths

- Persistent points and decision-completion status.
- Current phase has a named region, heading, skip target, and finite announcement.
- Strategic steps expose locked/current/complete state.
- Command presents range, contact, integrity, readiness, supply, objective, and escalation.
- Save controls expose browser mode, active slot, prose policy, and status.
- Import failure preserves and names the current safe state.

### Findings

| Finding | Severity | Status | Recommendation |
| --- | ---: | --- | --- |
| Atmospheric telemetry is intentionally hidden behind compact disclosures; some users may not notice it | 1 | Residual risk | Keep disclosures opt-in, but test whether labels “Plot Data” and celestial status adequately signal content |
| Browser auto-save timing is not always perceptible | 2 | Residual risk | Use a quiet, finite “Saved locally at {time}” status after meaningful transitions; avoid persistent toast clutter |

## 4. H2 — Match between system and the real world

### Strengths

- Natural player-facing cloud terms replace the internal “broken” token.
- Five physical view layers and explicit Dawn/Day/Dusk/Night match a spatial mental model.
- Weather, celestial geometry, fog, waves, and occlusion follow coherent internal conditions.
- Fictional units and “invented nm” prevent false official precision.

### Findings

| Finding | Severity | Status | Recommendation |
| --- | ---: | --- | --- |
| Specialized strategy and force vocabulary remains demanding | 3 | Residual risk | Add just-in-time definitions and one plain-language restatement; preserve deeper terms for Academy/reference |
| Graphics may be interpreted as greater simulation fidelity than the decision model warrants | 2 | Residual risk | Repeat the teaching-model boundary in Field Guide, Credits, and exported record; do not interrupt routine play |

## 5. H3 — User control and freedom

### Strengths

- Session-only remains fully functional.
- Completed strategic decisions are editable.
- Force increments are reversible.
- Exact one-turn undo cannot reroll.
- Debrief provides undo, retry same scenario, return to planning, and new scenario.
- Overlays close with Escape and restore focus.
- Browser saving can be disabled; TXT remains available.

### Findings

| Finding | Severity | Status | Recommendation |
| --- | ---: | --- | --- |
| Ending an active command necessarily discards the incomplete command record | 1 | Strength with risk | Preserve current confirmation copy; test whether “no completed history record” is understood |
| Reset-all scope can be broader than the player’s immediate intent | 2 | Residual risk | Keep two-step confirmation and explicitly list slots/progress affected and TXT files unaffected |

## 6. H4 — Consistency and standards

### Strengths

- Shared glass, control, disclosure, status, focus, and modal systems.
- Native button, select, radio, checkbox, details/summary, tab, and dialog conventions.
- Consistent Cause → Evidence → Adjustment findings.
- Identical concepts reuse domain labels in UI and TXT.

### Findings

| Finding | Severity | Status | Recommendation |
| --- | ---: | --- | --- |
| Compact Tools reorganizes global actions relative to desktop | 1 | Residual risk | Preserve labels and order as closely as width permits; test focus return to the visible opener |
| “Mission pack,” “armament pack,” and older descriptive language could drift | 2 | Residual risk | Establish one canonical player term and use aliases only in migration/internal code |

## 7. H5 — Error prevention

### Strengths

- Whole-scenario validation prevents impossible combinations from being presented.
- Affiliation, host, capacity, and budget rules block invalid roster mutations.
- Destructive actions use confirmation.
- Imported files receive bounded parse, allowlist, domain, matrix, and canonical replay validation.
- A failed import never partially replaces state.
- The launcher refuses unsafe Host/method/port behavior.

### Findings

| Finding | Severity | Status | Recommendation |
| --- | ---: | --- | --- |
| A legal but uncredited roster can still surprise a novice | 3 | Residual risk | Show credit state before increment and provide a “why this earns zero” preview, not only post-selection feedback |
| TXT human sections can be edited without affecting machine restore, which may confuse provenance | 2 | Residual risk | Explain that restoration uses the machine block and readable edits are notes unless the machine state is valid |

## 8. H6 — Recognition rather than recall

### Strengths

- Completed choices remain visible as summaries.
- Command options include explanatory notes.
- Planning recap remains available during command and debrief.
- Saved slots show operation, exercise, and timestamp.
- Academy provides concepts, misreadings, applications, and related lesson links.

### Findings

| Finding | Severity | Status | Recommendation |
| --- | ---: | --- | --- |
| Players must integrate hosting, affiliation, reach, tracking, and capacity across cards | 3 | Residual risk | Add an optional trace: requirement → host → item → credit → readiness contribution |
| Returning players may not remember why a past slot excluded prose | 2 | Residual risk | Display active slot’s policy in the save summary and after load |

## 9. H7 — Flexibility and efficiency of use

### Strengths

- Guided, Standard, and Challenge serve different familiarity levels.
- Keyboard skip, view buttons, Page Up/Down, debrief scrolling, search, saved slots, and same-scenario retry support efficiency.
- Optional details and Academy allow depth without blocking progress.

### Findings

| Finding | Severity | Status | Recommendation |
| --- | ---: | --- | --- |
| Experienced players lack a compact cross-run comparison | 2 | Roadmap | Add a local read-only comparison of two completed records |
| Ten turn-order choices require repeated select navigation | 2 | Residual risk | Explore named order presets as editable starting points; never hide final individual values or imply a best preset |

## 10. H8 — Aesthetic and minimalist design

### Strengths

- Progressive disclosure prevents the full ruleset appearing simultaneously.
- The cozy-sublime scene sustains attention and gives conditions spatial meaning.
- Single-layer glass avoids nested visual slabs.
- A single final-cascade Notional material prevents header, HUD, report, alert, learning, and dialog surfaces from drifting toward inconsistent opacity in either theme.
- Academy and Field Guide use one literal overlay rule, so each quiets the scene by the same amount.
- Compact cards are mutually exclusive and bounded.
- Foreground subjects and tactical controls retain depth priority.

### Findings

| Finding | Severity | Status | Recommendation |
| --- | ---: | --- | --- |
| Dense stars, aurora, cloud, fog, weather, and glass can compete during extreme combinations | 3 | Residual risk | Expand deterministic composition QA and human contrast review across every climate/time/tier; tune atmosphere before reducing information |
| Mission panel and debrief remain text-heavy by necessity | 2 | Residual risk | Improve headings, short summaries, and scannable term/value structures; do not delete evidence or nuance |
| Similar repeated roster cards can become visually monotonous | 1 | Residual risk | Strengthen role/host/credit landmarks while preserving component consistency |

## 11. H9 — Help users recognize, diagnose, and recover from errors

### Strengths

- Blocked roster and strategic changes preserve current work.
- Save/import errors identify the boundary and keep the session active.
- Debrief diagnoses rule-state causes and links one adjustment.
- Launcher errors state the exact port recovery.

### Findings

| Finding | Severity | Status | Recommendation |
| --- | ---: | --- | --- |
| Generic import errors can be safe but insufficiently actionable | 2 | Residual risk | Map validation categories to bounded player-facing reasons without echoing hostile content or internals |
| A planning readiness gap may list several failures without a priority | 2 | Residual risk | Preserve instructional ordering and identify the highest-leverage first repair |

## 12. H10 — Help and documentation

### Strengths

- Field Guide, 25-module Academy, contextual lesson links, accessible descriptions, TXT records, Security, Accessibility, release evidence, and this design suite.
- Help is optional and does not change score.

### Findings

| Finding | Severity | Status | Recommendation |
| --- | ---: | --- | --- |
| Breadth of help can make the correct source unclear | 2 | Residual risk | Route immediate rule questions to Field Guide, learning questions to Academy, and technical trust questions to documentation |
| Documentation findability outside the archive root depends on README discovery | 1 | Residual risk | Keep the root README link and add a short design-documentation entry to START-HERE for evaluators |

## 13. Supplemental heuristic — Accessibility and equitable use

### Strengths

- Complete keyboard route, named regions, contained/restored dialog focus, text alternatives, 44-pixel targets, compact reflow, reduced motion, forced colors, no-WebGL fallback, no audio dependency.

### Finding

| Finding | Severity | Status | Recommendation |
| --- | ---: | --- | --- |
| Automated evidence cannot establish real screen-reader, magnifier, switch, speech, or mobile assistive usability | 3 | Residual risk | Conduct and document manual sessions across representative combinations; treat failures as release-priority defects |

## 14. Supplemental heuristic — Privacy and informed control

### Strengths

- Privacy before play, equal session-only path, no pre-consent writes, local-only runtime, unencrypted disclosure, per-slot prose policy, atomic imports, encoding-not-encryption language.

### Finding

| Finding | Severity | Status | Recommendation |
| --- | ---: | --- | --- |
| Users may conflate browser save with TXT backup or believe reset deletes downloaded files | 2 | Residual risk | Test the mental model and repeat scope in reset/export microcopy |

## 15. Supplemental heuristic — Resilience and recoverability

### Strengths

- Deterministic state, exact undo, validated fallback scenario, semantic scene fallback, no-sound operation, opaque glass fallback, safe launcher failure, portable TXT.

### Finding

| Finding | Severity | Status | Recommendation |
| --- | ---: | --- | --- |
| Browser quota/private-mode failures may appear late | 2 | Residual risk | Validate storage availability when enabling saving and keep TXT export prominent after failure |

## 16. Supplemental heuristic — Learning and epistemic integrity

### Strengths

- Purpose precedes force, prose is unscored, uncertainty is precommitted, one play is bounded, debrief cites evidence, Academy distinguishes concepts and misreadings.

### Finding

| Finding | Severity | Status | Recommendation |
| --- | ---: | --- | --- |
| Players may still optimize visible score instead of causal understanding | 3 | Residual risk | Run the comprehension protocol; revise information order or feedback if score is the only stated rationale |

## 17. Supplemental heuristic — Environmental and diegetic coherence

### Strengths

- Validated weather coexistence; rain/snow above water only; no Day aurora; darkness-linked aurora; Moon illuminated facets only; fog/occlusion hierarchy; distinct motion channels.

### Finding

| Finding | Severity | Status | Recommendation |
| --- | ---: | --- | --- |
| High graphical richness creates more combination states than a small fixed capture set can cover | 3 | Residual risk | Build a deterministic climate × time × weather × view × motion × viewport visual QA matrix and conduct art-direction review |

## 18. Prioritized remediation plan

### Priority 1 — evidence and comprehension

1. Run manual assistive-technology completion studies.
2. Run the comprehension protocol, emphasizing hosting/credit and score-vs-reasoning.
3. Expand visual composition review across extreme validated environments.

### Priority 2 — explanatory efficiency

4. Add optional requirement-to-credit traceability.
5. Test order presets as transparent editable starting points.
6. Improve import/reset/save-policy microcopy through task observation.
7. Add highest-leverage readiness repair ordering.

### Priority 3 — advanced comparison

8. Add local read-only completed-run comparison.
9. Add facilitator packet and sensitivity-lab concepts only after core evidence thresholds pass.

## 19. Re-evaluation protocol

After a significant change:

1. Re-run this review with at least two evaluators independently.
2. Reconcile severity only after each evaluator records evidence.
3. Trace every severity 3–4 item to an owner, test/research method, and release decision.
4. Confirm that remediation does not remove existing functionality or weaken privacy/accessibility.
5. Record whether each item is fixed, accepted with rationale, or remains an evidence gap.
