# FOG OF SEA — Maritime Strategy Lab

An independent fictional browser-based maritime rigid Kriegsspiel with a three-dimensional tactical plot, a deterministic six-turn umpire, fictional force design, and an original interactive academy for grand strategy and strategic philosophy.

## Independent status

FOG OF SEA is independently produced and is not affiliated with, sponsored by, approved by, or endorsed by any government agency or manufacturer. It uses no official seals, emblems, word marks, platform names, system names, or branded imagery.

Every force, platform, aircraft, system, capacity, personnel figure, point value, contact, and exercise sector is fictional. Capability families loosely synthesize publicly described maritime concepts and then deliberately alter their names, combinations, scale, staffing, and performance. Any discrepancy in realism reflects the developer's subject-matter inexperience and deliberate abstraction.

The game does not reproduce an official manual, exercise, force table, adjudication system, or external ruleset. Its rigid procedures, thresholds, ranges, tracking values, opposing logic, and outcomes are original inventions for this simulation.

## What is included

- Pastel light and dark interfaces
- Full-browser desktop tactical view with layered glass panels and solid-color fallbacks
- Self-hosted Jost variable typography with graceful system sans-serif degradation
- Dawn, day, dusk, and night lighting
- Ocean, Arctic, and Antarctic environments
- Session-seeded low-poly waves whose facets, crests, troughs, forward lips, foam, and whitecaps respond to wind, current, sea state, and weather; selected vessels heave and roll with the same field, while reduced-motion preferences hold it still
- Season-sensitive storms and precipitation are deliberately common: broad deterministic samples keep precipitation near 70% and storms near 30%, while regional, seasonal, cloud, wind, sea-state, and visibility validation still applies. Five sharply separated rain or snow presentation tiers use optional static low-poly lightning geometry and localized eased cloud-interior light that never flashes. Wind-sloped precipitation cells descend from actual nimbostratus or cumulonimbus bases; a validated storm begins at the squall tier. Rain rises from 900 short streaks to 8,800 long, fast streaks plus as many as six depth-aware curtains. Snow rises from 800 flakes at 3.1 modeled pixels and 2.2 scene units per second to 7,200 flakes at 11.6 pixels and 9 units per second, with a bounded near/mid/far size mix. Cloud coverage and mist rise with severity, while every falling particle terminates at the water surface and precipitation never enters Stars or Subsurface views
- Original non-vocal, browser-synthesized low-note ambiance and interface effects with independent volume controls
- No finite scenario list: compositional fictional mission-family grammars—including coastal safeguarding and victim-centered anti-trafficking operations—regenerate the operation, strategic frame, climate, region, season and date, time, weather, clouds, precipitation, sea, wind, current, visibility, celestial eligibility, geography, threat, actors, force requirements, objective, difficulty matrix, civilian context, intelligence, and constraints for every new game. A pure whole-candidate validator accepts the scenario only when all coupled facets can coexist; rejected candidates are discarded and regenerated from fresh entropy, with a bounded deterministic constructive fallback that must pass the same validator before presentation
- Guided, Standard, and Challenge play modes; Guided starts from a repeatable scenario, adds a next-action checklist, and uses gentler transparent thresholds
- Detailed unnamed mission briefs covering geography and chokepoints, friendly and opposing situations, civilian and neutral traffic, constraints, timing, success conditions, and a comparative maritime-theory problem
- Fictional full-deck and short-deck aviation ships, expeditionary aviation docks, uncrewed-aircraft ships, stealth littoral combatants, multi-role escorts, air-independent submarines, long-endurance submarines, and autonomous mine and undersea support vessels
- A fixed 100-point allocation that remains locked at zero until the player determines an objective/end state and identifies warfare areas; only mission-relevant, compatible vessels, aircraft, and armament packs then earn points or coverage
- Twenty task-specific crewed and uncrewed aircraft families spanning interception, multiple strike profiles, patrol, acoustic search, electromagnetic support, command relay, mine search, rescue, lift, refuelling, and reconnaissance, with explicit deck compatibility, invented reach, track capacity, tracking methods, personnel, and mission packs
- One alphabetized mission-pack catalog with distinct surface-vessel, submarine, and aircraft hosts, invented reach and tracking behavior, and zero credit until a compatible selected host has an available slot; a non-lethal maritime safeguarding pack models rescue, evidence custody, scene documentation, and protected civil handoff
- Force counters remain unavailable until the player identifies an affiliated warfare area; imports enforce the same rule, and removing a required area is prevented until dependent force items are removed
- Labelled view buttons and Page Up/Page Down move deliberately among stars, sky, aircraft, surface, and subsurface views; pointer and arrow-key rotation never changes layers
- Nearly 360-degree horizontal rotation from every view, with numeric heading, compass direction, elevation, and range available through the Plot Data disclosure
- Low-poly, ephemeris-calculated Sun and Moon positions and lunar illumination, using a fixed scenario date and disclosed observer—never the device clock, time zone, or location
- An immense session-randomized canopy of as many as 15,360 varied-scale crystalline lights: 3,072 globally distributed field stars plus 12,288 lights sampled from sixteen real, irregular, overlapping low-frequency harmonic nebula fields. Each field changes spatial density and luminance across the whole sky while a strictly positive floor prevents oval boundaries, radial kernels, seams, or gaps. At least 76% of the plan is white or near-white, while 1,424 larger jewel facets and restrained cyan, lavender, rose, peach, mint, and gold accents supply color without turning the sky into confetti. Four substantially overlapping distance bands span 88–404 world units; ambient scale is capped at 0.96, jewels span 1.12–1.92 before distance compensation, and the 1.50-radius native-color angular shell uses 0.26 core-alpha with a 0.23 cap. Every light retains exuberant independent non-flashing scintillation, strong size breathing, and emphatic bounded non-orbital wandering. Dawn and Dusk deliberately retain their brightest 64- and 96-light cohorts even under compounded cloud, rain, poor-visibility, traffic, and sea-state penalties; this twilight qualification changes visibility only, never the established population, geometry, scale, halo, twinkle, or motion profiles. Apparent brightness, fog, clouds, waves, vessels, and aircraft still govern natural occlusion, and reduced motion freezes the canopy
- A separate aurora engine adapting the MIT-licensed FastNoise Lite progressive domain-warp technique into fog-aware Three.js GLSL: expansive tapered spline paths carry five unjoined translucent fiber veils through staggered pitch, yaw, roll, elevation, and depth, with bright bounded Normal-blended emission, a distinct complementary lower-edge color on every curtain, independently phased wavering and breathing, zero daylight visibility, natural scene occlusion, and a deterministic reduced-motion pose
- A softly faceted pastel sky gradient, meteorological low-poly cloud regimes made from cohesive deformed polygon shells rather than translucent lobe stacks, real distance fog that thins smoothly with upward view angle and altitude, and up to six slowly advected fog banks preserve atmospheric depth. Each seeded cloud shell drifts with the wind while independently breathing and changing shape inside shallow, non-flashing bounds; clouds retain scene depth so they naturally interrupt stars and aurora without painting over foreground subjects
- Selected visible vessels, submarines, and aircraft use a separate dawn/dusk/night dream-emission channel: hard native-color cores and thin dual-shell rim halos breathe asynchronously over 24–83 seconds, receive a bounded poor-weather visibility lift, remain wave-, depth-, and fog-occluded, and freeze under reduced motion; merged subject silhouettes cap the channel at two halo meshes per subject and 84 overall
- Shared above-water and subsurface optics require an open, weather-qualified water aperture and a visible Sun or Moon sightline before exceptional stars or nebula light can transmit through the surface; refraction and water-reflection labels distinguish transmitted light from reflected glints, while deep, rough, overcast, or geometrically blocked views remain dark
- Region-, latitude-, season-, temperature-, cloud-, precipitation-, and time-sensitive northern or southern aurorae: every visible event contains five to seven broad, softly tapered, independently colored, faceted three-dimensional spline curtains that span and overlap across varied centerlines and widely separated depth planes, remain fine fibers without becoming cards or one bar, shift into a clearly different soft hue along each lower edge, waver, wind, breathe, and evolve on irregular non-flashing cycles, and resolve to a fixed reduced-motion pose. Aurora geometry is absent during Day; a tested monotonic darkness multiplier makes it clearly visible at Dawn, brighter at Dusk, and brightest at Night
- Natural player-facing cloud-cover language (`clear`, `partly cloudy`, `mostly cloudy`, or `overcast`) while the established internal weather and portable-save schema remains compatible
- Explicit preparedness, response, recovery, and mitigation orders; centralized, federated, mutual-support, and independent coordination; and high-level strategic-force policies whose escalation and recovery tradeoffs become sharper against multiple opposing actors
- Deterministic, region-, climate-, and depth-sensitive vague low-poly subsurface silhouettes and schools; these decorative forms are never tactical contacts
- A separate recognizable wildlife layer derives bounded penguin, seal, large-whale, dolphin/porpoise, shark, pelagic-seabird, and coastal-bird groups from the accepted region, season, time, weather, wind, sea state, visibility, ice edge, and proximity to land. Its dedicated low-poly avatar engine rigs heads, torsos, wings, flippers, legs, tails, and flukes for continuous species-appropriate travel along closed ecological routes: birds flap and bank toward changing waypoints, compact dolphins actively swim or porpoise across wide routes, sharks continuously cruise, and ice animals commute within their assigned floes. A deterministic minority—but never all—of a multi-penguin group may pause lying down. Greeting one produces a grounded brace-and-rise, stand, confused head scratch, and return to rest without spinning. Display scale keeps all wildlife subordinate to operational subjects; sharks stay submerged except for a tightly bounded dorsal greeting response, while dolphins finish each porpoising arc back within the local wave. Antarctic and Arctic ecology remain distinct, storms suppress exposed animals, wildlife never enters the Stars view, and every sighting is explicitly non-tactical scenery rather than a contact or sensing clue. Pointer and keyboard greetings change no gameplay state. Surface and depth coordinate models remain available to camera telemetry and Plot Data, but their former graph-paper helper lines are deliberately non-painting in both WebGL and fallback renderers.
- Progressive disclosure keeps current conditions, current decisions, and the next action visible while mission detail, reference material, reports, scoring breakdowns, and long Academy reading begin collapsed behind keyboard-native summaries
- Six committed command turns in which formation, posture, sensing, tempo, uncrewed employment, undersea employment, and tasking alter range, contact quality, readiness, supply, escalation, objective progress, opposing cohesion, and the umpire record
- A bounded compound-uncertainty model with precommitted internal draws, severe-weather and institutional disruptions, multiple or emergent objectives, opposing cooperation, and independent opportunist actors. Ordinary turns never preview adjudication: after resolution they give one concise learning note, distinguishing a correctable play pattern from an unfavorable result with no clear mistake indicated. The Field Guide explains the model in plain language without presenting internal draws as measured real-world odds
- Environment-sensitive operational frames distinguish fleet action (guerre d’escadre) from communications pressure (guerre de course), offensive initiative from defensive preservation, four naval-drone employment patterns, and independent patrol, coordinated wolfpack, barrier-ambush, and protective-screen undersea methods
- A pre-command readiness review, exact one-turn undo, and a final debrief that distinguishes correctable patterns from unfavorable uncertainty, with optional score components, diagnostic evidence, one adjustment per supported finding, related lesson links, and the complete turn timeline
- Scenario-specific open-water, restricted-water, heavy-weather, and specialist lane-opening profiles that reward different force mixes and expose an explicit environment-fit score
- Fog-of-war reports expose only the contact quality earned by the player’s compatible fictional force and orders; identical state and orders always resolve identically, with no die roll
- Unknown air, surface, and subsurface plot markers are independently gated by mission-credited, compatible detection capability in the selected force. Unsupported or unhosted selections reveal nothing, and visible markers remain bounded, abstract indications of uncertainty rather than identities or opposing composition
- Strategic end-state, two-theory, comparative-maritime-lens, and political-guardrail checks; optional synthesis and commander’s prose are preserved for self-analysis and never scored
- Ordered strategic disclosure: warfare identification unlocks the end-state choice, then primary theory, second theory, guardrail, and finally optional writing; force design similarly unlocks aviation and mission packs from compatible hosts
- Three academy paths: Grand Strategy, Foundations, and Advanced Analysis
- Twenty-five original modules, including dedicated uncrewed-maritime, undersea-campaign, risk, multi-adversary, littoral-safeguarding, and compound-uncertainty studies, optional saved progress, knowledge checks, seminar prompts, full-work reading references, near-contemporary contrasts, and a thinker-combination notebook
- A required pregame choice between session-only play and opt-in browser saving
- Multiple named browser-save slots with a keyboard-accessible scrolling game picker
- Data-minimized browser saving that excludes free-form analysis by default, with an explicit per-slot inclusion policy that survives reload, preserves opted-in prose during later automatic saves, safely infers the policy for older prose-containing slots, and includes an unencrypted-storage disclosure
- Human-readable `.txt` export containing difficulty, the complete fixed environment, decisions, force design, every disclosed command turn, written logic, assumptions, termination criteria, and umpire notes; active-game exports withhold unrevealed committed events inside an encoded resume block, while completed exports disclose the full record
- Local `.txt` import, new-game controls, and a two-step reset for all browser data
- Keyboard access to every game action, including orbit, zoom, view switching, and numeric orientation feedback for the tactical plot
- Named phase regions, concise phase announcements, semantic condition and readiness pairs, named force lists, described command controls, restrained live status, modal focus containment, and an Academy tab-and-quiz model designed for screen-reader navigation
- A mobile progressive-disclosure navigator with persistent 100-point and decision-completion readouts. Its readable, scrollable drawer provides the current workspace destinations plus Academy, Save / Load, Field Guide, Credits, and Sound Settings at every phase; choosing any destination closes the drawer and transfers focus as one atomic transition. Plot Data, Sky Data, Star or Subsurface Data, and the Contact Key remain mutually exclusive and closable. Each expanded glass card is capped at 22% of the plot or 150 pixels, while its transparent positioning wrapper cannot blur, tint, or intercept the central sky and sea
- No analytics or tracker code, plus a restrictive content security policy that blocks third-party scripts, frames, images, fonts, and network connections

