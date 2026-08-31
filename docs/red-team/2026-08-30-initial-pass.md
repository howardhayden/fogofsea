# FOG OF SEA — Initial Red-Team Release Gate

Evidence date: 2026-08-30
Pulled baseline: `7e0a137bee0ac9e4fb8392758bea0381265c8ed8` (`main`, already current with `origin/main`)
Assessment scope: rules, umpire, information environment, scenario design, software and data, and education
Release decision: **BLOCKED**

This is an adversarial evidence record, not a release certificate. The combined corrected worktree passed `npm run check`, including 19/19 JavaScript/release tests, 183/183 TypeScript model tests, 29/29 focused red-team tests, lint, strict typecheck, dependency-policy checks, browser-suite inventory, production build, and 18-file artifact validation. `npm audit --package-lock-only --audit-level=high` separately reported zero known vulnerabilities. That automated evidence does not close the open strategic-validity findings below, and no Playwright browser assertion or human comprehension session is claimed as executed in this pass.

## Decision and central question

> Can a player become good at FOG OF SEA's scoring system without becoming better at reasoning under uncertainty?

**Yes.** Two deterministic reproductions establish that answer at this snapshot:

1. In Guided exercise 10, **LUCENT ROADSTEAD**, a six-turn sequence using `withdraw` and `avoid` reached **DECISIVE VICTORY**, score **85**, primary objective **72**, secondary objective **44**, opposing cohesion **0**, escalation **0**, and no findings. The player could produce pressure and objective value while expressly avoiding engagement and preserving distance. This is a scoring exploit, not merely a debatable doctrine choice.
2. A nuclear-employment turn could raise escalation above the controlling boundary (observed peaks in the **75–82** range against a Guided limit of **42**), after which repeated withdrawal, avoidance, and emission control could lower the terminal value into the **35–42** range. Outcome logic inspected only the terminal value, allowing the review to say that the boundary held and permitting a decisive result. A past breach was erased rather than learned from.

A separate reproduction amplifies the first failure: exercise 8, **OPEN STRAIT**, accepted a nominally fully ready force costing **17.9/100 points**—two autonomous mine-support ships, eight uncrewed surveillance rotorcraft, and one airborne decoy pack, without the safeguarding, mine-neutralization, or offensive package implied by the mission—and reached score 72, primary objective 73, and secondary objective 79. Thus both the command rules and the planning model could reward optimization against internal arithmetic rather than sound operational reasoning.

The focused corrections now close those exact three exploit paths: avoidance/withdrawal cannot create mission effect, a past escalation breach remains outcome-authoritative, and the 17.9-point build is not command-ready without a mission-specific safeguarding effect. The historical answer remains **yes** for the pulled snapshot, and the release decision remains blocked because task effects still collapse into aggregate capability, branch/retry provenance can erase evidence, and several scenario, guardrail, information, and state-boundary failures remain unresolved. Passing these regressions is necessary evidence, not enough evidence to reverse the educational-validity judgment.

## Evidence vocabulary

Every finding and release claim must use one or more of these labels:

| Label | Meaning |
| --- | --- |
| `EXECUTED-FAIL` | A named test or deterministic reproduction was actually run against the identified tree and produced the stated failure. |
| `CORRECTED` | Source, test, or documentation was changed in response. This label alone does not mean the correction works. |
| `VERIFIED` | The named correction was exercised by a named test or reproduction that passed after the change. Scope is limited to that evidence. |
| `CONFIRMED-REPRO` | An adversarial input was run through the model or interface and the reported outcome was observed repeatably. |
| `CONFIRMED-CODE` | The behavior was traced to a concrete implementation path. This is strong diagnosis but is not substitute execution evidence. |
| `TEST-ASSERTED` | A regression test exists for the claim, but a passing execution is not recorded in this document. |
| `UNVERIFIED` | The concern or proposed correction has not yet been executed to a release-evidence standard. |
| `ARCHITECTURAL-LIMIT` | The current trust boundary or state model cannot enforce the desired property; a local patch or warning cannot close it. |

`CORRECTED` never implies `VERIFIED`. A passing unit test does not imply a browser interaction passed. A deterministic code/model result does not imply a human-learning outcome. “Not reproduced” is not the same as “disproved.”

## Mandatory release gate

No scenario, rules-engine revision, scoring change, import format, or Academy claim is acceptable without a traceable seven-part evidence chain:

| Evidence class | Required question |
| --- | --- |
| Positive | Does a representative valid case produce the intended state and lesson? |
| Negative | Does a plausible but invalid, unsupported, or doctrinally incoherent case fail for the right reason? |
| Boundary | What happens immediately below, at, and immediately above every threshold, capacity, limit, reveal turn, range, and score cutoff? |
| Adversarial combination | What happens when individually valid features interact—for example severe weather + coalition constraint + false emissions + low contact + undo/import? |
| Failure | Is the pre-correction failure preserved as a deterministic test, fixture, transcript, or browser trace? |
| Correction | Does the repair enforce a stated invariant without suppressing valid low-contact, non-kinetic, or recovery strategies? |
| Verification | Do the focused regression, adjacent model tests, full release gate, and relevant browser/human checks pass on the same revision? |

The gate is closed if any critical or high finding is unresolved, if an evidence label is missing, if a correction lacks a preserved failing case, or if the combined worktree has not passed the complete applicable suite. Risk acceptance in prose is not a substitute for a simulation invariant.

### Minimum evidence by change class

