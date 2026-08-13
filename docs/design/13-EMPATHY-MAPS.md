# 13 — Empathy Maps

These maps turn the hypothesis personas in [06 — Personas and journey maps](06-PERSONAS-AND-JOURNEYS.md) into design prompts. Statements are plausible hypotheses to test, not quotations from completed research.

## 1. Cozy-curious strategy learner

| Says | Thinks |
| --- | --- |
| “This is beautiful, but what am I supposed to do first?” | “I do not want to reveal that I do not know the vocabulary.” |
| “Why doesn’t this aircraft count?” | “Maybe the system is punishing a rule I never saw.” |
| “Can I undo this?” | “I will experiment if failure is reversible and explained.” |

| Does | Feels |
| --- | --- |
| Rotates the scene before reading the full brief | Wonder, then possible overload |
| Chooses Guided mode and follows the next-step prompt | Relief when progression is explicit |
| Adds visually appealing units before understanding hosting | Frustration when credit stays at zero |
| Opens a related lesson after debrief | Curiosity if the result feels nonjudgmental |

**Pains:** unfamiliar terminology, dense cards, hidden prerequisites, score fixation.  
**Gains:** a legal force, a causal explanation, a beautiful world, one achievable adjustment.  
**Needs from design:** plain-language definitions, ordered disclosure, local repair copy, safe undo, evidence-linked debrief.  
**Research question:** Can the player explain selected versus hosted versus credited after one blocked selection?

## 2. Experienced strategy gamer

| Says | Thinks |
| --- | --- |
| “Show me what actually changed the outcome.” | “I need to know whether this is a system or a disguised random roll.” |
| “I want to retry the same conditions.” | “A different result from identical orders would break trust.” |
| “What is concealed, and what simply does not exist?” | “The information model matters as much as the force model.” |

| Does | Feels |
| --- | --- |
| Selects Challenge and inspects range/threshold language | Skeptical, analytical |
| Tests catalog edge cases and substitutions | Engaged by coherent constraints |
| Undoes and repeats an order | Reassured by deterministic replay |
| Compares timeline deltas and score components | Mastery when causality is inspectable |

**Pains:** decorative opacity, generic advice, slow re-entry, unexplained abstraction.  
**Gains:** deterministic depth, viable alternate builds, auditable uncertainty, compact comparative evidence.  
**Needs from design:** inspectable ranges, explicit no-reroll commitment, fast keyboard paths, rich but bounded debrief.  
**Research question:** Does the player distinguish a committed uncertain result from a result generated after the order?

## 3. Educator or facilitator

| Says | Thinks |
| --- | --- |
| “Explain your reasoning before the readiness screen appears.” | “I need evidence of learning, not evidence of clicking.” |
| “What can we infer from this one play?” | “Participants may mistake an internal score for a real-world probability.” |
| “Use session-only mode.” | “I should not collect more participant data than the activity requires.” |

| Does | Feels |
| --- | --- |
| Assigns contrasting scenarios or same-scenario retries | Responsible for framing |
| Uses optional prose and seminar prompts | Interested in mental models |
| Exports a local record for discussion | Cautious about identifiable writing |
| Uses Cause → Evidence → Adjustment | Satisfied when discussion remains bounded |

**Pains:** overclaiming, inconsistent setup, score chasing, privacy burden.  
**Gains:** reproducible discussion, visible assumptions, a complete turn record, related readings.  
**Needs from design:** facilitation guidance, evidence limits, local portability, unscored writing, deterministic comparison.  
**Research question:** Can a facilitator state what one play supports and what it cannot establish?

## 4. Accessibility-first player

| Says | Thinks |
| --- | --- |
| “Where did focus go?” | “If the phase changed, I need a reliable new starting point.” |
| “What does the canvas currently show?” | “The text alternative must describe state, not decorative implementation trivia.” |
| “Stop the motion without removing the atmosphere.” | “Reduced motion should not mean reduced information.” |

