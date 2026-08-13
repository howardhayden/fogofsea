import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

type Rect = { top: number; right: number; bottom: number; left: number; width: number; height: number };

const responsiveViewports = [
  { width: 320, height: 800 },
  { width: 360, height: 800 },
  { width: 400, height: 800 },
  { width: 567, height: 803 },
  // A 1,280 × 900 browser at 200% zoom exposes an effective 640 × 450 CSS
  // viewport. Testing the effective viewport is honest reflow evidence; it
  // does not pretend that changing the root font size emulates browser zoom.
  { width: 640, height: 450, label: "200%-zoom-equivalent" },
  { width: 761, height: 545 },
  { width: 919, height: 545 },
  { width: 1024, height: 545 },
  { width: 1120, height: 630 },
  { width: 2048, height: 1090 },
] as const;

const representativeLifecycleCases = [
  { width: 320, height: 800, theme: "dark", label: "320x800" },
  { width: 640, height: 450, theme: "light", label: "200%-zoom-equivalent" },
  { width: 1024, height: 545, theme: "dark", label: "1024x545" },
] as const;

const intendedContainerSelector = [
  "button",
  "summary",
  "label",
  ".brand",
  ".save-indicator",
  ".mobile-gamebar > div",
  ".mobile-disclosure",
  ".conditions-grid > div",
  ".decision-steps > li",
  ".planning-recap-content > section",
  ".time-control",
  ".legend",
  ".plot-data-readout",
  ".depth-control",
  ".sky-readout",
  ".environment-readout",
  ".kriegsspiel-row",
  ".kriegsspiel-panel",
  ".result-card",
  ".force-status",
  ".mission-panel",
  ".force-panel",
  ".topbar",
  "[role='dialog']",
].join(",");

async function openSession(page: Page) {
  await page.goto("/");
  const privacyDialog = page.getByRole("dialog", { name: "HOW SHOULD THIS GAME REMEMBER YOU?" });
  await expect(privacyDialog).toBeVisible();
  await page.getByRole("button", { name: "PLAY WITHOUT BROWSER SAVING" }).click();
  await expect(privacyDialog).toBeHidden();
  await expect(page.locator(".workspace")).toBeVisible();
}

async function setInterfaceTheme(page: Page, theme: "dark" | "light") {
  const current = await page.locator(".app").evaluate((element) => element.classList.contains("theme-light") ? "light" : "dark");
  if (current !== theme) await page.getByRole("button", { name: `Switch to ${theme} interface` }).click();
  await expect(page.locator(".app")).toHaveClass(new RegExp(`theme-${theme}`));
}

async function chooseCompactView(page: Page, name: string) {
  const disclosure = page.locator(".mobile-disclosure");
  if (!await disclosure.isVisible()) return;
  await disclosure.locator("summary").click();
  await disclosure.getByRole("button", { name, exact: true }).click();
}

async function settleLayout(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
}

