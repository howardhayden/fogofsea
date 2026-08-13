# 01 — Design System Architecture

## 1. System intent

The design system is not only a visual component library. It is a set of contracts connecting fictional scenario synthesis, player state, disclosure order, tactical graphics, deterministic adjudication, privacy, accessibility, and release evidence.

The architecture follows a functional core / interactive shell model:

```text
fictional content grammars + seed
              |
              v
whole-scenario synthesis -> coexistence validation -> accepted Scenario
              |                                      |
              |                                      v
              |                              central session reducer
              |                                      |
              v                                      v
pure derived models ----------------------> React interaction shell
  force credit                                    |
  readiness                                       +--> semantic UI / dialogs
  contact visibility                              +--> Three.js tactical scene
  celestial/weather plans                         +--> Web Audio soundscape
  matrix commitments                              +--> browser/TXT persistence
              |
              v
deterministic six-turn resolution -> record -> debrief -> Academy links
```

## 2. Architectural layers

| Layer | Responsibility | Principal sources | Rule |
| --- | --- | --- | --- |
| Product shell | Phase routing, overlays, focus restoration, responsive workspace | `app/page.tsx` | Coordinates; does not own domain formulas. |
| Session state | Canonical mutable player/session state and typed actions | `app/useGameSession.ts` | All gameplay mutations cross one reducer boundary. |
| Scenario model | Grammar composition, environment, actors, objectives, coexistence validation | `app/gameModel.ts` | No candidate reaches UI until every coupled facet validates. |
| Catalog and credit | Fictional platforms, aircraft, packs, hosting, capacity, mission credit | `app/catalog.ts`, `catalogMath.ts`, `forceReadiness.ts` | Selection is not the same as legal hosting or credited capability. |
| Planning model | Completion, environment fit, gaps, readiness, strategic framing | `planningAssessment.ts`, `operationalStrategy.ts` | Derived explanations must remain inspectable and deterministic. |
| Command model | Orders, state transitions, undo, score, findings | `kriegsspiel.ts` | Same state + same orders = same next state. |
| Uncertainty model | Precommitted disruptions, objectives, actor coordination, component ranges/draws | `scenarioMatrix.ts` | Commit before play; disclose only when rules permit. |
| Visibility model | View layers, unknown contacts, celestial transmission and occlusion | `viewModel.ts`, `contactVisualization.ts`, `celestial.ts` | Lack of credited sensing reveals nothing. |
| Environmental model | Stars, atmosphere, clouds, fog, precipitation, aurora, sea, wildlife, emission | `starfield.ts`, `environmentVisuals.ts`, `wildlife.ts`, `wildlifeAvatar.ts`, `battlefieldScene.ts`, `dreamEmission.ts` | Visual motion must be bounded, non-flashing, depth-aware, and semantically distinct from tactical contacts. Wildlife ecology is pure data; articulated mesh construction and behavior belong to its avatar engine. |
| Persistence boundary | Portable save format, browser minimization, import validation | `saveGame.ts`, `browserSaves.ts`, `inputSecurity.ts` | Imported state is untrusted until shape, domain, and replay checks pass. |
| Learning layer | Academy paths, lessons, checks, progress | `Academy.tsx`, `academyData.ts` | Learning content is optional support, not hidden scoring. |
| Presentation foundation | Tokens, layout, glass surfaces, reflow, fallbacks | `app/globals.css` | Semantics and usability cannot depend on blur support. |
| Evidence layer | Source, unit, browser, content, dependency, artifact checks | `tests/`, `scripts/`, `RELEASE_QA.md` | Claims need executable evidence or an explicit evidence limit. |

## 3. State architecture

### 3.1 Canonical session state

The session contains:

- accepted scenario and difficulty;
- selected warfare areas, strategic frame, force, aviation, and mission packs;
- optional written synthesis, rationale, assumptions, and termination criteria;
- Guided checklist preference and Academy completion;
- active rigid orders and command state;
- completed result and decision history.

Theme, save mode, overlay visibility, visualization telemetry, and short-lived status messages are interface state. They must not alter adjudication.

### 3.2 Derived state

Do not persist a value that can be safely re-derived from canonical state unless replay integrity requires it. Important derived models include:

- decision completion;
- mission-credited force points;
- host and slot compatibility;
- environment fit and readiness gaps;
- contact visibility;
- operational strategy frame;
- celestial and atmosphere plans;
- command matrix preview;
- debrief score explanation.

### 3.3 State invariants

1. Budget is fixed at 100 points.
2. Points remain locked until required strategic framing exists.
3. Removing a warfare area is blocked while dependent selected items remain.
4. Aircraft and mission packs require compatible selected hosts and capacity.
5. Optional prose is never read by the rigid umpire.
6. A result requires a canonical completed command state.
7. Active command state cannot contain a completed result.
8. Current-format imported command history must replay from scenario, readiness, orders, and committed draws.

## 4. Design-system foundations

### 4.1 Token families

CSS custom properties are the source of truth for:

- background, panel, raised surface, line, text, muted text, accent, warning, and outcome colors;
- spacing rhythm and control sizing;
- border radius and hairline weight;
- shadow, directional glass highlight, blur, and saturation;
- motion duration, easing, opacity, and reduced-motion overrides;
- tactical layer colors and time-of-day variants.

