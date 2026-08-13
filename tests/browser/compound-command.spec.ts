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
  const text = await page.locator(".kriegsspiel-grid").getByText(/\/100$/).nth(0).textContent();
  return Number(text?.split("/")[0]);
}

test("challenge command discloses actionable events and concise outcomes without leaking internal draws or concealed losses", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop compound-command regression");
  test.setTimeout(90_000);

  await openChallengeSession(page);
  await beginCommand(page);

  const situation = page.locator(".turn-situation-panel");
  await expect(situation.getByRole("heading", { name: "NO ACTIVE DISRUPTION" })).toBeVisible();
  await expect(situation.getByRole("heading", { name: "CURRENT OBJECTIVES" })).toBeVisible();
  await expect(situation).toContainText("Primary mission objective");
  await expect(situation.locator(".situation-probabilities")).toHaveCount(0);

  // The report keeps only the outcome and actionable change in ordinary play.
  // Internal draws and matrix notes remain available through reference material.
  await page.getByRole("button", { name: "RESOLVE TURN 1" }).click();
  const firstReport = page.locator(".kriegsspiel-report").filter({ hasText: "LAST TURN · 1" });
  await expect(firstReport).toContainText("CHANGE");
  await expect(firstReport).not.toContainText(/nested matrix|committed chance|draw \d+\/100|fixed by the scenario/i);

  // Resolving turn one moves the current situation to the seeded turn-two
  // weather, cooperation, and independent-opportunist windows, before those
  // windows are adjudicated.
  await expect(page.getByRole("heading", { name: "TURN 2 OF 6" })).toBeVisible();
  await expect(situation.getByRole("heading", { name: "3 ACTIVE DISRUPTIONS" })).toBeVisible();

  const weather = situation.locator('.situation-event[data-kind="severe-weather"]');
  const coordination = situation.locator('.situation-event[data-kind="opposing-coordination"]');
  const opportunist = situation.locator('.situation-event[data-kind="opportunistic-actor"]');
  await expect(weather).toBeVisible();
  await expect(weather).toContainText("Starts turn 2 · active through turn 4");
  await expect(coordination).toBeVisible();
  await expect(coordination).toContainText("Starts turn 2 · active through turn 3");
  await expect(opportunist).toBeVisible();
  await expect(opportunist).toContainText(/independent|no shared command/i);

  // Selected-force effects identify a real selected asset, the unavailable
  // capability, and the recovery turn. Opposing effects stay concealed while
  // the contact picture remains below the disclosure threshold.
  expect(await contactQuality(page)).toBeLessThan(40);
  const disclosedImpacts = weather.locator(".situation-impact-list");
  await expect(disclosedImpacts).toContainText(/Fleet aviation ship|Multi-role frigate/);
  await expect(disclosedImpacts).toContainText("unavailable through turn 4");
  await expect(disclosedImpacts).toContainText("Unavailable:");
  await expect(situation).not.toContainText(/assessed opposing (?:surface|air|undersea|command)/i);
  await expect(coordination.locator(".situation-impact-list")).toHaveCount(0);
  await expect(situation.locator('.situation-objectives li[data-new="true"]')).toContainText("SECONDARY · NEW");
  await expect(situation.locator('.situation-objectives li[data-new="true"]')).toContainText(/\d+% · active/);

  // Turn three retains the stated outage and revealed objective while the
  // ordinary report avoids implementation-level adjudication prose.
  await page.getByRole("button", { name: "RESOLVE TURN 2" }).click();
  const activeReport = page.locator(".kriegsspiel-report").filter({ hasText: "LAST TURN · 2" });
  await expect(activeReport).toContainText("CHANGE");
  await expect(activeReport).not.toContainText(/affected credited capacities|nested matrix|committed chance|draw \d+\/100/i);
  await expect(page.getByRole("heading", { name: "TURN 3 OF 6" })).toBeVisible();
  await expect(weather).toContainText("unavailable through turn 4");
  await expect(situation.locator('.situation-objectives li[data-new="false"]').filter({ hasText: "SECONDARY" })).toBeVisible();
  expect(await contactQuality(page)).toBeLessThan(40);
  await expect(situation).not.toContainText(/assessed opposing (?:surface|air|undersea|command)/i);
});
