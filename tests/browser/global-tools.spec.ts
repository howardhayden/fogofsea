import { expect, test, type Page } from "@playwright/test";

async function openSession(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "PLAY WITHOUT BROWSER SAVING" }).click();
  await expect(page.getByRole("dialog", { name: "HOW SHOULD THIS GAME REMEMBER YOU?" })).toBeHidden();
}

async function openGlobalTools(page: Page) {
  const menu = page.locator(".global-tools-menu");
  const summary = menu.locator(":scope > summary");
  await summary.click();
  await expect(menu).toHaveAttribute("open", "");
  return { menu, summary };
}

test("responsive global tools remain reachable across every compact desktop breakpoint", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Responsive breakpoint contract");
  await openSession(page);

  for (const width of [761, 919, 921, 1120]) {
    await page.setViewportSize({ width, height: 800 });
    const { menu, summary } = await openGlobalTools(page);
    for (const label of ["ACADEMY", "SAVE / LOAD", "FIELD GUIDE", "CREDITS", "SOUND SETTINGS"]) {
      await expect(menu.getByRole("button", { name: label, exact: true }), `${label} at ${width}px`).toBeVisible();
    }
    await page.keyboard.press("Escape");
    await expect(menu).not.toHaveAttribute("open", "");
    await expect(summary).toBeFocused();
  }
});

test("global-tool overlays and sound settings restore focus to the visible menu opener", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Responsive focus contract");
  await openSession(page);
  await page.setViewportSize({ width: 919, height: 800 });

  let tools = await openGlobalTools(page);
  await tools.menu.getByRole("button", { name: "FIELD GUIDE", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "FIELD GUIDE" })).toBeVisible();
  await page.getByRole("button", { name: "Close field guide" }).click();
  await expect(tools.summary).toBeFocused();

  tools = await openGlobalTools(page);
  await tools.menu.getByRole("button", { name: "CREDITS", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "CREDITS & LICENSES" })).toBeVisible();
  await page.getByRole("button", { name: "Close credits" }).click();
  await expect(tools.summary).toBeFocused();

  tools = await openGlobalTools(page);
  await tools.menu.getByRole("button", { name: "SOUND SETTINGS", exact: true }).click();
  const soundSettings = page.getByRole("dialog", { name: "Sound settings" });
  await expect(soundSettings).toBeVisible();
  await expect(soundSettings.getByRole("button", { name: "Close audio controls" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(soundSettings).toBeHidden();
  await expect(tools.summary).toBeFocused();
});

test("mobile Tools uses the same bounded glass drawer, scrim, and focus contract as workspace navigation", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Compact Tools drawer contract");
  test.setTimeout(120_000);
  await openSession(page);
  const menu = page.locator(".global-tools-menu");
  const summary = menu.locator(":scope > summary");
  await summary.click();
  await expect(menu).toHaveAttribute("open", "");
  const nav = menu.locator(":scope > nav");
  const scrim = menu.locator(":scope > .mobile-menu-scrim");
  await expect(nav).toBeVisible();
  await expect(scrim).toBeVisible();
  const geometry = await nav.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      left: rect.left,
      right: rect.right,
      width: rect.width,
      viewportWidth: innerWidth,
      maxHeight: style.maxHeight,
      filter: style.backdropFilter || style.getPropertyValue("-webkit-backdrop-filter"),
    };
  });
  expect(geometry.left).toBeGreaterThanOrEqual(-0.5);
  expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth + 0.5);
  expect(geometry.width).toBeGreaterThanOrEqual(geometry.viewportWidth - 1);
  expect(geometry.filter).toContain("blur(22px)");

  await page.keyboard.press("Escape");
  await expect(menu).not.toHaveAttribute("open", "");
  await expect(summary).toBeFocused();

  await summary.click();
  await scrim.click({ position: { x: 2, y: 2 } });
  await expect(menu).not.toHaveAttribute("open", "");
  await expect(summary).toBeFocused();

  await summary.click();
  await menu.getByRole("button", { name: "FIELD GUIDE", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "FIELD GUIDE" })).toBeVisible();
  await page.getByRole("button", { name: "Close field guide" }).click();
  await expect(summary).toBeFocused();
});

test("compact topbar controls stay inside 320, 360, and 400 pixel viewports", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Narrow containment contract");
  await openSession(page);

  for (const width of [320, 360, 400]) {
    await page.setViewportSize({ width, height: 800 });
    const geometry = await page.evaluate(() => {
      const controls = [...document.querySelectorAll<HTMLElement>(".topbar button, .topbar summary")]
        .filter((node) => {
          const rect = node.getBoundingClientRect();
          const style = getComputedStyle(node);
          const closedDetails = node.closest("details:not([open])");
          return (!closedDetails || closedDetails.querySelector(":scope > summary") === node)
            && rect.width > 0
            && rect.height > 0
            && style.display !== "none"
            && style.visibility !== "hidden";
        })
        .map((node) => {
          const rect = node.getBoundingClientRect();
          return { name: node.getAttribute("aria-label") || node.textContent?.trim() || node.tagName, left: rect.left, right: rect.right };
        });
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        controls,
      };
    });

    expect(geometry.overflow, `${width}px document overflow`).toBeLessThanOrEqual(1);
    expect(geometry.controls.length, `${width}px visible global controls`).toBeGreaterThanOrEqual(4);
    for (const control of geometry.controls) {
      expect(control.left, `${control.name} left edge at ${width}px`).toBeGreaterThanOrEqual(-0.5);
      expect(control.right, `${control.name} right edge at ${width}px`).toBeLessThanOrEqual(width + 0.5);
    }
  }
});
