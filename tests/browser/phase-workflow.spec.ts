import { expect, test, type Page } from "@playwright/test";

async function openSession(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "PLAY WITHOUT BROWSER SAVING" }).click();
  await expect(page.getByRole("dialog", { name: "HOW SHOULD THIS GAME REMEMBER YOU?" })).toBeHidden();
}

async function completeStrategy(page: Page) {
  await page.locator(".warfare-grid").getByRole("button", { name: /Intelligence and reconnaissance/i }).click();
  await page.locator("#strategic-end-state").selectOption("access");
  await page.locator("#strategic-primary-theory").selectOption("sun-tzu");
  await page.locator("#strategic-partner-theory").selectOption("clausewitz");
  await page.locator("#strategic-guardrail").selectOption("escalation");
}

async function beginCommand(page: Page) {
  await completeStrategy(page);
  await page.getByRole("button", { name: "CONTINUE TO FORCE DESIGN" }).click();
  await page.getByRole("button", { name: "Add one Fleet aviation ship" }).click();
  await page.getByRole("button", { name: /BEGIN COMMAND PHASE/ }).click();
  const review = page.getByRole("dialog", { name: "Readiness review found likely failure points" });
  if (await review.isVisible()) await review.getByRole("button", { name: "PROCEED ANYWAY" }).click();
  await expect(page.getByRole("heading", { name: /TURN 1 OF 6/ })).toBeVisible();
}

test("planning stages render only current selectors and use an explicit read-only recap", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop phase contract");
  await openSession(page);

  await expect(page.locator(".mission-panel")).toBeVisible();
  await expect(page.locator(".force-panel, .roster-list, .catalog-tools")).toHaveCount(0);
  await completeStrategy(page);
  await expect(page.getByRole("button", { name: "CONTINUE TO FORCE DESIGN" })).toBeVisible();
  await page.getByRole("button", { name: "CONTINUE TO FORCE DESIGN" }).click();

  await expect(page.locator(".mission-panel, .warfare-grid, .decision-steps")).toHaveCount(0);
  await expect(page.locator(".force-panel")).toBeVisible();
  const forceRecap = page.locator(".force-panel .planning-recap");
  await expect(forceRecap).not.toHaveAttribute("open", "");
  await forceRecap.locator("summary").click();
  const forceRecapContent = forceRecap.getByTestId("planning-recap-content");
  await expect(forceRecapContent).toContainText("Preserve reliable access");
  await expect(forceRecapContent.locator("select, textarea, input, button, .counter")).toHaveCount(0);

  await page.getByRole("button", { name: "REVISE MISSION & DECISIONS" }).click();
  await expect(page.locator(".force-panel, .planning-recap")).toHaveCount(0);
  await expect(page.locator(".mission-panel")).toBeVisible();
  await expect(page.locator(".decision-steps")).toBeVisible();
});

test("command prioritizes current actions while global tools and a closable read-only recap remain available", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop phase and global-tool contract");
  await openSession(page);
  await beginCommand(page);

  await expect(page.locator(".mission-panel, .force-panel, .time-control, .warfare-grid, .decision-steps, .catalog-tools, .launch-button")).toHaveCount(0);
  await expect(page.locator(".kriegsspiel-orders select")).toHaveCount(10);
  await expect(page.locator(".kriegsspiel-orders select:enabled")).toHaveCount(10);
  await expect(page.getByRole("button", { name: "RESOLVE TURN 1" })).toBeVisible();

  const recap = page.locator(".kriegsspiel-panel .planning-recap");
  await expect(recap).not.toHaveAttribute("open", "");
  await recap.locator("summary").click();
  const recapContent = recap.getByTestId("planning-recap-content");
  await expect(recapContent).toContainText("FLEET AVIATION SHIP ×1");
  await expect(recapContent).toContainText("Mission-credited points");
  await expect(recapContent.locator("select, textarea, input, button, .counter")).toHaveCount(0);
  await recap.locator("summary").click();
  await expect(recap).not.toHaveAttribute("open", "");

  await page.getByRole("button", { name: "ACADEMY", exact: true }).first().click();
  await expect(page.getByRole("dialog", { name: "THE ACADEMY" })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "SAVE / LOAD", exact: true }).first().click();
  await expect(page.getByRole("dialog", { name: "SAVE, LOAD & ANALYZE" })).toBeVisible();
  await page.getByRole("button", { name: "Close save and load panel" }).click();

  await page.getByRole("button", { name: "FIELD GUIDE", exact: true }).first().click();
  await expect(page.getByRole("dialog", { name: "FIELD GUIDE" })).toBeVisible();
  await page.getByRole("button", { name: "Close field guide" }).click();

  await page.getByRole("button", { name: "CREDITS", exact: true }).first().click();
  await expect(page.getByRole("dialog", { name: "CREDITS & LICENSES" })).toBeVisible();
  await page.getByRole("button", { name: "Close credits" }).click();

  await page.locator(".sound-settings > summary").click();
  await expect(page.getByLabel("Sound settings")).toBeVisible();
  await page.locator(".sound-settings > summary").click();
  await expect(page.getByLabel("Sound settings")).toBeHidden();
});

test("a browser slot restores the exact strategy or force phase", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop browser-slot phase regression");
  await page.goto("/");
  await page.getByRole("button", { name: "ENABLE SAVING & BEGIN" }).click();
  await completeStrategy(page);
  await page.waitForTimeout(650);

  await page.reload();
  await page.getByRole("button", { name: /Load New campaign/ }).click();
  await expect(page.locator(".mission-panel")).toBeVisible();
  await expect(page.locator(".force-panel")).toHaveCount(0);

  await page.getByRole("button", { name: "CONTINUE TO FORCE DESIGN" }).click();
  await page.waitForTimeout(650);
  await page.reload();
  await page.getByRole("button", { name: /Load New campaign/ }).click();
  await expect(page.locator(".force-panel")).toBeVisible();
  await expect(page.locator(".mission-panel")).toHaveCount(0);
});

test("portable imports restore explicit strategy and force phases", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop portable-import phase regression");
  await page.goto("/");
  await page.getByRole("button", { name: "ENABLE SAVING & BEGIN" }).click();
  await completeStrategy(page);
  await page.waitForTimeout(650);

  const baseSave = await page.evaluate(() => {
    const index = JSON.parse(localStorage.getItem("fog-of-sea-save-index-v1") || "[]") as Array<{ id: string }>;
    return JSON.parse(localStorage.getItem(`fog-of-sea-save-v1:${index[0].id}`) || "null") as Record<string, unknown>;
  });
  const importStage = async (planningStage: "strategy" | "force") => {
    const imported = structuredClone(baseSave) as { preferences: Record<string, unknown> };
    imported.preferences.planningStage = planningStage;
    await page.getByRole("button", { name: "SAVE / LOAD", exact: true }).first().click();
    await page.getByLabel("Import FOG OF SEA text save").setInputFiles({
      name: `${planningStage}-phase.txt`,
      mimeType: "text/plain",
      buffer: Buffer.from(JSON.stringify(imported)),
    });
    await page.getByRole("button", { name: "Close save and load panel" }).click();
  };

  await importStage("force");
  await expect(page.locator(".force-panel")).toBeVisible();
  await expect(page.locator(".mission-panel")).toHaveCount(0);

  await importStage("strategy");
  await expect(page.locator(".mission-panel")).toBeVisible();
  await expect(page.locator(".force-panel")).toHaveCount(0);
});
