# 04 — Interaction Design

## 1. Universal interaction contract

Every consequential interaction must provide:

1. a clear label;
2. the current state or value;
3. the consequence or purpose;
4. validation before irreversible transition;
5. a repair path when blocked;
6. keyboard and screen-reader operation;
7. a stable reduced-motion presentation;
8. persistence behavior, if any, that matches the privacy choice.

Status messages are restrained and actionable. Narrative reports are review content, not competing live announcements.

## 2. Launch and privacy

### Entry state

The privacy dialog is modal and cannot be bypassed by interacting with the game behind it. It explains:

- no account, telemetry, advertising, or server save;
- session-only versus browser-save behavior;
- browser data is unencrypted profile data;
- portable TXT remains available in either mode;
- optional writing is excluded from browser saves by default.

### Actions

| Action | Preconditions | Result | Recovery |
| --- | --- | --- | --- |
| Choose difficulty | None | Sets Guided, Standard, or Challenge | Change before starting |
| Play without browser saving | Hydration complete | Session state exists only in memory | Export TXT at any time |
| Enable browser saving | Non-empty bounded name | Creates named local slot | Disable later; export; delete/reset with confirmation |
| Load existing slot | Valid indexed slot | Imports validated local save | Status explains rejection; current state remains safe |

Focus begins at the primary session choice, remains within the dialog, and moves to the mission workflow after acceptance.

After acceptance, the top bar does not repeat privacy, security, tracker, or
storage-mode disclaimers. Players can review persistence details in Save/Load;
an actual save failure alone produces an assertive in-game alert with recovery
available through that surface or TXT export.

## 3. Scenario and new-game generation

Selecting New Game enters a confirmation if current work may be displaced. The generator iteratively creates whole candidates. A candidate is presented only after identity, environment, celestial eligibility, mission, actors, force requirements, matrix, and narrative coexistence validate. Up to 32 attempts are bounded; a deterministic constructive fallback must pass the same validator.

The UI never shows partial generation or repairs incompatible facets in place. The accepted scenario appears atomically.

## 4. Strategy workflow

### 4.1 Read the problem

The mission panel pairs summary conditions with expandable brief sections. The layout permits scrolling without moving the tactical scene or global tools.

### 4.2 Identify warfare areas

- Each area is a named control with explanation.
- Required and recommended areas are scenario-derived.
- Incorrect additions may dilute focus but are not silently removed.
- Removing an area with dependent force items is blocked until those items are removed.
- Completion updates are announced politely.

### 4.3 Ordered strategic frame

The sequence is end state → primary theory → distinct second theory → guardrail. Only the first incomplete, unlocked step is expanded. Completed steps become named Edit controls. Locked steps say why.

Selecting a value advances focus to the next select. The second theory cannot duplicate the primary. After the guardrail, optional writing becomes available.

Live gameplay copy stays economical: it names the current state and one useful
repair. Model boundaries, privacy, security, persistence, scoring detail, and
the complete mission-credit explanation are progressive Field Guide content or
linked player documentation. After resolution, the debrief gives a supported
adjustment or explicitly says that no clear mistake was indicated.

### 4.4 Optional writing

Synthesis, commander’s logic, assumptions, and termination/transition fields are bounded plain text. The product repeats two facts at the point of entry:

- the rigid umpire never scores or reads prose;
- browser persistence follows the active slot’s inclusion policy, while TXT export includes it.

## 5. Force design

### 5.1 Unlocking

Force design unlocks only after the strategic frame is sufficiently complete. Points remain locked before that point to prevent premature optimization.

### 5.2 Selection model

- Platform, aircraft, and mission-pack catalogs use named list/card semantics.
- Add/remove controls change quantities one step at a time.
- Affiliation with selected warfare areas controls availability.
- Compatible selected hosts and slots control aviation and packs.
- Selected does not imply credited: mission relevance, hosting, capacity, reach, and tracking determine credit.
- Search is bounded and sanitized.

### 5.3 Feedback hierarchy

1. Immediate item status: unavailable, compatible, hosted, unhosted, over capacity.
2. Running 100-point allocation.
3. Mission coverage and readiness measures.
4. Scenario-specific gaps and substitutions.
5. Pre-command review.

A blocked add identifies the missing prerequisite. A blocked remove identifies dependent selections.

## 6. Pre-command review

The review is a deliberate commitment point. It summarizes:

- scenario and environment;
- strategic frame;
- force roster and credited capability;
- environment fit and readiness gaps;
- likely operating methods;
- disclosed matrix ranges and difficulty effects.

The player may return to planning without penalty. Starting command creates the initial rigid state from accepted scenario and derived readiness.

## 7. Tactical visualization

### 7.1 View controls