async function auditVisibleText(page: Page, scopeSelector = ".game-shell") {
  await settleLayout(page);
  return page.evaluate(({ containerSelector, tolerance, scopeSelector }) => {
    type LocalViolation = {
      container: string;
      text: string;
      edge: "left" | "right" | "top" | "bottom";
      difference: number;
    };

    const visibleElement = (element: HTMLElement) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const assistiveOnlyClip = rect.width <= 1
        && rect.height <= 1
        && (style.clip !== "auto" || style.clipPath !== "none")
        && (style.overflow === "hidden" || style.overflow === "clip");
      return style.display !== "none"
        && style.visibility !== "hidden"
        && Number.parseFloat(style.opacity || "1") > 0
        && !assistiveOnlyClip
        && rect.width > 0
        && rect.height > 0;
    };
    const describe = (element: HTMLElement) => {
      if (element.id) return `#${element.id}`;
      const classes = [...element.classList].slice(0, 3).join(".");
      return `${element.tagName.toLowerCase()}${classes ? `.${classes}` : ""}`;
    };
    const viewport = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
    const violations: LocalViolation[] = [];
    let checkedLines = 0;
    const scope = document.querySelector(scopeSelector);
    if (!scope) throw new Error(`Missing text-audit scope: ${scopeSelector}`);
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);

    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const text = node.data.replace(/\s+/g, " ").trim();
      const parent = node.parentElement;
      if (!text || !parent || !visibleElement(parent)) continue;
      if (parent.closest("script, style, option, .visually-hidden, [aria-hidden='true']")) continue;
      const closedDetails = parent.closest("details:not([open])");
      if (closedDetails && !closedDetails.querySelector(":scope > summary")?.contains(parent)) continue;
      const container = parent.closest<HTMLElement>(containerSelector);
      if (!container || !visibleElement(container)) continue;

      const range = document.createRange();
      range.selectNodeContents(node);
      const containerRect = container.getBoundingClientRect();
      const strictVertical = container.matches([
        "button",
        "summary",
        ".brand",
        ".save-indicator",
        ".mobile-gamebar > div",
        ".conditions-grid > div",
        ".time-control",
        ".legend",
        ".plot-data-readout",
        ".depth-control",
        ".sky-readout",
        ".environment-readout",
        ".kriegsspiel-row",
        ".force-status",
      ].join(","));

      // A deliberately ellipsized label is visually bounded by its nearest
      // overflow clip. Compare the rendered clip, not the unpainted remainder
      // of the DOM range. Prose surfaces are never granted this exception.
      let clippingAncestor: HTMLElement | null = parent;
      while (clippingAncestor && clippingAncestor !== container.parentElement) {
        const style = getComputedStyle(clippingAncestor);
        if ((style.overflowX === "hidden" || style.overflowX === "clip") && style.textOverflow === "ellipsis") break;
        if (clippingAncestor === container) {
          clippingAncestor = null;
          break;
        }
        clippingAncestor = clippingAncestor.parentElement;
      }

      // Scrollable disclosure cards deliberately retain more copy than their
      // compact mobile viewport paints at once. Audit the painted intersection
      // with that scrollport; off-scroll text is reachable, but is not visible
      // overflow and must not be attributed to the transparent wrapper.
      let scrollingAncestor: HTMLElement | null = parent;
      while (scrollingAncestor && scrollingAncestor !== container.parentElement) {
        const style = getComputedStyle(scrollingAncestor);
        const clipsX = ["auto", "scroll", "hidden", "clip"].includes(style.overflowX)
          && scrollingAncestor.scrollWidth > scrollingAncestor.clientWidth + 1;
        const clipsY = ["auto", "scroll", "hidden", "clip"].includes(style.overflowY)
          && scrollingAncestor.scrollHeight > scrollingAncestor.clientHeight + 1;
        if (clipsX || clipsY) break;
        if (scrollingAncestor === container) {
          scrollingAncestor = null;
          break;
        }
        scrollingAncestor = scrollingAncestor.parentElement;
      }

      for (const rawRect of range.getClientRects()) {
        if (rawRect.width <= 0 || rawRect.height <= 0) continue;
        if (rawRect.right <= viewport.left || rawRect.left >= viewport.right || rawRect.bottom <= viewport.top || rawRect.top >= viewport.bottom) continue;
        const scrollport = scrollingAncestor?.getBoundingClientRect();
        if (scrollport && (rawRect.right <= scrollport.left || rawRect.left >= scrollport.right || rawRect.bottom <= scrollport.top || rawRect.top >= scrollport.bottom)) continue;
        const rect = clippingAncestor
          ? clippingAncestor.getBoundingClientRect()
          : scrollport
            ? {
              left: Math.max(rawRect.left, scrollport.left),
              right: Math.min(rawRect.right, scrollport.right),
              top: Math.max(rawRect.top, scrollport.top),
              bottom: Math.min(rawRect.bottom, scrollport.bottom),
            }
            : rawRect;
        checkedLines += 1;
        const differences = {
          left: containerRect.left - rect.left,
          right: rect.right - containerRect.right,
          top: containerRect.top - rect.top,
          bottom: rect.bottom - containerRect.bottom,
        };
        for (const edge of ["left", "right"] as const) {
          if (differences[edge] > tolerance) violations.push({ container: describe(container), text: text.slice(0, 90), edge, difference: differences[edge] });
        }
        if (strictVertical) {
          for (const edge of ["top", "bottom"] as const) {
            if (differences[edge] > tolerance) violations.push({ container: describe(container), text: text.slice(0, 90), edge, difference: differences[edge] });
          }
        }
      }
    }

    return {
      checkedLines,
      violations,
      viewport: { width: innerWidth, height: innerHeight },
      document: { width: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth },
    };
  }, { containerSelector: intendedContainerSelector, tolerance: 1, scopeSelector });
}

