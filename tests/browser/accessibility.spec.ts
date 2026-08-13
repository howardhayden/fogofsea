import { expect, test, type Locator, type Page } from "@playwright/test";

async function openSession(page: Page) {
  await page.goto("/");
  const privacyDialog = page.getByRole("dialog", { name: "HOW SHOULD THIS GAME REMEMBER YOU?" });
  await expect(privacyDialog).toBeVisible();
  const sessionButton = page.getByRole("button", { name: "PLAY WITHOUT BROWSER SAVING" });
  await expect(sessionButton).toBeFocused();
  await sessionButton.press("Enter");
  await expect(privacyDialog).toBeHidden();
}

async function chooseMobileWorkspaceIfPresent(page: Page, name: string) {
  const gamebar = page.locator(".mobile-gamebar");
  if (!await gamebar.isVisible()) return;
  const summary = page.locator(".mobile-disclosure summary");
  await summary.focus();
  await summary.press("Enter");
  const destination = page.locator(".mobile-disclosure").getByRole("button", { name, exact: true });
  await destination.focus();
  await destination.press("Enter");
}

async function openAcademyResponsively(page: Page) {
  const gamebar = page.locator(".mobile-gamebar");
  if (await gamebar.isVisible()) {
    const summary = page.locator(".mobile-disclosure summary");
    await summary.focus();
    await summary.press("Enter");
    const academyButton = page.locator(".mobile-disclosure").getByRole("button", { name: "ACADEMY", exact: true });
    await academyButton.focus();
    await academyButton.press("Enter");
    return summary;
  }
  const button = page.locator(".topbar .academy-button");
  await button.focus();
  await button.press("Enter");
  return button;
}

async function openSaveResponsively(page: Page) {
  const gamebar = page.locator(".mobile-gamebar");
  if (await gamebar.isVisible()) {
    const summary = page.locator(".mobile-disclosure summary");
    await summary.focus();
    await summary.press("Enter");
    const saveButton = page.locator(".mobile-disclosure").getByRole("button", { name: "SAVE / LOAD", exact: true });
    await saveButton.focus();
    await saveButton.press("Enter");
    return;
  }
  const saveButton = page.locator(".topbar .data-button");
  await saveButton.focus();
  await saveButton.press("Enter");
}

async function openSoundSettingsResponsively(page: Page) {
  const directSummary = page.locator(".sound-settings > summary");
  if (await directSummary.isVisible()) {
    await directSummary.focus();
    await directSummary.press("Enter");
    return directSummary;
  }
  const globalTools = page.locator(".global-tools-menu");
  const globalToolsSummary = globalTools.locator(":scope > summary");
  await globalToolsSummary.focus();
  await globalToolsSummary.press("Enter");
  const soundSettingsButton = globalTools.getByRole("button", { name: "SOUND SETTINGS", exact: true });
  await soundSettingsButton.focus();
  await soundSettingsButton.press("Enter");
  return globalToolsSummary;
}

async function completeStrategyWithKeyboard(page: Page) {
  await chooseMobileWorkspaceIfPresent(page, "DECISIONS");
  const warfare = page.locator(".warfare-grid button").first();
  await warfare.focus();
  await warfare.press("Space");

  for (const selector of [
    "#strategic-end-state",
    "#strategic-primary-theory",
    "#strategic-partner-theory",
    "#strategic-guardrail",
  ]) {
    const select = page.locator(selector);
    await expect(select).toBeVisible();
    await select.focus();
    await select.press("ArrowDown");
  }
  await expect(page.locator("#strategic-guardrail")).toHaveCount(0);
}

