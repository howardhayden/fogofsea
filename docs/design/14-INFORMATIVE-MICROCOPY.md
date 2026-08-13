# 14 — Informative Microcopy

## 1. Microcopy purpose

FOG OF SEA microcopy must help the player predict, decide, recover, and accurately describe the system. It is not ornamental flavor, an apology for complex rules, or a substitute for sound information architecture.

Every important string should answer one or more of:

- What is this?
- Why does it matter now?
- What will happen if I act?
- Why is this unavailable?
- What is saved, scored, concealed, or fictional?
- What is the smallest repair?

### Live surface versus Field Guide

The live surface uses concise state labels such as **CREDIT READY**,
**CREDIT LOCKED**, **COMPATIBILITY · 1/2**, or **Choose a compatible area**.
It does not repeat privacy, security, affiliation, storage, or umpire
mechanics. The Field Guide carries the plain-language model boundary,
mission-credit rule, learning explanation, security/privacy references, and
clickable documentation. After resolution, the debrief distinguishes a
supported adjustment from an unfavorable result with no clear mistake.

## 2. Voice characteristics

| Characteristic | Use | Avoid |
| --- | --- | --- |
| Direct | “Add a compatible aviation host first.” | “Oops! Something went wrong.” |
| Evidence-led | “Supply fell 8 points after the high-speed turn.” | “Your logistics were bad.” |
| Calm | “The current session remains active.” | Alarmist all-caps error paragraphs |
| Bounded | “In this simulation…” | “This proves…” |
| Respectful | “One adjustment is…” | “You should have known…” |
| Specific | “Browser saves are unencrypted.” | “Your data is safe.” |
| Fictionally precise | “invented nm,” “assessed actor” | Real-world authority or false operational precision |

All-caps is reserved for concise labels, statuses, and actions—not narrative explanation.

## 3. Message anatomy

### Informational state

`Label or fact` + `meaning`

> CONTACT QUALITY 42/100  
> The current picture supports classification, but not the selected engagement threshold.

### Blocked action

`What cannot happen` + `why` + `smallest repair`

> This aircraft is not credited because no compatible selected host has an open slot. Add a compatible host or remove another embarked aircraft.

### Warning

`Risk` + `when it applies` + `whether action remains available`

> High-speed tempo may improve position while increasing supply use and exposure. You can still choose it.

### Destructive confirmation

`Action` + `scope` + `what remains` + `clear cancel/confirm labels`

> Delete “Calm Tide”? This removes that browser slot from this profile. Downloaded TXT copies and the current open session are not deleted.

### Error and recovery

`Failure boundary` + `state preservation` + `next action`

> The TXT command record does not replay from its committed scenario state. Nothing was imported; the current session remains active. Choose another file.

## 4. Terminology rules

| Term | Meaning |
| --- | --- |
| Selected | Quantity is present in the proposed roster |
| Compatible | A valid host/relationship exists in the catalog |
| Hosted | Enough compatible selected capacity currently exists |
| Mission-credited | The hosted item is relevant to selected warfare areas and scenario requirements |
| Readiness-contributing | The credited item improves a readiness measure or minimum |
| Assessed | Information exists within the model but remains uncertain |
| Concealed | The model intentionally withholds information until a rule permits disclosure |
| Precommitted | The value/draw was fixed before the player’s current action |
| Encoded | Transformed to discourage casual reading; not encrypted |
| Session only | State remains in memory unless the player downloads TXT |
| Browser save | Unencrypted localStorage in this browser profile |

Never use “available,” “valid,” or “supported” where one of these narrower terms is intended.

## 5. Privacy and save microcopy

### Pregame

**Heading:** How should this game remember you?  
**Session-only description:** Write nothing new to browser storage. You can still download and import portable TXT saves.  
**Browser-save description:** Create a named game in this browser profile. Resumable game state is saved; free-form writing is excluded unless you include it.  
**Storage caution:** Browser data is unencrypted and may be readable by anyone with access to this profile.

### Save policy

**Checkbox label:** Include written analysis in this browser save  
**Help:** Stores synthesis, rationale, assumptions, and termination notes as readable text in this slot. TXT downloads include them regardless of this setting.

### Export

**Action:** Download TXT save  
**Help:** Readable decision record + restorable game data  
**Active-command note:** Future committed turns are encoded in the resume block to avoid casual disclosure. Encoding is not encryption.

### Import

**Action:** Import TXT save  
**Help:** Restore a file created by this app after complete validation  
**Success:** Imported “{operation}” at {phase}. Browser saving remains {on/off} according to the restored choice.  
**Failure:** This file was not imported: {bounded reason}. The current session remains unchanged.

## 6. Planning microcopy

### Ordered next steps

- **Before warfare classification:** Identify the warfare areas required by the brief to unlock the mission objective.
- **After classification:** Choose the political condition the force should create—not merely an activity to perform.
- **After end state:** Choose the primary theory that explains how action should create that condition.
- **After primary theory:** Choose a distinct second theory to complement or challenge the first.
- **After theories:** Choose the guardrail that limits acceptable methods and escalation.
- **After guardrail:** Optional writing is available for reflection. It is saved according to your data choice and never scored.