Stars, Sky, Air, Surface, and Subsurface are explicit buttons. Pointer drag and arrow keys rotate within the current layer; they never change layers. Page Up/Page Down also move deliberately between layers.

### 7.2 Camera controls

- Drag / arrow keys: orbit.
- Wheel / labelled controls: zoom within bounded range.
- Plot Data: heading, compass direction, elevation, and range.
- Time buttons: Dawn, Day, Dusk, Night presentation of the same scenario geometry.

Changing presentation time is visual exploration and does not alter the scenario’s adjudication time.
Bright crystalline landmarks remain visible at Dawn and Dusk. The time control changes the visibility-qualified cohort and atmospheric transmission, not the canopy's established geometry, scale, halo, or motion parameters.

### 7.3 Disclosures

Plot Data, celestial data, contextual star/subsurface data, and Contact Key use native disclosure behavior. On compact layouts they are mutually exclusive, bounded, closable, and anchored away from the central scene. The invisible positioning layer must never receive glass.

### 7.4 Fallback and degraded graphics

If WebGL is unavailable, the semantic DOM/CSS fallback preserves layer, weather, star, aurora, contact, unit, and reduced-motion meaning. It may simplify depth and geometry but cannot remove controls or text alternatives.

### 7.5 Wildlife greeting

Recognizable creatures are optional environmental affordances, never tactical targets. A short pointer press on a creature activates a forgiving invisible hit volume; movement beyond the drag threshold remains camera orbit and does not trigger the creature. Every non-resting animal continuously advances toward the next deterministic waypoint on a closed, habitat-bounded route while working its articulated locomotion joints. Birds bank and flap; compact dolphins continuously traverse broad water routes with articulated tail propulsion and occasional bounded porpoising arcs; sharks continuously cruise faster, wider water routes below their local wave except for a bounded dorsal greeting; and ice animals commute only inside an assigned floe footprint. Camera heading and range remain available in Plot Data without painting a coordinate grid across any view.

A deterministic minority—but never every member—of a multi-penguin group may pause lying down at a safe floe waypoint. One visible penguin therefore always travels; for any visible count `N`, the resting count is strictly less than `N`. Greeting a lying penguin runs an explicit 4.8-second comic sequence: brace and recover from 0–0.96 seconds using the model-root, flippers, and legs; stand from 0.96–2.016 seconds using the same grounded joints; confused one-flipper head scratch from 2.016–3.744 seconds using the head and flipper joints; and lie back down from 3.744–4.8 seconds using the root, head, and flippers. The root always follows the shortest path between its resting angle and upright—never a circle spin—and lifts only inside the rig while its scene position remains pinned to the floe. The same sequence has keyboard parity and a truthful polite live announcement. The response is cheerful, native-colored, depth-occluded, and cannot alter detection, orders, scoring, saves, or TXT output.

The focusable **Greet a visible animal** action cycles through currently visible creatures and provides the same response without precise pointing. A polite live region names the response. Repeated greetings remain bounded. Reduced motion freezes ordinary route travel at the start of each creature's bounded route in an anatomically active pose; a greeted resting penguin uses one stable upright puzzled/scratching pose rather than forcing the recovery sequence. Surface and subsurface routes remain within each member's generated radius; air routes use that radius longitudinally and 34–76% of it laterally; ice routes are clamped to 0.34–0.58 world units within an assigned floe, while resting waypoints have zero travel radius. The CSS fallback preserves the same input, message, route semantics, resting minority, and semantic boundary.

### 7.6 Progressive information load

FOG OF SEA follows an **essential state → next action → explanation on request** sequence. Scenario identity, current conditions, current decision, turn state, and the next required control remain visible. Mission prose, reference catalogs, method explanations, previous-turn summaries, detailed score components, Academy lesson bodies, concepts, seminar prompts, and reading trails begin in closed native disclosures. Opening a disclosure never changes simulation state; it only exposes explanatory text. Internal probability ranges, committed draws, matrix notes, and validation machinery do not appear in ordinary turn play. Plain-language explanations live in the Field Guide and its bundled player documents. After resolution, one learning note distinguishes a correctable pattern from an unfavorable result with no clear mistake indicated. Detailed findings open only when they provide a supported recovery path; breakdowns and history remain opt-in.

This rule applies at every viewport. Compact layouts may reposition or mutually exclude overlays, but they may not force explanatory text open, hide the next action, or replace semantic `details`/`summary` behavior with a pointer-only affordance.
Selecting a compact workspace or global-tool destination is atomic: update the active view or open the requested dialog, close the menu, remove its occupied drawer from layout and hit testing, then move focus into the chosen region. The open chooser is a full-width, scrollable two-tier drawer directly beneath the status bar; large workspace and tool tiles plus a neutral dismiss scrim prevent live workspace text from competing with navigation labels. Visualization remains an explicit destination during command review rather than being masked by the command form, while Academy, Save / Load, Field Guide, Credits, and Sound Settings remain directly reachable on narrow screens. A closed menu has no painted box and cannot intercept input.

