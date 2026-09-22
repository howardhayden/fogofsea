import { expect, test, type Locator, type Page } from "@playwright/test";

type EdgeSnapshot = {
  color: string;
  style: string;
  width: string;
};

function colorAlpha(color: string) {
  if (color === "transparent") return 0;
  const functionBody = color.match(/^[a-z]+\((.*)\)$/i)?.[1];
  if (!functionBody) return 1;
  const slashAlpha = functionBody.match(/\/\s*([\d.]+)(%)?\s*$/);
  if (slashAlpha) return Number(slashAlpha[1]) / (slashAlpha[2] ? 100 : 1);
  const commaParts = functionBody.split(",").map((part) => part.trim());
  return commaParts.length === 4 ? Number(commaParts[3]) : 1;
}

async function paintedEdges(locator: Locator) {
  await expect(locator).toBeVisible();
  const edges = await locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return ["Top", "Right", "Bottom", "Left"].map((side) => ({
      color: style[`border${side}Color` as keyof CSSStyleDeclaration] as string,
      style: style[`border${side}Style` as keyof CSSStyleDeclaration] as string,
      width: style[`border${side}Width` as keyof CSSStyleDeclaration] as string,
    }));
  });
  return edges.filter((edge) => edge.style !== "none" && Number.parseFloat(edge.width) > 0) as EdgeSnapshot[];
}

async function expectInvisibleEdges(locator: Locator, label: string) {
  const edges = await paintedEdges(locator);
  expect(edges.length, `${label} should retain border geometry`).toBeGreaterThan(0);
  for (const edge of edges) expect(colorAlpha(edge.color), `${label}: ${edge.color}`).toBe(0);
  const backgroundClips = await locator.evaluate((element) => (
    getComputedStyle(element).backgroundClip.split(",").map((value) => value.trim())
  ));
  expect(
    backgroundClips.every((value) => value === "border-box"),
    `${label} should paint beneath every transparent edge layer: ${backgroundClips.join(", ")}`,
  ).toBe(true);
}

async function expectVisibleEdges(locator: Locator, label: string) {
  const edges = await paintedEdges(locator);
  expect(edges.length, `${label} should retain border geometry`).toBeGreaterThan(0);
  for (const edge of edges) expect(colorAlpha(edge.color), `${label}: ${edge.color}`).toBeGreaterThan(0);
}

async function expectFocusedOutline(locator: Locator) {
  await expect(locator).toBeFocused();
  const outline = await locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      color: style.outlineColor,
      style: style.outlineStyle,
      width: Number.parseFloat(style.outlineWidth),
      boxShadow: style.boxShadow,
      focus: element.matches(":focus"),
      focusVisible: element.matches(":focus-visible"),
      forcedColors: matchMedia("(forced-colors: active)").matches,
    };
  });
  expect(outline.style).not.toBe("none");
  expect(
    outline.width >= 2 || outline.boxShadow !== "none",
    JSON.stringify(outline),
  ).toBe(true);
  expect(colorAlpha(outline.color), outline.color).toBeGreaterThan(0);
}

async function expectKeyboardOutline(page: Page, previous: Locator, locator: Locator) {
  await previous.click();
  await page.keyboard.press("Tab");
  await expectFocusedOutline(locator);
}

async function hasForcedColorsEmulation(page: Page) {
  return page.evaluate(() => matchMedia("(forced-colors: active)").matches);
}

async function openSession(page: Page) {
  await page.goto("/");
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
  await page.getByRole("button", { name: "Add one Fleet aviation ship" }).click();
  await page.getByRole("button", { name: /BEGIN COMMAND PHASE/ }).click();
  const review = page.getByRole("dialog", { name: "Readiness review found likely failure points" });
  if (await review.isVisible()) await review.getByRole("button", { name: "PROCEED ANYWAY" }).click();
  await expect(page.getByRole("heading", { name: "TURN 1 OF 6" })).toBeVisible();
}

