# Night in the Woods: character-glow model and atomic requirements

**Version:** 0.1  
**Namespace:** NDCG  
**Date:** 2026-09-13  
**Status:** Proposed mathematical reconstruction. Fourteen mathematical consistency checks passed. The original shader has not been recovered; numerical parameters have not been fitted to game pixels; original motion timing, production rendering, device performance, and perceptual fidelity are unverified.

## Target and scope

The target is a crisp, colored, self-luminous character with a measurable, short, soft spread of colored light outside its silhouette. It is not merely an illuminated outline, an enlarged translucent character, a circular sprite behind the character, or a blur of the entire scene.

The inspected game imagery separates cyan/blue character regions and magenta eye accents from a dark environment. The large circular luminous world feature is not the character's glow radius. Background haze and other lights must be excluded from any character-only fit.

This specification concerns the character/source-local effect only. It does not change any repository, replace existing accepted requirements, redesign environmental lighting, or perform a deployment. The spatial construction below is an original approximation, not a claim about the game's implementation. Available still references do not establish temporal behavior.

## 1. Linear-light inputs — MODEL-EQ01

For an encoded sRGB component \(c\in[0,1]\), decode before filtering or adding light:

\[
D(c)=
\begin{cases}
c/12.92,&c\le0.04045,\\
((c+0.055)/1.055)^{2.4},&c>0.04045.
\end{cases}
\]

All source and background RGB values in the following equations are linear-light quantities. One recorded output transform and encoding are applied at the end. A screenshot's encoded pixel values are not linear radiance measurements. See REF-COLOR.

## 2. Preserve the crisp subject; construct a separate emitter — MODEL-EQ02

Let \(A_r(x)\) be the effective visible coverage of authored source region \(r\). Region masks partition the subject's effective coverage rather than double-counting overlapping sprite layers.

\[
A(x)=\sum_r A_r(x),\quad 0\le A(x)\le1,
\]

\[
P(x)=\sum_r A_r(x)C_r(x),
\]

\[
E(x)=\sum_r A_r(x)e_rC^{\mathrm{emit}}_r(x).
\]

Here \(P\) is the premultiplied crisp core, \(C_r\) its authored luminous color, and \(E\) the premultiplied emission field. Regional gains \(e_r\) permit different contributions without flattening all colors into one fill. Fix the reference body multiplier to one when fitting the global gain; otherwise their product is underidentified.

The reference palette can distinguish cool body regions and magenta accents. A target-project adaptation may instead preserve each material's native color. Those are separate named profiles, not contradictory instructions.

Core material and halo are independent. The reference core may be unlit artwork; an adapted 3D material may retain authored faceted shading. A view-angle rim term alone is not the complete effect. Fully transparent pixels emit nothing, regardless of hidden RGB stored in an atlas.

Ordinary threshold bloom is not sufficient as a specification: selection, spatial spread, intensity, and color must be controlled independently. REF-BLOOM describes those ordinary bloom controls; it does not identify the original game's renderer.

## 3. A compact, shape-derived, multiscale spatial field — MODEL-EQ03

Let \(h\) be the subject's **unclipped projected authored reference size**, expressed in the same pixel units as filtering. For a character, use the projected height of an authored reference pose, not a changing clipped bounding box.

For \(q=\|u\|/\sigma\), define the smooth radial taper

\[
W(q)=
\begin{cases}
1,&q\le2.5,\\
1-(3s^2-2s^3),\quad s=(q-2.5)/0.5,&2.5<q<3,\\
0,&q\ge3.
\end{cases}
\]

Then define

\[
K_\sigma(u)=
\frac{\exp(-\|u\|^2/(2\sigma^2))\,W(\|u\|/\sigma)}
{Z_\sigma},
\]

where

\[
Z_\sigma=\int_{\mathbb R^2}
\exp(-\|u\|^2/(2\sigma^2))W(\|u\|/\sigma)\,du.
\]

Each kernel is nonnegative, centered, isotropic, unit-mass, and smoothly compact. Its support ends at \(3\sigma\). It follows the entire emitting silhouette because it filters \(E\), not a disk placed at the object's center.

