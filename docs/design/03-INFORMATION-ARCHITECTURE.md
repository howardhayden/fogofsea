# 03 — Information Architecture

## 1. IA objective

The information architecture turns a dense strategy system into a sequence of answerable questions. It must preserve three forms of orientation at once:

- **task orientation:** What should I decide next?
- **world orientation:** What conditions and layers am I looking at?
- **trust orientation:** What is fictional, saved, concealed, or used in adjudication?

## 2. Experience map

```text
Launch
└─ Privacy before play
   ├─ Choose Guided / Standard / Challenge
   ├─ Session only
   ├─ Enable named browser save
   └─ Load existing browser save

Primary workspace
├─ Strategy planning
│  ├─ Exercise conditions and mission brief
│  ├─ Identify warfare areas
│  ├─ Define end state
│  ├─ Select primary theory
│  ├─ Select complement/challenge theory
│  ├─ Select guardrail
│  └─ Optional unscored writing
├─ Force design
│  ├─ Surface/subsurface platforms
│  ├─ Embarked aviation
│  ├─ Mission packs
│  ├─ Compatibility and capacity
│  └─ Readiness review
├─ Command
│  ├─ Planning recap
│  ├─ Situation / disruptions / objectives
│  ├─ Nine order dimensions + assigned task
│  ├─ Resolve / exact one-turn undo
│  └─ Six-turn record
└─ Debrief
   ├─ Score and thresholds
   ├─ Component breakdown
   ├─ Cause → Evidence → Adjustment
   ├─ Turn timeline
   └─ Related Academy lessons / retry paths

Persistent utilities
├─ Academy
├─ Save / Load / TXT
├─ Field Guide
│  ├─ Plain-language rules
│  ├─ Security, privacy, and saves
│  ├─ Accessibility and controls
│  └─ Open-source notices
├─ Credits and notices
├─ Sound
├─ Theme
├─ New Game
└─ Tools menu equivalents on compact layouts

Visualization
├─ Stars
├─ Sky
├─ Air
├─ Surface
└─ Subsurface
   ├─ Plot Data
   ├─ Sky / celestial data
   ├─ Star or subsurface data
   └─ Contact Key
```

## 3. Primary hierarchy

Player help and internal product documentation are separate layers. The Field Guide links only to material that helps a player understand play, scoring boundaries, saving, security, privacy, accessibility, controls, or licenses. Personas, empathy maps, journey maps, service blueprints, roadmaps, and heuristic working papers remain internal design evidence and never appear as ordinary gameplay destinations.

### Level 0 — Trust and mode

The privacy gate precedes play because storage mode changes what the application may write. Difficulty is chosen here because it changes disclosed pressure and thresholds from the first scenario state.

### Level 1 — Game phase

The current phase is the dominant information object:

1. Strategy
2. Force
3. Command
4. Debrief

Visualization is a parallel lens, not a fifth decision phase. The tactical plot remains available as context while the decision surface changes.

### Level 2 — Current question

Within a phase, only the next logically available decision should demand attention. Completed decisions compress to editable summaries. Locked decisions state the dependency.

### Level 3 — Evidence and explanation

The mission brief, environment, operational frame, compatibility notes, readiness gaps, matrix ranges, turn reports, and debrief explain why a decision matters.

### Level 4 — Reference and learning

Field Guide, Academy, Credits, notices, and historical reading support exploration without blocking the active task.
Field Guide and Academy remain distinct information destinations, but their
modal context is deliberately identical: the same scene scrim, the same
Notional glass pane, and the same return-to-task focus behavior.

## 4. Navigation model

### 4.1 Desktop

- Global utilities occupy the top bar.
- Privacy, security, and persistence details do not repeat in the play header;
  they live at the pre-play gate and in Save/Load.
- The left planning/brief panel provides persistent scenario and workflow context.
- The tactical scene occupies the main field.
- View depth controls sit within the scene but outside narrative content.
- Small scene disclosures anchor to edges and may be opened independently where space permits.
- Phase-specific command or debrief content takes the primary workspace when active.

### 4.2 Compact and mobile

- A compact top bar groups utilities without removing them.
- Mission, Force, and Visualization become explicit workspace views.
- Points and decision completion remain persistent orientation signals.
- Plot Data, celestial data, contextual star/subsurface data, and Contact Key are mutually exclusive.
- Opening one creates only a bounded occupied card; its wrapper paints nothing.
- The center of the scene remains visible and does not become one large glass rectangle.
- Touch targets remain at least 44 by 44 CSS pixels.