## 8. Command interaction

Each of six turns presents:

- range, contact, integrity, readiness, supply, objective, and escalation;
- current disruptions and objectives;
- a concise previous-turn outcome and metric changes;
- formation, sensor policy, tempo, engagement posture, uncrewed employment, undersea employment, risk treatment, coordination, strategic-force policy, and assigned warfare task.

Every select is paired with a short explanatory note. Resolve applies one deterministic transition. The player sees its consequences, not its implementation trace; deeper rules are available from the Field Guide.

### Undo

Undo restores exactly one previous turn state. Repeating identical orders produces the same result. Undo is for learning and correction, not rerolling.

### End and return

Ending an active command requires confirmation and explains that no completed record will be created. Returning after completion preserves the record in history.

## 9. Debrief interaction

The debrief leads with outcome, score, and explicit thresholds. It then presents:

- component scores;
- Cause → Evidence → Adjustment findings;
- a complete expandable turn timeline;
- related Academy lessons;
- Undo Final Turn, Retry Same Scenario, Return to Planning, and New Scenario.

The review region is focusable and supports Page Up, Page Down, Home, and End. Win and loss receive equivalent explanation and recovery options.

## 10. Academy

- The Academy opens as a modal learning workspace.
- The header remains stable while one bounded content surface scrolls; module navigation, lesson content, comparison material, and sources never become competing upper/lower vertical panes.
- Exactly one named Academy tabpanel is rendered at a time. The outer Academy and Field Guide use the same glass material as other informational dialogs; interior groupings use hairlines and restrained transparent tint, not nested glass or opaque paper slabs.
- Academy and Field Guide apply the same 42% neutral scene scrim and the same
  backdrop filter. Opening either tool changes focus and quiets the scene by an
  equal amount; Field Guide never imposes a darker modal penalty.
- Three paths filter the 25 modules without erasing shared modules.
- Tabs, panels, module navigation, quiz answers, feedback, progress, seminar prompts, readings, and notebook interactions are keyboard named.
- Quiz feedback explains the answer; it does not merely mark correct/incorrect.
- Completion may be saved only under the chosen persistence mode.
- Related-lesson links may open the Academy from the debrief and return focus appropriately.

## 11. Save, load, import, export, and reset

### Browser saving

- Enabling requires a bounded name.
- Inclusion of written analysis is explicit and belongs to the active slot.
- Disabling stops new browser writes; it does not delete existing slots.
- Loading another slot validates before replacing current state.
- Deleting a slot and resetting all data require clear destructive confirmation.

### TXT export

Download produces a readable decision record followed by a versioned machine block. If command is active, unrevealed commitments remain in an encoded payload. Encoding is labelled as not encryption.

### TXT import

The file chooser accepts plain text. The app rejects oversized, malformed, unknown, noncanonical, or tampered current state and retains the current safe session. A successful import restores the saved phase and moves focus there.

## 12. Global utilities

| Utility | Interaction behavior |
| --- | --- |
| Theme | Immediate light/dark presentation change; rule state unchanged |
| Sound | Opens named volume controls; user gesture initializes audio; mute is explicit |
| Field Guide | Modal reference organized around rules and player questions |
| Credits | Modal provenance, independence, licenses, and evidence limits |
| New Game | Confirmation before displacement; creates new validated scenario |
| Tools | Compact menu exposes equivalent global actions, closes with Escape/outside action |

## 13. Error and recovery model

| Failure | Response |
| --- | --- |
| Invalid choice dependency | Keep state; explain prerequisite and repair |
| Point/capacity conflict | Block only the invalid increment; preserve legal roster |
| TXT parse or replay failure | Reject entire import; never partially restore |
| Browser storage failure | Report local failure; keep session playable; offer TXT export |
| WebGL unavailable | Use semantic visual fallback |
| Sound unavailable | Keep all rules and feedback visual/textual |
| Reduced motion | Freeze autonomous motion at representative rest states |
| Unsupported blur | Use opaque bordered surfaces |
| Port occupied in local launcher | Stop with instruction; never terminate another process or switch silently |

## 14. Interaction acceptance checklist

- Can a first-time player identify the next action without reading every panel?
- Can every task be completed without pointer gestures?
- Does focus land at the new task after every phase change?
- Does a blocked action preserve work and explain repair?
- Does compact disclosure leave the scene usable?
- Is any saved or scored content ambiguous at the point of entry?
- Can retry, undo, import, and new game be distinguished?
- Do reduced-motion, no-sound, no-WebGL, and forced-color paths remain complete?