## 4. The proposed spatial seed — MODEL-EQ04

\[
G_{\mathrm{raw}}(x,t)=
g\,p(t)\sum_{k=1}^{3}w_k(K_{\sigma_k}*E)(x),
\quad \sigma_k=\rho_kh.
\]

The v0.1 seed is:

| Component | \(\rho_k=\sigma_k/h\) | \(w_k\) |
|---|---:|---:|
| Near attachment | 0.012 | 0.65 |
| Soft local spread | 0.035 | 0.30 |
| Faint outer tail | 0.075 | 0.05 |

Use \(g=0.28\) and initially \(p(t)=1\). These are **proposed calibration values**, not measurements from the game.

The nonnegative weights sum to one. Weight controls the mixture's contribution, not a sprite's opacity. At a 100-pixel reference height, the sigmas are 1.2, 3.5, and 7.5 pixels. The largest exact support is 22.5 pixels from source support, but most of that tail is extremely faint. Sigma is not the same thing as the visible halo radius.

Unit-mass normalization prevents broad kernels from acquiring unbudgeted energy just because their area grows. The full model has three spatial scales; it does not require three separate GPU passes.

## 5. Overlap without per-channel clipping — MODEL-EQ05

Sum authorized source fields before applying the overlap limiter. Let \(y=Y(G_{\mathrm{raw}})\), where \(Y\) is linear-light luminance. For fixed radiance thresholds \(0\le b<c\),

\[
f(y)=
\begin{cases}
y,&y\le b,\\
b+(c-b)\left(1-\exp(-(y-b)/(c-b))\right),&y>b.
\end{cases}
\]

\[
G=
\begin{cases}
0,&y=0,\\
G_{\mathrm{raw}}f(y)/y,&y>0.
\end{cases}
\]

A provisional fixture uses \(b=0.3Y_0\), \(c=0.5Y_0\), for declared reference luminance unit \(Y_0\). The flat-edge seed measurements below remain below the shoulder.

This function is continuous with a matching first derivative at the knee, nondecreasing, and bounded. Its scalar RGB multiplier preserves the aggregate field's channel ratios before display transformation. It does **not** guarantee that a later tone mapper preserves perceived hue or that differently colored lights cannot naturally mix toward a less saturated color. The final pipeline still needs color verification.

## 6. Composite around, not over, the opaque core — MODEL-EQ06

For a single subject, where \(B\) does not already contain that subject:

\[
I_{\mathrm{linear}}(x)=
P(x)+(1-A(x))[B(x)+G(x)].
\]

\[
I_{\mathrm{display}}=
\operatorname{Encode}\!\left(T(I_{\mathrm{linear}})\right).
\]

\(T\) is the recorded scene/display transform. Do not change it simply because glow is enabled.

For \(A=1\), the result is \(P\): the external glow cannot wash out the opaque face, markings, or silhouette. For \(A=0\), the background receives \(G\). Anti-aliased coverage uses the same premultiplied convention.

For multiple subjects, let \(J\) be the already-composited crisp scene and \(A_{\mathrm{protected}}\) the effective coverage of protected visible cores:

\[
I_{\mathrm{linear}}=J+(1-A_{\mathrm{protected}})G.
\]

Correct depth/layer handling is still required; this union mask alone is not an occlusion solution. Interface elements are not emission sources and are composed through their existing interface pipeline.

## 7. Visibility is a source-and-path restriction — MODEL-EQ07

A depth/layer-aware extension is

\[
G_i(x)=g_i p_i(t)\sum_k w_k
\int K_{\sigma_{ik}}(x-y)\,
\chi_i(x,y)\,E_i(y)\,dy.
\]

First construct \(E_i\) from only authorized, visible source fragments. Then let \(\chi_i(x,y)\) suppress contributions onto a nearer opaque foreground destination. In 2D, use declared layer ordering; in 3D, compare source depth with the foreground destination depth in a consistent linear-depth convention. Anti-aliased coverage may make the gate fractional.

Do not renormalize the kernel after this gate. Occlusion removes a contribution; it does not redistribute that contribution onto the visible remainder.

