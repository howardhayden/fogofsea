import { expect, test } from "@playwright/test";

test("recurring glow source variants retain compiled programs and exact fresh-pipeline pixels", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "One GL context exercises material ownership independently of viewport size.");
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const fixturePath = "/tests/browser/fixtures/glowCaptureReuse.ts";
    const { runGlowCaptureReuseFixture } = await import(/* @vite-ignore */ fixturePath) as typeof import("./fixtures/glowCaptureReuse");
    return runGlowCaptureReuseFixture();
  });
  await testInfo.attach("glow-capture-reuse", { body: JSON.stringify(result, null, 2), contentType: "application/json" });
  expect(result.warmedPrograms.length).toBeGreaterThan(0);
  for (const record of result.records) {
    expect(record.error).toBe(0);
    expect(record.changedChannels).toBe(0);
    expect(record.maximumDifference).toBe(0);
    expect(record.programs).toEqual(record.programsBeforeClear);
    if (record.iteration > 2) expect(record.programs).toEqual(result.warmedPrograms);
  }
});
