import { readFileSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";

async function openSession(page: Page) {
  await page.goto("/");
  const privacyDialog = page.getByRole("dialog", { name: "HOW SHOULD THIS GAME REMEMBER YOU?" });
  await expect(privacyDialog).toBeVisible();
  await page.getByRole("button", { name: "PLAY WITHOUT BROWSER SAVING" }).click();
  await expect(privacyDialog).toBeHidden();
  await expect(page.locator(".battlefield-canvas")).toHaveCount(1);
}

async function completeStrategicChoices(page: Page) {
  if (!await page.locator(".warfare-grid button.selected").count()) {
    await page.locator(".warfare-grid button").first().click();
  }
  await page.locator("#strategic-end-state").selectOption("access");
  await page.locator("#strategic-primary-theory").selectOption("sun-tzu");
  await page.locator("#strategic-partner-theory").selectOption("clausewitz");
  await page.locator("#strategic-guardrail").selectOption("escalation");
}

async function beginCompactCommand(page: Page) {
  const disclosure = page.locator(".mobile-disclosure");
  await disclosure.locator(":scope > summary").click();
  await disclosure.getByRole("button", { name: "DECISIONS", exact: true }).click();
  const intelligence = page.locator(".warfare-grid").getByRole("button", { name: /Intelligence and reconnaissance/i });
  if (!await intelligence.getAttribute("aria-pressed").then((value) => value === "true")) await intelligence.click();
  await completeStrategicChoices(page);
  await page.getByRole("button", { name: "CONTINUE TO FORCE DESIGN" }).click();
  await page.getByRole("button", { name: "Add one Fleet aviation ship" }).click();
  await page.getByRole("button", { name: /BEGIN COMMAND PHASE/ }).click();
  const review = page.getByRole("dialog", { name: "Readiness review found likely failure points" });
  // Readiness varies with the accepted whole-scenario synthesis. A deficient
  // force requires confirmation; an already viable candidate transitions
  // directly. Both paths must reach the identical command workspace.
  if (await review.isVisible()) await review.getByRole("button", { name: "PROCEED ANYWAY" }).click();
  await expect(page.getByRole("heading", { name: /TURN 1 OF 6/ })).toBeVisible();
}

function desktopOnly(projectName: string) {
  test.skip(projectName !== "desktop-chromium", "Desktop layout assertion");
}

function mobileOnly(projectName: string) {
  test.skip(projectName !== "mobile-chromium", "Mobile workspace assertion");
}

test("HUD disclosure wrappers are structurally paintless in the stylesheet", () => {
  const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
  const paintDeclaration = /(?:^|;)\s*(?:background(?:-[\w-]+)?|border(?:-[\w-]+)?|box-shadow|-webkit-backdrop-filter|backdrop-filter|filter)\s*:/m;
  const wrapperSelector = /(?:^|[ >])\.(?:plot-data-readout|sky-readout|environment-readout|legend)(?:\[[^\]]+\])?$/;
  const violations: string[] = [];

  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!paintDeclaration.test(match[2])) continue;
    for (const selector of match[1].split(",").map((item) => item.trim())) {
      if (wrapperSelector.test(selector)) violations.push(selector);
    }
  }

  expect(violations, "semantic/positioning wrappers must never be paint surfaces").toEqual([]);
});

test("one canonical glass source owns every occupied app surface", () => {
  const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
  const canonical = css.match(/\/\* Canonical app glass[\s\S]*?\.app :is\(([\s\S]*?)\)\s*\{([\s\S]*?)\n\}/);
  expect(canonical, "the final cascade exposes one auditable glass authority").not.toBeNull();
  const selectors = canonical?.[1] ?? "";
  const declaration = canonical?.[2] ?? "";
  for (const selector of [
    ".topbar", ".mission-panel", ".mobile-gamebar",
    ".time-control", ".depth-control", ".plot-data-readout > summary",
    ".sky-readout-toggle", ".save-indicator", ".global-tools-menu > nav",
    ".field-guide", ".data-dialog", ".privacy-gate", ".credits-dialog",
    ".confirm-dialog", ".academy", ".sound-settings section",
    ".kriegsspiel-panel", ".kriegsspiel-report", ".turn-situation-panel",
    ".planning-recap", ".result-card",
  ]) expect(selectors, `${selector} consumes the canonical material`).toContain(selector);
  expect(declaration).toContain("background: var(--glass-surface-background)");
  expect(declaration).toContain("box-shadow: var(--glass-surface-shadow)");
  expect(declaration).toContain("backdrop-filter: var(--glass-surface-filter)");
  expect(css.match(/--glass-panel-mix:\s*63%/g)?.length).toBe(2);
  expect(css).toMatch(/--overlay-scrim-background:\s*color-mix\(in srgb,\s*var\(--bg\)\s*var\(--overlay-scrim-mix\),\s*transparent\)/i);
  expect(css).toMatch(/\.app :is\(\.modal-backdrop,\s*\.academy-backdrop\)\s*\{[^}]*background:\s*var\(--overlay-scrim-background\)[^}]*backdrop-filter:\s*var\(--overlay-scrim-filter\)/i);
  expect(css).toMatch(/\.force-heading[^{}]*\{[^}]*background:\s*transparent[^}]*backdrop-filter:\s*none/i);
});

test("fallback aurora uses long fibered perspective paths instead of rectangular bands", () => {
  const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
  const curtainRule = css.match(/\.fallback-aurora i\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
  const animationStart = css.indexOf("@keyframes fallback-aurora-wave");
  const animation = animationStart >= 0 ? css.slice(animationStart, animationStart + 1_900) : "";

  expect(curtainRule).toContain("clip-path: polygon");
  expect(curtainRule).toContain("linear-gradient(to bottom");
  expect(curtainRule).toContain("repeating-linear-gradient");
  expect(curtainRule).toContain("var(--aurora-accent)");
  expect(curtainRule).toContain("filter: blur(.55px) drop-shadow");
  expect(curtainRule).not.toContain("radial-gradient");
  expect(curtainRule).toContain("translate3d");
  expect(curtainRule).toContain("rotateX");
  expect(curtainRule).toContain("fallback-aurora-wave");
  expect(css.match(/\.fallback-aurora i:nth-child/g)?.length ?? 0, "curtains receive independent timing and depth variants").toBeGreaterThanOrEqual(3);
  for (const phase of ["0%", "36%", "71%", "100%"] as const) expect(animation).toContain(phase);
  expect(animation).toContain("opacity:");
  expect(animation).toContain("scaleY(");
  expect(css).not.toContain("fallback-aurora-breathe");
  expect(css).toMatch(/prefers-reduced-motion[\s\S]*\.fallback-aurora i\s*\{\s*animation:\s*none !important;/);
});

test("fallback stars wander independently as bounded faceted glints instead of moving panels", () => {
  const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
  const starRule = css.match(/\.fallback-stars i\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
  const animationStart = css.indexOf("@keyframes fallback-star-twinkle");
  const animationEnd = css.indexOf(".fallback-aurora", animationStart);
  const animation = animationStart >= 0 ? css.slice(animationStart, animationEnd) : "";

  expect(starRule).toContain("clip-path: polygon");
  expect(starRule.match(/drop-shadow\(/g)?.length ?? 0, "a tight core and thin native-colour aura remain point-sized").toBe(2);
  expect(starRule).toContain("color-mix(in srgb, currentColor");
  expect(css).toMatch(/\.fallback-stars i\.near \{[^}]*width: 6\.5px;[^}]*height: 6\.5px;[^}]*opacity: \.82;/);
  expect(css).toMatch(/\.fallback-stars i\.nebula\.near \{ width: 3\.4px; height: 3\.4px; \}/);
  expect(css).toMatch(/\.fallback-stars i\.jewel \{[^}]*min-width: 3\.8px;[^}]*min-height: 3\.8px;[^}]*opacity: \.94;[^}]*drop-shadow\(0 0 5\.5px/);
  expect(css.match(/\.fallback-stars i:nth-of-type\(8n \+ [1-8]\)/g)?.length ?? 0, "direction families prevent shared sheet motion").toBe(8);
  expect(css).toContain(".fallback-stars i.still:nth-of-type(3n + 1)");
  for (const phase of ["0%", "23%", "52%", "77%", "100%"] as const) expect(animation).toContain(phase);
  expect(animation.match(/translate:/g)?.length ?? 0, "bounded waypoint wandering is visibly positional").toBe(5);
  expect(animation).not.toMatch(/rotate|offset-path|motion-path/);
  expect(css).toMatch(/prefers-reduced-motion[\s\S]*\.fallback-stars i[^{}]*\{\s*animation:\s*none !important;/);
});

test("mission information uses its canonical glass window with unblurred narrative interiors", async ({ page }, testInfo) => {
  desktopOnly(testInfo.project.name);

  for (const viewport of [screenshotViewports.desktop, screenshotViewports.portrait]) {
    await page.setViewportSize(viewport);
    await openSession(page);
    const isLight = await page.locator(".app").evaluate((element) => element.classList.contains("theme-light"));
    if (!isLight) await page.getByRole("button", { name: "Switch to light interface" }).click();
    await page.locator(".brief-card").scrollIntoViewIfNeeded();

    const styles = await page.evaluate(() => {
      const read = (element: Element) => {
        const style = getComputedStyle(element);
        return {
          backgroundColor: style.backgroundColor,
          backgroundImage: style.backgroundImage,
          backdropFilter: style.backdropFilter || style.getPropertyValue("-webkit-backdrop-filter"),
          boxShadow: style.boxShadow,
        };
      };
      const mission = document.querySelector<HTMLElement>(".mission-panel")!;
    const brief = document.querySelector<HTMLElement>(".brief-card")!;
    const narrative = [...brief.querySelectorAll("p, span, .brief-detail")].map(read);
    return { mission: read(mission), narrative };
    });

    expect(styles.mission.backgroundImage).not.toBe("none");
    expect(styles.mission.backdropFilter).toContain("blur");
    expect(styles.mission.boxShadow).toContain("inset");
    expect(styles.narrative.length).toBeGreaterThan(2);
    for (const style of styles.narrative) {
      expect(["transparent", "rgba(0, 0, 0, 0)"]).toContain(style.backgroundColor);
      expect(style.backgroundImage).toBe("none");
      expect(["", "none"]).toContain(style.backdropFilter);
    }
    await page.screenshot({
      path: testInfo.outputPath(`mission-single-glass-${viewport.width}x${viewport.height}.png`),
    });
  }
});

test("global navigation retains its established glass treatment and dense copy starts collapsed", async ({ page }, testInfo) => {
  desktopOnly(testInfo.project.name);
  await openSession(page);
  const glass = await page.locator(".topbar").evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      image: style.backgroundImage,
      color: style.backgroundColor,
      filter: style.backdropFilter || style.getPropertyValue("-webkit-backdrop-filter"),
      shadow: style.boxShadow,
    };
  });
  expect(glass.image).not.toBe("none");
  expect(glass.image).toContain("gradient");
  expect(glass.color).toMatch(/color\(|rgba/);
  expect(glass.filter).toContain("blur");
  expect(glass.filter).toContain("saturate");
  expect(glass.shadow).toContain("inset");
  await expect(page.locator("#mission-brief-details")).toBeHidden();
  await page.locator(".brief-card > button").click();
  await expect(page.locator("#mission-brief-details")).toBeVisible();

  await page.getByRole("button", { name: "FIELD GUIDE" }).click();
  const guide = page.getByRole("dialog", { name: "FIELD GUIDE" });
  await expect(guide.locator("details[open]")).toHaveCount(0);
  const synthesis = guide.getByText("WHOLE-SCENARIO SYNTHESIS", { exact: true });
  await synthesis.click();
  await expect(synthesis.locator("xpath=..")).toHaveAttribute("open", "");
});

