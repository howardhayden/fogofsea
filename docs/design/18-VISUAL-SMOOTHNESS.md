# 18 — Visual smoothness and authoritative state

Status: reconstruction in evidence-gated slices · 2026-09-12

## Decision

The authoritative state is the product. Visuals are bounded projections of that state. They cannot write adjudication, advance time, discover hidden facts, manufacture contacts, or make accessibility semantics conditional on WebGL.

## Authority contract

| Layer | May know | May produce | Must not do |
| --- | --- | --- | --- |
| Canonical model | committed scenario, difficulty, turn, adjudication | hazard timeline and mechanics | depend on frames, camera, GPU, or animation |
| Disclosure | facts knowable now | canonical estimates and textual status | promote concealed truth |
| Authorized visual adapter | explicitly granted partitions | immutable compact render facts | inspect denied partitions or raw game objects |
| Renderer | render facts and presentation settings | pixels, camera telemetry, readiness markers | mutate rules, state, time, or disclosure |
| Instrumentation | local timing and resource samples | evidence records | become adjudication input or telemetry |

## Budgets

| Profile | Target | Frame-interval p95 | Reduced motion |
| --- | ---: | ---: | --- |
| Strong reference | 30 fps | ≤ 41.7 ms | event-driven |
| Weak reference | 24 fps | ≤ 55 ms | event-driven |
| Reduced motion | — | no continuous sampling claim | zero autonomous renders after settle |

Average FPS alone is not acceptance evidence. Capture interval distributions, p50/p95/p99, longest hitch, clustered hitches, interaction-to-render submission, cold startup, scenario-ready time, heap/DOM/GPU indicators, and pressure. Physical mobile thermal and battery observations must identify device, OS, ambient conditions, duration, and throttling evidence; emulation is not a substitute.

## Visual-system inventory

| System | Demonstrated baseline | Required state | Hostile combinations / red-team focus |
| --- | --- | --- | --- |
| Sea | deterministic displaced plane and foam | tiered geometry with semantic sea-state continuity | storm + zoom + glass + weak GPU |
| Weather | fog, precipitation, storm light | bounded atmospheric layers with nonvisual equivalent | rain/snow incoherence, flash, no WebGL |
| Clouds | generated masses | depth-legible, capped, weather coherent | overcast + moon/stars/aurora |
| Stars | deterministic plan | capped visible population independent of hidden force | traffic count as quality oracle |
| Moon | astronomical phase/position | phase and horizon semantics survive fallback | dark theme + overcast + subsurface |
| Aurora | climate/latitude/time gated | complementary noncolor description | day, storm, reduced motion |
| Wakes | vessel-centric geometry | medium-specific vessel/exhaust/rotor/submarine/creature disturbances | rough seas, loss of authorization |
| Severe weather | matrix disruption plus canonical hazard | model-owned active window and mechanics | visuals disagree with state |
| TSUNAMI | absent in baseline | explicit committed hazard and signed N-wave; never inferred | sea state looks extreme without event |
| Camera | orbit, keyboard, five views | stable saved pose and truthful telemetry | rapid rotate/zoom/resize/context loss |
| Overlays | glass panels and modals | renderer pauses behind occlusion | compositor load, privacy gate |
| Dream light | whole-structure emission baseline | one sparse causal source, bounded tight/broad propagation, hard non-emissive structure | accessors, geometry bombs, revoke/regrant |
| Contacts | capability-seeded population baseline | canonical disclosed estimates filtered by capability | perfect sensing with no observations |

## Slice and evidence rules

1. Freeze a baseline before asset changes.
2. Red-team each atomic requirement before implementation.
3. Land model authority, disclosure, adapter, renderer, and instrumentation separately.
4. Run focused tests after each slice, then the complete release check.
5. Record launch blockers as blockers, with zero product assertions—not passes.
6. Preserve failures and corrections in the red-team ledger.

The machine-readable source is [`requirements/visual-smoothness.json`](../../requirements/visual-smoothness.json). The baseline is [`evidence/visual-performance/baseline-0f0565b.json`](../../evidence/visual-performance/baseline-0f0565b.json).

## Blender qualification

Blender is not qualified for this reconstruction. No mesh cleanup, animation preparation, baking, or offline asset optimization need has yet been demonstrated. It is therefore neither a runtime nor architectural dependency.
