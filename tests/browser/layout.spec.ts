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
  const scenarioAcceptance = guide.locator("summary").filter({ hasText: "HOW A SCENARIO IS ACCEPTED" });
  await scenarioAcceptance.click();
  await expect(scenarioAcceptance.locator("xpath=..")).toHaveAttribute("open", "");
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
      await testInfo.attach(`${theme}-${viewport.width}x${viewport.height}-field-guuón»¶‰žËkºwµçE¹‘•ˆ°€‰™…±Í”ˆ¤ì(€€€…Ý…¥Ð•áÁ•Ð¡Á…”¹±½…Ñ½È ˆ¹Í­äµÉ•…‘½ÕÐµÑ½±”ˆ¤¤¹Ñ½	•½ÕÍ• ¤ì(€€€…Ý…¥Ð•áÁ•ÑY¥•ÝÁ½ÉÑ	½Õ¹‘½Õµ•¹Ð¡Á…”¤ì(€ô)ô¤ì()Ñ•ÍÐ ‰Ù¥•Üµ…À…¹MÕ¸½È5½½¸É•…ÀÉ•µ…¥¸Á•É•ÁÑ¥‰±”‘¥É•Ñ¥½¹…°±…ÍÌ¥¸‰½Ñ Ñ¡•µ•Ìˆ°…Íå¹Œ€¡ìÁ…”ô°Ñ•ÍÑ%¹™¼¤€ôøì(€‘•Í­Ñ½Á=¹±ä¡Ñ•ÍÑ%¹™¼¹ÁÉ½©•Ð¹¹…µ”¤ì(€Ñ•ÍÐ¹Í•ÑQ¥µ•½ÕÐ ÄÈÁ|ÀÀÀ¤ì((€™½È€¡½¹ÍÐÙ¥•ÝÁ½ÉÐ½˜mÍÉ••¹Í¡½ÑY¥•ÝÁ½ÉÑÌ¹‘•Í­Ñ½À°ìÝ¥‘Ñ è€ÌÈÀ°¡•¥¡Ðè€àÀÀô°ÍÉ••¹Í¡½ÑY¥•ÝÁ½ÉÑÌ¹Á½ÉÑÉ…¥Ñt¤ì(€€€…Ý…¥ÐÁ…”¹Í•ÑY¥•ÝÁ½ÉÑM¥é”¡Ù¥•ÝÁ½ÉÐ¤ì(€€€…Ý…¥Ð½Á•¹M•ÍÍ¥½¸¡Á…”¤ì(€€€¥˜€¡Ù¥•ÝÁ½ÉÐ¹Ý¥‘Ñ €ðô€ÜØÀ¤…Ý…¥Ð¡½½Í•5½‰¥±•Y¥•Ü¡Á…”°€‰Y%MU1%iQ%=8ˆ¤ì(€€€…Ý…¥ÐÁ…”¹•Ñ	åI½±” ‰‰ÕÑÑ½¸ˆ°ì¹…µ”è€‰¹¥¡Ðˆ°•á…ÐèÑÉÕ”ô¤¹±¥¬ ¤ì((€€€™½È€¡½¹ÍÐÑ¡•µ”½˜l‰‘…É¬ˆ°€‰±¥¡Ð‰t…Ì½¹ÍÐ¤ì(€€€€€½¹ÍÐÕÉÉ•¹ÑQ¡•µ”€ô…Ý…¥ÐÁ…”¹±½…Ñ½È ˆ¹…ÁÀˆ¤¹•Ù…±Õ…Ñ” ¡•±•µ•¹Ð¤€ôø•±•µ•¹Ð¹±…ÍÍ1¥ÍÐ¹½¹Ñ…¥¹Ì ‰Ñ¡•µ”µ±¥¡Ðˆ¤€ü€‰±¥¡Ðˆ€è€‰‘…É¬ˆ¤ì(€€€€€¥˜€¡ÕÉÉ•¹ÑQ¡•µ”€„ôôÑ¡•µ”¤…Ý…¥ÐÁ…”¹•Ñ	åI½±” ‰‰ÕÑÑ½¸ˆ°ì¹…µ”èMÝ¥Ñ Ñ¼€‘íÑ¡•µ•ô¥¹Ñ•É™…•€ô¤¹±¥¬ ¤ì((€€€€€½¹ÍÐÙ¥•Ý5…À€ôÁ…”¹±½…Ñ½È ˆ¹‘•ÁÑ µ½¹ÑÉ½°ˆ¤ì(€€€€€½¹ÍÐ•±•ÍÑ¥…°€ôÁ…”¹±½…Ñ½È ˆ¹Í­äµÉ•…‘½ÕÐˆ¤ì(€€€€€½¹ÍÐÑ½±”€ôÁ…”¹±½…Ñ½È ˆ¹Í­äµÉ•…‘½ÕÐµÑ½±”ˆ¤ì(€€€€€…Ý…¥Ð•áÁ•Ð¡Ù¥•Ý5…À¤¹Ñ½	•Y¥Í¥‰±” ¤ì(€€€€€…Ý…¥Ð•áÁ•Ð¡•±•ÍÑ¥…°¤¹Ñ½!…Ù•ÑÑÉ¥‰ÕÑ” ‰‘…Ñ„µ•áÁ…¹‘•ˆ°€‰™…±Í”ˆ¤ì(€€€€€…Ý…¥Ð•áÁ•Ð¡Ñ½±”¤¹Ñ½½¹Ñ…¥¹Q•áÐ ‰5==8	1=\ˆ¤ì((€€€€€½¹ÍÐ½±±…ÁÍ•‘Ù¥‘•¹”€ôì(€€€€€€€Ù¥•Ý5…Àè…Ý…¥Ð±…ÍÍMÕÉ™…•5•ÑÉ¥Ì¡Ù¥•Ý5…À¤°(€€€€€€€•±•ÍÑ¥…±Q½±”è…Ý…¥Ð±…ÍÍMÕÉ™…•5•ÑÉ¥Ì¡Ñ½±”¤°(€€€€€€€Ù¥•Ý5…ÁA¥á•±Ìè…Ý…¥Ð±…ÍÍA¥á•±M¥¹…ÑÕÉ”¡Á…”°Ù¥•Ý5…À¤°(€€€€€€€•±•ÍÑ¥…±Q½±•A¥á•±Ìè…Ý…¥Ð±…ÍÍA¥á•±M¥¹…ÑÕÉ”¡Á…”°Ñ½±”¤°(€€€€€ôì(€€€€€•áÁ•Ñ¥É•Ñ¥½¹…±±…ÍÌ¡½±±…ÁÍ•‘Ù¥‘•¹”¹Ù¥•Ý5…À°€‘íÙ¥•ÝÁ½ÉÐ¹Ý¥‘Ñ¡õà‘íÙ¥•ÝÁ½ÉÐ¹¡•¥¡Ñô´‘íÑ¡•µ•ôÙ¥•Üµ…Á€¤ì(€€€€€•áÁ•Ñ¥É•Ñ¥½¹…±±…ÍÌ¡½±±…ÁÍ•‘Ù¥‘•¹”¹•±•ÍÑ¥…±Q½±”°€‘íÙ¥•ÝÁ½ÉÐ¹Ý¥‘Ñ¡õà‘íÙ¥•ÝÁ½ÉÐ¹¡•¥¡Ñô´‘íÑ¡•µ•ô5½½¸	•±½ÜÑ½±•€¤ì(€€€€€•áÁ•Ð¡½±±…ÁÍ•‘Ù¥‘•¹”¹Ù¥•Ý5…ÁA¥á•±Ì¹Ù…É¥…¹”°€‰Ù¥•Üµµ…À±…ÍÌ¥ÌÁ•É•ÁÑ¥‰±ä¹½¸µ™±…Ðˆ¤¹Ñ½	•É•…Ñ•ÉQ¡…¸ È¤ì(€€€€€•áÁ•Ð¡½±±…ÁÍ•‘Ù¥‘•¹”¹•±•ÍÑ¥…±Q½±•A¥á•±Ì¹Ù…É¥…¹”°€‰•±•ÍÑ¥…°Ñ½±”±…ÍÌ¥ÌÁ•É•ÁÑ¥‰±ä¹½¸µ™±…Ðˆ¤¹Ñ½	•É•…Ñ•ÉQ¡…¸ È¤ì(€€€€€•áÁ•Ð¡½±±…ÁÍ•‘Ù¥‘•¹”¹Ù¥•Ý5…ÁA¥á•±Ì¹‘¥É•Ñ¥½¹…±•±Ñ„°€‰Ù¥•Üµµ…À‘¥É•Ñ¥½¹…°¡¥¡±¥¡ÐÉ•…¡•Ì…ÑÕ…°Á¥á•±Ìˆ¤¹Ñ½	•É•…Ñ•ÉQ¡…¸ ¸ÈÔ¤ì(€€€€€•áÁ•Ð¡½±±…ÁÍ•‘Ù¥‘•¹”¹•±•ÍÑ¥…±Q½±•A¥á•±Ì¹‘¥É•Ñ¥½¹…±•±Ñ„°€‰•±•ÍÑ¥…°‘¥É•Ñ¥½¹…°¡¥¡±¥¡ÐÉ•…¡•Ì…ÑÕ…°Á¥á•±Ìˆ¤¹Ñ½	•É•…Ñ•ÉQ¡…¸ ¸ÈÔ¤ì(€€€€€…Ý…¥ÐÑ•ÍÑ%¹™¼¹…ÑÑ… ¡¡Õµ±…ÍÌ´‘íÙ¥•ÝÁ½ÉÐ¹Ý¥‘Ñ¡õà‘íÙ¥•ÝÁ½ÉÐ¹¡•¥¡Ñô´‘íÑ¡•µ•ôµ½±±…ÁÍ•¹©Í½¹€°ì(€€€€€€€‰½‘äè)M=8¹ÍÑÉ¥¹¥™ä¡½±±…ÁÍ•‘Ù¥‘•¹”°¹Õ±°°€È¤°(€€€€€€€½¹Ñ•¹ÑQåÁ”è€‰…ÁÁ±¥…Ñ¥½¸½©Í½¸ˆ°(€€€€€ô¤ì(€€€€€…Ý…¥ÐÁ…”¹±½…Ñ½È ˆ¹Ñ…Ñ¥…°µÁ…¹•°ˆ¤¹ÍÉ••¹Í¡½Ð¡ì(€€€€€€€Á…Ñ èÑ•ÍÑ%¹™¼¹½ÕÑÁÕÑA…Ñ ¡¡Õµ±…ÍÌ´‘íÙ¥•ÝÁ½ÉÐ¹Ý¥‘Ñ¡õà‘íÙ¥•ÝÁ½ÉÐ¹¡•¥¡Ñô´‘íÑ¡•µ•ôµ½±±…ÁÍ•¹Á¹€¤°(€€€€€ô¤ì((€€€€€…Ý…¥ÐÑ½±”¹±¥¬ ¤ì(€€€€€…Ý…¥Ð•áÁ•Ð¡•±•ÍÑ¥…°¤¹Ñ½!…Ù•ÑÑÉ¥‰ÕÑ” ‰‘…Ñ„µ•áÁ…¹‘•ˆ°€‰ÑÉÕ”ˆ¤ì(€€€€€½¹ÍÐ‘•Ñ…¥±Ì€ôÁ…”¹±½…Ñ½È ˆ¹Í­äµÉ•…‘½ÕÐµ‘•Ñ…¥±Ìˆ¤ì(€€€€€…Ý…¥Ð•áÁ•Ð¡‘•Ñ…¥±Ì¤¹Ñ½	•Y¥Í¥‰±” ¤ì(€€€€€½¹ÍÐ•áÁ…¹‘•‘Ù¥‘•¹”€ôì(€€€€€€€Ñ½±”è…Ý…¥Ð±…ÍÍMÕÉ™…•5•ÑÉ¥Ì¡Ñ½±”¤°(€€€€€€€‘•Ñ…¥±Ìè…Ý…¥Ð±…ÍÍMÕÉ™…•5•ÑÉ¥Ì¡‘•Ñ…¥±Ì¤°(€€€€€€€Ñ½±•A¥á•±Ìè…Ý…¥Ð±…ÍÍA¥á•±M¥¹…ÑÕÉ”¡Á…”°Ñ½±”¤°(€€€€€€€‘•Ñ…¥±A¥á•±Ìè…Ý…¥Ð±…ÍÍA¥á•±M¥¹…ÑÕÉ”¡Á…”°‘•Ñ…¥±Ì¤°(€€€€€ôì(€€€€€•áÁ•Ñ¥É•Ñ¥½¹…±±…ÍÌ¡•áÁ…¹‘•‘Ù¥‘•¹”¹Ñ½±”°€‘íÙ¥•ÝÁ½ÉÐ¹Ý¥‘Ñ¡õà‘íÙ¥•ÝÁ½ÉÐ¹¡•¥¡Ñô´‘íÑ¡•µ•ô•áÁ…¹‘••±•ÍÑ¥…°Ñ½±•€¤ì(€€€€€•áÁ•Ñ¥É•Ñ¥½¹…±±…ÍÌ¡•áÁ…¹‘•‘Ù¥‘•¹”¹‘•Ñ…¥±Ì°€‘íÙ¥•ÝÁ½ÉÐ¹Ý¥‘Ñ¡õà‘íÙ¥•ÝÁ½ÉÐ¹¡•¥¡Ñô´‘íÑ¡•µ•ô•±•ÍÑ¥…°‘•Ñ…¥±€¤ì(€€€€€•áÁ•Ð¡•áÁ…¹‘•‘Ù¥‘•¹”¹‘•Ñ…¥±A¥á•±Ì¹Ù…É¥…¹”°€‰•±•ÍÑ¥…°‘•Ñ…¥°±…ÍÌ¥ÌÁ•É•ÁÑ¥‰±ä¹½¸µ™±…Ðˆ¤¹Ñ½	•É•…Ñ•ÉQ¡…¸ È¤ì(€€€€€•áÁ•Ð¡•áÁ…¹‘•‘Ù¥‘•¹”¹‘•Ñ…¥±A¥á•±Ì¹‘¥É•Ñ¥½¹…±•±Ñ„°€‰‘•Ñ…¥°‘¥É•Ñ¥½¹…°¡¥¡±¥¡ÐÉ•…¡•Ì…ÑÕ…°Á¥á•±Ìˆ¤¹Ñ½	•É•…Ñ•ÉQ¡…¸ ¸ÈÔ¤ì((€€€€€½¹ÍÐÝÉ…ÁÁ•È€ô…Ý…¥Ð•±•ÍÑ¥…°¹•Ù…±Õ…Ñ” ¡•±•µ•¹Ð¤€ôøì(€€€€€€€½¹ÍÐÍÑå±”€ô•Ñ½µÁÕÑ•‘MÑå±”¡•±•µ•¹Ð¤ì(€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€‘¥ÍÁ±…äèÍÑå±”¹‘¥ÍÁ±…ä°(€€€€€€€€€‰½á½Õ¹Ðè•±•µ•¹Ð¹•Ñ±¥•¹ÑI•ÑÌ ¤¹±•¹Ñ °(€€€€€€€€€‰…­É½Õ¹‘½±½ÈèÍÑå±”¹‰…­É½Õ¹‘½±½È°(€€€€€€€€€‰…­‘É½Á¥±Ñ•ÈèÍÑå±”¹‰…­‘É½Á¥±Ñ•ÈñðÍÑå±”¹•ÑAÉ½Á•ÉÑåY…±Õ” ˆµÝ•‰­¥Ðµ‰…­‘É½Àµ™¥±Ñ•Èˆ¤°(€€€€€€€ôì(€€€€€ô¤ì(€€€€€¥˜€¡Ù¥•ÝÁ½ÉÐ¹Ý¥‘Ñ €ðô€ÜØÀ¤ì(€€€€€€€•áÁ•Ð¡ÝÉ…ÁÁ•È¹‘¥ÍÁ±…ä¤¹Ñ½	” ‰½¹Ñ•¹ÑÌˆ¤ì(€€€€€€€•áÁ•Ð¡ÝÉ…ÁÁ•È¹‰½á½Õ¹Ð¤¹Ñ½	” À¤ì(€€€€€ô(€€€€€•áÁ•Ð¡l‰ÑÉ…¹ÍÁ…É•¹Ðˆ°€‰É‰„ À°€À°€À°€À¤‰t¤¹Ñ½½¹Ñ…¥¸¡ÝÉ…ÁÁ•È¹‰…­É½Õ¹‘½±½È¤ì(€€€€€•áÁ•Ð¡lˆˆ°€‰¹½¹”‰t¤¹Ñ½½¹Ñ…¥¸¡ÝÉ…ÁÁ•È¹‰…­‘É½Á¥±Ñ•È¤ì(€€€€€…Ý…¥ÐÑ•ÍÑ%¹™¼¹…ÑÑ… ¡¡Õµ±…ÍÌ´‘íÙ¥•ÝÁ½ÉÐ¹Ý¥‘Ñ¡õà‘íÙ¥•ÝÁ½ÉÐ¹¡•¥¡Ñô´‘íÑ¡•µ•ôµ•áÁ…¹‘•¹©Í½¹€°ì(€€€€€€€‰½‘äè)M=8¹ÍÑÉ¥¹¥™ä¡ì•áÁ…¹‘•‘Ù¥‘•¹”°ÝÉ…ÁÁ•Èô°¹Õ±°°€È¤°(€€€€€€€½¹Ñ•¹ÑQåÁ”è€‰…ÁÁ±¥…Ñ¥½¸½©Í½¸ˆ°(€€€€€ô¤ì(€€€€€…Ý…¥ÐÁ…”¹±½…Ñ½È ˆ¹Ñ…Ñ¥…°µÁ…¹•°ˆ¤¹ÍÉ••¹Í¡½Ð¡ì(€€€€€€€Á…Ñ èÑ•ÍÑ%¹™¼¹½ÕÑÁÕÑA…Ñ ¡¡Õµ±…ÍÌ´‘íÙ¥•ÝÁ½ÉÐ¹Ý¥‘Ñ¡õà‘íÙ¥•ÝÁ½ÉÐ¹¡•¥¡Ñô´‘íÑ¡•µ•ôµ•áÁ…¹‘•¹Á¹€¤°(€€€€€ô¤ì(€€€€€…Ý…¥ÐÁ…”¹•Ñ	åI½±” ‰‰ÕÑÑ½¸ˆ°ì¹…µ”è€‰±½Í”5½½¸Á½Í¥Ñ¥½¸É•…Àˆô¤¹±¥¬ ¤ì(€€€€€…Ý…¥Ð•áÁ•Ð¡Ù¥•Ý5…À¤¹Ñ½	•Y¥Í¥‰±” ¤ì(€€€€€…Ý…¥Ð•áÁ•ÑY¥•ÝÁ½ÉÑ	½Õ¹‘½Õµ•¹Ð¡Á…”¤ì(€€€ô(€ô)ô¤ì()Ñ•ÍÐ ‰™½É”…¹½µµ…¹Á¡…Í•Ì­••À•±•ÍÑ¥…°É•…À½ÁÐµ¥¸…¹±•…È½˜ÕÉÉ•¹ÐÝ½É¬ˆ°…Íå¹Œ€¡ìÁ…”ô°Ñ•ÍÑ%¹™¼¤€ôøì(€‘•Í­Ñ½Á=¹±ä¡Ñ•ÍÑ%¹™¼¹ÁÉ½©•Ð¹¹…µ”¤ì(€…Ý…¥ÐÁ…”¹Í•ÑY¥•ÝÁ½ÉÑM¥é”¡ÍÉ••¹Í¡½ÑY¥•ÝÁ½ÉÑÌ¹‘•Í­Ñ½À¤ì(€…Ý…¥Ð½Á•¹M•ÍÍ¥½¸¡Á…”¤ì(€…Ý…¥ÐÁ…”¹•Ñ	åI½±” ‰‰ÕÑÑ½¸ˆ°ì¹…µ”è€‰¹¥¡Ðˆ°•á…ÐèÑÉÕ”ô¤¹±¥¬ ¤ì(€…Ý…¥ÐÁ…”¹±½…Ñ½È ˆ¹Ý…É™…É”µÉ¥ˆ¤¹•Ñ	åI½±” ‰‰ÕÑÑ½¸ˆ°ì¹…µ”è€½%¹Ñ•±±¥•¹”…¹É•½¹¹…¥ÍÍ…¹”½¤ô¤¹±¥¬ ¤ì(€…Ý…¥Ð½µÁ±•Ñ•MÑÉ…Ñ•¥¡½¥•Ì¡Á…”¤ì(€…Ý…¥ÐÁ…”¹•Ñ	åI½±” ‰‰ÕÑÑ½¸ˆ°ì¹…µ”è€‰=9Q%9UQ<=IM%8ˆô¤¹±¥¬ ¤ì((€½¹ÍÐÉ•…‘½ÕÐ€ôÁ…”¹±½…Ñ½È ˆ¹Í­äµÉ•…‘½ÕÐˆ¤ì(€…Ý…¥Ð•áÁ•Ð¡Á…”¹±½…Ñ½È ˆ¹™½É”µÁ…¹•°ˆ¤¤¹Ñ½	•Y¥Í¥‰±” ¤ì(€…Ý…¥Ð•áÁ•Ð¡É•…‘½ÕÐ¤¹Ñ½!…Ù•ÑÑÉ¥‰ÕÑ” ‰‘…Ñ„µ•áÁ…¹‘•ˆ°€‰™…±Í”ˆ¤ì(€±•ÐÉ•ÑÌ€ô…Ý…¥Ð±…å½ÕÑI•ÑÌ¡Á…”°lˆ¹™½É”µÁ…¹•°ˆ°€ˆ¹Í­äµÉ•…‘½ÕÐ‰t¤ì(€•áÁ•Ñ9½%¹Ñ•ÉÍ•Ñ¥½¸¡É•ÑÍlˆ¹™½É”µÁ…¹•°‰t°É•ÑÍlˆ¹Í­äµÉ•…‘½ÕÐ‰t°€‰™½É”‘•Í¥¸…¹½µÁ…Ð•±•ÍÑ¥…°É•…Àˆ¤ì((€…Ý…¥ÐÁ…”¹•Ñ	åI½±” ‰‰ÕÑÑ½¸ˆ°ì¹…µ”è€‰‘½¹”±••Ð…Ù¥…Ñ¥½¸Í¡¥Àˆô¤¹±¥¬ ¤ì(€…Ý…¥Ð•áÁ•Ð¡Á…”¹±½…Ñ½È ˆ¹™½É”µ¡•…‘¥¹œ€ø‘¥Øé±…ÍÐµ¡¥±€øÍÑÉ½¹œˆ¤¤¹¹½Ð¹Ñ½!…Ù•Q•áÐ ˆÀˆ¤ì(€…Ý…¥ÐÁ…”¹±½…Ñ½È ˆ¹±…Õ¹ µ‰ÕÑÑ½¸ˆ¤¹±¥¬ ¤ì(€½¹ÍÐ½¹™¥Éµ…Ñ¥½¸€ôÁ…”¹•Ñ	åI½±” ‰‘¥…±½œˆ°ì¹…µ”è€‰I•…‘¥¹•ÍÌÉ•Ù¥•Ü™½Õ¹±¥­•±ä™…¥±ÕÉ”Á½¥¹ÑÌˆô¤ì(€…Ý…¥Ð•áÁ•Ð¡½¹™¥Éµ…Ñ¥½¸¤¹Ñ½	•Y¥Í¥‰±” ¤ì(€…Ý…¥ÐÁ…”¹•Ñ	åI½±” ‰‰ÕÑÑ½¸ˆ°ì¹…µ”è€‰AI=9e]dˆô¤¹±¥¬ ¤ì((€½¹ÍÐ½µµ…¹€ôÁ…”¹±½…Ñ½È ˆ¹­É¥•ÍÍÁ¥•°µÁ…¹•°ˆ¤ì(€…Ý…¥Ð•áÁ•Ð¡½µµ…¹¤¹Ñ½	•Y¥Í¥‰±” ¤ì(€…Ý…¥Ð•áÁ•Ð¡É•…‘½ÕÐ¤¹Ñ½!…Ù•ÑÑÉ¥‰ÕÑ” ‰‘…Ñ„µÕÉÉ•¹ÐµÁ¡…Í”ˆ°€‰ÑÉÕ”ˆ¤ì(€…Ý…¥Ð•áÁ•Ð¡É•…‘½ÕÐ¤¹Ñ½!…Ù•ÑÑÉ¥‰ÕÑ” ‰‘…Ñ„µ•áÁ…¹‘•ˆ°€‰™…±Í”ˆ¤ì(€É•ÑÌ€ô…Ý…¥Ð±…å½ÕÑI•ÑÌ¡Á…”°lˆ¹­É¥•ÍÍÁ¥•°µÁ…¹•°ˆ°€ˆ¹Í­äµÉ•…‘½ÕÐ‰t¤ì(€•áÁ•Ñ9½%¹Ñ•ÉÍ•Ñ¥½¸¡É•ÑÍlˆ¹­É¥•ÍÍÁ¥•°µÁ…¹•°‰t°É•ÑÍlˆ¹Í­äµÉ•…‘½ÕÐ‰t°€‰½µµ…¹Á…¹•°…¹½µÁ…Ð•±•ÍÑ¥…°É•…Àˆ¤ì((€½¹ÍÐÍ¡½ÝI•…À€ôÁ…”¹•Ñ	åI½±” ‰‰ÕÑÑ½¸ˆ°ì¹…µ”è€‰M¡½Ü5½½¸Á½Í¥Ñ¥½¸É•…Àˆô¤ì(€…Ý…¥ÐÍ¡½ÝI•…À¹±¥¬ ¤ì(€…Ý…¥Ð•áÁ•Ð¡Á…”¹±½…Ñ½È ˆÍ­äµÉ•…‘½ÕÐµ‘•Ñ…¥±Ìˆ¤¤¹Ñ½	•Y¥Í¥‰±” ¤ì(€…Ý…¥ÐÁ…”¹•Ñ	åI½±” ‰‰ÕÑÑ½¸ˆ°ì¹…µ”è€‰±½Í”5½½¸Á½Í¥Ñ¥½¸É•…Àˆô¤¹±¥¬ ¤ì((€™½È€¡½¹ÍÐÙ¥•ÝÁ½ÉÐ½˜mÍÉ••¹Í¡½ÑY¥•ÝÁ½ÉÑÌ¹Á½ÉÑÉ…¥Ð°ìÝ¥‘Ñ è€ÌÈÀ°¡•¥¡Ðè€àÀÀõt¤ì(€€€…Ý…¥ÐÁ…”¹Í•ÑY¥•ÝÁ½ÉÑM¥é”¡Ù¥•ÝÁ½ÉÐ¤ì(€€€™½È€¡½¹ÍÐÍ•±•Ñ½È½˜lˆ¹‰…ÑÑ±•™¥•±µ…¹Ù…Ìˆ°€ˆ¹Á±½ÐµÑ½Á±¥¹”ˆ°€ˆ¹±••¹‰t¤ì(€€€€€…Ý…¥Ð•áÁ•Ð¡Á…”¹±½…Ñ½È¡Í•±•Ñ½È¤¤¹Ñ½	•!¥‘‘•¸ ¤ì(€€€ô(€€€…Ý…¥Ð•áÁ•Ð¡Á…”¹•Ñ	åI½±” ‰‰ÕÑÑ½¸ˆ°ì¹…µ”è€½IM=1YQUI8¼ô¤¤¹Ñ½	•¹…‰±• ¤ì(€€€½¹ÍÐÉ•…À€ô½µµ…¹¹±½…Ñ½È ˆ¹Á±…¹¹¥¹œµÉ•…Àˆ¤ì(€€€…Ý…¥Ð•áÁ•Ð¡É•…À¤¹¹½Ð¹Ñ½!…Ù•ÑÑÉ¥‰ÕÑ” ‰½Á•¸ˆ°€ˆˆ¤ì(€€€…Ý…¥ÐÉ•…À¹±½…Ñ½È ‰ÍÕµµ…Éäˆ¤¹±¥¬ ¤ì(€€€…Ý…¥Ð•áÁ•Ð¡É•…À¹•Ñ	åQ•ÍÑ% ‰Á±…¹¹¥¹œµÉ•…Àµ½¹Ñ•¹Ðˆ¤¤¹Ñ½	•Y¥Í¥‰±” ¤ì(€€€…Ý…¥ÐÉ•…À¹±½…Ñ½È ‰ÍÕµµ…Éäˆ¤¹±¥¬ ¤ì(€€€…Ý…¥Ð•áÁ•Ð¡½µµ…¹¤¹Ñ½	•Y¥Í¥‰±” ¤ì(€€€…Ý…¥Ð•áÁ•ÑY¥•ÝÁ½ÉÑ	½Õ¹‘½Õµ•¹Ð¡Á…”¤ì(€ô)ô¤ì()Ñ•ÍÐ ‰‰•±½Üµ¡½É¥é½¸‘¥É•Ñ¥½¸¥Ì¥¹Ñ•É…Ñ•¥¹Ñ¼½¹”Ñ½±•…‰±”•±•ÍÑ¥…°ÍÕÉ™…”ˆ°…Íå¹Œ€¡ìÁ…”ô°Ñ•ÍÑ%¹™¼¤€ôøì(€‘•Í­Ñ½Á=¹±ä¡Ñ•ÍÑ%¹™¼¹ÁÉ½©•Ð¹¹…µ”¤ì((€™½È€¡½¹ÍÐÙ¥•ÝÁ½ÉÐ½˜mìÝ¥‘Ñ è€ÈÀÐà°¡•¥¡Ðè€ÄÀàäô°ÍÉ••¹Í¡½ÑY¥•ÝÁ½ÉÑÌ¹‘•Í­Ñ½À°ÍÉ••¹Í¡½ÑY¥•ÝÁ½ÉÑÌ¹Á½ÉÑÉ…¥Ð°ìÝ¥‘Ñ è€ÌÈÀ°¡•¥¡Ðè€àÀÀõt¤ì(€€€…Ý…¥ÐÁ…”¹Í•ÑY¥•ÝÁ½ÉÑM¥é”¡Ù¥•ÝÁ½ÉÐ¤ì(€€€…Ý…¥Ð½Á•¹M•ÍÍ¥½¸¡Á…”¤ì(€€€¥˜€¡Ù¥•ÝÁ½ÉÐ¹Ý¥‘Ñ €ðô€ÜØÀ¤…Ý…¥Ð¡½½Í•5½‰¥±•Y¥•Ü¡Á…”°€‰Y%MU1%iQ%=8ˆ¤ì(€€€…Ý…¥ÐÁ…”¹•Ñ	åI½±” ‰‰ÕÑÑ½¸ˆ°ì¹…µ”è€‰¹¥¡Ðˆ°•á…ÐèÑÉÕ”ô¤¹±¥¬ ¤ì(€€€½¹ÍÐÉ•…‘½ÕÐ€ôÁ…”¹±½…Ñ½È ˆ¹Í­äµÉ•…‘½ÕÐˆ¤ì(€€€…Ý…¥Ð•áÁ•Ð¡É•…‘½ÕÐ¤¹Ñ½!…Ù•ÑÑÉ¥‰ÕÑ” ‰‘…Ñ„µ•áÁ…¹‘•ˆ°€‰™…±Í”ˆ¤ì(€€€…Ý…¥Ð•áÁ•Ð¡Á…”¹±½…Ñ½È ˆÍ­äµÉ•…‘½ÕÐµ‘•Ñ…¥±Ìˆ¤¤¹Ñ½!…Ù•½Õ¹Ð À¤ì(€€€…Ý…¥Ð•áÁ•Ð¡Á…”¹±½…Ñ½È ˆ¹¡½É¥é½¸µ¹½Ñ¥”ˆ¤¤¹Ñ½!…Ù•½Õ¹Ð À¤ì(€€€½¹ÍÐµ½½¹I•…ÁQ½±”€ôÁ…”¹•Ñ	åI½±” ‰‰ÕÑÑ½¸ˆ°ì¹…µ”è€‰M¡½Ü5½½¸Á½Í¥Ñ¥½¸É•…Àˆô¤ì(€€€…Ý…¥Ðµ½½¹I•…ÁQ½±”¹ÁÉ•ÍÌ ‰¹Ñ•Èˆ¤ì(€€€…Ý…¥Ð•áÁ•Ð¡É•…‘½ÕÐ¤¹Ñ½!…Ù•ÑÑÉ¥‰ÕÑ” ‰‘…Ñ„µ•áÁ…¹‘•ˆ°€‰ÑÉÕ”ˆ¤ì(€€€…Ý…¥Ð•áÁ•Ð¡Á…”¹±½…Ñ½È ˆÍ­äµÉ•…‘½ÕÐµ‘•Ñ…¥±Ìˆ¤¤¹Ñ½	•Y¥Í¥‰±” ¤ì(€€€…Ý…¥Ð•áÁ•Ð¡Á…”¹±½…Ñ½È ˆ¹Í­äµ‘¥É•Ñ¥½¸ˆ¤¤¹Ñ½½¹Ñ…¥¹Q•áÐ ½QUI8€¡1QñI%!P¥ñ=8UII9P	I%9¼¤ì(€€€…Ý…¥Ð•áÁ•Ð¡Á…”¹•Ñ	åQ•áÐ ½5½½¸…±Ñ¥ÑÕ‘”€¸¨‰•±½Ü¡½É¥é½¸¼¤¤¹Ñ½	•Y¥Í¥‰±” ¤ì(€€€…Ý…¥Ð•áÁ•Ð¡Á…”¹±½…Ñ½È ˆ¹¡½É¥é½¸µ¹½Ñ¥”ˆ¤¤¹Ñ½!…Ù•½Õ¹Ð À¤ì((€€€¥˜€¡Ù¥•ÝÁ½ÉÐ¹Ý¥‘Ñ €ðô€ÜØÀ¤ì(€€€€€½¹ÍÐÉ•ÑÌ€ô…Ý…¥Ð±…å½ÕÑI•ÑÌ¡Á…”°lˆ¹Ñ…Ñ¥…°µÁ…¹•°ˆ°€ˆ¹Í­äµÉ•…‘½ÕÐµÑ½±”ˆ°€ˆ¹Í­äµÉ•…‘½ÕÐµ‘•Ñ…¥±Ì‰t¤ì(€€€€€½¹ÍÐÑ…Ñ¥…°€ôÉ•ÑÍlˆ¹Ñ…Ñ¥…°µÁ…¹•°‰tì(€€€€€•áÁ•Ñ½¹Ñ…¥¹•¡É•ÑÍlˆ¹Í­äµÉ•…‘½ÕÐµÑ½±”‰t°Ñ…Ñ¥…°°•±•ÍÑ¥…°ÑÉ¥•È…Ð€‘íÙ¥•ÝÁ½ÉÐ¹Ý¥‘Ñ¡ôÁ¥á•±Í€¤ì(€€€€€•áÁ•Ñ½¹Ñ…¥¹•¡É•ÑÍlˆ¹Í­äµÉ•…‘½ÕÐµ‘•Ñ…¥±Ì‰t°Ñ…Ñ¥…°°•±•ÍÑ¥…°‘•Ñ…¥±Ì…Ð€‘íÙ¥•ÝÁ½ÉÐ¹Ý¥‘Ñ¡ôÁ¥á•±Í€¤ì(€€€€€•áÁ•Ñ9½%¹Ñ•ÉÍ•Ñ¥½¸¡É•ÑÍlˆ¹Í­äµÉ•…‘½ÕÐµÑ½±”‰t°É•ÑÍlˆ¹Í­äµÉ•…‘½ÕÐµ‘•Ñ…¥±Ì‰t°€‰•±•ÍÑ¥…°ÑÉ¥•È…¹‘•Ñ…¥±Ì…Éˆ¤ì(€€€€€…Ý…¥Ð•áÁ•Ð¡Á…”¹±½…Ñ½È ˆ¹‘•ÁÑ µ½¹ÑÉ½°ˆ¤¤¹Ñ½	•!¥‘‘•¸ ¤ì(€€€ô•±Í”ì(€€€€€½¹ÍÐÉ•ÑÌ€ô…Ý…¥Ð±…å½ÕÑI•ÑÌ¡Á…”°lˆ¹Ñ…Ñ¥…°µÁ…¹•°ˆ°€ˆ¹‘•ÁÑ µ½¹ÑÉ½°ˆ°€ˆ¹Í­äµÉ•…‘½ÕÐ‰t¤ì(€€€€€½¹ÍÐÑ…Ñ¥…°€ôÉ•ÑÍlˆ¹Ñ…Ñ¥…°µÁ…¹•°‰tì(€€€€€•áÁ•Ñ½¹Ñ…¥¹•¡É•ÑÍlˆ¹Í­äµÉ•…‘½ÕÐ‰t°Ñ…Ñ¥…°°•±•ÍÑ¥…°ÍÕÉ™…”…Ð€‘íÙ¥•ÝÁ½ÉÐ¹Ý¥‘Ñ¡ôÁ¥á•±Í€¤ì(€€€€€•áÁ•Ñ9½%¹Ñ•ÉÍ•Ñ¥½¸¡É•ÑÍlˆ¹‘•ÁÑ µ½¹ÑÉ½°‰t°É•ÑÍlˆ¹Í­äµÉ•…‘½ÕÐ‰t°€‰Ù¥•ÜÍ•±•Ñ½È…¹½Á•¹••±•ÍÑ¥…°ÍÕÉ™…”ˆ¤ì(€€€ô(€€€•áÁ•Ð¡…Ý…¥ÐÁ…”¹±½…Ñ½È ˆ¹Í­äµÉ•…‘½ÕÐˆ¤¹½Õ¹Ð ¤¤¹Ñ½	” Ä¤ì(€€€½¹ÍÐÁ…•Q•áÐ€ô…Ý…¥ÐÁ…”¹±½…Ñ½È ‰‰½‘äˆ¤¹¥¹¹•ÉQ•áÐ ¤ì(€€€™½È€¡½¹ÍÐÉ•µ½Ù•½˜l‰Íå¹Ñ¡•Ñ¥Œ¡½É¥é½¸ˆ°€‰™¥á•Í•¹…É¥¼Í­äˆ°€‰¹¼±½…Ñ¥½¸…•ÍÌˆ°€‰™¥Ñ¥½¹…°±½…°Ñ¥µ”ˆ°€‰™¥Ñ¥½¹…°½‰Í•ÉÙ•È‰t¤ì(€€€€€•áÁ•Ð¡Á…•Q•áÐ¹Ñ½1½Ý•É…Í” ¤¤¹¹½Ð¹Ñ½½¹Ñ…¥¸¡É•µ½Ù•¤ì(€€€ô((€€€…Ý…¥ÐÁ…”¹•Ñ	åI½±” ‰‰ÕÑÑ½¸ˆ°ì¹…µ”è€‰±½Í”5½½¸Á½Í¥Ñ¥½¸É•…Àˆô¤¹ÁÉ•ÍÌ ‰¹Ñ•Èˆ¤ì(€€€…Ý…¥Ð•áÁ•Ð¡Á…”¹±½…Ñ½È ˆÍ­äµÉ•…‘½ÕÐµ‘•Ñ…¥±Ìˆ¤¤¹Ñ½!…Ù•½Õ¹Ð À¤ì(€€€…Ý…¥Ð•áÁ•Ð¡Á…”¹•Ñ	åI½±” ‰‰ÕÑÑ½¸ˆ°ì¹…µ”è€‰M¡½Ü5½½¸Á½Í¥Ñ¥½¸É•…Àˆô¤¤¹Ñ½	•½ÕÍ• ¤ì(€€€…Ý…¥Ð•áÁ•ÑY¥•ÝÁ½ÉÑ	½Õ¹‘½Õµ•¹Ð¡Á…”¤ì(€ô)ô¤ì()Ñ•ÍÐ ‰½Á•¸Í½Õ¹Í•ÑÑ¥¹ÌÁ…¥¹Ð…‰½Ù”Ñ¡”…µ”ÍÕÉ™…”…¹É•µ…¥¸¥¹Í¥‘”Ñ¡”Ù¥•ÝÁ½ÉÐˆ°…Íå¹Œ€¡ìÁ…”ô°Ñ•ÍÑ%¹™¼¤€ôøì(€‘•Í­Ñ½Á=¹±ä¡Ñ•ÍÑ%¹™¼¹ÁÉ½©•Ð¹¹…µ”¤ì(€…Ý…¥ÐÁ…”¹Í•ÑY¥•ÝÁ½ÉÑM¥é”¡ÍÉ••¹Í¡½ÑY¥•ÝÁ½ÉÑÌ¹‘•Í­Ñ½À¤ì(€…Ý…¥Ð½Á•¹M•ÍÍ¥½¸¡Á…”¤ì(€½¹ÍÐ‘¥É•ÑM½Õ¹‘M•ÑÑ¥¹Ì€ôÁ…”¹±½…Ñ½È ˆ¹Í½Õ¹µÍ•ÑÑ¥¹Ì€øÍÕµµ…Éäˆ¤ì(€¥˜€¡…Ý…¥Ð‘¥É•ÑM½Õ¹‘M•ÑÑ¥¹Ì¹¥ÍY¥Í¥‰±” ¤¤ì(€€€…Ý…¥Ð‘¥É•ÑM½Õ¹‘M•ÑÑ¥¹Ì¹±¥¬ ¤ì(€ô•±Í”ì(€€€…Ý…¥ÐÁ…”¹±½…Ñ½È ˆ¹±½‰…°µÑ½½±Ìµµ•¹Ô€øÍÕµµ…Éäˆ¤¹±¥¬ ¤ì(€€€…Ý…¥ÐÁ…”¹•Ñ	åI½±” ‰‰ÕÑÑ½¸ˆ°ì¹…µ”è€‰M=U9MQQ%9Lˆ°•á…ÐèÑÉÕ”ô¤¹±¥¬ ¤ì(€ô(€…Ý…¥Ð•áÁ•Ð¡Á…”¹±½…Ñ½È ˆ¹Í½Õ¹µÍ•ÑÑ¥¹Ì€øÍ•Ñ¥½¸ˆ¤¤¹Ñ½	•Y¥Í¥‰±” ¤ì((€½¹ÍÐÍÑ…Ñ”€ô…Ý…¥ÐÁ…”¹•Ù…±Õ…Ñ”  ¤€ôøì(€€€½¹ÍÐÁ…¹•°€ô‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½Èñ!Q51±•µ•¹Ðø ˆ¹Í½Õ¹µÍ•ÑÑ¥¹Ì€øÍ•Ñ¥½¸ˆ¤„ì(€€€½¹ÍÐÑ½Á‰…È€ô‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½Èñ!Q51±•µ•¹Ðø ˆ¹Ñ½Á‰…Èˆ¤„ì(€€€½¹ÍÐÉ•Ð€ôÁ…¹•°¹•Ñ	½Õ¹‘¥¹±¥•¹ÑI•Ð ¤ì(€€€½¹ÍÐÍ…µÁ±•`€ô5…Ñ ¹µ¥¸¡É•Ð¹É¥¡Ð€´€Ð°5…Ñ ¹µ…à¡É•Ð¹±•™Ð€¬€Ð°É•Ð¹±•™Ð€¬É•Ð¹Ý¥‘Ñ €¼€È¤¤ì(€€€½¹ÍÐÍ…µÁ±•d€ô5…Ñ ¹µ¥¸¡É•Ð¹‰½ÑÑ½´€´€Ð°É•Ð¹Ñ½À€¬€Ð¤ì(€€€½¹ÍÐÑ½Áµ½ÍÐ€ô‘½Õµ•¹Ð¹•±•µ•¹ÑÉ½µA½¥¹Ð¡Í…µÁ±•`°Í…µÁ±•d¤ì(€€€É•ÑÕÉ¸ì(€€€€€Á…¹•°èìÑ½ÀèÉ•Ð¹Ñ½À°É¥¡ÐèÉ•Ð¹É¥¡Ð°‰½ÑÑ½´èÉ•Ð¹‰½ÑÑ½´°±•™ÐèÉ•Ð¹±•™Ð°Ý¥‘Ñ èÉ•Ð¹Ý¥‘Ñ °¡•¥¡ÐèÉ•Ð¹¡•¥¡Ðô°(€€€€€Ñ½Á‰…Éhè9Õµ‰•È¹Á…ÉÍ•%¹Ð¡•Ñ½µÁÕÑ•‘MÑå±”¡Ñ½Á‰…È¤¹é%¹‘•à°€ÄÀ¤°(€€€€€Ñ½Áµ½ÍÑ	•±½¹ÍQ½A…¹•°è	½½±•…¸¡Ñ½Áµ½ÍÐ€˜˜Á…¹•°¹½¹Ñ…¥¹Ì¡Ñ½Áµ½ÍÐ¤¤°(€€€€€Ù¥•ÝÁ½ÉÐèìÝ¥‘Ñ è¥¹¹•É]¥‘Ñ °¡•¥¡Ðè¥¹¹•É!•¥¡Ðô°(€€€ôì(€ô¤ì((€•áÁ•Ð¡ÍÑ…Ñ”¹Á…¹•°¹±•™Ð¤¹Ñ½	•É•…Ñ•ÉQ¡…¹=ÉÅÕ…° À¤ì(€•áÁ•Ð¡ÍÑ…Ñ”¹Á…¹•°¹Ñ½À¤¹Ñ½	•É•…Ñ•ÉQ¡…¹=ÉÅÕ…° À¤ì(€•áÁ•Ð¡ÍÑ…Ñ”¹Á…¹•°¹É¥¡Ð¤¹Ñ½	•1•ÍÍQ¡…¹=ÉÅÕ…°¡ÍÑ…Ñ”¹Ù¥•ÝÁ½ÉÐ¹Ý¥‘Ñ ¤ì(€•áÁ•Ð¡ÍÑ…Ñ”¹Á…¹•°¹‰½ÑÑ½´¤¹Ñ½	•1•ÍÍQ¡…¹=ÉÅÕ…°¡ÍÑ…Ñ”¹Ù¥•ÝÁ½ÉÐ¹¡•¥¡Ð¤ì(€•áÁ•Ð¡ÍÑ…Ñ”¹Ñ½Á‰…Éh¤¹Ñ½	•É•…Ñ•ÉQ¡…¸ À¤ì(€•áÁ•Ð¡ÍÑ…Ñ”¹Ñ½Áµ½ÍÑ	•±½¹ÍQ½A…¹•°°€‰Ñ¡”½Á•¸Í½Õ¹Á…¹•°µÕÍÐÁ…¥¹Ð…‰½Ù”Ñ¡”…µ”ÍÕÉ™…”ˆ¤¹Ñ½	”¡ÑÉÕ”¤ì)ô¤ì()Ñ•ÍÐ ‰É•ÁÉ•Í•¹Ñ…Ñ¥Ù”±¥¡Ð…¹‘…É¬Ñ•áÐ°½¹ÑÉ½°°…¹™½ÕÌÙ…É¥…‰±•Ìµ••Ð½¹ÑÉ…ÍÐÑ¡É•Í¡½±‘Ìˆ°…Íå¹Œ€¡ìÁ…”ô°Ñ•ÍÑ%¹™¼¤€ôøì(€‘•Í­Ñ½Á=¹±ä¡Ñ•ÍÑ%¹™¼¹ÁÉ½©•Ð¹¹…µ”¤ì(€…Ý…¥Ð½Á•¹M•ÍÍ¥½¸¡Á…”¤ì((€½¹ÍÐµ•…ÍÕÉ”€ô€ ¤€ôøÁ…”¹•Ù…±Õ…Ñ”  ¤€ôøì(€€€½¹ÍÐ…ÁÀ€ô‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½Èñ!Q51±•µ•¹Ðø ˆ¹…ÁÀˆ¤„ì(€€€½¹ÍÐÍÑå±”€ô•Ñ½µÁÕÑ•‘MÑå±”¡…ÁÀ¤ì(€€€½¹ÍÐÉ•Í½±Ù”€ô€¡¹…µ”èÍÑÉ¥¹œ¤€ôøì(€€€€€½¹ÍÐÁÉ½‰”€ô‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð ‰ÍÁ…¸ˆ¤ì(€€€€€ÁÉ½‰”¹ÍÑå±”¹½±½È€ôÍÑå±”¹•ÑAÉ½Á•ÉÑåY…±Õ”¡¹…µ”¤¹ÑÉ¥´ ¤ì(€€€€€…ÁÀ¹…ÁÁ•¹‘¡¥±¡ÁÉ½‰”¤ì(€€€€€½¹ÍÐ½±½È€ô•Ñ½µÁÕÑ•‘MÑå±”¡ÁÉ½‰”¤¹½±½Èì(€€€€€ÁÉ½‰”¹É•µ½Ù” ¤ì(€€€€€½¹ÍÐÙ…±Õ•Ì€ô½±½È¹µ…Ñ  ½mq¹t¬½œ¤ü¹Í±¥” À°€Ì¤¹µ…À¡9Õµ‰•È¤ì(€€€€€¥˜€ …Ù…±Õ•ÌñðÙ…±Õ•Ì¹±•¹Ñ €„ôô€Ì¤Ñ¡É½Ü¹•ÜÉÉ½È¡½Õ±¹½ÐÉ•Í½±Ù”€‘í¹…µ•ôè€‘í½±½Éõ€¤ì(€€€€€É•ÑÕÉ¸Ù…±Õ•Ì…Ìm¹Õµ‰•È°¹Õµ‰•È°¹Õµ‰•Étì(€€€ôì(€€€½¹ÍÐ±Õµ¥¹…¹”€ô€¡mÉ•°É••¸°‰±Õ•tèm¹Õµ‰•È°¹Õµ‰•È°¹Õµ‰•Ét¤€ôøì(€€€€€½¹ÍÐ¡…¹¹•°€ô€¡Ù…±Õ”è¹Õµ‰•È¤€ôøì(€€€€€€€½¹ÍÐ¹½Éµ…±¥é•€ôÙ…±Õ”€¼€ÈÔÔì(€€€€€€€É•ÑÕÉ¸¹½Éµ…±¥é•€ðô€À¸ÀÐÀÐÔ€ü¹½Éµ…±¥é•€¼€ÄÈ¸äÈ€è€ ¡¹½Éµ…±¥é•€¬€À¸ÀÔÔ¤€¼€Ä¸ÀÔÔ¤€¨¨€È¸Ðì(€€€€€ôì(€€€€€É•ÑÕÉ¸€À¸ÈÄÈØ€¨¡…¹¹•°¡É•¤€¬€À¸ÜÄÔÈ€¨¡…¹¹•°¡É••¸¤€¬€À¸ÀÜÈÈ€¨¡…¹¹•°¡‰±Õ”¤ì(€€€ôì(€€€½¹ÍÐÉ…Ñ¥¼€ô€¡±•™Ðèm¹Õµ‰•È°¹Õµ‰•È°¹Õµ‰•Ét°É¥¡Ðèm¹Õµ‰•È°¹Õµ‰•È°¹Õµ‰•Ét¤€ôøì(€€€€€½¹ÍÐ±¥¡Ñ•È€ô5…Ñ ¹µ…à¡±Õµ¥¹…¹”¡±•™Ð¤°±Õµ¥¹…¹”¡É¥¡Ð¤¤ì(€€€€€½¹ÍÐ‘…É­•È€ô5…Ñ ¹µ¥¸¡±Õµ¥¹…¹”¡±•™Ð¤°±Õµ¥¹…¹”¡É¥¡Ð¤¤ì(€€€€€É•ÑÕÉ¸€¡±¥¡Ñ•È€¬€À¸ÀÔ¤€¼€¡‘…É­•È€¬€À¸ÀÔ¤ì(€€€ôì(€€€½¹ÍÐ½±½ÉÌ€ôì(€€€€€‰œèÉ•Í½±Ù” ˆ´µ‰œˆ¤°(€€€€€Á…¹•°èÉ•Í½±Ù” ˆ´µÁ…¹•°ˆ¤°(€€€€€É…¥Í•èÉ•Í½±Ù” ˆ´µÉ…¥Í•ˆ¤°(€€€€€Ñ•áÐèÉ•Í½±Ù” ˆ´µÑ•áÐˆ¤°(€€€€€µÕÑ•èÉ•Í½±Ù” ˆ´µµÕÑ•ˆ¤°(€€€€€…•¹ÐèÉ•Í½±Ù” ˆ´µ…•¹Ðˆ¤°(€€€€€…•¹ÑMÑÉ½¹œèÉ•Í½±Ù” ˆ´µ…•¹ÐµÍÑÉ½¹œˆ¤°(€€€€€…•¹Ñ%¹¬èÉ•Í½±Ù” ˆ´µ…•¹Ðµ¥¹¬ˆ¤°(€€€ôì(€€€É•ÑÕÉ¸ì(€€€€€Ñ¡•µ”è…ÁÀ¹±…ÍÍ1¥ÍÐ¹½¹Ñ…¥¹Ì ‰Ñ¡•µ”µ±¥¡Ðˆ¤€ü€‰±¥¡Ðˆ€è€‰‘…É¬ˆ°(€€€€€Ñ•áÑ=¹A…¹•°èÉ…Ñ¥¼¡½±½ÉÌ¹Ñ•áÐ°½±½ÉÌ¹Á…¹•°¤°(€€€€€µÕÑ•‘=¹A…¹•°èÉ…Ñ¥¼¡½±½ÉÌ¹µÕÑ•°½±½ÉÌ¹Á…¹•°¤°(€€€€€½¹ÑÉ½±%¹­=¹•¹ÐèÉ…Ñ¥¼¡½±½ÉÌ¹…•¹Ñ%¹¬°½±½ÉÌ¹…•¹Ð¤°(€€€€€™½ÕÍ=¹	œèÉ…Ñ¥¼¡½±½ÉÌ¹…•¹ÑMÑÉ½¹œ°½±½ÉÌ¹‰œ¤°(€€€€€™½ÕÍ=¹A…¹•°èÉ…Ñ¥¼¡½±½ÉÌ¹…•¹ÑMÑÉ½¹œ°½±½ÉÌ¹Á…¹•°¤°(€€€€€™½ÕÍ=¹I…¥Í•èÉ…Ñ¥¼¡½±½ÉÌ¹…•¹ÑMÑÉ½¹œ°½±½ÉÌ¹É…¥Í•¤°(€€€ôì(€ô¤ì((€½¹ÍÐ‘…É¬€ô…Ý…¥Ðµ•…ÍÕÉ” ¤ì(€…Ý…¥ÐÁ…”¹•Ñ	åI½±” ‰‰ÕÑÑ½¸ˆ°ì¹…µ”è€‰MÝ¥Ñ Ñ¼±¥¡Ð¥¹Ñ•É™…”ˆô¤¹±¥¬ ¤ì(€½¹ÍÐ±¥¡Ð€ô…Ý…¥Ðµ•…ÍÕÉ” ¤ì(€…Ý…¥ÐÑ•ÍÑ%¹™¼¹…ÑÑ…  ‰Ñ¡•µ”µ½¹ÑÉ…ÍÐµµ•ÑÉ¥Ì¹©Í½¸ˆ°ì(€€€‰½‘äè)M=8¹ÍÑÉ¥¹¥™ä¡ì‘…É¬°±¥¡Ðô°¹Õ±°°€È¤°(€€€½¹Ñ•¹ÑQåÁ”è€‰…ÁÁ±¥…Ñ¥½¸½©Í½¸ˆ°(€ô¤ì((€•áÁ•Ð¡‘…É¬¹Ñ¡•µ”¤¹Ñ½	” ‰‘…É¬ˆ¤ì(€•áÁ•Ð¡±¥¡Ð¹Ñ¡•µ”¤¹Ñ½	” ‰±¥¡Ðˆ¤ì(€™½È€¡½¹ÍÐÉ•ÍÕ±Ð½˜m‘…É¬°±¥¡Ñt¤ì(€€€•áÁ•Ð¡É•ÍÕ±Ð¹Ñ•áÑ=¹A…¹•°°€‘íÉ•ÍÕ±Ð¹Ñ¡•µ•ôÁÉ¥µ…ÉäÑ•áÑ€¤¹Ñ½	•É•…Ñ•ÉQ¡…¹=ÉÅÕ…° Ð¸Ô¤ì(€€€•áÁ•Ð¡É•ÍÕ±Ð¹µÕÑ•‘=¹A…¹•°°€‘íÉ•ÍÕ±Ð¹Ñ¡•µ•ôÍ•½¹‘…ÉäÑ•áÑ€¤¹Ñ½	•É•…Ñ•ÉQ¡…¹=ÉÅÕ…° Ð¸Ô¤ì(€€€•áÁ•Ð¡É•ÍÕ±Ð¹½¹ÑÉ½±%¹­=¹•¹Ð°€‘íÉ•ÍÕ±Ð¹Ñ¡•µ•ôÁÉ¥µ…Éä½¹ÑÉ½±€¤¹Ñ½	•É•…Ñ•ÉQ¡…¹=ÉÅÕ…° Ð¸Ô¤ì(€€€•áÁ•Ð¡É•ÍÕ±Ð¹™½ÕÍ=¹	œ°€‘íÉ•ÍÕ±Ð¹Ñ¡•µ•ô™½ÕÌ……¥¹ÍÐ‰…­É½Õ¹‘€¤¹Ñ½	•É•…Ñ•ÉQ¡…¹=ÉÅÕ…° Ì¤ì(€€€•áÁ•Ð¡É•ÍÕ±Ð¹™½ÕÍ=¹A…¹•°°€‘íÉ•ÍÕ±Ð¹Ñ¡•µ•ô™½ÕÌ……¥¹ÍÐÁ…¹•±€¤¹Ñ½	•É•…Ñ•ÉQ¡…¹=ÉÅÕ…° Ì¤ì(€€€•áÁ•Ð¡É•ÍÕ±Ð¹™½ÕÍ=¹I…¥Í•°€‘íÉ•ÍÕ±Ð¹Ñ¡•µ•ô™½ÕÌ……¥¹ÍÐÉ…¥Í•½¹ÑÉ½°ÍÕÉ™…•Í€¤¹Ñ½	•É•…Ñ•ÉQ¡…¹=ÉÅÕ…° Ì¤ì(€ô)ô¤ì(