test("mission, navigation, HUD, alerts, and dialogs compute the same glass in both themes", async ({ page }, testInfo) => {
  desktopOnly(testInfo.project.name);
  await openSession(page);

  const readMaterial = (selector: string) => page.locator(selector).evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      backgroundImage: style.backgroundImage,
      backgroundColor: style.backgroundColor,
      backdropFilter: style.backdropFilter || style.getPropertyValue("-webkit-backdrop-filter"),
      boxShadow: style.boxShadow,
      panelMix: style.getPropertyValue("--glass-panel-mix").trim(),
      blur: style.getPropertyValue("--glass-blur").trim(),
      saturation: style.getPropertyValue("--glass-saturation").trim(),
    };
  });

  for (const theme of ["dark", "light"] as const) {
    // Each theme gets a fresh document so no in-flight React style update can
    // leave one surface sampled from the previous palette while another has
    // already recomputed. The production contract is equality within a fully
    // committed theme, not intermediate animation frames.
    await page.reload();
    await page.getByRole("button", { name: "PLAY WITHOUT BROWSER SAVING" }).click();
    const current = await page.locator(".app").evaluate((element) => element.classList.contains("theme-light") ? "light" : "dark");
    if (current !== theme) {
      await page.getByRole("button", { name: `Switch to ${theme} interface` }).click();
      await expect(page.locator(".app")).toHaveClass(theme === "light" ? /theme-light/ : /theme-dark/);
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    }
    await expect(page.locator(".app")).toHaveClass(theme === "light" ? /theme-light/ : /theme-dark/);
    const canonical = await readMaterial(".mission-panel");
    expect(canonical.panelMix).toBe("63%");
    expect(canonical.blur).toBe("22px");
    expect(canonical.saturation).toBe("128%");
    for (const selector of [".topbar", ".time-control", ".depth-control"]) {
      expect(await readMaterial(selector), `${theme} ${selector} matches Notional`).toEqual(canonical);
    }

    await page.getByRole("button", { name: "FIELD GUIDE", exact: true }).click();
    await expect(page.locator(".field-guide")).toBeVisible();
    expect(await readMaterial(".field-guide"), `${theme} Field Guide matches Notional`).toEqual(canonical);
    await page.getByRole("button", { name: "Close field guide" }).click();

    await page.getByRole("button", { name: "ACADEMY", exact: true }).click();
    await expect(page.locator(".academy")).toBeVisible();
    expect(await readMaterial(".academy"), `${theme} Academy matches Notional`).toEqual(canonical);
    const nestedFilters = await page.locator(".academy").evaluate((surface) => [...surface.querySelectorAll<HTMLElement>(".academy-header, .academy-independence, .path-tabs, .module-rail, .lesson")]
      .map((node) => getComputedStyle(node).backdropFilter || getComputedStyle(node).getPropertyValue("-webkit-backdrop-filter")));
    expect(nestedFilters.every((filter) => !filter || filter === "none"), `${theme} Academy does not stack backdrop filters`).toBe(true);
    await page.getByRole("button", { name: "Close academy" }).click();
  }
});

test("Academy and Field Guide use one identical scene scrim in both themes", async ({ page }, testInfo) => {
  desktopOnly(testInfo.project.name);
  await openSession(page);

  const readOverlay = (selector: string) => page.locator(selector).evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      backgroundImage: style.backgroundImage,
      backgroundColor: style.backgroundColor,
      backdropFilter: style.backdropFilter || style.getPropertyValue("-webkit-backdrop-filter"),
      scrimMix: style.getPropertyValue("--overlay-scrim-mix").trim(),
    };
  });

  for (const theme of ["dark", "light"] as const) {
    const current = await page.locator(".app").evaluate((element) => element.classList.contains("theme-light") ? "light" : "dark");
    if (current !== theme) await page.getByRole("button", { name: `Switch to ${theme} interface` }).click();

    await page.getByRole("button", { name: "FIELD GUIDE", exact: true }).click();
    const guideOverlay = await readOverlay(".modal-backdrop");
    await page.getByRole("button", { name: "Close field guide" }).click();

    await page.getByRole("button", { name: "ACADEMY", exact: true }).click();
    const academyOverlay = await readOverlay(".academy-backdrop");
    expect(academyOverlay, `${theme} Academy and Field Guide quiet the scene identically`).toEqual(guideOverlay);
    expect(academyOverlay.scrimMix).toBe("42%");
    await page.getByRole("button", { name: "Close academy" }).click();
  }
});

test("compact Academy and Field Guide remain one-column, non-overlapping glass documents", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Compact learning/reference geometry");
  test.setTimeout(120_000);
  await openSession(page);

  for (const theme of ["dark", "light"] as const) {
    for (const viewport of [{ width: 320, height: 800 }, { width: 573, height: 814 }]) {
      await page.setViewportSize(viewport);
      const current = await page.locator(".app").evaluate((element) => element.classList.contains("theme-light") ? "light" : "dark");
      if (current !== theme) await page.getByRole("button", { name: `Switch to ${theme} interface` }).click();

      await page.locator(".global-tools-menu > summary").click();
      await page.locator(".global-tools-menu").getByRole("button", { name: "ACADEMY", exact: true }).click();
      const academy = page.locator(".academy");
      const academyGeometry = await academy.evaluate((surface) => {
        const rect = (selector: string) => {
          const box = surface.querySelector<HTMLElement>(selector)!.getBoundingClientRect();
          return { top: box.top, right: box.right, bottom: box.bottom, left: box.left, width: box.width, height: box.height };
        };
        const scroll = surface.querySelector<HTMLElement>(".academy-scroll-surface")!;
        const owners = [...surface.querySelectorAll<HTMLElement>(".academy-scroll-surface, .academy-course, .module-list, .lesson, .academy-reference")]
          .filter((element) => ["auto", "scroll"].includes(getComputedStyle(element).overflowY) && element.scrollHeight > element.clientHeight + 1)
          .map((element) => element.className);
        return {
          header: rect(".academy-header"),
          notice: rect(".academy-independence"),
          paths: rect(".path-tabs"),
          modules: rect(".module-list"),
          lesson: rect(".lesson"),
          overflowX: scroll.scrollWidth - scroll.clientWidth,
          owners,
        };
      });
      expect(academyGeometry.header.bottom).toBeLessThanOrEqual(academyGeometry.notice.top + 1);
      expect(academyGeometry.notice.bottom).toBeLessThanOrEqual(academyGeometry.paths.top + 1);
      expect(academyGeometry.paths.bottom).toBeLessThanOrEqual(academyGeometry.modules.top + 1);
      expect(academyGeometry.modules.bottom).toBeLessThanOrEqual(academyGeometry.lesson.top + 1);
      expect(academyGeometry.overflowX).toBeLessThanOrEqual(1);
      expect(academyGeometry.owners).toEqual(["academy-scroll-surface"]);
      await testInfo.attach(`${theme}-${viewport.width}x${viewport.height}-academy.png`, { body: await academy.screenshot(), contentType: "image/png" });
      await page.getByRole("button", { name: "Close academy" }).click();

      await page.locator(".global-tools-menu > summary").click();
      await page.locator(".global-tools-menu").getByRole("button", { name: "FIELD GUIDE", exact: true }).click();
      const guide = page.locator(".field-guide");
      const guideGeometry = await guide.evaluate((surface) => ({
        overflowX: surface.scrollWidth - surface.clientWidth,
        nestedRoundedPanes: [...surface.querySelectorAll<HTMLElement>(".guide-grid > details, .guide-armaments, .guide-rule, .guide-disclaimer")]
          .filter((node) => Number.parseFloat(getComputedStyle(node).borderRadius) > 0 || (getComputedStyle(node).backgroundColor !== "rgba(0, 0, 0, 0)" && getComputedStyle(node).backgroundColor !== "transparent")).length,
      }));
      expect(guideGeometry.overflowX).toBeLessThanOrEqual(1);
      expect(guideGeometry.nestedRoundedPanes).toBe(0);
      await testInfo.attach(`${theme}-${viewport.width}x${viewport.height}-field-guide.png`, { body: await guide.screenshot(), contentType: "image/png" });
      await page.getByRole("button", { name: "Close field guide" }).click();

      await page.locator(".global-tools-menu > summary").click();
      await page.locator(".global-tools-menu").getByRole("button", { name: "SOUND SETTINGS", exact: true }).click();
      await expect(page.locator(".global-tools-menu")).not.toHaveAttribute("open", "");
      const soundSettings = page.getByRole("dialog", { name: "Sound settings" });
      await expect(soundSettings).toBeVisible();
      await expect(soundSettings.getByRole("slider")).toHaveCount(3);
      for (const control of await soundSettings.locator("button, input").all()) {
        const box = await control.boundingBox();
        if (box) expect(Math.max(box.width, box.height)).toBeGreaterThanOrEqual(44);
      }
      await soundSettings.getByRole("button", { name: "Close audio controls" }).click();
      await expect(soundSettings).toBeHidden();
      await expect(page.locator(".global-tools-menu > summary")).toBeFocused();
    }
  }
});