The canonical occupied-surface contract is deliberately exact rather than
component-specific: `--glass-panel-mix: 63%`, a 145-degree highlight,
`--glass-blur: 22px`, and `--glass-saturation: 128%` compose
`--glass-surface-background`, `--glass-surface-shadow`, and
`--glass-surface-filter`. The Notional/mission panel is the reference consumer;
the header, HUD cards, alerts/reports, dialogs, Academy, Field Guide, command,
and debrief consume the same three properties from one final-cascade selector.

Tokens must encode semantic purpose, not component names. Prefer `--color-warning` over `--brief-yellow`.

### 4.2 Typography

- Primary family: self-hosted Jost variable font.
- Fallback: system sans-serif.
- Headings: compact, graphic, sentence- or title-case according to hierarchy.
- Kicker and data labels: uppercase with deliberate tracking.
- Narrative: ordinary casing, generous line height, no all-caps paragraphs.
- Numeric state: paired term and value; never color-only.

### 4.3 Surface system

The occupied surface owns the glass treatment. Positioning wrappers remain paintless.
Academy and Field Guide also share one neutral overlay context: a 42% theme
background scrim with the same blur and saturation. The scrim does not become a
second pane and neither tool is permitted to darken the scene more than the other.

| Surface | Treatment |
| --- | --- |
| Global top bar, mission panel, force panel | Directional tinted glass with strong text contrast |
| Compact plot controls and celestial disclosures | Small occupied glass controls/cards; wrapper has no generated box |
| Dialogs, Academy, Field Guide, alerts/reports, debrief | Canonical Notional glass container with opaque fallback |
| Nested narrative and form groups | Transparent or lightly raised; never blur the parent again |
| Forced colors / no backdrop support | Opaque system or token surface with visible boundary |

Privacy and security explanation belongs to the consent and data-management
surfaces, not to persistent play chrome. The top bar contains identity and
utilities only. A global status surface is instantiated only for an actionable
save failure; routine session mode remains available in Save/Load without
occupying the game viewport.

### 4.4 Component families

| Family | Examples | Shared contract |
| --- | --- | --- |
| Global action | Academy, Save/Load, Field Guide, Credits, Sound, Theme, New Game | 44-pixel compact target, explicit label, predictable overlay focus. |
| Phase navigation | Mission/Force/Visualization, Stars/Sky/Air/Surface/Subsurface | Selection is text + boundary + state; view changes never change domain state. |
| Disclosure | Plot Data, Contact Key, celestial data, optional analysis | Summary remains operable; compact details are bounded and mutually exclusive. |
| Decision | Warfare selections, ordered strategic selects, force counters, command orders | Label, current value, consequence/help, validation, recovery. |
| Status | Points, completion, readiness, contact, objective, score | Term/value pairing; polite announcement only when change is actionable. |
| Learning | Academy path/module/check/notebook | Named tab and panel semantics, optional saved progress. |
| Confirmation | New game, end command, delete/reset | Consequence in plain language, cancel-first focus strategy, destructive distinction. |

## 5. Scene architecture

The tactical plot is a semantic scene, not a decorative canvas.

```text
far sky gradient
  -> star canopy and harmonic stellar density fields
  -> FastNoise-domain-warped spline aurora veils
  -> clouds and fog banks
  -> precipitation (above water only)
  -> waves, ice, terrain, aperture/reflection
  -> vessels, aircraft, submarines, abstract contacts
  -> HTML HUD controls and disclosures
```

Depth testing, fog participation, water geometry, and render order preserve occlusion. Foreground subjects remain legible. Visual layers have text alternatives derived from the same plan data.

## 6. Security architecture

Trust boundaries are explicit:

```text
typed local interaction --------------------> reducer
untrusted browser storage/TXT/text input
        -> size and structure limits
        -> Unicode/text sanitization
        -> domain and catalog allowlists
        -> state-shape validation
        -> canonical matrix/state replay
        -> reducer only after acceptance
```

The static production boundary includes restrictive response headers, bundled local assets, no source maps, no application network requests, exact direct dependency versions, integrity-locked dependencies, license checks, notices, software bills of materials, and vulnerability review.

## 7. Accessibility architecture

Accessibility is distributed across the system:

- native controls and semantic regions form the base;
- phase changes set focus and produce one finite announcement;
- dialogs make the background inert, contain focus, and restore it;
- the canvas has text alternatives and button routes to all layers;
- compact disclosures preserve a central visual corridor;
- reduced motion freezes nonessential autonomous motion;
- forced colors replace glass and decorative color semantics;
- data, selection, warning, and outcome states use more than color.

## 8. Change protocol

For any new feature:

1. Identify canonical and derived state.
2. Add or update the pure domain model first.
3. Define validation, failure, and recovery behavior.
4. Add semantic interaction and focus behavior.
5. Add visual treatment and non-visual equivalent.
6. Define storage/export implications and migration behavior.
7. Add unit and browser evidence.
8. Update this suite, `README.md`, accessibility/security notes, and release evidence.
