# Lattice Copy Adoption — Adversarial Pass

Date: 2026-09-01

Scope: bounded in-game Field Guide, post-resolution learning, selected Academy interface copy, owner/runtime separation, and adoption governance

Baseline: FOG OF SEA `70907a77cba735c151e52929dd5a56d795c3d04f`

Lattice: `d6cc85b275e3f14163a5a547f626832fd21b27b0`; engine `0.1.1`; relational-systems `v1.0.0`
Decision: bounded slice implemented; broad adoption remains blocked

## 1. What this record can establish

This record links identified failure paths to constraints, implementation
owners, and executable evidence. It does not establish that source claims are
true, the prose is human-approved, Academy sourcing is complete, accessibility
is universally effective, or maritime/educational content has received domain
approval. Browser-test enumeration is not browser execution.

The governed slice contains 19 requests, 26 output strings, and 12 hashed
TypeScript source-symbol declarations. The Academy corpus extractor identifies
1,011 curriculum-data strings and submits them to two read-only advisory lint
batches. Those counts bound the evidence; they do not expand its claim.

## 2. Attack matrix

| ID | Adversarial case | Failure exposed | Correction / gate | Evidence target | Status |
| --- | --- | --- | --- | --- | --- |
| RT-LAT-001 | Treat “use Lattice in in-game and Academy copy” as permission to transform every string | Safety, privacy, accessibility, scoring, and correctness-bearing text could lose immediate meaning | Closed 37-unit inventory separates adopted, advisory, exempt, out-of-scope, and blocked families | Requirements/inventory schema and exact-ID tests | Corrected structurally |
| RT-LAT-002 | Give one mixed surface one voice route | Pending, technical report, aftermath, public-notice, and analytical meanings collapse | Debrief, Guide, and Academy units use exact independent route tuples; paired Guide layers remain separate | Route-to-output uniqueness test | Corrected structurally |
| RT-LAT-003 | Preserve receipt/digest metadata but substitute different prose for the selected provided candidate | A valid-looking evidence envelope could publish undeclared text | Compiler and offline verifier require byte-exact selected candidate ID/layer/representation/text | Canonical verification checks all 26 outputs; an adversarial substitution mutates one representative selected provided output | Verified at the stated canonical and representative-mutation scopes |
| RT-LAT-004 | Change a source file, point outside the repository, use a symlink escape, or name a nonexistent declaration | Path-only provenance can be stale or attacker-controlled | Twelve source references require contained real paths, TypeScript AST declarations, and exact SHA-256 digests | Traversal-path, source-byte/hash drift, symlink-escape, and nonexistent-symbol mutations | Verified by four practical source provenance mutations |
| RT-LAT-005 | Reference an unknown, exempt, superseded, duplicated, or unrelated requirement/inventory unit | Decorative traceability can appear complete while ownership is broken | Requests resolve active semantic requirement IDs and non-exempt inventory IDs in both directions; publication paths must be owned | Authority/reference/ownership mutations | Verified by authority, traceability, and ownership mutations |
| RT-LAT-006 | Put requests, contracts, atoms, candidates, assertions, receipts, or raw provenance values in a release asset, including text disguised with a binary extension | Owner-only register material leaks despite a clean bundle scan | Runtime is a four-field text map; artifact validation scans every emitted file's raw bytes, validates known binary magic, and rejects structural fragments, exact internal identifiers, and authoring-derived provenance values | Structural, identifier, digest, commit-value, and fake-PNG injections plus the canonical production-artifact scan | Verified by the artifact-injection regression and production scan |
| RT-LAT-007 | Let rewritten prose continue to classify a turn or outcome | Register changes mechanics, evidence, or replay | Typed diagnostic codes choose learning copy; prose is presentation only | Prose-regex static regression and state-equivalence tests | Corrected in bounded learning slice |
| RT-LAT-008 | Describe an unfavorable score as a clear mistake, or no finding as proof of correct play | The model invents blame or exoneration | Copy distinguishes tracked mismatches, committed matrix failure, and absence of a tracked finding; no “strongest” finding without a ranking rule | Score-only loss, matrix failure, and no-finding boundary tests | Corrected semantically |
| RT-LAT-009 | Say only numeric rules and orders determine the outcome | Recorded state and nonnumeric rule branches disappear from the explanation | Exact note says writing was not evaluated and attributes results to invented rules, recorded game state, and selected orders | Required/prohibited phrase test | Corrected semantically |
| RT-LAT-010 | Call the Field Guide a complete scoring explanation | Players infer omitted formulas or thresholds are documented there | Current copy calls it a bounded mission-credit and learning explanation; detailed score components remain distinct | Current-document and UI copy scan | Corrected in current documentation |
| RT-LAT-011 | Call structured coexistence validation complete scenario feasibility | Winnability, nontriviality, doctrine, political coherence, and prose semantics are falsely certified | Current documentation names implemented structured checks and preserves unresolved feasibility limits | Prohibited-claim scan outside historical records | Corrected in current documentation |
| RT-LAT-012 | Present Academy lint as complete sourcing or educational review | Reading trails, accuracy, quiz validity, or comprehension receive unsupported authority | Lint is read-only, advisory, and limited to curriculum data; only five interface strings are adopted | Corpus immutability and scope assertions | Corrected structurally and in copy |
| RT-LAT-013 | Change `humanStatus` to approved or describe automated assertions as human/accessibility/domain review | Machine evidence launders an approval claim | All request reviews require `not-claimed`; docs separate automation from human evidence | Review-status mutation and claim scan | Correction implemented; human review not claimed |
| RT-LAT-014 | Persist selected display prose and accept it as replay authority | A past string can bypass current logic or make copy changes invalidate a sound record | Canonical import verifies adjudication fields and regenerates presentation copy from typed state | Save/replay mutation tests | Corrected in bounded learning path |
| RT-LAT-015 | Declare product-wide adoption after the selected slice passes | Three unisolated prose-to-logic paths become transformable without safety evidence | Broad status remains blocked on `gameModel.ts`, `catalogMath.ts`, and `contactVisualization.ts` | All-blockers governance test | Open release-policy blocker for expansion |
| RT-LAT-016 | Report a listed Playwright suite as passing in a browser | Evidence category is overstated | Reports distinguish compilation/listing from live browser execution | Evidence-language review | Browser execution not claimed; compatible Chromium unavailable |