test("compact command navigation closes atomically and reveals Visualization", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Compact command navigation contract");
  test.setTimeout(180_000);

  for (const theme of ["dark", "light"] as const) {
    for (const viewport of [{ width: 320, height: 800 }, { width: 567, height: 760 }, { width: 760, height: 900 }]) {
      await page.setViewportSize(viewport);
      await openSession(page);
      const current = await page.locator(".app").evaluate((element) => element.classList.contains("theme-light") ? "light" : "dark");
      if (current !== theme) await page.getByRole("button", { name: `Switch to ${theme} interface` }).click();
      await beginCompactCommand(page);
      await expect(page.locator(".workspace")).toHaveClass(/phase-command/);
      await expect(page.locator(".workspace")).toHaveClass(/mobile-view-command/);
      await expect(page.locator(".kriegsspiel-panel")).toBeVisible();

      const disclosure = page.locator(".mobile-disclosure");
      await disclosure.locator(":scope > summary").click();
      await expect(disclosure).toHaveAttribute("open", "");
      const sheet = disclosure.locator(":scope > div");
      const geometry = await sheet.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          left: rect.left,
          right: rect.right,
          width: rect.width,
          height: rect.height,
          viewportWidth: innerWidth,
          viewportHeight: innerHeight,
          overflowY: style.overflowY,
          backdropFilter: style.backdropFilter || style.getPropertyValue("-webkit-backdrop-filter"),
        };
      });
      expect(Math.abs(geometry.left)).toBeLessThanOrEqual(1);
      expect(Math.abs(geometry.right - geometry.viewportWidth)).toBeLessThanOrEqual(1);
      expect(Math.abs(geometry.width - viewport.width)).toBeLessThanOrEqual(1);
      expect(geometry.height).toBeLessThanOrEqual(Math.min(360, viewport.height - 132) + 1);
      expect(geometry.overflowY).toBe("auto");
      expect(geometry.backdropFilter).toContain("blur(22px)");
      const sharedGlass = await page.locator(".topbar").evaluate((reference, panel) => {
        const referenceStyle = getComputedStyle(reference);
        const panelStyle = getComputedStyle(panel as Element);
        const material = (style: CSSStyleDeclaration) => ({
          backgroundColor: style.backgroundColor,
          backgroundImage: style.backgroundImage,
          boxShadow: style.boxShadow,
          backdropFilter: style.backdropFilter || style.getPropertyValue("-webkit-backdrop-filter"),
        });
        return { reference: material(referenceStyle), panel: material(panelStyle) };
      }, await sheet.elementHandle());
      expect(sharedGlass.panel).toEqual(sharedGlass.reference);
      for (const button of await sheet.getByRole("button").all()) {
        const presentation = await button.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return { height: rect.height, fontSize: parseFloat(style.fontSize), backgroundColor: style.backgroundColor };
        });
        expect(presentation.height).toBeGreaterThanOrEqual(58);
        expect(presentation.fontSize).toBeGreaterThanOrEqual(12);
        expect(presentation.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
      }
      for (const label of ["ACADEMY", "SAVE / LOAD", "FIELD GUIDE", "CREDITS", "SOUND SETTINGS"]) {
        const tool = sheet.getByRole("button", { name: label, exact: true });
        await expect(tool).toHaveCount(1);
        await tool.scrollIntoViewIfNeeded();
        await expect(tool).toBeVisible();
      }

      await page.keyboard.press("Escape");
      await expect(disclosure).not.toHaveAttribute("open", "");
      await expect(disclosure.locator(":scope > summary")).toBeFocused();
      await disclosure.locator(":scope > summary").click();
      await expect(disclosure).toHaveAttribute("open", "");

      const scrim = disclosure.getByRole("button", { name: "Close game navigation" });
      const scrimGeometry = await scrim.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const workspace = document.querySelector<HTMLElement>(".workspace")!.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          workspaceTop: workspace.top,
          workspaceBottom: workspace.bottom,
          pointerEvents: style.pointerEvents,
        };
      });
      expect(scrimGeometry.left).toBe(0);
      expect(scrimGeometry.top).toBeLessThanOrEqual(scrimGeometry.workspaceTop);
      expect(scrimGeometry.right).toBe(viewport.width);
      expect(scrimGeometry.bottom).toBeGreaterThanOrEqual(viewport.height - 1);
      expect(scrimGeometry.workspaceTop).toBeLessThan(scrimGeometry.bottom);
      expect(scrimGeometry.workspaceBottom).toBeGreaterThan(scrimGeometry.workspaceTop);
      expect(scrimGeometry.pointerEvents).not.toBe("none");
      expect(await page.evaluate(() => document.elementFromPoint(innerWidth - 2, innerHeight - 2)?.getAttribute("aria-label"))).toBe("Close game navigation");
      await scrim.click({ position: { x: viewport.width - 2, y: viewport.height - 2 } });
      await expect(disclosure).not.toHaveAttribute("open", "");
      await expect(disclosure.locator(":scope > summary")).toBeFocused();

      await disclosure.locator(":scope > summary").click();
      await expect(disclosure).toHaveAttribute("open", "");

      await sheet.getByRole("button", { name: "VISUALIZATION", exact: true }).click();
      await expect(disclosure).not.toHaveAttribute("open", "");
      await expect(sheet).toBeHidden();
      await expect(disclosure.locator(":scope > summary")).toHaveText("Visualization");
      await expect(page.locator(".workspace")).toHaveClass(/mobile-view-visualization/);
      await expect(page.locator(".workspace")).not.toHaveClass(/mobile-view-command/);
      await expect(page.locator(".mission-panel, .force-panel")).toBeHidden();
      await expect(page.locator(".tactical-panel")).toBeVisible();
      await expect(page.locator(".battlefield-canvas")).toBeVisible();
      const closedHitTest = await disclosure.evaluate((element) => {
        const panel = element.querySelector<HTMLElement>(":scope > div")!;
        const rect = panel.getBoundingClientRect();
        return { display: getComputedStyle(panel).display, width: rect.width, height: rect.height };
      });
      expect(closedHitTest).toEqual({ display: "none", width: 0, height: 0 });
    }
  }
});

test("compact drawer opens Academy and Field Guide without relying on desktop navigation", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Compact global-tool destinations");
  test.setTimeout(120_000);

  for (const theme of ["dark", "light"] as const) {
    for (const viewport of [{ width: 320, height: 800 }, { width: 567, height: 760 }]) {
      await page.setViewportSize(viewport);
      await openSession(page);
      const current = await page.locator(".app").evaluate((element) => element.classList.contains("theme-light") ? "light" : "dark");
      if (current !== theme) await page.getByRole("button", { name: `Switch to ${theme} interface` }).click();
      await beginCompactCommand(page);
      const disclosure = page.locator(".mobile-disclosure");

      await disclosure.locator(":scope > summary").click();
      await disclosure.locator(":scope > div").getByRole("button", { name: "ACADEMY", exact: true }).click();
      await expect(page.getByRole("dialog", { name: "THE ACADEMY" })).toBeVisible();
      await page.getByRole("button", { name: "Close academy" }).click();
      await expect(page.getByRole("dialog", { name: "THE ACADEMY" })).toBeHidden();

      await disclosure.locator(":scope > summary").click();
      await disclosure.locator(":scope > div").getByRole("button", { name: "FIELD GUIDE", exact: true }).click();
      await expect(page.getByRole("dialog", { name: "FIELD GUIDE" })).toBeVisible();
      await page.getByRole("button", { name: "Close field guide" }).click();
      await expect(page.getByRole("dialog", { name: "FIELD GUIDE" })).toBeHidden();
    }
  }
});

test("desktop workspace is viewport-bounded with a substantial clipped tactical plot", async ({ page }, testInfo) => {
  desktopOnly(testInfo.project.name);
  await openSession(page);

  const metrics = await page.evaluate(() => {
    const box = (selector: string) => {
      const rect = document.querySelector<HTMLElement>(selector)!.getBoundingClientRect();
      return { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left, width: rect.width, height: rect.height };
    };
    const workspace = box(".workspace");
    const tactical = box(".tactical-panel");
    const battlefield = box(".battlefield-canvas");
    const scene = box(".fallback-scene");
    const sky = box(".sky-readout");
    const workspaceStyle = getComputedStyle(document.querySelector<HTMLElement>(".workspace")!);
    const tacticalStyle = getComputedStyle(document.querySelector<HTMLElement>(".tactical-panel")!);
    return {
      viewport: { width: innerWidth, height: innerHeight },
      documentScrollRange: document.documentElement.scrollHeight - document.documentElement.clientHeight,
      bodyViewportOverflow: document.body.scrollHeight - innerHeight,
      workspace,
      tactical,
      battlefield,
      scene,
      sky,
      workspaceOverflow: workspaceStyle.overflow,
      tacticalOverflow: tacticalStyle.overflow,
    };
  });
  await testInfo.attach("desktop-layout-metrics.json", {
    body: JSON.stringify(metrics, null, 2),
    contentType: "application/json",
  });

  expect(metrics.documentScrollRange, "the application shell must not create document-level vertical travel").toBeLessThanOrEqual(1);
  expect(metrics.bodyViewportOverflow, "the body must remain viewport-bounded after the privacy choice").toBeLessThanOrEqual(1);
  expect(metrics.workspace.height).toBeGreaterThanOrEqual(metrics.viewport.height * 0.68);
  expect(metrics.workspace.bottom).toBeLessThanOrEqual(metrics.viewport.height + 1);
  expect(metrics.workspaceOverflow).toBe("hidden");
  expect(metrics.tacticalOverflow).toBe("hidden");
  expect(metrics.tactical.height).toBeGreaterThanOrEqual(metrics.viewport.height * 0.68);
  expect(metrics.battlefield.height).toBeGreaterThanOrEqual(metrics.viewport.height * 0.68);
  expect(metrics.battlefield).toEqual(metrics.tactical);
  expect(metrics.scene).toEqual(metrics.battlefield);
  expect(metrics.sky.top).toBeGreaterThanOrEqual(metrics.tactical.top);
  expect(metrics.sky.right).toBeLessThanOrEqual(metrics.tactical.right + 1);
  expect(metrics.sky.bottom).toBeLessThanOrEqual(metrics.tactical.bottom + 1);
});

test("desktop tactical information stays beside the current strategy panel", async ({ page }, testInfo) => {
  desktopOnly(testInfo.project.name);
  await openSession(page);

  const metrics = await page.evaluate(() => {
    const box = (selector: string) => {
      const rect = document.querySelector<HTMLElement>(selector)!.getBoundingClientRect();
      return { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left, width: rect.width, height: rect.height };
    };
    return {
      mission: box(".mission-panel"),
      tactical: box(".tactical-panel"),
      plotData: box(".plot-data-readout"),
      timeControl: box(".time-control"),
      depthControl: box(".depth-control"),
      sky: box(".sky-readout"),
      legend: box(".legend"),
    };
  });
  await testInfo.attach("desktop-hud-safe-corridor.json", {
    body: JSON.stringify(metrics, null, 2),
    contentType: "application/json",
  });

  const leftEdge = metrics.mission.right;
  const rightEdge = metrics.tactical.right - 12;
  for (const [name, item] of Object.entries({
    plotData: metrics.plotData,
    timeControl: metrics.timeControl,
    depthControl: metrics.depthControl,
    sky: metrics.sky,
    legend: metrics.legend,
  })) {
    expect(item.left, `${name} must not be covered by the mission panel`).toBeGreaterThanOrEqual(leftEdge);
    expect(item.right, `${name} must remain inside the current-phase plot lane`).toBeLessThanOrEqual(rightEdge);
  }

  expect(metrics.depthControl.top, "the view selector must follow the compact plot-data toggle").toBeGreaterThanOrEqual(metrics.plotData.bottom + 4);
  await expect(page.locator(".plot-instruction, .view-telemetry, .coordinate")).toHaveCount(0);
  await expect(page.locator(".plot-data-details")).toBeHidden();
  await expect(page.locator(".legend-items")).toBeHidden();
  const glassHierarchy = await page.evaluate(() => {
    const filter = (selector: string) => {
      const style = getComputedStyle(document.querySelector<HTMLElement>(selector)!);
      return style.backdropFilter || style.getPropertyValue("-webkit-backdrop-filter");
    };
    return { rail: filter(".plot-topline"), time: filter(".time-control"), popup: filter(".plot-data-readout > summary") };
  });
  expect(["", "none"]).toContain(glassHierarchy.rail);
  expect(glassHierarchy.time).not.toBe("none");
  expect(glassHierarchy.popup).not.toBe("none");
});