This is a proposed integration policy, not a claim that the original game's postprocessing used depth-aware bloom. In FOG OF SEA, unauthorized contacts must be absent upstream of emission construction. A cosmetically blurred hidden object is still an information leak.

Pad processing regions by at least \(\lceil3\sigma_{\max}\rceil\) render-target pixels. A source may be partially offscreen while its authorized halo reaches the visible screen; cropping must not alter \(h\) or abruptly clip its field.

## 8. Temporal behavior is an optional adaptation — MODEL-EQ08

The uncalibrated reference profile remains static:

\[
p(t)=1.
\]

A separate optional profile preserves the previously requested slow, shallow, asynchronous breathing:

\[
p_i(t)=
1+0.02\sin(2\pi t/31+\phi_i)
 +0.01\sin(2\pi t/47+\psi_i).
\]

Stable phases are derived from object identity; \(t\) is elapsed time, not frame count. Only halo gain changes.

\[
0.97\le p_i(t)\le1.03,
\]

\[
|p_i'(t)|
\le0.02(2\pi/31)+0.01(2\pi/47)
\approx0.005390516\ \mathrm{s}^{-1}.
\]

This is not a measured Night in the Woods animation. Reduced motion sets \(p=1\). A reduced-effects mode may disable the decorative halo while preserving the core and essential information. REF-MOTION supports honoring preferences for nonessential animation; this waveform alone is not an accessibility certification.

## 9. What the falloff means — MODEL-EQ09

For a locally straight edge, a uniform source \(E_0\), and an **untruncated** normalized Gaussian, the exterior response has a closed form:

\[
\frac{G(d)}{E_0}
=
\frac g2\sum_k w_k\,
\operatorname{erfc}\left(\frac{d}{\sqrt2\sigma_k}\right),
\quad d\ge0.
\]

The scalar ratio means each component shares the same multiplier for a uniform-color source. This follows by integrating the Gaussian over the emitting half-plane.

It describes why the strongest field is attached to the contour and fades outward rather than forming a detached ring. The compact tapered model has a slightly different profile; the following numbers use its actual normalized radial integral, not the untruncated equation.

**Fixture:** uniform unit-luminance source; ideal exterior of a straight edge; static gain; no other light or occluder; no active overlap shoulder; identity tone transform. Measurements are linear residual light after subtracting the core-only scene. Anti-aliased core pixels are excluded.

| Distance beyond the edge | Compact model halo / source luminance |
|---|---:|
| \(0^+\) | 0.140000 |
| \(0.01h\) | 0.074531 |
| \(0.02h\) | 0.036551 |
| \(0.05h\) | 0.009362 |
| \(0.10h\) | 0.001189 |
| \(\ge0.225h\) | 0 |

These values are computed from the proposed model, not sampled from the game.

### Acceptance is two-sided

A full-effect implementation must not pass merely by avoiding excess glow.

In the declared fixture require:

\[
0.05\le
\frac{\Delta Y(0.01h)}{Y(E_0)}
\le0.10,
\]

\[
\frac{\Delta Y(0.10h)}{Y(E_0)}\le0.002.
\]

The first rejects an absent or practically ineffective outward field. The second rejects a broad luminous fog bank.

For two equal opposing half-plane sources with a gap of \(0.10h\), the midpoint receives twice the response at \(0.05h\):

\[
2(0.009362446)=0.018724892<0.025.
\]

That specific gap remains much darker than the attached halo. This does not claim that every arbitrarily narrow gap remains unlit.

For sampling qualification, compare normalized profiles at reference sizes 32, 64, and 128 pixels and device-pixel ratios 1, 2, and 3. The proposed tolerance is 5% of the reference edge peak, not a relative error against an almost-zero tail. Subpixel-source cases need their own qualified sampling profile; do not enlarge them into glowing beads.

## Calibration and the remaining visual evidence

A literal reference fit needs aligned, color-managed character crops, source-region masks, and a clean or uncertainty-qualified background estimate. Separate the character's field from rings, sky haze, nearby lights, and compression artifacts.

