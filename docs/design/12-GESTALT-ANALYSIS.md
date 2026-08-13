# 12 — Gestalt Analysis

## 1. Purpose and scope

This analysis evaluates how players perceptually organize FOG OF SEA before they consciously read every label. It covers the global shell, planning and command panels, compact disclosures, tactical scene, environmental motion, and debrief.

Gestalt principles are descriptive tools, not universal laws. They supplement semantic structure, accessibility testing, and task research; they do not replace them.

## 2. Summary assessment

FOG OF SEA’s strongest perceptual decision is the separation of a calm glass instrument layer from a deep, animated low-poly world. Progressive disclosure and common-region grouping make a dense ruleset tractable. The main risks occur when decorative depth competes with text contrast, repeated cards become visually interchangeable, or a mobile positioning wrapper accidentally becomes a perceived full-screen surface.

| Principle | Current use | Assessment | Governing rule |
| --- | --- | --- | --- |
| Figure–ground | Glass controls over sea/sky; foreground subjects over distant light | Strong when occupied surfaces own tint; fragile over bright Dawn/weather | Preserve contrast and depth occlusion; wrappers never paint |
| Proximity | Related values, decisions, order controls, and actions cluster | Strong | Spacing must represent relationship before decoration |
| Similarity | Shared cards, counters, disclosures, status pairs | Useful but can flatten hierarchy | Similar appearance means similar behavior and consequence |
| Common region | Mission, force, command, dialogs, compact details | Strong with single-layer glass | One conceptual group per boundary; avoid nested slabs |
| Connectedness | Host–aircraft–pack dependencies and step progression | Mostly conveyed through text/status | Use explicit dependency copy; do not rely on lines alone |
| Good continuation | Strategy → Force → Command → Debrief; view-depth ladder | Strong | Preserve directional order and focus movement |
| Closure | Faceted stars, vessels, cloud shells, Moon phase | Expressive low-poly identity | Silhouettes must remain legible; do not close the Moon’s dark side |
| Common fate | Waves, clouds, fog, aurora, stars, subject emission | Strong when motion channels differ | Related matter may move together; different phenomena must not synchronize |
| Prägnanz | Compact labels, geometric forms, reduced palette | Mixed under maximum information density | Reveal the simplest meaningful state, not the fewest words possible |
| Focal point | Current step, selected time/view, resolve action, outcome | Strong | One primary focal action per task region |

## 3. Figure–ground

### Interface

The tactical world is the ground; occupied glass surfaces are the interaction figure. Directional tint, rim light, blur, and boundary create separation while allowing atmospheric continuity.

Successful conditions:

- the active panel is more legible than the world immediately behind it;
- the world remains recognizable around and faintly through glass;
- nested prose is transparent, so the parent remains one coherent figure;
- compact Plot Data, celestial data, and Contact Key cards are discrete figures rather than a continuous overlay;
- the top bar reads as a persistent tool surface, not sky.

Failure conditions:

- a full-height semantic wrapper receives tint or backdrop blur;
- pale Dawn, fog, or aurora reduces text contrast inside translucent panels;
- a halo or star paints over the vessel that should be figure;
- several overlapping translucent cloud lobes read as UI-like ovals.

### Tactical scene

Depth establishes figure–ground without outlines:

```text
distant gradient and stars
  < aurora
  < clouds and fog
  < sea/terrain
  < vessels, aircraft, submarines
  < tactical HTML controls
```

Fog, depth testing, and waves make occlusion informative. The foreground subject remains crisp; background light is interrupted rather than drawn on top.

## 4. Proximity

Proximity carries the first level of meaning:

- condition label and value form one pair;
- an item’s description, compatibility, credit, and quantity controls form one roster object;
- a select and its explanatory note form one command choice;
- a debrief cause, evidence, adjustment, and lesson link form one finding;
- a disclosure summary and its details form one edge-anchored unit.

Design rules:

1. Related label/value gaps are smaller than gaps between different pairs.
2. Add/remove controls follow all information for their item, preventing accidental association with the next card.
3. Destructive actions are separated from routine save actions.
4. On compact layouts, moving controls into a rail must not change which content they appear to govern.
5. Decorative spacing never overrides semantic group spacing.

## 5. Similarity

Similarity creates learnability across:

- global utility buttons;
- strategic decision steps;
- catalog cards and counters;
- condition and readiness pairs;
- command select/note groups;
- debrief findings;
- Academy modules and knowledge checks.

Risks:

- if primary, secondary, and destructive buttons look identical, consequence becomes ambiguous;
- if required, recommended, selected, hosted, and credited states differ only by color, similarity conceals important differences;
- if every data group uses the same heavy border, the eye cannot find the current task;
- if decorative stars resemble objective/contact markers, world and interface vocabularies collide.
- if every bright star disappears at Dawn or Dusk, temporal continuity breaks and the celestial field reads as a switched layer rather than one atmosphere.

Similarity must follow behavioral equivalence. Differences in selection, requirement, uncertainty, and consequence require text, shape, or boundary differences.

## 6. Common region

Common region is the dominant organizational principle. Major bounded regions are:

- privacy gate;
- global top bar;
- mission/strategy panel;
- force panel;
- tactical scene;
- command panel;
- debrief;
- Academy, Field Guide, Save, Credits, and confirmations;
- compact occupied disclosure cards.

The rule is **one conceptual region, one perceptual surface**. Nested content may use whitespace, hairlines, or a restrained raised tint, but not another full glass slab. Mobile positioning containers use `display: contents` or equivalent paintless behavior so semantic ownership does not create a false region.

## 7. Connectedness and dependency

FOG OF SEA contains many non-spatial connections:

- warfare area → affiliated catalog item;
- host → aircraft or mission-pack capacity;
- end state → theories → guardrail;
- readiness gap → command consequence;
- order → turn delta → outcome finding;
- finding → Academy lesson.

Because connector lines would clutter compact layouts, connectedness is expressed through ordered placement, labels, compatibility statements, and focus progression. When a dependency blocks an action, microcopy must name both nodes: “This aircraft needs a compatible selected aviation host with an open slot.”

## 8. Good continuation

### Workflow continuation

The primary line is Strategy → Force → Command → Debrief. Within Strategy, the line is warfare areas → end state → primary theory → second theory → guardrail → optional reflection. Focus moves along the same line, so visual and keyboard continuation agree.

### Spatial continuation

The view ladder—Stars, Sky, Air, Surface, Subsurface—creates a continuous depth model. Page Up/Page Down and labelled buttons preserve the order. Pointer orbit changes angle, not depth, avoiding a broken mental model.

### Environmental continuation

Wave direction, cloud drift, fog advection, and aurora meander should continue across the frame without producing literal straight bands or stitched oval fields. Stars use overlapping global-support density fields so abundance continues without visible cluster boundaries.

## 9. Closure

Low-poly forms ask the eye to complete shapes from facets:

- octahedral stars read as crystalline glints;
- merged subject silhouettes read through thin emission shells;
- cloud topology reads as one atmospheric body;
- aurora depth-separated translucent veils and winding centerlines read as a spatial volume without closing into cloth slabs;
- wave facets imply a continuous sea.

Closure must not fabricate information. The Moon renders only illuminated phase geometry; an opaque dark hemisphere would invite the eye to interpret a visible disk that the design explicitly intends to omit. Unknown contacts remain abstract and cannot acquire identity through silhouette detail.

## 10. Common fate

Motion groups elements that belong to the same phenomenon:

- wave facets share a directional field;
- cloud vertices share wind drift while individual masses breathe asynchronously;
- aurora vertices share curtain motion while separate curtains retain phase differences;
- each star twinkles and selects bounded wander targets independently;
- a vessel’s core and halo breathe together;
- precipitation shares wind slant but varies depth and speed.

Motion channels must remain perceptually distinct:

| Phenomenon | Perceptual signature |
| --- | --- |
| Stars | irregular scintillation and independent bounded wander |
| Aurora | long spatial spline-veils, winding wave, drift, and shallow luminance breath |
| Clouds | slow mass drift and topology morph |
| Fog | low-frequency veil advection and vertical thinning |
| Waves | coherent directional surface force |
| Subjects | extremely shallow, slow native-color breath |

Perfect synchronization would incorrectly group unrelated phenomena. Reduced motion removes common-fate cues, so static shape, depth, color, and text must retain grouping.

## 11. Prägnanz and visual simplicity

Prägnanz does not mean minimizing the simulation into a sparse dashboard. It means giving each moment the simplest complete representation:

- a complete choice compresses into an editable summary;
- a locked choice shows one reason;
- a turn report presents changes after current orders;
- a debrief finding uses one cause, its evidence, and one adjustment;
- a compact disclosure shows one occupied card at a time;
- a vast stellar canopy emerges from simple faceted lights rather than painted nebula blobs.

The most serious Prägnanz risk is equal visual weight across too many controls. Current phase, current step, and primary action require stronger contrast than reference or utility actions.

## 12. Desktop and compact comparison

| Concern | Desktop | Compact/mobile |
| --- | --- | --- |
| Figure–ground | Several edge surfaces can coexist | Only one compact detail surface should occupy the scene |
| Proximity | Columns create stable groups | Reflow must preserve label/control ownership |
| Common region | Mission panel and scene coexist | Workspace views replace stacking; wrappers remain paintless |
| Continuation | Left-to-right task/scene relationship | Top-to-bottom task order plus explicit view switcher |
| Focal point | Current panel/action | Persistent completion/points plus current mobile view |
| Closure | More surrounding context | Cropping cannot amputate controls, halos, or meaning |

## 13. Gestalt acceptance checklist

- Can the current task be identified before reading all copy?
- Does spatial grouping match semantic and keyboard grouping?
- Do similar-looking controls have similar consequence?
- Does each glass boundary contain exactly one conceptual region?
- Are dependencies explicit without decorative connector clutter?
- Does phase and depth navigation follow a stable line?
- Do low-poly silhouettes close clearly without inventing hidden information?
- Do related environmental elements move together while unrelated channels remain asynchronous?
- Does the compact scene retain figure–ground separation when any disclosure opens?
- Does the reduced-motion rest pose preserve every grouping formerly supported by motion?