The in-game Field Guide links to three release-bundled player references: **How the game works**, **Security, privacy, and saves**, and **Accessibility and controls**. These are deployable with the static build. Internal product-research artifacts such as personas, journey maps, service blueprints, and roadmaps remain developer documentation and are not exposed as player help.

The academy is an original independent synthesis grounded in established primary and secondary literature. It does not provide academic credit or certification.

## Publish with GitHub Pages

The repository includes a GitHub Actions workflow that validates, builds, and publishes `dist/` whenever `main` changes. Keep the Vite source at the repository root; do not flatten generated `dist` files into it. The exact repository, Pages, Hover DNS, custom-domain, bundled-document, and hosting-header procedure is in [`DEPLOY-GITHUB-PAGES.md`](DEPLOY-GITHUB-PAGES.md).

## Run the downloaded copy locally

No online repository, account, publishing step, package installation, or Live Server extension is
required. Fully extract the ZIP, open the folder containing `package.json` in VSCodium, and run:

```bash
npm run play
```

`npm start` is an equivalent shortcut. Both commands use a zero-dependency Node.js launcher to
serve only the included optimized `dist` release at `http://127.0.0.1:5173/`. The launcher binds
only to the loopback interface, applies the release’s content security, referrer, permissions,
framing, resource, and MIME-sniffing headers, disables browser caching, and makes no external
request. It does not open the browser automatically; enter the exact printed address yourself.

