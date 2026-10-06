import { writeFile } from "node:fs/promises";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { captureStarfieldPixels } from "./starfieldPixels";

async function openAtmosphereSession(page: Page, withStrikeGroup = false) {
  await page.goto("/");
  await page.getByRole("button", { name: "PLAY WITHOUT BROWSER SAVING" }).click();
  if (withStrikeGroup) {
    if ((page.viewportSize()?.width ?? 1_000) <= 760) {
      await page.locator(".mobile-disclosure summary").click();
      await page.getByRole("button", { name: "DECISIONS", exact: true }).click();
    }
    await page.locator(".warfare-grid").getByRole("button", { name: /Intelligence and reconnaissance/i }).click();
    await page.locator("#strategic-end-state").selectOption("access");
    await page.locator("#strategic-primary-theory").selectOption("sun-tzu");
    await page.locator("#strategic-partner-theory").selectOption("clausewitz");
    await page.locator("#strategic-guardrail").selectOption("escalation");
    await page.getByRole("button", { name: "CONTINUE TO FORCE DESIGN", exact: true }).click();
    for (const name of ["Fleet aviation ship", "Area-defence destroyer"]) {
      await page.getByRole("button", { name: `Add one ${name}`, exact: true }).focus();
      await page.keyboard.press("Enter");
    }
    await page.getByRole("button", { name: "EMBARKED AVIATION", exact: true }).click();
    for (const name of ["Maritime mission helicopter", "Deck-launched multirole aircraft"]) {
      await page.getByRole("button", { name: `Add one ${name}`, exact: true }).focus();
      await page.keyboard.press("Enter");
    }
  }
  if ((page.viewportSize()?.width ?? 1_000) <= 760) {
    await page.locator(".mobile-disclosure summary").click();
    await page.getByRole("button", { name: "VISUALIZATION", exact: true }).click();
  }
  await expect(page.locator(".battlefield-canvas")).toHaveCount(1, { timeout: 15_000 });
}

async function deterministicEntropy(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(globalThis.crypto, "getRandomValues", {
      configurable: true,
      value: (view: Uint8Array) => {
        let state = 0x00c0ffee;
        const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
        for (let index = 0; index < bytes.length; index++) {
          state ^= state << 13;
          state ^= state >>> 17;
          state ^= state << 5;
          bytes[index] = state & 0xff;
        }
        return view;
      },
    });
  });
}

async function retain(testInfo: TestInfo, name: string, body: Buffer | string, contentType: string) {
  const path = testInfo.outputPath(name);
  await writeFile(path, body);
  await testInfo.attach(name, { path, contentType });
}

test("the real sky path renders every time and theme without shader failures", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && /shader|webgl|gl_invalid/i.test(message.text())) errors.push(message.text());
  });
  await deterministicEntropy(page);
  await openAtmosphereSession(page);
  const plot = page.locator(".battlefield-canvas");
  const canvas = plot.locator(":scope > canvas");
  const records = [];
  for (const theme of ["dark", "light"] as const) {
    if (theme === "light") await page.getByRole("button", { name: "Switch to light interface" }).click();
    for (const time of ["night", "dawn", "day", "dusk"] as const) {
      await page.locator(".depth-control").getByRole("button", { name: "sky", exact: true }).click();
      await page.locator(".time-control").getByRole("button", { name: time, exact: true }).click();
      await expect(plot).toHaveAttribute("data-rendered-layer", "sky", { timeout: 15_000 });
      await expect(plot).toHaveAttribute("data-rendered-theme", theme, { timeout: 15_000 });
      await expect(plot).toHaveAttribute("data-time", time);
      await expect(plot).toHaveAttribute("data-webgl", "ready", { timeout: 15_000 });
      expect(await canvas.evaluate((element) => (element as HTMLCanvasElement).getContext("webgl2")?.getError())).toBe(0);
      const capture = await captureStarfieldPixels(page, canvas);
      await retain(testInfo, `sky-${theme}-${time}.png`, Buffer.from(capture.base64, "base64"), "image/png");
      records.push({ theme, time, layer: "sky", metrics: capture.metrics });
      expect(capture.metrics.width).toBeGreaterThan(0);
      expect(capture.metrics.height).toBeGreaterThan(0);
      if (time === "night") {
        await retain(testInfo, `interface-${theme}-night.png`, await page.screenshot(), "image/png");
        await page.locator(".depth-control").getByRole("button", { name: "stars", exact: true }).click();
        await expect(plot).toHaveAttribute("data-rendered-layer", "stars", { timeout: 15_000 });
        const stars = await captureStarfieldPixels(page, canvas);
        await retain(testInfo, `stars-${theme}-night.png`, Buffer.from(stars.base64, "base64"), "image/png");
        records.push({ theme, time, layer: "stars", metrics: stars.metrics });
      }
    }
  }
  await retain(testInfo, "sky-render-matrix.json", JSON.stringify({
    browser: await page.evaluate(() => navigator.userAgent), records, errors,
  }, null, 2), "application/json");
  expect(errors).toEqual([]);
});

