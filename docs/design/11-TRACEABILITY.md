# 11 — Traceability and Review Checklists

## 1. Core traceability matrix

| Product promise | Experience evidence | Primary implementation | Verification / reference | Failure condition |
| --- | --- | --- | --- | --- |
| No account or gameplay telemetry | Privacy gate and Save dialog disclosure | Static app and local launcher | `SECURITY.md`, release network checks | Any app request sends decisions or save content |
| No browser write before opt-in | Session-only path | `useBrowserSaveManager.ts`, `browserSaves.ts` | Browser privacy tests | New app storage appears before consent |
| Prose excluded by default | Save-policy checkbox and status | `minimizePortableSaveForBrowser` | Save-game/browser-save tests | Prose enters a default browser slot |
| Coherent generated scenario | Atomic accepted brief | `synthesizeScenario`, `validateScenarioCoexistence` | Scenario/coastal tests | Any presented scenario has validation issue |
| Ordered strategic reasoning | Locked/current/complete steps | `StrategicDecisionFlow.tsx` | Source/browser lifecycle tests | Force optimization precedes purpose without explanation |
| Legal and credited force | Compatibility, capacity, points, readiness | `gameModel.ts`, `catalogMath.ts`, `forceReadiness.ts` | Catalog/readiness tests | Unhosted item earns mission credit |
| Unknown contacts require sensing | “No markers shown” or bounded domain markers | `contactVisualization.ts`, `viewModel.ts` | Contact visualization tests | Identity/composition leaks or unsupported marker appears |
| Deterministic command | No-reroll copy, exact undo | `kriegsspiel.ts`, `scenarioMatrix.ts` | Rigid/matrix/save replay tests | Same state/orders produce different result |
| Uncertainty is precommitted | Matrix ranges and turn report | `scenarioMatrix.ts` | Matrix and browser situation tests | Draw is created only after seeing player order |
| Optional writing never scored | Point-of-entry note, TXT label | `StrategicDecisionFlow.tsx`, `kriegsspiel.ts` inputs | Source/unit tests | Resolution reads prose content |
| Diagnostic loss and win | Cause → Evidence → Adjustment | `ResultDebrief.tsx` | Debrief/browser lifecycle tests | Finding has no cited evidence or repair |
| Complete keyboard path | Skip link, native controls, dialog focus | `page.tsx`, dialog components | `ACCESSIBILITY.md`, browser tests | A required action is pointer-only |
| Reduced motion completeness | Static representative scene | CSS and WebGL update functions | Reduced-motion browser/model tests | Essential object/state disappears |
| Compact scene remains usable | Bounded mutually exclusive cards | `globals.css`, Battlefield HUD | Layout/text-containment tests | Wrapper paints or card consumes main plot |
| Compact workspace and global tools remain reachable | Atomic destination selection closes and removes the drawer before focusing the view or opening the requested dialog | `page.tsx`, `globals.css` | Compact navigation and responsive global-tools browser tests | Drawer remains painted, intercepts the plot, or Academy/Guide/Sound is unavailable on a narrow screen |
| Bright twilight stars persist | Dawn and Dusk retain their 64/96 brightest qualified cohorts without changing the star material or animation | `viewModel.ts`, `starfield.ts` | Starfield model and browser tests | Twilight has no bright lights, or the fix changes size, halo, population, twinkle, or wandering |
| Celestial/environment coherence | Day exclusion, darkness progression, cloud-attached tiered weather layers | `celestial.ts`, `environmentVisuals.ts`, `battlefieldScene.ts` | Environment/celestial and scenario-distribution tests | Aurora at Day, precipitation underwater, clear-sky rain, detached rain/snow source, or visually weak severe tier |
| Ecologically coherent wildlife | Region/season/weather-qualified articulated scenery traveling on bounded habitat routes, pointer/keyboard happy reactions, minority-only resting penguins with a staged comic response, compact continuously traveling dolphins, plausible subject scale, and water-safe sharks | `wildlife.ts`, `wildlifeAvatar.ts`, `battlefieldScene.ts`, `Battlefield.tsx` | Wildlife avatar/model and environment browser tests | Arctic penguin, storm-flying bird, space-layer animal, inert or in-place-only creature, all-penguin resting group, spinning or incomplete resting-penguin recovery, beached/oversized/idling shark or dolphin, animal rivaling a selected vessel, pointer-only greeting, or wildlife treated as contact evidence |
| Unobstructed organic scene | Invisible WebGL and fallback coordinate grids while retaining controls, world geometry, wave sampling, and Plot Data telemetry | `battlefieldScene.ts`, `Battlefield.tsx`, `globals.css` | Grid presentation invariant and browser environment checks | Visible surface/depth graph paper, hidden telemetry, removed view control, or flattened wave/seabed geometry |
| Dark moon side is not drawn | Illuminated facet geometry only | `battlefieldScene.ts`, `MoonPhaseSwatch.tsx` | Celestial visibility tests | Dark hemisphere appears as an opaque disk |
| Local portable TXT | Download/import controls and readable record | `saveGame.ts`, `SaveManager.tsx` | Save/import/browser tests | Invalid import partially replaces session |
| Current save integrity | Replay rejection | `isCanonicalRigidState`, `parsePortableSave` | Save-game tamper tests | Altered commitment/state imports successfully |
| Fictional boundary | Independence copy and invented catalog | `README.md`, content data | Content verification | Official identifier or real-world claim enters release |
| Dependency accountability | Notices, licenses, SBOM | `scripts/`, lockfile | License/SBOM/audit checks | Unreviewed license/version ships |
| Perceptual organization | Clear figure–ground, semantic grouping, distinct motion channels | `globals.css`, scene render order and update functions | Gestalt analysis, layout/environment tests | Decorative or wrapper paint becomes the perceived content surface |
| Empathy-led requirements | Persona pains/gains map to interaction and research questions | Cross-cutting product behavior | Empathy maps and playtest protocols | Hypotheses are presented as observed user fact |
| Informative microcopy | Status, dependency, privacy, uncertainty, and recovery copy describes actual rules | React components and domain-derived labels | Microcopy system, content/source/browser tests | Copy omits consequence, repair, scope, or trust boundary |
| Heuristic quality | Strengths, residual risks, and roadmap findings use a severity rubric | Cross-cutting implementation | Heuristic evaluation and re-evaluation protocol | Known severity 3–4 issue has no owner/evidence/release decision |