async function recordAudit(page: Page, testInfo: TestInfo, state: string, evidence: unknown[]) {
  const audit = await auditVisibleText(page);
  evidence.push({ state, ...audit });
  expect(audit.checkedLines, `${state} should inspect rendered text lines`).toBeGreaterThan(20);
  expect(audit.document.width, `${state} document width`).toBeLessThanOrEqual(audit.viewport.width + 1);
  expect(audit.document.bodyWidth, `${state} body width`).toBeLessThanOrEqual(audit.viewport.width + 1);
  expect(audit.violations, `${state} text-range containment failures`).toEqual([]);

  await testInfo.attach(`${state.replace(/[^a-z0-9-]+/gi, "-")}.json`, {
    body: JSON.stringify({ audit }, null, 2),
    contentType: "application/json",
  });
}

async function recordTextAudit(page: Page, state: string, evidence: unknown[], scopeSelector = ".game-shell") {
  const audit = await auditVisibleText(page, scopeSelector);
  evidence.push({ state, ...audit });
  expect(audit.checkedLines, `${state} should inspect rendered text lines`).toBeGreaterThan(5);
  expect(audit.document.width, `${state} document width`).toBeLessThanOrEqual(audit.viewport.width + 1);
  expect(audit.document.bodyWidth, `${state} body width`).toBeLessThanOrEqual(audit.viewport.width + 1);
  expect(audit.violations, `${state} text-range containment failures`).toEqual([]);
}

async function expectPerceptibleGlass(surface: Locator, state: string, evidence: unknown[]) {
  const glass = await surface.evaluate((element) => {
    const style = getComputedStyle(element);
    const alphaMatch = style.backgroundColor.match(/[\d.]+(?=\))/g);
    return {
      supported: CSS.supports("backdrop-filter", "blur(1px)") || CSS.supports("-webkit-backdrop-filter", "blur(1px)"),
      backgroundAlpha: alphaMatch ? Number(alphaMatch.at(-1)) : 1,
      backgroundImage: style.backgroundImage,
      backdropFilter: style.backdropFilter || style.getPropertyValue("-webkit-backdrop-filter"),
      boxShadow: style.boxShadow,
    };
  });
  evidence.push({ state: `${state}-glass`, ...glass });
  if (!glass.supported) return;
  expect(glass.backgroundAlpha, `${state} glass retains a readable tint`).toBeGreaterThan(.35);
  expect(glass.backgroundAlpha, `${state} glass remains perceptibly translucent`).toBeLessThan(.86);
  expect(glass.backgroundImage, `${state} glass has a directional highlight`).not.toBe("none");
  expect(glass.backdropFilter, `${state} glass filters only behind its occupied box`).not.toBe("none");
  expect(glass.boxShadow, `${state} glass keeps a crisp inset rim`).toContain("inset");
}

async function expectNarrativeCopyWithoutNestedSlabs(surface: Locator, state: string, evidence: unknown[]) {
  const audit = await surface.evaluate((element) => {
    const visible = (target: Element) => {
      const style = getComputedStyle(target);
      const box = target.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
    };
    return [...element.querySelectorAll("p, li, dd")]
      .filter(visible)
      .map((target) => {
        const style = getComputedStyle(target);
        return {
          node: target.tagName.toLowerCase(),
          text: target.textContent?.replace(/\s+/g, " ").trim().slice(0, 72) ?? "",
          backgroundColor: style.backgroundColor,
          backgroundImage: style.backgroundImage,
          backdropFilter: style.backdropFilter || style.getPropertyValue("-webkit-backdrop-filter"),
        };
      });
  });
  evidence.push({ state: `${state}-narrative-paint`, audit });
  expect(audit.length, `${state} has narrative content to inspect`).toBeGreaterThan(0);
  for (const item of audit) {
    expect(["transparent", "rgba(0, 0, 0, 0)"], `${state} ${item.node} “${item.text}” background`).toContain(item.backgroundColor);
    expect(item.backgroundImage, `${state} ${item.node} “${item.text}” background image`).toBe("none");
    expect(["", "none"], `${state} ${item.node} “${item.text}” nested backdrop filter`).toContain(item.backdropFilter);
  }
}

