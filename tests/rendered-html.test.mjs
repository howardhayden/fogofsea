import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relative) => readFile(new URL(relative, import.meta.url), "utf8");

test("static shell and host headers enforce the browser privacy boundary", async () => {
  const [index, headers, page, entry, packageSource, privacyGate, releaseQa] = await Promise.all([
    read("../index.html"),
    read("../public/_headers"),
    read("../app/page.tsx"),
    read("../app/main.tsx"),
    read("../package.json"),
    read("../app/PrivacyGate.tsx"),
    read("../RELEASE_QA.md"),
  ]);
  const policy = `${index}\n${headers}`;
  const documentBuildMarker = index.match(/<meta name="fog-of-sea-build" content="([^"]+)"/i)?.[1];
  const qaBuildMarker = releaseQa.match(/Build marker: `([^`]+)`/)?.[1];
  assert.match(documentBuildMarker ?? "", /^\d{4}-\d{2}-\d{2}-vscodium-\d+$/);
  assert.equal(qaBuildMarker, documentBuildMarker);
  assert.doesNotMatch(privacyGate, /LOCAL BUILD/i);
  assert.doesNotMatch(index, /LOCAL START REQUIRED|FOG OF SEA has not started|Open this extracted folder|Live Server/i);
  assert.match(index, /Loading the maritime strategy lab/i);
  assert.match(policy, /connect-src 'none'/i);
  assert.match(policy, /frame-src 'none'/i);
  assert.match(policy, /object-src 'none'/i);
  assert.doesNotMatch(policy, /unsafe-inline|unsafe-eval/i);
  assert.match(headers, /Referrer-Policy: no-referrer/i);
  assert.match(headers, /camera=\(\).*microphone=\(\).*geolocation=\(\).*payment=\(\)/i);
  assert.match(index, /app\/main\.tsx/);
  assert.match(entry, /createRoot/);
  assert.match(packageSource, /"build": "vite build"/);
  assert.doesNotMatch(page, /className="independence-banner"/i);
  assert.doesNotMatch(page, /no account · no trackers|Session-only play · TXT export available/i);
  assert.match(page, /saveFailed \? <div className="save-indicator error" role="alert"/i);
});

test("GitHub Pages builds and deploys the optimized artifact from main", async () => {
  const [workflow, viteConfig, deploymentGuide] = await Promise.all([
    read("../.github/workflows/main.yml"),
    read("../vite.config.ts"),
    read("../DEPLOY-GITHUB-PAGES.md"),
  ]);
  assert.match(workflow, /push:\s*[\s\S]*branches:\s*[\s\S]*- main/);
  assert.match(workflow, /run: npm ci/);
  assert.match(workflow, /run: npm run check/);
  assert.match(workflow, /actions\/upload-pages-artifact@v3[\s\S]*path: \.\/dist/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
  assert.match(viteConfig, /base:\s*["']\.\/["']/);
  assert.match(deploymentGuide, /Settings[^\n]*Pages/i);
  assert.match(deploymentGuide, /fogofsea\.app/i);
  assert.match(deploymentGuide, /public\/docs/i);
  assert.match(deploymentGuide, /_headers/i);
});

test("first-play gate exposes privacy, saved games, and three distinct play modes", async () => {
  const page = `${await read("../app/page.tsx")}\n${await read("../app/PrivacyGate.tsx")}`;
  assert.match(page, /PRIVACY BEFORE PLAY/);
  assert.match(page, /PLAY WITHOUT BROWSER SAVING/);
  assert.match(page, /ENABLE SAVING &amp; BEGIN/);
  assert.match(page, /SAVED GAMES ON THIS BROWSER/);
  assert.match(page, /id: "guided"/);
  assert.match(page, /id: "standard"/);
  assert.match(page, /id: "challenge"/);
  assert.match(page, /scenarioForDifficulty/);
  assert.match(page, /GUIDED MODE/);
  assert.match(page, /NEXT ACTION/);
  assert.match(page, /readinessGaps/);
});

test("dense instructional copy begins behind native progressive disclosures", async () => {
  const [page, academy, command, debrief] = await Promise.all([
    read("../app/page.tsx"),
    read("../app/Academy.tsx"),
    read("../app/CommandPanel.tsx"),
    read("../app/ResultDebrief.tsx"),
  ]);
  assert.match(page, /guidedChecklistCollapsed: true/);
  assert.match(page, /id="mission-brief-details"[^>]*hidden=\{!briefOpen\}/);
  assert.match(page, /<details className="guide-armaments">/);
  assert.match(page, /<details className="guide-rule"><summary>HOW A SCENARIO IS ACCEPTED/);
  assert.match(academy, /<details className="lesson-body">/);
  assert.match(academy, /<details className="academy-disclosure">/);
  assert.match(academy, /<details className="reading-list">/);
  assert.match(command, /<details className="kriegsspiel-report">\s*<summary>LAST TURN/);
  assert.doesNotMatch(command, /<details className="kriegsspiel-report" open>/);
  assert.doesNotMatch(command, /HOW THIS TURN IS ADJUDICATED|umpireNotes\.map|matrixPreview/);
  assert.match(page, /className="guide-rule guide-documents"/);
  assert.match(page, /HOW-THE-GAME-WORKS\.md/);
  assert.match(page, /SECURITY-PRIVACY-AND-SAVES\.md/);
  assert.match(page, /ACCESSIBILITY-AND-CONTROLS\.md/);
  assert.match(debrief, /<details className="score-breakdown">/);
  assert.match(command, /turnLearningNote\(latestReport\)/);
  assert.match(debrief, /outcomeLearningAssessment\(state\)/);
  assert.match(debrief, /<details className="debrief-findings" open=\{learning\.kind === "adjustment"\}>/);
});

test("Academy presents one coherent vertical scroll surface and hides inactive views", async () => {
  const [academy, css] = await Promise.all([
    read("../app/Academy.tsx"),
    read("../app/globals.css"),
  ]);
  assert.match(academy, /ref=\{scrollSurfaceRef\} className="academy-scroll-surface"/);
  assert.match(academy, /className="path-tabs"[^>]*hidden=\{view !== "course"\}/);
  assert.match(css, /\.academy-scroll-surface\s*\{[^}]*overflow-y:\s*auto/i);
  assert.match(css, /\.academy-scroll-surface\s*>\s*\[role="tabpanel"\]\[hidden\][^}]*display:\s*none/i);
  assert.doesNotMatch(css, /\.lesson\s*\{[^}]*overflow-y:\s*auto/i);
  assert.doesNotMatch(css, /\.module-list\s*\{[^}]*overflow-y:\s*auto/i);
  assert.doesNotMatch(css, /\.academy-reference\s*\{[^}]*overflow-y:\s*auto/i);
  assert.match(css, /--glass-panel-mix:\s*63%/i);
  assert.match(css, /--glass-surface-background:\s*linear-gradient\(145deg,\s*var\(--glass-highlight\)[\s\S]*?color-mix\(in srgb,\s*var\(--panel\)\s*var\(--glass-panel-mix\),\s*transparent\)/i);
  assert.match(css, /\.app :is\([\s\S]*?\.topbar[\s\S]*?\.mission-panel[\s\S]*?\.field-guide[\s\S]*?\.academy[\s\S]*?\.result-card[\s\S]*?\)\s*\{[^}]*background:\s*var\(--glass-surface-background\)[^}]*backdrop-filter:\s*var\(--glass-surface-filter\)/i);
  assert.match(css, /\.app :is\(\.modal-backdrop,\s*\.academy-backdrop\)\s*\{[^}]*background:\s*var\(--overlay-scrim-background\)[^}]*backdrop-filter:\s*var\(--overlay-scrim-filter\)/i);
  assert.match(css, /\.academy :where\([^}]*\.academy-header[^}]*backdrop-filter:\s*none/i);
});

test("destructive actions use a cancel-first confirmation surface", async () => {
  const [page, dialog, saveManager] = await Promise.all([read("../app/page.tsx"), read("../app/ConfirmDialog.tsx"), read("../app/SaveManager.tsx")]);
  assert.match(page, /requestFreshGame/);
  assert.match(page, /requestDeleteBrowserGame/);
  assert.match(page, /requestReturnToPlanning/);
  assert.match(dialog, /cancelRef/);
  assert.match(dialog, /restoreOnCloseRef/);
  assert.match(page, /opener=\{pendingConfirmation\.opener\}/);
  assert.match(page, /backgroundInert=\{Boolean\(pendingConfirmation\)\}/);
  assert.match(saveManager, /inert=\{backgroundInert \? true : undefined\}/);
  assert.match(dialog, /aria-modal="true"/);
  assert.match(dialog, /getClientRects\(\)\.length/);
  assert.match(dialog, /event\.key === "Escape"/);
});

test("classification integrity, undo, and evidence-rich debrief remain wired", async () => {
  const [page, engine, debrief, planning] = await Promise.all([
    read("../app/page.tsx"),
    read("../app/kriegsspiel.ts"),
    read("../app/ResultDebrief.tsx"),
    read("../app/planningAssessment.ts"),
  ]);
  assert.match(planning, /falseIdentification\.length === 0/);
  assert.match(page, /undoLastTurn/);
  assert.match(debrief, /WHAT TO LEARN/);
  assert.match(debrief, /ONE ADJUSTMENT/);
  assert.match(debrief, /state\.maxTurns}-TURN TIMELINE/);
  assert.match(debrief, /OPEN RELATED LESSON/);
  assert.match(debrief, /RETRY SAME SCENARIO/);
  assert.match(engine, /export function undoRigidTurn/);
  assert.match(engine, /RigidScoreBreakdown/);
  assert.match(engine, /RigidDiagnosticFinding/);
  assert.doesNotMatch(engine, /Math\.random|Date\.now|theorySynthesis|rationale|assumptions|termination/);
});

test("portable saves are v3, device-local, environment-complete, and prose-preserving", async () => {
  const [page, save, browserSaves, saveHook, saveManager] = await Promise.all([
    read("../app/page.tsx"),
    read("../app/saveGame.ts"),
    read("../app/browserSaves.ts"),
    read("../app/useBrowserSaveManager.ts"),
    read("../app/SaveManager.tsx"),
  ]);
  assert.match(save, /version: 3/);
  assert.match(save, /scenarioDate/);
  assert.match(save, /windHeading/);
  assert.match(save, /currentHeading/);
  assert.match(save, /waveHeading/);
  assert.match(save, /soundProfile/);
  assert.match(save, /checklistCollapsed/);
  assert.match(save, /RIGID UMPIRE TURN RECORD/);
  assert.match(save, /NEVER SCORED/);
  assert.match(browserSaves, /window\.localStorage/);
  assert.match(browserSaves, /includeWrittenAnalysis/);
  assert.match(browserSaves, /portableSaveContainsWrittenAnalysis/);
  assert.match(saveHook, /setTimeout\(\(\) => \{/);
  assert.match(saveManager, /tabIndex=\{-1\}/);
  assert.match(page, /useBrowserSaveManager/);
});

test("domain actions, extracted orchestration, and browser behavior suites remain explicit", async () => {
  const [session, page, forceReadiness, browserSuite, packageSource] = await Promise.all([
    read("../app/useGameSession.ts"),
    read("../app/page.tsx"),
    read("../app/forceReadiness.ts"),
    read("./browser/accessibility.spec.ts"),
    read("../package.json"),
  ]);
  for (const action of ["restore-save", "reset-session", "change-scenario", "update-force-count", "begin-command", "resolve-turn", "undo-turn"]) {
    assert.match(session, new RegExp(`type: "${action}"`));
  }
  assert.doesNotMatch(session, /set-field|unknown|as GameSessionState/);
  assert.match(session, /useReducer\(gameSessionReducer, initializer, initializeGameSession\)/);
  assert.match(session, /const actions = useMemo<GameSessionActions>/);
  assert.match(page, /useGameSession\(\(\) => createEmptySession\(INITIAL_SCENARIO, "guided"\)\)/);
  assert.match(page, /deriveForceReadiness/);
  assert.doesNotMatch(page, /evaluatePlanningReadiness/);
  assert.match(forceReadiness, /evaluatePlanningReadiness/);
  assert.match(page, /beginCommandTransition/);
  assert.match(page, /useBrowserSaveManager/);
  assert.match(page, /<SaveManager/);
  assert.match(browserSuite, /toBeFocused|horizontal page overflow|third-party requests/);
  assert.match(packageSource, /"verify:browser-suite": "playwright test --list"/);
});

test("keyboard, focus, target size, and responsive disclosure protections are present", async () => {
  const [page, academy, battlefield, css] = await Promise.all([
    read("../app/page.tsx"),
    read("../app/Academy.tsx"),
    read("../app/Battlefield.tsx"),
    read("../app/globals.css"),
  ]);
  assert.match(page, /skipTarget/);
  assert.match(page, /href=\{skipTarget\}/);
  assert.match(academy, /aria-current=\{active\.id === module\.id/);
  assert.match(academy, /type="radio" name=\{`quiz-/);
  assert.match(academy, /Scrollable thinker comparison table/);
  assert.match(battlefield, /keyboardTelemetry/);
  assert.match(battlefield, /aria-live="polite"/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /\.workspace\.mobile-view-visualization \.tactical-panel[^}]*display:\s*block/i);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /comparison-table-wrap:focus-visible/);
});

