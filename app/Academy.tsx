"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { containDialogTab } from "./dialogFocus";
import {
  ACADEMY_MODULES,
  PATHS,
  SOURCE_GROUPS,
  THINKER_CLUSTERS,
  THINKER_COMPARISON,
  type AcademyPath,
} from "./academyData";
import { INPUT_LIMITS, sanitizeAcademyNote } from "./inputSecurity";
import { latticeCopy } from "./latticeCopy";
import { ACADEMY_STRATEGY_DECISION_ATOMS, type AcademyDecisionAtomId } from "./academyDecisionAtoms";
import {
  deriveAcademyGuidance,
  type AcademyGameplayPhase,
  type AcademyScenarioContext,
  type AcademyWorkspaceView,
} from "./academyGuidance";
import { academyLessonAtoms } from "./academyTheoryAtoms";
import type { TheoryLens, Warfare } from "./gameModel";
import { END_STATES, GUARDRAILS, WARFARE } from "./strategicDecisionOptions";

type AcademyView = "guide" | "course" | "compare" | "sources";

type AcademyProps = {
  initialModuleId?: string;
  onClose: () => void;
  completed: string[];
  onCompletedChange: (completed: string[]) => void;
  savingEnabled: boolean;
  scenario: AcademyScenarioContext;
  gameplayPhase: AcademyGameplayPhase;
  workspaceView: AcademyWorkspaceView;
  selectedWarfare: readonly Warfare[];
  selectedLens: TheoryLens | "";
  selectedPartnerLens: TheoryLens | "";
};

function pathCoveringGuidance(moduleIds: readonly string[]): AcademyPath {
  const guidedModules = ACADEMY_MODULES.filter((module) => moduleIds.includes(module.id));
  return PATHS.find((candidate) => guidedModules.every((module) => module.paths.includes(candidate.id)))?.id
    || guidedModules[0]?.paths[0]
    || "grand";
}

const THEORY_COMPARE_NAMES: Readonly<Record<TheoryLens, string>> = {
  "sun-tzu": "Sun Tzu",
  clausewitz: "Clausewitz",
  mahan: "Mahan",
  aube: "Théophile Aube",
  corbett: "Julian Corbett",
  richmond: "Herbert Richmond",
  wegener: "Wolfgang Wegener",
  castex: "Raoul Castex",
  panikkar: "K. M. Panikkar",
  gorshkov: "Sergei Gorshkov",
  "liu-huaqing": "Liu Huaqing",
  till: "Geoffrey Till",
  galula: "David Galula",
};

function DecisionMethod({ atomId }: { atomId: AcademyDecisionAtomId }) {
  if (atomId === "first-phase-warfare") {
    return <p id="academy-strategy-warfare-areas">{latticeCopy("academy.strategy.warfareAreas")}</p>;
  }
  if (atomId === "first-phase-end-state") {
    return <p id="academy-strategy-end-state">{latticeCopy("academy.strategy.endState")}</p>;
  }
  if (atomId === "first-phase-primary-theory") {
    return <p id="academy-strategy-primary-theory">{latticeCopy("academy.strategy.primaryTheory")}</p>;
  }
  if (atomId === "first-phase-partner-theory") {
    return <p id="academy-strategy-complement-theory">{latticeCopy("academy.strategy.complementTheory")}</p>;
  }
  return <p id="academy-strategy-guardrail">{latticeCopy("academy.strategy.guardrail")}</p>;
}

function DecisionOptions({ optionSet }: { optionSet: "warfare" | "end-state" | "guardrail" }) {
  if (optionSet === "warfare") {
    return (
      <ul className="decision-option-list warfare-options" aria-label="Warfare-area definitions">
        {WARFARE.map((option) => <li key={option.id}><b>{option.label}</b><span>{option.detail}</span></li>)}
      </ul>
    );
  }
  const options = optionSet === "end-state" ? END_STATES : GUARDRAILS;
  return (
    <ul className="decision-option-list" aria-label={optionSet === "end-state" ? "End-state options" : "Guardrail options"}>
      {options.map((option) => <li key={option.id}>{option.label}</li>)}
    </ul>
  );
}