async function auditCompactReadoutBudget(page: Page, state: string, evidence: unknown[]) {
  const viewport = page.viewportSize();
  if (!viewport || viewport.width > 760) return;
  const metrics = await page.evaluate(() => {
    const visible = (element: HTMLElement) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
    };
    const wrapper = document.querySelector<HTMLElement>(".battlefield-canvas > .plot-data-readout[open], .battlefield-canvas > .environment-readout[open], .battlefield-canvas > .legend[open], .battlefield-canvas > .sky-readout[data-expanded='true']")!;
    const panel = [...document.querySelectorAll<HTMLElement>(".plot-data-details, .sky-readout-details, .environment-readout-details, .legend-items")].find(visible)!;
    const tactical = document.querySelector<HTMLElement>(".tactical-panel")!;
    const wrapperStyle = getComputedStyle(wrapper);
    const panelBox = panel.getBoundingClientRect();
    const tacticalBox = tactical.getBoundingClientRect();
    return {
      panel: { width: panelBox.width, height: panelBox.height },
      tactical: { width: tacticalBox.width, height: tacticalBox.height },
      wrapper: {
        display: wrapperStyle.display,
        generatedBoxCount: wrapper.getClientRects().length,
        backgroundColor: wrapperStyle.backgroundColor,
        backdropFilter: wrapperStyle.backdropFilter,
        webkitBackdropFilter: wrapperStyle.getPropertyValue("-webkit-backdrop-filter"),
      },
    };
  });
  evidence.push({ state: `${state}-compact-budget`, ...metrics });
  expect(metrics.panel.height, `${state} compact readout height`).toBeLessThanOrEqual(Math.min(metrics.tactical.height * .22 + 1, 151));
  expect(metrics.panel.width, `${state} compact readout width`).toBeLessThanOrEqual(Math.min(metrics.tactical.width, 421));
  expect((metrics.panel.width * metrics.panel.height) / (metrics.tactical.width * metrics.tactical.height), `${state} compact readout area`).toBeLessThanOrEqual(.22);
  expect(metrics.wrapper.display, `${state} wrapper display`).toBe("contents");
  expect(metrics.wrapper.generatedBoxCount, `${state} wrapper paint boxes`).toBe(0);
  expect(["transparent", "rgba(0, 0, 0, 0)"], `${state} positioning wrapper background`).toContain(metrics.wrapper.backgroundColor);
  expect(["", "none"], `${state} positioning wrapper filter`).toContain(metrics.wrapper.backdropFilter);
  expect(["", "none"], `${state} prefixed positioning wrapper filter`).toContain(metrics.wrapper.webkitBackdropFilter);
}

async function auditOpenedTacticalReadouts(page: Page, state: string, evidence: unknown[]) {
  const viewMap = page.locator(".depth-control");
  if (await viewMap.isVisible()) await expectPerceptibleGlass(viewMap, `${state}-view-map`, evidence);

  for (const selector of [".plot-data-readout", ".legend"] as const) {
    const disclosure = page.locator(selector);
    if (!await disclosure.isVisible()) continue;
    await disclosure.locator("summary").click();
    await expect(disclosure).toHaveAttribute("open", "");
    await recordTextAudit(page, `${state}-${selector.slice(1)}-open`, evidence);
    await auditCompactReadoutBudget(page, `${state}-${selector.slice(1)}-open`, evidence);
    await disclosure.locator("summary").click();
    await expect(disclosure).not.toHaveAttribute("open", "");
  }

  const skyToggle = page.locator(".sky-readout-toggle");
  if (await skyToggle.isVisible()) {
    await expectPerceptibleGlass(skyToggle, `${state}-celestial-toggle-collapsed`, evidence);
    await skyToggle.click();
    await expect(page.locator("#sky-readout-details")).toBeVisible();
    await expectPerceptibleGlass(skyToggle, `${state}-celestial-toggle-expanded`, evidence);
    await expectPerceptibleGlass(page.locator(".sky-readout-details"), `${state}-celestial-details`, evidence);
    await recordTextAudit(page, `${state}-sky-readout-open`, evidence);
    await auditCompactReadoutBudget(page, `${state}-sky-readout-open`, evidence);
    await skyToggle.click();
    await expect(page.locator("#sky-readout-details")).toHaveCount(0);
  }

  const stars = page.locator(".depth-control").getByRole("button", { name: "stars", exact: true });
  if (await stars.isVisible()) {
    await stars.click();
    const environment = page.locator(".environment-readout");
    await expect(environment).toBeVisible();
    await environment.locator("summary").click();
    await expect(environment).toHaveAttribute("open", "");
    await recordTextAudit(page, `${state}-environment-readout-open`, evidence);
    await auditCompactReadoutBudget(page, `${state}-environment-readout-open`, evidence);
    await environment.locator("summary").click();
  }
}

