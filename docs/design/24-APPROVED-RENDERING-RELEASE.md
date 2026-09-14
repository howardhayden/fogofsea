# User-approved glow and dense-starfield release

## Exact adopted state

The owner approved `FOG-OF-SEA-vscodium-dense-starfield.zip` and explicitly requested push, commit, merge and deployment. Its archive SHA-256 is `7a4962084de14fc2bf2fc032c7168a6cf988efd1460356476112101c18dc4dd0`.

The release copies all 59 application files, without editing them, from `tested-css-only-source.zip` in GitHub Actions run `34794716567`, artifact `10328799946`, verification revision `c981b6094d69e5415ab0756fce68957a6aff3ccf`. The sorted `path + NUL + SHA256 + newline` manifest has SHA-256 `e5a0ea1b216ab10ada3cb875e2cdd97eb73d88f1f06006edbee78e349c0a03a4`. Source and lockfile/hosting configuration checks prevent an experimental branch or an older artifact from being substituted.

The original glow branch through `bd84e20` remains in ancestry. This release adds the subsequently approved RGBA scene preservation, retained and batched glow rendering, phase-preserving scheduling, and the CSS-only pause of invisible fallback stars. Source manifests and raw dense-starfield evidence are committed in `evidence/releases/approved-rendering/`.

No star culling, rejected tighter sampling experiment, fewer visible stars, reduced resolution, weaker reflectivity, or product reconstruction is included. Existing release checks and Cloudflare configuration are unchanged.

## Requested attribution

The new glow effect was indirectly recommended by ENS Mayukh Banik, who could not discern a glow effect, which told me all I needed to know.

This attribution is included in the implementation and merge commit messages at the owner's request.

## Existing executed evidence retained

- Native scene/reflective-material repair: run `34788444955`, macOS WebKit job `103808118864`, artifact `10327108647`. Four times of day and 16 actual scene captures passed.
- Adopted batching and frame scheduling: run `34790407066`, job `103813434391`, artifact `10327716778`. All 16 compared complete frames were unchanged. The subsequent sampling experiment was not adopted.
- Dense-starfield selection: run `34794716567`, job `103825477162`, artifact `10328799946`. The selected CSS-only path preserved all 24 canvas comparisons, star populations, glow sources, fallback availability and reduced-motion behavior.

The dense Stars measurement changed from 19.72 to 29.98 render calls/s; Air changed from 15.51 to 28.79 in the paired macOS WebKit run. These short render-call windows are not hardware presentation timestamps or a universal performance guarantee. Visible star shaders and glow math are unchanged by the CSS-only pause.

## Release boundary

The artifact integration runs the non-browser release gate before committing. Pull-request checks and the configured deployment independently report their own results. Artifact adoption itself is not a claim that a merge, browser gate, or Cloudflare deployment has completed. GitHub merge and deployment records are authoritative for those later steps. Historical failures remain in their original commits and Actions records; no thresholds were lowered to erase them.