test("the star-attached atmosphere renders across the horizon and zenith with a strike group", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && /shader|webgl|gl_invalid/i.test(message.text())) errors.push(message.text());
  });
  await deterministicEntropy(page);
  await openAtmosphereSession(page, true);
  const plot = page.locator(".battlefield-canvas");
  await expect(plot).toHaveAttribute("data-formation-units", "4");
  const canvas = plot.locator(":scope > canvas");
  await page.locator(".time-control").getByRole("button", { name: "night", exact: true }).click();

  const readPose = async () => {
    const description = await page.locator("#battlefield-state-note").textContent();
    const match = description?.match(/Heading (\d+) degrees \w+; elevation (-?\d+) degrees/);
    if (!match) throw new Error(`Rendered camera pose unavailable: ${description}`);
    return { heading: Number(match[1]), elevation: Number(match[2]) };
  };
  const orbitTo = async (heading: number, elevation: number) => {
    await plot.focus();
    for (let step = 0; step < 30; step++) {
      const pose = await readPose();
      const difference = ((heading - pose.heading + 540) % 360) - 180;
      if (Math.abs(difference) <= 3) break;
      await page.keyboard.press(difference > 0 ? "ArrowLeft" : "ArrowRight");
    }
    for (let step = 0; step < 30; step++) {
      const pose = await readPose();
      if (Math.abs(elevation - pose.elevation) <= 2) break;
      await page.keyboard.press(elevation > pose.elevation ? "ArrowDown" : "ArrowUp");
    }
    const pose = await readPose();
    expect(Math.abs(((heading - pose.heading + 540) % 360) - 180)).toBeLessThanOrEqual(3);
    expect(Math.abs(elevation - pose.elevation)).toBeLessThanOrEqual(2);
    return pose;
  };
  const records = [];
  for (const theme of ["dark", "light"] as const) {
    if (theme === "light") await page.getByRole("button", { name: "Switch to light interface" }).click();
    await page.locator(".depth-control").getByRole("button", { name: "stars", exact: true }).click();
    await expect(plot).toHaveAttribute("data-rendered-layer", "stars", { timeout: 15_000 });
    await expect(plot).toHaveAttribute("data-rendered-theme", theme, { timeout: 15_000 });
    // Retain the same adjacent eastward views and upward pose for comparison
    // with the previous local candidate, now without its independent cloud field.
    for (const [name, heading, elevation] of [
      ["east-south", 96, 2],
      ["east-north", 89, 2],
      ["zenith", 89, 85],
    ] as const) {
      const pose = await orbitTo(heading, elevation);
      if (name === "east-south") expect(pose.heading).toBeGreaterThan(90);
      if (name === "east-north") expect(pose.heading).toBeLessThan(90);
      const glError = await canvas.evaluate((element) => (element as HTMLCanvasElement).getContext("webgl2")?.getError());
      expect(glError).toBe(0);
      const capture = await captureStarfieldPixels(page, canvas);
      await retain(testInfo, `stars-${theme}-${name}.png`, Buffer.from(capture.base64, "base64"), "image/png");
      records.push({ theme, layer: "stars", name, pose, glError, metrics: capture.metrics });
    }
    await page.locator(".depth-control").getByRole("button", { name: "sky", exact: true }).click();
    await expect(plot).toHaveAttribute("data-rendered-layer", "sky", { timeout: 15_000 });
    const pose = await orbitTo(0, 6);
    const glError = await canvas.evaluate((element) => (element as HTMLCanvasElement).getContext("webgl2")?.getError());
    expect(glError).toBe(0);
    const capture = await captureStarfieldPixels(page, canvas);
    await retain(testInfo, `sky-${theme}-low-horizon.png`, Buffer.from(capture.base64, "base64"), "image/png");
    records.push({ theme, layer: "sky", name: "low-horizon", pose, glError, metrics: capture.metrics });
  }
  await retain(testInfo, "sky-orbit-regression.json", JSON.stringify({
    browser: await page.evaluate(() => navigator.userAgent),
    purpose: "Retained real-render images for review of star-attached light, horizon and zenith views.",
    records, errors,
  }, null, 2), "application/json");
  expect(errors).toEqual([]);
});

test("the added atmosphere schedules no autonomous WebGL draws under reduced motion", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const observed = window as typeof window & { __atmosphereDrawCalls: number };
    observed.__atmosphereDrawCalls = 0;
    for (const method of ["drawArrays", "drawElements", "drawArraysInstanced", "drawElementsInstanced"] as const) {
      const original = WebGL2RenderingContext.prototype[method];
      Object.defineProperty(WebGL2RenderingContext.prototype, method, {
        configurable: true,
        value: function (this: WebGL2RenderingContext, ...args: unknown[]) {
          observed.__atmosphereDrawCalls += 1;
          return Reflect.apply(original, this, args);
        },
      });
    }
  });
  await openAtmosphereSession(page);
  const plot = page.locator(".battlefield-canvas");
  await page.locator(".time-control").getByRole("button", { name: "night", exact: true }).click();
  const records = [];
  for (const layer of ["stars", "sky"] as const) {
    await page.locator(".depth-control").getByRole("button", { name: layer, exact: true }).click();
    await expect(plot).toHaveAttribute("data-rendered-layer", layer, { timeout: 15_000 });
    await expect(plot).toHaveAttribute("data-webgl", "ready", { timeout: 15_000 });
    await expect(plot).toHaveAttribute("data-render-scheduling", "event-driven");
    // Let the resize observer and control damping settle before observing.
    await page.waitForTimeout(300);
    const before = await page.evaluate(() => (window as typeof window & { __atmosphereDrawCalls: number }).__atmosphereDrawCalls);
    await page.waitForTimeout(500);
    const after = await page.evaluate(() => (window as typeof window & { __atmosphereDrawCalls: number }).__atmosphereDrawCalls);
    records.push({ layer, before, after });
    expect(before).toBeGreaterThan(0);
    expect(after).toBe(before);
  }
  await retain(testInfo, "reduced-motion-webgl-draws.json", JSON.stringify(records, null, 2), "application/json");
});
