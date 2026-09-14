import { expect, test, type Page } from "@playwright/test";

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

test("Academy defaults remain scenario-derived until both theory choices exist", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop contextual-disclosure contract");
  await openSession(page);
  const storageBeforeHelp = await page.evaluate(() => ({
    local: Object.entries(localStorage).sort(([left], [right]) => left.localeCompare(right)),
    session: Object.entries(sessionStorage).sort(([left], [right]) => left.localeCompare(right)),
  }));

  let academy = await openAcademy(page);
  await expect(academy).toHaveAttribute("data-guidance-source", "scenario");
  const suggested = academy.locator(".module-list [data-academy-suggested='true']");
  expect(await suggested.count()).toBeGreaterThan(0);
  const initialSuggestedIds = await suggested.evaluateAll((buttons) => buttons.map((button) => button.getAttribute("data-academy-module-id")));
  const activeSuggestion = academy.locator(".module-list [aria-current='page']");
  await expect(activeSuggestion).toHaveAttribute("data-academy-suggested", "true");
  const activeSuggestionId = await activeSuggestion.getAttribute("data-academy-module-id");
  const originalSuggestion = academy.locator(`.module-list [data-academy-module-id='${activeSuggestionId}']`);
  await expect(academy.locator(".lesson-body[open]")).toHaveCount(1);
  await expect(academy.locator(".lesson-heading h3")).toBeFocused();

  const visibleBadge = suggested.first().locator(".module-suggestion");
  await expect(visibleBadge).toBeVisible();
  expect(await visibleBadge.evaluate((badge) => {
    const button = badge.closest("button");
    if (!button) return false;
    const badgeRect = badge.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    return badgeRect.width > 0
      && badgeRect.height > 0
      && badgeRect.left >= buttonRect.left - 1
      && badgeRect.right <= buttonRect.right + 1
      && badgeRect.top >= buttonRect.top - 1
      && badgeRect.bottom <= buttonRect.bottom + 1;
  })).toBe(true);

  const secondarySuggestion = academy.locator(".module-list [data-academy-suggested='true']:not([aria-current='page'])").first();
  const secondarySuggestionId = await secondarySuggestion.getAttribute("data-academy-module-id");
  await secondarySuggestion.click();
  await expect(academy.locator(`.lesson-body[data-module-id='${secondarySuggestionId}']`)).toHaveAttribute("open", "");
  await originalSuggestion.click();

  const activeSuggestedBody = academy.locator(`.lesson-body[data-module-id='${activeSuggestionId}']`);
  await activeSuggestedBody.locator("summary").click();
  await expect(activeSuggestedBody).not.toHaveAttribute("open", "");

  const otherLesson = academy.locator(".module-list button:not([data-academy-suggested='true'])").first();
  const otherLessonId = await otherLesson.getAttribute("data-academy-module-id");
  await otherLesson.click();
  const otherBody = academy.locator(`.lesson-body[data-module-id='${otherLessonId}']`);
  await expect(otherBody).not.toHaveAttribute("open", "");
  await otherBody.locator("summary").click();
  await expect(otherBody).toHaveAttribute("open", "");

  await originalSuggestion.click();
  await expect(academy.locator(`.lesson-body[data-module-id='${activeSuggestionId}']`)).not.toHaveAttribute("open", "");
  await otherLesson.click();
  await expect(academy.locator(`.lesson-body[data-module-id='${otherLessonId}']`)).toHaveAttribute("open", "");
  await closeAcademy(page);
  expect(await page.evaluate(() => ({
    local: Object.entries(localStorage).sort(([left], [right]) => left.localeCompare(right)),
    session: Object.entries(sessionStorage).sort(([left], [right]) => left.localeCompare(right)),
  }))).toEqual(storageBeforeHelp);
  await expect(page.locator(".warfare-grid button.selected")).toHaveCount(0);
  await expect(page.locator("#strategic-end-state")).toHaveCount(0);

  await page.locator(".warfare-grid button").first().click();
  await page.locator("#strategic-end-state").selectOption("access");
  await page.locator("#strategic-primary-theory").selectOption("sun-tzu");

  academy = await openAcademy(page);
  await expect(academy).toHaveAttribute("data-guidance-source", "scenario");
  await expect(academy.locator("#academy-guidance-copy")).toContainText("incomplete pair does not steer");
  await closeAcademy(page);

  await page.locator("#strategic-partner-theory").selectOption("clausewitz");
  academy = await openAcademy(page);
  await expect(academy).toHaveAttribute("data-guidance-source", "player-selections");
  await expect(academy.getByRole("button", { name: /Sun Tzu and strategic advantage.*SUGGESTED NOW/ })).toBeVisible();
  await expect(academy.getByRole("button", { name: /Clausewitz and war’s political logic.*SUGGESTED NOW/ })).toBeVisible();
  await expect(academy.locator(".lesson-body[data-module-id='sun-tzu']")).toHaveAttribute("open", "");
  for (const priorId of initialSuggestedIds.filter((id) => id && id !== "strategy-grammar")) {
    await expect(academy.locator(`.module-list [data-academy-module-id='${priorId}']`)).not.toHaveAttribute("data-academy-suggested", "true");
  }
});

