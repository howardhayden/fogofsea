# 02 — Design Language

## 1. Creative thesis

FOG OF SEA combines **cozy analytical calm** with **sublime environmental scale**. The interface should feel like a thoughtfully arranged field notebook suspended over a living low-poly world: tactile, luminous, fictional, and precise without becoming sterile or militaristically fetishized.

The central contrast is:

- **hard, legible decisions** in glass and paper-like panels;
- **soft, immense uncertainty** in sea, sky, fog, and distant light.

## 2. Visual attributes

| Attribute | Expression | Avoid |
| --- | --- | --- |
| Low-poly | Faceted geometry, angular silhouettes, restrained polygon changes | Smooth photorealistic clouds, generic bloom blobs, flat icon stars |
| Pastel depth | Warm/cool gradients, indigo, violet, cyan, rose, peach, mint, gold | Featureless black space, undifferentiated gray fog, neon saturation everywhere |
| Glass | Directional tint, subtle rim light, readable blur, opaque fallback | Full-screen accidental blur, nested frosted slabs, transparency without contrast |
| Fictional instrument | Compact data labels, invented measures, disclosed abstraction | Official-looking seals, copied operational interfaces, false real-world precision |
| Organic motion | Shallow asynchronous breathing, bounded drift, irregular twinkle | Perfectly synchronized sine loops, strobes, spinning ornaments, curly trails |
| Crystalline light | Tiny faceted cores with angular native-color halos | Graphic five-point stars, ovals, streaks, large circular bloom |

## 3. Color language

### 3.1 Functional palette

- Backgrounds establish time, weather, and depth.
- Panel tints separate interaction from world without erasing the world.
- Teal communicates selection, progress, and friendly state.
- Rose communicates uncertainty or opposing pressure, not automatic failure.
- Gold communicates objective, attention, or celestial warmth.
- Warning colors identify risk and consequence; they never stand alone.
- Victory and loss share the same information density and dignity.

### 3.2 Celestial palette

The stellar canopy is predominantly white and near-white. Cyan, lavender, rose, peach, mint, gold, and rare jewel tones provide local variation. Color should be discovered across the whole field, not delivered as confetti or one dominant cluster.

### 3.3 Time and weather

- Dawn: pale rose, peach, lavender, cool gray-blue.
- Day: airy cyan, sea-glass green, low saturation.
- Dusk: rose-violet, mauve, dim gold, indigo transition.
- Night: deep blue/indigo with restrained pastel emission.
- Fog: distance extinction plus drifting faceted veils; thinner upward and at altitude.
- Rain: visible streaks and, at high tiers, broad curtains; never below water.
- Snow: slow flakes with wind consequence; never below water.

## 4. Glassmorphism rules

1. Glass belongs to an occupied control or content surface.
2. A positioning wrapper must not paint, blur, shadow, or intercept the scene.
3. One visual hierarchy gets one blur. Nested body copy stays transparent.
4. Text contrast is assessed against the composited scene, not an isolated token.
5. Compact details occupy no more than 22% of the visualization height or 150 pixels.
6. Expanded compact disclosures are mutually exclusive.
7. Blur support is optional; the fallback is an opaque, bordered surface.
8. Forced-colors mode uses system surfaces and disables decorative filtering.
9. Notional is the canonical material: light and night themes use the same 63%
   panel mix, 22-pixel blur, 128% saturation, highlight angle, rim, and shadow
   grammar. Theme tokens change color—not the material hierarchy.
10. Header/navigation, alerts, HUD controls, dialogs, Academy, Field Guide,
    save/privacy/confirmation/sound surfaces, reports, and debrief must consume
    that one material definition. No component may substitute its own panel tint.
11. Academy and Field Guide share the same neutral scene scrim (42% theme
    background, 9-pixel blur, 112% saturation). The scrim is context, not a
    content card; it must never make Field Guide look darker than Academy.

## 5. Environmental visual grammar

### 5.1 Stars and stellar fields

Design rule: **stars twinkle; important luminous subjects breathe.**

The canopy uses thousands of low-poly lights across overlapping depth bands. The effect is abundant in aggregate and subordinate one light at a time. Each light may exhibit:

- an angular crystalline core;
- a thin native-color halo;
- irregular, non-flashing luminance change;
- strong, irregular but non-flashing size breathing and bounded positional scintillation;
- bounded positional wandering with no orbit, path, line, or trail;
- fog, cloud, wave, terrain, vessel, and aircraft occlusion.

Nebulae are irregular overlapping density fields made from stars, not painted clouds, ovals, or connected panels.

The current implementation keeps the complete 15,360-light population and its strongest bounded movement/twinkle profile while restoring the intended artistically enlarged presentation: ambient scale is capped at 0.96; designated jewel facets span 1.12–1.92 before distance compensation; the octahedral halo radius is 1.50, with native-color alpha at 0.26 of core alpha and capped at 0.23. Nebular and field jewel distributions use separate 0.64 and 0.62 random scale spans. These are presentation bounds, not tactical values.