test("glass, phase, selection, and Academy edges disappear in both themes", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop glass treatment contract");
  await openSession(page);

  const selection = page.locator(".warfare-grid button").first();
  await selection.click();
  const mission = page.locator(".mission-panel");
  const currentDecision = page.locator(".decision-step").first();
  let academy: Locator | undefined;
  let decisionSupport: Locator | undefined;
  let decisionEvidence: Locator | undefined;
  let decisionOption: Locator | undefined;
  let relevantTheory: Locator | undefined;

  for (const theme of ["dark", "light"] as const) {
    await expect(page.locator(".app")).toHaveClass(new RegExp(`theme-${theme}`));
    await expectInvisibleEdges(mission, `${theme} mission glass`);
    await expectInvisibleEdges(selection, `${theme} selected warfare area`);
    await expectInvisibleEdges(currentDecision, `${theme} decision phase card`);
    await expectKeyboardOutline(page, selection, page.locator(".warfare-grid button").nth(1));

    await page.getByRole("button", { name: "ACADEMY", exact: true }).first().click();
    academy = page.getByRole("dialog", { name: "THE ACADEMY" });
    decisionSupport = academy.locator("[data-academy-decision-atom='first-phase-warfare']");
    decisionEvidence = decisionSupport.locator(".decision-evidence div").first();
    decisionOption = decisionSupport.locator(".decision-option-list li").first();
    relevantTheory = academy.locator(".relevant-theory-atom").first();
    await expectInvisibleEdges(academy, `${theme} Academy glass`);
    await expectInvisibleEdges(decisionSupport, `${theme} first-phase decision support`);
    await expectInvisibleEdges(decisionEvidence, `${theme} player-visible evidence group`);
    await expectInvisibleEdges(decisionOption, `${theme} symmetric decision option`);
    await expectInvisibleEdges(relevantTheory, `${theme} relevant-theory disclosure`);

    await academy.getByRole("button", { name: "Close academy" }).click();

    if (theme === "dark") await page.getByRole("button", { name: "Switch to light interface" }).click();
  }

  await page.emulateMedia({ contrast: "more" });
  expect(await page.evaluate(() => matchMedia("(prefers-contrast: more)").matches)).toBe(true);
  const contrastTokens = await page.locator(".app").evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      line: style.getPropertyValue("--line").trim(),
      lineStrong: style.getPropertyValue("--line-strong").trim(),
      stateLine: style.getPropertyValue("--state-line").trim(),
    };
  });
  expect(contrastTokens.line, JSON.stringify(contrastTokens)).not.toBe("transparent");
  await expectVisibleEdges(mission, "high-contrast mission glass");
  await expectVisibleEdges(selection, "high-contrast selected warfare area");
  await expectVisibleEdges(currentDecision, "high-contrast decision phase card");

  await page.getByRole("button", { name: "ACADEMY", exact: true }).first().click();
  academy = page.getByRole("dialog", { name: "THE ACADEMY" });
  decisionSupport = academy.locator("[data-academy-decision-atom='first-phase-warfare']");
  decisionEvidence = decisionSupport.locator(".decision-evidence div").first();
  decisionOption = decisionSupport.locator(".decision-option-list li").first();
  relevantTheory = academy.locator(".relevant-theory-atom").first();
  await expectVisibleEdges(decisionSupport, "high-contrast first-phase decision support");
  await expectVisibleEdges(decisionEvidence, "high-contrast player-visible evidence group");
  await expectVisibleEdges(decisionOption, "high-contrast symmetric decision option");
  await expectVisibleEdges(relevantTheory, "high-contrast relevant-theory disclosure");

  await academy.getByRole("tab", { name: "NOW" }).click();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expectFocusedOutline(decisionSupport.locator(":scope > summary"));

  await page.emulateMedia({ contrast: "no-preference", forcedColors: "active" });
  if (await hasForcedColorsEmulation(page)) {
    await expectVisibleEdges(academy, "forced-colors Academy glass");
    await expectVisibleEdges(decisionSupport.locator(":scope > summary"), "forced-colors decision-support control");
    await expectFocusedOutline(decisionSupport.locator(":scope > summary"));
  } else {
    testInfo.annotations.push({
      type: "browser-capability",
      description: "The pinned Chromium 131 shell does not expose forced-colors emulation; the static CSS contract remains authoritative.",
    });
  }
});

test("command glass stays rimless normally and restores edges for contrast modes", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop command glass contract");
  test.setTimeout(90_000);
  await openSession(page);
  await beginCommand(page);

  const surfaces: Array<[string, Locator]> = [
    ["command intelligence", page.locator(".command-intelligence-panel")],
    ["command orders", page.locator(".kriegsspiel-panel")],
  ];

  for (const theme of ["dark", "light"] as const) {
    await expect(page.locator(".app")).toHaveClass(new RegExp(`theme-${theme}`));
    for (const [label, surface] of surfaces) await expectInvisibleEdges(surface, `${theme} ${label}`);
    if (theme === "dark") await page.getByRole("button", { name: "Switch to light interface" }).click();
  }

  await page.emulateMedia({ contrast: "more" });
  expect(await page.evaluate(() => matchMedia("(prefers-contrast: more)").matches)).toBe(true);
  for (const [label, surface] of surfaces) await expectVisibleEdges(surface, `high-contrast ${label}`);

  await page.emulateMedia({ contrast: "no-preference", forcedColors: "active" });
  if (await hasForcedColorsEmulation(page)) {
    for (const [label, surface] of surfaces) await expectVisibleEdges(surface, `forced-colors ${label}`);
    await expectKeyboardOutline(
      page,
      page.locator(".kriegsspiel-report.operational-frame > summary"),
      page.locator("#rigid-formation"),
    );
  } else {
    testInfo.annotations.push({
      type: "browser-capability",
      description: "The pinned Chromium 131 shell does not expose forced-colors emulation; the static CSS contract remains authoritative.",
    });
  }
});