| Change class | Required adversarial coverage before release |
| --- | --- |
| Scenario | Feasible positive force; impossible objective; exact reach/endurance boundary; contradictory intelligence; mission/geography/weather/actor combination; bounded generation failure; corrected candidate revalidated as one atomic scenario. |
| Rules engine | Useful active strategy; irrelevant/avoidant strategy; exact contact/range/capacity thresholds; low-contact non-kinetic combination; preserved failed transcript; corrected deltas; deterministic replay. |
| Scoring | Sound win; arithmetic-only exploit; threshold ±1; prior guardrail breach followed by recovery; failed score trace; corrected score and title; debrief agreement. |
| Import/save | Current valid save; malformed/unknown/oversized input; every supported schema boundary; corrupted save + quota failure + repeated undo; failure leaves current state recoverable; replay and browser verification. |
| Academy | Reasoned correct response; shortcut/position strategy; edge and exception cases; doctrine + scenario + outcome combination; documented misreading; corrected claim; source review plus comprehension evidence. |

## Executed gate chronology

| Run | Tree state | Command/scope | Result | What it establishes |
| --- | --- | --- | --- | --- |
| Baseline | Clean `7e0a137…` | Complete existing `npm run check` | Passed: 19 JavaScript/release tests, 182 TypeScript tests, lint, typecheck, policy/content checks, browser-suite inventory, build, and 18-file artifact validation | Positive baseline only. It did not contain the new adversarial cases. |
| Red-team A | New seven-test gate before corrections | `npm run test:red-team` | **1 pass / 6 fail** | `EXECUTED-FAIL`: whole-scenario import bypass, undeclared order field, coercible version, undeclared scenario field, orphan browser save, and Academy answer-position shortcut were real failures. Curriculum scope copy was the one positive control. |
| Red-team B | First correction set | `npm run test:red-team` | **7/7 pass**; focused typecheck also passed | `VERIFIED` only for the six corrected cases plus the curriculum positive control. |
| Red-team C | Export/concealment cases added | `npm run test:red-team` | **9/9 pass** | Adds focused verification for readable planning-export commitments and premature secondary-objective disclosure. It does not prove cryptographic secrecy or source-inspection resistance. |
| Red-team D | All focused corrections combined | `npm run test:red-team` | **29/29 pass** | Adds exact allocation, understrength readiness, avoidance/withdrawal, non-kinetic positive control, 0/1/multi-method sensing, peak escalation, default normalization, learning, AAR, UI/export event disclosure, semantic equality, and click-order regressions. |
| Combined reconciliation | Modified worktree before stale-test repair | `npm test` | 19/19 JavaScript; **175/183 TypeScript**; red-team step not reached | Eight old assertions encoded a fixed Academy answer index, non-serializable `undefined`, hard-coded legacy environments, or now-prohibited planning disclosure. Tests were corrected to assert semantics and the intended knowledge boundary. |
| Combined release check | Corrected worktree | `npm run check` | **Passed**: 19/19 JavaScript, 183/183 TypeScript, 29/29 red-team, lint, typecheck, licenses, notices, SBOM, content, browser inventory, build, 18-file artifact | Strong automated regression evidence on one worktree. Playwright was listed, not executed; open Critical/High register rows still block release. |

The 29/29 result is not the final release decision. It verifies only the named regression invariants; it does not close scenario ontology, retry provenance, current-capability sensing, task-specific effect graphs, oversized-state handling, or actual browser/human evidence below.

## Closed correction chains in the focused gate

