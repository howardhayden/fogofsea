# 10 — Gameplay, Graphics, Matrices, and Decision Logic

## 1. Gameplay thesis

The game asks the player to build and test a causal argument:

```text
political aim
  -> mission objective
  -> warfare areas and theory
  -> force and capability relationships
  -> orders under environmental and opposing pressure
  -> state changes and evidence
  -> debrief adjustment
```

The score is a summary of the invented rules. The learning value lies in the trace from assumption to decision to evidence.

## 2. Playthrough model

### Phase A — Accept a coherent problem

The generator composes mission-family grammar, threat, region, climate, observer, date, season, time, cloud/precipitation, sea, wind/current/waves, visibility, celestial eligibility, actors, narrative, force requirements, and scenario matrix.

`validateScenarioCoexistence` checks ten domains:

1. identity;
2. region and climate;
3. season and date;
4. weather, cloud, and precipitation;
5. sea, wind, current, wave, and visibility;
6. celestial and aurora environment;
7. mission, threat, geography, and objective;
8. force requirements;
9. difficulty matrix and actor logic;
10. narrative substance and uniqueness.

Only a complete valid candidate is shown.

### Phase B — Define strategic logic

The player identifies warfare areas and selects an end state, primary theory, distinct partner theory, and controlling guardrail. This orders political purpose before force composition.

### Phase C — Construct a legal, credited force

The player allocates a fixed 100-point budget across fictional platforms, aircraft, and mission packs. Credit depends on:

- selected warfare-area affiliation;
- scenario relevance;
- compatible selected host;
- available host slot/capacity;
- invented reach;
- tracking method and track capacity;
- mission-specific minimums and screens.

The system distinguishes **selected**, **compatible**, **hosted**, **mission-credited**, and **readiness-contributing**. UI copy must never collapse these states.

### Phase D — Review readiness

Pure assessment functions derive mission fit, environment fit, capacity, readiness gaps, and substitution guidance. The player may revise without penalty.

### Phase E — Command six turns

Each turn selects:

- formation;
- sensor policy;
- tempo;
- engagement posture;
- uncrewed employment;
- undersea employment;
- risk treatment;
- coordination;
- strategic-force policy;
- assigned warfare task.

Resolution updates range, contact, integrity, readiness, supply, escalation, primary/secondary objectives, opposing pressure/cohesion, disruptions, and report history.

### Phase F — Debrief and iterate

The completed outcome compares explicit thresholds, score components, and turn evidence. The player can undo the final turn, retry the same scenario, return to planning, open a lesson, or generate another validated scenario.

## 3. Matrix architecture

### 3.1 Scenario commitment

At scenario creation, the matrix fixes:

- force scale and estimated opposing elements;
- opposing coordination;
- institutional constraint;
- illicit-network category where mission-compatible;
- optional secondary objective;
- scheduled disruptions;
- six committed turn draws.

Difficulty activates an allowed subset and adverse bias. It does not regenerate the underlying scenario commitment.

### 3.2 Turn resolution matrix

Each turn estimates five inspectable components:

| Component | Representative inputs |
| --- | --- |
| Contact | contact quality, sensing policy, visibility, range, compatible tracking |
| Task | assigned warfare task, formation, engagement, capability fit |
| Environment | climate, season, weather, sea, reach, environment-fit readiness |
| Coordination | posture, coordination, uncrewed/undersea methods, actor pressure |
| Sustainment | supply, tempo, readiness, risk treatment, disruptions |

Each component has a range, committed chance, precommitted draw, and success/partial/failure result. The ultimate matrix combines them into another disclosed range and committed result.

### 3.3 Determinism and undo

The draw is fixed before turn resolution. Identical scenario, state, readiness, and orders therefore produce identical output. Undo restores one exact state and cannot change the commitment.

## 4. Fog of war and disclosure

- Unknown air, surface, and subsurface markers require mission-credited compatible sensing in that domain.
- Unsupported or merely selected equipment reveals nothing.
- Visible markers communicate bounded domain uncertainty, never identity or opposing composition.
- Opposing capability impacts remain concealed unless contact quality and domain visibility permit disclosure.
- Future disruptions/objectives remain unrevealed until their turn.
- The canvas and accessible copy derive from the same visibility model.

## 5. Score and outcome

The final score decomposes into:

- objective progress;
- opposing disruption;
- force integrity;
- command readiness;
- supply;
- contact quality;
- escalation discipline;
- planning.

Victory additionally depends on explicit difficulty-aware thresholds for score, primary objective, optional secondary objective, integrity, supply, and escalation. A high score cannot silently override a failed mandatory threshold.

## 6. Graphics as rule communication

### 6.1 Layer meaning

| Layer | Rule communication |
| --- | --- |
| Stars | scale, time, atmospheric clarity, celestial occlusion |
| Sky | cloud taxonomy, fog, aurora eligibility, precipitation, light |
| Air | aircraft visibility, weather, altitude, contact gating |
| Surface | sea state, waves, ice/terrain, vessels, unknown surface contact |
| Subsurface | depth, aperture/refraction, submarines, unknown subsurface contact; no falling weather |

### 6.2 Environmental derivation

Graphics are generated from scenario fields rather than cosmetic presets:

- wind/current/sea state influence wave direction, form, and subject motion;
- visibility/cloud/precipitation determine fog classification and atmospheric density;
- precipitation and storm inputs determine weather tier, particle/curtain counts, fall speed, apparent particle size, and cloud-attached source cells;
- climate, cloud, precipitation, and storm determine cloud regime;
- every wet or snowy source cell is anchored beneath an actual precipitation-bearing cloud shell, and malformed wet visual input fails closed into a nimbostratus deck rather than clear-sky precipitation;
- latitude, climate, time, weather, and cloud state determine aurora eligibility;
- time controls star, aurora, celestial, and dream-emission presentation;
- Dawn and Dusk apply explicit 64- and 96-light floors to the brightest optically qualified star cohorts; this modifies visibility only and leaves star population, geometry, scale, halo, twinkle, and wandering unchanged;
- observer/date/time determine Sun and Moon geometry.
- accepted region, climate, season, time, precipitation, storm, wind, sea state, visibility, ice edge, and proximity to land determine recognizable wildlife presence and count.

### 6.3 Occlusion contract

Stars participate in fog and render behind aurora, clouds, fog banks, water, terrain, and subjects. Clouds write depth. Waves obscure background and submerged/behind-wave light. Moon geometry renders only illuminated phase facets; the dark hemisphere is transparent rather than a visible dark disk.

### 6.4 Motion contract

- Star movement is independent, bounded, non-orbital target wandering.
- Clouds drift, breathe, and morph within taxonomy-specific bounds.
- Aurora spline paths carry five unjoined depth veils; five to seven broad paths overlap across widely staggered depths and orientations, then snake, waver, drift, breathe, and evolve on asynchronous periods.
- Selected subjects breathe more slowly and shallowly than stars twinkle.
- Sea motion follows the environmental field.
- Every recognizable creature is an articulated avatar rather than one rotating primitive. Its position advances continuously along a deterministic closed ecological route with a changing next waypoint, tangent-facing heading, and habitat-specific bounds: birds flap and bank; commuting penguins hop inside a floe; seals scoot or swim; and marine animals propel themselves with tail and fluke cycles. Route radius is generated per animal; lateral eccentricity remains 0.34–0.76, ice travel is clamped to 0.34–0.58 world units within its assigned floe, and a lying waypoint has zero travel radius. Dolphins use `0.14–0.195` display scale, `0.11–0.16` speed, and `1.8–3.2` route radius; their optional porpoising adds only a bounded wave-relative lift and pitch to continuous travel. Sharks use `0.12–0.18` scale and `2.2–3.8` radius below their local wave surface, except for a tightly bounded dorsal greeting. A deterministic minority—but never all—of a multi-penguin group may rest lying down (`resting < visible`, including zero resting when only one penguin is visible); greeting one stages a grounded brace-and-recovery, stand, puzzled head scratch, and return to its waypoint over 4.8 seconds, with no accumulated circle rotation. Reduced motion freezes a readable active anatomical pose and never removes the animal. None inherits tactical rings or dream emission.

- WebGL retains hidden surface/depth coordinate helpers with `visible: false`, `opacity: 0`, and color/depth writes disabled; fallback CSS likewise fixes `.fallback-grid` at `display: none` with no background image. Heading, range, camera controls, wave sampling, water geometry, seabed geometry, and Plot Data telemetry remain unchanged.
- Lightning/light cues are localized, eased, and non-flashing.
- Reduced motion freezes all autonomous nonessential motion.

## 7. Performance architecture

Visual richness is budgeted by shared geometry, instancing, bounded counts, shallow shaders, and scene-layer culling:

- one instanced star mesh for the full canopy;
- cohesive cloud shell per cloud mass rather than many translucent lobes;
- bounded aurora curtain count and tessellation;
- bounded fog banks, precipitation particles/curtains, and subject halos;
- at most six recognizable wildlife groups and 48 articulated individuals, culled by view and ecological suitability; shared low-poly geometries and small per-avatar joint trees keep the engine bounded;
- view-based visibility prevents rendering irrelevant layers;
- reduced-motion rendering avoids unnecessary continuous animation.

If a lower performance tier is introduced, degradation order is:

1. reduce decorative far-field density or shader detail;
2. reduce nonessential cloud/aurora tessellation;
3. reduce secondary halos or particles;
4. preserve weather severity, foreground subjects, occlusion, interaction, and text alternatives.

## 8. Rule transparency levels

| Level | Player sees | Purpose |
| --- | --- | --- |
| Immediate | Labels, current values, block reasons | Complete the current action |
| Explanatory | Compatibility notes, readiness gaps, order notes | Understand causal relationships |
| Analytical | Matrix ranges/components, timeline deltas, score thresholds | Audit outcome logic |
| Reference | Field Guide, Academy, TXT record | Study and compare |
| Internal | Seeds, raw enums, unrevealed commitments | Preserve implementation/replay; not routine UI |

## 9. Model integrity rules

1. No displayed scenario may fail coexistence validation.
2. No visual-time exploration may change adjudication state.
3. No decorative contact may be mistaken for a tactical contact.
4. No prose field may influence score or command resolution.
5. No import may bypass catalog, matrix, or replay invariants.
6. No retry of identical state/orders may change the result.
7. No future commitment may leak through readable active export.
8. No visual effect may erase the foreground or its semantic equivalent.
9. No weather particle may fall in Stars or Subsurface view.
10. No aurora may exist during Day.

## 10. Evaluation protocol

Use four complementary evidence types:

- **model tests:** exact invariants, bounds, determinism, validation, replay;
- **interaction tests:** focus, keyboard, semantic state, mobile disclosure, save/import;
- **rendered visual tests:** density, depth, motion, occlusion, contrast, component bounds;
- **human studies:** comprehension, emotion, accessibility, facilitation, art direction.

Passing one type does not substitute for the others.