async function expectSemanticDom(page: Page, phase: string) {
  const problems = await page.evaluate(() => {
    const all = [...document.querySelectorAll<HTMLElement>("*")];
    const ids = all.map((node) => node.id).filter(Boolean);
    const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
    const brokenIdRefs: string[] = [];
    for (const node of all) {
      for (const attribute of ["aria-controls", "aria-describedby", "aria-labelledby"]) {
        const references = node.getAttribute(attribute)?.trim().split(/\s+/).filter(Boolean) || [];
        for (const reference of references) {
          if (!document.getElementById(reference)) brokenIdRefs.push(`${attribute}:${reference}`);
        }
      }
    }

    const textFromIds = (value: string | null) => (value || "")
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim() || "")
      .join(" ")
      .trim();
    const controlSelector = "button, summary, a[href], input:not([type='hidden']), select, textarea";
    const unnamedControls = [...document.querySelectorAll<HTMLElement>(controlSelector)]
      .filter((node) => {
        const style = getComputedStyle(node);
        return !node.closest("[hidden]") && style.display !== "none" && style.visibility !== "hidden" && node.getClientRects().length > 0;
      })
      .filter((node) => {
        const labels = node instanceof HTMLInputElement || node instanceof HTMLSelectElement || node instanceof HTMLTextAreaElement
          ? [...node.labels || []].map((label) => label.textContent?.trim() || "").join(" ")
          : "";
        const name = node.getAttribute("aria-label")
          || textFromIds(node.getAttribute("aria-labelledby"))
          || labels
          || node.textContent?.trim()
          || node.getAttribute("title")
          || "";
        return !name.trim();
      })
      .map((node) => `${node.tagName.toLowerCase()}#${node.id || "(no-id)"}`);
    const focusableInHiddenContent = all
      .filter((node) => node.matches(controlSelector) && !node.hasAttribute("disabled") && node.tabIndex >= 0)
      .filter((node) => {
        const hiddenAncestor = node.closest<HTMLElement>("[aria-hidden='true']");
        if (!hiddenAncestor || hiddenAncestor.hasAttribute("inert")) return false;
        const style = getComputedStyle(node);
        return style.display !== "none" && style.visibility !== "hidden" && node.getClientRects().length > 0;
      })
      .map((node) => `${node.tagName.toLowerCase()}#${node.id || "(no-id)"}`);
    const unnamedDialogs = [...document.querySelectorAll<HTMLElement>("[role='dialog'], [role='alertdialog']")]
      .filter((node) => !(node.getAttribute("aria-label") || textFromIds(node.getAttribute("aria-labelledby"))))
      .map((node) => node.className);
    return { duplicateIds, brokenIdRefs, unnamedControls, focusableInHiddenContent, unnamedDialogs };
  });

  expect(problems, `${phase} semantic DOM contract`).toEqual({
    duplicateIds: [],
    brokenIdRefs: [],
    unnamedControls: [],
    focusableInHiddenContent: [],
    unnamedDialogs: [],
  });
}

async function expectAriaSnapshotContains(locator: Locator, words: string[]) {
  const snapshot = await locator.ariaSnapshot();
  for (const word of words) expect(snapshot).toContain(word);
}

test("privacy gate, dynamic skip target, and modal focus work from the keyboard", async ({ page }) => {
  await openSession(page);

  const skipLink = page.getByRole("link", { name: "Skip to mission workflow" });
  await skipLink.focus();
  await skipLink.press("Enter");
  await expect(page.locator("#mission-workflow")).toBeFocused();

  const newGame = page.getByRole("button", { name: /NEW GAME/ }).first();
  await newGame.focus();
  await newGame.press("Enter");
  const confirm = page.getByRole("alertdialog", { name: "Start a new game?" });
  const cancel = confirm.getByRole("button", { name: "CANCEL" });
  const proceed = confirm.getByRole("button", { name: "START NEW GAME" });
  await expect(cancel).toBeFocused();
  await cancel.press("Shift+Tab");
  await expect(proceed).toBeFocused();
  await proceed.press("Tab");
  await expect(cancel).toBeFocused();
  await cancel.press("Escape");
  await expect(confirm).toBeHidden();
  await expect(newGame).toBeFocused();

  const academyOpener = await openAcademyResponsively(page);
  const academy = page.getByRole("dialog", { name: "THE ACADEMY" });
  await expect(academy).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(academy).toBeHidden();
  await expect(academyOpener).toBeFocused();
});

