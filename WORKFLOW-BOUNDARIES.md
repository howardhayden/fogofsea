# Workflow licensing boundary

The repository's default noncommercial software terms apply to the
copyrightable implementation and expression of:

- scenario composition, validation, regeneration, mission framing, and briefing workflows
- warfare-area, objective, platform, aircraft, armament, compatibility, and point-allocation logic
- turn commitment, deterministic adjudication, uncertainty, scoring, undo, and debrief workflows
- Academy sequencing, knowledge checks, strategic comparisons, and field-guide presentation
- environment, weather, celestial, ocean, wildlife, audio, camera, and accessibility engines
- the authored force families, scenarios, thresholds, taxonomies, labels, and test contracts

The boundary is based on **task and product workflows**, not on an attempt to
claim every programming technique inside them. A small or general-purpose
function remains under the license of its containing file unless deliberately
extracted and separately licensed.

## No current permissive carve-outs

`LICENSE-MAP.json` contains an empty `permissive_exceptions` list. Function-level
mixed licensing is hard to audit and easy to misread. A reusable utility must
first become a separate, self-contained module with independent tests and an
explicit SPDX notice.

## Legal boundary

Copyright generally protects source expression, authored text, diagrams,
selection and arrangement, and other original expression; it does not by itself
create exclusive ownership of abstract ideas, methods, systems, facts, or
functionality.