Fit spatial shape, regional color, source gain, and display behavior under declared constraints. Do not use a whole-image average as the sole objective: a mostly dark screenshot can score well while the small character is wrong. A practical fit objective is a weighted sum of core-region, halo-region, edge-profile, and far-background errors, subject to the positive halo and darkness bounds.

A single composite screenshot cannot uniquely identify all source colors, background radiance, exposure, tone mapping, and blur parameters. Preserve uncertainty rather than inventing original constants.

The proposed profile is complete enough to implement and test, but mathematical consistency is not perceptual approval. Native-size side-by-side review remains necessary before claiming the requested effect has been captured.

## Atomic register

Every row is a single independently rejectable obligation. All rows remain **specified; renderer conformance and reference fidelity unverified**. Logical owners, provenance, dependencies, conflict resolution, positive/negative/boundary tests, evidence links, applicability, and non-supersession metadata are preserved in the accompanying JSON register.

The acceptance text below is summarized; the JSON carries full test cases.

### Evidence and scope

| ID | Atomic obligation | Positive acceptance |
|---|---|---|
| NDCG-E01 | Label each reference-derived assertion as observed, inferred, proposed, or measured. | Spatial observations and new numerical seeds have different provenance labels. |
| NDCG-E02 | Keep the v0.1 numerical profile provisional until calibration and native-size visual approval. | The profile carries provisional status and a version. |
| NDCG-E03 | Exclude unrelated scene lights from the character-glow reference mask. | The ring, stars, and background haze have separate exclusion masks. |
| NDCG-E04 | Integrate this register without silently superseding existing project requirements. | Any later adoption records its scope and reconciliation with the authoritative project register. |

### Source and core

| ID | Atomic obligation | Positive acceptance |
|---|---|---|
| NDCG-S01 | Preserve the original geometric coverage of the character core. | The core coverage mask equals the no-halo mask. |
| NDCG-S02 | Keep the crisp luminous core independently renderable from the halo. | Setting halo gain to zero leaves the authored core intact. |
| NDCG-S03 | Retain the authored color of each emitting source region. | Cyan/blue regions and magenta accents remain distinct in the reference profile. |
| NDCG-S04 | Premultiply emission by source coverage before filtering. | Emission is the sum of region coverage times regional emission color and gain. |
| NDCG-S05 | Select character emission independently of a whole-scene brightness threshold. | A selected colored character can glow without raising its core to white. |
| NDCG-S06 | Do not make character emission depend solely on a view-angle rim term. | The subject retains luminous colored interior regions when facing the viewer. |

### Spatial halo

| ID | Atomic obligation | Positive acceptance |
|---|---|---|
| NDCG-H01 | Derive the glow field from the visible filled emission field rather than a centroid disk. | Ears, limbs, gaps, and separate emitting regions affect local spill. |
| NDCG-H02 | Use centered isotropic kernels in the default spatial profile. | The impulse response is symmetric about its source. |
| NDCG-H03 | Keep all default kernel coefficients nonnegative. | An isolated positive source cannot generate a negative dark ring. |
| NDCG-H04 | Normalize each spatial kernel to unit mass before applying visibility gates. | The integral of each unobstructed kernel equals one. |
| NDCG-H05 | Retain ordered near, middle, and far spatial scales in the full reference model. | The seed uses sigma/h = 0.012, 0.035, 0.075 with strictly increasing radii. |
| NDCG-H06 | Normalize the nonnegative scale-mixture weights to one. | The seed weights 0.65, 0.30, 0.05 sum to one. |
| NDCG-H07 | Taper every kernel continuously to zero between 2.5 sigma and 3 sigma. | The compact kernel has zero value and zero radial slope at its support boundary. |
| NDCG-H08 | Keep glow gain independent of glow radius. | The seed uses gain 0.28 with body emission multiplier fixed to one for identification. |

### Compositing

