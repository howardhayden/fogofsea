# Mobile starfield release-gate correction

## Failure and scope

The owner requested resolution of the required mobile-starfield failure, followed by the already-authorized merge and deployment. The approved application is commit `0c7fea10dfdf39e0d14410ce84e1baebf6eaa9bc`, whose 59 application files match the approved dense-starfield download. This correction changes tests and evidence only. It does not add stars, brighten glints, change the camera, alter glow or materials, reintroduce culling, or change branch protection.

Diagnostic run `34801050774` reproduced the unchanged mobile check: 99 pinpoint components against the old absolute >120 requirement. Its baseline step intentionally continued to permit evidence collection; the job's aggregate success is **not** a passing baseline assertion. `diagnosis/baseline.log` preserves the failure. A separate observational pass bypassed assertions only in the diagnostic worktree and collected every stage. Those observations are not release-gate passes either.

Artifact `10331891182`, SHA-256 `fa138da92ebb4fc2a29bd059e990da020e5f70ac26d08746d5916f7d7246960b`, retains the baseline trace, clean canvas images, dimensions, seeds, and metrics. Local browser navigation was blocked by administrator policy before the app loaded; no local-browser reproduction is claimed. The seven mathematical/boundary tests, TypeScript checking and focused lint executed locally.

## Cause

The test compared raw component counts from unequal angular fields. Both cameras use the same 42-degree vertical perspective FOV, but the desktop canvas is 1280 x 648 and the portrait canvas is 320 x 681. The portrait therefore sees substantially less horizontal sky. Both seeded Stars scenes contain 12,595 canonical stars with seed 255880124. The clean screenshot has no unexpected overlay, clipping or framebuffer-size mismatch.

| Capture | Size | Pinpoints | Components | Pinpoint fraction |
| --- | --- | ---: | ---: | ---: |
| Desktop Stars | 1280 x 648 | 305 | 703 | 43.4% |
| Portrait Stars | 320 x 681 | 99 | 213 | 46.5% |
| Desktop Sky | 1280 x 648 | 344 | 708 | 48.6% |
| Portrait Sky | 320 x 681 | 110 | 216 | 50.9% |

The portrait is not deficient in pinpoint density or proportion. Altering the approved renderer to inflate this raw count would treat a test calibration error as a visual defect.

## Correct comparison and explicit supersession

For vertical half-angle v and viewport aspect a, let h = atan(a tan(v)). A rectangular perspective view subtends solid angle Omega = 4 asin(sin(h) sin(v)). The reference desktop field is 0.8730166823783299 steradians; the portrait is 0.2546304004011327 steradians, or 29.166727914918156% of the reference.

Compare N_reference = N_measured * Omega_reference / Omega_measured against the **existing strict >300 desktop minimum** for both viewports. Desktop Stars remains 305. Portrait Stars becomes 339.4278586504166 desktop-field-equivalent pinpoints; portrait Sky similarly exceeds 300. This changes only the unsupported raw >120 compact-camera assumption. It does not reduce the existing reference density or tune the value to 99. An empty portrait or one with 87 pinpoints still fails. The 88-point pass boundary follows the projection formula, not a chosen margin below the observation.

This is a density-normalized composition check on the existing fixed-DPR, fixed-FOV release fixtures, not a claim that component size thresholds are invariant across every device or density field. The pure helper and its FOV-binding test make the reference assumption explicit. Counts remain real screenshot measurements. Brightness, whiteness, color, horizontal coverage, component abundance, far/near facets, largest-field ceilings, motion, fallback, accessibility and all other release assertions remain unchanged. No retries or skips are added.

## Atomic bindings

- MOBILE-GATE-01: Preserve all 59 approved application hashes; the integration workflow checks them before and after verification.
- MOBILE-GATE-02: Compare equal solid angle; an independent 90-degree square-frustum identity and aspect/scale cases test the formula.
- MOBILE-GATE-03: Preserve strict >300 desktop behavior and every other visual assertion; 300 still fails and 301 passes at the reference viewport.
- MOBILE-GATE-04: Reject sparse, empty and invalid fixtures; preserve the original failed run and diagnostic observations without relabeling them.

Owners: `tests/helpers/starfield-density.ts` (geometry), `tests/starfield-density.test.ts` (seven independent/boundary/FOV-binding tests), `tests/browser/starfield.spec.ts` (real screenshot acceptance). Complete browser and release gates must report their own results after this correction. This document does not predeclare their success or a production deployment.