test("progressive disclosure reveals one strategic decision at a time", async ({ page }) => {
  await openSession(page);
  await chooseMobileWorkspaceIfPresent(page, "DECISIONS");
  const strategicSteps = page.locator(".decision-steps > li");
  await expect(strategicSteps).toHaveCount(4);
  await expect(page.locator("#strategic-end-state")).toHaveCount(0);

  await page.locator(".warfare-grid button").first().click();
  const objective = page.locator("#strategic-end-state");
  await expect(objective).toBeVisible();
  await expect(page.locator("#strategic-primary-theory")).toHaveCount(0);

  await objective.selectOption("access");
  const primary = page.locator("#strategic-primary-theory");
  await expect(primary).toBeVisible();
  await primary.selectOption("sun-tzu");
  const partner = page.locator("#strategic-partner-theory");
  await expect(partner).toBeVisible();
  await partner.selectOption("clausewitz");
  const guardrail = page.locator("#strategic-guardrail");
  await expect(guardrail).toBeVisible();
  await guardrail.selectOption("escalation");

  const writing = page.getByText("OPTIONAL WRITTEN ANALYSIS · NEVER SCORED");
  await expect(writing).toBeVisible();
  await writing.click();
  await expect(page.getByLabel("COMMANDER'S LOGIC")).toBeVisible();
});

test("narrow reflow retains 44-pixel controls without horizontal page overflow", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Mobile geometry assertion");
  await openSession(page);
  const geometry = await page.evaluate(() => {
    const interactive = [...document.querySelectorAll<HTMLElement>("button, select, summary, a[href]")]
      .filter((node) => {
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      })
      .map((node) => ({ label: node.getAttribute("aria-label") || node.textContent?.trim().slice(0, 60) || node.tagName, height: node.getBoundingClientRect().height }))
      .filter((item) => item.height < 43.5);
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      undersized: interactive,
    };
  });
  expect(geometry.overflow).toBeLessThanOrEqual(1);
  expect(geometry.undersized).toEqual([]);
});

test("a two-hundred-percent-zoom-equivalent effective viewport triggers narrow reflow without horizontal page overflow", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Effective desktop viewport assertion");
  // Browser zoom reduces the effective CSS viewport. Playwright cannot set the
  // browser zoom control directly, so this checks the honest reflow analogue:
  // half of a 1280-pixel desktop viewport, without claiming that root font-size
  // mutation scales the application's pixel-based type.
  await page.setViewportSize({ width: 640, height: 450 });
  await openSession(page);
  await expect(page.locator(".mobile-gamebar")).toBeVisible();
  const geometry = await page.evaluate(() => ({
    documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    bodyOverflow: document.body.scrollWidth - innerWidth,
  }));
  expect(geometry.documentOverflow).toBeLessThanOrEqual(1);
  expect(geometry.bodyOverflow).toBeLessThanOrEqual(1);
});

test("the academy comparison region is keyboard-scrollable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "The comparison table needs horizontal scrolling only in the narrow layout");
  await openSession(page);
  await openAcademyResponsively(page);
  const lessons = page.getByRole("tab", { name: "LESSONS" });
  await lessons.focus();
  await lessons.press("ArrowRight");
  const comparison = page.getByRole("region", { name: "Scrollable thinker comparison table" });
  await comparison.focus();
  await expect(comparison).toBeFocused();
  await expect(comparison).toHaveAttribute("aria-keyshortcuts", "ArrowLeft ArrowRight");
  const overflow = await comparison.evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(overflow).toBeGreaterThan(0);
  const before = await comparison.evaluate((element) => element.scrollLeft);
  await comparison.press("ArrowRight");
  const after = await comparison.evaluate((element) => element.scrollLeft);
  expect(after).toBeGreaterThan(before);
});