async function completeStrategicChoices(page: Page) {
  await page.locator(".warfare-grid").getByRole("button", { name: /Intelligence and reconnaissance/i }).click();
  await page.locator("#strategic-end-state").selectOption("access");
  await page.locator("#strategic-primary-theory").selectOption("sun-tzu");
  await page.locator("#strategic-partner-theory").selectOption("clausewitz");
  await page.locator("#strategic-guardrail").selectOption("escalation");
}

async function scrollAndAudit(
  page: Page,
  scroller: Locator,
  state: string,
  evidence: unknown[],
  scopeSelector = ".game-shell",
) {
  if (!await scroller.count() || !await scroller.isVisible()) return;
  const range = await scroller.evaluate((element) => element.scrollHeight - element.clientHeight);
  if (range <= 1) return;
  for (const [label, fraction] of [["middle", 0.5], ["end", 1]] as const) {
    await scroller.evaluate((element, next) => { element.scrollTop = (element.scrollHeight - element.clientHeight) * next; }, fraction);
    await recordTextAudit(page, `${state}-${label}`, evidence, scopeSelector);
  }
  await scroller.evaluate((element) => { element.scrollTop = 0; });
}

async function expectSurfaceAndFocusablesInViewport(
  page: Page,
  surface: Locator,
  scopeSelector: string,
  state: string,
  evidence: unknown[],
) {
  await expect(surface).toBeVisible();
  await settleLayout(page);
  const viewport = page.viewportSize()!;
  const assertRect = (box: Rect | null, label: string) => {
    expect(box, `${label} geometry`).not.toBeNull();
    expect(box!.left, `${label} left`).toBeGreaterThanOrEqual(-1);
    expect(box!.top, `${label} top`).toBeGreaterThanOrEqual(-1);
    expect(box!.right, `${label} right`).toBeLessThanOrEqual(viewport.width + 1);
    expect(box!.bottom, `${label} bottom`).toBeLessThanOrEqual(viewport.height + 1);
  };
  const readRect = (target: Locator) => target.evaluate((element): Rect => {
    const box = element.getBoundingClientRect();
    return { top: box.top, right: box.right, bottom: box.bottom, left: box.left, width: box.width, height: box.height };
  });
  const surfaceBox = await readRect(surface);
  assertRect(surfaceBox, `${state} surface`);
  await recordTextAudit(page, state, evidence, scopeSelector);

  const focusables = surface.locator("button, a[href], input, select, textarea, summary, [tabindex]:not([tabindex='-1'])");
  const count = await focusables.count();
  let checkedFocusables = 0;
  for (let index = 0; index < count; index += 1) {
    const focusable = focusables.nth(index);
    const eligible = await focusable.evaluate((element) => {
      const control = element as HTMLElement & { disabled?: boolean };
      const style = getComputedStyle(control);
      const closedDetails = control.closest("details:not([open])");
      return !control.disabled
        && control.tabIndex >= 0
        && style.display !== "none"
        && style.visibility !== "hidden"
        && control.getClientRects().length > 0
        && (!closedDetails || closedDetails.querySelector(":scope > summary") === control);
    });
    if (!eligible) continue;
    await focusable.scrollIntoViewIfNeeded();
    await focusable.focus();
    const name = await focusable.evaluate((element) => element.getAttribute("aria-label") || element.textContent?.replace(/\s+/g, " ").trim().slice(0, 60) || element.tagName);
    assertRect(await readRect(focusable), `${state} focusable “${name}”`);
    checkedFocusables += 1;
  }
  expect(checkedFocusables, `${state} keyboard-reachable controls`).toBeGreaterThan(0);
  await recordTextAudit(page, `${state}-after-focus-traversal`, evidence, scopeSelector);
  evidence.push({ state: `${state}-focusables`, checkedFocusables, surface: surfaceBox });
}