### Classification

**Required:** The brief directly demands this warfare area.  
**Recommended:** This area may improve resilience or flexibility but is not a required classification.  
**Incorrect addition:** You may keep this selection, but unrelated areas dilute planning focus and do not create mission credit by themselves.  
**Blocked removal:** Remove the dependent {platform/aircraft/pack} selections before removing this warfare area.

## 7. Force-design microcopy

### Item status sequence

1. **Affiliation:** Relevant to {warfare areas}.
2. **Compatibility:** Compatible with {host types}; {selected capacity} currently available.
3. **Mission credit:** {credited quantity}/{selected quantity} contributes to this exercise.
4. **Effect:** Improves {readiness/coverage} when hosted and within its invented reach/tracking rules.

### Blocked examples

- **No affiliation:** Select an affiliated warfare area before adding this item.
- **No host:** This aircraft needs a compatible selected aviation host.
- **No capacity:** All compatible host slots are occupied. Remove another embarked item or add host capacity.
- **No mission credit:** This selection is legal but unrelated to the current required/recommended areas, so it adds no credited points.
- **Budget:** This increment would exceed the 100-point mission-credited limit. Remove or substitute another credited item first.

### Readiness

**Gap:** {Requirement} is below the {difficulty} threshold: {current}/{required}.  
**Evidence:** {Credited systems or missing relationship}.  
**Repair:** {One concrete substitution or capacity action}.

## 8. Visualization microcopy

### Disclosure labels

Summaries name what will be learned, not merely “more”: **MISSION BRIEF**, **LAST TURN**, **SCORE COMPONENTS**, **LESSON · READ WHEN READY**, and **READING TRAIL**. A count is included when it helps estimate effort. Closed explanatory regions must not conceal a required action, current state, error, consequence, or repair. Ordinary turn copy reports the outcome and metric changes only; probability math, committed draws, rule traces, and validation language belong in the Field Guide or bundled documentation.

### Command outcome

**Closed label:** LAST TURN · {turn}  
**Visible content:** one contact summary followed by one **CHANGE** line for contact, integrity, supply, objective, and escalation.  
**Do not show here:** matrix names, probability ranges, committed draws, random seeds, replay hashes, validator branches, or full internal notes.

### Player documentation

The Field Guide offers **How the game works**, **Security, privacy & saves**, **Accessibility & controls**, and **Open-source notices**. Link only to material needed to play or understand trust boundaries. Do not expose personas, journey maps, empathy maps, service blueprints, roadmaps, or heuristic working documents as player help.

### View descriptions

- **Stars:** Distant celestial canopy. Weather particles and tactical contacts are omitted; clouds and fog may still interrupt light.
- **Sky:** Atmosphere, aurora when eligible, clouds, celestial bodies, air activity, and distant region-appropriate birds or surface wildlife.
- **Air:** Aircraft, region-appropriate bird movement, and air-domain uncertainty within the same accepted conditions.
- **Surface:** Waves, ice/terrain, vessels, ecologically supported wildlife, surface-domain uncertainty, and above-water weather.
- **Subsurface:** Depth, submarines, vague sea life, any ecologically supported swimming animals, and water-qualified transmitted light. Rain and snow never render here.

### Star disclosure

**Closed label:** SKY LIGHTS  
**Open status:** {count} VISIBLE LIGHTS · {clarity}  
**Supporting line:** Crystalline canopy · foreground weather and contacts stay clear

Keep the live disclosure scannable. Population construction, scale bounds, harmonic-density logic, motion ranges, palette, and occlusion behavior belong in the design and release documentation rather than the transient plot alert.

At Dawn and Dusk, the count may be smaller but must not imply that the canopy is absent: the brightest qualified crystalline lights remain visible. Do not surface internal cohort floors, thresholds, halo bounds, or animation ranges in the alert.

### Wildlife status

**Sighting present:** {count} environmental wildlife forms are visible: {broad groups}. Their presence fits the accepted region, season, time, weather, sea state, visibility, ice edge, and proximity to land. Wildlife is non-tactical scenery—not a contact, identity clue, sensing capability, decision, score, or operational claim.  
**No sighting:** No recognizable wildlife is visible because the accepted ecological and weather conditions do not support a credible sighting. Do not imply that absence changes contact quality or scoring.

### Wildlife greeting

The control label is **Greet a visible animal**, not “select,” “track,” or “inspect.” The live response describes one cheerful observable action and its habitat, for example: **A seal gives a happy flipper wave on the ice**, **A dolphin arcs over the wave with a bright splash**, or **A shark gives a lively tail flick and slips safely below the surface again**. A lying-penguin response may be explicitly comic but still observable: **The resting penguin braces with its flippers, pushes itself upright, confusedly scratches its head with one flipper, then settles happily back down at its waypoint.** Avoid attributing human intent beyond playfulness, avoid tactical vocabulary, and never imply that the reaction reveals identity, location quality, readiness, or scoring information.

