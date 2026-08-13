# FOG OF SEA — Product, UX, and Design Documentation

Status: as-built specification with an evidence-based roadmap  
Applies to: local build `2026-08-11-VSCODIUM-13`  
Audience: product design, interaction design, visual design, engineering, security review, accessibility review, facilitation, and playtesting

## Purpose

This suite documents FOG OF SEA as one coherent service: the pre-play privacy choice, generated exercise, planning workflow, force construction, tactical visualization, six-turn command game, adjudication, debrief, Academy, local saving, TXT interchange, accessibility, security, and release evidence.

The documentation distinguishes three kinds of statement:

- **As built** describes behavior implemented in the current source.
- **Design rule** describes a constraint that present and future work must preserve.
- **Roadmap** describes proposed work and is not a claim about the current product.

## Document map

| Document | Question answered |
| --- | --- |
| [01 — Design system architecture](01-DESIGN-SYSTEM-ARCHITECTURE.md) | What are the product layers, contracts, state boundaries, tokens, components, and sources of truth? |
| [02 — Design language](02-DESIGN-LANGUAGE.md) | What should FOG OF SEA look, sound, move, and feel like? |
| [03 — Information architecture](03-INFORMATION-ARCHITECTURE.md) | How is the experience organized, named, disclosed, and navigated? |
| [04 — Interaction design](04-INTERACTION-DESIGN.md) | How does every major workflow behave, including errors, recovery, mobile, keyboard, and assistive use? |
| [05 — Persuasive and emotional design](05-PERSUASIVE-EMOTIONAL-DESIGN.md) | What behaviors and emotions does the design cultivate, and what ethical limits apply? |
| [06 — Personas and journey maps](06-PERSONAS-AND-JOURNEYS.md) | Who is likely to use the product and how does each journey succeed or fail? |
| [07 — Service blueprint](07-SERVICE-BLUEPRINT.md) | What frontstage, backstage, support, evidence, and recovery activity enables the experience? |
| [08 — UX roadmap](08-UX-ROADMAP.md) | What is complete, what evidence is missing, and what should be improved next? |
| [09 — Security, privacy, and TXT interchange](09-SECURITY-PRIVACY-TXT.md) | What crosses a trust boundary, what is stored, what is exported, and how is untrusted input rejected? |
| [10 — Gameplay, graphics, matrices, and decision logic](10-GAMEPLAY-GRAPHICS-DECISION-LOGIC.md) | How do generated conditions, graphics, force credit, uncertainty, turns, score, and feedback fit together? |
| [11 — Traceability and review checklists](11-TRACEABILITY.md) | Where is each promise implemented and how is it verified? |
| [12 — Gestalt analysis](12-GESTALT-ANALYSIS.md) | How do figure–ground, grouping, continuation, closure, common fate, and focal hierarchy shape perception? |
| [13 — Empathy maps](13-EMPATHY-MAPS.md) | What might each likely player say, think, do, and feel—and which hypotheses require research? |
| [14 — Informative microcopy](14-INFORMATIVE-MICROCOPY.md) | How should labels, guidance, blocked states, errors, privacy, uncertainty, and recovery be written? |
| [15 — Heuristic evaluation](15-HEURISTIC-EVALUATION.md) | Where does the current experience meet or risk violating established usability and product-specific heuristics? |

## Product definition

FOG OF SEA is an independent fictional educational browser simulation about evidence-led maritime strategy. It is a static, local-first application with no account, application server, advertising, or gameplay telemetry. It combines:

- a generated and coexistence-validated fictional exercise;
- an ordered strategy and force-design workflow;
- a five-layer low-poly tactical visualization;
- a deterministic six-turn rigid umpire with precommitted uncertainty;
- a diagnostic debrief and original Academy;
- session-only, opt-in browser-save, and portable human-readable TXT modes.

It is a teaching model, not a forecast, readiness assessment, targeting tool, current doctrine, or operational recommendation.

## Experience principles

1. **Evidence before action.** Ask the player to identify the problem before optimizing the force.
2. **Purpose before spectacle.** Graphics establish atmosphere, depth, and orientation while preserving foreground and information hierarchy.
3. **Progressive disclosure before compression.** Reveal the next meaningful decision; do not expose every control at once.
4. **Uncertainty without deception.** Conceal only what the rules identify as unrevealed; disclose ranges, causes, and commitments.
5. **Determinism with accountability.** Identical state and orders produce identical results, and undo cannot reroll a turn.
6. **Fiction without false authority.** Invented names, values, sectors, procedures, and outcomes remain visibly fictional.
7. **Local control by default.** The player chooses whether browser persistence exists and whether free-form writing enters it.
8. **Beauty as sustained attention.** A cozy-sublime visual world makes difficult reflection approachable without trivializing consequence.
9. **Accessibility as behavior.** Keyboard, semantic, reduced-motion, forced-color, and narrow-layout equivalents are release requirements.
10. **Repair over punishment.** The debrief connects cause to evidence to one feasible adjustment.

## Source-of-truth order

When documents and implementation differ, resolve the difference in this order:

1. executable state and validation logic;
2. tests and release checks;
3. security and accessibility specifications;
4. this design suite;
5. descriptive marketing copy.

Any intentional change must update all affected layers in the same release.
