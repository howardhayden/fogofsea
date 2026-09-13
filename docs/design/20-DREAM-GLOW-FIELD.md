# Source-local dream glow

## Scope and authority

Base: `78fd15225a763f6d535a96da2501b97e685ad6c9`, the September 12 visual-smoothness branch, five commits ahead of the then-current `main`. The September 13 user request adopts the NDCG v0.1 model for all vessels, submarines, aircraft, generic sea creatures and articulated wildlife. Operational models, observation authority, other visual systems and existing scene population limits remain authoritative.

The original mathematical model and all 48 atoms are preserved verbatim in `requirements/reference/`. These are proposed reconstruction parameters, not recovered Night in the Woods shader values. Original evidence/status statements in those files are historical, not claims that this implementation has passed every requirement.

The old renderer used three enlarged icosahedra in a fixed class color. Its tests required aura meshes and its VS-DREAM-001 acceptance prohibited emissive cores. The user's new adoption of NDCG S01/S03/H01/C02 supersedes only that mechanism: native-colored, fixed luminous cores plus shape-derived exterior light replace enlarged shells. The original VS-DREAM-001 wording and its scoped supersession remain in the requirement record. No unrelated quality floor is withdrawn.

## Implementation and ownership

`app/dreamGlowMath.ts` owns normalized nonnegative compact radial kernels: 0.012/0.035/0.075 reference-size sigmas, 0.65/0.30/0.05 weights, gain 0.28, smooth 2.5–3 sigma taper, scalar luminance shoulder and 31/47-second gain-only modulation. Breathing is an adaptation, not measured reference animation; reduced motion gives exactly unit gain modulation.

`app/dreamEmission.ts` registers genuine parts, clones and restores authored materials, applies a fixed native-color core lift and maintains halo gain. Rings, wakes, reaction particles and invisible click targets are excluded, including unnamed `colorWrite:false` geometry. Ancestor visibility and explicit `dreamEmissionAuthorized === false` fail closed. No extra world-space aura geometry or lights are added.

`app/dreamGlowRenderer.ts` renders the normal scene in linear light, captures a full-resolution core-protection mask, captures each subject's actual visible native-color geometry, convolves that field, accumulates light, applies the luminance shoulder and core protection, and performs one display conversion. Source capture and convolution inspect scene depth. Removed kernel mass is never redistributed. Fog attenuates emission toward zero rather than injecting fog color.

A final drawing-buffer-pixel depth guard also runs **after resampling**. It uses the farthest bound of the current registered source geometry. This is conservative: mixed-depth intersections may lose some eligible spill, but a nearer foreground surface cannot receive interpolated light from a blocked contributor. This supplements, rather than replaces, per-contributor source/destination depth checks.

`app/battlefieldScene.ts` registers every catalog vessel and aircraft, both submarine types, all three generic sea-creature variants and articulated penguins, seals, whales, dolphins, sharks, seabirds and shorebirds. Unknown-contact estimates are not emitters. `app/Battlefield.tsx` owns the retained combined update list and pass lifecycle. Existing authorization, view-layer selection, wildlife animation and greetings are preserved.

## Explicit profile and limits

The core and protection mask remain at drawing-buffer resolution. Exterior emission is sampled at 48 pixels per authored reference dimension in reusable 128×128 targets. The discrete radially tapered kernel is evaluated directly; it is not a circular sprite or square-tail blur. Mipmapped minification avoids inserting fixed-size glow beads. Capture scale uses unclipped projected geometry, not viewport-clipped bounds.

This is a bounded-raster approximation to the continuous model. It does not establish the untested full NDCG scale-equivalence matrix, semantic/perceptual reference approval, or representative physical-device performance. The depth guard's conservative trimming is explicit, not claimed as exact optical transport. Current color sources are untextured native-color meshes; unsupported textured/skinned/instanced subjects or missing float-color attachments use a labelled core-only fallback. Near-plane-straddling or oversized captures omit the halo rather than enlarge it. CSS/no-WebGL presentation remains a reduced profile, not a claimed implementation of the full mathematical field.

Daylight remains off; dawn, dusk and night retain bounded daypart strengths and the inherited maximum 1.22 weather lift. Weather attenuation is not cancelled. Existing scene population caps remain unchanged. The historical cap of 42 referred to fleet/aircraft subjects only; creature registration uses the already bounded fauna populations, never a new spawner or silent cosmetic quota.

## Verification and preserved failures

`tests/dream-emission.test.ts` checks profile determinism, gain bounds, normalization, falloff, helpers, visibility, native color and lifecycle. `tests/dream-glow-integration.test.ts` iterates the full catalog and all generic creature variants. `scripts/verify-dream-glow.mjs` exercises real WebGL pixels using actual factories, including all seven wildlife kinds, edge falloff at two pixel densities, narrow output, full/partial foreground occlusion and hidden sources. `tests/browser/environment-visuals.spec.ts` retains the existing rendered-scene and accessibility checks; only superseded shell-specific expectations changed.

The first runtime commit was `71d0c4a5d8eac60aea8094de55b0a3e323af23ae`. Run 34782723311 passed the complete non-browser gate and the existing environment suite (15 pass, 3 skip), but **failed one of 19 new pixel fixtures**: 40 changed pixels at column 253 crossed the aircraft half-occluder boundary after field resampling. Full results are preserved in `evidence/dream-glow/initial-results.json`. That failure caused the final-pixel guard above; the zero-leak acceptance threshold was not weakened. Four additional partial-occlusion fixtures cover double pixel density, narrow output, penguin and submarine geometry.

A workflow step marked successful after `continue-on-error` is not evidence that its command passed: inspect the raw outcome, script exit status and results JSON. Later executed results belong in `evidence/dream-glow/rendered/results.json` and the associated workflow artifact. No native-reference likeness or physical-device pacing approval is inferred from those correctness results.
