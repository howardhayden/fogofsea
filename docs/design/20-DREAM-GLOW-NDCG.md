# Shape-derived dream glow — NDCG application

## Authority and scope

Implementation base: `78fd15225a763f6d535a96da2501b97e685ad6c9`, the head of `codex/visual-smoothness-reconstruction-2026-09-12` when inspected. Initial implementation commit: `88de32723c171967c6b2d792ecacc185388a5d74`. Main, deployment configuration, contact authorization, ecology, and the existing scene geometry were not rewritten.

This applies the user's NDCG v0.1 proposal to already-authorized vessels (including submarines), aircraft, articulated wildlife, and vague/schooling underwater creatures. Unknown-contact glyphs remain observations; the renderer does not infer or reveal an undisclosed hull. Daylight remains off.

The source proposal is not a recovered Night in the Woods shader and its parameters were not pixel-fitted. The accompanying implementation bundle preserves both originals:

- `nitw_character_glow_model_v0_1.md`: SHA-256 `63f8f4a79a84b9a5176fa097097fa45fae7987c08318014f3b4a325045325d9d`.
- `nitw_character_glow_atoms_v0_1.json`: SHA-256 `0ed5c5a09e45832c59ffa5a170dca26c624c07028acdd61eaadcc7713f0c884d`.

## Implementation ownership

| Owner | Responsibility |
| --- | --- |
| `app/dreamGlowMath.ts` | Finite radial kernel, normalized quadrature, reference scale, bounded temporal function, scalar luminance shoulder, independent edge oracle. |
| `app/dreamEmission.ts` | Source registration, native material regions, exclusions, authorization, fixed authored bounds, material ownership and cleanup. |
| `app/dreamGlowRenderer.ts` | Linear source capture, depth gates, padded crop, three spatial scales, crisp-core protection, display conversion, resource limits. |
| `app/Battlefield.tsx` | Binding all current entity families, renderer lifecycle, reduced motion, actual-profile telemetry and nonvisual descriptions. |
| `tests/dream-glow-math.test.ts` | Nine independent numerical tests; local executed evidence. |
| `tests/dream-emission.test.ts` | Material, geometry, registration, exclusions, visibility, temporal and cleanup contracts. |
| `tests/browser/dream-glow.spec.ts` | Four profile colors at DPR 1 and 1.8; actual framebuffer near/far light, core preservation, hue and source/foreground blocking. These are canonical plane fixtures, not visual approval of every production model. |
| `tests/browser/environment-visuals.spec.ts` | Actual scene integration; existing pixel thresholds retained. Legacy shell-specific assertions replaced. |

## Applied model

`E` is premultiplied, visible native-color emission. For each subject, evaluate a positive, centered radial kernel at sigma ratios `[0.012, 0.035, 0.075]`, with weights `[0.65, 0.30, 0.05]` and gain `0.28`. The Gaussian tap weight is smoothly tapered from 2.5 to 3 sigma. The 109-tap radial quadrature is normalized before visibility rejection. It is a sampled implementation requiring GPU qualification, not a claim of exact continuous convolution.

The reference height is adapted to a fixed authored bounding-sphere diameter projected into physical screen pixels. This prevents articulated poses or viewport clipping from pumping the glow radius. Actual posed bounds determine only the padded capture rectangle. Radii are not inflated to a minimum bead size.

Emission is depth-tested against the main scene before filtering. Each filtered contribution is also depth-tested at its destination, without renormalizing surviving light. Fog attenuates emission toward black, rather than supplying fog color as an emitter. The shared composition preserves opaque core pixels and adds light outside their coverage and applies a scalar shoulder above linear luminance 0.22, asymptotically bounded by 0.35. Native colors are not replaced by a uniform cyan palette.

The optional temporal profile is gain-only: `1 + 0.02 sin(2πt/31 + φ) + 0.01 sin(2πt/47 + ψ)`. Stable phases are subject-specific. Core alpha, geometry and radius do not breathe. Reduced motion evaluates to exactly one.

## Explicit replacements and precedence