| ID | Attack → violated constraint | Initial evidence | Correction | Verification | Residual limit |
| --- | --- | --- | --- | --- | --- |
| RT-DATA-001 | Import a structurally plausible scenario whose force requirements and political aim contradict the generated whole → imports must not bypass atomic scenario coexistence validation. | `EXECUTED-FAIL` | Current-format import now calls `validateScenarioCoexistence` after shape validation. | `VERIFIED` by `tests/red-team/import-boundary.test.ts`; Red-team B and C. | Structured-field consistency is covered; contradictory free-form prose remains open as RT-SCN-001. |
| RT-DATA-002 | Add an undeclared future-control object to pending orders → import must reject state outside the declared command schema. | `EXECUTED-FAIL` | `isRigidOrders` now rejects unknown keys. | `VERIFIED` by `RT-DATA-002`; Red-team B and C. | Nested-value size and adversarial-combination coverage remain required. |
| RT-DATA-003 | Supply schema version `" 3 "` → versions must be exact supported numeric integers, not coercible text. | `EXECUTED-FAIL` | Parser now requires integer numeric versions 1, 2, or 3. | `VERIFIED` by `RT-DATA-003`; Red-team B and C. | Full old/new migration matrix still requires adversarial combinations. |
| RT-DATA-004 | Add an undeclared scenario control field such as `scoreOverride` → imported scenarios must have a closed control schema. | `EXECUTED-FAIL` | Current scenario keys are allowlisted. | `VERIFIED` by `RT-DATA-004`; Red-team B and C. | A closed object schema does not validate the semantic truth of prose. |
| RT-DATA-005 | Force the browser-save index write to fail after slot write → a new save must not become an unreachable orphan. | `EXECUTED-FAIL` | Slot serialization precedes mutation; prior slot content is remembered; failed index writes trigger best-effort rollback; index length is bounded. | `VERIFIED` by `tests/red-team/browser-recovery.test.ts`; Red-team B and C. | Web Storage is non-transactional; rollback itself can fail. Recovery under two consecutive storage failures is still `UNVERIFIED`. |
| RT-EDU-001 | Answer every Academy quiz using one fixed position → position must not substitute for reading. | `EXECUTED-FAIL`; initial positions were `0,15,10,0`. | Correct answers are reproducibly redistributed across all four positions. | `VERIFIED`; counts are `6,7,6,6` in Red-team B and C. | This prevents the simple position exploit; it does not validate comprehension or historical claims. |
| RT-INFO-001 | Export at planning and search readable text for seed, future disruptions, institutional constraint, and committed draws → incomplete play must not disclose future commitments in the human-readable record. | `CONFIRMED-CODE` | Every incomplete matrix-bearing save uses a clearly labelled Base64 resume payload and a redacted human prefix. | `VERIFIED` by `tests/red-team/information-leak.test.ts`; Red-team C. | Base64 is reversible. See RT-INFO-004. |
| RT-INFO-002 | Export active play before the secondary reveal turn → the human prefix must not name or numerically expose the undisclosed objective. | `CONFIRMED-CODE` | Secondary label and progress are gated by reveal turn; incomplete compound framing omits opposing detail. | `VERIFIED` by `RT-INFO-002`; Red-team C. | UI event disclosure and stale visibility remain open. |
| RT-EDU-002 | Read curriculum as universal doctrine or real-world probability → content must state the scope of score and theory. | Positive control; passed in Red-team A. | Existing copy says the score is internal rule compliance, not a probability estimate, and rejects one timeless master. | `VERIFIED` in all focused runs. | Copy is necessary but cannot counteract a game that rewards the opposite behavior. |
| RT-RULE-001 | Use avoidance, withdrawal, impossible reach/contact, irrelevant task, or an unready/effect-empty force to farm mission effect → only an eligible task/capability/position/contact/engagement chain may change objective or opposing cohesion. | `CONFIRMED-REPRO`, `EXECUTED-FAIL`. | Direct and risk-policy mission effects are now inside one eligibility gate; escalation costs remain even when the attempted effect is ineligible. | `VERIFIED` by `RT-RULE-EFFECT-001..003`, including all-avoid loss and valid `shadow`/`contain` positive controls; Red-team D. | Eligibility still consumes aggregate readiness rather than an exact task-to-effect graph; see RT-RULE-010. |
| RT-RULE-002 | Mark the 17.9-point OPEN STRAIT force fully ready → a complete absence of a required mission-specific effect cannot be compensated by unrelated strengths. | `CONFIRMED-REPRO`, preserved exact fixture. | Force adaptation now emits noncompensable zero-capability gaps; command `missionReady` uses full planning readiness. | `VERIFIED` by `RT-RULE-002`; adding one compatible 0.4-point safeguarding pack is the positive boundary. | The component planning score still reads 100/100 beside one blocking review item; broader task semantics remain open. |
| RT-RULE-003 | Force the greedy allocator into a locally attractive but globally incomplete 4/5 assignment → every feasible host/slot assignment must be found deterministically. | `CONFIRMED-REPRO`. | Deterministic residual max-flow replaces greedy assignment. | `VERIFIED` by `RT-RULE-003A/B`; independent brute-force review matched 2,000 randomized optima. | Disruption-time host-to-pack dependency is still flattened; see RT-RULE-011. |
| RT-RULE-004 | Repeated active sweep with zero/one sensing method produces high-confidence or multi-method prose → disclosure must not exceed credited method evidence. | `CONFIRMED-REPRO`. | Contact ceilings are 19 for zero capacity/methods and 64 for one unique method; multiple methods retain the higher range. | `VERIFIED` by `RT-INFO-SENSOR-001/002`; Red-team D. | Existing contact does not yet decay when sensing is subsequently disrupted. |
| RT-UMP-001 | Cross the escalation limit, then reduce the final scalar → an observed breach cannot be rewritten as non-occurrence. | `CONFIRMED-REPRO`, `EXECUTED-FAIL`. | Peak escalation is reconstructed from the authoritative transcript and controls score, guardrail finding, victory, and notes. | `VERIFIED` by `RT-UMP-ESC-001`; Red-team D. | Undo/retry can remove the authoritative transcript itself; branch provenance remains open. |
| RT-UMP-003 | Mix an adverse draw with an explicit typed finding → uncertainty must not absolve an actionable failure. | `CONFIRMED-REPRO`. | Any final typed finding takes precedence over uncertainty-only absolution. | `VERIFIED` across every finding code by `RT-EDU-FINDING-001`. | Turn-level classification still searches prose; RT-UMP-002 remains open. |
| RT-DATA-008 / RT-UMP-006 | Reorder JSON object members or warfare clicks → semantic identity and task selection must not depend on insertion order. | `CONFIRMED-REPRO`. | Key-order-insensitive, array-order-sensitive JSON equality is used after validation; default task selection uses required then canonical order. | `VERIFIED` by `RT-DATA-008A/B` and `RT-UMP-006`. | Arrays whose order is semantically meaningful remain order-sensitive by design. |
| RT-INFO-003 | Reveal opposing event cause as confirmed below the evidence threshold → public event knowledge must follow contact and credited sensing. | `CONFIRMED-CODE`. | Weather and own interference may be confirmed; opposing causes are concealed or assessed, never automatically confirmed. The active TXT projection applies the same affected-side boundary. | Unit `VERIFIED` by `RT-INFO-003A..D`; browser expectation updated. | Playwright could not launch because Chromium was absent; current sensing can still become stale. |
| RT-UMP-007 | Omit risk, coordination, strategic-force policy, and umpire notes from the AAR → every scored policy and consequence must survive review. | `CONFIRMED-CODE`. | Debrief timeline renders the policies and every note; nuclear employment is the canary. | Render-level `VERIFIED` by `RT-UMP-AAR-001`. | Browser execution remains unverified. |