Twilight is a first-class celestial state, not a near-Day omission. Dawn retains at least the 64 brightest qualifying lights and Dusk retains at least 96, including under compounded cloud, rain, poor-visibility, traffic, and sea-state pressure. The cohort is selected through optical brightness qualification; real cloud shells, fog, waves, terrain, vessels, and aircraft still pass in front. This rule changes admission only. It must not resize a star, tighten or brighten a halo, change a twinkle/wander profile, or create a separate twilight geometry set.

### 5.2 Aurora

Aurorae are five to seven expansive, softly tapered, faceted spline-curtains when eligible. Five unjoined fiber veils follow each long winding centerline at different depths. Broad overlapping paths, varied yaw, pitch, roll, elevation, and distance create a sky-spanning spatial canopy rather than isolated panels. Each curtain retains a soft native body color while its lower third resolves into a clearly distinct complementary hue; the transition follows the hanging geometry rather than reading as a flat overlay. A brighter bounded opacity floor and color-energy lift make the light vivid without additive blending, white clipping, front-facing cards, or neon crayon marks. The curtains visibly waver, wind, drift in three axes, breathe, and evolve within bounded asynchronous cycles. Day contains no aurora geometry. Brightness rises monotonically from clearly visible Dawn through Dusk to Night.

### 5.3 Clouds

Clouds are cohesive, tessellated, deformed polygon shells. Their taxonomy changes form:

- cumulus: compact rising bodies with flatter bases;
- stratocumulus: repeated low broad masses;
- stratus: wide shallow ceiling;
- nimbostratus: dense precipitation-bearing layer;
- cumulonimbus: dominant tower and anvil proportions;
- altocumulus: smaller elevated, wind-responsive masses.

Clouds drift with wind while independently breathing and morphing. They retain depth so they cover celestial light naturally.

### 5.4 Sea, ice, and precipitation

Sea geometry communicates sea state, wind, and current through facet shape, crest behavior, heave, roll, foam, and wave direction. Ice and terrain interrupt the field without looking like interface cards. Rain and snow visibly begin beneath a matching cloud base and slope with the same wind field; severity increases particle density, apparent size, speed, streak length, cloud coverage, and atmospheric veiling together. Falling precipitation terminates at the water plane and is not rendered in Stars or Subsurface views.

### 5.5 Subject emission

At Dawn, Dusk, and Night, selected visible vessels, aircraft, and submarines may use subtle dream-emission:

- crisp native-color core;
- two thin silhouette-following shells;
- low-radius, low-opacity aura;
- 24–83 second asynchronous shallow breath;
- bounded poor-weather lift for legibility;
- no point light, white wash, or large orb;
- full fog, wave, and depth occlusion.

## 6. Motion language

| Motion | Meaning | Tempo |
| --- | --- | --- |
| Star twinkle | Distant scintillation | Irregular and relatively quick, never flashing |
| Star wander | Immense living canopy | Clearly perceptible but bounded, independent targets |
| Subject emission | Intrinsic life/importance | Very slow, shallow breath |
| Cloud morph | Atmosphere evolving | Slow, wind-coupled, shallow topology change |
| Aurora wave | Charged atmospheric curtain | Slow multi-period drift, breath, and shape change |
| Fog drift | Visibility changing through space | Continuous lateral drift and vertical thinning |
| Wave motion | Environmental force | Sea-state and current responsive |
| UI transition | State continuity | Brief, directional, interruptible |

All autonomous visual motion freezes under reduced motion. Essential state remains visible in the rest pose.

## 7. Sound language

The soundscape is original, non-vocal, and synthesized in the browser. It supports bodily atmosphere rather than tactical alarm:

- low modulated breathing tones;
- scattered wind and environmental texture;
- restrained interaction confirmation;
- independent ambiance and interface volumes;
- no autoplay before user action;
- mute and volume state communicated textually.

Sound is supplementary. No rule, warning, or outcome depends on hearing.

## 8. Writing and nomenclature

- Use plain, precise, non-triumphal language.
- Pair invented values with context and evidence.
- Say “assessed,” “possible,” or “concealed” when uncertainty is part of the model.
- Identify fictional and educational status without interrupting every action.
- Use “selected force” and “opposing actor” where identity is deliberately abstract.
- Explain why an action is blocked and the smallest action that repairs it.
- Present post-decision learning as either a supported Cause → Evidence → Adjustment or an explicit statement that no clear mistake was indicated; never manufacture blame from an unfavorable uncertain outcome.
- Never imply that a score is a real-world probability or recommendation.

## 9. Composition tests

A visual is successful when:

- the player can still find the current task in under a few seconds;
- the scene has depth without hiding vessels, aircraft, and controls;
- one star, halo, cloud, or aurora curtain is not the spectacle by itself;
- global navigation and every occupied work surface compute the exact Notional
  material rather than merely resembling it or reverting to an opaque slab;
- compact disclosures leave the central scene usable;
- text survives both the busiest sky and the lightest dawn;
- reduced-motion and forced-color modes remain complete, not diminished versions of the rules.