test("visualization uses five rotatable views and fixed fictional environment data", async () => {
  const [battlefield, viewModel, page] = await Promise.all([
    read("../app/Battlefield.tsx"),
    read("../app/viewModel.ts"),
    read("../app/page.tsx"),
  ]);
  assert.match(viewModel, /\["stars", "sky", "air", "surface", "subsurface"\]/);
  assert.match(viewModel, /minAzimuthAngle|VIEW_CONFIG|subsurface/s);
  assert.match(battlefield, /getCelestialState\(scenarioDate, time, observerLatitude, observerLongitude\)/);
  assert.match(battlefield, /document\.hidden/);
  assert.match(battlefield, /1000 \/ 30/);
  assert.match(battlefield, /baseX/);
  assert.match(page, /windHeading=\{scenario\.windHeading\}/);
  assert.match(page, /currentHeading=\{scenario\.currentHeading\}/);
});

test("sound controls call the procedural background track ambiance", async () => {
  const soundscape = await read("../app/Soundscape.tsx");
  assert.match(soundscape, /<span>AMBIANCE<\/span>/);
  assert.match(soundscape, /Enable quiet ambiance and sound effects/);
  assert.doesNotMatch(soundscape, /lo[ -]?fi/i);
  assert.doesNotMatch(soundscape, /music button/i);
});

