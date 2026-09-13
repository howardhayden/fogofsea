# 19 — Native source-derived dream glow

Status: implemented and fixture-tested; not merged/deployed and not author-approved as an exact reference match. See `evidence/ndcg-glow/REPORT.md` and `requirements/ndcg-glow/activation.json`.

## Authority and supersession

This additive activation supersedes only incompatible `VS-DREAM-001` glow details in the historical visual-smoothness register/design 18: enlarged halo geometry, non-emissive core, radius breathing and the 42-subject/126-halo budget. It does not weaken state authority, contact disclosure, wake semantics, accessibility, physical-device performance or other compatible requirements. Historical requirements and failed evidence remain preserved. The original model, 48 atoms and detailed ownership/dependency/test/evidence crosswalk are included in the delivery bundle at the paths listed in the activation register; they are not silently rewritten as a claim of universal conformance.

## Integration

`battlefieldScene.ts` passes already-authorized ships, submarines, aircraft, wildlife and sea creatures to a shared registry. `dreamEmission.ts` retains actual native-colored mesh regions. `dreamGlowMath.ts` owns the normalized compact kernel and independent radial edge integral. `dreamGlowRenderer.ts` owns capture, spread, occlusion and composition. `Battlefield.tsx` handles all-family updates, reuse, diagnostics and disposal. CSS fallback is explicitly core-only rather than an enlarged false aura.

Real scene-construction tests include both actual submarine instances and seven wildlife anatomies. The five rendering-family tests separately execute the common shader path. They do not pretend that every possible composition has been inspected.

## Operator

For each region: `E = coverage * native linear RGB * regional emission gain`.
The crisp scene is independent of the outward field.

- Sigma/reference ratios: `[0.012, 0.035, 0.075]`.
- Positive mixture weights: `[0.65, 0.30, 0.05]`.
- Night halo gain: `0.28`.
- Kernel: Gaussian multiplied by a smooth radial taper from 2.5 to 3 sigma, normalized before visibility rejection.
- Composite: `crisp + (1 - coreCoverage) * limitedGlow`.
- Scalar luminance shoulder: knee `0.30`, asymptotic ceiling `0.50`.

The runtime evaluates 128 positive deterministic radial samples per scale, using a reused 256×256 source target. This is a numerical approximation. Nine size/DPR fixtures compare it against an independent radial integral, with separate positive exterior-light, far-tail, finite-support and gap gates. It is not a disk, Fresnel-only outline, randomized cloud, source-game shader extraction or scene-wide bright-pass bloom.

Authored source geometry supplies a stable major-axis reference in the three-dimensional adaptation. Reference size excludes clipped viewport bounds, wakes, reaction particles, tactical rings and invisible hit volumes. Projection uses physical pixels and applies DPR once. A full-scene guard band retains authorized offscreen edge light. Articulated original mesh transforms propagate to capture without enlarging the original form.

Source RGB is premultiplied before filtering. Native material maps, alpha coverage and vertex colors remain source inputs. Fog removes radiance rather than counter-brightening hidden objects. The convolution rejects contributions on nearer opaque destinations without renormalizing them into brighter surviving light. The final scene display transform is applied once. No conventional point lights or implicit reflections are added.

## Time and visibility

Core emission and geometry remain fixed. Optional halo-gain modulation is `1 + .02 sin(2πt/31+φ) + .01 sin(2πt/47+ψ)` with stable per-object phases and elapsed time. Reduced motion sets modulation to exactly one. These are proposed adaptation settings, not measured source-game timing.

Admission is downstream of the authorized view plan. Hidden ancestors and `dreamEmissionAuthorized === false` revoke the emission field. With no remaining admitted sources, the pass bypasses its targets entirely, avoiding both stale glow and no-op half-float rounding. Model visibility itself remains the existing scene adapter's responsibility. Glow adds no knowledge, exact contact position or sensor activity.

## Reductions and boundaries

The candidate requires floating-point color targets. Source reference is limited to 512 physical pixels; targets must fit device limits; at most 128 subjects are processed per frame. Unsupported capability, near-plane intersection, excessive size and budget overflow are explicitly core-only reductions. They are not full NDCG equivalence. No fixed-size luminous bead replaces a subpixel source. Current builders use ordinary articulated meshes; future skinned/instanced assets require qualified support, not a silent success claim.

Software-rendered Chromium verifies actual shaders and integration, not native GPU pacing, thermals or battery behavior. Physical frame-pacing budgets remain open and unchanged. Native-size reference calibration/author approval and exhaustive alpha-texture, complex-transparency, hostile-weather, context-recovery and assistive-technology matrices remain open. Existing non-color information and reduced-motion behavior are retained.

## Reproduction

```sh
npm ci --ignore-scripts
npm run typecheck
npm run lint
node --import tsx --test tests/dream-emission.test.ts tests/dream-glow-math.test.ts tests/dream-glow-scene.test.ts tests/red-team/ndcg-glow-contract.test.ts
npm run test:red-team
npm run build
npx playwright install chromium
npx playwright test tests/browser/ndcg-glow-pixels.spec.ts --project=desktop-chromium --workers=1
npx playwright test tests/browser/environment-visuals.spec.ts --project=desktop-chromium --workers=1 --grep 'subjects breathe|night dream emission'
```

The general `npm test` has separately reproduced baseline astronomy-engine import failures; it is not relabeled as passing. The read-only `ndcg-glow.yml` workflow reruns the scoped gates and retains numeric readbacks and PNGs as artifacts.
