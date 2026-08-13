import { expect, test, type Locator, type Page } from "@playwright/test";

async function openSession(page: Page) {
  await page.goto("/");
  const privacyDialog = page.getByRole("dialog", { name: "HOW SHOULD THIS GAME REMEMBER YOU?" });
  await expect(privacyDialog).toBeVisible();
  await page.getByRole("button", { name: "PLAY WITHOUT BROWSER SAVING" }).click();
  await expect(privacyDialog).toBeHidden();
}

async function chooseMobileView(page: Page, name: string) {
  await page.locator(".mobile-disclosure summary").click();
  await page.getByRole("button", { name, exact: true }).click();
}

async function expectCounterBelowExpandedInformation(card: Locator, label: string) {
  await card.scrollIntoViewIfNeeded();
  const details = card.locator(".roster-details");
  await details.locator("summary").click();
  await expect(details).toHaveAttribute("open", "");

  const geometry = await card.evaluate((element) => {
    const copy = element.querySelector<HTMLElement>(".roster-copy")!;
    const counter = element.querySelector<HTMLElement>(".counter")!;
    const buttons = [...counter.querySelectorAll<HTMLElement>("button")];
    const nextCard = element.nextElementSibling?.matches(".roster-row")
      ? element.nextElementSibling as HTMLElement
      : null;
    const rect = (target: Element) => {
      const box = target.getBoundingClientRect();
      return { top: box.top, right: box.right, bottom: box.bottom, left: box.left, width: box.width, height: box.height };
    };
    return {
      card: rect(element),
      copy: rect(copy),
      counter: rect(counter),
      buttons: buttons.map(rect),
      nextCard: nextCard ? rect(nextCard) : null,
      counterFollowsCopy: Boolean(copy.compareDocumentPosition(counter) & Node.DOCUMENT_POSITION_FOLLOWING),
      counterIsLastElement: element.lastElementChild === counter,
    };
  });

  expect(geometry.counterFollowsCopy, `${label}: action controls follow descriptive content in reading order`).toBe(true);
  expect(geometry.counterIsLastElement, `${label}: the quantity control is the card's final information row`).toBe(true);
  expect(geometry.counter.top, `${label}: expanded information clears the quantity control`).toBeGreaterThanOrEqual(geometry.copy.bottom);
  expect(geometry.counter.left, `${label}: quantity control remains inside the card`).toBeGreaterThanOrEqual(geometry.card.left);
  expect(geometry.counter.right, `${label}: quantity control remains inside the card`).toBeLessThanOrEqual(geometry.card.right);
  expect(geometry.counter.bottom, `${label}: quantity control remains inside the card`).toBeLessThanOrEqual(geometry.card.bottom + 1);
  for (const button of geometry.buttons) {
    expect(button.width, `${label}: counter button is a 44px-wide target`).toBeGreaterThanOrEqual(44);
    expect(button.height, `${label}: counter button is a 44px-tall target`).toBeGreaterThanOrEqual(44);
  }
  if (geometry.nextCard) {
    expect(geometry.nextCard.top, `${label}: expanding a card pushes the following card below it`).toBeGreaterThanOrEqual(geometry.card.bottom - 1);
  }
}

test("vessel, submarine, aircraft, and mission-pack cards put quantity controls after all item information", async ({ page }, testInfo) => {
  if (testInfo.project.name === "desktop-chromium") await page.setViewportSize({ width: 1024, height: 545 });
  await openSession(page);

  if (await page.locator(".mobile-gamebar").isVisible()) await chooseMobileView(page, "DECISIONS");
  await page.locator(".warfare-grid").getByRole("button", { name: /Intelligence and reconnaissance/i }).click();
  await page.locator("#strategic-end-state").selectOption("access");
  await page.locator("#strategic-primary-theory").selectOption("sun-tzu");
  await page.locator("#strategic-partner-theory").selectOption("clausewitz");
  await page.locator("#strategic-guardrail").selectOption("escalation");
  await page.getByRole("button", { name: "CONTINUE TO FORCE DESIGN", exact: true }).click();
  await expect(page.locator(".force-panel")).toBeVisible();

  const fleetCards = page.locator(".roster-row");
  const vessel = fleetCards.filter({ hasText: "Fleet aviation ship" }).first();
  const submarine = fleetCards.filter({ hasText: "Air-independent patrol submarine" }).first();
  await expect(vessel).toContainText("notional personnel");
  await expect(submarine).toContainText("notional personnel");
  await expectCounterBelowExpandedInformation(vessel, "vessel card");
  await expectCounterBelowExpandedInformation(submarine, "submarine card");

  await vessel.getByRole("button", { name: "Add one Fleet aviation ship" }).click();
  await page.getByRole("button", { name: "EMBARKED AVIATION", exact: true }).click();
  const aircraft = page.locator(".roster-row").first();
  await expect(aircraft).toContainText("notional support personnel");
  await expectCounterBelowExpandedInformation(aircraft, "aircraft card");

  await page.getByRole("button", { name: "ARMAMENT PACKS", exact: true }).click();
  await expectCounterBelowExpandedInformation(page.locator(".roster-row").first(), "mission-pack card");
});