## Atomic finding register

Severity meanings: **Critical** permits a false win, erases a controlling consequence, exposes committed truth, or threatens recoverability; **High** can materially distort an operational or educational judgment; **Medium** is bounded but still requires disposition. Every unresolved Critical or High item blocks release.

### Rules

| ID | Severity | Adversarial attack and evidence | Required invariant / correction | Status |
| --- | --- | --- | --- | --- |
| RT-RULE-001 | Critical | Repeat `avoid` and `withdraw`; `canApplyPressure` did not exclude avoidance, fallback cohesion could still apply, and risk objective value sat outside the pressure gate. Guided LUCENT ROADSTEAD produced decisive 85/100. `CONFIRMED-REPRO`, `CONFIRMED-CODE`. | `avoid` and an out-of-position withdrawal must not create objective progress or reduce opposing cohesion. Gate every direct and policy effect on task relevance, mission readiness, reach/contact, and a semantically eligible engagement. Preserve legitimate low-contact play through `shadow` and `contain`. | **CORRECTED, VERIFIED** by `RT-RULE-EFFECT-001..003`. Aggregate task semantics remain RT-RULE-010. |
| RT-RULE-002 | Critical | Optimize to a 17.9/100 nominal force that was marked fully ready and reached score 72/objective 73 despite missing safeguarding effects. `CONFIRMED-REPRO`. | Readiness and victory must require the actual mission effect, not proxy quantities or spend for its own sake. | **CORRECTED, VERIFIED** for the exact exploit by `RT-RULE-002`; no minimum-spend floor was added. Score/readiness presentation remains an educational concern. |
| RT-RULE-003 | High | A legal shared-host assignment was rejected by the greedy armament allocator: one corvette + one tender with mine-neutralization 2, shipborne ASW 1, and EM deception 2 received 4/5 credit although a complete assignment existed. `CONFIRMED-REPRO`, `CONFIRMED-CODE`. | Use deterministic exact capacity matching; prove permutation invariance and optimum agreement. | **CORRECTED, VERIFIED** by `RT-RULE-003A/B` and 2,000 brute-force comparison fixtures. |
| RT-RULE-004 | Critical | Six active-sweep/hold/shadow turns with `trackCapacity: 0`, no tracking methods, and no mission readiness increased contact 13→37→61→85→100 and produced “multi-method custody.” `CONFIRMED-REPRO`, `CONFIRMED-CODE`. | Bound contact and composition language by effective capacity and method diversity. | **CORRECTED, VERIFIED** at zero/one/multiple method boundaries by `RT-INFO-SENSOR-001/002`. Stale post-disruption contact remains RT-INFO-005. |
| RT-RULE-005 | High | Optional risk/coordination/strategic fields omitted by legacy or direct input rendered as `prepare`/`federated`/`conventional-restraint`, but the adjudicator disabled risk effects when every field was absent. `CONFIRMED-REPRO`. | Normalize defaults before display, adjudication, replay, and import. | **CORRECTED, VERIFIED** by `RT-UMP-DEFAULT-001`. Very old replay semantics still need an explicit migration policy. |
| RT-RULE-006 | High | Temporary and permanent disruption rounding can allocate the same single asset as both unavailable and destroyed. `CONFIRMED-CODE`. | Allocate both effects from one bounded population, with permanent loss a subset or disjoint state as designed; prove count conservation at 0/1/small boundaries. | **OPEN — RELEASE BLOCKER.** |
| RT-RULE-007 | High | Severe weather can help the player asymmetrically because selected readiness reduction and opposing-pressure factors are compounded in more than one path. `CONFIRMED-CODE`. | Define one authoritative symmetric/asymmetric weather effect per side; apply it once; test identical forces under identical weather and justified asymmetries only. | **OPEN — RELEASE BLOCKER.** |
| RT-RULE-008 | High | The visualization time control mutates `scenario.time` and therefore adjudication without an operational time cost. `CONFIRMED-CODE`. | Either separate visual preview time from canonical scenario time, or model waiting as a turn with supply, opportunity, contact, and escalation consequences. | **OPEN — RELEASE BLOCKER.** |
| RT-RULE-009 | High | Oversized but parser-valid rosters can exceed the intended 100-point planning frame and amplify later impacts. `CONFIRMED-REPRO`. | Enforce aggregate point/count/capability bounds at planning and import, with exact maximum and +1 tests. | **OPEN — RELEASE BLOCKER.** |
| RT-RULE-010 | Critical | Surface operations, reconnaissance, maritime interdiction, and mine-countermeasures can yield identical deltas because command consumes global reach/contact/effect aggregates; a decoy pack can help create a generic effect band, and repeating one required task need not expose unperformed mission functions. `CONFIRMED-REPRO`, `CONFIRMED-CODE`. | Persist per-task credited host, sensing, reach, effect, and availability slices. Resolve only the selected task's slice and track objective-specific milestones. | **OPEN — RELEASE BLOCKER; model redesign required.** |
| RT-RULE-011 | High | Planning retains host-to-pack assignments, but command flattens them. Disrupting the only aircraft host can leave its pack reach and tracking methods active. `CONFIRMED-CODE`. | Persist assignment edges into command and recompute active task capability after every disruption. | **OPEN — RELEASE BLOCKER.** |
| RT-RULE-012 | High | Logistics/refuelling aircraft do not improve supply or a modeled consumer, yet their counts/reach can increase generic opposition pressure. In the probe, ten logistics aircraft improved score/opposition disruption while supply stayed 36. `CONFIRMED-REPRO`. | Add explicit sustainment/consumer relationships and exclude logistics-only assets from generic offensive support. | **OPEN — RELEASE BLOCKER.** |
| RT-RULE-013 | Medium | Host compatibility has two contradictory sources: host `armamentIds` and armament `hostIds`; 12 of 31 hosts disagreed. `CONFIRMED-CODE`. | Establish one canonical compatibility graph and generate reverse views; add bidirectional integrity tests. | **OPEN.** |