| ID | Atomic obligation | Positive acceptance |
|---|---|---|
| NDCG-C01 | Perform emission filtering and light addition in linear-light RGB. | Encoded color inputs are decoded before filtering. |
| NDCG-C02 | Composite the opaque crisp core without adding the exterior halo over it. | For coverage A=1, the result is exactly the premultiplied core. |
| NDCG-C03 | Keep unrelated scene content out of the character emission input. | A character-only emission buffer excludes stars, rings, labels, and background haze. |
| NDCG-C04 | Apply the selected display transform and output encoding exactly once. | The scene uses one recorded tone/display transform and one output encoding. |
| NDCG-C05 | Limit overlapping halo luminance with a continuous scalar shoulder. | The limiter is nondecreasing, bounded, and multiplies all RGB channels by one scalar. |
| NDCG-C06 | Leave the core-only scene unchanged outside all authorized glow supports. | Pixels beyond the padded source supports equal the core-only scene. |

### Scale and sampling

| ID | Atomic obligation | Positive acceptance |
|---|---|---|
| NDCG-R01 | Scale radii from the unclipped projected authored reference size. | Sigma/h stays fixed when the subject scales. |
| NDCG-R02 | Convert source size and kernel radii into the same pixel coordinate system once. | CSS-pixel measurements are multiplied by device-pixel ratio once when targeting physical pixels. |
| NDCG-R03 | Pad source processing by the full maximum kernel support. | Each source receives at least ceil(3 sigma_max) processing padding in render-target pixels. |
| NDCG-R04 | Handle subpixel sources without artificially enlarging their glow footprint. | Use area-aware sampling or a separately qualified small-source profile. |

### Visibility

| ID | Atomic obligation | Positive acceptance |
|---|---|---|
| NDCG-V01 | Remove unauthorized sources before constructing emission. | The emission source set is derived only from information available to the viewer. |
| NDCG-V02 | Remove fully occluded source fragments before spatial filtering. | Only visible source coverage supplies emission. |
| NDCG-V03 | Block halo contributions onto nearer opaque foreground destinations. | Each contribution uses the declared layer/depth visibility gate. |
| NDCG-V04 | Do not renormalize a kernel after visibility removes contributions. | Blocking part of a source path only removes its contribution. |

### Time

| ID | Atomic obligation | Positive acceptance |
|---|---|---|
| NDCG-T01 | Keep the uncalibrated reference-reconstruction profile static. | The default multiplier is p(t)=1. |
| NDCG-T02 | Confine optional breathing to the specified shallow gain-only function. | Optional p(t)=1+0.02 sin(2 pi t/31+phi)+0.01 sin(2 pi t/47+psi). |
| NDCG-T03 | Evaluate optional breathing from stable per-object phases and elapsed time. | Object identity determines repeatable phases; time is not a frame counter. |
| NDCG-T04 | Disable decorative modulation when reduced motion is active. | Reduced motion sets p(t)=1. |

### End-to-end acceptance

| ID | Atomic obligation | Positive acceptance |
|---|---|---|
| NDCG-Q01 | Produce a nontrivial exterior halo in the declared flat-edge fixture. | At d=0.01h, decoded linear halo residual/source luminance is in [0.05,0.10]. |
| NDCG-Q02 | Meet the declared far-tail darkness limit in the flat-edge fixture. | At d=0.10h, the linear halo residual/source luminance is no more than 0.002. |
| NDCG-Q03 | Preserve a dark separation in the declared two-source gap fixture. | Two opposing equal half-plane sources separated by 0.10h give midpoint residual at most 0.025 source luminance. |
| NDCG-Q04 | Verify source-color fidelity through the final display pipeline. | Compare palette regions and isolated glow residuals against the approved color-managed profile. |
| NDCG-Q05 | Verify scale equivalence at native sampling resolutions. | At h of 32, 64, and 128 reference pixels and device-pixel ratios 1, 2, and 3, normalized profile error is at most 5% of the flat-edge reference peak. |
| NDCG-Q06 | Require native-size visual comparison before declaring the reference effect captured. | Record aligned reference/render crops and explicit visual approval at ordinary viewing size. |
| NDCG-Q07 | Preserve essential identification and information with decorative glow disabled. | Core geometry and existing non-glow labels/cues remain available. |
| NDCG-Q08 | Validate the numeric domain of every glow-profile input before evaluation. | Require finite nonnegative gains/weights, valid scale ordering, positive sigma, positive periods, and 0<=b<c. |