test("desktop renders only the current planning panel and advances explicitly to force design", async ({ page }, testInfo) => {
  desktopOnly(testInfo.project.name);
  await openSession(page);

  const metrics = await page.evaluate(() => {
    const workspace = document.querySelector<HTMLElement>(".workspace")!;
    const mission = document.querySelector<HTMLElement>(".mission-panel")!;
    const tactical = document.querySelector<HTMLElement>(".tactical-panel")!;
    const workspaceRect = workspace.getBoundingClientRect();
    const missionRect = mission.getBoundingClientRect();
    const tacticalRect = tactical.getBoundingClientRect();
    const missionStyle = getComputedStyle(mission);
    const tacticalStyle = getComputedStyle(tactical);
    const beforeDocumentY = scrollY;
    mission.scrollTop = 140;
    const missionAfter = mission.scrollTop;
    return {
      gridColumns: getComputedStyle(workspace).gridTemplateColumns.split(/\s+/).filter(Boolean),
      workspace: { left: workspaceRect.left, right: workspaceRect.right, height: workspaceRect.height },
      mission: {
        left: missionRect.left,
        right: missionRect.right,
        width: missionRect.width,
        height: missionRect.height,
        clientHeight: mission.clientHeight,
        scrollHeight: mission.scrollHeight,
        overflowY: missionStyle.overflowY,
        backdropFilter: missionStyle.backdropFilter,
        zIndex: Number(missionStyle.zIndex),
        scrollTop: missionAfter,
      },
      tactical: {
        left: tacticalRect.left,
        right: tacticalRect.right,
        width: tacticalRect.width,
        zIndex: Number(tacticalStyle.zIndex),
      },
      forcePanelCount: document.querySelectorAll(".force-panel").length,
      documentYBefore: beforeDocumentY,
      documentYAfter: scrollY,
    };
  });
  await testInfo.attach("desktop-glass-panel-metrics.json", {
    body: JSON.stringify(metrics, null, 2),
    contentType: "application/json",
  });

  expect(metrics.gridColumns).toHaveLength(3);
  expect(metrics.tactical.left).toBeCloseTo(metrics.workspace.left, 0);
  expect(metrics.tactical.right).toBeCloseTo(metrics.workspace.right, 0);
  expect(metrics.mission.width).toBeGreaterThanOrEqual(260);
  expect(metrics.mission.zIndex).toBeGreaterThan(metrics.tactical.zIndex);
  expect(metrics.mission.backdropFilter).toContain("blur");
  expect(metrics.mission.overflowY).toMatch(/auto|scroll/);
  expect(metrics.mission.scrollHeight).toBeGreaterThan(metrics.mission.clientHeight);
  expect(metrics.mission.scrollTop).toBeGreaterThan(0);
  expect(metrics.forcePanelCount).toBe(0);
  expect(metrics.documentYAfter).toBe(metrics.documentYBefore);

  await completeStrategicChoices(page);
  await page.getByRole("button", { name: "CONTINUE TO FORCE DESIGN" }).click();
  await expect(page.locator(".mission-panel")).toHaveCount(0);
  const force = page.locator(".force-panel");
  await expect(force).toBeVisible();
  await expect(page.locator(".warfare-grid, .decision-steps")).toHaveCount(0);
  await force.evaluate((element) => { element.scrollTop = 180; });
  expect(await force.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
});

function stepByText(steps: Locator, text: RegExp) {
  return steps.filter({ hasText: text });
}

async function expectSingleExpandedStep(page: Page, activeLabel: RegExp) {
  const steps = page.locator(".decision-steps > li");
  await expect(steps).toHaveCount(4);
  const active = stepByText(steps, activeLabel);
  await expect(active).toHaveAttribute("aria-current", "step");
  await expect(active.locator("select:enabled")).toHaveCount(1);
  await expect(steps.locator("select:enabled")).toHaveCount(1);
  return { steps, active };
}

test("strategic progressive disclosure keeps one expanded active step and compact completed or locked steps", async ({ page }, testInfo) => {
  desktopOnly(testInfo.project.name);
  await openSession(page);
  await page.locator(".warfare-grid button").first().click();

  let flow = await expectSingleExpandedStep(page, /1 · MISSION OBJECTIVE/);
  for (const label of [/2 · PRIMARY THEORY/, /3 · COMPLEMENT OR CHALLENGE/, /4 · CONTROLLING GUARDRAIL/]) {
    const locked = stepByText(flow.steps, label);
    await expect(locked.locator("button:not([disabled]), select:not([disabled]), input:not([disabled])")).toHaveCount(0);
  }
  await flow.active.locator("select").selectOption("access");

  flow = await expectSingleExpandedStep(page, /2 · PRIMARY THEORY/);
  const objective = stepByText(flow.steps, /1 · MISSION OBJECTIVE/);
  const partner = stepByText(flow.steps, /3 · COMPLEMENT OR CHALLENGE/);
  const guardrail = stepByText(flow.steps, /4 · CONTROLLING GUARDRAIL/);
  await expect(objective).toContainText("Preserve reliable access");
  await expect(partner.locator("button:not([disabled]), select:not([disabled]), input:not([disabled])")).toHaveCount(0);
  await expect(guardrail.locator("button:not([disabled]), select:not([disabled]), input:not([disabled])")).toHaveCount(0);

  const firstHeights = await Promise.all([
    flow.active.evaluate((element) => element.getBoundingClientRect().height),
    objective.evaluate((element) => element.getBoundingClientRect().height),
    partner.evaluate((element) => element.getBoundingClientRect().height),
    guardrail.evaluate((element) => element.getBoundingClientRect().height),
  ]);
  const [activeHeight, ...compactHeights] = firstHeights;
  expect(activeHeight).toBeGreaterThan(Math.max(...compactHeights) + 6);

  await flow.active.locator("select").selectOption("sun-tzu");
  flow = await expectSingleExpandedStep(page, /3 · COMPLEMENT OR CHALLENGE/);
  const completedObjective = stepByText(flow.steps, /1 · MISSION OBJECTIVE/);
  const completedPrimary = stepByText(flow.steps, /2 · PRIMARY THEORY/);
  const lockedGuardrail = stepByText(flow.steps, /4 · CONTROLLING GUARDRAIL/);
  const secondHeights = await Promise.all([
    flow.active.evaluate((element) => element.getBoundingClientRect().height),
    completedObjective.evaluate((element) => element.getBoundingClientRect().height),
    completedPrimary.evaluate((element) => element.getBoundingClientRect().height),
    lockedGuardrail.evaluate((element) => element.getBoundingClientRect().height),
  ]);
  expect(secondHeights[0]).toBeGreaterThan(Math.max(...secondHeights.slice(1)) + 6);
});

async function chooseMobileView(page: Page, name: string) {
  await page.locator(".mobile-disclosure summary").click();
  await page.getByRole("button", { name, exact: true }).click();
}

async function expectOnlyMobileRegion(page: Page, expectedSelector: string) {
  const selectors = [".mission-overview", ".decision-workflow", ".force-panel", ".tactical-panel"];
  const visibility = await page.evaluate((items) => Object.fromEntries(items.map((selector) => {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) return [selector, { visible: false, visibleControls: 0 }];
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const visible = style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    const visibleControls = [...element.querySelectorAll<HTMLElement>("button, select, input, textarea, a[href], [tabindex]")]
      .filter((control) => {
        const controlStyle = getComputedStyle(control);
        const controlRect = control.getBoundingClientRect();
        return controlStyle.display !== "none" && controlStyle.visibility !== "hidden" && controlRect.width > 0 && controlRect.height > 0;
      }).length;
    return [selector, { visible, visibleControls }];
  })), selectors) as Record<string, { visible: boolean; visibleControls: number }>;
  expect(Object.entries(visibility).filter(([, state]) => state.visible).map(([selector]) => selector)).toEqual([expectedSelector]);
  for (const [selector, state] of Object.entries(visibility)) {
    if (selector !== expectedSelector) expect(state.visibleControls, `${selector} must not remain operable behind the chosen mobile view`).toBe(0);
  }
}

type LayoutRect = {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
};

const screenshotViewports = {
  // The supplied macOS captures are 2× Retina images. Layout is therefore
  // resolved at these CSS-pixel sizes: 2048×1090 and 1134×1606 physical px.
  desktop: { width: 1024, height: 545 },
  portrait: { width: 567, height: 803 },
} as const;

function intersectionArea(left: LayoutRect, right: LayoutRect) {
  return Math.max(0, Math.min(left.right, right.right) - Math.max(left.left, right.left))
    * Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top));
}

function expectNoIntersection(left: LayoutRect, right: LayoutRect, label: string) {
  expect(intersectionArea(left, right), `${label} must not cover another information surface`).toBeLessThanOrEqual(1);
}

function expectContained(child: LayoutRect, parent: LayoutRect, label: string) {
  expect(child.left, `${label} left edge`).toBeGreaterThanOrEqual(parent.left - 1);
  expect(child.top, `${label} top edge`).toBeGreaterThanOrEqual(parent.top - 1);
  expect(child.right, `${label} right edge`).toBeLessThanOrEqual(parent.right + 1);
  expect(child.bottom, `${label} bottom edge`).toBeLessThanOrEqual(parent.bottom + 1);
  expect(child.width, `${label} width`).toBeGreaterThan(0);
  expect(child.height, `${label} height`).toBeGreaterThan(0);
}

async function layoutRects(page: Page, selectors: readonly string[]) {
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate((items) => {
    const rects: Record<string, LayoutRect> = {};
    for (const selector of items) {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`Missing layout target: ${selector}`);
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (style.display === "none" || style.visibility === "hidden" || rect.width <= 0 || rect.height <= 0) {
        throw new Error(`Layout target is not visible: ${selector}`);
      }
      rects[selector] = {
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      };
    }
    return rects;
  }, [...selectors]);
}

