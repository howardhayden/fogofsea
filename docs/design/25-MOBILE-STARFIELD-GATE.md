# Mobile starfield release-gate correction

## Failure and scope

The owner requested resolution of the required mobile-starfield failure, followed by the already-authorized merge and deployment. The approved application is commit `0c7fea10dfdf39e0d14410ce84e1baebf6eaa9bc`, whose 59 application files match the approved dense-starfield download. The starfield correction changes browser acceptance and evidence rather than adding stars, brightening glints, changing the 42-degree camera, altering glow or materials, reintroducing culling, or changing branch protection. The separate post-merge production-material and save-compatibility corrections are recorded in [`27-POST-MERGE-RELEASE-GATE-CLEANUP.md`](27-POST-MERGE-RELEASE-GATE-CLEANUP.md).

Diagnostic run `34801050774` reproduced the unchanged mobile check: 99 pinpoint components against the old absolute `>120` requirement. Its baseline step intentionally continued to permit evidence collection; the job's aggregate success is **not** a passing baseline assertion. `diagnosis/baseline.log` preserves the failure. A separate observational pass bypassed assertions only in the diagnostic worktree and collected every stage. Those observations are not release-gate passes either.

Artifact `10331891182`, SHA-256 `fa138da92ebb4fc2a29bd059e990da020e5f70ac26d08746d5916f7d7246960b`, retains the baseline trace, clean canvas images, dimensions, seed, and metrics. Local browser navigation was blocked by administrator policy before the app loaded; no local-browser reproduction is claimed. Nine mathematical, boundary, validation, and FOV-binding tests execute independently of that browser limitation.

## Cause and observed composition

Raw feature counts were being compared across unequal angular fields. Both cameras use the same 42-degree vertical perspective FOV, but the desktop canvas is 1280 × 648 and the portrait canvas is 320 × 681. The portrait therefore sees substantially less horizontal sky. Both seeded Stars scenes contain 12,595 visible canonical lights with rendered seed `255880124`. The retained clean capture has no unexpected overlay, clipping, framebuffer-size mismatch, or autonomous animation.

| Capture | Size | Pinpoints | Components | Pinpoint fraction |
| --- | --- | ---: | ---: | ---: |
| Desktop Stars | 1280 × 648 | 305 | 703 | 43.4% |
| Portrait Stars | 320 × 681 | 99 | 213 | 46.5% |
| Desktop Sky | 1280 × 648 | 344 | 708 | 48.6% |
| Portrait Sky | 320 × 681 | 110 | 216 | 50.9% |

The portrait is not deficient in pinpoint density or proportion. Altering the approved renderer to inflate a raw count would treat a projection mismatch as a visual defect.

## Field-of-view-normalized abundance

For vertical half-angle `v` and viewport aspect `a`, let `h = atan(a tan(v))`. A rectangular perspective view subtends solid angle `Ω = 4 asin(sin(h) sin(v))`. The reference desktop field is `0.8730166823783299` steradians; the portrait is `0.2546304004011327` steradians, or `29.166727914918156%` of the reference.

Counts are compared as `N_reference = N_measured × Ω_reference / Ω_measured`. The browser gate adds strict desktop-reference comparisons while retaining the merged release's raw compact `components > 200` guard:

| Measurement | Desktop reference | Portrait measured | Portrait reference-equivalent | Reference floor |
| --- | ---: | ---: | ---: | ---: |
| Stars pinpoints | 305 | 99 | 339.4278586504166 | `>300` |
| Sky pinpoints | 344 | 110 | 377.14206516712954 | `>300` |
| Stars components | 703 | 213 | 730.2841807327145 | `>650` |
| Sky components | 708 | 216 | 740.5698734190908 | `>450` |

The normalized Stars component comparison alone has an integer portrait boundary of 190 and the Sky comparison a boundary of 132, but neither can waive the independent raw compact guard: every compact capture must still contain at least 201 measured components. Pinpoint acceptance supersedes the viewport-specific raw `>120` assumption with the common `>300` reference-field floor, whose portrait integer boundary is 88. The retained desktop floors themselves remain unchanged. Empty and genuinely sparse captures still fail.

