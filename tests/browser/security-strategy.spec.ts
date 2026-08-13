import { expect, test, type Page } from "@playwright/test";

async function openSession(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "PLAY WITHOUT BROWSER SAVING" }).click();
}

test("untrusted browser-save text remains bounded literal text and cannot execute", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop storage and DOM trust-boundary proof");
  await page.goto("/");
  const payload = `<img src=x onerror="window.__injected=1">\u202egame${"x".repeat(100)}`;
  await page.locator("#pregame-save-name").fill(payload);
  await page.getByRole("button", { name: "ENABLE SAVING & BEGIN" }).click();
  await page.getByRole("button", { name: "SAVE / LOAD", exact: true }).first().click();
  const storedName = await page.evaluate(() => {
    const index = JSON.parse(localStorage.getItem("fog-of-sea-save-index-v1") || "[]") as Array<{ name: string }>;
    return index[0]?.name || "";
  });
  expect(storedName.length).toBeLessThanOrEqual(60);
  expect(storedName).not.toContain("\u202e");
  expect(await page.evaluate(() => (window as Window & { __injected?: number }).__injected ?? 0)).toBe(0);
  await expect(page.locator(".saved-game-scroll img")).toHaveCount(0);
  await expect(page.locator(".saved-game-scroll")).toContainText("<img src=x onerror=");
});

test("Academy links maritime thinkers to drones, wolfpacks, environment, and political purpose", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop Academy copy audit");
  await openSession(page);
  await page.getByRole("button", { name: "ACADEMY", exact: true }).first().click();
  const academy = page.getByRole("dialog", { name: "THE ACADEMY" });
  await expect(academy).toBeVisible();
  await academy.getByRole("button", { name: /Uncrewed systems in maritime strategy/ }).click();
  await expect(academy).toContainText("Distributed sensing, autonomous lanes, attritable mass");
  await expect(academy).toContainText("Paul Scharre");
  await expect(academy).toContainText("Wayne P. Hughes Jr.");
  await academy.getByRole("button", { name: /Undersea campaigns and coordinated patrol/ }).click();
  await expect(academy).toContainText("Coordinated wolfpack");
  await expect(academy).toContainText("Guerre de course");
  await expect(academy).toContainText("Guerre d’escadre");
  await expect(academy).toContainText("geography, season, time, and political aim");
  await academy.getByRole("button", { name: /Risk, resilience, and continuity/ }).click();
  await expect(academy).toContainText("Preparedness develops warning");
  await expect(academy).toContainText("Residual risk");
  await expect(academy).toContainText("Ortwin Renn");
  await academy.getByRole("button", { name: /Multi-adversary strategy and escalation/ }).click();
  await expect(academy).toContainText("Plural adversaries are not one larger opponent");
  await expect(academy).toContainText("Mahanian concentration");
  await expect(academy).toContainText("Thomas C. Schelling");
});

test("command exposes environment-sensitive uncrewed and undersea methods without revealing force identities", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop command doctrine contract");
  await openSession(page);
  await page.locator(".warfare-grid").getByRole("button", { name: /Intelligence and reconnaissance/i }).click();
  await page.locator("#strategic-end-state").selectOption({ index: 1 });
  await page.locator("#strategic-primary-theory").selectOption({ index: 1 });
  await page.locator("#strategic-partner-theory").selectOption({ index: 2 });
  await page.locator("#strategic-guardrail").selectOption({ index: 1 });
  await expect(page.locator(".operational-guidance")).toContainText("Assessed opposing method");
  await page.getByRole("button", { name: "CONTINUE TO FORCE DESIGN" }).click();
  await page.getByRole("button", { name: /Add one Fleet aviation ship/ }).click();
  await page.getByRole("button", { name: /BEGIN COMMAND PHASE/ }).click();
  const review = page.locator(".confirm-dialog");
  await expect(review).toBeVisible();
  await review.getByRole("button", { name: "PROCEED ANYWAY" }).click();
  await expect(page.locator("#rigid-uncrewed")).toBeVisible();
  await expect(page.locator("#rigid-undersea")).toBeVisible();
  await expect(page.locator("#rigid-risk-treatment")).toBeVisible();
  await expect(page.locator("#rigid-coordination")).toBeVisible();
  await expect(page.locator("#rigid-strategic-policy")).toBeVisible();
  await page.locator("#rigid-uncrewed").selectOption("deception-swarm");
  await page.locator("#rigid-undersea").selectOption("coordinated-wolfpack");
  await page.locator("#rigid-risk-treatment").selectOption("recover");
  await page.locator("#rigid-coordination").selectOption("mutual-support");
  await page.locator("#rigid-strategic-policy").selectOption("nuclear-deterrent");
  await expect(page.locator("#rigid-undersea-note")).toContainText("coordination improves pressure");
  await expect(page.locator(".operational-frame")).toContainText("Assessed opposing posture");
  await expect(page.locator(".operational-frame")).toContainText("Distinct opposing actors");
  await expect(page.locator("#rigid-strategic-policy-note")).toContainText("deterrence may fail");
  await expect(page.locator(".operational-frame")).not.toContainText(/destroyer|submarine count|aircraft type/i);
});