async function expectViewportBoundDocument(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewportWidth: innerWidth,
    viewportHeight: innerHeight,
    documentWidth: document.documentElement.scrollWidth,
    documentHeight: document.documentElement.scrollHeight,
    bodyWidth: document.body.scrollWidth,
    bodyHeight: document.body.scrollHeight,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
  expect(dimensions.bodyWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
  expect(dimensions.documentHeight).toBeLessThanOrEqual(dimensions.viewportHeight + 1);
  expect(dimensions.bodyHeight).toBeLessThanOrEqual(dimensions.viewportHeight + 1);
}

type GlassSurfaceMetrics = {
  supported: boolean;
  backgroundAlpha: number;
  backgroundImage: string;
  gradientCount: number;
  backdropFilter: string;
  boxShadow: string;
  borderStyle: string;
  boxCount: number;
};

async function glassSurfaceMetrics(surface: Locator): Promise<GlassSurfaceMetrics> {
  return surface.evaluate((element) => {
    const style = getComputedStyle(element);
    const alphaMatch = style.backgroundColor.match(/[\d.]+(?=\))/g);
    const backgroundImage = style.backgroundImage;
    return {
      supported: CSS.supports("backdrop-filter", "blur(1px)") || CSS.supports("-webkit-backdrop-filter", "blur(1px)"),
      backgroundAlpha: alphaMatch ? Number(alphaMatch.at(-1)) : 1,
      backgroundImage,
      gradientCount: backgroundImage.match(/linear-gradient/g)?.length ?? 0,
      backdropFilter: style.backdropFilter || style.getPropertyValue("-webkit-backdrop-filter"),
      boxShadow: style.boxShadow,
      borderStyle: style.borderStyle,
      boxCount: element.getClientRects().length,
    };
  });
}

async function glassPixelSignature(page: Page, surface: Locator) {
  const capture = await surface.screenshot();
  return page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true })!;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const patchSize = Math.max(3, Math.min(9, Math.floor(Math.min(canvas.width, canvas.height) / 5)));
    const meanPatch = (startX: number, startY: number) => {
      const sum = [0, 0, 0];
      let count = 0;
      for (let y = startY; y < Math.min(canvas.height - 1, startY + patchSize); y += 1) {
        for (let x = startX; x < Math.min(canvas.width - 1, startX + patchSize); x += 1) {
          const index = (y * canvas.width + x) * 4;
          sum[0] += pixels[index];
          sum[1] += pixels[index + 1];
          sum[2] += pixels[index + 2];
          count += 1;
        }
      }
      return sum.map((channel) => channel / Math.max(1, count));
    };
    const topLeft = meanPatch(2, 2);
    const bottomRight = meanPatch(Math.max(2, canvas.width - patchSize - 2), Math.max(2, canvas.height - patchSize - 2));
    const directionalDelta = Math.max(...topLeft.map((channel, index) => Math.abs(channel - bottomRight[index])));
    const luminances: number[] = [];
    for (let y = 2; y < canvas.height - 2; y += 3) {
      for (let x = 2; x < canvas.width - 2; x += 3) {
        const index = (y * canvas.width + x) * 4;
        luminances.push(.2126 * pixels[index] + .7152 * pixels[index + 1] + .0722 * pixels[index + 2]);
      }
    }
    const mean = luminances.reduce((sum, value) => sum + value, 0) / Math.max(1, luminances.length);
    const variance = luminances.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, luminances.length);
    return { width: canvas.width, height: canvas.height, topLeft, bottomRight, directionalDelta, variance };
  }, capture.toString("base64"));
}

function expectDirectionalGlass(metrics: GlassSurfaceMetrics, state: string) {
  expect(metrics.boxCount, `${state} generates one occupied box`).toBe(1);
  expect(metrics.borderStyle, `${state} retains a crisp boundary`).toBe("solid");
  if (!metrics.supported) return;
  expect(metrics.backgroundAlpha, `${state} retains readable tint`).toBeGreaterThan(.5);
  expect(metrics.backgroundAlpha, `${state} remains translucent`).toBeLessThan(.82);
  expect(metrics.gradientCount, `${state} has a directional highlight gradient`).toBeGreaterThanOrEqual(1);
  expect(metrics.backdropFilter, `${state} filters only its occupied bounds`).toContain("blur");
  expect(metrics.backdropFilter, `${state} preserves glass color depth`).toContain("saturate");
  expect(metrics.boxShadow, `${state} has an inset glass rim`).toContain("inset");
}

test("mobile workspace renders only the chosen view instead of stacking every panel", async ({ page }, testInfo) => {
  mobileOnly(testInfo.project.name);
  await openSession(page);

  await expectOnlyMobileRegion(page, ".mission-overview");
  await chooseMobileView(page, "DECISIONS");
  await expectOnlyMobileRegion(page, ".decision-workflow");
  await completeStrategicChoices(page);
  await page.getByRole("button", { name: "CONTINUE TO FORCE DESIGN" }).click();
  await expectOnlyMobileRegion(page, ".force-panel");
  await chooseMobileView(page, "VISUALIZATION");
  await expectOnlyMobileRegion(page, ".tactical-panel");
  await chooseMobileView(page, "REVISE MISSION & DECISIONS");
  await expectOnlyMobileRegion(page, ".decision-workflow");
  await chooseMobileView(page, "MISSION BRIEF");
  await expectOnlyMobileRegion(page, ".mission-overview");
});

test("320 pixel visualization keeps the compact information rail and plot controls distinct", async ({ page }, testInfo) => {
  mobileOnly(testInfo.project.name);
  await openSession(page);
  await chooseMobileView(page, "VISUALIZATION");
  await page.getByRole("button", { name: "stars", exact: true }).click();

  const selectors = [
    ".tactical-panel",
    ".time-control",
    ".plot-data-readout",
    ".depth-control",
    ".environment-readout",
    ".sky-readout",
    ".legend",
  ] as const;
  const rects = await layoutRects(page, selectors);
  const tactical = rects[".tactical-panel"];

  for (const selector of selectors.slice(1)) expectContained(rects[selector], tactical, selector);
  expect(rects[".plot-data-readout"].top - rects[".time-control"].bottom).toBeGreaterThanOrEqual(8);
  expect(tactical.bottom - rects[".depth-control"].bottom).toBeLessThanOrEqual(13);
  expect(rects[".depth-control"].top - rects[".plot-data-readout"].bottom).toBeGreaterThanOrEqual(24);
  for (const selector of [".sky-readout", ".environment-readout", ".legend"] as const) {
    expect(Math.abs(rects[selector].top - rects[".plot-data-readout"].top), `${selector} aligns with the compact HUD rail`).toBeLessThanOrEqual(1);
  }
  expectNoIntersection(rects[".plot-data-readout"], rects[".sky-readout"], "plot and celestial disclosures");
  expectNoIntersection(rects[".sky-readout"], rects[".environment-readout"], "celestial and environment disclosures");
  expectNoIntersection(rects[".environment-readout"], rects[".legend"], "environment and contact disclosures");
  expectNoIntersection(rects[".depth-control"], rects[".environment-readout"], "view selector and environment readout");
  await expectViewportBoundDocument(page);
});

test("normal play chrome omits persistent privacy and session disclaimers", async ({ page }, testInfo) => {
  desktopOnly(testInfo.project.name);

  for (const viewport of [screenshotViewports.desktop, screenshotViewports.portrait]) {
    await page.setViewportSize(viewport);
    await openSession(page);
    await expect(page.locator(".independence-banner, .save-indicator")).toHaveCount(0);
    const chromeText = await page.locator(".game-shell").innerText();
    expect(chromeText).not.toMatch(/no trackers|browser saving (?:on|off)|session-only play|no operational use/i);
    await expectViewportBoundDocument(page);
  }
});

test("2048 by 1090 Retina-equivalent desktop keeps tactical information in the unobscured center", async ({ page }, testInfo) => {
  desktopOnly(testInfo.project.name);
  await page.setViewportSize(screenshotViewports.desktop);
  await openSession(page);

  const selectors = [
    ".tactical-panel",
    ".mission-panel",
    ".plot-data-readout",
    ".time-control",
    ".depth-control",
    ".sky-readout",
    ".legend",
  ] as const;
  const rects = await layoutRects(page, selectors);
  const tactical = rects[".tactical-panel"];
  const center: LayoutRect = {
    top: tactical.top,
    right: tactical.right,
    bottom: tactical.bottom,
    left: rects[".mission-panel"].right,
    width: tactical.right - rects[".mission-panel"].right,
    height: tactical.height,
  };

  for (const selector of selectors.slice(2)) {
    expectContained(rects[selector], center, selector);
  }

  expectNoIntersection(rects[".plot-data-readout"], rects[".time-control"], "plot data and time selector");
  expectNoIntersection(rects[".depth-control"], rects[".sky-readout"], "view selector and celestial readout");
  expectNoIntersection(rects[".depth-control"], rects[".legend"], "view selector and plot legend");
  expectNoIntersection(rects[".sky-readout"], rects[".legend"], "celestial and contact disclosures");

  const viewButtons = await page.locator(".depth-control button").evaluateAll((buttons) => buttons.map((button) => {
    const rect = button.getBoundingClientRect();
    return { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left, width: rect.width, height: rect.height };
  }));
  expect(viewButtons).toHaveLength(5);
  for (const [index, button] of viewButtons.entries()) expectContained(button, rects[".depth-control"], `view selector option ${index + 1}`);
  await expectViewportBoundDocument(page);
});

test("1134 by 1606 Retina-equivalent portrait keeps visualization controls and readouts distinct", async ({ page }, testInfo) => {
  desktopOnly(testInfo.project.name);
  await page.setViewportSize(screenshotViewports.portrait);
  await openSession(page);
  await chooseMobileView(page, "VISUALIZATION");
  await expectOnlyMobileRegion(page, ".tactical-panel");
  await page.getByRole("button", { name: "stars", exact: true }).click();

  const selectors = [
    ".tactical-panel",
    ".time-control",
    ".plot-data-readout",
    ".depth-control",
    ".environment-readout",
    ".sky-readout",
    ".legend",
  ] as const;
  const rects = await layoutRects(page, selectors);
  const tactical = rects[".tactical-panel"];

  for (const selector of selectors.slice(1)) expectContained(rects[selector], tactical, selector);
  expectNoIntersection(rects[".plot-data-readout"], rects[".time-control"], "plot data and time selector");
  expectNoIntersection(rects[".depth-control"], rects[".environment-readout"], "view selector and environment readout");
  expectNoIntersection(rects[".sky-readout"], rects[".legend"], "celestial and contact disclosures");
  expect(rects[".plot-data-readout"].top - rects[".time-control"].bottom).toBeGreaterThanOrEqual(8);
  expect(tactical.bottom - rects[".depth-control"].bottom).toBeLessThanOrEqual(13);
  expect(rects[".depth-control"].top - rects[".plot-data-readout"].bottom).toBeGreaterThanOrEqual(24);
  for (const selector of [".sky-readout", ".environment-readout", ".legend"] as const) {
    expect(Math.abs(rects[selector].top - rects[".plot-data-readout"].top), `${selector} aligns with the compact HUD rail`).toBeLessThanOrEqual(1);
  }
  expectNoIntersection(rects[".plot-data-readout"], rects[".sky-readout"], "plot and celestial disclosures");
  expectNoIntersection(rects[".sky-readout"], rects[".environment-readout"], "celestial and environment disclosures");
  expectNoIntersection(rects[".environment-readout"], rects[".legend"], "environment and contact disclosures");

  const viewportRect: LayoutRect = {
    top: 0,
    left: 0,
    right: screenshotViewports.portrait.width,
    bottom: screenshotViewports.portrait.height,
    width: screenshotViewports.portrait.width,
    height: screenshotViewports.portrait.height,
  };
  for (const selector of selectors) expectContained(rects[selector], viewportRect, selector);
  await expectViewportBoundDocument(page);
});

