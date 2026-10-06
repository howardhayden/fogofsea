import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";

test("supported penguin details render distinct autonomous routines with stable resources and reduced-motion pixels", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "The controlled rig renderer has a fixed viewport.");
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const path = "/tests/browser/fixtures/wildlifePresentation.ts";
    const fixture = await import(/* @vite-ignore */ path) as typeof import("./fixtures/wildlifePresentation");
    return fixture.renderWildlifePresentation();
  });
  expect(result.individuals).toBeGreaterThan(3);
  expect(result.supports).toBe(1);
  for (const [index, routine] of ["march", "inspection", "about-face", "salute", "forage", "form-ranks"].entries()) {
    expect(result.frames[index].phases.sort()).toEqual([routine, "supported-rest"].sort());
  }
  expect(new Set(result.frames.map((frame) => frame.png)).size).toBe(result.frames.length);
  expect(result.still[0].png).toBe(result.still[1].png);
  for (const frame of [...result.frames, ...result.still]) {
    expect(frame.error).toBe(0);
    expect(frame.drawCalls).toBeGreaterThan(result.individuals);
    expect(frame.geometries).toBe(result.frames[0].geometries);
    expect(frame.programs).toBe(result.frames[0].programs);
  }
  for (const frame of result.frames) {
    const name = `penguin-detail-${frame.elapsed}s.png`;
    const path = testInfo.outputPath(name);
    await writeFile(path, Buffer.from(frame.png, "base64"));
    await testInfo.attach(name, { path, contentType: "image/png" });
  }
});