async function openGlobalTool(page: Page, name: "ACADEMY" | "SAVE / LOAD" | "FIELD GUIDE" | "CREDITS" | "SOUND SETTINGS") {
  const menu = page.locator(".global-tools-menu");
  if (await menu.isVisible()) {
    if (!await menu.getAttribute("open")) await menu.locator(":scope > summary").click();
    await menu.getByRole("button", { name, exact: true }).click();
    return;
  }
  if (name === "SOUND SETTINGS") await page.locator(".sound-settings > summary").click();
  else await page.getByRole("button", { name, exact: true }).first().click();
}

test("visible interface text remains in its owning surface at release breakpoints, themes, and effective 200% zoom", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  test.skip(testInfo.project.name !== "desktop-chromium", "One browser project drives the complete responsive matrix");
  await openSession(page);
  const evidence: unknown[] = [];

  for (const viewport of responsiveViewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const theme of ["dark", "light"] as const) {
      await setInterfaceTheme(page, theme);
      const state = `${"label" in viewport ? viewport.label : `${viewport.width}x${viewport.height}`}-${theme}`;

      if (viewport.width <= 760) {
        await chooseCompactView(page, "DECISIONS");
        await recordAudit(page, testInfo, `${state}-decisions`, evidence);
        await chooseCompactView(page, "VISUALIZATION");
        await recordAudit(page, testInfo, `${state}-visualization`, evidence);
        await auditOpenedTacticalReadouts(page, `${state}-visualization`, evidence);
      } else {
        await recordAudit(page, testInfo, `${state}-strategy`, evidence);
        await auditOpenedTacticalReadouts(page, `${state}-strategy`, evidence);
      }
    }
  }

  await testInfo.attach("text-containment-matrix.json", {
    body: JSON.stringify(evidence, null, 2),
    contentType: "application/json",
  });
});

test("force, command, and final review retain text and controls through the complete responsive lifecycle", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  test.skip(testInfo.project.name !== "desktop-chromium", "One browser drives the lifecycle matrix");
  await openSession(page);
  await completeStrategicChoices(page);
  await page.getByRole("button", { name: "CONTINUE TO FORCE DESIGN" }).click();
  await expect(page.locator(".force-panel")).toBeVisible();
  const evidence: unknown[] = [];

  for (const viewport of representativeLifecycleCases) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await setInterfaceTheme(page, viewport.theme);
    if (viewport.width <= 760 && !await page.locator(".force-panel").isVisible()) await chooseCompactView(page, "FORCE DESIGN");
    const state = `${viewport.label}-${viewport.theme}-force`;
    await recordTextAudit(page, state, evidence);
    const recap = page.locator(".force-panel .planning-recap");
    await recap.locator("summary").click();
    await expect(recap).toHaveAttribute("open", "");
    await recordTextAudit(page, `${state}-recap-open`, evidence);
    await recap.locator("summary").click();
    await scrollAndAudit(page, page.locator(".force-panel"), state, evidence);
  }

  await page.setViewportSize({ width: 1024, height: 545 });
  await setInterfaceTheme(page, "dark");
  await page.getByRole("button", { name: "Add one Fleet aviation ship" }).click();
  await page.getByRole("button", { name: /BEGIN COMMAND PHASE/ }).click();
  const readiness = page.locator(".confirm-dialog");
  await expectSurfaceAndFocusablesInViewport(page, readiness, ".confirm-dialog", "1024x545-dark-readiness-dialog", evidence);
  await readiness.getByRole("button", { name: "PROCEED ANYWAY" }).click();
  await expect(page.locator(".kriegsspiel-panel")).toBeVisible();

  for (const viewport of representativeLifecycleCases) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await setInterfaceTheme(page, viewport.theme);
    const state = `${viewport.label}-${viewport.theme}-command`;
    await recordTextAudit(page, state, evidence);
    const recap = page.locator(".kriegsspiel-panel .planning-recap");
    await recap.locator("summary").click();
    await expect(recap).toHaveAttribute("open", "");
    await recordTextAudit(page, `${state}-recap-open`, evidence);
    await recap.locator("summary").click();
    await scrollAndAudit(page, page.locator(".kriegsspiel-panel"), state, evidence);
  }

  await page.setViewportSize({ width: 1024, height: 545 });
  for (let turn = 1; turn <= 6; turn += 1) {
    const resolve = page.getByRole("button", { name: `RESOLVE TURN ${turn}`, exact: true });
    await expect(resolve).toBeVisible();
    await resolve.click();
  }
  await expect(page.locator(".workspace")).toHaveClass(/phase-debrief/);

  for (const viewport of representativeLifecycleCases) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await setInterfaceTheme(page, viewport.theme);
    const state = `${viewport.label}-${viewport.theme}-debrief`;
    const result = page.locator(".result-card");
    await expectSurfaceAndFocusablesInViewport(page, result, ".result-card", state, evidence);
    await expectPerceptibleGlass(result, state, evidence);
    await expectNarrativeCopyWithoutNestedSlabs(result, state, evidence);
    await testInfo.attach(`${state}-result-glass.png`, { body: await result.screenshot(), contentType: "image/png" });
    await scrollAndAudit(page, result, state, evidence, ".result-card");
    const recap = result.locator(".planning-recap");
    await recap.scrollIntoViewIfNeeded();
    if (!await recap.getAttribute("open")) await recap.locator("summary").click();
    await recordTextAudit(page, `${state}-recap-open`, evidence, ".result-card");
    await recap.locator("summary").click();
    await result.evaluate((element) => { element.scrollTop = 0; });
  }

  await testInfo.attach("lifecycle-text-containment.json", {
    body: JSON.stringify(evidence, null, 2),
    contentType: "application/json",
  });
});