test("the abstract identity uses a low-poly bull and sharp three-prong anchor in both theme variants", async () => {
  const [page, css, html, icon, dayIcon] = await Promise.all([
    read("../app/page.tsx"),
    read("../app/globals.css"),
    read("../index.html"),
    read("../public/favicon.svg"),
    read("../public/favicon-day.svg"),
  ]);
  for (const source of [icon, dayIcon]) {
    assert.match(source, /data-brand-symbol="bull-pointed-anchor"/);
    assert.match(source, /aria-label="[^"]*faceted bull and pointed anchor/i);
    assert.match(source, /class="brand-bull"/);
    assert.match(source, /class="brand-anchor"/);
    assert.match(source, /stroke-linejoin="miter"/);
    assert.match(source, /M49 54V21.*M42 31V23.*M56 31V23/s);
    assert.doesNotMatch(source, /Layered fog and waves|M8 20c9-6/i);
  }
  assert.notEqual(icon, dayIcon);
  assert.match(page, /data-brand-symbol="bull-pointed-anchor"/);
  assert.match(page, /className="brand-bull"/);
  assert.match(page, /className="icon-anchor"/);
  assert.doesNotMatch(page, /icon-fog-back|icon-fog-front/);
  assert.match(css, /\.brand-icon \.icon-horn/);
  assert.match(css, /\.brand-icon \.icon-anchor[^}]*stroke-linejoin:\s*miter/s);

  const faviconLinks = html.match(/<link\s+[^>]*rel="icon"[^>]*>/g) ?? [];
  assert.ok(faviconLinks.some((link) => /href="\/favicon\.svg"/.test(link) && /media="\(prefers-color-scheme:\s*dark\)"/.test(link)));
  assert.ok(faviconLinks.some((link) => /href="\/favicon-day\.svg"/.test(link) && /media="\(prefers-color-scheme:\s*light\)"/.test(link)));
});

test("independent curriculum keeps comparison, primary reading, and application paths", async () => {
  const source = `${await read("../app/Academy.tsx")}\n${await read("../app/academyData.ts")}\n${await read("../app/page.tsx")}`;
  const encodedNames = [
    "S2luZydzIENvbGxlZ2U=",
    "ZWRY",
    "TUlMSDMwNA==",
    "TUlMSDUxMQ==",
  ];
  for (const encoded of encodedNames) {
    const term = Buffer.from(encoded, "base64").toString("utf8");
    assert.equal(source.toLocaleLowerCase().includes(term.toLocaleLowerCase()), false);
  }
  assert.match(source, /THINKERS IN CONTEXT/);
  assert.match(source, /POSSIBLE COMBINATION/);
  assert.match(source, /comparative maritime-theory problem/i);
  assert.match(source, /READING TRAIL/);
  assert.match(source, /APPLY TO THE GAME/);
});
