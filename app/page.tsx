"use client";

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import Academy from "./Academy";
import ConfirmDialog from "./ConfirmDialog";
import CommandPanel from "./CommandPanel";
import ResultDebrief from "./ResultDebrief";
import PrivacyGate from "./PrivacyGate";
import PlanningRecap from "./PlanningRecap";
import PhaseAnnouncement from "./PhaseAnnouncement";
import SaveManager from "./SaveManager";
import Soundscape, { type SoundscapeHandle } from "./Soundscape";
import StrategicDecisionFlow from "./StrategicDecisionFlow";
import { AIRCRAFT, PLATFORMS } from "./catalog";
import {
  ARMAMENTS,
  aircraftAffiliations,
  calculateDecisionCompletion,
  emptyCounts,
  generateScenario,
  hasSelectedAffiliation,
  platformAffiliations,
  restrictCountsToWarfare,
  type AviationKind,
  type EndState,
  type Difficulty,
  type Guardrail,
  type Scenario,
  type TheoryLens,
  type TimeOfDay,
  type Warfare,
} from "./gameModel";
import {
  DEFAULT_RIGID_ORDERS,
} from "./kriegsspiel";
import { formatPortableSave, parsePortableSave, saveFilename, type PortableSave } from "./saveGame";
import { useGameSession, type GameSessionState } from "./useGameSession";
import type { SaveSlotMeta } from "./browserSaves";
import { useBrowserSaveManager } from "./useBrowserSaveManager";
import { beginCommandTransition, resolveCommandTransition, retryCommandTransition, undoCommandTransition } from "./commandPhase";
import { containDialogTab } from "./dialogFocus";
import { deriveContactVisibility } from "./contactVisualization";
import { INPUT_LIMITS, sanitizeSearchQuery } from "./inputSecurity";
import { deriveOperationalStrategy } from "./operationalStrategy";
import { deriveForceReadiness } from "./forceReadiness";
import { cloudCoverLabel, cloudCoverPhrase } from "./weatherPresentation";

const Battlefield = lazy(() => import("./Battlefield"));

const WARFARE: { id: Warfare; label: string; detail: string }[] = [
  { id: "air-defense", label: "Air defence", detail: "Task-group and local air defence" },
  { id: "surface-operations", label: "Surface operations", detail: "Surface detection, tracking, and engagement" },
  { id: "undersea-operations", label: "Anti-submarine operations", detail: "Submarine detection, tracking, and engagement" },
  { id: "land-attack", label: "Land attack", detail: "Conventional effects against objectives ashore" },
  { id: "electromagnetic-operations", label: "Electromagnetic operations", detail: "Detect, identify, protect, deceive, and disrupt" },
  { id: "reconnaissance", label: "Intelligence and reconnaissance", detail: "Situational awareness, reconnaissance, and identification" },
  { id: "mine-countermeasures", label: "Mine countermeasures", detail: "Mine detection, avoidance, and neutralization" },
  { id: "missile-defense", label: "Missile defence", detail: "Task-group defence against long-range missiles" },
  { id: "maritime-interdiction", label: "Maritime interception and safeguarding", detail: "Identification, lawful interception, rescue, evidence custody, and protected handoff" },
];

function warfareAreaNames(areas: Warfare[]) {
  return areas.map((area) => WARFARE.find((item) => item.id === area)?.label || area).join(", ");
}

const END_STATES: { id: EndState; label: string }[] = [
  { id: "access", label: "Preserve reliable access" },
  { id: "protection", label: "Protect noncombatants" },
  { id: "denial", label: "Deny hostile control" },
  { id: "limited-compellence", label: "Compel a limited concession" },
  { id: "status-quo", label: "Restore the status quo" },
];

const THEORY_LENSES: { id: TheoryLens; label: string; note: string }[] = [
  { id: "sun-tzu", label: "Sun Tzu · shape choices", note: "Change information, position, and incentives before destructive commitment." },
  { id: "clausewitz", label: "Clausewitz · political purpose", note: "Scale effort to the value of the political aim and anticipate reciprocal adaptation." },
  { id: "mahan", label: "Mahan · maritime system", note: "Link concentrated sea power to commerce, access, position, and collective capacity." },
  { id: "aube", label: "Aube · asymmetric maritime pressure", note: "Use distributed coastal and commerce pressure to impose costs a stronger fleet cannot ignore." },
  { id: "corbett", label: "Corbett · limited control", note: "Secure the degree of maritime communications needed for the political purpose." },
  { id: "richmond", label: "Richmond · communications and judgment", note: "Connect maritime communications, professional learning, and fleet action to political policy." },
  { id: "wegener", label: "Wegener · position before battle", note: "Test whether geography, access, and bases permit tactical power to produce strategic effect." },
  { id: "castex", label: "Castex · strategic combinations", note: "Combine control, denial, protection, and pressure according to circumstance rather than formula." },
  { id: "panikkar", label: "Panikkar · regional maritime order", note: "Read security through regional routes, coastal exposure, external presence, and political autonomy." },
  { id: "gorshkov", label: "Gorshkov · comprehensive sea power", note: "Link fleets, submarines, industry, science, peacetime presence, and political reach." },
  { id: "liu-huaqing", label: "Liu · phased maritime development", note: "Sequence doctrine, technology, training, industry, access, and defensive depth." },
  { id: "till", label: "Till · maritime order and sea use", note: "Integrate competitive, cooperative, economic, diplomatic, and constabulary uses of the sea." },
  { id: "galula", label: "Galula · political legitimacy", note: "Evaluate security through civilian protection, political order, and legitimacy." },
];

const GUARDRAILS: { id: Guardrail; label: string }[] = [
  { id: "escalation", label: "Limit escalation" },
  { id: "civilian", label: "Protect civilian life and traffic" },
  { id: "coalition", label: "Preserve coalition cohesion" },
  { id: "legitimacy", label: "Preserve political legitimacy" },
  { id: "sustainability", label: "Preserve long-term capacity" },
];

const AVIATION_KIND_LABELS: Record<AviationKind, string> = {
  catapult: "assisted-launch fixed-wing",
  "short-deck": "short-deck fixed-wing",
  rotary: "rotary-wing",
  "uncrewed-fixed-wing": "uncrewed fixed-wing aviation",
  "uncrewed-vertical": "uncrewed vertical-flight aviation",
};

const INITIAL_SCENARIO: Scenario = generateScenario(0, () => 0.31);


const DEFAULT_FLEET = emptyCounts(PLATFORMS);
const DEFAULT_AIR = emptyCounts(AIRCRAFT);
const DEFAULT_ARMAMENTS = emptyCounts(ARMAMENTS);
const DISPLAY_ARMAMENTS = [...ARMAMENTS].sort((a, b) => a.name.localeCompare(b.name));
function Counter({
  value,
  onChange,
  label,
  canAdd,
  disabledReason,
  descriptionId,
  onBlocked,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
  canAdd: boolean;
  disabledReason: string;
  descriptionId: string;
  onBlocked: (message: string) => void;
}) {
  return (
    <div className="counter" role="group" aria-label={`${label}: ${value}`}>
      <button type="button" disabled={value === 0} onClick={() => onChange(Math.max(0, value - 1))} aria-label={`Remove one ${label}`}>−</button>
      <span>{value}</span>
      <button
        type="button"
        aria-disabled={!canAdd}
        aria-describedby={descriptionId}
        title={canAdd ? `Add one ${label}` : disabledReason}
        onClick={() => canAdd ? onChange(Math.min(99, value + 1)) : onBlocked(disabledReason)}
        aria-label={canAdd ? `Add one ${label}` : `Cannot add ${label}: ${disabledReason}`}
      >+</button>
    </div>
  );
}

function BrandIcon() {
  return (
    <svg className="brand-icon" data-brand-symbol="bull-pointed-anchor" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <polygon className="icon-ground" points="4,4 60,4 60,60 4,60" />
      <g className="brand-bull">
        <polygon className="icon-horn" points="8,15 25,21 20,28" />
        <polygon className="icon-horn" points="44,28 39,21 56,15" />
        <polygon className="icon-face-a" points="20,22 32,17 44,22 40,45 32,53 24,45" />
        <polygon className="icon-face-b" points="20,22 32,31 24,45" />
        <polygon className="icon-face-c" points="44,22 40,45 32,31" />
        <polygon className="icon-muzzle" points="25,43 32,39 39,43 36,51 28,51" />
        <circle className="icon-eye" cx="25" cy="33" r="1.7" />
        <circle className="icon-eye" cx="39" cy="33" r="1.7" />
      </g>
      <path className="icon-anchor" d="M49 54V21m-2.3 5L49 21l2.3 5M42 31V23m-2.2 5L42 23l2.2 5M56 31V23m-2.2 5L56 23l2.2 5M42 31c0 5 2.4 8 7 8s7-3 7-8" />
    </svg>
  );
}