test("Academy, save, guide, credits, and sound surfaces remain contained and keyboard reachable", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  test.skip(testInfo.project.name !== "desktop-chromium", "One browser drives the global-surface matrix");
  await openSession(page);
  const evidence: unknown[] = [];

  for (const [selector, label] of [[".topbar", "topbar"]] as const) {
    const surface = page.locator(selector);
    await expectPerceptibleGlass(surface, label, evidence);
    await testInfo.attach(`${label}-glass.png`, { body: await surface.screenshot(), contentType: "image/png" });
  }

  const surfaces = [
    { tool: "ACADEMY", surface: ".academy", close: "Close academy", width: 320, height: 800, theme: "dark", label: "320x800-dark-academy", scroll: [".academy-scroll-surface"] },
    { tool: "SAVE / LOAD", surface: ".data-dialog", close: "Close save and load panel", width: 320, height: 800, theme: "dark", label: "320x800-dark-save", scroll: [".data-dialog"] },
    { tool: "FIELD GUIDE", surface: ".field-guide", close: "Close field guide", width: 640, height: 450, theme: "light", label: "200%-zoom-equivalent-light-guide", scroll: [".field-guide"] },
    { tool: "SOUND SETTINGS", surface: ".sound-settings > section", close: "Close audio controls", width: 640, height: 450, theme: "light", label: "200%-zoom-equivalent-light-sound", scroll: [] },
    { tool: "CREDITS", surface: ".credits-dialog", close: "Close credits", width: 1024, height: 545, theme: "dark", label: "1024x545-dark-credits", scroll: [".credits-dialog"] },
  ] as const;

  for (const item of surfaces) {
    await page.setViewportSize({ width: item.width, height: item.height });
    await setInterfaceTheme(page, item.theme);
    await openGlobalTool(page, item.tool);
    const surface = page.locator(item.surface);
    await expectSurfaceAndFocusablesInViewport(page, surface, item.surface, item.label, evidence);
    await expectPerceptibleGlass(surface, item.label, evidence);
    await expectNarrativeCopyWithoutNestedSlabs(surface, item.label, evidence);
    if (item.tool === "FIELD GUIDE") {
      const documentationDisclosure = surface.locator(".guide-documents");
      await documentationDisclosure.scrollIntoViewIfNeeded();
      await documentationDisclosure.locator("summary").click();
      const documentation = surface.getByRole("navigation", { name: "Field Guide documentation" });
      await expect(documentation.getByRole("link")).toHaveCount(4);
      await expect(documentation.getByRole("link", { name: "HOW THE GAME WORKS" })).toHaveAttribute("href", "./docs/HOW-THE-GAME-WORKS.md");
      await expect(documentation).not.toContainText(/persona|journey map|empathy map|service blueprint|roadmap/i);
    }
    await testInfo.attach(`${item.label}-glass.png`, { body: await surface.screenshot(), contentType: "image/png" });
    for (const selector of item.scroll) await scrollAndAudit(page, page.locator(selector), `${item.label}-${selector.replace(/[^a-z]+/gi, "-")}`, evidence, item.surface);
    await page.getByRole("button", { name: item.close }).click();
  }

  await testInfo.attach("global-surface-text-containment.json", {
    body: JSON.stringify(evidence, null, 2),
    contentType: "application/json",
  });
});