Routine session mode is not a persistent status message. Only a failure that
requires recovery may interrupt play globally.
- Choosing a workspace or global-tool destination is one transition: the destination becomes active, the mobile drawer closes and leaves layout/hit testing, and focus enters the named region or dialog. Visualization remains reachable during Command, and Academy, Save / Load, Field Guide, Credits, and Sound Settings remain directly reachable without relying on a desktop-only header control.
- The compact Tools control is a peer of the workspace chooser: it opens a full-width canonical-glass drawer with a real dismiss layer, Escape support, and the same focus-return contract. Its five destinations remain available on narrow screens without repeating privacy or security copy in the game surface.

### 4.3 Keyboard and assistive navigation

- A phase-aware skip link targets the current work region.
- Native tab order follows reading and task order.
- Phase changes move focus to the new heading.
- Overlays trap focus and restore it to their opener.
- Every canvas view has a labelled button route; gesture or pointer orbit is never required.
- The debrief review region supports Page Up, Page Down, Home, and End.

## 5. Naming system

| Information | Naming rule | Example |
| --- | --- | --- |
| Phase | Verbable noun or familiar state | Strategy, Force, Command, Debrief |
| Scene layer | Physical perspective | Stars, Sky, Air, Surface, Subsurface |
| Disclosure | Content, not mechanism | Plot Data, Contact Key, Moon Below |
| Generated operation | Fictional operation + sector | Operation Wide Signal |
| Status | Term followed by value | Visibility — 4 NM |
| Blocked action | Reason + repair | Add a compatible host first |
| Uncertainty | Assessed status, range, or concealment | Ultimate range 48–67%; event concealed |
| Outcome | Effect and evidence, not moral verdict | Objective progress +12; supply −8 |

## 6. Content model

### Scenario

Identity, operation, region, climate, observer, date/season/time, clouds, precipitation, sea state, visibility, storm/lightning, wind/current/waves, mission narrative, actors, intelligence, civilian context, constraints, objective, required/recommended areas, budget, strategic frame, and precommitted matrix.

### Player plan

Warfare areas, end state, two theory lenses, guardrail, force roster, aviation, mission packs, optional prose, planning assessment, readiness, and command orders.

### Command record

Turn, phase, state values, orders, active events/objectives, component ranges and commitments, deltas, report text, notes, and outcome.

### Learning record

Academy path, module, objective, lesson, concept, misreading, application, discussion, knowledge check, readings, optional note, and completion.

### Persistence record

Portable format/version/time, canonical game state, preferences, Academy completion, save-slot policy, and human-readable decision history.

## 7. Disclosure matrix

| Content | Before relevant choice | When relevant | After resolution |
| --- | --- | --- | --- |
| Scenario conditions | Visible | Visible | Preserved in recap/export |
| Required warfare areas | Visible | Actionable | Preserved |
| Force compatibility | On item inspection | Actionable validation | Preserved in roster |
| Opposing identity/composition | Not exposed | Remains abstract | Only rule-permitted effects reported |
| Unknown contacts | None without credited sensing | Count/domain only | Turn record retains disclosed state |
| Probability range | Not needed during strategy | Previewed during command | Committed chance/draw/result disclosed |
| Future disruption/objective | Concealed if unrevealed | Revealed on scheduled turn | Fully recorded after resolution |
| Optional writing | Available after guardrail | Editable, never scored | Saved/exported according to policy |
| Machine resume data | Hidden from ordinary UI | Encoded in active TXT | Full completed record disclosed |

## 8. Search and findability

- Catalog search operates on fictional names, roles, affiliations, hosting, and capabilities.
- Academy supports path selection, module navigation, and saved completion.
- Field Guide groups rules by player question rather than source file.
- TXT is deliberately searchable plain text outside the bounded machine block.
- Status and error text names the affected entity so screen-reader and visual users receive equivalent findability.

## 9. IA anti-patterns

Do not:

- treat every generated field as a dashboard tile;
- place reference content inside the scoring path;
- expose internal enum names or seeds without explanatory context;
- use mobile overlays that cover the scene merely because their semantic wrapper fills it;
- leave the compact view menu open after a destination is selected; its
  occupied sheet is capped at 280 pixels wide and 58% of the dynamic viewport,
  while the closed details wrapper has no panel box or pointer interception;
- hide required actions behind unlabeled icons;
- make the player infer whether prose is scored or saved;
- label a concealed event with wording that indirectly reveals it;
- confuse a visual layer change with a state or phase change.