function seededRandom(seed: number) {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function scenarioForDifficulty(previousId: number, difficulty: Difficulty) {
  return difficulty === "guided"
    ? generateScenario(previousId, seededRandom(0x5ea + previousId))
    : generateScenario(previousId);
}

type PendingConfirmation = {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  details?: string[];
  opener?: HTMLElement | null;
  action: () => void;
};

function createEmptySession(scenario: Scenario, difficulty: Difficulty, academyProgress: string[] = []): GameSessionState {
  return {
    scenario,
    fleet: { ...DEFAULT_FLEET },
    airWing: { ...DEFAULT_AIR },
    selectedArmaments: { ...DEFAULT_ARMAMENTS },
    selectedWarfare: [],
    academyProgress,
    difficulty,
    guidedChecklistCollapsed: true,
    selectedEndState: "",
    selectedLens: "",
    selectedPartnerLens: "",
    selectedGuardrail: "",
    theorySynthesis: "",
    rationale: "",
    assumptions: "",
    termination: "",
    history: [],
    result: null,
    rigidState: null,
    rigidOrders: DEFAULT_RIGID_ORDERS,
  };
}

export default function Home() {
  const mobileDisclosureRef = useRef<HTMLDetailsElement>(null);
  const globalToolsRef = useRef<HTMLDetailsElement>(null);
  const globalToolsSummaryRef = useRef<HTMLElement>(null);
  const soundscapeRef = useRef<SoundscapeHandle>(null);
  const privacySessionButtonRef = useRef<HTMLButtonElement>(null);
  const missionViewRef = useRef<HTMLDivElement>(null);
  const decisionsViewRef = useRef<HTMLDivElement>(null);
  const forceViewRef = useRef<HTMLElement>(null);
  const visualizationViewRef = useRef<HTMLElement>(null);
  const rigidHeadingRef = useRef<HTMLHeadingElement>(null);
  const resultHeadingRef = useRef<HTMLElement>(null);
  const dataHeadingRef = useRef<HTMLHeadingElement>(null);
  const academyButtonRef = useRef<HTMLButtonElement>(null);
  const academyOpenerRef = useRef<HTMLElement | null>(null);
  const dataButtonRef = useRef<HTMLButtonElement>(null);
  const dataOpenerRef = useRef<HTMLElement | null>(null);
  const guideButtonRef = useRef<HTMLButtonElement>(null);
  const guideOpenerRef = useRef<HTMLElement | null>(null);
  const creditsButtonRef = useRef<HTMLButtonElement>(null);
  const creditsOpenerRef = useRef<HTMLElement | null>(null);
  const session = useGameSession(() => createEmptySession(INITIAL_SCENARIO, "guided"));
  const {
    state: { scenario, fleet, airWing, selectedArmaments, selectedWarfare, academyProgress, difficulty, guidedChecklistCollapsed, selectedEndState, selectedLens, selectedPartnerLens, selectedGuardrail, theorySynthesis, rationale, assumptions, termination, history, result, rigidState, rigidOrders },
    actions: sessionActions,
  } = session;
  const [activeRoster, setActiveRoster] = useState<"fleet" | "air" | "armaments">("fleet");
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogFilter, setCatalogFilter] = useState<"all" | "available" | "selected">("all");
  const [mobileView, setMobileView] = useState<"mission" | "decisions" | "force" | "command" | "visualization">("mission");
  const [planningStage, setPlanningStage] = useState<"strategy" | "force">("strategy");
  const [theme, setTheme] = useState<"light" | "dark">(() => typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  const [briefOpen, setBriefOpen] = useState(false);
  const [fieldGuideOpen, setFieldGuideOpen] = useState(false);
  const [academyOpen, setAcademyOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const [forceStatus, setForceStatus] = useState("Identify a warfare area to unlock affiliated force items.");
  const [hydrated] = useState(() => typeof window !== "undefined");
  const [academyTarget, setAcademyTarget] = useState<string | undefined>();

  const buildSave = useCallback((): PortableSave => ({
    format: "fog-of-sea-save",
    version: 3,
    savedAt: new Date().toISOString(),
    game: { scenario, fleet, airWing, selectedArmaments, selectedWarfare, selectedEndState, selectedLens, selectedPartnerLens, selectedGuardrail, theorySynthesis, rationale, assumptions, termination, result, rigidState, rigidOrders, history },
    preferences: { theme, difficulty, planningStage, guidance: { checklistCollapsed: guidedChecklistCollapsed } },
    academyProgress,
  }), [scenario, fleet, airWing, selectedArmaments, selectedWarfare, selectedEndState, selectedLens, selectedPartnerLens, selectedGuardrail, theorySynthesis, rationale, assumptions, termination, result, rigidState, rigidOrders, history, theme, difficulty, planningStage, guidedChecklistCollapsed, academyProgress]);
  const saveManager = useBrowserSaveManager({ hydrated, buildSave });
  const {
    mode: storageMode,
    slots: savedSlots,
    activeSlotId,
    name: saveName,
    includeWrittenAnalysis: saveWrittenAnalysis,
    status: saveStatus,
    setName: setSaveName,
    setIncludeWrittenAnalysis: setSaveWrittenAnalysis,
    reportStatus: setSaveStatus,
  } = saveManager;

  const applySave = (save: PortableSave, restoreAcademy = true) => {
    const importedScenario = save.game.scenario;
    const importedWarfare = save.game.selectedWarfare;
    const restoredFleet = restrictCountsToWarfare(PLATFORMS, save.game.fleet, importedWarfare, (item) => platformAffiliations(item, AIRCRAFT, ARMAMENTS));
    const restoredAirWing = restrictCountsToWarfare(AIRCRAFT, save.game.airWing, importedWarfare, (item) => aircraftAffiliations(item, ARMAMENTS));
    const restoredArmaments = restrictCountsToWarfare(ARMAMENTS, save.game.selectedArmaments || emptyCounts(ARMAMENTS), importedWarfare, (item) => item.warfare);
    const removedOnRestore = [
      ...PLATFORMS.map((item) => (save.game.fleet[item.id] || 0) - (restoredFleet[item.id] || 0)),
      ...AIRCRAFT.map((item) => (save.game.airWing[item.id] || 0) - (restoredAirWing[item.id] || 0)),
      ...ARMAMENTS.map((item) => ((save.game.selectedArmaments || {})[item.id] || 0) - (restoredArmaments[item.id] || 0)),
    ].reduce((sum, count) => sum + Math.max(0, count), 0);
    const earlierSaveFallback = "Not recorded in this earlier save.";
    const restoredScenario = {
      ...importedScenario,
      geography: importedScenario.geography || earlierSaveFallback,
      friendlySituation: importedScenario.friendlySituation || earlierSaveFallback,
      opposingSituation: importedScenario.opposingSituation || earlierSaveFallback,
      civilianContext: importedScenario.civilianContext || earlierSaveFallback,
      constraints: importedScenario.constraints || earlierSaveFallback,
      timing: importedScenario.timing || earlierSaveFallback,
      successConditions: importedScenario.successConditions || earlierSaveFallback,
      navalProblem: importedScenario.navalProblem || "Compare at least two theories, including one maritime lens, and explain how their mechanisms combine.",
    };
    sessionActions.restoreSave({
      scenario: restoredScenario,
      fleet: restoredFleet,
      airWing: restoredAirWing,
      selectedArmaments: restoredArmaments,
      selectedWarfare: importedWarfare,
      selectedEndState: save.game.selectedEndState,
      selectedLens: save.game.selectedLens,
      selectedPartnerLens: save.game.selectedPartnerLens || "",
      selectedGuardrail: save.game.selectedGuardrail,
      theorySynthesis: save.game.theorySynthesis || "",
      rationale: save.game.rationale,
      assumptions: save.game.assumptions,
      termination: save.game.termination,
      result: save.game.result,
      rigidState: save.game.rigidState,
      rigidOrders: save.game.rigidOrders || { ...DEFAULT_RIGID_ORDERS, task: importedWarfare[0] || "reconnaissance" },
      history: save.game.history,
      difficulty: save.preferences.difficulty,
      guidedChecklistCollapsed: save.preferences.guidance.checklistCollapsed,
      academyProgress: restoreAcademy ? save.academyProgress : academyProgress,
    });
    setForceStatus(removedOnRestore
      ? `${removedOnRestore} legacy force selection${removedOnRestore === 1 ? " was" : "s were"} cleared because no affiliated warfare area was selected.`
      : "Save restored. Force selections remain tied to identified warfare areas.");
    setTheme(save.preferences.theme);
    setPlanningStage(save.preferences.planningStage);
    setMobileView(save.game.rigidState ? "command" : save.preferences.planningStage === "force" ? "force" : "mission");
  };

  useEffect(() => {
    if (!hydrated || storageMode !== "undecided") return;
    const timer = window.setTimeout(() => privacySessionButtonRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [hydrated, storageMode]);

  const {
    metrics,
    forceAdaptation,
    assessment,
    readinessGaps,
    fullyReady,
    rigidReadiness,
  } = useMemo(() => deriveForceReadiness({
    scenario,
    difficulty,
    fleet,
    airWing,
    selectedArmaments,
    selectedWarfare,
    selectedEndState,
    selectedLens,
    selectedPartnerLens,
    selectedGuardrail,
  }), [
    scenario,
    difficulty,
    fleet,
    airWing,
    selectedArmaments,
    selectedWarfare,
    selectedEndState,
    selectedLens,
    selectedPartnerLens,
    selectedGuardrail,
  ]);

  const contactVisibility = useMemo(() => deriveContactVisibility({
    platformCounts: metrics.pointCredit.creditedPlatforms,
    aircraftCounts: metrics.pointCredit.creditedAircraft,
    armamentCounts: metrics.pointCredit.missionCreditedArmaments,
    platforms: PLATFORMS,
    aircraft: AIRCRAFT,
    armaments: ARMAMENTS,
  }), [metrics.pointCredit]);

  const decisionCompletion = useMemo(() => calculateDecisionCompletion({
    selectedWarfare,
    selectedEndState,
    selectedLens,
    selectedPartnerLens,
    selectedGuardrail,
  }), [selectedWarfare, selectedEndState, selectedLens, selectedPartnerLens, selectedGuardrail]);

  const operationalStrategy = useMemo(() => deriveOperationalStrategy(scenario), [scenario]);
  const resetGameState = (next: Scenario) => {
    sessionActions.resetSession(createEmptySession(next, difficulty, academyProgress));
    setActiveRoster("fleet");
    setCatalogQuery("");
    setCatalogFilter("all");
    setBriefOpen(false);
    setPlanningStage("strategy");
    setMobileView("mission");
    setForceStatus("Identify a warfare area to unlock affiliated force items.");
  };

  const beginWithoutSaving = () => {
    resetGameState(scenarioForDifficulty(0, difficulty));
    saveManager.beginSessionOnly();
    window.setTimeout(() => missionViewRef.current?.focus(), 0);
  };

  const beginSavedGame = (fresh = false, nameOverride?: string) => {
    if (fresh || storageMode === "undecided") resetGameState(scenarioForDifficulty(fresh ? scenario.id : 0, difficulty));
    saveManager.enableNewSlot(nameOverride);
    setDataOpen(false);
    window.setTimeout(() => missionViewRef.current?.focus(), 0);
  };

  const startFreshGame = () => {
    if (storageMode === "enabled") {
      beginSavedGame(true, "New campaign");
      return;
    }
    resetGameState(scenarioForDifficulty(scenario.id, difficulty));
    setDataOpen(false);
    setPlanningStage("strategy");
    setMobileView("mission");
    setSaveStatus("New session-only game started. Browser saving remains off.");
    window.setTimeout(() => missionViewRef.current?.focus(), 0);
  };

  const requestConfirmation = (confirmation: PendingConfirmation) => {
    setPendingConfirmation({
      ...confirmation,
      opener: document.activeElement instanceof HTMLElement ? document.activeElement : null,
    });
  };

  const requestFreshGame = () => requestConfirmation({
    title: "Start a new game?",
    description: storageMode === "enabled"
      ? "The current browser-saved game remains available. A separate new save will be created."
      : "This replaces the current session. Download a TXT save first if you want to keep its decisions.",
    confirmLabel: "START NEW GAME",
    destructive: storageMode !== "enabled",
    action: startFreshGame,
  });

  const loadBrowserGame = (slot: SaveSlotMeta) => {
    const loaded = saveManager.loadSlot(slot);
    if (!loaded) return;
    applySave(loaded.save);
    setDataOpen(false);
    window.setTimeout(() => loaded.save.game.rigidState
      ? (loaded.save.game.result ? resultHeadingRef.current?.focus() : rigidHeadingRef.current?.focus())
      : loaded.save.preferences.planningStage === "force" ? forceViewRef.current?.focus() : missionViewRef.current?.focus(), 0);
  };

  const disableBrowserSaving = saveManager.disableSaving;

  const deleteBrowserGame = (slot: SaveSlotMeta) => {
    if (saveManager.removeSlot(slot)) window.setTimeout(() => dataHeadingRef.current?.focus(), 0);
  };

  const requestDeleteBrowserGame = (slot: SaveSlotMeta) => requestConfirmation({
    title: `Delete “${slot.name}”?`,
    description: "This removes only this device-local browser save. A previously downloaded TXT copy can still be imported.",
    confirmLabel: "DELETE GAME",
    destructive: true,
    action: () => deleteBrowserGame(slot),
  });

  const exportSave = () => {
    const save = buildSave();
    const blob = new Blob([formatPortableSave(save)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = saveFilename(scenario.operation);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setSaveStatus("Portable TXT save downloaded.");
  };

  const importSave = async (file: File) => {
    try {
      if (file.size > INPUT_LIMITS.portableSaveBytes) throw new Error("Save file exceeds the 2 MB local limit.");
      const save = parsePortableSave(await file.text());
      applySave(save);
      saveManager.createImportedSlot(save.game.scenario.operation, file.name);
    } catch (error) {
      setSaveStatus(error instanceof Error ? `Could not load file: ${error.message}` : "Could not load this save file.");
    }
  };

  const resetAll = () => {
    saveManager.resetAll();
    sessionActions.resetSession(createEmptySession(generateScenario(0), "guided"));
    setTheme("dark");
    setCatalogQuery("");
    setCatalogFilter("all");
    setPlanningStage("strategy");
    setMobileView("mission");
    setDataOpen(false);
    setForceStatus("Identify a warfare area to unlock affiliated force items.");
  };

  const requestResetAll = () => requestConfirmation({
    title: "Reset all browser data?",
    description: "This removes every saved game and preference created by this app from this browser. Download first if you want a copy.",
    confirmLabel: "RESET ALL BROWSER DATA",
    destructive: true,
    action: resetAll,
  });

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLElement>, onEscape?: () => void) => {
    if (event.key === "Escape" && onEscape) { event.preventDefault(); onEscape(); return; }
    containDialogTab(event, event.currentTarget);
  };

  const changeTime = (time: TimeOfDay) => {
    sessionActions.changeScenario({ ...scenario, time });
  };

  const continueToForceDesign = () => {
    if (decisionCompletion < 100) {
      setForceStatus("Complete the objective, two-theory comparison, and controlling guardrail before continuing to force design.");
      setMobileView("decisions");
      window.setTimeout(() => decisionsViewRef.current?.focus(), 0);
      return;
    }
    setPlanningStage("force");
    setMobileView("force");
    setForceStatus("Force design is ready.");
    window.setTimeout(() => forceViewRef.current?.focus(), 0);
  };

  const reviseMissionDecisions = () => {
    setPlanningStage("strategy");
    setMobileView("decisions");
    setForceStatus("Mission and strategic decisions reopened as an explicit planning phase. Existing force selections remain recorded.");
    window.setTimeout(() => decisionsViewRef.current?.focus(), 0);
  };

  const startCommandUnchecked = () => {
    const transition = beginCommandTransition({ scenario, difficulty, readiness: rigidReadiness, orders: rigidOrders, selectedWarfare, selectedLens });
    sessionActions.beginCommand(transition.state, transition.orders);
    setMobileView("command");
    setSaveStatus(storageMode === "enabled" ? "Command phase started and queued for this browser save." : "Command phase started in session-only mode.");
    window.setTimeout(() => rigidHeadingRef.current?.focus(), 0);
  };

  const startRigidGame = () => {
    if (decisionCompletion < 100) {
      setForceStatus("Complete the warfare area, objective, two-theory comparison, and guardrail decisions before beginning command turns. Optional writing is never required.");
      setPlanningStage("strategy");
      setMobileView("decisions");
      window.setTimeout(() => decisionsViewRef.current?.focus(), 0);
      return;
    }
    if (metrics.forcePoints <= 0) {
      setForceStatus("Add at least one mission-credited compatible force item before beginning command turns.");
      setMobileView("force");
      window.setTimeout(() => forceViewRef.current?.focus(), 0);
      return;
    }
    if (!fullyReady) {
      requestConfirmation({
        title: "Readiness review found likely failure points",
        description: "The command phase can begin, but these unresolved planning gaps will reduce readiness and may make the objective unattainable. Revise is the safer choice.",
        confirmLabel: "PROCEED ANYWAY",
        details: readinessGaps,
        action: startCommandUnchecked,
      });
      return;
    }
    startCommandUnchecked();
  };

  const resolveCommandTurn = () => {
    const transition = resolveCommandTransition({
      scenario,
      difficulty,
      readiness: rigidReadiness,
      orders: rigidOrders,
      state: rigidState,
      decision: { selectedWarfare, selectedEndState, selectedLens, selectedPartnerLens, selectedGuardrail, theorySynthesis, rationale, assumptions, termination, fleet, airWing, selectedArmaments },
      recordedAt: new Date().toISOString(),
    });
    if (!transition) return;
    sessionActions.resolveTurn(transition.state, transition.outcome, transition.record);
    if (transition.outcome) {
      setSaveStatus(storageMode === "enabled" ? "Final result and six-turn record queued for this browser save." : "Final result recorded for this session; browser saving remains off.");
    } else {
      setSaveStatus(storageMode === "enabled" ? `Turn ${transition.state.turn} resolved and queued for this browser save.` : `Turn ${transition.state.turn} resolved in session-only mode.`);
    }
    window.setTimeout(() => transition.outcome ? resultHeadingRef.current?.focus() : rigidHeadingRef.current?.focus(), 0);
  };

  const undoLastTurn = () => {
    const transition = undoCommandTransition(rigidState);
    if (!transition || !rigidState) return;
    sessionActions.undoTurn(transition.state, transition.dropHistory);
    setSaveStatus(storageMode === "enabled" ? `Turn ${rigidState.turn} removed and queued for this browser save.` : `Turn ${rigidState.turn} removed from this session.`);
    window.setTimeout(() => rigidHeadingRef.current?.focus(), 0);
  };

  const retrySameScenario = () => {
    const transition = retryCommandTransition({ scenario, difficulty, readiness: rigidReadiness, state: rigidState, selectedLens });
    sessionActions.retryCommand(transition.state, transition.dropHistory);
    setMobileView("command");
    setSaveStatus(storageMode === "enabled" ? "Same scenario restarted and queued for this browser save." : "Same scenario restarted in this session.");
    window.setTimeout(() => rigidHeadingRef.current?.focus(), 0);
  };

  const openDebriefLesson = (moduleId: string) => {
    academyOpenerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setAcademyTarget(moduleId);
    setAcademyOpen(true);
  };

  const returnToPlanning = () => {
    sessionActions.returnToPlanning();
    setPlanningStage("force");
    setMobileView("force");
    setForceStatus(rigidState?.phase === "complete" ? "Completed command record remains in history. Force and strategic decisions are editable again." : "Active command run ended without creating a history record. Force and strategic decisions are editable again.");
    window.setTimeout(() => forceViewRef.current?.focus(), 0);
  };

  const requestReturnToPlanning = () => requestConfirmation({
    title: rigidState?.phase === "complete" ? "Return to planning?" : "End this command run?",
    description: rigidState?.phase === "complete"
      ? "The completed decision record remains in this game’s history."
      : "The active turn record will be discarded and is not added to history.",
    confirmLabel: rigidState?.phase === "complete" ? "RETURN TO PLANNING" : "END COMMAND RUN",
    destructive: rigidState?.phase === "active",
    action: returnToPlanning,
  });

  const toggleWarfare = (id: Warfare) => {
    const removing = selectedWarfare.includes(id);
    const next = removing ? selectedWarfare.filter((item) => item !== id) : [...selectedWarfare, id];
    if (removing) {
      const blockers = [
        ...PLATFORMS.filter((item) => (fleet[item.id] || 0) > 0 && !hasSelectedAffiliation(platformAffiliations(item, AIRCRAFT, ARMAMENTS), next)).map((item) => item.short),
        ...AIRCRAFT.filter((item) => (airWing[item.id] || 0) > 0 && !hasSelectedAffiliation(aircraftAffiliations(item, ARMAMENTS), next)).map((item) => item.short),
        ...ARMAMENTS.filter((item) => (selectedArmaments[item.id] || 0) > 0 && !hasSelectedAffiliation(item.warfare, next)).map((item) => item.short),
      ];
      if (blockers.length) {
        const preview = blockers.slice(0, 3).join(", ");
        setForceStatus(`Keep ${WARFARE.find((item) => item.id === id)?.label || id} selected until you remove ${preview}${blockers.length > 3 ? ` and ${blockers.length - 3} more affiliated selection${blockers.length - 3 === 1 ? "" : "s"}` : ""}.`);
        return;
      }
    }
    sessionActions.setWarfare(next);
    setForceStatus(removing
      ? `${WARFARE.find((item) => item.id === id)?.label || id} removed; all remaining force items still have an identified affiliation.`
      : `${WARFARE.find((item) => item.id === id)?.label || id} selected. Its affiliated force items are now available.`);
  };

  const restoreOverlayFocus = (opener: HTMLElement | null, fallback: HTMLElement | null) => {
    const restore = () => {
      const mobileMenu = mobileDisclosureRef.current?.querySelector<HTMLElement>("summary") || null;
      const target = [opener, fallback, mobileMenu].find((item) => {
        if (!item?.isConnected || item === document.body || item === document.documentElement) return false;
        if (item.closest("[inert], [aria-hidden='true']")) return false;
        const closedDetails = item.closest("details:not([open])");
        if (closedDetails && closedDetails.querySelector(":scope > summary") !== item) return false;
        const rect = item.getBoundingClientRect();
        const style = window.getComputedStyle(item);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      });
      target?.focus();
    };
    window.requestAnimationFrame(() => window.requestAnimationFrame(restore));
  };
  const openData = () => {
    dataOpenerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setDataOpen(true);
  };
  const closeData = () => {
    setDataOpen(false);
    restoreOverlayFocus(dataOpenerRef.current, dataButtonRef.current);
  };
  const openGuide = () => {
    guideOpenerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setFieldGuideOpen(true);
  };
  const closeGuide = () => {
    setFieldGuideOpen(false);
    restoreOverlayFocus(guideOpenerRef.current, guideButtonRef.current);
  };
  const closeAcademy = () => {
    setAcademyOpen(false);
    restoreOverlayFocus(academyOpenerRef.current, academyButtonRef.current);
  };
  const openAcademy = (target?: string) => {
    academyOpenerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setAcademyTarget(target);
    setAcademyOpen(true);
  };
  const openCredits = () => {
    creditsOpenerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setCreditsOpen(true);
  };
  const closeCredits = () => {
    setCreditsOpen(false);
    restoreOverlayFocus(creditsOpenerRef.current, creditsButtonRef.current);
  };
  const openFromGlobalTools = (open: () => void) => {
    if (globalToolsRef.current) globalToolsRef.current.open = false;
    globalToolsSummaryRef.current?.focus();
    open();
  };
  const openMobileGlobalTool = (open: () => void) => {
    // The workspace disclosure is the opener for tools reached from its
    // compact drawer. Close it first, then restore focus to its visible
    // summary before opening the overlay; the hidden desktop Tools summary
    // is not a valid mobile focus target.
    const summary = mobileDisclosureRef.current?.querySelector<HTMLElement>(":scope > summary") || null;
    if (mobileDisclosureRef.current) mobileDisclosureRef.current.open = false;
    summary?.focus();
    open();
  };
  const overlayOpen = storageMode === "undecided" || fieldGuideOpen || dataOpen || academyOpen || creditsOpen || pendingConfirmation !== null;
  const planningLocked = rigidState !== null;
  const strategicEntriesComplete = [
    Boolean(selectedEndState),
    Boolean(selectedLens),
    Boolean(selectedPartnerLens),
    Boolean(selectedGuardrail),
  ].filter(Boolean).length;
  const forcePointLabel = Number.isInteger(metrics.forcePoints) ? metrics.forcePoints.toFixed(0) : metrics.forcePoints.toFixed(1);
  const lowSignatureFleet = PLATFORMS.filter((item) => item.visualSignature === "low").reduce((sum, item) => sum + (fleet[item.id] || 0), 0);
  const lowSignatureAircraft = AIRCRAFT.filter((item) => item.visualSignature === "low").reduce((sum, item) => sum + (metrics.aviationFit.supportedByAircraft[item.id] || 0), 0);
  const mobileViewLabel = result && mobileView === "command"
    ? "Final debrief"
    : mobileView === "command"
      ? "Command phase"
      : mobileView === "visualization"
        ? "Visualization"
        : mobileView === "mission"
        ? "Mission brief"
        : mobileView === "decisions"
          ? "Decisions"
          : "Force design";
  const chooseMobileView = (view: typeof mobileView) => {
    setMobileView(view);
    if (mobileDisclosureRef.current) mobileDisclosureRef.current.open = false;
    const targets = {
      mission: missionViewRef,
      decisions: decisionsViewRef,
      force: forceViewRef,
      command: rigidHeadingRef,
      visualization: visualizationViewRef,
    };
    window.setTimeout(() => targets[view].current?.focus(), 0);
  };

  const normalizedCatalogQuery = catalogQuery.trim().toLocaleLowerCase();
  const matchesCatalog = (searchable: string, available: boolean, selected: boolean) => (
    (!normalizedCatalogQuery || searchable.toLocaleLowerCase().includes(normalizedCatalogQuery))
    && (catalogFilter === "all" || (catalogFilter === "available" ? available : selected))
  );
  const filteredPlatforms = PLATFORMS.filter((item) => matchesCatalog(
    [item.name, item.short, item.role, ...item.capabilities, warfareAreaNames(platformAffiliations(item, AIRCRAFT, ARMAMENTS)), ...item.aviationKinds.map((kind) => AVIATION_KIND_LABELS[kind])].join(" "),
    hasSelectedAffiliation(platformAffiliations(item, AIRCRAFT, ARMAMENTS), selectedWarfare),
    (fleet[item.id] || 0) > 0,
  ));
  const filteredAircraft = AIRCRAFT.filter((item) => matchesCatalog(
    [item.name, item.short, item.role, item.missionReach, ...item.capabilities, ...item.trackingMethods, warfareAreaNames(aircraftAffiliations(item, ARMAMENTS)), AVIATION_KIND_LABELS[item.kind], ...PLATFORMS.filter((platform) => platform.aviationKinds.includes(item.kind)).map((platform) => platform.name)].join(" "),
    hasSelectedAffiliation(aircraftAffiliations(item, ARMAMENTS), selectedWarfare),
    (airWing[item.id] || 0) > 0,
  ));
  const filteredArmaments = DISPLAY_ARMAMENTS.filter((item) => matchesCatalog(
    [item.name, item.short, item.role, item.reach, ...item.trackingMethods, warfareAreaNames(item.warfare), ...item.hostIds.map((id) => PLATFORMS.find((platform) => platform.id === id)?.name || AIRCRAFT.find((aircraft) => aircraft.id === id)?.name || id)].join(" "),
    hasSelectedAffiliation(item.warfare, selectedWarfare),
    (selectedArmaments[item.id] || 0) > 0,
  ));
  const visibleRosterCount = activeRoster === "fleet" ? filteredPlatforms.length : activeRoster === "air" ? filteredAircraft.length : filteredArmaments.length;
  const hasSelectedPlatform = Object.values(fleet).some((count) => count > 0);
  const hasAviationHost = PLATFORMS.some((platform) => (fleet[platform.id] || 0) > 0 && platform.aviationCapacity > 0);
  const hasSelectedAircraft = Object.values(airWing).some((count) => count > 0);
  const canOpenAviation = hasSelectedPlatform && hasAviationHost;
  const canOpenArmaments = hasSelectedPlatform || hasSelectedAircraft;
  const chooseRoster = (next: typeof activeRoster) => {
    if (next === "air" && !canOpenAviation) {
      setForceStatus(!hasSelectedPlatform
        ? "Embarked aviation is unavailable until you add a vessel or submarine and choose an aviation-capable platform."
        : "Embarked aviation is unavailable until you choose an aviation-capable platform.");
      return;
    }
    if (next === "armaments" && !canOpenArmaments) {
      setForceStatus("Armament packs are unavailable until you add a compatible vessel, submarine, or aircraft.");
      return;
    }
    setActiveRoster(next);
    setCatalogQuery("");
    setCatalogFilter("all");
    setForceStatus(`Showing the ${next === "fleet" ? "fleet" : next === "air" ? "embarked aviation" : "armament packs"} roster.`);
  };
  const selectedForceSummary = [
    ...PLATFORMS.filter((item) => (fleet[item.id] || 0) > 0).map((item) => `${item.short} ×${fleet[item.id]}`),
    ...AIRCRAFT.filter((item) => (airWing[item.id] || 0) > 0).map((item) => `${item.short} ×${airWing[item.id]}`),
    ...ARMAMENTS.filter((item) => (selectedArmaments[item.id] || 0) > 0).map((item) => `${item.short} ×${selectedArmaments[item.id]}`),
  ];
  const planningRecap = (includeForce: boolean) => (
    <PlanningRecap
      operation={scenario.operation}
      location={`${scenario.region} · ${scenario.climate}`}
      brief={scenario.brief}
      environment={[
        { label: "Time", value: scenario.time },
        { label: "Weather", value: scenario.precipitation === "none" ? cloudCoverLabel(scenario.clouds) : `${scenario.precipitation} · ${cloudCoverPhrase(scenario.clouds)}` },
        { label: "Sea state / visibility", value: `${scenario.seaState} · ${scenario.visibility} invented nm` },
        { label: "Season / date", value: `${scenario.season} · ${scenario.scenarioDate}` },
        { label: "Wind / current", value: `${scenario.windHeading}° ${scenario.windSpeed} kn · ${scenario.currentHeading}° ${scenario.currentSpeed} kn` },
        { label: "Operating method / posture", value: `${operationalStrategy.summary}` },
      ]}
      decisions={[
        { label: "Warfare areas", value: warfareAreaNames(selectedWarfare) || "None recorded" },
        { label: "Objective / end state", value: END_STATES.find((item) => item.id === selectedEndState)?.label || "None recorded" },
        { label: "Primary theory", value: THEORY_LENSES.find((item) => item.id === selectedLens)?.label || "None recorded" },
        { label: "Complement or challenge", value: THEORY_LENSES.find((item) => item.id === selectedPartnerLens)?.label || "None recorded" },
        { label: "Controlling guardrail", value: GUARDRAILS.find((item) => item.id === selectedGuardrail)?.label || "None recorded" },
        { label: "Uncrewed / undersea frame", value: `${operationalStrategy.recommendedUncrewed.replaceAll("-", " ")} · ${operationalStrategy.recommendedUndersea.replaceAll("-", " ")}` },
      ]}
      force={includeForce ? [
        { label: "Mission-credited points", value: `${forcePointLabel} / ${scenario.budget}` },
        { label: "Planning readiness", value: `${assessment.score} / 100 · ${fullyReady ? "ready for command" : `${readinessGaps.length} review item${readinessGaps.length === 1 ? "" : "s"}`}` },
        { label: "Notional manning", value: (metrics.surfaceCrew + metrics.aircrew + metrics.aviationSupport).toLocaleString() },
        { label: "Paired aviation / loadouts", value: `${metrics.aviationFit.supportedAircraft}/${metrics.aviationFit.totalAircraft} aircraft · ${metrics.armamentFit.totalCredited}/${metrics.armamentFit.totalSelected} packs` },
        { label: "Environment fit", value: `${forceAdaptation.score} / 100 · ${forceAdaptation.label}` },
      ] : undefined}
      selectedForce={includeForce ? selectedForceSummary : undefined}
    />
  );
  const skipTarget = result ? "#result-heading" : rigidState ? "#rigid-turn-heading" : planningStage === "force" ? "#force-heading-title" : "#mission-workflow";
  const skipLabel = result ? "Skip to final debrief" : rigidState ? "Skip to command turn" : planningStage === "force" ? "Skip to force design" : "Skip to mission workflow";
  const phaseKey = result ? "debrief" : rigidState ? "command" : planningStage;
  const phaseAnnouncement = result
    ? "Final debrief is now active. Planning and command controls are unavailable until you choose a debrief action."
    : rigidState
      ? "Command phase is now active. Earlier planning is available only in the read-only planning recap."
      : planningStage === "force"
        ? "Force design is now active. Earlier decisions are available in the read-only planning recap."
        : "Mission analysis and strategic decisions are now active.";
  const saveFailed = /failed|could not/i.test(saveStatus);

  return (
    <main className={`app theme-${theme}`}>
      <div className="game-shell" inert={overlayOpen ? true : undefined} aria-hidden={overlayOpen}>
      <a className="skip-link" href={skipTarget}>{skipLabel}</a>
      <PhaseAnnouncement key={storageMode === "undecided" ? "gate" : "play"} phase={phaseKey} message={phaseAnnouncement} enabled={storageMode !== "undecided"} />
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><BrandIcon /></span>
          <div>
            <strong>FOG OF SEA</strong>
            <span>RIGID KRIEGSSPIEL · MARITIME STRATEGY LAB</span>
          </div>
        </div>
        <div className="top-actions" role="navigation" aria-label="Global controls">
          <button ref={academyButtonRef} className="quiet-button academy-button" type="button" onClick={() => openAcademy()}>ACADEMY</button>
          <button ref={dataButtonRef} className="quiet-button data-button" type="button" onClick={openData}>SAVE / LOAD</button>
          <button ref={guideButtonRef} className="quiet-button field-guide-button" type="button" onClick={openGuide}>FIELD GUIDE</button>
          <button ref={creditsButtonRef} className="quiet-button credits-button" type="button" onClick={openCredits}>CREDITS</button>
          <Soundscape ref={soundscapeRef} climate={scenario.climate} time={scenario.time} precipitation={scenario.precipitation} seaState={scenario.seaState} storming={scenario.storming} region={scenario.region} soundProfile={scenario.soundProfile} windSpeed={scenario.windSpeed} currentSpeed={scenario.currentSpeed} onOpenCredits={openCredits} />
          <button
            className="icon-button"
            type="button"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} interface`}
            onClick={() => {
              const next = theme === "dark" ? "light" : "dark";
              setTheme(next);
            }}
          >{theme === "dark" ? "☼" : "◐"}</button>
          <button className="primary-small" type="button" onClick={requestFreshGame}>NEW GAME <span aria-hidden="true">↗</span></button>
          <details ref={globalToolsRef} className="global-tools-menu" onKeyDown={(event) => {
            if (event.key !== "Escape" || !globalToolsRef.current?.open) return;
            event.preventDefault();
            globalToolsRef.current.open = false;
            globalToolsSummaryRef.current?.focus();
          }}>
            <summary ref={globalToolsSummaryRef} aria-label="Global tools">TOOLS</summary>
            <button
              type="button"
              className="mobile-menu-scrim"
              aria-label="Close Tools menu"
              onClick={() => {
                if (globalToolsRef.current) globalToolsRef.current.open = false;
                globalToolsSummaryRef.current?.focus();
              }}
            />
            <nav aria-label="Global tools">
              <button type="button" onClick={() => openFromGlobalTools(() => openAcademy())}>ACADEMY</button>
              <button type="button" onClick={() => openFromGlobalTools(openData)}>SAVE / LOAD</button>
              <button type="button" onClick={() => openFromGlobalTools(openGuide)}>FIELD GUIDE</button>
              <button type="button" onClick={() => openFromGlobalTools(openCredits)}>CREDITS</button>
              <button type="button" onClick={() => openFromGlobalTools(() => soundscapeRef.current?.openSettings(globalToolsSummaryRef.current))}>SOUND SETTINGS</button>
            </nav>
          </details>
        </div>
      </header>

      {saveFailed ? <div className="save-indicator error" role="alert" aria-live="assertive">{saveStatus}</div> : null}

      <div className="mobile-gamebar" role="navigation" aria-label="Game views and status">
        <details
          ref={mobileDisclosureRef}
          className="mobile-disclosure"
          onKeyDown={(event) => {
            if (event.key !== "Escape" || !mobileDisclosureRef.current?.open) return;
            event.preventDefault();
            mobileDisclosureRef.current.open = false;
            mobileDisclosureRef.current.querySelector<HTMLElement>(":scope > summary")?.focus();
          }}
        >
          <summary>{mobileViewLabel}</summary>
          <button
            type="button"
            className="mobile-menu-scrim"
            aria-label="Close game navigation"
            onClick={() => {
              const summary = mobileDisclosureRef.current?.querySelector<HTMLElement>(":scope > summary") || null;
              if (mobileDisclosureRef.current) mobileDisclosureRef.current.open = false;
              summary?.focus();
            }}
          />
          <div>
            <span className="mobile-menu-section-label">WORKSPACE</span>
            {!planningLocked && planningStage === "strategy" && <>
              <button type="button" aria-current={mobileView === "mission" ? "page" : undefined} onClick={() => chooseMobileView("mission")}>MISSION BRIEF</button>
              <button type="button" aria-current={mobileView === "decisions" ? "page" : undefined} onClick={() => chooseMobileView("decisions")}>DECISIONS</button>
            </>}
            {!planningLocked && planningStage === "force" && <>
              <button type="button" aria-current={mobileView === "force" ? "page" : undefined} onClick={() => chooseMobileView("force")}>FORCE DESIGN</button>
              <button type="button" onClick={() => { reviseMissionDecisions(); if (mobileDisclosureRef.current) mobileDisclosureRef.current.open = false; }}>REVISE MISSION &amp; DECISIONS</button>
            </>}
            {planningLocked && <button type="button" aria-current={mobileView === "command" ? "page" : undefined} onClick={() => chooseMobileView("command")}>{result ? "FINAL DEBRIEF" : "COMMAND PHASE"}</button>}
            <button type="button" aria-current={mobileView === "visualization" ? "page" : undefined} onClick={() => chooseMobileView("visualization")}>VISUALIZATION</button>
            <span className="mobile-menu-section-label">TOOLS</span>
            <button type="button" onClick={() => openMobileGlobalTool(() => openAcademy())}>ACADEMY</button>
            <button type="button" onClick={() => openMobileGlobalTool(openData)}>SAVE / LOAD</button>
            <button type="button" onClick={() => openMobileGlobalTool(openGuide)}>FIELD GUIDE</button>
            <button type="button" onClick={() => openMobileGlobalTool(openCredits)}>CREDITS</button>
            <button type="button" onClick={() => openMobileGlobalTool(() => soundscapeRef.current?.openSettings(mobileDisclosureRef.current?.querySelector<HTMLElement>(":scope > summary") || null))}>SOUND SETTINGS</button>
          </div>
        </details>
        <div className="mobile-points"><span>{result ? "FINAL SCORE" : metrics.forcePlanningReady ? "MISSION FORCE" : "POINTS LOCKED"}</span><strong>{result ? result.score : forcePointLabel}<small>/100</small></strong></div>
        <div className="mobile-completion"><span>{rigidState ? "COMMAND TURN" : "DECISIONS"}</span><strong>{rigidState ? `${rigidState.turn}/${rigidState.maxTurns}` : `${decisionCompletion}%`}</strong></div>
      </div>

      <section className={`workspace phase-${result ? "debrief" : planningLocked ? "command" : planningStage} mobile-view-${mobileView}`} aria-label="Maritime planning game">
        {!planningLocked && planningStage === "strategy" && (
        <aside id="mission-analysis" className="mission-panel" aria-label="Mission analysis">
	          <div ref={missionViewRef} id="mission-workflow" className="mission-overview" tabIndex={-1} role="region" aria-labelledby="mission-title">
          <div className="eyebrow-row">
            <span>EXERCISE {String(scenario.id).padStart(2, "0")}</span>
            <span className="live-dot">NOTIONAL</span>
          </div>
	          <h1 id="mission-title">OPERATION<br />{scenario.operation}</h1>
          <p className="location">{scenario.region} · {scenario.climate}</p>

          <dl className="conditions-grid" aria-label="Scenario conditions">
            <div><dt><span>TIME</span></dt><dd><strong>{scenario.time}</strong></dd></div>
            <div><dt><span>WEATHER</span></dt><dd><strong>{scenario.precipitation === "none" ? cloudCoverLabel(scenario.clouds) : scenario.precipitation}</strong></dd></div>
            <div><dt><span>SEA STATE</span></dt><dd><strong>{scenario.seaState}</strong></dd></div>
            <div><dt><span>VISIBILITY</span></dt><dd><strong>{scenario.visibility} nm</strong></dd></div>
            <div><dt><span>SEASON / DATE</span></dt><dd><strong>{scenario.season} · {scenario.scenarioDate}</strong></dd></div>
            <div><dt><span>WIND / CURRENT</span></dt><dd><strong>{scenario.windHeading}° {scenario.windSpeed} kn · {scenario.currentHeading}° {scenario.currentSpeed} kn</strong></dd></div>
          </dl>

          <div className="brief-card">
            <button type="button" onClick={() => setBriefOpen((value) => !value)} aria-expanded={briefOpen} aria-controls="mission-brief-details">
              <span><small>01</small> MISSION BRIEF</span><b aria-hidden="true">{briefOpen ? "−" : "+"}</b>
            </button>
              <div id="mission-brief-details" className="brief-detail" hidden={!briefOpen}>
                <span>BRIEF</span>
                <p>{scenario.brief}</p>
                <span>GEOGRAPHY &amp; CHOKEPOINTS</span>
                <p>{scenario.geography}</p>
                <span>FRIENDLY SITUATION</span>
                <p>{scenario.friendlySituation}</p>
                <span>OPPOSING SITUATION</span>
                <p>{scenario.opposingSituation}</p>
                <span>CIVILIAN &amp; NEUTRAL CONTEXT</span>
                <p>{scenario.civilianContext}</p>
                <span>OBJECTIVE</span>
                <p>{scenario.objective}</p>
                <span>INTELLIGENCE</span>
                <p>{scenario.intelligence}</p>
                <span>CONSTRAINTS</span>
                <p>{scenario.constraints}</p>
                <span>TIMING</span>
                <p>{scenario.timing}</p>
                <span>SUCCESS CONDITIONS</span>
                <p>{scenario.successConditions}</p>
                <span>COMPARATIVE MARITIME-THEORY PROBLEM</span>
                <p>{scenario.navalProblem}</p>
                <span>HISTORICAL MODE</span>
                <p>{scenario.history}</p>
              </div>
          </div>
          </div>

	          <div ref={decisionsViewRef} className="decision-workflow" tabIndex={-1} role="region" aria-labelledby="decisions-heading">
          <div className="analysis-block">
            <div className="section-title"><span id="decisions-heading" role="heading" aria-level={2}><small>02</small> IDENTIFY WARFARE AREAS</span><i>{selectedWarfare.length}/{WARFARE.length}</i></div>
            <p id="warfare-instructions">Select every area demanded by the brief. Incorrect additions dilute command focus.</p>
            <div className="warfare-grid" role="group" aria-labelledby="decisions-heading" aria-describedby="warfare-instructions">
              {WARFARE.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={selectedWarfare.includes(item.id) ? "selected" : ""}
                  onClick={() => toggleWarfare(item.id)}
                  title={item.detail}
                  aria-pressed={selectedWarfare.includes(item.id)}
                ><span>{item.label}</span><small>{item.detail}</small></button>
              ))}
            </div>
          </div>

          <StrategicDecisionFlow
            politicalAim={scenario.politicalAim}
            navalProblem={scenario.navalProblem}
            warfareSelected={selectedWarfare.length > 0}
            completed={strategicEntriesComplete}
            endStates={END_STATES}
            theories={THEORY_LENSES}
            guardrails={GUARDRAILS}
            selectedEndState={selectedEndState}
            selectedLens={selectedLens}
            selectedPartnerLens={selectedPartnerLens}
            selectedGuardrail={selectedGuardrail}
            theorySynthesis={theorySynthesis}
            rationale={rationale}
            assumptions={assumptions}
            termination={termination}
            operationalStrategy={operationalStrategy}
            onEndState={sessionActions.selectEndState}
            onPrimaryLens={sessionActions.selectPrimaryLens}
            onPartnerLens={sessionActions.selectPartnerLens}
            onGuardrail={sessionActions.selectGuardrail}
            onWriting={sessionActions.writeDecision}
          />
          {decisionCompletion === 100 && (
            <button className="phase-continue-button" type="button" onClick={continueToForceDesign}>
              <span>CONTINUE TO FORCE DESIGN</span><b aria-hidden="true">→</b>
            </button>
          )}
          </div>
        </aside>
        )}

        <section ref={visualizationViewRef} className="tactical-panel" aria-label={result ? "Final review" : undefined} aria-labelledby={result ? undefined : "tactical-panel-title"} tabIndex={-1}>
          {!result && <h2 id="tactical-panel-title" className="visually-hidden">TACTICAL VISUALIZATION</h2>}
          {!result && <>
          <Suspense fallback={<div className="battlefield-loading" role="status"><span>PREPARING LOCAL THREE-DIMENSIONAL PLOT…</span></div>}>
            <Battlefield
              key={scenario.id}
              climate={scenario.climate}
              time={scenario.time}
              clouds={scenario.clouds}
              precipitation={scenario.precipitation}
              seaState={scenario.seaState}
              visibility={scenario.visibility}
              season={scenario.season || "seasonal"}
              scenarioDate={scenario.scenarioDate}
              observerLatitude={scenario.observerLatitude}
              observerLongitude={scenario.observerLongitude}
              storming={Boolean(scenario.storming)}
              lightningCapable={Boolean(scenario.lightningCapable)}
              windHeading={scenario.windHeading}
              windSpeed={scenario.windSpeed}
              currentHeading={scenario.currentHeading}
              currentSpeed={scenario.currentSpeed}
              waveHeading={scenario.waveHeading}
              region={scenario.region}
              regionId={scenario.regionId}
              fleet={fleet}
              airWing={metrics.aviationFit.supportedByAircraft}
              lowSignatureFleet={lowSignatureFleet}
              lowSignatureAircraft={lowSignatureAircraft}
              exerciseId={scenario.id}
              result={null}
              theme={theme}
              contactVisibility={contactVisibility}
              currentPhaseContentActive={Boolean(rigidState)}
            />
          </Suspense>
          <div className="plot-topline">
            {!planningLocked && <div className="time-control" role="group" aria-label="Time of day">
              {(["dawn", "day", "dusk", "night"] as TimeOfDay[]).map((time) => (
                <button key={time} type="button" aria-pressed={scenario.time === time} className={scenario.time === time ? "active" : ""} onClick={() => changeTime(time)}>{time}</button>
              ))}
            </div>}
          </div>
          {rigidState && rigidState.phase === "active" && (
            <CommandPanel
              state={rigidState}
              orders={rigidOrders}
              warfareAreas={selectedWarfare}
              warfareLabel={(area) => WARFARE.find((item) => item.id === area)?.label || area}
              headingRef={rigidHeadingRef}
              planningRecap={planningRecap(true)}
              operationalStrategy={operationalStrategy}
              adversaryCount={scenario.adversaryCount ?? 1}
              contactVisibility={contactVisibility}
              onOrdersChange={sessionActions.updateOrders}
              onResolve={resolveCommandTurn}
              onUndo={undoLastTurn}
              onReturn={requestReturnToPlanning}
            />
          )}
          </>}
          {result && rigidState && <ResultDebrief result={result} state={rigidState} headingRef={resultHeadingRef} planningRecap={planningRecap(true)} warfareLabel={(area) => WARFARE.find((item) => item.id === area)?.label || area} onOpenLesson={openDebriefLesson} onUndo={undoLastTurn} onRetry={retrySameScenario} onReturn={requestReturnToPlanning} onNewScenario={requestFreshGame} />}
        </section>

        {!planningLocked && planningStage === "force" && (
        <aside ref={forceViewRef} className="force-panel" aria-labelledby="force-heading-title" tabIndex={-1}>
          <div className="force-heading">
            <div><span>04</span><h2 id="force-heading-title" tabIndex={-1}>DESIGN THE FORCE</h2></div>
            <div className={metrics.forcePoints <= scenario.budget ? "budget-ok" : "budget-over"}>
              <strong>{forcePointLabel}</strong><span>/ {scenario.budget}<br />MISSION-CREDITED POINTS</span>
            </div>
          </div>
          <div className="phase-review-tools">
            {planningRecap(false)}
            <button className="phase-revise-button" type="button" onClick={reviseMissionDecisions}>REVISE MISSION &amp; DECISIONS</button>
          </div>
          <div className="tabs" role="group" aria-label="Force roster" aria-describedby="force-sequence-hint">
            <button type="button" aria-controls="force-roster" aria-pressed={activeRoster === "fleet"} className={activeRoster === "fleet" ? "active" : ""} onClick={() => chooseRoster("fleet")}>FLEET</button>
            <button type="button" aria-disabled={!canOpenAviation} aria-controls="force-roster" aria-describedby="force-sequence-hint" aria-pressed={activeRoster === "air"} className={activeRoster === "air" ? "active" : ""} onClick={() => chooseRoster("air")}>EMBARKED AVIATION</button>
            <button type="button" aria-disabled={!canOpenArmaments} aria-controls="force-roster" aria-describedby="force-sequence-hint" aria-pressed={activeRoster === "armaments"} className={activeRoster === "armaments" ? "active" : ""} onClick={() => chooseRoster("armaments")}>ARMAMENT PACKS</button>
          </div>
          <p id="force-sequence-hint" className="progressive-force-hint">{!hasSelectedPlatform ? "Choose a compatible vessel or submarine." : !canOpenAviation ? "Choose an aviation-capable platform, or continue with mission packs." : !hasSelectedAircraft ? "Add compatible aviation, or continue with mission packs." : "Review the selected force, then begin command."}</p>
          <div className="catalog-tools">
            <label htmlFor="catalog-search"><span>SEARCH THIS ROSTER</span><input id="catalog-search" type="search" value={catalogQuery} maxLength={INPUT_LIMITS.searchQuery} onChange={(event) => setCatalogQuery(sanitizeSearchQuery(event.target.value))} placeholder="Role, task, reach, tracking…" /></label>
            <label htmlFor="catalog-filter"><span>SHOW</span><select id="catalog-filter" value={catalogFilter} onChange={(event) => setCatalogFilter(event.target.value as typeof catalogFilter)}><option value="all">All items</option><option value="available">Available for selected areas</option><option value="selected">Selected only</option></select></label>
            <small role="status" aria-live="polite">{visibleRosterCount} matching item{visibleRosterCount === 1 ? "" : "s"}</small>
          </div>
          <p id="force-credit-rule" className={`compatibility-credit-note ${metrics.forcePlanningReady ? "unlocked" : "locked"}`}>{metrics.forcePlanningReady ? "CREDIT READY" : "CREDIT LOCKED"}</p>
          <p className="force-status" role="status" aria-live="polite" aria-atomic="true">{forceStatus}</p>

          {difficulty === "guided" && (
            <section className="guided-checklist" aria-labelledby="guided-title">
              <button type="button" onClick={() => sessionActions.setGuidanceCollapsed(!guidedChecklistCollapsed)} aria-expanded={!guidedChecklistCollapsed} aria-controls="guided-checklist-details">
                <span><small>GUIDED MODE</small><strong id="guided-title">NEXT ACTION</strong></span><b aria-hidden="true">{guidedChecklistCollapsed ? "+" : "−"}</b>
              </button>
                <div id="guided-checklist-details" hidden={guidedChecklistCollapsed}>
                  <p>{readinessGaps[0] || "The plan passes the readiness review. Begin the command phase when ready."}</p>
                  <ol>
                    {readinessGaps.slice(0, 5).map((gap, index) => <li key={gap} className={index === 0 ? "current" : ""}>{gap}</li>)}
                    {!readinessGaps.length && <li className="complete">Readiness review complete.</li>}
                  </ol>
                  <small>Guidance identifies the next check without revealing the generated answer.</small>
                </div>
            </section>
          )}

          <div id="force-roster" className="roster" role="list" aria-describedby="force-credit-rule" aria-label={`${activeRoster === "fleet" ? "Fleet" : activeRoster === "air" ? "Embarked aviation" : "Armament packs"} roster`}>
            {activeRoster === "fleet" ? filteredPlatforms.map((platform) => {
              const aircraftPairs = AIRCRAFT.filter((item) => platform.aviationKinds.includes(item.kind)).map((item) => item.short);
              const armamentPairs = ARMAMENTS.filter((item) => item.hostIds.includes(platform.id)).map((item) => item.short);
              const affiliations = platformAffiliations(platform, AIRCRAFT, ARMAMENTS);
              const canAdd = hasSelectedAffiliation(affiliations, selectedWarfare);
              const descriptionId = `eligibility-${platform.id}`;
              const disabledReason = `First identify one affiliated warfare area: ${warfareAreaNames(affiliations)}.`;
              const selected = fleet[platform.id] || 0;
              const missionCredited = metrics.pointCredit.creditedPlatforms[platform.id] || 0;
              const titleId = `roster-title-${platform.id}`;
              const creditId = `credit-${platform.id}`;
              return (
              <article className="roster-row" key={platform.id} role="listitem" aria-labelledby={titleId} aria-describedby={`${descriptionId} ${creditId}`}>
                <div className={`platform-icon icon-${platform.id}`} aria-hidden="true"><span /></div>
                <div className="roster-copy">
                  <strong id={titleId} role="heading" aria-level={3}>{platform.short}</strong><span>{platform.name}</span><small>{platform.role} · {platform.points} eligible pts · {platform.crew.toLocaleString()} notional personnel · {platform.aviationCapacity ? `${platform.aviationCapacity} shared air spaces` : "no aviation deck"} · {platform.armamentSlots} loadout slots</small>
                  <details className="roster-details"><summary>CAPABILITIES &amp; PAIRINGS</summary><small className="capability-summary">DOES · {platform.capabilities.join(" · ")}</small><small className="pairing-summary">PAIRS · {[...aircraftPairs, ...armamentPairs].join(" · ") || "self-contained support role"}</small></details>
                  <small id={descriptionId} className={canAdd ? "eligibility-status" : "eligibility-status locked"}>WARFARE AFFILIATION · {warfareAreaNames(affiliations)}{canAdd ? "" : " · SELECT AN AFFILIATED AREA TO ADD"}</small>
                  <small id={creditId} className={selected > missionCredited ? "credit-status invalid" : "credit-status"}>MISSION CREDIT · {missionCredited}/{selected}</small>
                </div>
                <Counter value={fleet[platform.id] || 0} canAdd={canAdd} disabledReason={disabledReason} descriptionId={`${descriptionId} ${creditId}`} onBlocked={setForceStatus} onChange={(value) => { sessionActions.updateForceCount("fleet", platform.id, value); setForceStatus(`${platform.short} count set to ${value}.`); }} label={platform.name} />
              </article>
              );
            }) : activeRoster === "air" ? filteredAircraft.map((aircraft) => {
              const deckPairs = PLATFORMS.filter((platform) => platform.aviationKinds.includes(aircraft.kind)).map((platform) => platform.short);
              const armamentPairs = ARMAMENTS.filter((item) => item.hostIds.includes(aircraft.id)).map((item) => item.short);
              const affiliations = aircraftAffiliations(aircraft, ARMAMENTS);
              const canAdd = hasSelectedAffiliation(affiliations, selectedWarfare);
              const descriptionId = `eligibility-${aircraft.id}`;
              const disabledReason = `First identify one affiliated warfare area: ${warfareAreaNames(affiliations)}.`;
              const selected = airWing[aircraft.id] || 0;
              const credited = metrics.aviationFit.supportedByAircraft[aircraft.id] || 0;
              const missionCredited = metrics.pointCredit.creditedAircraft[aircraft.id] || 0;
              const deckAssignments = Object.entries(metrics.aviationFit.assignmentsByAircraft[aircraft.id] || {}).map(([id, count]) => `${PLATFORMS.find((platform) => platform.id === id)?.short || id} ×${count}`);
              const titleId = `roster-title-${aircraft.id}`;
              const compatibilityId = `compatibility-${aircraft.id}`;
              const creditId = `credit-${aircraft.id}`;
              return (
              <article className="roster-row" key={aircraft.id} role="listitem" aria-labelledby={titleId} aria-describedby={`${descriptionId} ${compatibilityId} ${creditId}`}>
                <div className={`aircraft-icon ${aircraft.kind}`} aria-hidden="true"><span /></div>
                <div className="roster-copy">
                  <strong id={titleId} role="heading" aria-level={3}>{aircraft.short}</strong><span>{aircraft.name}</span><small>{aircraft.role} · {aircraft.points} eligible pts when paired · {AVIATION_KIND_LABELS[aircraft.kind]} · {aircraft.aircrew ? `${aircraft.aircrew} aircrew` : "uncrewed"} · {aircraft.supportCrew} notional support personnel</small>
                  <details className="roster-details"><summary>CAPABILITIES &amp; PAIRINGS</summary><small className="system-profile">NOTIONAL MISSION REACH · {aircraft.missionReach} · TRACKS · {aircraft.trackCapacity} · TRACKING · {aircraft.trackingMethods.join(" / ")}</small><small className="capability-summary">DOES · {aircraft.capabilities.join(" · ")}</small><small className="pairing-summary">LANDS ON · {deckPairs.join(" · ")} · LOADS · {armamentPairs.join(" · ")}</small><small className="assignment-summary">EMBARKED · {deckAssignments.join(" · ") || "no compatible selected deck"}</small></details>
                  <small id={descriptionId} className={canAdd ? "eligibility-status" : "eligibility-status locked"}>WARFARE AFFILIATION · {warfareAreaNames(affiliations)}{canAdd ? "" : " · SELECT AN AFFILIATED AREA TO ADD"}</small>
                  <small id={compatibilityId} className={selected > credited ? "credit-status invalid" : "credit-status"}>COMPATIBILITY · {credited}/{selected}</small>
                  <small id={creditId} className={selected > missionCredited ? "credit-status invalid" : "credit-status"}>MISSION CREDIT · {missionCredited}/{selected}</small>
                </div>
                <Counter value={airWing[aircraft.id] || 0} canAdd={canAdd} disabledReason={disabledReason} descriptionId={`${descriptionId} ${compatibilityId} ${creditId}`} onBlocked={setForceStatus} onChange={(value) => { sessionActions.updateForceCount("airWing", aircraft.id, value); setForceStatus(`${aircraft.short} count set to ${value}.`); }} label={aircraft.name} />
              </article>
              );
            }) : filteredArmaments.map((armament) => {
              const hostNames = armament.hostIds.map((id) => PLATFORMS.find((item) => item.id === id)?.short || AIRCRAFT.find((item) => item.id === id)?.short || id);
              const canAdd = hasSelectedAffiliation(armament.warfare, selectedWarfare);
              const descriptionId = `eligibility-${armament.id}`;
              const disabledReason = `First identify one affiliated warfare area: ${warfareAreaNames(armament.warfare)}.`;
              const selected = selectedArmaments[armament.id] || 0;
              const credited = metrics.armamentFit.creditedByArmament[armament.id] || 0;
              const missionCredited = metrics.pointCredit.missionCreditedArmaments[armament.id] || 0;
              const hostAssignments = Object.entries(metrics.armamentFit.assignmentsByArmament[armament.id] || {}).map(([id, count]) => `${PLATFORMS.find((item) => item.id === id)?.short || AIRCRAFT.find((item) => item.id === id)?.short || id} ×${count}`);
              const titleId = `roster-title-${armament.id}`;
              const compatibilityId = `compatibility-${armament.id}`;
              const creditId = `credit-${armament.id}`;
              return (
                <article className="roster-row armament-row" key={armament.id} role="listitem" aria-labelledby={titleId} aria-describedby={`${descriptionId} ${compatibilityId} ${creditId}`}>
                  <div className="armament-icon" aria-hidden="true"><span /></div>
                  <div className="roster-copy">
                    <strong id={titleId} role="heading" aria-level={3}>{armament.short}</strong><span>{armament.name}</span><small>{armament.points} eligible pts when paired · {armament.role}</small>
                    <details className="roster-details"><summary>REACH &amp; PAIRINGS</summary><small className="system-profile">NOTIONAL REACH · {armament.reach} · TRACKS · {armament.trackCapacity} · TRACKING · {armament.trackingMethods.join(" / ")}</small><small className="pairing-summary">HOSTS · {hostNames.join(" · ")}</small><small className="assignment-summary">PAIRED TO · {hostAssignments.join(" · ") || "no compatible selected host"}</small></details>
                    <small id={descriptionId} className={canAdd ? "eligibility-status" : "eligibility-status locked"}>WARFARE AFFILIATION · {warfareAreaNames(armament.warfare)}{canAdd ? "" : " · SELECT AN AFFILIATED AREA TO ADD"}</small>
                    <small id={compatibilityId} className={selected > credited ? "credit-status invalid" : "credit-status"}>COMPATIBILITY · {credited}/{selected}</small>
                  <small id={creditId} className={selected > missionCredited ? "credit-status invalid" : "credit-status"}>MISSION CREDIT · {missionCredited}/{selected}</small>
                  </div>
                  <Counter value={selectedArmaments[armament.id] || 0} canAdd={canAdd} disabledReason={disabledReason} descriptionId={`${descriptionId} ${compatibilityId} ${creditId}`} onBlocked={setForceStatus} onChange={(value) => { sessionActions.updateForceCount("selectedArmaments", armament.id, value); setForceStatus(`${armament.short} selection updated.`); }} label={armament.name} />
                </article>
              );
            })}
            {visibleRosterCount === 0 && <p className="empty-roster">No items match this search and filter.</p>}
          </div>

          <div className="readiness">
            <div className="section-title"><span><small>05</small> DECISIONS COMPLETE</span><i>{decisionCompletion}%</i></div>
            <div className="meter" role="progressbar" aria-label="Decision completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={decisionCompletion}><i style={{ width: `${decisionCompletion}%` }} /></div>
            <dl className="metric-grid" aria-label="Force readiness measures">
              <div><dt><span>NOTIONAL MANNING</span></dt><dd><strong>{(metrics.surfaceCrew + metrics.aircrew + metrics.aviationSupport).toLocaleString()}</strong><small>{metrics.surfaceCrew.toLocaleString()} ship · {metrics.aircrew} aircrew · {metrics.aviationSupport} support</small></dd></div>
              <div><dt><span>PAIRED AIRCRAFT</span></dt><dd><strong>{metrics.aviationFit.supportedAircraft}/{metrics.aviationFit.totalAircraft}</strong><small>{assessment.deckLoad}% of compatible deck space used</small></dd></div>
              <div><dt><span>PAIRED LOADOUTS</span></dt><dd><strong>{metrics.armamentFit.totalCredited}/{metrics.armamentFit.totalSelected}</strong><small>credited pairings</small></dd></div>
              <div><dt><span>AREA-DEFENCE SCREEN</span></dt><dd><strong>{metrics.airDefenseShips}/{scenario.minimumAirDefense}</strong><small>required escorts</small></dd></div>
              <div><dt><span>ASW ASSETS</span></dt><dd><strong>{metrics.aswAssets}/{scenario.minimumAsw}</strong><small>required units</small></dd></div>
              <div><dt><span>UNCREWED REACH</span></dt><dd><strong>{metrics.uncrewedAircraft}/{scenario.minimumUncrewed}</strong><small>air systems required</small></dd></div>
              <div><dt><span>ENVIRONMENT FIT</span></dt><dd><strong>{forceAdaptation.score}/100</strong><small>{forceAdaptation.label}</small></dd></div>
            </dl>
            <section className={`readiness-review ${fullyReady ? "ready" : "gaps"}`} aria-labelledby="readiness-title">
              <div><strong id="readiness-title">{fullyReady ? "READY FOR COMMAND" : "READINESS REVIEW"}</strong><span>{fullyReady ? "All modeled requirements pass." : `${readinessGaps.length} likely failure point${readinessGaps.length === 1 ? "" : "s"}`}</span></div>
              {!fullyReady && <ul>{readinessGaps.slice(0, 8).map((gap) => <li key={gap}>{gap}</li>)}</ul>}
            </section>
          </div>
          <button className="launch-button" type="button" onClick={startRigidGame}><span>{fullyReady ? "BEGIN SIX-TURN COMMAND PHASE" : "REVIEW & BEGIN COMMAND PHASE"}</span><b>→</b></button>
        </aside>
        )}
      </section>
      </div>

      {storageMode === "undecided" && (
        <PrivacyGate
          hydrated={hydrated}
          difficulty={difficulty}
          onDifficultyChange={sessionActions.setDifficulty}
          saveName={saveName}
          onSaveNameChange={setSaveName}
          saveWrittenAnalysis={saveWrittenAnalysis}
          onSaveWrittenAnalysisChange={setSaveWrittenAnalysis}
          savedSlots={savedSlots}
          status={saveStatus}
          sessionButtonRef={privacySessionButtonRef}
          onBeginSession={beginWithoutSaving}
          onBeginSaved={() => beginSavedGame(false)}
          onLoad={loadBrowserGame}
          onKeyDown={(event) => handleDialogKeyDown(event)}
        />
      )}
      {fieldGuideOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={closeGuide}>
          <section className="field-guide" role="dialog" aria-modal="true" aria-labelledby="guide-title" aria-describedby="guide-intro" tabIndex={-1} onKeyDown={(event) => handleDialogKeyDown(event, closeGuide)} onMouseDown={(event) => event.stopPropagation()}>
            <div className="guide-header"><div><span>FICTIONAL SIMULATION</span><h2 id="guide-title">FIELD GUIDE</h2></div><button type="button" autoFocus onClick={closeGuide} aria-label="Close field guide">×</button></div>
            <p id="guide-intro" className="guide-intro">Open only the reference section you need. Names, personnel, capacity, points, contacts, and readiness thresholds are invented; the allocation is always 100 points.</p>
            <div className="guide-grid">
              <details>
                <summary>WARFARE AREAS</summary>
                {WARFARE.map((item) => <p key={item.id}><b>{item.label}</b><span>{item.detail}</span></p>)}
              </details>
              <details>
                <summary>PLATFORM NOTES</summary>
                {PLATFORMS.map((item) => {
                  const aircraftPairs = AIRCRAFT.filter((aircraft) => item.aviationKinds.includes(aircraft.kind)).map((aircraft) => aircraft.short);
                  const armamentPairs = ARMAMENTS.filter((armament) => armament.hostIds.includes(item.id)).map((armament) => armament.short);
                  return <p key={item.id}><b>{item.short}</b><span>{item.note} <em>Accomplishes: {item.capabilities.join("; ")}.</em> {item.aviationCapacity ? `Its ${item.aviationCapacity} shared air spaces accept ${aircraftPairs.join(", ")}.` : "It has no aviation capacity in this model."} Compatible armament packs: {armamentPairs.join(", ") || "none; its contribution is command, transport, or aviation support"}.</span></p>;
                })}
              </details>
            </div>
            <details className="guide-armaments">
              <summary>AIRCRAFT, LOADOUTS &amp; PAIRINGS</summary>
              <h3>AIRCRAFT ACCOMPLISHMENTS &amp; DECK PAIRINGS</h3>
              {AIRCRAFT.map((item) => <p key={item.id}><b>{item.short}</b><span>{item.capabilities.join("; ")}. Notional mission reach: {item.missionReach}; tracks: {item.trackCapacity}; tracking: {item.trackingMethods.join(", ")}. Compatible decks: {PLATFORMS.filter((platform) => platform.aviationKinds.includes(item.kind)).map((platform) => platform.short).join(", ")}. Compatible packs: {ARMAMENTS.filter((armament) => armament.hostIds.includes(item.id)).map((armament) => armament.short).join(", ") || "none"}.</span></p>)}
              <h3>SELECTABLE ARMAMENT PACKS &amp; HOSTS</h3>
              {DISPLAY_ARMAMENTS.map((item) => <p key={item.id}><b>{item.short}</b><span>{item.role} Notional reach: {item.reach}; tracks: {item.trackCapacity}; tracking: {item.trackingMethods.join(", ")}. Compatible hosts: {item.hostIds.map((id) => PLATFORMS.find((platform) => platform.id === id)?.short || AIRCRAFT.find((aircraft) => aircraft.id === id)?.short || id).join(", ")}.</span></p>)}
              <small>All packs remain in one alphabetized catalog rather than being grouped by vessel, aircraft, or submarine. Each count represents an abstract mission pack, not a weapon quantity. Every distance and track capacity is invented; names express generic functions and do not identify a manufacturer, real inventory, exact weapon, magazine, seeker, performance, or current loadout.</small>
            </details>
            <details className="guide-rule"><summary>WHAT COUNTS TOWARD THE MISSION</summary><p>A selection earns credit only when it fits the mission and has the support it needs. Aircraft need suitable deck space, and mission packs need a compatible host. Unsupported selections can remain in the force, but they add no mission coverage. Environmental fit also matters: a force suited to open water may be a poor fit for restricted water, severe weather, or lane opening.</p></details>
            <details className="guide-rule"><summary>HOW A SCENARIO IS ACCEPTED</summary><p>Each new scenario is built as a complete situation, then checked for consistency. Region, season, light, weather, sea, geography, mission, actors, force needs, and objectives must all be able to coexist. If they cannot, the entire candidate is discarded and another is generated.</p></details>
            <details className="guide-rule"><summary>UNCREWED &amp; UNDERSEA EMPLOYMENT</summary><p>Uncrewed systems contribute only when their hosts and mission pairings receive credit. Distributed scouting, deception swarms, attritable massing, and autonomous lane control solve different problems. Independent patrols, coordinated wolfpacks, barrier ambushes, and protective screens likewise depend on force size, cueing, deconfliction, geography, season, light, weather, and political purpose. A wolfpack without at least two credited undersea elements incurs coordination and escalation penalties.</p></details>
            <details className="guide-rule"><summary>HOW COMMAND TURNS WORK</summary><p>Choose how the force moves, senses, coordinates, manages risk, and acts. Range, contact, force condition, supply, objective progress, and escalation show the result. Faster or more forceful choices can help the mission while costing supply or increasing danger; cautious choices can preserve the force while losing time. The same saved state and orders always reproduce the same outcome, so Undo supports comparison rather than rerolling.</p></details>
            <details className="guide-rule"><summary>STRATEGIC FIT</summary><p>The force and its purpose must agree with the brief. Choose an end state, approaches, and a guardrail that support one another. Optional writing is saved for you and never scored. Results describe this fictional model, not real-world odds.</p></details>
            <details className="guide-disclaimer"><summary>MODEL &amp; PLAY BOUNDARIES</summary><p>This is a notional educational model. It does not provide current doctrine, readiness, disposition, targeting, or operational recommendations. The fictional abstraction is intentionally simplified; differences from real-world practice are not claims about current capability.</p></details>
            <details className="guide-rule"><summary>MISSION CREDIT &amp; LEARNING</summary><p>Only connected, compatible selections tied to an identified warfare area earn mission credit. During play, the interface keeps this rule compact. After a decision resolves, the result explains the evidence and offers a focused adjustment when one is supported; when no clear mistake is indicated, it says so rather than inventing one. The full scoring and pairing explanation remains here.</p></details>
            <details className="guide-rule guide-documents"><summary>DOCUMENTATION</summary><p>Open a focused reference in a new tab. These documents explain play and trust boundaries without exposing internal design research.</p><nav aria-label="Field Guide documentation"><a href="./docs/HOW-THE-GAME-WORKS.md" target="_blank" rel="noreferrer">HOW THE GAME WORKS</a><a href="./docs/SECURITY-PRIVACY-AND-SAVES.md" target="_blank" rel="noreferrer">SECURITY, PRIVACY &amp; SAVES</a><a href="./docs/ACCESSIBILITY-AND-CONTROLS.md" target="_blank" rel="noreferrer">ACCESSIBILITY &amp; CONTROLS</a><a href="./third-party-notices.txt" target="_blank" rel="noreferrer">OPEN-SOURCE NOTICES</a></nav></details>
            <details className="guide-disclaimer"><summary>INDEPENDENT / NO ENDORSEMENT</summary><p>Not affiliated with, sponsored by, approved by, or endorsed by any government agency or manufacturer. Every platform, system, capacity, and personnel figure is fictionalized. Any discrepancy in realism reflects the developer&apos;s subject-matter inexperience and deliberate abstraction.</p></details>
          </section>
        </div>
      )}
      {dataOpen && (
        <SaveManager
          headingRef={dataHeadingRef}
          backgroundInert={Boolean(pendingConfirmation)}
          storageMode={storageMode}
          saveName={saveName}
          includeWrittenAnalysis={saveWrittenAnalysis}
          status={saveStatus}
          operation={scenario.operation}
          exercise={scenario.id}
          history={history}
          activeSlotId={activeSlotId}
          slots={savedSlots}
          onClose={closeData}
          onDialogKeyDown={(event) => handleDialogKeyDown(event, closeData)}
          onSaveNameChange={setSaveName}
          onIncludeWrittenAnalysisChange={setSaveWrittenAnalysis}
          onDisableSaving={disableBrowserSaving}
          onEnableSaving={() => beginSavedGame(false)}
          onExport={exportSave}
          onImport={(file) => { void importSave(file); }}
          onNewGame={requestFreshGame}
          onLoad={loadBrowserGame}
          onDelete={requestDeleteBrowserGame}
          onResetAll={requestResetAll}
        />
      )}
      {academyOpen && <Academy initialModuleId={academyTarget} onClose={closeAcademy} completed={academyProgress} onCompletedChange={sessionActions.setAcademyProgress} savingEnabled={storageMode === "enabled"} />}
      {creditsOpen && <div className="modal-backdrop" role="presentation" onMouseDown={closeCredits}><section className="credits-dialog" role="dialog" aria-modal="true" aria-labelledby="credits-title" aria-describedby="credits-summary" tabIndex={-1} onKeyDown={event => handleDialogKeyDown(event, closeCredits)} onMouseDown={event => event.stopPropagation()}><div className="guide-header"><div><span>OPEN-SOURCE CREDITS</span><h2 id="credits-title">CREDITS &amp; LICENSES</h2></div><button type="button" autoFocus onClick={closeCredits} aria-label="Close credits">×</button></div><div className="credits-grid"><article><strong>TYPOGRAPHY</strong><p>Jost variable font by the Jost Project Authors, distributed through Fontsource under the SIL Open Font License 1.1.</p></article><article><strong>CORE SOFTWARE</strong><p>React, React DOM, Three.js, Astronomy Engine, and the static build tooling are distributed under reviewed open-source licenses.</p></article><article><strong>SOUND</strong><p>Original browser-synthesized ambiance and effects. No recordings, samples, vocals, streams, or external audio requests.</p></article><article><strong>VISUALS</strong><p>Original low-poly geometry and interface artwork. The aurora engine adapts the MIT-licensed progressive domain-warp technique from FastNoise Lite by Jordan Peck and contributors; full attribution and license text are included below.</p></article></div><p id="credits-summary">The download includes exact package versions, license identifiers, source locations, notices, and full license texts in the generated third-party inventory.</p><nav className="credit-links" aria-label="License documents"><a href="./third-party-notices.txt" target="_blank" rel="noreferrer" aria-label="Review third-party notices (opens in a new tab)">REVIEW THIRD-PARTY NOTICES</a><a href="./third-party-licenses.txt" target="_blank" rel="noreferrer" aria-label="Review runtime license texts (opens in a new tab)">REVIEW RUNTIME LICENSE TEXTS</a></nav></section></div>}
      {pendingConfirmation && (
        <ConfirmDialog
          title={pendingConfirmation.title}
          description={pendingConfirmation.description}
          confirmLabel={pendingConfirmation.confirmLabel}
          destructive={pendingConfirmation.destructive}
          opener={pendingConfirmation.opener}
          onCancel={() => setPendingConfirmation(null)}
          onConfirm={() => {
            const action = pendingConfirmation.action;
            setPendingConfirmation(null);
            action();
          }}
        >
          {pendingConfirmation.details?.length ? <ul className="confirm-details">{pendingConfirmation.details.map((item) => <li key={item}>{item}</li>)}</ul> : null}
        </ConfirmDialog>
      )}
    </main>
  );
}