1. The rejected three enlarged icosahedron shells are superseded by the source-derived field. No aura geometry or new point lights are created.
2. The former fog/precipitation emission boost is neutralized. Extinction must not be counteracted by increasing emitted light.
3. Former core/radius modulation is superseded by the shallow gain-only temporal model. Daylight exclusion is retained.
4. The CSS elliptical stand-ins are removed. The no-WebGL fallback is explicitly a readable core-only reduced profile, not full glow conformance.
5. Source registration includes both creature arrays in addition to ships and aircraft. The former 42-subject assumption cannot silently exclude wildlife.
6. Previous requirements and failed implementations remain in Git history. These replacements affect this effect only; unrelated standards and scene behavior continue to apply.

## Adversarial corrections preserved

- Original failure: light was modeled by enlarged generic solids rather than the filled native shape. Correction: isolate native source geometry and convolve its visible coverage.
- Three r179 API review: `renderer.setViewport` and `setScissor` multiply by device pixel ratio even for offscreen targets. Correction: configure target viewport/scissor in physical pixels; restore the renderer's saved logical viewport only on exit.
- Three r179 state review: a bare depth clear after a `depthWrite=false` pass need not reset its write mask. Correction: source capture uses automatic clearing, which resets the mask before rendering.
- API review caught a non-existent Color helper before runtime testing; replaced with supported color addition and scalar multiplication.
- Boundary review caught overflow from huge finite time/projection values. Correction: reduce temporal arguments before multiplication and reject nonfinite projected results.
- Empty geometry registration restores and disposes temporary material clones rather than leaving an unowned mutation.

These are source-review findings unless an execution record says otherwise. They are not fabricated runtime failures.

## Verification and limits

Local evidence: nine numerical tests passed under Node 22.16.0 after TypeScript 5.8.3 transpilation. All nine modified/new TypeScript files passed transpilation syntax checks. GitHub run `34781978030`, release job `103790530025`, passed the dependency-aware non-browser release gate for implementation commit `88de32723c171967c6b2d792ecacc185388a5d74`: lint, TypeScript checking, requirement validation, 319 tests (30 + 223 + 66), build, dependency audit, and artifact validation. The browser job `103790530156` had not finished at this evidence checkpoint. Written GPU fixtures are not recorded as passed. An additional local production-build inspection was blocked by the browser environment before navigation; it provides no visual evidence.

Native-size reference approval, actual-model visual review, cross-device frame-time/memory budgets, and exhaustive partial-occluder/transparent-medium fixtures remain qualification obligations. In particular, transparent fog banks do not have a dedicated per-ray transmission buffer; the implementation uses scene depth plus existing distance fog. Unsupported skinned, morphed, instanced or multi-material source paths need explicit future qualification, rather than being certified by these current generated-mesh fixtures.

Core-only capability/budget profiles are named in `data-dream-glow-profile`; the number of submitted subjects is `data-dream-glow-sources`. Source-target size is bounded at 2048, and full-buffer allocation at 8,388,608 pixels. A near-plane intersection or oversized source can degrade that subject to core-only. These are safety limits, not measured performance certification.

### Commands

```sh
npm ci
npm run typecheck
npx tsx --test tests/dream-glow-math.test.ts tests/dream-emission.test.ts
npx playwright test tests/browser/dream-glow.spec.ts tests/browser/environment-visuals.spec.ts
npm run release:check
```

No merge or production deployment is implied by implementation or by numerical test success.

## Atom-to-implementation bindings

The original 48-atom register remains authoritative for acceptance criteria, dependencies, and negative/boundary cases. This table maps obligations without replacing that register or asserting that every obligation has been verified. Abbreviations below are file owners: **M** = `dreamGlowMath.ts`; **S** = `dreamEmission.ts`; **R** = `dreamGlowRenderer.ts`; **B** = `Battlefield.tsx`. Test abbreviations: **math**, **source**, **GPU**, and **scene** refer to the corresponding test files in the ownership table. At this checkpoint, mathematical and source tests executed in the release gate; GPU and scene execution remained pending. Reference approval and device performance remain open regardless of future automated success.

