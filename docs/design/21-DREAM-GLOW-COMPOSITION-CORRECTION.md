# NDCG composition correction and preserved evidence

This addendum extends `20-DREAM-GLOW-NDCG.md`; its earlier verification checkpoint remains historical. No original atomic requirement is weakened.

## Actual failure and baseline comparison

On implementation `88de32723c171967c6b2d792ecacc185388a5d74`, run `34781978030`, release job `103790530025` passed all non-browser gates and 319 tests. Browser job `103790530156` passed the new four-family fixtures in both desktop and mobile projects, including both DPR values, native hue, core protection, near/far light, authorization and full-occluder tests. The existing native scene glow tests also passed before cancellation.

The wider browser run was cancelled after the documentation-only follow-up superseded it; before cancellation it recorded two starfield composition failures. Desktop Sky had an oversized connected light region (52,084 against a limit of 8,465.184). Mobile Stars reported 99 pinpoints against a strict floor above 120. These failures are preserved rather than concealed by changing thresholds.

The mobile failure is confirmed on the unmodified parent `78fd15225a763f6d535a96da2501b97e685ad6c9`: run `34676475697`, browser job `103507122938`, failed at the same assertion with the same 99 versus 120 result. That run had 103 browser passes and 60 skips. Its desktop composition test passed. Thus the desktop failure requires correction here; the separate existing mobile failure is not represented as fixed by this change.

## Correction

The initial compositor treated the complete offscreen base image as uniformly linear. That assumption is not valid for every existing custom scene shader and can re-encode unrelated background/atmospheric output when a creature enables the glow pass. NDCG-C06 forbids this global visual change.

The corrected renderer preserves the actual original display framebuffer using Three r179 `FramebufferTexture` and `copyFramebufferToTexture`. Its initial offscreen scene pass supplies depth only. After source filtering, the unchanged scene is rendered with its original display pipeline. Its displayed RGB is copied as untagged encoded data. Where exterior glow is zero, the compositor returns those exact stored bytes; where it is positive, it decodes displayed RGB to linear light, adds the bounded exterior field, and encodes the result once. Opaque cores follow the exact-copy path. No-source frames return the directly rendered scene without a composite.

This is a display-referred linear-light decoration of an authoritative existing image. It does not invert scene tone mapping or claim radiometric world-light simulation. Only the current default sRGB output framebuffer is qualified; other output targets/color spaces use the named core-only capability profile. Resource ownership includes disposing the captured display texture on resize and teardown.

This correction requires an additional scene render and an RGBA8 display-copy texture. The tradeoff deliberately preserves existing scene correctness without rewriting unrelated shaders. Device frame-time and memory performance remain unqualified; the allocation caps are not a substitute for measurement.

## Independent regression test

The GPU fixture now contains a separate legacy custom-shader patch outside the maximum glow support. Its shader intentionally lacks color-space conversion. The complete rendered path must leave this patch byte-identical (`outsideDifference === 0`) at both pixel densities for all four profiles. Existing core, falloff, color and occlusion assertions are retained. This exercises the failure mechanism independently of the existing starfield composition threshold.

A focused, read-only CI workflow runs dependency-aware typechecking, the mathematical/source tests, all four-family GPU fixtures, the existing desktop Sky composition test and the existing native-scene glow tests. Positive and negative PNG/JSON evidence is uploaded. Written tests and the source-level correction are not reported as passing until the corresponding execution is observed. Full visual reference approval and device performance approval remain separate.
