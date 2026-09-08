import { expect, test, type Page } from "@playwright/test";

async function openSession(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "PLAY WITHOUT BROWSER SAVING" }).click();
  await expect(page.getByRole("dialog", { name: "HOW SHOULD THIS GAME REMEMBER YOU?" })).toBeHidden();
}

async function beginCommand(page: Page) {
  const compact = page.locator(".mobile-disclosure");
  if (await compact.isVisible()) {
    await compact.locator(":scope > summary").click();
    await compact.getByRole("button", { name: "DECISIONS", exact: true }).click();
  }
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
  await expect(page.getByRole("heading", { name: "TURN 1 OF 6" })).toBeVisible();
}

async function selectInsufficientEvidence(page: Page) {
  for (const selector of [
    "#adversary-intent-assumption",
    "#observed-pattern-assumption",
    "#adversary-next-action-assumption",
  ]) await page.locator(selector).selectOption("insufficient-evidence");
}

test("post-first-turn intelligence gates Resolve without exposing concealed opposition", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop intelligence contract");
  await openSession(page);
  await beginCommand(page);

  const intelligence = page.locator(".command-intelligence-panel");
  await expect(intelligence).toBeVisible();
  await expect(intelligence.getByRole("heading", { name: "ABSOLUTELY KNOWN" })).toBeVisible();
  await expect(intelligence.locator("select")).toHaveCount(0);
  await page.getByRole("button", { name: "RESOLVE TURN 1" }).click();

  const selects = intelligence.locator("select");
  await expect(selects).toHaveCount(3);
  for (const select of await selects.all()) {
    await expect(select).toHaveAttribute("required", "");
    await expect(select).toHaveAttribute("form", "command-orders-form");
    await expect(select.locator('option[value="insufficient-evidence"]')).toHaveCount(1);
  }

  await page.getByRole("button", { name: "RESOLVE TURN 2" }).click();
  await expect(page.getByRole("heading", { name: "TURN 2 OF 6" })).toBeVisible();
  await expect(selects.first()).toBeFocused();
  await selectInsufficientEvidence(page);
  await page.getByRole("button", { name: "RESOLVE TURN 2" }).click();
  await expect(page.getByRole("heading", { name: "TURN 3 OF 6" })).toBeVisible();
  await expect(page.locator("#command-intelligence-heading")).toBeFocused();

  await expect(page.locator("#command-history-turn-1")).toHaveCount(1);
  await expect(page.locator("#command-history-turn-2")).toHaveCount(1);
  await expect(intelligence).not.toContainText(/Distinct opposing actors|Assessed opposing posture|committed chance|draw \d+\/100/i);
});

test("compact command presents intelligence before orders in one scroll path", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Mobile intelligence contract");
  await openSession(page);
  await beginCommand(page);
  await page.getByRole("button", { name: "RESOLVE TURN 1" }).click();

  const intelligence = page.locator(".command-intelligence-panel");
  const orders = page.locator("#command-orders-form");
  await expect(intelligence).toBeVisible();
  await expect(orders).toBeVisible();
  expect(await page.evaluate(() => {
    const left = document.querySelector(".command-intelligence-panel")!;
    const right = document.querySelector("#command-orders-form")!;
    return Boolean(left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING);
  })).toBe(true);

  const layout = await page.evaluate(() => {
    const tactical = document.querySelector<HTMLElement>(".tactical-panel")!;
    const intel = document.querySelector<HTMLElement>(".command-intelligence-panel")!;
    const form = document.querySelector<HTMLElement>("#command-orders-form")!;
    return {
      tacticalOverflow: getComputedStyle(tactical).overflowY,
      intelOverflow: getComputedStyle(intel).overflowY,
      formOverflow: getComputedStyle(form).overflowY,
      bodyOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      intelPosition: getComputedStyle(intel).position,
      formPosition: getComputedStyle(form).position,
    };
  });
  expect(layout.tacticalOverflow).toBe("auto");
  expect(layout.intelOverflow).toBe("visible");
  expect(layout.formOverflow).toBe("visible");
  expect(layout.bodyOverflow).toBeLessThanOrEqual(1);
  expect(layout.intelPosition).toBe("relative");
  expect(layout.formPosition).toBe("relative");

  for (const select of await intelligence.locator("select").all()) {
    expect(await select.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  }
  const history = page.locator("#command-log-history > summary");
  expect(await history.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  await history.click();
  await expect(page.locator("#command-history-turn-1")).toBeVisible();

  await selectInsufficientEvidence(page);
  await page.getByRole("button", { name: "RESOLVE TURN 2" }).click();
  await expect(page.locator("#command-intelligence-heading")).toBeFocused();
});
