import { writeFile } from "node:fs/promises";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { captureStarfieldPixels } from "./starfieldPixels";

type FormationBrowserProbe = {
  draws: number;
  transitions: { at: number; units: number; moving: number }[];
};

async function prepareBrowser(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && /shader|webgl|gl_invalid/i.test(message.text())) errors.push(message.text());
  });
  await page.addInitScript(() => {
    const observed = window as typeof window & { __formationProbe: FormationBrowserProbe };
    observed.__formationProbe = { draws: 0, transitions: [] };
    const observeTransitions = () => {
      const observer = new MutationObserver((records) => {
        for (const record of records) {
          const plot = record.target as HTMLElement;
          if (!plot.matches(".battlefield-canvas")) continue;
          observed.__formationProbe.transitions.push({
            at: performance.now(),
            units: Number(plot.dataset.formationUnits ?? 0),
            moving: Number(plot.dataset.formationMoving ?? 0),
          });
        }
      });
      observer.observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ["data-formation-units", "data-formation-moving"] });
    };
    if (document.documentElement) observeTransitions();
    else document.addEventListener("DOMContentLoaded", observeTransitions, { once: true });
    for (const method of ["drawArrays", "drawElements", "drawArraysInstanced", "drawElementsInstanced"] as const) {
      const original = WebGL2RenderingContext.prototype[method];
      Object.defineProperty(WebGL2RenderingContext.prototype, method, {
        configurable: true,
        value: function (this: WebGL2RenderingContext, ...args: unknown[]) {
          observed.__formationProbe.draws += 1;
          return Reflect.apply(original, this, args);
        },
      });
    }
    Object.defineProperty(globalThis.crypto, "getRandomValues", {
      configurable: true,
      value: (view: Uint8Array) => {
        let state = 0x00c0ffee;
        const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
        for (let index = 0; index < bytes.length; index++) {
          state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
          bytes[index] = state & 0xff;
        }
        return view;
      },
    });
  });
  return errors;
}

async function mobileDestination(page: Page, name: "DECISIONS" | "FORCE DESIGN" | "VISUALIZATION") {
  if ((page.viewportSize()?.width ?? 1_000) > 760) return;
  await page.locator(".mobile-disclosure summary").click();
  await page.getByRole("button", { name, exact: true }).click();
}

async function openForceDesign(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "PLAY WITHOUT BROWSER SAVING" }).click();
  await mobileDestination(page, "DECISIONS");
  await page.locator(".warfare-grid").getByRole("button", { name: /Intelligence and reconnaissance/i }).click();
  await page.locator("#strategic-end-state").selectOption("access");
  await page.locator("#strategic-primary-theory").selectOption("sun-tzu");
  await page.locator("#strategic-partner-theory").selectOption("clausewitz");
  await page.locator("#strategic-guardrail").selectOption("escalation");
  await page.getByRole("button", { name: "CONTINUE TO FORCE DESIGN", exact: true }).click();
}

