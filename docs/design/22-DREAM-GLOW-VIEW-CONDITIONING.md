# Dream glow — view-conditioned spread correction

## Observed defect

The attached Air-view screenshots exposed a defect that the canonical broadside fixture did not: glow looked appropriate from overhead but expanded into oversized ovals around thin side-on aircraft, especially against the dawn sky.

The cause was mathematical, not merely aesthetic. NDCG v0.1 defined the spatial scales as `sigma_k = rho_k * h`, where `h` is a projected image-space reference size. The first FOG OF SEA implementation substituted a projected **3D bounding-sphere diameter** for `h` to prevent articulated pose jitter. A sphere is view-invariant. It therefore continued carrying an object's invisible width/depth dimensions into the screen-space blur after the visible silhouette had foreshortened. Overhead views happened to expose a broad face and therefore looked correct; side views did not.

The failure mode is:

`h_old = project(2R_sphere)`

regardless of current projected source footprint.

For a thin aircraft, `h_old` can remain dominated by wingspan/length while the rendered side silhouette is only a small fraction as broad. Since every blur scale is proportional to `h_old`, the halo becomes a detached-looking oval even though the convolution itself is shape-derived.

## Corrected reference

The sphere projection is retained only as an upper bound. Registration now freezes a canonical local emitter `referenceBox` as well as its sphere. Each frame, the eight canonical box corners are projected **without viewport clipping** and their 2D convex-hull area `A_p` is measured.

Let the world-scaled canonical box dimensions be `s_x`, `s_y`, and `s_z`, and

`A_max = max(s_x s_y, s_x s_z, s_y s_z)`.

Let `D_s` be the world-space sphere diameter and `h_s` its former projected screen-space diameter. The view-conditioned reference is

`h_A = D_s * sqrt(A_p / A_max)`

`h = min(h_s, h_A)`.

Dimensional check: `A_p` is pixels squared and `A_max` is world-units squared, so `sqrt(A_p / A_max)` is pixels per world unit and `h_A` is pixels.

For an orthographic broadside of the largest canonical face, `A_p = A_max * p^2`, therefore `h_A = D_s p = h_s`: the accepted overhead/broadside appearance is preserved. As the emitter turns edge-on, `A_p` contracts and the blur radius contracts with `sqrt(A_p)`. Perspective can expose several faces at once, but `min(h_s, h_A)` prevents any view from growing beyond the previously accepted broadside radius.

The convex-hull area is invariant to rotation within the image plane, so merely changing an object's heading does not cause arbitrary glow pumping. It responds only to actual out-of-plane foreshortening and distance. The canonical box is frozen at registration, so articulated wildlife motion still cannot change the scale.

## New atomic requirements

- **R05 — Projected broadness:** a 3D bounding sphere may cap the glow reference but must not alone determine the screen-space spread when the visible emitter is foreshortened.
- **R06 — View conditioning:** genuine out-of-plane foreshortening must contract the glow reference monotonically with projected canonical footprint.
- **R07 — Image-plane invariance:** rotating the same projected footprint within the screen plane must not materially change the reference scale.
- **R08 — Broadside preservation:** a broadside projection of the largest canonical face must preserve the previously accepted sphere-derived radius, subject only to ordinary perspective error.
- **R09 — No clipping feedback:** viewport clipping must not reduce or enlarge the reference scale; projection uses unclipped canonical corners.
- **R10 — Pose stability:** internal articulation must not pump the reference; only root transform, camera projection, and canonical registered bounds may affect it.

These extend rather than replace the existing R01–R04 obligations.

## Tests

`tests/dream-glow-math.test.ts` now verifies:

- convex-hull footprint area is invariant under a 60-degree image-plane rotation;
- a canonical `4 x 2 x 0.5` aircraft-like box preserves a 45-pixel broadside reference;
- the same box contracts to 22.5 pixels when the projected face area falls from 8 to 2 square world-unit equivalents;
- perspective/exposed-face growth cannot exceed the accepted 45-pixel sphere ceiling;
- flat emitters remain valid and degenerate projected footprints fail closed.

The existing GPU broadside fixture remains unchanged, specifically to verify that the overhead/broadside appearance does not regress. Side-view production screenshots remain a required visual acceptance check; automated mathematical conformance is not a substitute for that comparison.