test("all compact tactical disclosures are named, keyboard operable, and mutually exclusive", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Compact HUD behavior is specific to the narrow visualization");
  await openSession(page);
  await chooseMobileWorkspaceIfPresent(page, "VISUALIZATION");

  const plot = page.locator(".battlefield-canvas");
  await expect(plot).toBeVisible();
  const starsView = plot.getByRole("button", { name: "stars", exact: true });
  await starsView.focus();
  await starsView.press("Space");

  const plotDisclosure = page.locator(".plot-data-readout");
  const plotTrigger = plotDisclosure.locator(":scope > summary");
  const skyTrigger = page.locator(".sky-readout-toggle");
  const environmentDisclosure = page.locator(".environment-readout");
  const environmentTrigger = environmentDisclosure.locator(":scope > summary");
  const contactDisclosure = page.locator(".legend");
  const contactTrigger = contactDisclosure.locator(":scope > summary");

  for (const trigger of [plotTrigger, skyTrigger, environmentTrigger, contactTrigger]) {
    await expect(trigger).toHaveAccessibleName(/\S+/);
  }

  await plotTrigger.focus();
  await plotTrigger.press("Enter");
  await expect(plotDisclosure).toHaveAttribute("open", "");
  await expect(plot).toHaveAttribute("data-hud-open", "plot");
  await expect(page.locator(".plot-data-details")).toBeVisible();
  await expect(skyTrigger).toBeHidden();
  await plotTrigger.press("Enter");
  await expect(plotDisclosure).not.toHaveAttribute("open", "");
  await expect(plot).toHaveAttribute("data-hud-open", "none");

  await skyTrigger.focus();
  await skyTrigger.press("Enter");
  await expect(plot).toHaveAttribute("data-hud-open", "celestial");
  await expect(skyTrigger).toHaveAttribute("aria-expanded", "true");
  await expect(skyTrigger).toHaveAttribute("aria-controls", "sky-readout-details");
  await expect(page.locator("#sky-readout-details")).toBeVisible();
  await expect(environmentTrigger).toBeHidden();
  await skyTrigger.press("Enter");
  await expect(page.locator("#sky-readout-details")).toHaveCount(0);
  await expect(skyTrigger).toHaveAttribute("aria-expanded", "false");
  await expect(plot).toHaveAttribute("data-hud-open", "none");

  await environmentTrigger.focus();
  await environmentTrigger.press("Enter");
  await expect(environmentDisclosure).toHaveAttribute("open", "");
  await expect(plot).toHaveAttribute("data-hud-open", "environment");
  await expect(page.locator(".environment-readout-details")).toBeVisible();
  await expect(contactTrigger).toBeHidden();
  await environmentTrigger.press("Enter");
  await expect(environmentDisclosure).not.toHaveAttribute("open", "");
  await expect(plot).toHaveAttribute("data-hud-open", "none");

  await contactTrigger.focus();
  await contactTrigger.press("Enter");
  await expect(contactDisclosure).toHaveAttribute("open", "");
  await expect(plot).toHaveAttribute("data-hud-open", "contacts");
  await expect(page.locator(".legend-items")).toBeVisible();

  await contactTrigger.press("Enter");
  await expect(contactDisclosure).not.toHaveAttribute("open", "");
  await expect(plot).toHaveAttribute("data-hud-open", "none");
  await expectSemanticDom(page, "compact tactical disclosures");
});

test("sound state and mix ranges expose concise live and value text", async ({ page }) => {
  await openSession(page);
  const opener = await openSoundSettingsResponsively(page);
  const settings = page.getByRole("dialog", { name: "Sound settings" });
  await expect(settings).toBeVisible();
  await expect(settings).toHaveAttribute("aria-describedby", "sound-settings-description sound-mix-note");
  const state = settings.getByRole("status");
  await expect(state).toHaveAttribute("aria-live", "polite");
  await expect(state).toHaveAttribute("aria-atomic", "true");
  await expect(state).toHaveText(/MUTED|PAUSED|PLAYING/);

  const ranges = [
    { name: "MASTER", value: "52 percent" },
    { name: "AMBIANCE", value: "42 percent" },
    { name: "SOUND EFFECTS", value: "72 percent" },
  ];
  for (const range of ranges) {
    const control = settings.getByRole("slider", { name: range.name, exact: true });
    await expect(control).toHaveAttribute("aria-valuetext", range.value);
    await expect(control).toHaveAttribute("aria-describedby", "sound-mix-note");
    expect((await control.boundingBox())?.height).toBeGreaterThanOrEqual(43.5);
  }
  const ambiance = settings.getByRole("slider", { name: "AMBIANCE", exact: true });
  await ambiance.focus();
  await ambiance.press("ArrowRight");
  await expect(ambiance).toHaveAttribute("aria-valuetext", "43 percent");

  const close = settings.getByRole("button", { name: "Close audio controls" });
  await close.focus();
  await close.press("Enter");
  await expect(settings).toBeHidden();
  await expect(opener).toBeFocused();
});