async function addUnits(page: Page, name: string, count: number) {
  const add = page.getByRole("button", { name: `Add one ${name}`, exact: true });
  await add.focus();
  if (count > 5) {
    // Exercise the same native button click handler in one browser task chain.
    // A zero-delay task between activations lets React flush each update;
    // no application state, props, storage, or diagnostic counts are injected.
    // The resulting accessible counter is independently checked below.
    await add.evaluate(async (button, amount) => {
      for (let index = 0; index < amount; index++) {
        (button as HTMLButtonElement).click();
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    }, count);
    return;
  }
  // Keyboard activation uses the real accessible control and allows the
  // renderer's 500ms roster debounce to combine a rapid sequence. Pointer
  // stability waits can otherwise force a separate software-GPU rebuild at
  // every increment of a 99-unit boundary fixture.
  for (let index = 0; index < count; index++) await page.keyboard.press("Enter");
}

async function retain(testInfo: TestInfo, name: string, body: Buffer | string, contentType: string) {
  const path = testInfo.outputPath(name);
  await writeFile(path, body);
  await testInfo.attach(name, { path, contentType });
}

async function unitIdentities(page: Page) {
  return page.locator(".fallback-ship, .fallback-aircraft").evaluateAll((elements) => elements.map((element) => (element as HTMLElement).dataset.unitId));
}

async function expectRenderedCount(page: Page, count: number) {
  const plot = page.locator(".battlefield-canvas");
  await expect(plot).toHaveAttribute("data-webgl", "ready");
  await expect(plot).toHaveAttribute("data-formation-units", String(count), { timeout: 15_000 });
  await expect(plot).toHaveAttribute("data-formation-visible", String(count), { timeout: 15_000 });
  const ids = await unitIdentities(page);
  expect(ids).toHaveLength(count);
  expect(ids.every((id) => typeof id === "string" && id.length > 0)).toBe(true);
  expect(new Set(ids).size).toBe(count);
  const canvas = plot.locator(":scope > canvas");
  expect(await canvas.evaluate((node) => (node as HTMLCanvasElement).getContext("webgl2")?.getError())).toBe(0);
  return { plot, canvas, ids };
}

async function expectSettledDraws(page: Page) {
  await expect(page.locator(".battlefield-canvas")).toHaveAttribute("data-render-scheduling", "event-driven");
  await expect(page.locator(".battlefield-canvas")).toHaveAttribute("data-formation-moving", "0");
  await page.waitForTimeout(300);
  const before = await page.evaluate(() => (window as typeof window & { __formationProbe: FormationBrowserProbe }).__formationProbe.draws);
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => (window as typeof window & { __formationProbe: FormationBrowserProbe }).__formationProbe.draws);
  expect(before).toBeGreaterThan(0);
  expect(after).toBe(before);
  return { before, after };
}

async function movementMark(page: Page) {
  return page.evaluate(() => (window as typeof window & { __formationProbe: FormationBrowserProbe }).__formationProbe.transitions.length);
}

async function expectObservedMovement(page: Page, units: number, after: number) {
  // Await the replacement scene before observing movement. Its first software
  // WebGL frame can outlast the ordinary assertion deadline after a roster add.
  const plot = page.locator(".battlefield-canvas");
  await expect(plot).toHaveAttribute("data-formation-units", String(units), { timeout: 15_000 });
  await expect(plot).toHaveAttribute("data-formation-visible", String(units), { timeout: 15_000 });
  // Read the actual renderer's transitions at browser speed: CDP roundtrips
  // during count/identity checks can outlast a short aircraft maneuver.
  await expect.poll(async () => page.evaluate(({ expectedUnits, start }) => (
    window as typeof window & { __formationProbe: FormationBrowserProbe }
  ).__formationProbe.transitions.slice(start).filter((sample) => sample.units === expectedUnits && sample.moving > 0).length, {
    expectedUnits: units, start: after,
  })).toBeGreaterThan(0);
}

async function retainTransitionEvidence(page: Page, testInfo: TestInfo, domain: string, details: Record<string, unknown>, errors: string[]) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const draws = await expectSettledDraws(page);
  await retain(testInfo, `${domain}-formation-transition.json`, JSON.stringify({
    ...details,
    observedTransitions: await page.evaluate(() => (window as typeof window & { __formationProbe: FormationBrowserProbe }).__formationProbe.transitions),
    draws, errors,
    evidenceBoundary: "Browser verifies retained identities, actual rendered/moving counters, and changing scene pixels. Exact per-unit position/velocity continuity is covered by model/scene integration tests, not inferred from aggregate telemetry or water animation.",
  }, null, 2), "application/json");
  expect(errors).toEqual([]);
}