## 2. Domain coverage matrix

| Domain | Architecture | Language | IA | Interaction | Emotion | Journeys/empathy | Blueprint | Roadmap | Security/logic | Gestalt/copy/heuristics |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Full playthrough | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Security/privacy | ✓ |  | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| TXT input/output | ✓ |  | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Aesthetic/glass | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Graphics/weather/celestial | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Force/capability logic | ✓ |  | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Matrices/uncertainty | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Academy/learning | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Accessibility/mobile | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Release/service operations | ✓ |  | ✓ | ✓ |  | ✓ | ✓ | ✓ | ✓ | ✓ |

## 3. Feature design review

Before implementation:

- What player problem and phase does this address?
- Is the feature canonical state, derived state, presentation state, or documentation?
- What can be concealed, persisted, exported, scored, or replayed?
- What is the smallest valid failure and recovery path?
- Does it preserve the fictional and educational boundary?
- Does it alter compact layout, focus, semantic naming, reduced motion, forced colors, no-WebGL, or no-sound use?
- Does it create a new trust boundary or dependency?

Before release:

- Has the rule been implemented once in a pure source of truth?
- Do UI and TXT use player-facing labels rather than duplicating formulas?
- Are state migrations and imports bounded and canonical?
- Do source/model, interaction, rendered visual, and human-evidence claims remain distinct?
- Is any old functionality removed or made unreachable?
- Do README, this suite, Security, Accessibility, and Release QA agree?

## 4. Visual review