test("reduced motion is honored and the app makes no third-party requests", async ({ page }) => {
  const requestedHosts = new Set<string>();
  page.on("request", (request) => requestedHosts.add(new URL(request.url()).host));
  await openSession(page);
  expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
  const animationDurations = await page.locator(".battlefield-fallback, .fallback-waves").evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).animationDuration));
  expect(animationDurations.every((duration) => duration === "0s" || Number.parseFloat(duration) <= 0.01)).toBe(true);
  expect([...requestedHosts].every((host) => host === "127.0.0.1:4174")).toBe(true);
});

test("modal and nonmodal accessibility surfaces expose names, containment, and focus restoration", async ({ page }) => {
  await page.goto("/");
  const privacy = page.getByRole("dialog", { name: "HOW SHOULD THIS GAME REMEMBER YOU?" });
  await expect(privacy).toHaveAttribute("aria-modal", "true");
  await expect(page.locator(".game-shell")).toHaveAttribute("inert", "");

  const firstPrivacyControl = privacy.getByRole("radio", { name: /Guided/ });
  const lastPrivacyControl = privacy.getByRole("button", { name: "ENABLE SAVING & BEGIN" });
  await firstPrivacyControl.focus();
  await firstPrivacyControl.press("Shift+Tab");
  await expect(lastPrivacyControl).toBeFocused();
  await lastPrivacyControl.press("Tab");
  await expect(firstPrivacyControl).toBeFocused();

  const session = privacy.getByRole("button", { name: "PLAY WITHOUT BROWSER SAVING" });
  await session.focus();
  await session.press("Enter");
  await openSaveResponsively(page);
  const saves = page.getByRole("dialog", { name: "SAVE, LOAD & ANALYZE" });
  await expect(saves).toBeVisible();
  const reset = saves.getByRole("button", { name: "RESET ALL BROWSER DATA" });
  await reset.focus();
  await reset.press("Enter");
  const resetDialog = page.getByRole("alertdialog", { name: "Reset all browser data?" });
  await expect(resetDialog).toBeVisible();
  await expect(page.locator(".data-dialog").locator("xpath=..")).toHaveAttribute("inert", "");
  const cancel = resetDialog.getByRole("button", { name: "CANCEL" });
  const confirmReset = resetDialog.getByRole("button", { name: "RESET ALL BROWSER DATA" });
  await expect(cancel).toBeFocused();
  await cancel.press("Shift+Tab");
  await expect(confirmReset).toBeFocused();
  await confirmReset.press("Tab");
  await expect(cancel).toBeFocused();
  await cancel.press("Escape");
  await expect(resetDialog).toBeHidden();
  await expect(reset).toBeFocused();
  const closeSaves = saves.getByRole("button", { name: "Close save and load panel" });
  await closeSaves.focus();
  await closeSaves.press("Enter");
});