### Transfer and qualification

| ID | Atomic obligation | Positive acceptance |
|---|---|---|
| NDCG-I01 | Keep the reference palette distinct from a native-color-preserving project adaptation. | The Night in the Woods reconstruction and FOG OF SEA use separately named color policies. |
| NDCG-I02 | Do not automatically convert cosmetic character glow into conventional scene illumination. | Any point lights, reflections, or environmental scatter have their own authorized source and requirement. |
| NDCG-I03 | Qualify implementation approximations against output invariants rather than a required number of GPU passes. | A fused filter, cached field, or other approximation passes the same approved profile tests. |
| NDCG-I04 | Label effect degradation as a reduced profile rather than full-reference conformance. | A measured constrained-hardware profile may reduce the far layer before sacrificing core readability. |

## Mathematical checks actually executed

Fourteen scalar/quadrature checks passed. These do not constitute screenshot fitting, GPU validation, or perceptual testing.

| Evidence ID | Check | Result |
|---|---|---|
| MATH-01 | Unit-mass compact kernels | PASS |
| MATH-02 | Ordered scales and normalized nonnegative weights | PASS |
| MATH-03 | Continuous compact taper with zero endpoint slope | PASS |
| MATH-04 | Finite support | PASS |
| MATH-05 | Positive visible-spread fixture bound | PASS |
| MATH-06 | Far-tail fixture bound | PASS |
| MATH-07 | Two-source gap | PASS |
| MATH-08 | Opaque-core invariance | PASS |
| MATH-09 | Transparent-RGB source exclusion | PASS |
| MATH-10 | Scalar shoulder monotonicity, bound, and join | PASS |
| MATH-11 | Limiter preserves aggregate RGB ratios | PASS |
| MATH-12 | Occlusion must not renormalize surviving support | PASS |
| MATH-13 | Optional breathing amplitude and derivative bounds | PASS |
| MATH-14 | Nonnegative monotone flat-edge falloff | PASS |

## Constructed adversarial cases

These are mathematical test candidates, **not claims about bugs observed in an existing repository**.

| Case | Failing candidate | Correction |
|---|---|---|
| RT-01 | Gain zero passes darkness-only tests. | Add the positive exterior-light lower bound. |
| RT-02 | An infinite Gaussian is asserted to have zero light past a finite radius. | Use the normalized smooth compact taper. |
| RT-03 | Transparent atlas RGB is treated as emission. | Premultiply before filtering. |
| RT-04 | Glow is added over an opaque detailed core. | Protect the core in the composition equation. |
| RT-05 | Occlusion-masked kernel weights are renormalized. | Let blocked contributions remain removed. |

Each correction has a linked executed mathematical check in the JSON. Production geometry, actual display encoding, motion preference changes, full reference fidelity, and hardware frame pacing still require implementation-specific evidence.

## Source locators

Primary game imagery:
`https://steamuserimages-a.akamaihd.net/ugc/925922202521360432/D88B160297304FBBDDB8127462463FD143008271/?fit=inside%7C1024%3A%2A&interpolation=lanczos-none&output-format=jpeg&output-quality=95`

REF-COLOR — W3C, CSS Color Module Level 4:
`https://www.w3.org/TR/css-color-4/`

REF-BLOOM — Unity, Bloom Volume Override reference for URP:
`https://docs.unity3d.com/6000.0/Documentation/Manual/urp/post-processing-bloom.html`

REF-MOTION — W3C, Understanding Animation from Interactions:
`https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html`

These technical sources support the general color, bloom-control, and accessibility principles. They do not establish the original game's shader, its numeric settings, or its temporal modulation.

## Associated machine-readable register

`nitw_character_glow_atoms_v0_1.json`

The register includes all 48 atoms, every declared dependency, conflict records, evidence labels, numeric profile data, calculated edge samples, and all 14 mathematical check results. It explicitly preserves the unverified status of visual matching and production implementation.
