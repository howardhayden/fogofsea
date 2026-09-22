import { expect, test, type Locator, type Page } from "@playwright/test";

async function openSession(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "PLAY WITHOUT BROWSER SAVING" }).click();
  await expect(page.getByRole("dialog", { name: "HOW SHOULD THIS GAME REMEMBER YOU?" })).toBeHidden();
}

async function openAcademy(page: Page) {
  await page.getByRole("button", { name: "ACADEMY", exact: true }).first().click();
  return page.getByRole("dialog", { name: "THE ACADEMY" });
}

async function closeAcademy(page: Page) {
  await page.getByRole("button", { name: "Close academy" }).click();
}

async function completeStrategy(page: Page) {
  await page.locator(".warfare-grid").getByRole("button", { name: /Intelligence and reconnaissance/i }).click();
  await page.locator("#strategic-end-state").selectOption("access");
  await page.locator("#strategic-primary-theory").selectOption("sun-tzu");
  await page.locator("#strategic-partner-theory").selectOption("clausewitz");
  await page.locator("#strategic-guardrail").selectOption("escalation");
}

async function storageSnapshot(page: Page) {
  return page.evaluate(() => ({
    local: Object.entries(localStorage).sort(([left], [right]) => left.localeCompare(right)),
    session: Object.entries(sessionStorage).sort(([left], [right]) => left.localeCompare(right)),
  }));
}

async function strategySnapshot(page: Page) {
  return page.evaluate(() => ({
    warfare: Array.from(document.querySelectorAll<HTMLButtonElement>(".warfare-grid button[aria-pressed='true']"))
      .map((button) => button.textContent?.replace(/\s+/gu, " ").trim() || ""),
    completed: Array.from(document.querySelectorAll<HTMLElement>(".decision-step--complete .decision-step-summary strong"))
      .map((summary) => summary.textContent?.replace(/\s+/gu, " ").trim() || ""),
    current: document.querySelector<HTMLSelectElement>(".decision-step--current select")?.value ?? null,
  }));
}

async function expectOpenDetails(details: Locator, expectedCount: number) {
  await expect(details).toHaveCount(expectedCount);
  for (let index = 0; index < expectedCount; index += 1) {
    await expect(details.nth(index)).toBeVisible();
    await expect(details.nth(index)).toHaveAttribute("open", "");
  }
}