test("academy uses keyboard-operated tabs, named panels, quiz groups, and modal focus containment", async ({ page }) => {
  await openSession(page);
  const opener = await openAcademyResponsively(page);
  const academy = page.getByRole("dialog", { name: "THE ACADEMY" });
  await expect(academy).toHaveAttribute("aria-describedby", "academy-independence");
  const academyScrollSurface = academy.locator(".academy-scroll-surface");
  const visiblePanels = () => academy.locator("[role='tabpanel']").evaluateAll((panels) => panels.filter((panel) => panel.getClientRects().length > 0).map((panel) => panel.id));
  await expect.poll(visiblePanels).toEqual(["academy-panel-course"]);
  const verticalScrollOwners = await academy.evaluate((surface) => [...surface.querySelectorAll<HTMLElement>(".academy-scroll-surface, .academy-course, .module-list, .lesson, .academy-reference")]
    .filter((element) => {
      const overflowY = getComputedStyle(element).overflowY;
      return ["auto", "scroll"].includes(overflowY) && element.scrollHeight > element.clientHeight + 1;
    })
    .map((element) => element.className));
  expect(verticalScrollOwners).toEqual(["academy-scroll-surface"]);
  await expect(academyScrollSurface).toBeVisible();
  const lessons = academy.getByRole("tab", { name: "LESSONS" });
  const compare = academy.getByRole("tab", { name: "COMPARE" });
  const sources = academy.getByRole("tab", { name: "SOURCES & SCOPE" });
  await lessons.focus();
  await lessons.press("ArrowRight");
  await expect(compare).toBeFocused();
  await expect(compare).toHaveAttribute("aria-selected", "true");
  await expect(academy.getByRole("tabpanel", { name: "COMPARE" })).toBeVisible();
  await expect.poll(visiblePanels).toEqual(["academy-panel-compare"]);
  await compare.press("ArrowRight");
  await expect(sources).toBeFocused();
  await expect(academy.getByRole("tabpanel", { name: "SOURCES & SCOPE" })).toBeVisible();
  await expect.poll(visiblePanels).toEqual(["academy-panel-sources"]);
  await sources.press("Home");
  await expect(lessons).toBeFocused();
  await expect(academy.getByRole("tabpanel", { name: "LESSONS" })).toBeVisible();
  await expect.poll(visiblePanels).toEqual(["academy-panel-course"]);
  await expect(academy.locator("fieldset.answer-list")).toHaveCount(1);
  const quizAnswers = academy.locator("fieldset.answer-list input[type='radio']");
  await expect(quizAnswers).toHaveCount(4);
  await quizAnswers.first().focus();
  await quizAnswers.first().press("Space");
  const checkAnswer = academy.getByRole("button", { name: "CHECK ANSWER" });
  await checkAnswer.focus();
  await checkAnswer.press("Enter");
  const feedback = academy.locator(".answer-feedback");
  await expect(feedback).toHaveRole("status");
  await expect(feedback).toHaveAttribute("aria-live", "polite");
  await expect(feedback).toHaveAttribute("aria-atomic", "true");
  await expect(feedback).toContainText(/Correct\.|Reconsider\./);
  await expectSemanticDom(page, "academy");
  await page.keyboard.press("Escape");
  await expect(academy).toBeHidden();
  await expect(opener).toBeFocused();
});

