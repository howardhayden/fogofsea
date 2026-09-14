import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test("all entity glow profiles produce exterior light without core washout or hidden-source leakage", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.goto("/");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  const results = await page.evaluate(async () => {
    const fixturePath = "/tests/browser/fixtures/dreamGlow.ts";
    const { runDreamGlowFixture } = await import(/* @vite-ignore */ fixturePath);
    const results = [];
    for (const kind of ["ship", "submarine", "aircraft", "creature"]) {
      for (const ratio of [1, 1.8]) results.push(runDreamGlowFixture(kind, ratio));
    }
    return results;
  });
  const metrics = results.map(({ capture: _capture, ...result }) => result);
  const metricPath = testInfo.outputPath("dream-glow-gpu-metrics.json");
  await writeFile(metricPath, JSON.stringify(metrics, null, 2));
  await testInfo.attach("dream-glow-gpu-metrics", { path: metricPath, contentType: "application/json" });
  console.log("dream-glow-gpu-metrics", JSON.stringify(metrics));
  for (const result of results) {
    const imagePath = testInfo.outputPath(`${result.kind}-dpr-${result.pixelRatio}.png`);
    await writeFile(imagePath, Buffer.from(result.capture.split(",")[1], "base64"));
    await testInfo.attach(`${result.kind}-dpr-${result.pixelRatio}`, { path: imagePath, contentType: "image/png" });
  }
  for (const result of results) {
    expect(result.status).toBe("sampled-radial-native-color");
    expect(result.renderedSubjects).toBe(1);
    expect(result.near).toBeGreaterThanOrEqual(0.05);
    expect(result.near).toBeLessThanOrEqual(0.10);
    expect(result.far).toBeLessThanOrEqual(0.003);
    expect(result.hueSpread).toBeLessThanOrEqual(0.01);
    expect(result.centerDifference).toBeLessThanOrEqual(1);
    expect(result.outsideDifference).toBe(0);
    expect(result.unauthorizedExteriorMaximum).toBe(0);
    expect(result.occludedMaximum).toBe(0);
    expect(result.framebufferError).toBe(0);
  }
  expect(errors).toEqual([]);
});
