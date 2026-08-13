import { expect, test, type Page } from "@playwright/test";

async function openSession(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "PLAY WITHOUT BROWSER SAVING" }).click();
  await expect(page.getByRole("dialog", { name: "HOW SHOULD THIS GAME REMEMBER YOU?" })).toBeHidden();
}

async function reachFinalReview(page: Page) {
  await page.locator(".warfare-grid").getByRole("button", { name: /Intelligence and reconnaissance/i }).click();
  await page.locator("#strategic-end-state").selectOption("access");
  await page.locator("#strategic-primary-theory").selectOption("sun-tzu");
  await page.locator("#strategic-partner-theory").selectOption("clausewitz");
  await page.locator("#strategic-guardrail").selectOption("escalation");
  await page.getByRole("button", { name: "CONTINUE TO FORCE DESIGN" }).click();
  await page.getByRole("button", { name: "Add one Fleet aviation ship" }).click();
  await page.getByRole("button", { name: /BEGIN COMMAND PHASE/ }).click();

  const readiness = page.getByRole("dialog", { name: "Readiness review found likely failure points" });
  if (await readiness.isVisible()) await readiness.getByRole("button", { name: "PROCEED ANYWAY" }).click();

  for (let turn = 1; turn <= 6; turn += 1) {
    const resolve = page.getByRole("button", { name: `RESOLVE TURN ${turn}`, exact: true });
    await expect(resolve).toBeVisible();
    await resolve.click();
  }
  await expect(page.locator(".workspace")).toHaveClass(/phase-debrief/);
  await expect(page.getByRole("heading", { name: /DECISIVE VICTORY|LIMITED SUCCESS|MISSION UNRESOLVED|MISSION LOSS/ })).toBeVisible();
  await expect(page.locator(".result-card")).toBeFocused();
}

