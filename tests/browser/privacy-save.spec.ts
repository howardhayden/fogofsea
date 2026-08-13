import { expect, test } from "@playwright/test";

test("a browser slot retains its explicit written-analysis policy across reload and autosave", async ({ page }) => {
  test.skip(test.info().project.name !== "desktop-chromium", "Desktop persistence flow");
  await page.goto("/");
  await page.getByLabel("Include my written analysis").check();
  await page.getByRole("button", { name: "ENABLE SAVING & BEGIN" }).click();

  await page.locator(".warfare-grid button").first().click();
  await page.locator("#strategic-end-state").selectOption("access");
  await page.locator("#strategic-primary-theory").selectOption("sun-tzu");
  await page.locator("#strategic-partner-theory").selectOption("clausewitz");
  await page.locator("#strategic-guardrail").selectOption("escalation");
  await page.getByText("OPTIONAL WRITTEN ANALYSIS · NEVER SCORED").click();
  await page.getByLabel("COMMANDER'S LOGIC").fill("Keep the corridor open without unnecessary commitment.");
  await page.waitForTimeout(650);

  const firstSave = await page.evaluate(() => {
    const index = JSON.parse(localStorage.getItem("fog-of-sea-save-index-v1") || "[]") as Array<{ id: string; includeWrittenAnalysis?: boolean }>;
    const slot = index[0];
    const saved = JSON.parse(localStorage.getItem(`fog-of-sea-save-v1:${slot.id}`) || "null") as { game?: { rationale?: string } } | null;
    return { policy: slot.includeWrittenAnalysis, rationale: saved?.game?.rationale };
  });
  expect(firstSave).toEqual({ policy: true, rationale: "Keep the corridor open without unnecessary commitment." });

  await page.reload();
  await page.getByRole("button", { name: /Load New campaign/ }).click();
  await page.getByRole("button", { name: "SAVE / LOAD" }).first().click();
  await expect(page.getByLabel("Include written analysis in this browser save")).toBeChecked();
  await page.waitForTimeout(650);

  const retained = await page.evaluate(() => {
    const index = JSON.parse(localStorage.getItem("fog-of-sea-save-index-v1") || "[]") as Array<{ id: string; includeWrittenAnalysis?: boolean }>;
    const slot = index[0];
    const saved = JSON.parse(localStorage.getItem(`fog-of-sea-save-v1:${slot.id}`) || "null") as { game?: { rationale?: string } } | null;
    return { policy: slot.includeWrittenAnalysis, rationale: saved?.game?.rationale };
  });
  expect(retained).toEqual(firstSave);
});
