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
import {
  deriveAcademyGuidance,
  type AcademyGameplayPhase,
  type AcademyScenarioContext,
  type AcademyWorkspaceView,
} from "./academyGuidance";
import type { TheoryLens } from "./gameModel";

type AcademyView = "course" | "compare" | "sources";

type AcademyProps = {
  initialModuleId?: string;
  onClose: () => void;
  completed: string[];
  onCompletedChange: (completed: string[]) => void;
  savingEnabled: boolean;
  scenario: AcademyScenarioContext;
  gameplayPhase: AcademyGameplayPhase;
  workspaceView: AcademyWorkspaceView;
  selectedLens: TheoryLens | "";
  selectedPartnerLens: TheoryLens | "";
};

function pathCoveringGuidance(moduleIds: readonly string[]): AcademyPath {
  const guidedModules = ACADEMY_MODULES.filter((module) => moduleIds.includes(module.id));
  return PATHS.find((candidate) => guidedModules.every((module) => module.paths.includes(candidate.id)))?.id
    || guidedModules[0]?.paths[0]
    || "grand";
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
  selectedLens,
  selectedPartnerLens,
}: AcademyProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const scrollSurfaceRef = useRef<HTMLDivElement>(null);
  const lessonHeadingRef = useRef<HTMLHeadingElement>(null);
  const viewTabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const onCloseRef = useRef(onClose);
  const [guidanceContext] = useState(() => ({
    scenario,
    gameplayPhase,
    workspaceView,
    selectedLens,
    selectedPartnerLens,
  }));
  const guidance = useMemo(() => deriveAcademyGuidance(guidanceContext), [guidanceContext]);
  const explicitInitialModule = ACADEMY_MODULES.find((module) => module.id === initialModuleId);
  const guidedInitialModule = ACADEMY_MODULES.find((module) => module.id === guidance.primaryModuleId);
  const initialModule = explicitInitialModule || guidedInitialModule;
  const [path, setPath] = useState<AcademyPath>(
    pathCoveringGuidance([
      ...guidance.defaultExpandedModuleIds,
      ...(explicitInitialModule ? [explicitInitialModule.id] : []),
    ]),
  );
  const [view, setView] = useState<AcademyView>("course");
  const [activeId, setActiveId] = useState(initialModule?.id || "strategy-grammar");
  const [expandedLessonIds, setExpandedLessonIds] = useState<Set<string>>(() => new Set([
    ...guidance.defaultExpandedModuleIds,
    ...(explicitInitialModule ? [explicitInitialModule.id] : []),
  ]));
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [comparePrimary, setComparePrimary] = useState("Mahan");
  const [comparePartner, setComparePartner] = useState("Théophile Aube");
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
    const focusTimer = window.setTimeout(() => lessonHeadingRef.current?.focus(), 0);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [initialModuleId]);

  const modules = useMemo(() => ACADEMY_MODULES.filter((module) => module.paths.includes(path)), [path]);
  const active = ACADEMY_MODULES.find((module) => module.id === activeId) ?? modules[0];
  const activeIndex = modules.findIndex((module) => module.id === active.id);
  const completedInPath = modules.filter((module) => completed.includes(module.id)).length;
  const progress = Math.round((completedInPath / modules.length) * 100);
  const views: AcademyView[] = ["course", "compare", "sources"];
  const suggestedModuleIds = useMemo(
    () => new Set(guidance.defaultExpandedModuleIds),
    [guidance.defaultExpandedModuleIds],
  );

  const selectView = (next: AcademyView) => {
    setView(next);
    scrollSurfaceRef.current?.scrollTo({ top: 0 });
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

  const activeSuggested = suggestedModuleIds.has(active.id);

  return (
    <div className="academy-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        className="academy"
        role="dialog"
        aria-modal="true"
        aria-labelledby="academy-title"
        aria-describedby="academy-independence academy-guidance-copy"
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
            <button ref={(node) => { viewTabRefs.current[0] = node; }} id="academy-view-course" type="button" role="tab" aria-selected={view === "course"} aria-controls="academy-panel-course" tabIndex={view === "course" ? 0 : -1} className={view === "course" ? "active" : ""} onKeyDown={(event) => moveViewTab(event, 0)} onClick={() => selectView("course")}>LESSONS</button>
            <button ref={(node) => { viewTabRefs.current[1] = node; }} id="academy-view-compare" type="button" role="tab" aria-selected={view === "compare"} aria-controls="academy-panel-compare" tabIndex={view === "compare" ? 0 : -1} className={view === "compare" ? "active" : ""} onKeyDown={(event) => moveViewTab(event, 1)} onClick={() => selectView("compare")}>COMPARE</button>
            <button ref={(node) => { viewTabRefs.current[2] = node; }} id="academy-view-sources" type="button" role="tab" aria-selected={view === "sources"} aria-controls="academy-panel-sources" tabIndex={view === "sources" ? 0 : -1} className={view === "sources" ? "active" : ""} onKeyDown={(event) => moveViewTab(event, 2)} onClick={() => selectView("sources")}>SOURCES &amp; SCOPE</button>
          </div>
          <button className="academy-close" type="button" onClick={onClose} aria-label="Close academy">×</button>
        </header>

        <div id="academy-independence" className="academy-independence" role="note">
          Original independent curriculum · reading and analysis · no account, academic credit, or certification · {savingEnabled ? "progress included in this browser save" : "progress is session-only"}
        </div>

        <div ref={scrollSurfaceRef} className="academy-scroll-surface">
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
                {modules.map((module) => (
                  <button
                    type="button"
                    key={module.id}
                    aria-current={active.id === module.id ? "page" : undefined}
                    className={`${active.id === module.id ? "active" : ""} ${suggestedModuleIds.has(module.id) ? "suggested" : ""}`.trim()}
                    data-academy-suggested={suggestedModuleIds.has(module.id) ? "true" : undefined}
                    data-academy-module-id={module.id}
                    onClick={() => selectModule(module.id)}
                  >
                    <i className={completed.includes(module.id) ? "complete" : ""}>{completed.includes(module.id) ? "✓" : module.number}</i>
                    <span>
                      <strong>{module.title}</strong>
                      <small>{module.era} · {module.level}</small>
                      {suggestedModuleIds.has(module.id) && <b className="module-suggestion">SUGGESTED NOW</b>}
                    </span>
                  </button>
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

              <details className="lesson-objectives">
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
                  : activeSuggested
                    ? "LESSON · SUGGESTED FOR THIS CONTEXT"
                    : "LESSON · READ WHEN READY"}</summary>
                {active.lesson.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </details>

              <details className="academy-disclosure">
                <summary>KEY CONCEPTS · {active.concepts.length}</summary>
              <div className="concept-grid">
                {active.concepts.map((concept) => <section key={concept.term}><span>{concept.term}</span><p>{concept.definition}</p></section>)}
              </div>
              </details>

              <details className="academy-disclosure">
                <summary>COMMON MISREADING &amp; GAME APPLICATION</summary>
              <div className="critical-grid">
                <section><span>COMMON MISREADING</span><p>{active.misreading}</p></section>
                <section><span>APPLY TO THE GAME</span><p>{active.application}</p></section>
              </div>
              </details>

              <details className="seminar-prompt">
                <summary>SEMINAR QUESTION</summary><p>{active.discussion}</p>
              </details>

              <section className="knowledge-check">
                <div><span>KNOWLEDGE CHECK</span>{completed.includes(active.id) && <b>COMPLETE ✓</b>}</div>
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
              </section>

              <details className="reading-list">
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