### Umpire and scoring

| ID | Severity | Adversarial attack and evidence | Required invariant / correction | Status |
| --- | --- | --- | --- | --- |
| RT-UMP-001 | Critical | Use nuclear employment to cross the escalation boundary, then wash the terminal value down with avoid/withdraw/emission control. Outcome and notes inspected only final escalation and could say the boundary held. `CONFIRMED-REPRO`, `CONFIRMED-CODE`. | Derive peak escalation from the authoritative turn record and use it in score, victory guardrail, findings, and notes. | **CORRECTED, VERIFIED** by `RT-UMP-ESC-001`. Undo/retry provenance can still erase the record; RT-DATA-006 remains blocking. |
| RT-UMP-002 | High | Equivalent decisions with synonymous wording can change learning because `turnLearningNote` searches English report prose with regular expressions. `CONFIRMED-CODE`. | Emit typed cause/effect codes during adjudication and derive learning copy from codes, never surface wording. Test paraphrase and order invariance. | **OPEN — RELEASE BLOCKER.** |
| RT-UMP-003 | High | A loss containing `objective-gap`, `integrity-collapse`, or `supply-exhaustion` plus an adverse uncertainty draw could be summarized as “NO CLEAR MISTAKE INDICATED.” `CONFIRMED-REPRO`. | Any actionable typed finding must prevent false absolution. | **CORRECTED, VERIFIED** over every finding code by `RT-EDU-FINDING-001`. Prose-driven turn classification remains RT-UMP-002. |
| RT-UMP-004 | High | A scenario containing extreme parser-legal counts (99 per item) generated aggregate force points around 19,000, manifest around 5,742, and a disruption impact quantity above 2,000; the resulting rigid state failed its own bounds. `CONFIRMED-REPRO`. | Reject aggregate-invalid rosters before activation and cap impact allocation to real inventory. Failure must leave the prior game/load state intact. | **OPEN — RELEASE BLOCKER.** |
| RT-UMP-005 | Medium | Semantically identical matrix objects with different key insertion order failed canonical comparison because import used `JSON.stringify` equality. `CONFIRMED-REPRO`. | Compare validated JSON structures semantically while keeping array order significant. | **CORRECTED, VERIFIED** by `RT-DATA-008A/B`. |
| RT-UMP-006 | High | Reordering the same selected warfare set changed the inferred default task and therefore turn one. `CONFIRMED-REPRO`. | Select required mission tasks by a declared stable priority independent of click order. | **CORRECTED, VERIFIED** by `RT-UMP-006`. |
| RT-UMP-007 | High | The main AAR timeline omitted risk treatment, coordination, strategic-force policy, and umpire notes, so nuclear employment could disappear from review. `CONFIRMED-CODE`. | Show every scored policy choice and consequence in the six-turn timeline. | **CORRECTED, render-level VERIFIED** by `RT-UMP-AAR-001`; targeted browser execution remains unavailable. |
| RT-UMP-008 | High | Exact `/100` displays can be read as calibrated probability or forecast even though values are invented indices. `CONFIRMED-CODE`. | Label score, readiness, contact, and cohesion locally as internal model indices; comprehension test the distinction. | **PARTIALLY CORRECTED.** Debrief has a visible tested caveat; command/readiness displays and comprehension remain open. |
| RT-UMP-009 | Positive control | Exact same committed state and orders are replay-checked and deterministic in the existing save/rigid suite. | Retain deterministic replay while adding semantic-equivalence and peak-state tests. | Existing baseline evidence only; must rerun on combined tree. |

### Information environment