The fixed address preserves one browser-storage origin between sessions. If port `5173` is already
occupied, the launcher stops with a clear message. It never terminates another process or silently
chooses another port. Stop the older server with **Control+C**, then run the command again.

For the shortest VSCodium procedure, read `START-HERE.md`. The included `.vscode/tasks.json`
exposes **Fog of Sea: play bundled local release** under **Terminal → Run Task**.

Do not use a Live Server extension on the source folder: it cannot compile the TypeScript source
and does not reproduce the release security headers. Do not double-click `dist/index.html` because
browser `file://` module and storage behavior is unreliable.

## Local development

Prerequisites: Node.js `>=22.13.0` and npm. The build is a Vite static-site build and does not require a particular desktop operating system.

The included `.vscode/tasks.json` exposes locked installation, source editing, building, preview,
and local release play commands under **Terminal → Run Task** in VSCodium.

```bash
npm ci
npm run dev
```

The development command always uses `http://127.0.0.1:5173/`. It deliberately stops with a clear port-in-use error rather than silently opening an older extraction on `5173` and moving the new one to another port. Stop any earlier local server with `Control+C`, then rerun the command from the newly extracted folder. After source changes, run `npm run build` before returning to `npm run play`.

Useful checks:

```bash
npm run check
npm run test:browser
```