### Composition

- Foreground vessels/aircraft/submarines remain dominant.
- Stars cover the appropriate sky without forming oval panels, trails, or a disconnected wall.
- White/near-white dominates stars while restrained color remains discoverable.
- Brightest qualified stars remain present at Dawn and Dusk while atmosphere and foreground geometry retain natural occlusion.
- Aurora consists of five to seven expansive tapered three-dimensional spline-curtains with five unjoined depth veils each and is absent in Day.
- Clouds read as cohesive faceted bodies, not overlapping translucent eggs.
- Fog has real distance extinction and thins upward/at altitude.
- Rain/snow tier, wind consequence, cloud-base origin, density, apparent size, and speed are legible and never underwater. Extreme rain reaches 8,800 streaks and six curtains; extreme snow reaches 7,200 flakes, 11.6 modeled pixels, and 9 scene units per second, while a validated storm cannot render below the squall tier.
- Recognizable wildlife fits region, season, time, weather, ice/land proximity, and view; it remains subordinate to operational subjects and semantically separate from unknown contacts.

### UI surfaces

- Occupied panels have perceptible directional glass in both themes.
- Static and browser regressions assert that Notional, header/navigation, HUD,
  alerts/reports, Academy, Field Guide, and dialog families resolve the same
  63%/22px/128% canonical material in light and dark themes.
- Positioning wrappers do not paint.
- Nested text does not sit on an unexplained second slab.
- Top bar, Academy, Field Guide, Save, result, view map, and celestial cards use the same system.
- Compact disclosures stay within the 22%/150-pixel budget.
- Opaque and forced-color fallbacks remain readable.

### Motion

- Stars twinkle and wander; subjects breathe more slowly.
- Clouds, fog, sea, and aurora use independent bounded periods.
- No strobe, perfect synchronization, orbit, curly trail, or full-screen flash.
- Reduced motion is visually composed and completely static.

## 5. Interaction and content review

- Current task is clear at every phase.
- Completed choices are editable; locked choices explain why.
- Every select has a nearby explanatory note.
- Blocked roster action names the dependency and repair.
- Optional prose is labelled unscored and its persistence is explicit.
- Every destructive action distinguishes cancel and consequence.
- Status messages are finite and do not compete with reports.
- Outcome copy is evidence-based and non-shaming.
- Unknown information is not implied through labels, animation, or export.

## 6. Security and privacy review

- No new browser write occurs before opt-in.
- New fields have a documented minimization and TXT policy.
- Imported values have size, shape, domain, and canonical checks.
- Current command state remains replay-verifiable.
- Active readable TXT does not reveal future commitments.
- Browser data is still described as unencrypted.
- Runtime content policy and local-only asset assumptions still hold.
- Dependency, notice, license, SBOM, vulnerability, and artifact checks pass.

## 7. Accessibility review

- Required controls have names, states, descriptions, and logical order.
- Modal background is inert; focus is contained and restored.
- Phase focus and skip link target are correct.
- Canvas state has an equivalent concise textual model.
- No state relies only on color, animation, sound, hover, or pointer gesture.
- Compact targets are at least 44 by 44 pixels.
- 320-pixel and 200%-equivalent layouts avoid page-level horizontal scrolling.
- Reduced motion, forced colors, no blur, and fallback scene are complete.
- Human assistive-technology evidence is stated accurately and never inferred from automation alone.

## 8. Documentation maintenance

Update this suite when any of the following changes:

- phase, navigation, disclosure, or focus model;
- scenario fields or validator facets;
- force credit, readiness, matrix, score, or outcome logic;
- storage schema, TXT format, privacy policy, or trust boundary;
- visual layer, occlusion, motion, performance budget, or fallback behavior;
- Academy content structure or progress storage;
- release checks, dependencies, browser support, or evidence limits.
- microcopy terminology, severity findings, persona hypotheses, or perceptual composition rules.

The suite is versioned with the release. It should describe the product that is actually in the archive, not a remembered intention.