| ID | Severity | Adversarial attack and evidence | Required invariant / correction | Status |
| --- | --- | --- | --- | --- |
| RT-INFO-001 | Critical | Planning TXT printed committed future information in ordinary readable JSON. `CONFIRMED-CODE`. | Incomplete human-readable exports omit seed, future events/draws, institutional constraint, and concealed objectives. | **CORRECTED, VERIFIED** in Red-team C. Architectural residual is RT-INFO-004. |
| RT-INFO-002 | High | Active human prefix could expose a not-yet-revealed secondary objective/progress. `CONFIRMED-CODE`. | Gate label and progress on the actual reveal turn. | **CORRECTED, VERIFIED** in Red-team C. |
| RT-INFO-003 | Critical | `CommandPanel` labeled every active disruption `confirmed`, including opposing coordination/opportunist events at low contact or without sensing; active TXT also grouped opposing institutional direction with own command interference. Existing browser expectations encoded part of the leak as intended behavior. `CONFIRMED-CODE`. | Own command interference and directly experienced severe weather may be confirmed; opposing causes remain concealed without evidence and at most assessed when contact/capability earns it. Apply the same affected-side projection to readable exports. | **CORRECTED, unit VERIFIED** by `RT-INFO-003A..D`; browser expectation updated. Playwright launch failed because Chromium is absent, so interaction/ARIA verification remains open. |
| RT-INFO-004 | High | The resume block is Base64, which any source-inspecting player can reverse. `ARCHITECTURAL-LIMIT`. | Describe it only as casual spoiler resistance. If deliberate-player secrecy is required, move commitments behind a trusted remote umpire; local-only code cannot conceal state from its operator. A redacted/reconstructable machine format may reduce accidental leakage but is not secrecy. | **OPEN — RELEASE BLOCKER if deliberate source inspection is in the threat model.** Disclosure copy is corrected and unit-verified. |
| RT-INFO-005 | High | Contact visibility is derived from original readiness and can become stale after disruptions remove sensing. `CONFIRMED-CODE`. | Recompute visibility from authoritative current capability on every turn and export/render the same state. | **OPEN — RELEASE BLOCKER.** |
| RT-INFO-006 | High | Exact readiness and other Challenge values can act as an oracle for facts the player has not earned. `CONFIRMED-CODE`. | Define a player-knowledge projection for every display; show bounded/qualitative estimates unless confirmed. Compare projection against internal truth field by field. | **OPEN — RELEASE BLOCKER.** |
| RT-INFO-007 | High | Repeated contact reports expose coarse opposing cohesion changes even when no capability supports such battle-damage assessment. `CONFIRMED-CODE`. | Gate opposing-state reporting on collection and confidence; preserve uncertainty rather than converting hidden state into exact deltas. | **OPEN — RELEASE BLOCKER.** |
| RT-INFO-008 | Positive control | Future turn disclosure is filtered from ordinary DOM/ARIA paths in existing interaction logic. | Retain while correcting event knowledge and stale capability. | Existing test/code evidence; combined browser rerun required. |
| RT-INFO-009 | Positive control | Contact markers do not encode exact hidden enemy composition in the inspected projection. | Retain anonymous, capability-gated markers. | Existing test/code evidence; combined browser rerun required. |
| RT-INFO-010 | Positive control | Inspected unavailable-option explanations use own-force facts rather than opponent truth. | Keep dependency explanations on the player side of the knowledge boundary. | Existing code evidence; targeted adversarial browser matrix still required. |

### Scenario design

| ID | Severity | Adversarial attack and evidence | Required invariant / correction | Status |
| --- | --- | --- | --- | --- |
| RT-SCN-001 | Critical | Create mutually contradictory objective, constraint, success, intelligence, and political-aim prose while retaining valid typed fields; coexistence validation accepts it and rigid play ignores the prose. `CONFIRMED-REPRO`, `CONFIRMED-CODE`. | Move mission, threat, authority, termination, and success conditions into canonical structured fields; generate prose from them. Do not use keyword/NLP checks as authority. | **OPEN — RELEASE BLOCKER; architectural redesign required.** |
| RT-SCN-002 | Critical | Swap coalition legitimacy, civilian protection, sustainability, and escalation language while all consequences collapse to one escalation scalar. `CONFIRMED-CODE`. | Maintain distinct structured guardrail state, thresholds, evidence, and failure modes; explain any coupling explicitly. | **OPEN — RELEASE BLOCKER; architectural redesign required.** |
| RT-SCN-003 | Critical | Submit contradictory intelligence or false emissions; the rigid model silently ignores/reconciles them instead of preserving competing hypotheses. `CONFIRMED-CODE`. | Represent claim, source, confidence, age, deception hypothesis, corroboration, and player belief separately. Scoring must evaluate action against information available at decision time. | **OPEN — RELEASE BLOCKER; architectural redesign required.** |
| RT-SCN-004 | High | Mission/region Cartesian composition can create coastal safeguarding in Antarctic open water or dense-ferry constraints where the geography does not support them. `CONFIRMED-REPRO`. | Declare geographic affordances and mission requirements; reject invalid pairings as one candidate before presentation. Add littoral/open-water boundary fixtures. | **OPEN — RELEASE BLOCKER.** |
| RT-SCN-005 | High | Matrix force scale, institution, illicit category, and secondary objective are mission-unaware, producing trafficking/stolen-goods frames against massive combined fleets or guerre-d'escadre logic. `CONFIRMED-REPRO`, `CONFIRMED-CODE`. | Generate matrix choices from the canonical mission/threat/actor ontology and validate their coexistence. | **OPEN — RELEASE BLOCKER.** |
| RT-SCN-006 | High | Geography, timing, route, and endurance exist primarily as prose, so an objective can be unreachable without validator detection. `CONFIRMED-CODE`. | Persist numeric route distance, timing windows, transit/endurance, refuel/replenishment assumptions, and validate every objective against credited platforms. | **OPEN — RELEASE BLOCKER.** |
| RT-SCN-007 | High | Active severe-weather disruption does not update the rendered environment, so UI, adjudication, and export can describe different worlds. `CONFIRMED-CODE`. | Use one authoritative per-turn environment state for rendering, rules, report, and export. | **OPEN — RELEASE BLOCKER.** |
| RT-SCN-008 | High | A 30-knot and 48-knot storm can look materially different while adjudicating identically because detailed wind/current/wave/lightning values are absent from rigid effects. `CONFIRMED-CODE`. | Include operational environment values in the rigid scenario and define tested bounded consequences. | **OPEN — RELEASE BLOCKER.** |
| RT-SCN-009 | High | Challenge generation predictably includes severe weather and a secondary objective, allowing difficulty/template inference. `CONFIRMED-CODE`. | Difficulty should change uncertainty and tolerance without deterministically revealing matrix content; distribution-test conditional probabilities and edge cases. | **OPEN — RELEASE BLOCKER.** |
| RT-SCN-010 | High | Unwinnable, trivial, doctrinally nonsensical, and politically incoherent scenarios are not all rejected by a single feasibility oracle; the 17.9-point OPEN STRAIT case is a concrete triviality. `CONFIRMED-REPRO`. | Require a constructive legal win witness, a nontriviality floor, and structured political/operational coexistence evidence before a scenario is accepted. | **OPEN — RELEASE BLOCKER.** |