for (const domain of ["surface", "air"] as const) {
  test(`every one of 99 UI-selected ${domain} units renders without the former visual caps`, async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const errors = await prepareBrowser(page);
    await openForceDesign(page);
    if (domain === "air") {
      // Two hosts provide capacity for all 99 selected logistics aircraft;
      // unsupported aviation remains outside the established plot boundary.
      await addUnits(page, "Fleet aviation ship", 2);
      await page.getByRole("button", { name: "EMBARKED AVIATION", exact: true }).click();
    }
    const name = domain === "surface" ? "Stealth littoral corvette" : "Uncrewed vertical logistics aircraft";
    await page.locator("#catalog-search").fill(name);
    await addUnits(page, name, 99);
    await expect(page.getByRole("group", { name: `${name}: 99`, exact: true })).toBeVisible();
    // 99 is the canonical UI/save count ceiling, independent of point credit
    // or deck pairing. This is a selected-count test, not a force-fit claim.
    await addUnits(page, name, 1);
    await expect(page.getByRole("group", { name: `${name}: 99`, exact: true })).toBeVisible();
    await mobileDestination(page, "VISUALIZATION");
    await page.locator(".depth-control").getByRole("button", { name: domain, exact: true }).click();
    await page.locator(".time-control").getByRole("button", { name: "night", exact: true }).click();
    const { canvas, ids } = await expectRenderedCount(page, domain === "surface" ? 99 : 101);
    const selectedKind = page.locator(domain === "surface" ? ".fallback-ship" : ".fallback-aircraft");
    await expect(selectedKind).toHaveCount(99);
    const draws = await expectSettledDraws(page);
    const capture = await captureStarfieldPixels(page, canvas);
    await retain(testInfo, `${domain}-99-canvas.png`, Buffer.from(capture.base64, "base64"), "image/png");
    await retain(testInfo, `${domain}-99-interface.png`, await page.screenshot(), "image/png");
    await retain(testInfo, `${domain}-99-render.json`, JSON.stringify({ selected: 99, instantiated: ids.length, ids, draws, errors }, null, 2), "application/json");
    expect(errors).toEqual([]);
  });
}

// Each independent domain starts from the same settled roster as the original
// combined workflow. Separate budgets keep software-rendering work in earlier
// domains from exhausting the final domain's deadline; assertions stay intact.
test("surface additions during a maneuver retain identities and settle in the rendered view", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const errors = await prepareBrowser(page);
  await openForceDesign(page);
  await addUnits(page, "Fleet aviation ship", 1);
  await mobileDestination(page, "VISUALIZATION");
  await page.locator(".time-control").getByRole("button", { name: "night", exact: true }).click();
  const { ids: initialIds } = await expectRenderedCount(page, 1);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator(".battlefield-canvas")).toHaveAttribute("data-render-scheduling", "animated");
  const surfaceMark = await movementMark(page);
  await mobileDestination(page, "FORCE DESIGN");
  await addUnits(page, "Fleet aviation ship", 1);
  await mobileDestination(page, "VISUALIZATION");
  await expectObservedMovement(page, 2, surfaceMark);
  const beforeNavigation = await page.locator(".battlefield-canvas").evaluate((plot) => ({
    units: Number((plot as HTMLElement).dataset.formationUnits ?? 0),
    moving: Number((plot as HTMLElement).dataset.formationMoving ?? 0),
  }));
  expect(beforeNavigation.units).toBe(2);
  expect(beforeNavigation.moving).toBeGreaterThan(0);
  await mobileDestination(page, "FORCE DESIGN");
  // Read the live moving state and activate the ordinary add button in the
  // same browser task, before screenshot/CDP work can outlast this maneuver.
  const interruptedAt = await page.getByRole("button", { name: "Add one Fleet aviation ship", exact: true }).evaluate((button) => {
    const plot = document.querySelector<HTMLElement>(".battlefield-canvas");
    const snapshot = {
      units: plot?.dataset.formationUnits === undefined ? null : Number(plot.dataset.formationUnits),
      moving: plot?.dataset.formationMoving === undefined ? null : Number(plot.dataset.formationMoving),
      plotHidden: !(plot?.clientWidth && plot.clientHeight),
      ids: Array.from(document.querySelectorAll<HTMLElement>(".fallback-ship, .fallback-aircraft"), (element) => element.dataset.unitId),
    };
    (button as HTMLButtonElement).click();
    return snapshot;
  });
  if ((page.viewportSize()?.width ?? 1_000) > 760) {
    expect(interruptedAt.units).toBe(2);
    expect(interruptedAt.moving).toBeGreaterThan(0);
  } else {
    // The mobile drawer tears down the scene and the force view hides the
    // plot. The visible motion was active before navigation, then resumes
    // from its retained state after the add; absent telemetry means paused.
    expect(interruptedAt.plotHidden).toBe(true);
  }
  expect(interruptedAt.ids).toHaveLength(2);
  expect(interruptedAt.ids).toEqual(expect.arrayContaining(initialIds));
  await mobileDestination(page, "VISUALIZATION");
  const third = await expectRenderedCount(page, 3);
  await expectObservedMovement(page, 3, surfaceMark);
  expect(third.ids).toEqual(expect.arrayContaining(interruptedAt.ids));
  const interrupted = await captureStarfieldPixels(page, third.canvas);
  await retain(testInfo, "fleet-interrupted-maneuver.png", Buffer.from(interrupted.base64, "base64"), "image/png");
  await page.waitForTimeout(700);
  const continued = await captureStarfieldPixels(page, third.canvas);
  expect(continued.base64).not.toBe(interrupted.base64);
  await retain(testInfo, "fleet-continued-maneuver.png", Buffer.from(continued.base64, "base64"), "image/png");
  await expect(third.plot).toHaveAttribute("data-formation-moving", "0", { timeout: 15_000 });
  const settled = await captureStarfieldPixels(page, third.canvas);
  await retain(testInfo, "fleet-settled.png", Buffer.from(settled.base64, "base64"), "image/png");
  await retainTransitionEvidence(page, testInfo, "surface", {
    initialIds, afterFirstAdd: interruptedAt.ids, beforeNavigation, interruptedAt, afterInterruptedAdd: third.ids,
  }, errors);
});

