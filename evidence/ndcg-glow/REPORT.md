# NDCG entity glow — implementation and verification

**Implemented on `codex/ndcg-entity-glow-2026-09-13`. Not merged or deployed.**

Original renderer baseline: `78fd15225a763f6d535a96da2501b97e685ad6c9`.
Preserved unqualified checkpoint: `373cd8bcfbbf813a6fa4a264159a81a1d5b87c7e`.
Tested implementation: `7a3f1bc3a3ae07e9deec5e8f7355b31da0a46f66`.

Final successful qualification: https://github.com/howardhayden/fogofsea/actions/runs/34784071814
Raw screenshots/readbacks: https://github.com/howardhayden/fogofsea/actions/runs/34784071814/artifacts/10325454276
Artifacts expire after seven days; the conversation delivery bundle preserves the original model, all 48 atoms, implementation crosswalk, failed/corrected tests, complete logs, screenshots and hashes.

## Baseline red-test

The original four tests passed because they approved the wrong glow mechanism. Nine new baseline contract tests produced **seven failures and two passes**. The original implementation used enlarged colored ellipsoids rather than source-derived light, lacked a fixed luminous core and regional source-color registration, changed radius during breathing, omitted generic animal enrollment and lacked required malformed-input rejection. Baseline assertion source and output are preserved in the delivery evidence, not retrospectively fabricated from the new tests.

## Replacement

The shared renderer now enrolls ships, submarines, aircraft, wildlife and sea creatures from already-authorized scene groups. `dreamEmission.ts` registers actual native-colored mesh regions; `dreamGlowMath.ts` specifies the compact normalized operator; `dreamGlowRenderer.ts` performs visible-source capture, positive multi-scale spread, depth rejection and protected-core composition. `battlefieldScene.ts` and `Battlefield.tsx` connect every displayed family and its lifecycle. The enlarged CSS aura is removed; reduced rendering is explicitly core-only.

Reference parameters remain sigma ratios 0.012/0.035/0.075, weights 0.65/0.30/0.05, night gain 0.28 and smooth finite support at three sigma. Native FOG OF SEA colors are retained. There are no surrogate aura meshes, forced cyan palette, conventional lights or scene-wide bright-pass bloom. Breathing changes only halo gain with stable 31/47-second phases; reduced motion sets gain modulation to exactly one.

The GPU uses 128 deterministic positive radial samples per scale, a reused 256-pixel source target and explicit size/capability/near-plane/subject reductions. This is a numerical approximation, not the exact continuous integral. It creates no new tactical observations. Source visibility, explicit revocation and nearer opaque occluders suppress contributions before or during filtering, without post-occlusion renormalization. Wakes, selection rings, reaction particles and invisible click targets cannot emit or inflate reference bounds.

## Corrections preserved

The unqualified checkpoint initially conflicted with the base-relative patch. Application stopped safely; only its five unqualified glow-owned paths were reconciled. Its commit, source-denial guard and reaction exclusions remain preserved.

Actual wildlife construction tests found invisible hit targets inflating reference size; these were excluded. Tests cover seven wildlife anatomies and require both actual submarine instances, avoiding empty-array passes.

A stricter GPU run at `825e06b89a960015aa87ba226e166fe5bfc334b3` passed 22 tests and failed one: revoked sources emitted no halo, but an unnecessary half-float pass rounded the still-visible core. The renderer now bypasses that pass when no sources remain admitted. The test first renders an authorized frame, revokes it and checks the next frame. Final total absolute pixel difference is **exactly zero**; no tolerance was relaxed. Failed run: https://github.com/howardhayden/fogofsea/actions/runs/34783778860

## Executed final gates

| Gate | Result |
| --- | --- |
| TypeScript / ESLint | Pass |
| Focused math, source, anatomy and contract tests | 30/30 pass |
| Separately executed full red-team suite | 77/77 pass |
| Production build | Pass |
| Actual WebGL pixel tests | 23/23 pass |
| Application glow integration | 2/2 pass |
| General npm test | Existing astronomy import failures remain |

Focused and red-team counts overlap; they are not added into an inflated unique-test total. Tests ran with Node 22.16.0 and Playwright 1.62.1, official Chromium/SwiftShader on GitHub Ubuntu. This is real shader execution, not native physical-GPU performance qualification.

The general unit invocation had 177 passes and two file-load failures caused by the `astronomy-engine` named export `Body`, in `celestial-visibility.test.ts` and `save-game.test.ts`. The import failure was reproduced on the untouched baseline; no unrelated astronomy code was changed. The chained red-team step therefore ran separately. The project-wide suite is not claimed green.

## Measured output

| Fixture quantity | Measured | Gate |
| --- | ---: | ---: |
| Exterior residual/source at 0.01171875h | 0.0702677248 | 0.05–0.10 |
| Two-source gap midpoint/source | 0.0198364258 | <=0.025 |
| Worst normalized curve deviation across nine size/DPR fixtures | 0.0026214709 | <=0.007 |
| Worst sampled far residual/source at or beyond 0.1h | 0.0012028226 | <=0.002 |
| Revoked next-frame absolute difference | 0 | <0.0001 |

Size fixtures cover 32/64/128 CSS pixels at DPR 1/2/3; curve agreement covers 0.015h–0.20h. Far and zero-support samples have separate assertions. Core differences stay below the declared 0.001 floating-point tolerance, not a false bit-exact claim through half-float targets. The revoked no-op case is exact because it bypasses those targets.

Actual application and fixture PNGs were inspected. The vessel retains a crisp native-colored body and tight subdued exterior glow rather than a spherical aura. Application difference metrics include the core and do not substitute for independent halo-only pixel fixtures.

## Remaining qualifications

Native-size reference calibration/author approval, physical-device pacing, exhaustive subpixel/alpha-texture/complex-transparency/hostile-weather/context-recovery matrices and complete assistive-technology regression remain open. These limits are explicit in the 48-atom delivery crosswalk. Source-game shader values and timing were not recovered. The original state-authority, non-color accessibility and physical performance floors are not superseded.

The final cleanup removes temporary write-enabled transport workflows and retains read-only regression testing. Documentation-only changes do not alter the tested implementation.
