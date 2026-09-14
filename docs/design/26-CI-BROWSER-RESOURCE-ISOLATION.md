# Browser release-gate resource isolation

## Scope and retained failure

The original mobile starfield comparison is corrected by `39896f673d2697e6adffd5d6629e0c22adac777b` without changing the approved application. The subsequent full browser run `34801652624` passed that mobile case and 104 other cases, with the existing 60 viewport-specific skips, but exhausted the unchanged compound-command test's 90-second total budget. An unchanged rerun reproduced the same timeout while selecting `#adversary-next-action-assumption`. Failed jobs `103845366524` (attempt 1) and `103847770728` (attempt 2) remain evidence; no rerun is reclassified as a pass.

The compound-command test and application were identical to the earlier passing release run `34797938234`. Rather than rerunning indefinitely or relaxing its budget, diagnostic run `34803213535` executed this unchanged test twice with a single browser worker and full traces. Both runs passed. Trace spans including setup/cleanup were approximately 61.717 and 62.828 seconds. All original assertions completed, including turn-three history and concealed-opposition safeguards.

Artifact `10332775478`, `compound-command-timeout-diagnosis`, SHA-256 `17ec4603eddf60965b5fb46694df7d959325491c35fad325608427fb4e71c7ab`, preserves both successful traces, `diagnosis/isolated.log`, and a separate successful test-outcome record. This supports runner resource contention as the operational cause; it does not identify a particular CPU versus GPU scheduling mechanism.

## Correction

`playwright.config.ts` now specifies `workers: process.env.CI ? 1 : undefined`. The complete CI suite runs sequentially on each runner, rather than concurrent rendered scenarios competing for its resources. Local worker selection retains the previous default. Playwright recommends one worker in CI for stability and reproducibility: <https://playwright.dev/docs/ci#workers>.

This changes only test-runner resource allocation. The compound-command source, its 90-second timeout, other test deadlines, zero-retry setting, viewport projects, screenshot/trace policy, application code, and required branch checks remain unchanged. No tests are filtered, newly skipped, or removed. CLI worker overrides remain available for explicit investigations. The normal protected browser gate must still pass the entire suite.

## Evidence bindings

- CI-ISOLATION-01 loads the real config in an isolated CI process and asserts one worker, zero retries, `forbidOnly`, and both existing viewport projects.
- CI-ISOLATION-02 loads the same config with CI absent and asserts unchanged local worker defaults and identical coverage.
- Both config tests, focused lint, and TypeScript checking passed locally. Full required CI status is reported separately, not predeclared here.
- All 59 approved application files remain unchanged from `0c7fea1`; the new files are runner tests and this evidence record. `docs/design/25-MOBILE-STARFIELD-GATE.md` remains the authority for the independent field-of-view correction.

The first public-deployment verification attempt expired while waiting for the still-blocked merge. It never reached public asset comparison and is not a deployment failure. Public verification is to be rerun after the protected merge succeeds.
