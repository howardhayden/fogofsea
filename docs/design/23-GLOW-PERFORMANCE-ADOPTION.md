# Approved-scene performance update — adoption record

User request: reduce the extra freezing in the scene-restored build, preserving the newly approved lighting, reflectivity, glow and all time-of-day views.

## Adopted source

Use the exact application produced by verification revision `489d97dcd67a5c78612167c97dc6d874d5c84d52`, run `34790407066`, job `103813434391`, artifact `10327716778`. The artifact SHA-256 is `7fa80e5600f2d7fe56dc181c1a45797c2c831fe67fc2389c477df1441676cdaa`.

This branch preserves a reproducible verification recipe: apply the scene-repair patch, the first performance patch, and the batched-source patch. Its unpatched application files alone are not the delivered runtime. The final VSCodium package has these changes already integrated and its application hashes matched all 59 executed source files. Only `app/Battlefield.tsx` and `app/dreamGlowRenderer.ts` differ from the user-approved scene-restored source; the other 57 application files are unchanged.

The adopted renderer retains compiled full-screen materials and buffers across scene changes, uses the existing phase-preserving 30 Hz deadline, skips provably noncontributing core/scale work, and batches right-sized source targets within the former maximum source-pixel ceiling. It does not reduce resolution, source count, kernel quality, glow intensity, reflectivity, weather or wildlife.

## Observed verification

All 16 complete-frame comparisons—four times of day by Air side/overhead, Surface and Subsurface—had zero changed pixels, zero WebGL errors, identical submitted source counts, and one retained pipeline on the active canvas. Typechecking, 33 scoped unit tests and production build passed; local lint passed.

Two approximately five-second live-motion windows per implementation, on macOS WebKit and the same Night/Air scene, measured:

| Measure | Approved renderer | Adopted candidate |
| --- | ---: | ---: |
| Render calls per second | 11.45 | 12.70 |
| Median interval | 85 ms | 77 ms |
| 95th-percentile interval | 110 ms | 94 ms |
| Gaps of at least 100 ms | 14 | 3 |

These are short instrumented render-call samples, not a guaranteed frame rate or presentation-time measurement. Both variants used the same corrected application scheduler. The test runner remained below the 30 FPS target. A first-draw-to-next-callback outlier of 1166 ms remained in the separate static comparison. No claim that all freezes are eliminated is justified.

## Rejected follow-up

Do **not** apply `tests/fixtures/glow-performance-sampling.patch` to the adopted candidate. The tighter per-sample bounds experiment in revision `263aa0140c4cff148285c13555f2630b227b55e7`, run `34790718727`, passed all pixel checks but regressed live throughput in its comparison: 12.63 to 12.12 calls per second, with p95 worsening from 97 to 106 ms. It is retained only as experimental evidence and is not included in the delivered runtime.

The workflow below now runs the adopted recipe rather than the rejected follow-up. Documentation-only adoption commits do not repeat the expensive browser workload.

## Delivery

The complete package is `FOG-OF-SEA-vscodium-smoother-rendering.zip`. Its report includes original profiling, the corrected test-scope failure, both successful visual matrices, the rejected optimization's timing evidence, actual source hashes, and remaining limitations. Main was not merged or deployed.