### Software and data

| ID | Severity | Adversarial attack and evidence | Required invariant / correction | Status |
| --- | --- | --- | --- | --- |
| RT-DATA-001 | Critical | Whole-scenario semantic import bypass. | Call coexistence validation at the import boundary. | **CORRECTED, VERIFIED** in Red-team B/C. Free-text semantics remain RT-SCN-001. |
| RT-DATA-002 | High | Unknown future-control field in pending orders. | Closed order schema. | **CORRECTED, VERIFIED** in Red-team B/C. |
| RT-DATA-003 | High | Coercible string schema version. | Exact numeric integer version. | **CORRECTED, VERIFIED** in Red-team B/C. |
| RT-DATA-004 | Critical | Unknown scenario field such as `scoreOverride`. | Closed current scenario schema. | **CORRECTED, VERIFIED** in Red-team B/C. |
| RT-DATA-005 | Critical | Index quota failure strands unreachable slot. | Best-effort rollback and bounded index. | **CORRECTED, VERIFIED** for one index-write failure in Red-team B/C. Double-failure recovery remains open. |
| RT-DATA-006 | Critical | Undo, return, completed retry, and load reuse committed draws while prior attempt evidence can be dropped; the player can compare hidden outcomes and erase consequences from the scored record. `CONFIRMED-REPRO`, `CONFIRMED-CODE` (`dropHistory`). | Mark branches as assisted/rehearsed, retain attempt and reveal provenance, make same-matrix retry ineligible for a clean comparable score, and require a fresh unseen matrix for a new scored attempt. | **OPEN — RELEASE BLOCKER; audit-model redesign required.** |
| RT-DATA-007 | High | Repeated undo/retry/import combinations have no dedicated adversarial chain proving history, outcome, and disclosure remain canonical. `UNVERIFIED`. | Add a state-machine matrix for undo at each turn, undo after reveal, retry after completion, save/export/import after each branch, and corrupted latest branch. | **OPEN — RELEASE BLOCKER.** |
| RT-DATA-008 | High | Canonical matrix/replay equality was insertion-order-sensitive. `CONFIRMED-REPRO`. | Semantic comparison after schema validation; accept reordered objects, preserve array order, reject altered values. | **CORRECTED, VERIFIED** by `RT-DATA-008A/B` and the complete save/replay suite. |
| RT-DATA-009 | Critical | Oversized legal-shape rosters can create invalid impact quantities and noncanonical rigid state. `CONFIRMED-REPRO`. | Aggregate bounds before write/activation/import; impacts never exceed inventory; current state remains recoverable after rejection. | **OPEN — RELEASE BLOCKER.** |
| RT-DATA-010 | Medium | Browser rollback is best effort because slot restore/remove can also throw. `ARCHITECTURAL-LIMIT`. | Test two-failure behavior, surface recovery instructions, preserve export path, and avoid claiming transactionality. | **OPEN.** |
| RT-DATA-011 | Positive control | Existing save/replay tests reject several altered rosters, draws, reports, deltas, and fabricated outcomes. | Retain these tests and combine them with unknown keys, oversized values, semantic ordering, branch provenance, and quota failure. | Combined save/model and `npm run check` evidence passed; oversized-state and branch provenance remain open. |
| RT-DATA-012 | Positive control | Dependency audit and policy checks can expose known package or licensing problems. | Run high-severity audit, exact-lock license/notices/SBOM checks on the same worktree. | `npm audit --package-lock-only --audit-level=high`: zero known vulnerabilities; license, notices, and SBOM verification passed. |

### Education

| ID | Severity | Adversarial attack and evidence | Required invariant / correction | Status |
| --- | --- | --- | --- | --- |
| RT-EDU-001 | High | Fixed answer position passes a disproportionate share of quizzes. | Balanced use of all positions. | **CORRECTED, VERIFIED** in Red-team B/C. |
| RT-EDU-002 | Positive control | Search for universal-theory and probability overclaim. | State contestability and internal-score scope. | Existing copy **VERIFIED** by focused test; human comprehension remains unverified. |
| RT-EDU-003 | Critical | Optimize only score: avoid/withdraw and a 17.9-point force could win. | Sound operational judgment and score must agree across positive, negative, boundary, and low-contact/non-kinetic cases. | **EXACT EXPLOITS CORRECTED, VERIFIED.** The pulled snapshot still failed the thesis, and RT-RULE-010 plus unresolved scenario/guardrail semantics prevent a clean reversal. |
| RT-EDU-004 | High | Recover after an earlier nuclear boundary breach and receive a clean win/boundary-held lesson. | Debrief must preserve peak breach, distinguish recovery from non-occurrence, and never teach consequence erasure. | **CORRECTED, VERIFIED** while the transcript exists; undo/retry provenance remains RT-DATA-006. |
| RT-EDU-005 | High | A mixed adverse draw and objective/integrity/supply finding could be called “no clear mistake.” | Typed findings control learning; distinguish an unfavorable draw from a correctable decision without absolving explicit failures. | **FINAL FINDING PATH CORRECTED, VERIFIED** across every typed code. Turn-level prose classification remains open. |
| RT-EDU-006 | High | Retry/undo the same committed matrix until the player knows future outcomes, then retain only the successful history. | Debrief identifies assisted/rehearsed branches; prior attempts and reveals remain auditable. | **OPEN — RELEASE BLOCKER.** |
| RT-EDU-007 | High | Omit nuclear/risk/coordination policies from the AAR timeline. | Every scored choice and consequence is visible in sequence. | **CORRECTED, render-level VERIFIED**; browser execution remains open. |
| RT-EDU-008 | High | Treat exact score/readiness/contact indices as prediction and optimize platform quantities instead of mission effect. | Nearby copy states “internal model index”; force credit is mission-effect based; comprehension and transfer tests distinguish model score from forecast. | **PARTIALLY CORRECTED.** Debrief scope copy and zero-capability gates are tested; planning still can show 100/100 beside a blocking gap, and human comprehension is unverified. |
| RT-EDU-009 | High | Use `avoid` to expose the exploit, then overcorrect by requiring kinetic/platform use for every win. | Preserve sound low-contact and non-kinetic success through `shadow`, `contain`, evidence collection, access, protection, and disengagement when they serve the mission. | **OPEN — RELEASE BLOCKER; required negative control for RT-RULE-001.** |
| RT-EDU-010 | High | Academy presents a contested theorist or doctrine as universally causal despite scope copy elsewhere. No external fact/source audit or participant comprehension run is recorded in this pass. `UNVERIFIED`. | Claim-level source review, counterexample, scope condition, and blinded comprehension evidence for each scored Academy proposition. | **OPEN — RELEASE BLOCKER for new or changed Academy claims.** |