`npm run check` validates and lists the desktop/mobile browser behavior suite without requiring a browser download. `npm run test:browser` executes its focus, keyboard, privacy-persistence, reduced-motion, reflow, target-size, and local-request assertions when a compatible Playwright browser is installed.

`npm run build` writes a self-contained browser release to `dist/`. It contains no remote application server or database. The local launcher reads the `_headers` file copied from `public/` and applies those policies to every local response. Static hosts that support that format can apply it directly; other hosts must translate those headers into their own configuration.

`RELEASE_QA.md` records the acceptance evidence and the limits of the local release review. `ACCESSIBILITY.md` documents keyboard behavior, screen-reader structure, visual accommodations, and the explicit limits of the current automated evidence. `SECURITY.md` documents the input trust boundary, local storage, response policy, and remaining limits. `PLAYTEST_PROTOCOL.md` provides the human comprehension instrument for testing whether players understand force fit instead of chasing a score; it does not fabricate participant findings.

The [product, UX, and design documentation suite](docs/design/README.md) specifies the as-built design-system architecture, visual and motion language, information architecture, complete interaction model, persuasive and emotional design, persona journeys and empathy maps, local-first service blueprint, UX roadmap, security/privacy/TXT lifecycle, graphics and decision logic, Gestalt analysis, informative microcopy, heuristic evaluation, and requirement traceability. Roadmap material and research hypotheses are explicitly separated from implemented or observed behavior.