test("tactical disclosures are closed by default, keyboard operable, and single-surface", async ({ page }, testInfo) => {
  desktopOnly(testInfo.project.name);
  await page.setViewportSize(screenshotViewports.desktop);
  await openSession(page);

  const plotData = page.locator(".plot-data-readout");
  const contactKey = page.locator(".legend");
  for (const disclosure of [plotData, contactKey]) await expect(disclosure).not.toHaveAttribute("open", "");
  await expect(page.locator(".plot-instruction, .view-telemetry, .coordinate")).toHaveCount(0);

  const plotSummary = plotData.locator(":scope > summary");
  const contactSummary = contactKey.locator(":scope > summary");
  for (const summary of [plotSummary, contactSummary]) {
    const box = await summary.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }

  await plotSummary.focus();
  await plotSummary.press("Enter");
  await expect(plotData).toHaveAttribute("open", "");
  await expect(page.locator(".plot-data-details")).toBeVisible();
  await expect(page.locator(".plot-data-details")).toContainText("SIMULATION GRID N-04");
  await expect(page.locator(".plot-data-details")).toContainText("VIEW · SURFACE");
  await plotSummary.press("Enter");
  await expect(plotData).not.toHaveAttribute("open", "");

  await contactSummary.press("Enter");
  await expect(contactKey).toHaveAttribute("open", "");
  await expect(page.locator(".legend-items")).toBeVisible();
  await expect(page.locator(".legend-items")).toContainText("FRIENDLY");
  await contactSummary.press("Enter");

  const battlefield = page.locator(".battlefield-canvas");
  await battlefield.focus();
  await battlefield.press("PageDown");
  await expect(page.getByRole("button", { name: "subsurface", exact: true })).toHaveAttribute("aria-pressed", "true");
  const subsurfaceData = page.locator(".life-environment-readout");
  await expect(subsurfaceData).not.toHaveAttribute("open", "");
  const subsurfaceSummary = subsurfaceData.locator(":scope > summary");
  expect((await subsurfaceSummary.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await subsurfaceSummary.press("Enter");
  await expect(page.locator(".environment-readout-details")).toBeVisible();
  await expect(page.locator(".environment-readout-details")).toContainText(/VAGUE FORMS/);
  await expect(page.locator("body")).not.toContainText("climate and fictional region generated");
  await expect(page.locator("body")).not.toContainText("decorative silhouettes are not classified tactical contacts");

  await page.getByRole("button", { name: "stars", exact: true }).click();
  const starData = page.locator(".star-environment-readout");
  await expect(starData).not.toHaveAttribute("open", "");
  await starData.locator(":scope > summary").press("Enter");
  await expect(page.locator(".environment-readout-details")).toContainText(/VISIBLE LIGHTS/);
  await expect(page.locator(".environment-readout-details")).toHaveCount(1);
  await expect(page.locator("body")).not.toContainText(/DRAG OR ARROW KEYS ROTATE|DRAG \/ ARROWS ROTATE/);
});

test("compact HUD accordion presents one closable information surface at a time", async ({ page }, testInfo) => {
  desktopOnly(testInfo.project.name);
  // Freeze the independently animated sky/water before comparing the clear
  // corridor. Any remaining pixel change then comes from the HUD itself.
  await page.emulateMedia({ reducedMotion: "reduce" });

  for (const viewport of [{ width: 320, height: 800 }, { width: 567, height: 803 }, { width: 640, height: 450 }]) {
    await page.setViewportSize(viewport);
    await openSession(page);
    await chooseMobileView(page, "VISUALIZATION");
    const environmentLayer = viewport.height <= 560 ? "subsurface" : "stars";
    await page.getByRole("button", { name: environmentLayer, exact: true }).click();
    await expect(page.locator(environmentLayer === "stars" ? ".star-environment-readout" : ".life-environment-readout")).toBeVisible();
    await expect(page.locator(".battlefield-canvas > .legend")).toHaveCount(1);

    const collapsedGlass = await page.evaluate(() => {
      const read = (selector: string) => {
        const element = document.querySelector<HTMLElement>(selector)!;
        const style = getComputedStyle(element);
        const alphaMatch = style.backgroundColor.match(/[\d.]+(?=\))/g);
        return {
          backgroundAlpha: alphaMatch ? Number(alphaMatch.at(-1)) : 1,
          backdropFilter: style.backdropFilter || style.getPropertyValue("-webkit-backdrop-filter"),
          boxCount: element.getClientRects().length,
        };
      };
      return {
        supported: CSS.supports("backdrop-filter", "blur(1px)") || CSS.supports("-webkit-backdrop-filter", "blur(1px)"),
        plot: read(".battlefield-canvas .plot-data-readout > summary"),
        time: read(".tactical-panel .time-control"),
      };
    });
    for (const [surface, style] of [["PLOT DATA", collapsedGlass.plot], ["time selector", collapsedGlass.time]] as const) {
      expect(style.boxCount, `${surface} is a real occupied surface at ${viewport.width}×${viewport.height}`).toBe(1);
      if (collapsedGlass.supported) {
        expect(style.backgroundAlpha, `${surface} has a translucent background at ${viewport.width}×${viewport.height}`).toBeGreaterThan(.35);
        expect(style.backgroundAlpha, `${surface} does not become opaque at ${viewport.width}×${viewport.height}`).toBeLessThan(.9);
        expect(style.backdropFilter, `${surface} visibly uses backdrop glass at ${viewport.width}×${viewport.height}`).not.toBe("none");
      }
    }

    const triggers = [
      page.locator(".plot-data-readout > summary"),
      page.locator(".sky-readout-toggle"),
      page.locator(".environment-readout > summary"),
      page.locator(".legend > summary"),
    ];
    const expanded = page.locator(".plot-data-readout[open], .environment-readout[open], .legend[open], .sky-readout[data-expanded='true']");

    for (const [triggerIndex, trigger] of triggers.entries()) {
      const triggerBox = await trigger.boundingBox();
      expect(triggerBox?.height, `44-pixel HUD trigger at ${viewport.width}×${viewport.height}`).toBeGreaterThanOrEqual(44);
      const visibleHeight = await trigger.evaluate((element) => {
        const triggerRect = element.getBoundingClientRect();
        const tacticalRect = element.closest(".tactical-panel")!.getBoundingClientRect();
        return Math.max(0, Math.min(triggerRect.bottom, tacticalRect.bottom, window.innerHeight)
          - Math.max(triggerRect.top, tacticalRect.top, 0));
      });
      expect(visibleHeight, `fully visible HUD trigger at ${viewport.width}×${viewport.height}`).toBeGreaterThanOrEqual(44);
      expect(await page.locator(".battlefield-canvas").evaluate((element) => element.scrollTop), `stable plot offset at ${viewport.width}×${viewport.height}`).toBe(0);
      await trigger.focus();
      await trigger.press("Enter");
      await expect(trigger).toBeFocused();
      await expect(expanded).toHaveCount(1);
      await expect(page.locator(".depth-control")).toBeHidden();

      const geometry = await page.evaluate(() => {
        const visible = (element: HTMLElement) => {
          const style = getComputedStyle(element);
          const box = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
        };
        const rect = (element: HTMLElement) => {
          const box = element.getBoundingClientRect();
          return { top: box.top, right: box.right, bottom: box.bottom, left: box.left, width: box.width, height: box.height };
        };
        const panels = [...document.querySelectorAll<HTMLElement>(".plot-data-details, .sky-readout-details, .environment-readout-details, .legend-items")].filter(visible);
        const toggles = [...document.querySelectorAll<HTMLElement>(".plot-data-readout > summary, .sky-readout-toggle, .environment-readout > summary, .legend > summary")].filter(visible);
        const wrapper = document.querySelector<HTMLElement>(".battlefield-canvas > .plot-data-readout[open], .battlefield-canvas > .environment-readout[open], .battlefield-canvas > .legend[open], .battlefield-canvas > .sky-readout[data-expanded='true']")!;
        const wrapperStyle = getComputedStyle(wrapper);
        const tactical = rect(document.querySelector<HTMLElement>(".tactical-panel")!);
        const depthControl = rect(document.querySelector<HTMLElement>(".depth-control")!);
        const panel = panels[0] ? rect(panels[0]) : null;
        const toggle = toggles[0] ? rect(toggles[0]) : null;
        const probe = panel && toggle
          ? document.elementFromPoint(tactical.left + tactical.width / 2, toggle.bottom + (panel.top - toggle.bottom) / 2)
          : null;
        return {
          panels: panels.map(rect),
          toggles: toggles.map(rect),
          tactical,
          depthControl,
          wrapperStyle: {
            display: wrapperStyle.display,
            backgroundColor: wrapperStyle.backgroundColor,
            backdropFilter: wrapperStyle.backdropFilter,
            webkitBackdropFilter: wrapperStyle.getPropertyValue("-webkit-backdrop-filter"),
            filter: wrapperStyle.filter,
            boxShadow: wrapperStyle.boxShadow,
            pointerEvents: wrapperStyle.pointerEvents,
            generatedBoxCount: wrapper.getClientRects().length,
          },
          occupiedSurfaceStyles: [...panels, ...toggles].map((surface) => {
            const style = getComputedStyle(surface);
            const alphaMatch = style.backgroundColor.match(/[\d.]+(?=\))/g);
            return {
              backgroundAlpha: alphaMatch ? Number(alphaMatch.at(-1)) : 1,
              backdropFilter: style.backdropFilter || style.getPropertyValue("-webkit-backdrop-filter"),
              boxCount: surface.getClientRects().length,
            };
          }),
          corridorInterceptedByHud: Boolean(probe?.closest(".plot-data-details, .sky-readout-details, .environment-readout-details, .legend-items, .plot-data-readout > summary, .sky-readout-toggle, .environment-readout > summary, .legend > summary")),
        };
      });
      expect(geometry.panels, `one expanded information panel at ${viewport.width}×${viewport.height}`).toHaveLength(1);
      expect(geometry.toggles, `only the active close trigger remains visible at ${viewport.width}×${viewport.height}`).toHaveLength(1);
      expect(intersectionArea(geometry.panels[0], geometry.toggles[0]), `expanded panel and its close trigger at ${viewport.width}×${viewport.height}: ${JSON.stringify(geometry)}`).toBeLessThanOrEqual(1);
      expect(geometry.tactical.bottom - geometry.panels[0].bottom, `expanded information stays edge-anchored at ${viewport.width}×${viewport.height}`).toBeLessThanOrEqual(13);
      expect(geometry.panels[0].height, `expanded information has a hard height budget at ${viewport.width}×${viewport.height}`).toBeLessThanOrEqual(Math.min(geometry.tactical.height * .22 + 1, 151));
      expect(geometry.panels[0].top - geometry.toggles[0].bottom, `the scene retains a clear central corridor at ${viewport.width}×${viewport.height}`).toBeGreaterThanOrEqual(Math.min(112, geometry.tactical.height * .28));
      expect((geometry.panels[0].width * geometry.panels[0].height) / (geometry.tactical.width * geometry.tactical.height), `expanded information coverage at ${viewport.width}×${viewport.height}`).toBeLessThanOrEqual(.22);
      expect(geometry.wrapperStyle.display, `expanded semantic wrapper generates no CSS box at ${viewport.width}×${viewport.height}`).toBe("contents");
      expect(geometry.wrapperStyle.generatedBoxCount, `expanded semantic wrapper has no paintable rectangle at ${viewport.width}×${viewport.height}`).toBe(0);
      expect(["transparent", "rgba(0, 0, 0, 0)"], `expanded positioning wrapper background at ${viewport.width}×${viewport.height}`).toContain(geometry.wrapperStyle.backgroundColor);
      expect(["", "none"], `expanded positioning wrapper backdrop filter at ${viewport.width}×${viewport.height}`).toContain(geometry.wrapperStyle.backdropFilter);
      expect(["", "none"], `expanded positioning wrapper prefixed backdrop filter at ${viewport.width}×${viewport.height}`).toContain(geometry.wrapperStyle.webkitBackdropFilter);
      expect(geometry.wrapperStyle.filter).toBe("none");
      expect(geometry.wrapperStyle.boxShadow).toBe("none");
      expect(geometry.wrapperStyle.pointerEvents).toBe("none");
      for (const style of geometry.occupiedSurfaceStyles) {
        expect(style.boxCount, `only occupied disclosure surfaces generate boxes at ${viewport.width}×${viewport.height}`).toBe(1);
        if (collapsedGlass.supported) {
          expect(style.backgroundAlpha, `occupied disclosure surface remains translucent at ${viewport.width}×${viewport.height}`).toBeGreaterThan(.35);
          expect(style.backgroundAlpha, `occupied disclosure surface remains visibly glass at ${viewport.width}×${viewport.height}`).toBeLessThan(.9);
          expect(style.backdropFilter, `occupied disclosure surface has backdrop glass at ${viewport.width}×${viewport.height}`).not.toBe("none");
        }
      }
      expect(geometry.corridorInterceptedByHud, `middle of expanded wrapper remains a real plot corridor at ${viewport.width}×${viewport.height}`).toBe(false);
      await expectViewportBoundDocument(page);

      const corridorClip = {
        x: Math.max(0, Math.ceil(geometry.tactical.left + 2)),
        // Exclude the occupied trigger's deliberately soft 18px shadow. The
        // sampled region begins in the true empty middle of the visualization.
        y: Math.max(0, Math.ceil(geometry.toggles[0].bottom + 28)),
        width: Math.max(1, Math.floor(geometry.tactical.width - 4)),
        height: Math.max(1, Math.floor(Math.min(geometry.panels[0].top, geometry.depthControl.top) - geometry.toggles[0].bottom - 30)),
      };
      await trigger.press("Enter");
      await expect(expanded).toHaveCount(0);
      await trigger.press("Enter");
      await expect(expanded).toHaveCount(1);
      const openCorridor = await page.screenshot({ clip: corridorClip, animations: "disabled" });
      await testInfo.attach(`hud-${viewport.width}x${viewport.height}-${triggerIndex + 1}-clear-corridor.png`, { body: openCorridor, contentType: "image/png" });
      await testInfo.attach(`hud-${viewport.width}x${viewport.height}-${triggerIndex + 1}-disclosure.png`, {
        body: await page.locator(".tactical-panel").screenshot(),
        contentType: "image/png",
      });
      const corridorHit = await page.evaluate(({ x, y, width, height }) => {
        const probes = [
          [x + width * .25, y + height * .3],
          [x + width * .5, y + height * .5],
          [x + width * .75, y + height * .7],
        ];
        return probes.map(([probeX, probeY]) => Boolean(document.elementFromPoint(probeX, probeY)?.closest(
          ".plot-data-details, .sky-readout-details, .environment-readout-details, .legend-items, .plot-data-readout > summary, .sky-readout-toggle, .environment-readout > summary, .legend > summary",
        )));
      }, corridorClip);
      expect(corridorHit, `opening the HUD must leave the safe corridor unoccupied at ${viewport.width}×${viewport.height}`).toEqual([false, false, false]);

      await trigger.press("Enter");
      await expect(trigger).toBeFocused();
      await expect(expanded).toHaveCount(0);
      await expect(page.locator(".depth-control")).toBeVisible();
      for (const railTrigger of triggers) await expect(railTrigger).toBeVisible();
    }
  }
});