## Corrections completed after the first 9/9 checkpoint

The following directions were initially recorded as in flight. They are now included in the 29/29 focused result, with the limits shown. A row does not close broader findings that share its code family.

| Finding | Implemented correction | Verification and limit |
| --- | --- | --- |
| RT-RULE-001 / RT-EDU-003 | Excluded `avoid`/withdraw and every ineligible effect path; kept escalation cost. | Per-delta and six-turn regressions pass; `shadow`/`contain` positive control passes. Exact task capability remains RT-RULE-010. |
| RT-UMP-001 / RT-EDU-004 | Derived peak escalation and made it authoritative for guardrail, score, findings, notes, and victory. | Breach-then-recover regression passes. Branch removal of the transcript remains open. |
| RT-RULE-004 | Added 0/1/multiple-method contact ceilings. | Zero and one-method regressions pass; post-disruption decay remains open. |
| RT-RULE-002 | Added noncompensable zero-capability gaps and aligned command readiness. | Exact 17.9 failure and 18.3 mission-effect positive boundary pass; score presentation remains open. |
| RT-RULE-003 | Replaced greedy host allocation with deterministic residual max-flow. | Counterexample, order invariance, and independent randomized optimum review pass. |
| RT-UMP-003 / RT-EDU-005 | Made any typed final finding explicit evidence before uncertainty-only interpretation. | Table regression over every finding code passes; prose-based turn notes remain open. |
| RT-INFO-003 | Projected event knowledge from contact and credited sensing. | Unit thresholds pass; targeted Chromium/ARIA execution did not run. |
| RT-UMP-007 / RT-EDU-007 | Added risk, coordination, strategic policy, every umpire note, and an invented-index caveat to AAR. | Server-render regression passes; browser/human verification remains open. |
| RT-DATA-008 / RT-UMP-006 | Added semantic JSON equality and canonical task fallback. | Reordered object/click regressions and adjacent save/matrix suites pass. |

No row moves to `VERIFIED` merely because implementation exists or a nearby test passes; every verification above names its actual scope.

## Required next release evidence

Release remains blocked until all of the following are true on one identified revision:

1. Extend the corrected central transcripts from aggregate eligibility to task-specific capability and objective milestones; prove repeated-one-task, decoy-only, logistics-only, protection, reconnaissance, `shadow`, `contain`, and lawful disengagement cases across every mission family.
2. Preserve peak escalation across branch provenance, undo/retry, import/export, UI, and education; a prior breach can be mitigated but never removed with its discarded transcript.
3. Contact gain and opposing-state disclosure require current credited sensing, and every future/opposing matrix field has an explicit player-knowledge projection.
4. Force/armament allocation uses an exact capacity solution, aggregate rosters are bounded, and impacts conserve inventory at 0, 1, maximum, and maximum +1.
5. Undo/retry/load retains branch and reveal provenance. A practiced same-matrix branch cannot masquerade as an unassisted scored run.
6. Scenario acceptance uses structured mission, threat, actor, authority, intelligence, geography, timing, guardrail, and environment state sufficient to reject the confirmed incoherent combinations. UI, umpire, export, and score consume that same canonical state.
7. Academy/debrief language is generated from typed findings and complete decision history; claim-level source review and human comprehension/transfer evidence are recorded without treating automation as participant evidence.
8. Every open Critical/High row has positive, negative, boundary, adversarial-combination, failure, correction, and verification artifacts linked by ID.
9. After the remaining blockers are corrected, rerun `npm run test:red-team`, adjacent unit/model suites, lint, strict typecheck, content/policy checks, build/artifact verification, dependency audit, and `npm run check` on the new combined tree. The present 29/29 and full-check pass cannot certify future corrections.
10. Relevant browser changes receive executed—not merely listed—desktop and compact Chromium cases for disclosure timing, ARIA output, AAR completeness, save failure recovery, and branch provenance. Any unexecuted browser or human scope remains stated explicitly.

## Release record template

For every future change in scope, append one row or linked case using this chain:

`Attack ID → violated invariant → pre-correction failing fixture/transcript → correction revision → focused passing result → adjacent regression result → browser/human evidence as applicable → residual risk → release decision`

The red-team gate should fail closed when a link is missing. Its purpose is not merely to prevent crashes or tampering; it is to keep concealed world state, umpire behavior, score, interface, and educational interpretation aligned under deliberate exploitation.
