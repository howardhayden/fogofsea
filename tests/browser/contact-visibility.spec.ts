import { expect, test, type Page } from "@playwright/test";

async function openSession(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "PLAY WITHOUT BROWSER SAVING" }).click();
  await expect(page.getByRole("dialog", { name: "HOW SHOULD THIS GAME REMEMBER YOU?" })).toBeHidden();
}

async function completeSurfaceStrategy(page: Page) {
  await page.locator(".warfare-grid").getByRole("button", { name: /^Surface operations\b/i }).click();
  await page.locator("#strategic-end-state").selectOption("access");
  await page.locator("#strategic-primary-theory").selectOption("sun-tzu");
  await page.locator("#strategic-partner-theory").selectOption("clausewitz");
  await page.locator("#strategic-guardrail").selectOption("escalation");
  await page.getByRole("button", { name: "CONTINUE TO FORCE DESIGN" }).click();
}

async function selectPlotLayer(page: Page, layer: "sky" | "air" | "surface" | "subsurface") {
  await page.locator(".depth-control").getByRole("button", { name: layer, exact: true }).click();
  const plot = page.locator(`.battlefield-canvas.layer-${layer}`);
  await expect(plot).toBeVisible();
  return plot;
}

async function expectNoContacts(page: Page, layer: "sky" | "air" | "surface" | "subsurface", domain: "air" | "surface" | "subsurface") {
  const plot = await selectPlotLayer(page, layer);
  await expect(plot).toHaveAttribute("data-contact-domain", domain);
  await expect(plot).toHaveAttribute("data-visible-unknown-contacts", "0");
  await expect(plot.locator(".fallback-contact")).toHaveCount(0);
  await expect(page.locator("#contact-visual-note")).toHaveText(
    `Selected force has no credited ${domain}-detection capability; no unknown markers are shown.`,
  );
}

test("unknown contacts require compatible mission credit and stay within the sensed domain", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop force-to-plot integration contract");
  test.setTimeout(90_000);

  await openSession(page);
  await expectNoContacts(page, "surface", "surface");
  await completeSurfaceStrategy(page);

  // This aviation host is selectable for a surface mission through its possible
  // embarked capabilities, but it earns no mission credit by itself.
  await page.getByRole("button", { name: "Add one Short-deck aviation ship" }).click();
  const aviationShip = page.getByRole("listitem", { name: "SHORT-DECK AVIATION" });
  await expect(aviationShip).toContainText("MISSION CREDIT · 0/1 vessels");

  await page.getByRole("button", { name: "EMBARKED AVIATION", exact: true }).click();

  // Fill the only deck with an affiliated but mission-uncredited aircraft type.
  // A subsequently selected surface-sensing aircraft therefore remains a raw,
  // unsupported selection and must not unlock an opposing contact picture.
  const addFiller = page.getByRole("button", { name: "Add one Short-takeoff multirole aircraft" });
  await addFiller.focus();
  for (let count = 0; count < 44; count += 1) await page.keyboard.press("Enter");
  const filler = page.getByRole("listitem", { name: "SHORT-TAKEOFF MULTIROLE" });
  await expect(filler).toContainText("COMPATIBLE · 44/44 aircraft");
  await expect(filler).toContainText("MISSION CREDIT · 0/44 aircraft");

  await page.getByRole("button", { name: "Add one Shipborne rescue rotorcraft" }).click();
  const unsupportedSensor = page.getByRole("listitem", { name: "RESCUE ROTORCRAFT" });
  await expect(unsupportedSensor).toContainText("COMPATIBLE · 0/1 aircraft");
  await expect(unsupportedSensor).toContainText("MISSION CREDIT · 0/1 aircraft");

  await expectNoContacts(page, "surface", "surface");
  await expectNoContacts(page, "air", "air");
  await expectNoContacts(page, "subsurface", "subsurface");

  // A second compatible deck legally hosts the relevant aircraft. Mission
  // credit now unlocks only the surface picture its sensors can establish.
  await page.getByRole("button", { name: "FLEET", exact: true }).click();
  await page.getByRole("button", { name: "Add one Short-deck aviation ship" }).click();
  await expect(aviationShip).toContainText("MISSION CREDIT · 1/2 vessels");

  await page.getByRole("button", { name: "EMBARKED AVIATION", exact: true }).click();
  await expect(unsupportedSensor).toContainText("COMPATIBLE · 1/1 aircraft");
  await expect(unsupportedSensor).toContainText("MISSION CREDIT · 1/1 aircraft");

  const surfacePlot = await selectPlotLayer(page, "surface");
  const surfaceCount = Number(await surfacePlot.getAttribute("data-visible-unknown-contacts"));
  expect(surfaceCount).toBeGreaterThanOrEqual(1);
  expect(surfaceCount).toBeLessThanOrEqual(3);
  await expect(surfacePlot.locator(".fallback-contact.contact-surface")).toHaveCount(surfaceCount);
  await expect(surfacePlot.locator(".fallback-contact:not(.contact-surface)")).toHaveCount(0);
  await expect(page.locator("#contact-visual-note")).toHaveText(
    new RegExp(`^${surfaceCount} unidentified surface contact marker(?: is|s are) shown because the selected force has credited surface-detection capability\\. Markers communicate uncertainty, not exact identity or opposing composition\\.$`),
  );

  const markerContracts = await surfacePlot.locator(".fallback-contact").evaluateAll((markers) => markers.map((marker) => ({
    text: marker.textContent,
    title: marker.getAttribute("title"),
    ariaLabel: marker.getAttribute("aria-label"),
    dataKeys: Object.keys((marker as HTMLElement).dataset),
  })));
  expect(markerContracts).toEqual(Array.from({ length: surfaceCount }, () => ({
    text: "",
    title: null,
    ariaLabel: null,
    dataKeys: [],
  })));

  await expectNoContacts(page, "sky", "air");
  await expectNoContacts(page, "air", "air");
  await expectNoContacts(page, "subsurface", "subsurface");

  const restoredSurfacePlot = await selectPlotLayer(page, "surface");
  await expect(restoredSurfacePlot).toHaveAttribute("data-visible-unknown-contacts", String(surfaceCount));
  await expect(restoredSurfacePlot.locator(".fallback-contact.contact-surface")).toHaveCount(surfaceCount);
});