test("celestial recap is compact by default and remains user-toggleable at supplied viewports", async ({ page }, testInfo) => {
  desktopOnly(testInfo.project.name);

  for (const viewport of [{ width: 2048, height: 1089 }, screenshotViewports.desktop, screenshotViewports.portrait, { width: 320, height: 800 }]) {
    await page.setViewportSize(viewport);
    await openSession(page);
    if (viewport.width <= 760) await chooseMobileView(page, "VISUALIZATION");

    const readout = page.locator(".sky-readout");
    const toggle = page.getByRole("button", { name: "Show Sun position recap" });
    await expect(readout).toHaveAttribute("data-expanded", "false");
    await expect(page.locator("#sky-readout-details")).toHaveCount(0);
    const collapsedBox = await readout.boundingBox();
    const toggleBox = await toggle.boundingBox();
    expect(collapsedBox?.height).toBeLessThanOrEqual(48);
    expect(toggleBox?.height).toBeGreaterThanOrEqual(44);

    await toggle.click();
    await expect(readout).toHaveAttribute("data-expanded", "true");
    await expect(page.locator("#sky-readout-details")).toBeVisible();
    if (viewport.width <= 760) {
      await expect(readout).toHaveCSS("display", "contents");
      expect(await readout.evaluate((element) => element.getClientRects().length)).toBe(0);
      await expect(page.locator(".depth-control")).toBeHidden();
      await layoutRects(page, [".sky-readout-toggle", ".sky-readout-details"]);
    } else {
      const expandedRects = await layoutRects(page, [".depth-control", ".sky-readout"]);
      expectNoIntersection(expandedRects[".depth-control"], expandedRects[".sky-readout"], "view selector and opened celestial recap");
    }
    const close = page.getByRole("button", { name: "Close Sun position recap" });
    await expect(close).toBeFocused();
    await close.press("Enter");
    await expect(readout).toHaveAttribute("data-expanded", "false");
    await expect(page.locator(".sky-readout-toggle")).toBeFocused();
    await expectViewportBoundDocument(page);
  }
});

test("view map and Sun or Moon recap remain perceptible directional glass in both themes", async ({ page }, testInfo) => {
  desktopOnly(testInfo.project.name);
  test.setTimeout(120_000);

  for (const viewport of [screenshotViewports.desktop, { width: 320, height: 800 }, screenshotViewports.portrait]) {
    await page.setViewportSize(viewport);
    await openSession(page);
    if (viewport.width <= 760) await chooseMobileView(page, "VISUALIZATION");
    await page.getByRole("button", { name: "night", exact: true }).click();

    for (const theme of ["dark", "light"] as const) {
      const currentTheme = await page.locator(".app").evaluate((element) => element.classList.contains("theme-light") ? "light" : "dark");
      if (currentTheme !== theme) await page.getByRole("button", { name: `Switch to ${theme} interface` }).click();

      const viewMap = page.locator(".depth-control");
      const celestial = page.locator(".sky-readout");
      const toggle = page.locator(".sky-readout-toggle");
      await expect(viewMap).toBeVisible();
      await expect(celestial).toHaveAttribute("data-expanded", "false");
      await expect(toggle).toContainText("MOON BELOW");

      const collapsedEvidence = {
        viewMap: await glassSurfaceMetrics(viewMap),
        celestialToggle: await glassSurfaceMetrics(toggle),
        viewMapPixels: await glassPixelSignature(page, viewMap),
        celestialTogglePixels: await glassPixelSignature(page, toggle),
      };
      expectDirectionalGlass(collapsedEvidence.viewMap, `${viewport.width}x${viewport.height}-${theme} view map`);
      expectDirectionalGlass(collapsedEvidence.celestialToggle, `${viewport.width}x${viewport.height}-${theme} Moon Below toggle`);
      expect(collapsedEvidence.viewMapPixels.variance, "view-map glass is perceptibly non-flat").toBeGreaterThan(2);
      expect(collapsedEvidence.celestialTogglePixels.variance, "celestial toggle glass is perceptibly non-flat").toBeGreaterThan(2);
      expect(collapsedEvidence.viewMapPixels.directionalDelta, "view-map directional highlight reaches actual pixels").toBeGreaterThan(.25);
      expect(collapsedEvidence.celestialTogglePixels.directionalDelta, "celestial directional highlight reaches actual pixels").toBeGreaterThan(.25);
      await testInfo.attach(`hud-glass-${viewport.width}x${viewport.height}-${theme}-collapsed.json`, {
        body: JSON.stringify(collapsedEvidence, null, 2),
        contentType: "application/json",
      });
      await page.locator(".tactical-panel").screenshot({
        path: testInfo.outputPath(`hud-glass-${viewport.width}x${viewport.height}-${theme}-collapsed.png`),
      });

      await toggle.click();
      await expect(celestial).toHaveAttribute("data-expanded", "true");
      const details = page.locator(".sky-readout-details");
      await expect(details).toBeVisible();
      const expandedEvidence = {
        toggle: await glassSurfaceMetrics(toggle),
        details: await glassSurfaceMetrics(details),
        togglePixels: await glassPixelSignature(page, toggle),
        detailPixels: await glassPixelSignature(page, details),
      };
      expectDirectionalGlass(expandedEvidence.toggle, `${viewport.width}x${viewport.height}-${theme} expanded celestial toggle`);
      expectDirectionalGlass(expandedEvidence.details, `${viewport.width}x${viewport.height}-${theme} celestial detail`);
      expect(expandedEvidence.detailPixels.variance, "celestial detail glass is perceptibly non-flat").toBeGreaterThan(2);
      expect(expandedEvidence.detailPixels.directionalDelta, "detail directional highlight reaches actual pixels").toBeGreaterThan(.25);

      const wrapper = await celestial.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          display: style.display,
          boxCount: element.getClientRects().length,
          backgroundColor: style.backgroundColor,
          backdropFilter: style.backdropFilter || style.getPropertyValue("-webkit-backdrop-filter"),
        };
      });
      if (viewport.width <= 760) {
        expect(wrapper.display).toBe("contents");
        expect(wrapper.boxCount).toBe(0);
      }
      expect(["transparent", "rgba(0, 0, 0, 0)"]).toContain(wrapper.backgroundColor);
      expect(["", "none"]).toContain(wrapper.backdropFilter);
      await testInfo.attach(`hud-glass-${viewport.width}x${viewport.height}-${theme}-expanded.json`, {
        body: JSON.stringify({ expandedEvidence, wrapper }, null, 2),
        contentType: "application/json",
      });
      await page.locator(".tactical-panel").screenshot({
        path: testInfo.outputPath(`hud-glass-${viewport.width}x${viewport.height}-${theme}-expanded.png`),
      });
      await page.getByRole("button", { name: "Close Moon position recap" }).click();
      await expect(viewMap).toBeVisible();
      await expectViewportBoundDocument(page);
    }
  }
});