### Contact key

**No detection:** The selected force has no mission-credited {domain} detection capability; no unknown markers are shown.  
**Detection present:** {count} abstract unknown {domain} marker(s) are shown. They indicate uncertainty, not identity or opposing composition.

### Celestial disclosure

- **Sun below:** The Sun is below the scenario horizon. Open for direction and time details.
- **Moon below:** The Moon is below the scenario horizon. Open for phase, direction, and illumination details.
- **Moon phase:** Only illuminated phase facets are drawn; the unilluminated side is transparent.
- **Reflection:** Surface glint from the visible {Sun/Moon}; not a body below the water.
- **Transmission:** Exceptional celestial light is refracted through a shallow, weather-qualified surface aperture.

### Weather and aurora

- **Fog:** {classification}; strongest near the horizon and thinner when looking upward or from altitude.
- **Rain:** {presentation}; {particle count} streaks and {curtain count} broad curtain(s), above water only.
- **Clouds:** {regime}; cohesive faceted masses drift, breathe, and change shape within bounded ranges.
- **Aurora absent by Day:** Aurora geometry is not displayed during Day.
- **Aurora present:** {count} expansive tapered spline-curtains, each with five translucent depth veils and a distinct lower-edge hue; luminance is restrained at Dawn, stronger at Dusk, and strongest at Night.

## 9. Command microcopy

### Matrix

**Pending range:** Estimated ultimate range {low}–{high}%. The turn’s result uses a scenario-committed draw that has not yet been disclosed.  
**Resolved:** Committed chance {chance}%; precommitted draw {draw}/100; result {result}. Undoing and repeating identical orders cannot reroll it.

### Orders

Every order note should use: effect + tradeoff + relevant condition.

> Active sweep — Fastest contact gain; increases counter-detection and escalation exposure, especially at short range.

> High-speed dash — Closes distance quickly; increases supply use and vulnerability when the screen or contact picture is weak.

### Turn report

Use facts before interpretation:

> Contact +14; supply −8; escalation +5. Active sweep improved classification while high-speed tempo increased expenditure and exposure.

Concealed opposing effects remain:

> Opposing effects could not be confirmed with the current domain sensing and contact quality.

## 10. Debrief microcopy

### Outcome header

> Final state: objective {current}; integrity {current}; supply {current}; escalation {current}.

Detailed thresholds remain in the closed score-components review and player documentation rather than the outcome header.

### Finding

> **Cause** The force entered command without complete mission readiness.  
> **Turn evidence** {specific credited coverage, report, or state delta}.  
> **One adjustment** {smallest feasible planning or order change}.

Avoid “Mission failed because your strategy was poor.” The model can identify rule-state causes, not the player’s intelligence or character.

### Recovery actions

- **Undo final turn:** Restore the exact state before Turn 6. Repeating the same orders produces the same result.
- **Retry same scenario:** Keep the accepted scenario and its commitments; restart planning and command.
- **Return to planning:** Keep the completed record in history and edit the plan.
- **New scenario:** Replace the current exercise with a newly generated, fully validated scenario.

## 11. Academy microcopy

- **Knowledge check:** Choose the explanation best supported by the lesson.
- **Correct:** Correct. {Causal explanation}; {why the closest alternative fails}.
- **Try again:** Not yet. Revisit {named concept}; the key distinction is {one distinction}.
- **Completion:** Marked complete in this session{or browser slot}. Completion does not provide academic credit or change gameplay score.
- **Notebook:** Optional reflection. It is never scored and follows the current written-analysis save policy.

## 12. System and error messages

| Situation | Recommended microcopy |
| --- | --- |
| Port occupied | Port 5173 is already in use. Stop the earlier local server with Control+C, then run this command again. No process was terminated and no alternate port was chosen. |
| WebGL unavailable | Advanced graphics are unavailable. The complete controls, rules, and a simplified semantic scene remain available. |
| Audio blocked | Select Sound to start ambiance. No rule or warning depends on audio. |
| Browser save unavailable | Browser saving is unavailable. The session remains playable; download a TXT save for a portable copy. |
| Oversized import | This TXT exceeds the 2 MB import limit. Nothing was imported. |
| Unsupported version | This save version is not supported by this build. The current session remains unchanged. |
| Replay mismatch | The command record does not match its committed scenario and order history. Nothing was imported. |
| Reset complete | Browser slots and saved Academy progress were removed from this profile. Downloaded TXT files were not affected. |

## 13. Microcopy review checklist

- Does the string describe the actual implemented rule?
- Is the important fact first?
- Does a blocked state include the smallest repair?
- Are selected, hosted, credited, assessed, concealed, encoded, and encrypted used precisely?
- Does the copy avoid blame, false certainty, and official authority?
- Is the same concept named consistently in UI, accessible description, TXT, Field Guide, and debrief?
- Can the message be understood without color, animation, sound, or surrounding geometry?
- Is a status short enough for restrained live announcement?
- Does destructive copy state scope and what is not affected?
- Is user-entered or imported content omitted unless needed and safely bounded?