test("screen-reader semantics and a keyboard-only lifecycle hold through strategy, force, command, and debrief", async ({ page }, testInfo) => {
  await page.setViewportSize(testInfo.project.name === "mobile-chromium" ? { width: 320, height: 800 } : { width: 1024, height: 720 });
  await page.goto("/");
  const session = page.getByRole("button", { name: "PLAY WITHOUT BROWSER SAVING" });
  await session.focus();
  await session.press("Enter");

  await expectSemanticDom(page, "strategy");
  await expect(page.locator(".conditions-grid")).toHaveJSProperty("tagName", "DL");
  await expectAriaSnapshotContains(page.locator("#mission-workflow"), ["region", "heading", "OPERATION"]);
  await completeStrategyWithKeyboard(page);
  const continueButton = page.getByRole("button", { name: "CONTINUE TO FORCE DESIGN" });
  await continueButton.focus();
  await continueButton.press("Enter");

  const forceHeading = page.getByRole("heading", { name: "DESIGN THE FORCE" });
  await expect(forceHeading).toBeVisible();
  await expect(page.locator(".force-panel")).toBeFocused();
  const phaseStatus = page.locator("#phase-announcement");
  await expect(phaseStatus).toContainText("Force design is now active");
  await expect(phaseStatus).toHaveText("", { timeout: 3_500 });
  await expectSemanticDom(page, "force");
  await expect(page.locator(".metric-grid")).toHaveJSProperty("tagName", "DL");
  const aviationRoster = page.getByRole("button", { name: "EMBARKED AVIATION" });
  await expect(aviationRoster).toHaveAttribute("aria-disabled", "true");
  await aviationRoster.focus();
  await aviationRoster.press("Enter");
  await expect(page.locator(".force-status")).toContainText("unavailable");
  await expect(page.getByRole("list", { name: "Fleet roster" }).getByRole("listitem").first()).toHaveAccessibleName(/.+/);
  await expectAriaSnapshotContains(page.getByRole("list", { name: "Fleet roster" }), ["list", "heading", "button"]);

  const addShip = page.getByRole("button", { name: "Add one Area-defence destroyer" });
  await addShip.focus();
  await addShip.press("Enter");
  await expect(aviationRoster).toHaveAttribute("aria-disabled", "false");
  const launch = page.getByRole("button", { name: /BEGIN COMMAND PHASE/ });
  await launch.focus();
  await launch.press("Enter");
  const readiness = page.getByRole("dialog", { name: "Readiness review found likely failure points" });
  if (await readiness.isVisible()) {
    const proceed = readiness.getByRole("button", { name: "PROCEED ANYWAY" });
    await proceed.focus();
    await proceed.press("Enter");
  }

  await expect(page.getByRole("heading", { name: "TURN 1 OF 6" })).toBeFocused();
  await expectSemanticDom(page, "command");
  await expect(page.locator(".kriegsspiel-grid")).toHaveJSProperty("tagName", "DL");
  for (const select of await page.locator(".kriegsspiel-orders select").all()) {
    await expect(select).toHaveAttribute("aria-describedby", /.+/);
  }
  await expectAriaSnapshotContains(page.locator(".kriegsspiel-panel"), ["TURN 1 OF 6", "combobox", "RESOLVE TURN 1"]);

  for (let turn = 1; turn <= 6; turn += 1) {
    const resolve = page.getByRole("button", { name: `RESOLVE TURN ${turn}` });
    await resolve.focus();
    await resolve.press("Enter");
    if (turn < 6) await expect(page.getByRole("heading", { name: `TURN ${turn + 1} OF 6` })).toBeFocused();
  }

  const debrief = page.locator(".result-card");
  await expect(debrief).toBeFocused();
  await expect(debrief).toHaveAttribute("aria-keyshortcuts", "PageUp PageDown Home End");
  await expectSemanticDom(page, "debrief");
  await expectAriaSnapshotContains(debrief, ["region", "FINAL SCORE", "Debrief actions", "SCORE COMPONENTS"]);
  const timeline = debrief.locator(".turn-timeline > summary");
  await timeline.focus();
  await timeline.press("Enter");
  await debrief.focus();
  await debrief.press("End");
  const endPosition = await debrief.evaluate((node) => node.scrollTop);
  await debrief.press("PageUp");
  const pageUpPosition = await debrief.evaluate((node) => node.scrollTop);
  expect(pageUpPosition).toBeLessThan(endPosition);
});

test("forced-colors mode preserves visible state and keyboard focus indicators", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "One browser-level forced-colors contract is sufficient");
  await page.emulateMedia({ forcedColors: "active" });
  await openSession(page);
  expect(await page.evaluate(() => matchMedia("(forced-colors: active)").matches)).toBe(true);
  const selected = page.locator(".time-control button[aria-pressed='true']");
  await selected.focus();
  const styles = await selected.evaluate((node) => {
    const style = getComputedStyle(node);
    return { outlineWidth: style.outlineWidth, borderStyle: style.borderStyle };
  });
  expect(Number.parseFloat(styles.outlineWidth)).toBeGreaterThanOrEqual(2);
  expect(styles.borderStyle).not.toBe("none");
});