test("aircraft additions retain identities while rotorcraft settle and fixed wings keep patrolling", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const errors = await prepareBrowser(page);
  await openForceDesign(page);
  await addUnits(page, "Fleet aviation ship", 3);
  // Cover rotor wash and fixed-wing slipstream on the actual Air path as
  // well as surface wakes. Roster selection remains ordinary user input.
  await page.getByRole("button", { name: "EMBARKED AVIATION", exact: true }).click();
  await addUnits(page, "Maritime mission helicopter", 1);
  await addUnits(page, "Deck-launched multirole aircraft", 1);
  await mobileDestination(page, "VISUALIZATION");
  await page.locator(".depth-control").getByRole("button", { name: "air", exact: true }).click();
  await page.locator(".time-control").getByRole("button", { name: "night", exact: true }).click();
  const firstAir = await expectRenderedCount(page, 5);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(firstAir.plot).toHaveAttribute("data-render-scheduling", "animated");
  const airMark = await movementMark(page);
  await mobileDestination(page, "FORCE DESIGN");
  await addUnits(page, "Maritime mission helicopter", 1);
  await addUnits(page, "Deck-launched multirole aircraft", 1);
  await mobileDestination(page, "VISUALIZATION");
  const expandedAir = await expectRenderedCount(page, 7);
  expect(expandedAir.ids).toEqual(expect.arrayContaining(firstAir.ids));
  await expectObservedMovement(page, 7, airMark);
  const airMoving = await captureStarfieldPixels(page, expandedAir.canvas);
  await retain(testInfo, "air-rotor-and-fixed-wing-maneuver.png", Buffer.from(airMoving.base64, "base64"), "image/png");
  // Rotorcraft settle; both fixed-wing aircraft keep flying their patrol.
  await expect(expandedAir.plot).toHaveAttribute("data-formation-moving", "2", { timeout: 25_000 });
  const airSettled = await captureStarfieldPixels(page, expandedAir.canvas);
  await retain(testInfo, "air-patrol-and-hover.png", Buffer.from(airSettled.base64, "base64"), "image/png");
  await retainTransitionEvidence(page, testInfo, "air", { firstAir: firstAir.ids, expandedAir: expandedAir.ids }, errors);
});