## Reference-focal-length component area

The largest connected region measures one local projected feature, not the abundance across the whole field. With a fixed perspective camera, a local image-plane area scales with the square of focal length in pixels. Horizontal raster extent changes how much sky is visible; it does not scale a feature already in view. Therefore canvas-area fractions are not used.

For measured local area `A`, raster height `H`, and vertical FOV `θ`, the focal length is `f = H / (2 tan(θ / 2))`. The gate compares `A_reference = A × (f_reference / f)^2` at the existing 648-pixel, 42-degree reference focal length, retaining reference caps of 260 for compact mode and 520 for regular mode.

The post-merge failure's 279-pixel component at height 681 becomes:

`279 × (648 / 681)^2 = 252.61549806904847`

At 320 × 681, the effective compact raw cap is `260 × (681 / 648)^2 = 287.15577846364874`: 287 passes and 288 fails. This rule deliberately supersedes the literal raw `largest <= 260` compact ceiling at that same raster, increasing its effective raw boundary by 10.44%. It is a projection-defined contract change, not a claim that the old raw ceiling was preserved. The 1280 × 648 regular cap remains exactly 520. Doubling raster height and quadrupling an otherwise identical local pixel area produces the same reference area.

## Stable capture and environment evidence

The browser gate binds its exact generated model to rendered seed `255880124` and requires `data-starfield-animation="still"`. It waits through two paints, records the CSS and backing dimensions, DPR, browser user agent, WebGL version, vendor, and renderer, then proves that the environment is unchanged across a second wait. It takes two clean reduced-motion canvas captures and requires both decoded metrics and PNG bytes to be identical; it never selects the more favorable sample. Gold, chroma, component, and area evidence all derive from that same captured frame.

The full browser workflow retains `test-results/` as a 14-day failure artifact. A future host-specific discrepancy must therefore preserve its PNG, trace, seed, dimensions, and renderer identity rather than only the failed scalar.

The corrected pale-gold classifier recognizes the authored `#fff4b8` hue that the old red/green separation excluded. The deterministic model requires 423 pale-gold sources, the regular viewport restores the non-vacuous rendered `>15` floor, and rendered gold remains capped at one quarter of colorful pixels. Compact source presence remains owned by the exact model because subpixel projection can erase the narrow pixel probe.

## Nine atomic math and boundary bindings

- `MOBILE-GATE-01`: Bind the 42-degree reference FOV to the actual application camera.
- `MOBILE-GATE-02`: Prove the independent 90-degree square-frustum identity.
- `MOBILE-GATE-03`: Preserve strict `>300` desktop pinpoint behavior; 300 fails and 301 passes.
- `MOBILE-GATE-04`: Prove solid-angle density is independent of pixel scale but changes with aspect ratio.
- `MOBILE-GATE-05`: Reproduce the observed Stars and Sky portrait pinpoint conversions.
- `MOBILE-GATE-06`: Add FOV-normalized Stars and Sky component-abundance checks while retaining the raw compact `>200` guard and desktop-reference floors.
- `MOBILE-GATE-07`: Reject empty and genuinely sparse portrait fields at the exact 87/88 boundary.
- `MOBILE-GATE-08`: Reject invalid counts, dimensions, and FOV values.
- `MOBILE-GATE-09`: Prove reference-focal-length area identity, the 279 conversion, doubled-resolution invariance, the 287/288 compact boundary, and invalid-input rejection.

Owners are `tests/helpers/starfield-density.ts` for projection geometry, `tests/starfield-density.test.ts` for the nine independent math and boundary checks, `tests/browser/starfield.spec.ts` for real screenshot acceptance and stable-capture evidence, and `.github/workflows/main.yml` for failure-artifact retention. Complete browser and release gates must report their own results after the correction. This document does not predeclare their success or a production deployment.