| Does | Feels |
| --- | --- |
| Uses the phase-aware skip link and native controls | Oriented when landmarks are stable |
| Opens and closes several dialogs | Anxious if focus restoration is uncertain |
| Changes view with labelled buttons rather than gestures | Included when all layers are reachable |
| Chooses Visualization from the compact menu | Confident when the sheet disappears and focus reaches the plot immediately |
| Uses Page Up/Down in the debrief | Efficient when long review has structure |

**Pains:** focus loss, repetitive announcements, unnamed values, canvas-only meaning, clipped compact surfaces, or a menu that remains over the selected workspace.  
**Gains:** full independent completion, stable landmarks, concise alternatives, equivalent rest states.  
**Needs from design:** semantic regions, contained/restored focus, finite announcements, forced-color/reduced-motion/fallback completeness.  
**Research question:** Can the full privacy-to-debrief journey be completed and understood without seeing or manipulating the canvas?

## 5. Privacy and security-conscious evaluator

| Says | Thinks |
| --- | --- |
| “What is written before I consent?” | “Local does not automatically mean private or secure.” |
| “Is the encoded block encrypted?” | “The interface should not make a confidentiality claim it cannot support.” |
| “What happens if I alter a committed draw?” | “Replay integrity is the actual trust boundary.” |

| Does | Feels |
| --- | --- |
| Chooses session-only and inspects storage | Skeptical but methodical |
| Exports and reads the TXT | Reassured by transparency; alert to prose inclusion |
| Attempts malformed or tampered imports | Trusting only after atomic rejection |
| Reviews headers, notices, and software bills of materials | Confident when limits remain explicit |

**Pains:** vague “privacy-first” claims, encoded-data ambiguity, silent persistence, partial import failure.  
**Gains:** informed choice, data minimization, portable ownership, reproducible rejection.  
**Needs from design:** timely disclosure, precise language, no pre-consent writes, canonical replay, bounded residual-risk statement.  
**Research question:** After one session, can the evaluator accurately describe memory, localStorage, TXT, encoding, and hosting metadata?

## 6. Returning systems explorer

| Says | Thinks |
| --- | --- |
| “Which save was the one with the ice corridor?” | “I need enough metadata to choose without opening each slot.” |
| “What was my reasoning last time?” | “My prose policy must not change silently between saves.” |
| “Let me compare this force with the previous one.” | “Re-entering the whole workflow should not be the cost of iteration.” |

| Does | Feels |
| --- | --- |
| Scans operation, exercise, and timestamp in the save picker | Confident when slots are distinct |
| Returns to an exact strategy/force/command phase | Reoriented by recap and focus |
| Retries the same scenario with a substitution | Curious and systematic |
| Maintains Academy progress and portable TXT copies | Ownership over a local body of work |

**Pains:** ambiguous slot names, lost phase, stale recap, accidental prose-policy change.  
**Gains:** fast re-entry, exact continuity, meaningful comparison, durable portable record.  
**Needs from design:** discriminating save metadata, phase restoration, concise recap, same-scenario retry, explicit slot policy.  
**Research question:** Can the player resume the intended game and explain its current decision state after a two-week gap?

## 7. Cross-persona empathy tensions

| Tension | Design resolution |
| --- | --- |
| Learner wants simplicity; expert wants inspectability | Progressive disclosure with analytical details and TXT record |
| Visual explorer wants spectacle; accessibility-first player needs stability | Rich default scene plus complete reduced-motion and textual models |
| Facilitator wants records; privacy evaluator wants minimization | Session-only by default path, explicit local export, per-slot prose policy |
| Returning player wants speed; first-time player needs explanation | Restore exact phase; preserve contextual notes; keep Guided mode optional |
| Gamer wants uncertainty; educator wants bounded claims | Precommitted ranges and explicit evidence limits |

## 8. Empathy-to-requirement translation

Before accepting a design change, ask:

- What might a player say publicly while thinking something more vulnerable?
- What behavior could be misread as confusion when it is actually trust-testing?
- Which emotion is useful to the learning goal, and which is accidental friction?
- Does the interface repair uncertainty at the point where the player feels it?
- Whose journey becomes harder when efficiency, spectacle, density, or persistence increases?
- What observation would disconfirm this empathy-map hypothesis?