export default function Academy({
  initialModuleId,
  onClose,
  completed,
  onCompletedChange,
  savingEnabled,
  scenario,
  gameplayPhase,
  workspaceView,
  selectedWarfare,
  selectedLens,
  selectedPartnerLens,
}: AcademyProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const scrollSurfaceRef = useRef<HTMLDivElement>(null);
  const guideHeadingRef = useRef<HTMLHeadingElement>(null);
  const lessonHeadingRef = useRef<HTMLHeadingElement>(null);
  const viewTabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const onCloseRef = useRef(onClose);
  const [guidanceContext] = useState(() => ({
    scenario,
    gameplayPhase,
    workspaceView,
    selectedWarfare: [...selectedWarfare],
    selectedLens,
    selectedPartnerLens,
  }));
  const guidance = useMemo(() => deriveAcademyGuidance(guidanceContext), [guidanceContext]);
  const explicitInitialModule = ACADEMY_MODULES.find((module) => module.id === initialModuleId);
  const guidedInitialModule = ACADEMY_MODULES.find((module) => module.id === guidance.primaryModuleId);
  const initialModule = explicitInitialModule || guidedInitialModule;
  const explicitInitialAtoms = explicitInitialModule ? academyLessonAtoms(explicitInitialModule) : [];
  const explicitInitialAtomIds = explicitInitialAtoms.length === 1
    ? [explicitInitialAtoms[0].atomId]
    : [];
  const [path, setPath] = useState<AcademyPath>(
    pathCoveringGuidance([
      ...guidance.defaultExpandedModuleIds,
      ...(explicitInitialModule ? [explicitInitialModule.id] : []),
    ]),
  );
  const [view, setView] = useState<AcademyView>(explicitInitialModule ? "course" : "guide");
  const [activeId, setActiveId] = useState(initialModule?.id || "strategy-grammar");
  const [expandedLessonIds, setExpandedLessonIds] = useState<Set<string>>(
    () => new Set(explicitInitialModule ? [explicitInitialModule.id] : []),
  );
  const [expandedLessonAtomIds, setExpandedLessonAtomIds] = useState<Set<string>>(
    () => new Set([...guidance.theoryAtomIds, ...explicitInitialAtomIds]),
  );
  const [expandedDecisionAtomIds, setExpandedDecisionAtomIds] = useState<Set<AcademyDecisionAtomId>>(
    () => new Set(guidance.decisionAtomIds),
  );
  const [expandedGuideTheoryAtomIds, setExpandedGuideTheoryAtomIds] = useState<Set<string>>(
    () => new Set(guidance.theoryAtomIds),
  );
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const compareDefaults = guidance.theoryLenses.map((lens) => THEORY_COMPARE_NAMES[lens]);
  const [comparePrimary, setComparePrimary] = useState(compareDefaults[0] || "Mahan");
  const [comparePartner, setComparePartner] = useState(compareDefaults[1] || "Théophile Aube");
  const [compareNote, setCompareNote] = useState("");

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (dialogRef.current) containDialogTab(event, dialogRef.current);
    };
    const focusTimer = window.setTimeout(
      () => (explicitInitialModule ? lessonHeadingRef.current : guideHeadingRef.current)?.focus(),
      0,
    );
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [initialModuleId, explicitInitialModule]);

  const pathModules = useMemo(() => ACADEMY_MODULES.filter((module) => module.paths.includes(path)), [path]);
  const relevantModuleIds = useMemo(
    () => new Set(guidance.defaultExpandedModuleIds),
    [guidance.defaultExpandedModuleIds],
  );
  const modules = useMemo(() => [
    ...pathModules.filter((module) => relevantModuleIds.has(module.id)),
    ...pathModules.filter((module) => !relevantModuleIds.has(module.id)),
  ], [pathModules, relevantModuleIds]);
  const relevantModuleCount = modules.filter((module) => relevantModuleIds.has(module.id)).length;
  const active = ACADEMY_MODULES.find((module) => module.id === activeId) ?? modules[0];
  const activeIndex = modules.findIndex((module) => module.id === active.id);
  const completedInPath = modules.filter((module) => completed.includes(module.id)).length;
  const progress = Math.round((completedInPath / modules.length) * 100);
  const views: AcademyView[] = ["guide", "course", "compare", "sources"];
  const relevantAtomIds = useMemo(
    () => new Set(guidance.theoryAtomIds),
    [guidance.theoryAtomIds],
  );
  const activeLessonAtoms = useMemo(() => academyLessonAtoms(active), [active]);
  const relevantTheoryAtoms = useMemo(() => guidance.theoryLenses.flatMap((lens) => {
    const module = ACADEMY_MODULES.find((candidate) => (
      academyLessonAtoms(candidate).some((atom) => atom.theoryLens === lens)
    ));
    const atom = module && academyLessonAtoms(module).find((candidate) => candidate.theoryLens === lens);
    return atom && module ? [{ ...atom, moduleTitle: module.title, premise: atom.paragraphs[0] || "" }] : [];
  }), [guidance.theoryLenses]);
  const phaseFocusModule = ACADEMY_MODULES.find((module) => module.id === guidance.contextModuleIds[0]);

  const selectView = (next: AcademyView) => {
    setView(next);
    scrollSurfaceRef.current?.scrollTo({ top: 0 });
  };
  const openLibraryFromGuide = () => {
    selectView("course");
    window.setTimeout(() => viewTabRefs.current[1]?.focus(), 0);
  };
  const moveViewTab = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? views.length - 1
        : (index + (event.key === "ArrowRight" ? 1 : -1) + views.length) % views.length;
    selectView(views[nextIndex]);
    viewTabRefs.current[nextIndex]?.focus();
  };

  const changePath = (next: AcademyPath) => {
    const nextModules = ACADEMY_MODULES.filter((module) => module.paths.includes(next));
    setPath(next);
    setView("course");
    if (!nextModules.some((module) => module.id === activeId)) setActiveId(nextModules[0].id);
    setSelectedAnswer(null);
    setSubmitted(false);
    scrollSurfaceRef.current?.scrollTo({ top: 0 });
  };

  const selectModule = (id: string) => {
    setActiveId(id);
    setView("course");
    setSelectedAnswer(null);
    setSubmitted(false);
    scrollSurfaceRef.current?.scrollTo({ top: 0 });
    window.setTimeout(() => lessonHeadingRef.current?.focus(), 0);
  };

  const openFullLesson = (moduleId: string, atomId?: string) => {
    const module = ACADEMY_MODULES.find((candidate) => candidate.id === moduleId);
    if (!module) return;
    if (!module.paths.includes(path)) setPath(module.paths[0]);
    setExpandedLessonIds((current) => new Set(current).add(moduleId));
    if (atomId) setExpandedLessonAtomIds((current) => new Set(current).add(atomId));
    selectModule(moduleId);
  };

  const recordCompletion = () => {
    if (selectedAnswer !== active.quiz.correct) return;
    const next = completed.includes(active.id) ? completed : [...completed, active.id];
    onCompletedChange(next);
  };

  const submitAnswer = () => {
    if (selectedAnswer === null) return;
    setSubmitted(true);
    if (selectedAnswer === active.quiz.correct) recordCompletion();
  };

  const move = (direction: -1 | 1) => {
    const nextIndex = Math.min(modules.length - 1, Math.max(0, activeIndex + direction));
    selectModule(modules[nextIndex].id);
  };

  const setLessonExpanded = (moduleId: string, open: boolean) => {
    setExpandedLessonIds((current) => {
      const next = new Set(current);
      if (open) next.add(moduleId);
      else next.delete(moduleId);
      return next;
    });
  };

  const setLessonAtomExpanded = (atomId: string, open: boolean) => {
    setExpandedLessonAtomIds((current) => {
      const next = new Set(current);
      if (open) next.add(atomId);
      else next.delete(atomId);
      return next;
    });
  };

  const setDecisionAtomExpanded = (atomId: AcademyDecisionAtomId, open: boolean) => {
    setExpandedDecisionAtomIds((current) => {
      const next = new Set(current);
      if (open) next.add(atomId);
      else next.delete(atomId);
      return next;
    });
  };

  const setGuideTheoryAtomExpanded = (atomId: string, open: boolean) => {
    setExpandedGuideTheoryAtomIds((current) => {
      const next = new Set(current);
      if (open) next.add(atomId);
      else next.delete(atomId);
      return next;
    });
  };

  const relevanceLabel = (moduleId: string) => (
    guidance.theoryModuleIds.includes(moduleId)
      ? guidance.theoryRelevanceLabel
      : guidance.contextRelevanceLabel
  );

  const activeRelevant = relevantModuleIds.has(active.id);

  return (
    <div className="academy-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        className="academy"
        role="dialog"
        aria-modal="true"
        aria-labelledby="academy-title"
        aria-describedby="academy-independence academy-summary"
        data-guidance-source={guidance.source}
        data-gameplay-phase={guidanceContext.gameplayPhase}
        data-workspace-view={guidanceContext.workspaceView}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="academy-header">
          <div className="academy-brand">
            <span>INDEPENDENT STRATEGY LAB</span>
            <h2 id="academy-title">THE ACADEMY</h2>
          </div>
          <div className="academy-view-tabs" role="tablist" aria-label="Academy views">
            <button ref={(node) => { viewTabRefs.current[0] = node; }} id="academy-view-guide" type="button" role="tab" aria-selected={view === "guide"} aria-controls="academy-panel-guide" tabIndex={view === "guide" ? 0 : -1} className={view === "guide" ? "active" : ""} onKeyDown={(event) => moveViewTab(event, 0)} onClick={() => selectView("guide")}>NOW</button>
            <button ref={(node) => { viewTabRefs.current[1] = node; }} id="academy-view-course" type="button" role="tab" aria-selected={view === "course"} aria-controls="academy-panel-course" tabIndex={view === "course" ? 0 : -1} className={view === "course" ? "active" : ""} onKeyDown={(event) => moveViewTab(event, 1)} onClick={() => selectView("course")}>LIBRARY</button>
            <button ref={(node) => { viewTabRefs.current[2] = node; }} id="academy-view-compare" type="button" role="tab" aria-selected={view === "compare"} aria-controls="academy-panel-compare" tabIndex={view === "compare" ? 0 : -1} className={view === "compare" ? "active" : ""} onKeyDown={(event) => moveViewTab(event, 2)} onClick={() => selectView("compare")}>COMPARE</button>
            <button ref={(node) => { viewTabRefs.current[3] = node; }} id="academy-view-sources" type="button" role="tab" aria-selected={view === "sources"} aria-controls="academy-panel-sources" tabIndex={view === "sources" ? 0 : -1} className={view === "sources" ? "active" : ""} onKeyDown={(event) => moveViewTab(event, 3)} onClick={() => selectView("sources")}>SOURCES</button>
          </div>
          <button className="academy-close" type="button" onClick={onClose} aria-label="Close academy">×</button>
        </header>

        <div id="academy-independence" className="academy-independence" role="note">
          Original independent curriculum · reading and analysis · no account, academic credit, or certification · {savingEnabled ? "progress included in this browser save" : "progress is session-only"}
        </div>
        <p id="academy-summary" className="visually-hidden">Decision methods use only player-visible mission evidence and do not identify or change scored selections.</p>

        <div ref={scrollSurfaceRef} className="academy-scroll-surface">
          <div id="academy-panel-guide" className="academy-now" role="tabpanel" aria-labelledby="academy-view-guide" hidden={view !== "guide"}>
            <header className="academy-now-heading">
              <span>{guidanceContext.gameplayPhase === "strategy" ? "DECIDE THIS PHASE" : "DECISION SUPPORT"}</span>
              <h3 ref={guideHeadingRef} tabIndex={-1}>{guidanceContext.gameplayPhase === "strategy" ? "A guide to all five strategy questions" : "Revisit the five strategy decisions"}</h3>
              <p>{guidance.explanation}</p>
            </header>

            {phaseFocusModule && (guidanceContext.gameplayPhase !== "strategy" || guidanceContext.workspaceView === "visualization") && (
              <section className="academy-phase-focus" aria-labelledby="academy-phase-focus-title">
                <span>{guidance.contextRelevanceLabel}</span>
                <h4 id="academy-phase-focus-title">{phaseFocusModule.title}</h4>
                <p>{phaseFocusModule.thesis}</p>
                <button type="button" onClick={() => openFullLesson(phaseFocusModule.id)}>OPEN PHASE LESSON</button>
              </section>
            )}

            <section className="phase-support" aria-labelledby="phase-support-title">
              <div className="phase-support-heading">
                <span>FIRST PHASE · METHOD, NOT ANSWERS</span>
                <h4 id="phase-support-title">Five decisions, one visible evidence trail</h4>
                <p>Each section starts open. Collapse what you have settled; reopen any method when you need it.</p>
              </div>
              <ol className="phase-support-list">
                {ACADEMY_STRATEGY_DECISION_ATOMS.map((atom) => (
                  <li key={atom.id}>
                    <details
                      className="phase-support-atom"
                      data-academy-decision-atom={atom.id}
                      open={expandedDecisionAtomIds.has(atom.id)}
                      onToggle={(event) => setDecisionAtomExpanded(atom.id, event.currentTarget.open)}
                    >
                      <summary>
                        <i>{atom.number}</i>
                        <span><small>{atom.group}</small><strong>{atom.title}</strong></span>
                      </summary>
                      <div className="phase-support-content">
                        <h5>{atom.prompt}</h5>
                        <DecisionMethod atomId={atom.id} />
                        <dl className="decision-evidence" aria-label={`Visible evidence for ${atom.title}`}>
                          {atom.evidence.map((evidence) => (
                            <div key={evidence.key}>
                              <dt>{evidence.label}</dt>
                              <dd>{scenario[evidence.key]}</dd>
                            </div>
                          ))}
                        </dl>
                        {atom.optionSet && <DecisionOptions optionSet={atom.optionSet} />}
                      </div>
                    </details>
                  </li>
                ))}
              </ol>
            </section>

            <section className="academy-relevant-theories" aria-labelledby="academy-relevant-theories-title">
              <div>
                <span>RELEVANT THINKERS</span>
                <h4 id="academy-relevant-theories-title">{guidance.theoryRelevanceLabel}</h4>
                <p>{guidance.source === "brief"
                  ? "These premises belong to thinkers explicitly named in the public comparative problem. Their equal presentation is a study aid, not a ranking or answer key."
                  : "These are the two theories you recorded. The Academy repeats them without testing whether either matches the scoring model."}</p>
              </div>
              {relevantTheoryAtoms.length > 0 ? (
                <div className="relevant-theory-list">
                  {relevantTheoryAtoms.map((atom) => (
                    <details
                      key={atom.atomId}
                      className="relevant-theory-atom"
                      data-academy-guide-theory-atom={atom.atomId}
                      open={expandedGuideTheoryAtomIds.has(atom.atomId)}
                      onToggle={(event) => setGuideTheoryAtomExpanded(atom.atomId, event.currentTarget.open)}
                    >
                      <summary><span>{atom.title}</span><b>{guidance.theoryRelevanceLabel}</b></summary>
                      <p>{atom.premise}</p>
                      <button type="button" onClick={() => openFullLesson(atom.moduleId, atom.atomId)}>OPEN FULL LESSON</button>
                    </details>
                  ))}
                </div>
              ) : (
                <p className="academy-no-theory-match">This legacy problem has no exact public-prose mapping. Use the Compare workspace to test mechanisms; no thinker has been inferred from hidden scenario data.</p>
              )}
            </section>

            <details className="academy-optional-map">
              <summary>OPTIONAL WRITTEN ANALYSIS · QUESTION MAP</summary>
              <p>These prompts never affect the score. Reuse the five methods above instead of inventing a separate answer framework.</p>
              <dl>
                <div><dt>Naval-theory synthesis</dt><dd>Use decisions 03–04: mechanism, contribution, contradiction, and resolution.</dd></div>
                <div><dt>Commander&apos;s logic</dt><dd>Use decisions 02–03: desired condition, causal mechanism, and maritime action.</dd></div>
                <div><dt>Key assumptions</dt><dd>Use decision 03: name what must be true and what visible evidence would count against it.</dd></div>
                <div><dt>Termination / transition</dt><dd>Use decisions 02 and 05: observable completion, handoff, and the boundary that still must hold.</dd></div>
              </dl>
            </details>

            <footer className="academy-now-footer">
              <div><span>FULL ACADEMY</span><p>All 25 lessons, comparisons, sources, quizzes, and reading trails remain available on request.</p></div>
              <button type="button" onClick={openLibraryFromGuide}>EXPLORE THE LIBRARY</button>
            </footer>
          </div>

          <nav className="path-tabs" aria-label="Learning path" hidden={view !== "course"}>
            {PATHS.map((item) => (
              <button type="button" key={item.id} aria-current={path === item.id ? "page" : undefined} className={path === item.id ? "active" : ""} onClick={() => changePath(item.id)}>
                <span>{item.label}</span><small>{item.short}</small>
              </button>
            ))}
          </nav>

          <div id="academy-panel-course" className="academy-course" role="tabpanel" aria-labelledby="academy-view-course" hidden={view !== "course"}>
            <aside className="module-rail">
              <div className="path-progress">
                <div><span>{PATHS.find((item) => item.id === path)?.label}</span><strong>{progress}%</strong></div>
                <i role="progressbar" aria-label="Path completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><b style={{ width: `${progress}%` }} /></i>
                <p>{completedInPath} of {modules.length} knowledge checks passed</p>
              </div>
              <nav className="module-list" aria-label="Lessons in this learning path">
                {modules.map((module, index) => (
                  <div className="module-list-item" key={module.id}>
                    {index === 0 && relevantModuleCount > 0 && <h3>RELEVANT TO THIS CONTEXT</h3>}
                    {index === relevantModuleCount && relevantModuleCount < modules.length && <h3>FULL ACADEMY</h3>}
                    <button
                    type="button"
                    aria-current={active.id === module.id ? "page" : undefined}
                    className={`${active.id === module.id ? "active" : ""} ${relevantModuleIds.has(module.id) ? "relevant" : ""}`.trim()}
                    data-academy-relevant={relevantModuleIds.has(module.id) ? "true" : undefined}
                    data-academy-module-id={module.id}
                    onClick={() => selectModule(module.id)}
                  >
                    <i className={completed.includes(module.id) ? "complete" : ""}>{completed.includes(module.id) ? "✓" : module.number}</i>
                    <span>
                      <strong>{module.title}</strong>
                      <small>{module.era} · {module.level}</small>
                      {relevantModuleIds.has(module.id) && <b className="module-suggestion">{relevanceLabel(module.id)}</b>}
                    </span>
                  </button>
                  </div>
                ))}
              </nav>
            </aside>

            <article className="lesson">
              <section className="academy-guidance" role="note" aria-labelledby="academy-guidance-heading">
                <span id="academy-guidance-heading">{guidance.heading.toUpperCase()}</span>
                <p id="academy-guidance-copy">{guidance.explanation}</p>
              </section>

              <div className="lesson-heading">
                <div><span>MODULE {active.number} · {active.level.toUpperCase()}</span><h3 ref={lessonHeadingRef} tabIndex={-1}>{active.title}</h3><p>{active.subtitle}</p></div>
                <div className="lesson-position">{activeIndex + 1}<small>/ {modules.length}</small></div>
              </div>

              <section className="lesson-thesis">
                <span>CORE CLAIM</span><p>{active.thesis}</p>
              </section>

              <details className="lesson-objectives" key={`${active.id}-objectives`}>
                <summary>LEARNING OBJECTIVES · {active.objectives.length}</summary>
                <ol>{active.objectives.map((objective) => <li key={objective}>{objective}</li>)}</ol>
              </details>

              <details
                className="lesson-body"
                data-module-id={active.id}
                open={expandedLessonIds.has(active.id)}
                onToggle={(event) => setLessonExpanded(active.id, event.currentTarget.open)}
              >
                <summary>{explicitInitialModule?.id === active.id
                  ? "LESSON · REQUESTED HELP"
                  : activeRelevant
                    ? "LESSON · RELEVANT TO THIS CONTEXT"
                    : "LESSON · READ WHEN READY"}</summary>
                {activeLessonAtoms.length > 0 ? (
                  <div className="lesson-atom-list">
                    {activeLessonAtoms.map((atom) => {
                      const atomRelevant = relevantAtomIds.has(atom.atomId);
                      return (
                        <details
                          className="lesson-atom"
                          data-academy-atom-id={atom.atomId}
                          data-academy-atom-relevant={atomRelevant ? "true" : undefined}
                          key={atom.atomId}
                          open={expandedLessonAtomIds.has(atom.atomId)}
                          onToggle={(event) => setLessonAtomExpanded(atom.atomId, event.currentTarget.open)}
                        >
                          <summary>
                            <span>{atom.title}</span>
                            {atomRelevant && <b className="lesson-atom-suggestion">{guidance.theoryRelevanceLabel}</b>}
                          </summary>
                          {atom.paragraphs.map((paragraph, index) => (
                            <p key={`${atom.atomId}-${index}`}>{paragraph}</p>
                          ))}
                        </details>
                      );
                    })}
                  </div>
                ) : (
                  active.lesson.map((paragraph) => <p key={paragraph}>{paragraph}</p>)
                )}
              </details>

              <details className="academy-disclosure" key={`${active.id}-concepts`}>
                <summary>KEY CONCEPTS · {active.concepts.length}</summary>
              <div className="concept-grid">
                {active.concepts.map((concept) => <section key={concept.term}><span>{concept.term}</span><p>{concept.definition}</p></section>)}
              </div>
              </details>

              <details className="academy-disclosure" key={`${active.id}-application`}>
                <summary>COMMON MISREADING &amp; GAME APPLICATION</summary>
              <div className="critical-grid">
                <section><span>COMMON MISREADING</span><p>{active.misreading}</p></section>
                <section><span>APPLY TO THE GAME</span><p>{active.application}</p></section>
              </div>
              </details>

              <details className="seminar-prompt" key={`${active.id}-seminar`}>
                <summary>SEMINAR QUESTION</summary><p>{active.discussion}</p>
              </details>

              <details className="knowledge-check" key={`${active.id}-knowledge-check`}>
                <summary>KNOWLEDGE CHECK{completed.includes(active.id) && <b>COMPLETE ✓</b>}</summary>
                <h4>{active.quiz.question}</h4>
                <fieldset className="answer-list">
                  <legend className="visually-hidden">{active.quiz.question}</legend>
                  {active.quiz.options.map((option, index) => (
                    <label
                      key={option}
                      className={`${selectedAnswer === index ? "selected" : ""} ${submitted && index === active.quiz.correct ? "correct" : ""} ${submitted && selectedAnswer === index && index !== active.quiz.correct ? "incorrect" : ""}`}
                    >
                      <input type="radio" name={`quiz-${active.id}`} checked={selectedAnswer === index} onChange={() => { setSelectedAnswer(index); setSubmitted(false); }} />
                      <i>{String.fromCharCode(65 + index)}</i><span>{option}</span>
                    </label>
                  ))}
                </fieldset>
                {submitted && (
                  <p className={selectedAnswer === active.quiz.correct ? "answer-feedback correct" : "answer-feedback incorrect"} role="status" aria-live="polite" aria-atomic="true">
                    <strong>{selectedAnswer === active.quiz.correct ? "Correct." : "Reconsider."}</strong> {active.quiz.explanation}
                  </p>
                )}
                <button className="check-button" type="button" onClick={submitAnswer} disabled={selectedAnswer === null}>CHECK ANSWER</button>
              </details>

              <details className="reading-list" key={`${active.id}-reading-list`}>
                <summary>READING TRAIL · {active.readings.length}</summary>
                <p>Suggested primary and scholarly starting points for independent study.</p>
                <ul>{active.readings.map((reading) => <li key={reading}>{reading}</li>)}</ul>
              </details>

              <footer className="lesson-nav">
                <button type="button" onClick={() => move(-1)} disabled={activeIndex <= 0}>← PREVIOUS</button>
                <span>{active.number} / {modules[modules.length - 1].number}</span>
                <button type="button" onClick={() => move(1)} disabled={activeIndex >= modules.length - 1}>NEXT →</button>
              </footer>
            </article>
          </div>

          <div id="academy-panel-compare" className="academy-reference" role="tabpanel" aria-labelledby="academy-view-compare" hidden={view !== "compare"}>
            <header id="academy-compare-intro"><span>COMPARATIVE METHOD</span><h3>THINKERS IN CONTEXT</h3><p>{latticeCopy("academy.compare.intro")}</p></header>
            <div className="comparison-clusters">
              {THINKER_CLUSTERS.map((cluster) => (
                <section key={cluster.period}>
                  <span>{cluster.period}</span>
                  <h4>{cluster.thinkers}</h4>
                  <p><b>CONTRAST</b>{cluster.contrast}</p>
                  <p><b>POSSIBLE COMBINATION</b>{cluster.synthesis}</p>
                  <p><b>UNRESOLVED TENSION</b>{cluster.unresolved}</p>
                </section>
              ))}
            </div>
            <div
              className="comparison-table-wrap"
              role="region"
              aria-label="Scrollable thinker comparison table"
              aria-keyshortcuts="ArrowLeft ArrowRight"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                event.preventDefault();
                const direction = event.key === "ArrowRight" ? 1 : -1;
                event.currentTarget.scrollLeft += direction * Math.max(80, event.currentTarget.clientWidth * 0.35);
              }}
            >
              <table className="comparison-table">
                <thead><tr><th>Thinker</th><th>Period</th><th>Near-contemporary contrast</th><th>Contribution to a combination</th><th>Unresolved tension</th></tr></thead>
                <tbody>{THINKER_COMPARISON.map((row) => <tr key={row.thinker}><th>{row.thinker}</th><td>{row.period}</td><td><b>{row.contemporary}</b><br />{row.contrast}</td><td>{row.contribution}</td><td>{row.tension}</td></tr>)}</tbody>
              </table>
            </div>
            <section className="comparison-lab">
              <span>SYNTHESIS NOTEBOOK</span>
              <div>
                <label>PRIMARY THEORY<select value={comparePrimary} onChange={(event) => setComparePrimary(event.target.value)}>{THINKER_COMPARISON.map((row) => <option key={row.thinker} value={row.thinker} disabled={row.thinker === comparePartner}>{row.thinker}</option>)}</select></label>
                <label>COMPLEMENT OR CHALLENGE<select value={comparePartner} onChange={(event) => setComparePartner(event.target.value)}>{THINKER_COMPARISON.map((row) => <option key={row.thinker} value={row.thinker} disabled={row.thinker === comparePrimary}>{row.thinker}</option>)}</select></label>
              </div>
              <p>What does {comparePartner} add to {comparePrimary}? Name the historical mismatch, the mechanism retained from each, and the contradiction that must be resolved before the combination can guide a maritime decision.</p>
              <label className="comparison-note">WORKING SYNTHESIS<textarea value={compareNote} maxLength={INPUT_LIMITS.academyNote} onChange={(event) => setCompareNote(sanitizeAcademyNote(event.target.value))} rows={5} placeholder="Build an argued combination, not a collage of quotations…" /></label>
              <small>{compareNote.length} characters · temporary study note; use the game&apos;s naval synthesis field for logic that should appear in a TXT save.</small>
            </section>
            <section className="comparison-method">
              <span>GRADUATE COMPARISON PROTOCOL</span>
              <ol>
                <li>Reconstruct the thinker’s historical problem before borrowing the concept.</li>
                <li>Name the causal mechanism, assumed political order, and relevant level of war.</li>
                <li>First contrast near-contemporaries who faced overlapping technology and political conditions.</li>
                <li>When combining theories, state which mechanism comes from each and how contradictory assumptions are resolved.</li>
                <li>Find a rival theory that predicts a different outcome, then specify evidence, ethical limits, and a condition that would force revision.</li>
              </ol>
            </section>
          </div>

          <div id="academy-panel-sources" className="academy-reference sources-view" role="tabpanel" aria-labelledby="academy-view-sources" hidden={view !== "sources"}>
            <header id="academy-sources-intro"><span>TRANSPARENCY</span><h3>READING ROOM, SCOPE &amp; LIMITS</h3><p>{latticeCopy("academy.sources.intro")}</p></header>
            <div className="source-groups">
              {SOURCE_GROUPS.map((group) => (
                <section key={group.title}>
                  <h4>{group.title}</h4>
                  <ul>{group.items.map((item) => <li key={item.label}>{item.href ? <a href={item.href} target="_blank" rel="noreferrer" aria-label={`${item.label} (opens in a new tab)`}>{item.label} <span aria-hidden="true">↗</span></a> : item.label}</li>)}</ul>
                </section>
              ))}
              <section id="academy-model-boundary">
                <h4>Model and realism boundary</h4>
                <p>{latticeCopy("academy.sources.modelBoundary")}</p>
              </section>
              <section id="academy-independent-status">
                <h4>Independent status</h4>
                <p>{latticeCopy("academy.sources.independentStatus")}</p>
              </section>
              <section id="academy-language-system">
                <h4>Language system</h4>
                <p>{latticeCopy("academy.sources.languageSystem")}</p>
              </section>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