## 3. Re-atomization from implementation red-team

The first implementation audit found that structural conformance alone was not
enough. The corrected atomic constraints are:

1. A provided output is its declared candidate text, not merely a text carrying
   the same request receipt.
2. An absent tracked mismatch or final finding is a bounded observation, not a
   causal or quality conclusion.
3. A finding list has no “strongest” item unless a deterministic ranking rule
   is part of adjudication.
4. The unscored-writing statement must name recorded game state as well as
   invented rules and selected orders.
5. Artifact isolation applies to every textual emitted file, not one bundle
   extension.
6. Source-symbol hashes establish identity and drift, not source truth.
7. Automated contract, accessibility-dependency, and curriculum-data checks do
   not establish human review.
8. Scenario coexistence checks do not establish complete feasibility.

These constraints are now represented by stable semantic requirements in
`requirements/lattice-adoption.json` and by exact route/owner units in
`requirements/lattice-copy-inventory.json`.

## 4. Evidence and execution status

The owner compilation and independent verification passed executable Draft-07
and Draft 2020-12 schema checks with pinned Ajv `8.17.1`,
source containment and AST identity checks, route/ownership traceability,
candidate identity, semantic host assertions, offline digest verification, and
Academy corpus immutability. The automated MJS, top-level TypeScript, and
red-team suites passed. The independent closure suite exercised 22 top-level
cases: one canonical acceptance and 21 mutations, including executable-schema,
closed-governance,
implementation-authority, evidence-reference, declaration-identity, traversal-path,
source-byte/hash drift, symlink-escape, and nonexistent-symbol attacks. Its
candidate-substitution case changes one representative selected provided output;
the canonical verifier checks the identity of all 26 outputs. The artifact
regression separately injects structural fragments, an exact internal ID, an
owner schema, both pinned digests, and both pinned commits. The production build
passed the expanded artifact check across all 18 emitted files at the raw-byte
level, including decoded checks of all 15 textual assets. These results establish only the declared automated
boundaries of this pass.

The dedicated executable-schema suite validates all seven canonical documents
and rejects schema-only request mutations to the revision pattern and fixed
review authority, unknown schema keywords, and non-finite in-memory numbers.
The package manifest, lockfile, validator, declaration, and validator options
are included in the fourteen-file implementation authority.

The Playwright inventory can be compiled and listed without downloading a
browser. A compatible Chromium executable was unavailable in this workspace,
so no browser assertion was executed for this pass. Existing historical review
records, including `2026-08-30-initial-pass.md` and `RELEASE_QA.md`, remain
historical evidence and were not rewritten to imply a current pass.

## 5. Residual work

- Replace the three prose-to-logic couplings with typed owners before expanding
  Lattice adoption.
- Perform human copy-comprehension and assistive-technology review without
  treating automated assertions as a substitute.
- Review Academy sources, lesson claims, quiz validity, and learner
  comprehension under a separate educational evidence plan.
- Execute the browser suite when a compatible Playwright Chromium installation
  is available.
