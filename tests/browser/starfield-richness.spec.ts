import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { captureStarfieldPixels, measureStarfieldContrast } from "./starfieldPixels";
import { referenceFieldCount } from "../helpers/starfield-density";

test("every generated Stars canopy stays visibly dense in daylight, night, rain and snow", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  // A bright empty sky must never satisfy the density detector.
  const uniform = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 160; canvas.height = 100;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#eeeeee"; context.fillRect(0, 0, 160, 100);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  expect((await measureStarfieldContrast(page, uniform)).components).toBe(0);
  const records = [];
  const seeds = new Set<string>();
  for (const fixture of [
    { entropy: 0x00c0ffee, draw: 0.01, precipitation: "rain" },
    { entropy: 0x31415926, draw: 0.45, precipitation: "snow" },
    { entropy: 0x7fffffff, draw: 0.95, precipitation: "none" },
  ]) {
    const context = page.context();
    await page.close();
    page = await context.newPage();
    // Control the generator's inputs, then use the real Standard-mode flow;
    // never inject a scenario, renderer state or diagnostic count.
    await page.addInitScript(({ entropy, draw }) => {
      Math.random = () => draw;
      Object.defineProperty(globalThis.crypto, "getRandomValues", {
        configurable: true,
        value: (view: Uint8Array) => {
          let state = entropy >>> 0;
          const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
          for (let index = 0; index < bytes.length; index++) {
            state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
            bytes[index] = state & 0xff;
          }
          return view;
        },
      });
    }, fixture);
    await page.goto("/");
    await page.locator('input[name="difficulty"][value="standard"]').check();
    await page.getByRole("button", { name: "PLAY WITHOUT BROWSER SAVING" }).click();
    if ((page.viewportSize()?.width ?? 1_000) <= 760) {
      await page.locator(".mobile-disclosure summary").click();
      await page.getByRole("button", { name: "VISUALIZATION", exact: true }).click();
    }
    const plot = page.locator(".battlefield-canvas");
    await expect(plot).toHaveCount(1, { timeout: 15_000 });
    await page.locator(".depth-control").getByRole("button", { name: "stars", exact: true }).click();
    await expect(plot).toHaveAttribute("data-rendered-layer", "stars", { timeout: 15_000 });
    if (fixture.precipitation !== "none") {
      await expect(page.locator("#battlefield-state-note")).toContainText(new RegExp(`Weather: [^.]* ${fixture.precipitation}\\.`));
    } else {
      await expect(plot).toHaveAttribute("data-precipitation-presentation", "none");
    }
    seeds.add((await plot.getAttribute("data-starfield-seed"))!);
    for (const time of ["night", "day"] as const) {
      await page.locator(".time-control").getByRole("button", { name: time, exact: true }).click();
      await expect(plot).toHaveAttribute("data-time", time);
      await expect(plot).toHaveAttribute("data-webgl", "ready", { timeout: 15_000 });
      await expect(plot).toHaveAttribute("data-starfield-stars", "15360");
      await expect(plot).toHaveAttribute("data-starfield-nebulae", "16");
      await expect(plot).toHaveAttribute("data-starfield-meshes", "1");
      const canvas = plot.locator(":scope > canvas");
      const capture = await captureStarfieldPixels(page, canvas);
      const contrast = await measureStarfieldContrast(page, capture.base64);
      const environment = await plot.evaluate((element) => ({
        seed: element.dataset.starfieldSeed, cloudRegime: element.dataset.cloudRegime,
        weather: element.dataset.precipitationPresentation, layer: element.dataset.renderedLayer,
      }));
      records.push({ fixture, time, environment, contrast, absolute: capture.metrics });
      const imagePath = testInfo.outputPath(`dense-stars-${fixture.precipitation}-${time}.png`);
      await writeFile(imagePath, Buffer.from(capture.base64, "base64"));
      await testInfo.attach(`dense-stars-${fixture.precipitation}-${time}`, { path: imagePath, contentType: "image/png" });
      await testInfo.attach(`dense-stars-${fixture.precipitation}-${time}-metrics`, { body: JSON.stringify(records.at(-1), null, 2), contentType: "application/json" });
      expect(referenceFieldCount(contrast.components, contrast.width, contrast.height)).toBeGreaterThan(650);
      contrast.horizontalBins.forEach((count) => expect(count).toBeGreaterThan(100));
    }
  }
  expect(seeds.size).toBe(3);
  const matrixPath = testInfo.outputPath("dense-stars-condition-matrix.json");
  await writeFile(matrixPath, JSON.stringify(records, null, 2));
  await testInfo.attach("dense-stars-condition-matrix", { path: matrixPath, contentType: "application/json" });
});