test("force and command phases keep celestial recap opt-in and clear of current work", async ({ page }, testInfo) => {
  desktopOnly(testInfo.project.name);
  await page.setViewportSize(screenshotViewports.desktop);
  await openSession(page);
  await page.getByRole("button", { name: "night", exact: true }).click();
  await page.locator(".warfare-grid").getByRole("button", { name: /Intelligence and reconnaissance/i }).click();
  await completeStrategicChoices(page);
  await page.getByRole("button", { name: "CONTINUE TO FORCE DESIGN" }).click();

  const readout = page.locator(".sky-readout");
  await expect(page.locator(".force-panel")).toBeVisible();
  await expect(readout).toHaveAttribute("data-expanded", "false");
  let rects = await layoutRects(page, [".force-panel", ".sky-readout"]);
  expectNoIntersection(rects[".force-panel"], rects[".sky-readout"], "force design and compact celestial recap");

  await page.getByRole("button", { name: "Add one Fleet aviation ship" }).click();
  await expect(page.locator(".force-heading > div:last-child > strong")).not.toHaveText("0");
  await page.locator(".launch-button").click();
  const confirmation = page.getByRole("dialog", { name: "Readiness review found likely failure points" });
  await expect(confirmation).toBeVisible();
  await page.getByRole("button", { name: "PROCEED ANYWAY" }).click();

  const command = page.locator(".kriegsspiel-panel");
  await expect(command).toBeVisible();
  await expect(readout).toHaveAttribute("data-current-phase", "true");
  await expect(readout).toHaveAttribute("data-expanded", "false");
  rects = await layoutRects(page, [".kriegsspiel-panel", ".sky-readout"]);
  expectNoIntersection(rects[".kriegsspiel-panel"], rects[".sky-readout"], "command panel and compact celestial recap");

  const showRecap = page.getByRole("button", { name: "Show Moon position recap" });
  await showRecap.click();
  await expect(page.locator("#sky-readout-details")).toBeVisible();
  await page.getByRole("button", { name: "Close Moon position recap" }).click();

  for (const viewport of [screenshotViewports.portrait, { width: 320, height: 800 }]) {
    await page.setViewportSize(viewport);
    for (const selector of [".battlefield-canvas", ".plot-topline", ".legend"]) {
      await expect(page.locator(selector)).toBeHidden();
    }
    await expect(page.getByRole("button", { name: /RESOLVE TURN/ })).toBeEnabled();
    const recap = command.locator(".planning-recap");
    await expect(recap).not.toHaveAttribute("open", "");
    await recap.locator("summary").click();
    await expect(recap.getByTestId("planning-recap-content")).toBeVisible();
    await recap.locator("summary").click();
    await expect(command).toBeVisible();
    await expectViewportBoundDocument(page);
  }
});

test("below-horizon direction is integrated into one toggleable celestial surface", async ({ page }, testInfo) => {
  desktopOnly(testInfo.project.name);

  for (const viewport of [{ width: 2048, height: 1089 }, screenshotViewports.desktop, screenshotViewports.portrait, { width: 320, height: 800 }]) {
    await page.setViewportSize(viewport);
    await openSession(page);
    if (viewport.width <= 760) await chooseMobileView(page, "VISUALIZATION");
    await page.getByRole("button", { name: "night", exact: true }).click();
    const readout = page.locator(".sky-readout");
    await expect(readout).toHaveAttribute("data-expanded", "false");
    await expect(page.locator("#sky-readout-details")).toHaveCount(0);
    await expect(page.locator(".horizon-notice")).toHaveCount(0);
    const moonRecapToggle = page.getByRole("button", { name: "Show Moon position recap" });
    await moonRecapToggle.press("Enter");
    await expect(readout).toHaveAttribute("data-expanded", "true");
    await expect(page.locator("#sky-readout-details")).toBeVisible();
    await expect(page.locator(".sky-direction")).toContainText(/TURN (LEFT|RIGHT)|ON CURRENT BEARING/);
    await expect(page.getByText(/Moon altitude .* below horizon/)).toBeVisible();
    await expect(page.locator(".horizon-notice")).toHaveCount(0);

    if (viewport.width <= 760) {
      const rects = await layoutRects(page, [".tactical-panel", ".sky-readout-toggle", ".sky-readout-details"]);
      const tactical = rects[".tactical-panel"];
      expectContained(rects[".sky-readout-toggle"], tactical, `celestial trigger at ${viewport.width} pixels`);
      expectContained(rects[".sky-readout-details"], tactical, `celestial details at ${viewport.width} pixels`);
      expectNoIntersection(rects[".sky-readout-toggle"], rects[".sky-readout-details"], "celestial trigger and details card");
      await expect(page.locator(".depth-control")).toBeHidden();
    } else {
      const rects = await layoutRects(page, [".tactical-panel", ".depth-control", ".sky-readout"]);
      const tactical = rects[".tactical-panel"];
      expectContained(rects[".sky-readout"], tactical, `celestial surface at ${viewport.width} pixels`);
      expectNoIntersection(rects[".depth-control"], rects[".sky-readout"], "view selector and opened celestial surface");
    }
    expect(await page.locator(".sky-readout").count()).toBe(1);
    const pageText = await page.locator("body").innerText();
    for (const removed of ["synthetic horizon", "fixed scenario sky", "no location access", "fictional local time", "fictional observer"]) {
      expect(pageText.toLowerCase()).not.toContain(removed);
    }

    await page.getByRole("button", { name: "Close Moon position recap" }).press("Enter");
    await expect(page.locator("#sky-readout-details")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Show Moon position recap" })).toBeFocused();
    await expectViewportBoundDocument(page);
  }
});

test("open sound settings paint above the game surface and remain inside the viewport", async ({ page }, testInfo) => {
  desktopOnly(testInfo.project.name);
  await page.setViewportSize(screenshotViewports.desktop);
  await openSession(page);
  const directSoundSettings = page.locator(".sound-settings > summary");
  if (await directSoundSettings.isVisible()) {
    await directSoundSettings.click();
  } else {
    await page.locator(".global-tools-menu > summary").click();
    await page.getByRole("button", { name: "SOUND SETTINGS", exact: true }).click();
  }
  await expect(page.locator(".sound-settings > section")).toBeVisible();

  const state = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>(".sound-settings > section")!;
    const topbar = document.querySelector<HTMLElement>(".topbar")!;
    const rect = panel.getBoundingClientRect();
    const sampleX = Math.min(rect.right - 4, Math.max(rect.left + 4, rect.left + rect.width / 2));
    const sampleY = Math.min(rect.bottom - 4, rect.top + 4);
    const topmost = document.elementFromPoint(sampleX, sampleY);
    return {
      panel: { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left, width: rect.width, height: rect.height },
      topbarZ: Number.parseInt(getComputedStyle(topbar).zIndex, 10),
      topmostBelongsToPanel: Boolean(topmost && panel.contains(topmost)),
      viewport: { width: innerWidth, height: innerHeight },
    };
  });

  expect(state.panel.left).toBeGreaterThanOrEqual(0);
  expect(state.panel.top).toBeGreaterThanOrEqual(0);
  expect(state.panel.right).toBeLessThanOrEqual(state.viewport.width);
  expect(state.panel.bottom).toBeLessThanOrEqual(state.viewport.height);
  expect(state.topbarZ).toBeGreaterThan(0);
  expect(state.topmostBelongsToPanel, "the open sound panel must paint above the game surface").toBe(true);
});

test("representative light and dark text, control, and focus variables meet contrast thresholds", async ({ page }, testInfo) => {
  desktopOnly(testInfo.project.name);
  await openSession(page);

  const measure = () => page.evaluate(() => {
    const app = document.querySelector<HTMLElement>(".app")!;
    const style = getComputedStyle(app);
    const resolve = (name: string) => {
      const probe = document.createElement("span");
      probe.style.color = style.getPropertyValue(name).trim();
      app.appendChild(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      const values = color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
      if (!values || values.length !== 3) throw new Error(`Could not resolve ${name}: ${color}`);
      return values as [number, number, number];
    };
    const luminance = ([red, green, blue]: [number, number, number]) => {
      const channel = (value: number) => {
        const normalized = value / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
    };
    const ratio = (left: [number, number, number], right: [number, number, number]) => {
      const lighter = Math.max(luminance(left), luminance(right));
      const darker = Math.min(luminance(left), luminance(right));
      return (lighter + 0.05) / (darker + 0.05);
    };
    const colors = {
      bg: resolve("--bg"),
      panel: resolve("--panel"),
      raised: resolve("--raised"),
      text: resolve("--text"),
      muted: resolve("--muted"),
      accent: resolve("--accent"),
      accentStrong: resolve("--accent-strong"),
      accentInk: resolve("--accent-ink"),
    };
    return {
      theme: app.classList.contains("theme-light") ? "light" : "dark",
      textOnPanel: ratio(colors.text, colors.panel),
      mutedOnPanel: ratio(colors.muted, colors.panel),
      controlInkOnAccent: ratio(colors.accentInk, colors.accent),
      focusOnBg: ratio(colors.accentStrong, colors.bg),
      focusOnPanel: ratio(colors.accentStrong, colors.panel),
      focusOnRaised: ratio(colors.accentStrong, colors.raised),
    };
  });

  const dark = await measure();
  await page.getByRole("button", { name: "Switch to light interface" }).click();
  const light = await measure();
  await testInfo.attach("theme-contrast-metrics.json", {
    body: JSON.stringify({ dark, light }, null, 2),
    contentType: "application/json",
  });

  expect(dark.theme).toBe("dark");
  expect(light.theme).toBe("light");
  for (const result of [dark, light]) {
    expect(result.textOnPanel, `${result.theme} primary text`).toBeGreaterThanOrEqual(4.5);
    expect(result.mutedOnPanel, `${result.theme} secondary text`).toBeGreaterThanOrEqual(4.5);
    expect(result.controlInkOnAccent, `${result.theme} primary control`).toBeGreaterThanOrEqual(4.5);
    expect(result.focusOnBg, `${result.theme} focus against background`).toBeGreaterThanOrEqual(3);
    expect(result.focusOnPanel, `${result.theme} focus against panel`).toBeGreaterThanOrEqual(3);
    expect(result.focusOnRaised, `${result.theme} focus against raised control surfaces`).toBeGreaterThanOrEqual(3);
  }
});
