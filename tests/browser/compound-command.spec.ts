import { expect, test, type Page } from "@playwright/test";

/**
 * Give the real scenario generator a repeatable browser entropy stream. This
 * value produces a challenge scenario whose disclosed compound frame includes
 * a turn-two severe-weather window, a turn-two opposing-coordination window,
 * and a turn-two secondary objective. The app's own scenario matrix
 * still commits and resolves every internal draw deterministically.
 */
async function installRepeatableChallengeScenario(page: Page) {
  await page.addInitScript(() => {
    Math.random = () => 0.7;
  });
}

async function openChallengeSession(page: Page) {
  await installRepeatableChallengeScenario(page);
  await page.goto("/");
  await page.getByRole("radio", { name: /Challenge/i }).check();
  await page.getByRole("button", { name: "PLAY WITHOUT BROWSER SAVING" }).click();
  await expect(page.getByRole("dialog", { name: "HOW SHOULD THIS GAME REMEMBER YOU?" })).toBeHidden();
}

async function completeAdversaryAssessment(page: Page) {
  for (const selector of [
    "#adversary-intent-assumption",
    "#observed-pattern-assumption",
    "#adversary-next-action-assumption",
  ]) await page.locator(selector).selectOption("insufficient-evidence");
}

async function beginCommand(page: Page) {
  await page.locator(".warfare-grid").getByRole("button", { name: /Intelligence and reconnaissance/i }).click();
  await page.locator("#strategic-end-state").selectOption("access");
  await page.locator("#strategic-primary-theory").selectOption("sun-tzu");
  await page.locator("#strategic-partner-theory").selectOption("clausewitz");
  await page.locator("#strategic-guardrail").selectOption("escalation");
  await page.getByRole("button", { name: "CONTINUE TO FORCE DESIGN" }).click();

  // A command host plus several escorts keeps the deliberately incomplete
  // challenge force alive long enough to observe the complete event sequence.
  await page.getByRole("button", { name: "Add one Fleet aviation ship" }).click();
  const addEscort = page.getByRole("button", { name: "Add one Multi-role frigate" });
  for (let count = 0; count < 3; count += 1) await addEscort.click();

  await page.getByRole("button", { name: /BEGIN COMMAND PHASE/ }).click();
  const review = page.getByRole("dialog", { name: "Readiness review found likely failure points" });
  if (await review.isVisible()) await review.getByRole("button", { name: "PROCEED ANYWAY" }).click();
  await expect(page.getByRole("heading", { name: "TURN 1 OF 6" })).toBeVisible();
}

async function contactQuality(page: Page) {
  const text = await page.locator("#command-known .intelligence-state-grid > div")
    .filter({ hasText: "CONTACT QUALITY" })
    .locator("dd")
    .textContent();
  return Number(text?.split("/")[0]);
}

test("challenge command discloses actionable events and concise outcomes without leaking internal draws or concealed losses", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop compound-command regression");
  test.setTimeout(90_000);

  await openChallengeSession(page);
  await beginCommand(page);

  const intelligence = page.locator(".command-intelligence-panel");
  await expect(intelligence.getByRole("heading", { name: "ABSOLUTELY KNOWN" })).toBeVisible();
  await expect(intelligence.getByRole("heading", { name: "POTENTIALS · STAFF JUDGMENT" })).toBeVisible();
  await expect(intelligence.getByRole("heading", { name: "IMMEDIATE" })).toBeVisible();
  await expect(intelligence).not.toContainText(/committed chance|draw \d+\/100|fixed by the scenario/i);

  // The report keeps only the outcome and actionable change in ordinary play.
  // Internal draws and matrix notes remain available through reference material.
  await page.getByRole("button", { name: "RESOLVE TURN 1" }).click();
  const firstReport = page.locator(".kriegsspiel-report").filter({ hasText: "LAST TURN · 1" });
  await expect(firstReport).toContainText("CHANGE");
  await expect(firstReport).not.toContainText(/nested matrix|committed chance|draw \d+\/100|fixed by the scenario/i);

  // Resolving turn one moves to the seeded Turn 2 picture. Directly
  // observable weather, selected-force effects, and the newly disclosed
  // objective enter Immediate before orders. Opposing-only coordination and
  // the independent actor remain concealed without an earned contact picture.
  await expect(page.getByRole("heading", { name: "TURN 2 OF 6" })).toBeVisible();
  await expect(page.locator("#adversary-intent-assumption")).toBeVisible();
  await expect(page.locator("#observed-pattern-assumption")).toBeVisible();
  await expect(page.locator("#adversary-next-action-assumption")).toBeVisible();
  const immediate = page.locator("#command-log-immediate");
  await expect(immediate).toContainText("Severe polar low");
  await expect(immediate).toContainText("Secure an evidence handoff");
  await expect(intelligence).not.toContainText(/Opposing cooperation window|Independent .*?(?:network|group|spoiler|broker)/i);
  await expect(page.locator("#command-history-turn-2")).toHaveCount(0);
  await expect(page.locator("#command-known .intelligence-state-grid")).toContainText("SECONDARY OBJECTIVE");

  // Selected-force effects identify a real selected asset, the unavailable
  // capability, and the recovery turn. Opposing effects stay concealed while
  // the contact picture remains below the disclosure threshold.
  expect(await contactQuality(page)).toBeLessThan(40);
  await expect(immediate).toContainText(/Fleet aviation ship|Multi-role frigate/);
  await expect(immediate).toContainText("Unavailable through turn 4");
  await expect(immediate).toContainText("CONFIRMED FORCE CHANGE");
  await expect(intelligence).not.toContainText(/assessed opposing (?:surface|air|undersea|command)/i);

  // Once Turn 2 resolves, those Turn 2 facts move into the Turn 2 History
  // group with their explicit discovery label while Immediate remains useful.
  await completeAdversaryAssessment(page);
  await page.getByRole("button", { name: "RESOLVE TURN 2" }).click();
  const activeReport = page.locator(".kriegsspiel-report").filter({ hasText: "LAST TURN · 2" });
  await expect(activeReport).toContainText("CHANGE");
  await expect(activeReport).not.toContainText(/affected credited capacities|nested matrix|committed chance|draw \d+\/100/i);
  await expect(page.getByRole("heading", { name: "TURN 3 OF 6" })).toBeVisible();
  const turnTwoHistory = page.locator("#command-history-turn-2");
  await expect(turnTwoHistory).toContainText("Discovered during Turn 2");
  await expect(turnTwoHistory).toContainText("Severe polar low");
  await expect(turnTwoHistory).toContainText("Secure an evidence handoff");
  expect(await contactQuality(page)).toBeLessThan(40);
  await expect(intelligence).not.toContainText(/Opposing cooperation window|Independent .*?(?:network|group|spoiler|broker)|assessed opposing (?:surface|air|undersea|command)/i);
});