| Atom | Implementation or authority | Evidence boundary |
| --- | --- | --- |
| E01 | Source proposal and this document distinguish observation/proposal | Manual provenance; no recovered-shader claim |
| E02 | Numerical profile remains provisional | Native-size reference approval open |
| E03 | S exclusions; R registered sources only | Source tests; GPU review pending |
| E04 | Explicit replacements above; parent commit retained | Git ancestry; no unrelated supersession |
| S01 | S reuses original geometry | Source geometry/scale assertions |
| S02 | S static native-color core; R optional exterior field | Source tests; GPU core comparison pending |
| S03 | S native material regions; R RGB capture | Source tests; final hue fixture pending |
| S04 | R source RGB multiplied by alpha before blur | Shader code; GPU fixture pending |
| S05 | S explicit registration; no framebuffer bright-pass | Source tests and R input ownership |
| S06 | S/R filled source independent of Fresnel | Source tests and shader review |
| H01 | R convolves captured filled geometry | GPU/production-shape review pending |
| H02 | M centered radial offsets | Math symmetry assertions |
| H03 | M positive tap weights | Math assertions |
| H04 | M unit mass before R visibility | Math assertions; shader review |
| H05 | M three ordered sigma ratios | Math assertions |
| H06 | M normalized mixture | Math assertions |
| H07 | M smooth finite taper | Math boundary tests |
| H08 | M/R gain separate from reference radius | Math and source tests |
| C01 | R linear render targets and native RGB | Shader review; GPU pending |
| C02 | R maximum core coverage protects base | GPU core comparison pending |
| C03 | S excludes rings/wakes/reactions | Source exclusion tests |
| C04 | R final tone-map/encoding only | Shader review; GPU pending |
| C05 | M/R scalar shoulder | Math continuity/bound tests |
| C06 | M finite support; R padded/scissored contributions | Math support verified; full display identity open |
| R01 | S fixed authored sphere; M projected reference | Source and math tests |
| R02 | R physical target viewport/scissor | API review; two-DPR GPU fixtures pending |
| R03 | R crop padded by full support plus sample margin | Code review; clipped-edge fixture open |
| R04 | M/R no minimum radius inflation | Math tiny-source case; GPU subpixel qualification open |
| V01 | B authorized scene arrays; S ancestor gate | Source tests; GPU forbidden-source fixture pending |
| V02 | R source depth comparison | GPU full-occlusion fixture pending |
| V03 | R per-contribution destination depth comparison | Partial-foreground boundary fixtures open |
| V04 | R never renormalizes after rejection | Shader review; partial-occlusion GPU fixture open |
| T01 | Original reference static; named adaptation enables breathing | Explicit profile distinction; reference timing unmeasured |
| T02 | M gain-only 31/47-second function | Math amplitude/derivative tests |
| T03 | M elapsed time; S stable subject phases | Math/source tests |
| T04 | B/S/M reduced-motion gain exactly one | Math/source tests; scene execution pending |
| Q01 | M independent edge oracle; GPU exterior fixture | Math passes; actual GPU pending |
| Q02 | M independent far-tail oracle; GPU 8-bit allowance documented | Math passes; actual GPU pending |
| Q03 | M two-source gap oracle | Math passes; two-source GPU scene open |
| Q04 | GPU normalized RGB fixture | Pending; model texture/palette visual approval open |
| Q05 | GPU fixtures at DPR 1 and 1.8 | Pending; full required scale-equivalence qualification open |
| Q06 | Native-size visual comparison obligation retained | OPEN; no reference-match certification |
| Q07 | B readable core-only fallback and textual descriptions | Source review; full accessibility qualification open |
| Q08 | M/S bounded finite inputs | Math/source boundary tests; unsupported source paths named |
| I01 | S native colors separate from reference palette | Source tests; GPU color pipeline pending |
| I02 | S no new lights or reflection emitters | Source no-light assertions |
| I03 | M continuous oracle independent of sampled GPU operator | Math executed; GPU output qualification pending |
| I04 | R actual-profile status; B explicit reduced fallback | Source review; capability/budget browser qualification open |