async function expectNowDefaults(academy: Locator) {
  await expect(academy.getByRole("tab", { name: "NOW", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(academy.locator(".academy-now-heading h3")).toBeFocused();

  const decisionAtoms = academy.locator("details[data-academy-decision-atom]");
  await expectOpenDetails(decisionAtoms, 5);
  await expect(decisionAtoms.locator(".decision-evidence")).toHaveCount(5);

  const theoryAtoms = academy.locator("details[data-academy-guide-theory-atom]");
  const theoryCount = await theoryAtoms.count();
  expect(theoryCount).toBeGreaterThan(0);
  await expectOpenDetails(theoryAtoms, theoryCount);
  return { decisionAtoms, theoryAtoms, theoryCount };
}

test("Academy NOW supports all five first-phase questions without changing play", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop contextual-disclosure contract");
  await openSession(page);

  const storageBeforeHelp = await storageSnapshot(page);
  const strategyBeforeHelp = await strategySnapshot(page);
  let academy = await openAcademy(page);

  await expect(academy).toHaveAttribute("data-guidance-source", "brief");
  const initial = await expectNowDefaults(academy);
  await expect(academy.locator(".academy-relevant-theories")).toContainText("not a ranking or answer key");

  const collapsedDecision = initial.decisionAtoms.first();
  const collapsedTheory = initial.theoryAtoms.first();
  await collapsedDecision.locator(":scope > summary").click();
  await collapsedTheory.locator(":scope > summary").click();
  await expect(collapsedDecision).not.toHaveAttribute("open", "");
  await expect(collapsedTheory).not.toHaveAttribute("open", "");

  await academy.getByRole("button", { name: "EXPLORE THE LIBRARY", exact: true }).click();
  const libraryTab = academy.getByRole("tab", { name: "LIBRARY", exact: true });
  await expect(libraryTab).toHaveAttribute("aria-selected", "true");
  await expect(libraryTab).toBeFocused();
  const deeperModule = academy.locator(".module-list button:not([data-academy-relevant='true'])").first();
  await expect(deeperModule).toBeVisible();
  const deeperModuleId = await deeperModule.getAttribute("data-academy-module-id");
  expect(deeperModuleId).toBeTruthy();
  await deeperModule.click();
  const deeperLesson = academy.locator(`.lesson-body[data-module-id='${deeperModuleId}']`);
  await expect(deeperLesson).not.toHaveAttribute("open", "");
  await expect(academy.locator(".lesson-objectives[open], .academy-disclosure[open], .seminar-prompt[open], .knowledge-check[open], .reading-list[open]")).toHaveCount(0);
  await deeperLesson.locator(":scope > summary").click();
  await expect(deeperLesson).toHaveAttribute("open", "");

  await academy.getByRole("tab", { name: "NOW", exact: true }).click();
  await expect(collapsedDecision).not.toHaveAttribute("open", "");
  await expect(collapsedTheory).not.toHaveAttribute("open", "");
  await closeAcademy(page);

  expect(await storageSnapshot(page)).toEqual(storageBeforeHelp);
  expect(await strategySnapshot(page)).toEqual(strategyBeforeHelp);

  academy = await openAcademy(page);
  const reopened = await expectNowDefaults(academy);
  expect(reopened.theoryCount).toBe(initial.theoryCount);
  await closeAcademy(page);

  expect(await storageSnapshot(page)).toEqual(storageBeforeHelp);
  expect(await strategySnapshot(page)).toEqual(strategyBeforeHelp);

  await completeStrategy(page);
  const storageWithPair = await storageSnapshot(page);
  const strategyWithPair = await strategySnapshot(page);
  academy = await openAcademy(page);

  await expect(academy).toHaveAttribute("data-guidance-source", "player-selections");
  const recorded = await expectNowDefaults(academy);
  expect(recorded.theoryCount).toBe(2);
  await expect(recorded.theoryAtoms.filter({ hasText: "Sun Tzu" })).toHaveCount(1);
  await expect(recorded.theoryAtoms.filter({ hasText: "Clausewitz" })).toHaveCount(1);
  for (let index = 0; index < recorded.theoryCount; index += 1) {
    await expect(recorded.theoryAtoms.nth(index).locator(":scope > summary")).toContainText("YOUR RECORDED THEORY");
  }
  await expect(academy.locator(".academy-relevant-theories")).toContainText("without testing whether either matches the scoring model");
  await closeAcademy(page);

  expect(await storageSnapshot(page)).toEqual(storageWithPair);
  expect(await strategySnapshot(page)).toEqual(strategyWithPair);
});

test("Force and command Academy opens on NOW with a phase-focused lesson", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop phase-guidance contract");
  await openSession(page);
  await completeStrategy(page);
  await page.getByRole("button", { name: "CONTINUE TO FORCE DESIGN" }).click();

  let academy = await openAcademy(page);
  await expect(academy).toHaveAttribute("data-gameplay-phase", "force");
  await expect(academy).toHaveAttribute("data-guidance-source", "player-selections");
  await expectNowDefaults(academy);
  const forceFocus = academy.locator(".academy-phase-focus");
  await expect(forceFocus).toBeVisible();
  await expect(forceFocus).toContainText("CURRENT PHASE");
  await forceFocus.getByRole("button", { name: "OPEN PHASE LESSON" }).click();
  await expect(academy.getByRole("tab", { name: "LIBRARY", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(academy.locator(".module-list [aria-current='page']")).toHaveAttribute("data-academy-module-id", "maritime-uncrewed");
  await expect(academy.locator(".module-list [aria-current='page']")).toHaveAttribute("data-academy-relevant", "true");
  await expect(academy.locator(".lesson-body[data-module-id='maritime-uncrewed']")).toHaveAttribute("open", "");

  await closeAcademy(page);
  await page.getByRole("button", { name: "Add one Fleet aviation ship" }).click();
  await page.getByRole("button", { name: /BEGIN COMMAND PHASE/ }).click();
  const readinessReview = page.getByRole("dialog", { name: "Readiness review found likely failure points" });
  if (await readinessReview.isVisible()) {
    await readinessReview.getByRole("button", { name: "PROCEED ANYWAY" }).click();
  }
  await expect(page.getByRole("heading", { name: /TURN 1 OF 6/ })).toBeVisible();

  academy = await openAcademy(page);
  await expect(academy).toHaveAttribute("data-gameplay-phase", "command");
  await expectNowDefaults(academy);
  const commandFocus = academy.locator(".academy-phase-focus");
  await expect(commandFocus).toBeVisible();
  await expect(commandFocus).toContainText("Compound uncertainty and contingent command");
  await commandFocus.getByRole("button", { name: "OPEN PHASE LESSON" }).click();
  await expect(academy.getByRole("tab", { name: "LIBRARY", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(academy.locator(".module-list [aria-current='page']")).toHaveAttribute("data-academy-module-id", "compound-uncertainty");
  await expect(academy.locator(".lesson-body[data-module-id='compound-uncertainty']")).toHaveAttribute("open", "");
});

test("compact visualization Academy retains NOW and exposes its phase focus", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Compact visualization-context contract");
  await openSession(page);

  const workspace = page.locator(".mobile-disclosure");
  await workspace.locator(":scope > summary").click();
  await workspace.getByRole("button", { name: "VISUALIZATION", exact: true }).click();
  await workspace.locator(":scope > summary").click();
  await workspace.getByRole("button", { name: "ACADEMY", exact: true }).click();

  let academy = page.getByRole("dialog", { name: "THE ACADEMY" });
  await expect(academy).toHaveAttribute("data-workspace-view", "visualization");
  await expectNowDefaults(academy);
  await expect(academy.locator(".academy-phase-focus")).toContainText("Jomini and operational geometry");
  const guideHeading = academy.getByRole("heading", { name: "A guide to all five strategy questions" });
  expect(await guideHeading.evaluate((heading) => {
    const surface = heading.closest(".academy-scroll-surface");
    if (!surface) return false;
    const headingRect = heading.getBoundingClientRect();
    const surfaceRect = surface.getBoundingClientRect();
    return headingRect.top >= surfaceRect.top && headingRect.bottom <= surfaceRect.bottom;
  })).toBe(true);

  await page.setViewportSize({ width: 1200, height: 800 });
  await expect(academy).toHaveAttribute("data-workspace-view", "visualization");
  await expect(academy.getByRole("tab", { name: "NOW", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(academy.locator(".academy-phase-focus")).toContainText("Jomini and operational geometry");
  await closeAcademy(page);

  academy = await openAcademy(page);
  await expect(academy).toHaveAttribute("data-workspace-view", "decisions");
  await expect(academy.getByRole("tab", { name: "NOW", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(academy.locator(".academy-phase-focus")).toHaveCount(0);
  await expectOpenDetails(academy.locator("details[data-academy-decision-atom]"), 5);
});