The app writes nothing to browser storage until the player explicitly enables saving. When enabled, named games, turn state, decision history, theme, and academy progress stay in browser `localStorage`. Free-form rationale, assumptions, theory synthesis, and termination notes are excluded from browser saves by default; the player may explicitly include them. That choice is stored with the individual save slot and restored before any later automatic save, preventing an opted-in slot from being silently minimized after reload. Browser storage is unencrypted and may be readable by anyone with access to the same browser profile. Session-only play retains data only in memory. The app requires no database, account, analytics, tracker, or external API. Portable text saves always include the player's written analysis and are generated and read on the user's device. The browser release initiates no telemetry or third-party asset requests. Installing packages contacts the configured npm registry, and a hosting provider may still receive ordinary HTTP request metadata while serving the static files; FOG OF SEA sends it no game decisions, save contents, or telemetry.

## Dependency and license policy

All direct versions are exact and the lockfile records integrity hashes. The general dependency allowlist contains approved permissive code licenses. Jost's OFL-1.1 font license and the build-time `caniuse-lite` CC-BY-4.0 data license are reviewed, package-and-version-specific font/data exceptions. Missing declarations, new exceptions, prohibited package families, mutable direct ranges, non-registry resolutions, and incomplete notices fail `npm run verify:licenses`.

After any dependency change, regenerate and verify the human- and machine-readable records:

```bash
npm run notices
npm run sbom
npm run audit:dependencies
npm run check
```

`THIRD_PARTY_NOTICES.md` inventories every locked package and is copied to `public/third-party-notices.txt` for the static release. `THIRD_PARTY_LICENSES.txt` reproduces the installed license and notice files; `public/third-party-licenses.txt` carries the complete runtime subset into `dist/`. `SBOM.spdx.json` records the complete locked graph, while `SBOM.production.spdx.json` records the static browser runtime subset. The generators have no third-party dependencies.

## Evidence limits

The simulation is a teaching model, not a forecast, readiness assessment, targeting tool, current doctrine, or operational recommendation. Scores describe compliance with its invented rules only. The umpire never evaluates the quality, style, length, or wording of player writing.

## Technology

Vite, React, Three.js, Astronomy Engine, standards-based CSS, and the self-hosted Jost variable font. Audio is generated at runtime by original Web Audio code; no recordings, samples, or remote media are bundled. See `THIRD_PARTY_NOTICES.md`, `THIRD_PARTY_LICENSES.txt`, and the SPDX files for exact attribution and license records.

## Licensing

FOG OF SEA is **source-available for noncommercial use** under
**PolyForm-Noncommercial-1.0.0**; commercial use requires a separate written license. Separable original documentation and media use **CC-BY-NC-SA-4.0**.
No current source file or function has a permissive commercial-use exception.
See [`LICENSING.md`](LICENSING.md),
[`WORKFLOW-BOUNDARIES.md`](WORKFLOW-BOUNDARIES.md), and
[`LICENSE-MAP.json`](LICENSE-MAP.json) for scope and historical limits.