test("Force-design help opens the bounded phase answer while retaining the recorded theory pair", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop phase-guidance contract");
  await openSession(page);
  await completeStrategy(page);
  await page.getByRole("button", { name: "CONTINUE TO FORCE DESIGN" }).click();

  const academy = await openAcademy(page);
  await expect(academy).toHaveAttribute("data-gameplay-phase", "force");
  await expect(academy).toHaveAttribute("data-guidance-source", "player-selections");
  const activeModule = academy.locator(".module-list [aria-current='page']");
  await expect(activeModule).toHaveAttribute("data-academy-module-id", "maritime-uncrewed");
  await expect(activeModule).toHaveAttribute("data-academy-suggested", "true");
  await expect(academy.locator(".lesson-body[data-module-id='maritime-uncrewed']")).toHaveAttribute("open", "");
  await expect(academy.locator(".module-list [data-academy-module-id='sun-tzu']")).toHaveAttribute("data-academy-suggested", "true");
  await expect(academy.locator(".module-list [data-academy-module-id='clausewitz']")).toHaveAttribute("data-academy-suggested", "true");
  await expect(academy.locator(".lesson-heading h3")).toBeFocused();
});

test("opening Academy from the compact visualization view prioritizes grid-reading help", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Compact visualization-context contract");
  await openSession(page);

  const workspace = page.locator(".mobile-disclosure");
  await workspace.locator(":scope > summary").click();
  await workspace.getByRole("button", { name: "VISUALIZATION", exact: true }).click();
  await workspace.locator(":scope > summary").click();
  await workspace.getByRole("button", { name: "ACADEMY", exact: true }).click();

  const academy = page.getByRole("dialog", { name: "THE ACADEMY" });
  await expect(academy).toHaveAttribute("data-workspace-view", "visualization");
  await expect(academy.locator(".module-list [aria-current='page']")).toContainText("Jomini and operational geometry");
  await expect(academy.locator(".module-list [aria-current='page']")).toHaveAttribute("data-academy-suggested", "true");
  await expect(academy.locator(".lesson-body[data-module-id='jomini']")).toHaveAttribute("open", "");
  await expect(academy.locator("#academy-guidance-copy")).toContainText("Academy makes no selection");
  await expect(academy.locator(".lesson-heading h3")).toBeFocused();
  expect(await academy.locator(".lesson-heading h3").evaluate((heading) => {
    const surface = heading.closest(".academy-scroll-surface");
    if (!surface) return false;
    const headingRect = heading.getBoundingClientRect();
    const surfaceRect = surface.getBoundingClientRect();
    return headingRect.top >= surfaceRect.top && headingRect.bottom <= surfaceRect.bottom;
  })).toBe(true);

  await page.setViewportSize({ width: 1200, height: 800 });
  await expect(academy).toHaveAttribute("data-workspace-view", "visualization");
  await expect(academy.locator(".module-list [data-academy-module-id='jomini']")).toHaveAttribute("data-academy-suggested", "true");
  await closeAcademy(page);
  const wideAcademy = await openAcademy(page);
  await expect(wideAcademy).toHaveAttribute("data-workspace-view", "decisions");
  await expect(wideAcademy.locator(".module-list [data-academy-module-id='jomini']")).not.toHaveAttribute("data-academy-suggested", "true");
});