test("submarine additions retain identities and settle in the rendered subsurface view", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const errors = await prepareBrowser(page);
  await openForceDesign(page);
  // Recreate the completed surface and air rosters without spending this
  // test's movement budget exercising those independently covered domains.
  await addUnits(page, "Fleet aviation ship", 3);
  await page.getByRole("button", { name: "EMBARKED AVIATION", exact: true }).click();
  await addUnits(page, "Maritime mission helicopter", 2);
  await addUnits(page, "Deck-launched multirole aircraft", 2);
  // Two-to-three makes the retained second submarine change its ring slot;
  // the first stays at the same angle when the second is initially added.
  await page.getByRole("button", { name: "FLEET", exact: true }).click();
  await addUnits(page, "Air-independent patrol submarine", 2);
  await mobileDestination(page, "VISUALIZATION");
  await page.locator(".depth-control").getByRole("button", { name: "subsurface", exact: true }).click();
  await page.locator(".time-control").getByRole("button", { name: "night", exact: true }).click();
  const firstSubsurface = await expectRenderedCount(page, 2);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(firstSubsurface.plot).toHaveAttribute("data-render-scheduling", "animated");
  const subsurfaceMark = await movementMark(page);
  await mobileDestination(page, "FORCE DESIGN");
  await addUnits(page, "Air-independent patrol submarine", 1);
  await mobileDestination(page, "VISUALIZATION");
  const expandedSubsurface = await expectRenderedCount(page, 3);
  expect(expandedSubsurface.ids).toEqual(expect.arrayContaining(firstSubsurface.ids));
  await expectObservedMovement(page, 3, subsurfaceMark);
  const subsurfaceMoving = await captureStarfieldPixels(page, expandedSubsurface.canvas);
  await retain(testInfo, "subsurface-maneuver.png", Buffer.from(subsurfaceMoving.base64, "base64"), "image/png");
  await expect(expandedSubsurface.plot).toHaveAttribute("data-formation-moving", "0", { timeout: 15_000 });
  const subsurfaceSettled = await captureStarfieldPixels(page, expandedSubsurface.canvas);
  await retain(testInfo, "subsurface-settled.png", Buffer.from(subsurfaceSettled.base64, "base64"), "image/png");
  await retainTransitionEvidence(page, testInfo, "subsurface", {
    firstSubsurface: firstSubsurface.ids, expandedSubsurface: expandedSubsurface.ids,
  }, errors);
});

test("fixed-wing patrol resumes after reduced-motion changes while rotorcraft can hover", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const errors = await prepareBrowser(page);
  await openForceDesign(page);
  await addUnits(page, "Fleet aviation ship", 1);
  await page.getByRole("button", { name: "EMBARKED AVIATION", exact: true }).click();
  await addUnits(page, "Deck-launched multirole aircraft", 1);
  await addUnits(page, "Maritime mission helicopter", 1);
  await mobileDestination(page, "VISUALIZATION");
  await page.locator(".depth-control").getByRole("button", { name: "air", exact: true }).click();
  await page.locator(".time-control").getByRole("button", { name: "night", exact: true }).click();
  const { plot, canvas, ids } = await expectRenderedCount(page, 3);
  await expectSettledDraws(page);
  const observations = [];
  for (let cycle = 0; cycle < 2; cycle++) {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(plot).toHaveAttribute("data-render-scheduling", "animated");
    await expect(plot).toHaveAttribute("data-formation-moving", "1");
    await expect(plot).toHaveAttribute("data-formation-visible", "3");
    await page.waitForTimeout(800);
    await expect(plot).toHaveAttribute("data-formation-moving", "1");
    const capture = await captureStarfieldPixels(page, canvas);
    await retain(testInfo, `flight-resume-${cycle}.png`, Buffer.from(capture.base64, "base64"), "image/png");
    await page.emulateMedia({ reducedMotion: "reduce" });
    observations.push(await expectSettledDraws(page));
  }
  expect(await unitIdentities(page)).toEqual(ids);
  expect(errors).toEqual([]);
  await retain(testInfo, "propulsion-preference-cycle.json", JSON.stringify({ ids, observations, errors }, null, 2), "application/json");
});
