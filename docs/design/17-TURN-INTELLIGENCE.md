# 17 — Turn Intelligence and Discovery Chronology

Status: implemented core typed command-intelligence slice; planned register
extensions are identified below

Applies to: command Turns 1–6, debrief, browser saves, and portable TXT
Authority: `requirements/turn-intelligence.json`

## 1. Product contract

Turn 1 establishes the baseline. Before Resolve on Turns 2–6, the player must
make three aggregate-opposition staff judgments:

1. possible intent;
2. possible meaning of the observable pattern; and
3. possible next action.

Each native select has an incomplete placeholder and an explicit
insufficient-evidence value. The three values are recorded with the turn for
reflection, but they do not participate in matrix resolution, state deltas,
disclosure, diagnostics, or score.

The interface uses aggregate-opposition language. Rendering one selector set
per hidden actor would itself reveal the concealed actor count.

## 2. Authority and projections

| Layer | Authoritative input | Output | Forbidden dependency |
| --- | --- | --- | --- |
| Adjudication | Scenario commitment, prior rigid state, readiness, orders | Deterministic next state | Staff judgments or display copy |
| Turn evidence | Typed action, infliction, and credited observation-domain codes | Version-2 turn report | Prose parsing |
| Public knowledge | Resolved reports plus current public state | Absolute facts with occurrence/discovery turns | Future matrix data, hidden actor count, concealed action values |
| Potentials | Current public indices, public deltas, disclosed inflictions | At most two substantive options plus insufficient evidence per selector | Actual hidden intent, matrix truth, or exact opposing composition |
| Presentation | Public knowledge and selected typed values | Left panel, mobile flow, debrief, readable TXT | Serialized display prose as authority |

`app/kriegsspiel.ts` owns the closed turn-evidence codes and the shared,
public-state-only potential-eligibility predicate used by live resolution and
canonical replay. `app/commandIntelligence.ts` owns the public projector and
maps eligible codes to presentation copy. `app/CommandIntelligencePanel.tsx`
formats that projection and never reclassifies knowledge.

## 3. Absolute-knowledge rules

Current range, contact quality, force integrity, command readiness, supply,
objective progress, and escalation are direct strike-group game indices and
remain visible in **Absolutely known**.

Modeled inflictions are disclosed on their occurrence turn because they are
the explicit effects the player must consider immediately. They state only
the modeled source side, affected side, effect, and point amount. They do not
establish real-world battle damage or hidden intent, identity, quantity, or
coordination.

An exact opposing action normally requires both contact quality of at least 85
and a relevant credited observation domain. `apply-pressure` is directly
knowable when the same report contains an opposing infliction against the
selected force. This narrow exception states the observable action, not its
intent or actor identity. Contact wording no longer branches on concealed
opposing cohesion.

Severe weather, selected-force command interference, objective changes, and
other directly experienced events can be known on occurrence. Opposing-only
coordination, opportunist identity, and institutional-interference events remain
concealed rather than being promoted by generic contact quality. An opposing
asset impact enters the absolute projector only if its typed knowledge state is
`confirmed`; generated opposing impact estimates remain assessed. Observable
opposing-action wording describes behavior without assigning purpose or intent.

## 4. Immediate and History

Every absolute fact has:

- a stable typed ID;
- `occurredTurn`, when the modeled event or change happened; and
- `discoveredTurn`, the first turn on which the confirmation basis existed.

**Immediate** contains facts available for the current decision turn—including
directly experienced conditions whose occurrence starts that turn—and retains
the latest absolutely known opposing action. **History** creates one
group for every resolved turn, including turns with no absolute changes. Facts
are grouped first by `occurredTurn`, then under **Discovered during Turn N**.
This lets a Turn 2 action confirmed on Turn 4 appear beneath Turn 2 without
claiming the strike group knew it before Turn 4.

Recorded staff judgments appear with the turn in which the player made them.
They remain labelled as working assumptions; later evidence does not rewrite
them as facts or score their accuracy.

Undo removes the undone report from the active canonical branch, as it did
before this feature. It cannot erase what the person saw. Retry creates a new
active run from the same deterministic commitment. Pending assessment values
are cleared after Resolve, Undo, Retry, and Return to Planning.

## 5. Responsive and accessible interaction

At wide breakpoints, intelligence is a left occupied surface and orders are a
right occupied surface, both using the established panel tokens. The tactical
plot retains the corridor between them. At 761–1023 pixels, secondary plot
readouts are suppressed during command to prevent overlap.

At 760 pixels and below, the tactical workspace is the only vertical scroll
owner. Intelligence appears before orders in document order; both panels
become normal-flow, full-width content. At 380 pixels and below, the known
state grid becomes one column. Native selects and the History summary retain a
44 CSS-pixel minimum target.

The intelligence panel is a named complementary region. Labels, certainty,
empty states, occurrence, and discovery timing are expressed in text, not
color or position alone. After a nonfinal resolution, focus moves to the
intelligence heading. A finite polite status summarizes at most three current
items and a remaining count; complete History is not a live region.

## 6. Persistence and trust boundary

Portable save version 4 requires rigid-state version 2. Every current-state
report must retain typed opposing actions, inflictions, and observation
domains; every report after Turn 1 must retain a complete assessment. Import
validates codes, sizes, IDs, domains, and bounds, then canonical replay rejects
even structurally valid mutations. Pending partial assessments restore only
when every present value remains in the current public candidate set.

Supported version-3 rigid-state-version-1 transcripts replay and upgrade to
version 2. Missing historical intelligence is reconstructed only from the
deterministic typed model; stored prose is never searched for facts.

Readable TXT uses the public projector. It includes staff judgments, known
deltas and inflictions, and the occurrence/discovery log. It omits concealed
actions, events beyond the active decision turn, matrix ranges and draws, raw umpire notes, hidden
opposing cohesion, and internal disruption IDs. The complete machine payload
is base64-encoded whenever a command matrix exists; this is encoding, not
encryption.

## 7. Lattice boundary

The current bounded Lattice slice does not transform this feature's certainty,
disclosure, control, error, scoring, persistence, or recovery language. These
strings remain controlled operative literals downstream of typed state.
Lattice cannot determine knowledge, potential eligibility, Resolve gating, or
history placement. Optional interpretive expansion would require a new
versioned inventory, request set, owner output, and evidence snapshot.

## 8. Evidence and limits

Model, component-source, save/replay, adversarial mutation, debrief, and browser
suite-inventory tests cover the implemented core contract. The requirements
register is a non-schema-governed design register; every cited evidence item is
marked planned until its specific assertion is formally promoted. Cross-branch
reveal provenance, correction/corroboration trails, and per-confirmed-actor
attribution remain planned extensions and are not claimed by this slice. Live
Playwright execution still requires a compatible browser binary. Automated
checks do not establish human comprehension, assistive-technology approval,
maritime truth, or the quality of a player's staff judgment.