test("final review is a bounded debrief surface with no operable plot UI", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "One browser is resized through every review breakpoint");
  await openSession(page);
  await reachFinalReview(page);

  const findings = page.locator(".debrief-findings article");
  expect(await findings.count()).toBeGreaterThan(1);
  const findingSemantics = await findings.evaluateAll((articles) => articles.map((article) => {
    const heading = article.querySelector("h4");
    const lesson = article.querySelector("button");
    return {
      headingId: heading?.id || "",
      headingText: heading?.textContent?.trim() || "",
      labelledBy: article.getAttribute("aria-labelledby") || "",
      lessonName: lesson?.getAttribute("aria-label") || "",
    };
  }));
  expect(new Set(findingSemantics.map((finding) => finding.lessonName)).size).toBe(findingSemantics.length);
  for (const finding of findingSemantics) {
    expect(finding.headingId).not.toBe("");
    expect(finding.labelledBy).toBe(finding.headingId);
    expect(finding.lessonName).toContain(finding.headingText);
  }

  for (const viewport of [
    { width: 2048, height: 1090 },
    { width: 1024, height: 545 },
    { width: 320, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    const review = page.locator(".result-card");
    await expect(review).toBeVisible();
    // Release focus from the prior viewport's action before compact rows
    // settle, so Chromium cannot retain an obsolete scroll anchor.
    await review.focus();
    await review.evaluate((element) => { element.scrollTop = 0; });

    const actionNames = ["UNDO FINAL TURN", "RETRY SAME SCENARIO", "RETURN TO PLANNING", "NEW SCENARIO"];
    for (const name of actionNames) {
      const action = page.getByRole("button", { name, exact: true });
      await expect(action).toBeVisible();
      await expect.poll(async () => action.evaluate((element) => {
        const actionRect = element.getBoundingClientRect();
        const reviewRect = element.closest(".result-card")!.getBoundingClientRect();
        return actionRect.top >= reviewRect.top - 1 && actionRect.left >= reviewRect.left - 1
          && actionRect.bottom <= reviewRect.bottom + 1 && actionRect.right <= reviewRect.right + 1;
      }), { message: `${name} must be initially visible inside the ${viewport.width}px review` }).toBe(true);
      await action.focus();
      await expect(action).toBeFocused();
      const focusedContained = await action.evaluate((element) => {
        const focusedRect = element.getBoundingClientRect();
        const reviewRect = element.closest(".result-card")!.getBoundingClientRect();
        return focusedRect.top >= reviewRect.top - 1 && focusedRect.left >= reviewRect.left - 1
          && focusedRect.bottom <= reviewRect.bottom + 1 && focusedRect.right <= reviewRect.right + 1;
      });
      expect(focusedContained, `${name} focus ring must remain inside the review viewport`).toBe(true);
    }

    const state = await page.evaluate(() => {
      const tactical = document.querySelector<HTMLElement>(".tactical-panel")!;
      const result = tactical.querySelector<HTMLElement>(".result-card")!;
      const tacticalRect = tactical.getBoundingClientRect();
      const resultRect = result.getBoundingClientRect();
      const resultStyle = getComputedStyle(result);
      const outsideReviewControls = [...tactical.querySelectorAll<HTMLElement>(
        'button, select, input, textarea, a[href], summary, [tabindex]:not([tabindex="-1"])',
      )].filter((element) => !element.closest(".result-card") && getComputedStyle(element).display !== "none");
      return {
        tactical: { top: tacticalRect.top, right: tacticalRect.right, bottom: tacticalRect.bottom, left: tacticalRect.left },
        result: { top: resultRect.top, right: resultRect.right, bottom: resultRect.bottom, left: resultRect.left },
        overflowY: resultStyle.overflowY,
        scrollHeight: result.scrollHeight,
        clientHeight: result.clientHeight,
        outsideReviewControls: outsideReviewControls.length,
        plotRoots: tactical.querySelectorAll(
          ".battlefield-canvas, .plot-topline, .plot-instruction, .depth-control, .sky-readout, .environment-readout, .view-telemetry, .legend, .kriegsspiel-panel",
        ).length,
        documentWidth: document.documentElement.scrollWidth,
        documentHeight: document.documentElement.scrollHeight,
        viewport: { width: innerWidth, height: innerHeight },
      };
    });

    expect(state.plotRoots, `${viewport.width}px review must not retain the plot or its HUD`).toBe(0);
    expect(state.outsideReviewControls, `${viewport.width}px review must not leave hidden tactical controls focusable`).toBe(0);
    expect(state.result.left).toBeGreaterThanOrEqual(state.tactical.left);
    expect(state.result.top).toBeGreaterThanOrEqual(state.tactical.top);
    expect(state.result.right).toBeLessThanOrEqual(state.tactical.right);
    expect(state.result.bottom).toBeLessThanOrEqual(state.tactical.bottom);
    expect(state.overflowY).toBe("auto");
    expect(state.documentWidth).toBeLessThanOrEqual(state.viewport.width + 1);
    expect(state.documentHeight).toBeLessThanOrEqual(state.viewport.height + 1);
    if (viewport.height === 545 || viewport.width === 320) {
      expect(state.scrollHeight).toBeGreaterThan(state.clientHeight);
    }
  }

  await page.setViewportSize({ width: 1024, height: 545 });
  const review = page.locator(".result-card");
  await review.evaluate((element) => { element.scrollTop = 0; });
  await review.focus();
  await expect(review).toBeFocused();
  await review.press("PageDown");
  await expect.poll(() => review.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await review.press("End");
  await expect.poll(() => review.evaluate((element) => element.scrollTop + element.clientHeight - element.scrollHeight)).toBeGreaterThanOrEqual(-1);
  await review.press("Home");
  await expect.poll(() => review.evaluate((element) => element.scrollTop)).toBe(0);

  const focusedReviewContained = await review.evaluate((element) => {
    const focusedRect = element.getBoundingClientRect();
    const tacticalRect = element.closest(".tactical-panel")!.getBoundingClientRect();
    return focusedRect.top >= tacticalRect.top && focusedRect.left >= tacticalRect.left
      && focusedRect.bottom <= tacticalRect.bottom && focusedRect.right <= tacticalRect.right;
  });
  expect(focusedReviewContained).toBe(true);

  const focusTrail: Array<{ allowed: boolean; label: string }> = [];
  for (let step = 0; step < 10; step += 1) {
    await page.keyboard.press("Tab");
    focusTrail.push(await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      return {
        allowed: Boolean(active === document.body || active === document.documentElement
          || active?.closest(".result-card, .topbar") || active?.matches(".skip-link")),
        label: active?.getAttribute("aria-label") || active?.textContent?.trim().slice(0, 80) || active?.tagName || "none",
      };
    }));
  }
  expect(focusTrail.some((entry) => entry.label.includes("UNDO FINAL TURN"))).toBe(true);
  expect(focusTrail.filter((entry) => !entry.allowed), JSON.stringify(focusTrail, null, 2)).toEqual([]);
});
