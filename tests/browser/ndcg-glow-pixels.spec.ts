import { expect, test } from "@playwright/test";
import { build } from "esbuild";

test.use({ launchOptions: {
  executablePath: process.env.FOG_TEST_BROWSER_PATH,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
} });

const bundle = await build({ entryPoints: ["tests/browser/fixtures/ndcg-glow.ts"], bundle: true, write: false, format: "iife", globalName: "NdcgFixture", platform: "browser" });

test("compact native glow is emitted outside an unchanged crisp core", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "GPU oracle is independent of document viewport");
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(String(error)));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("about:blank");
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const result = await page.evaluate(async () => {
    return (window as unknown as { NdcgFixture: typeof import("./fixtures/ndcg-glow") }).NdcgFixture.fixture();
  });
  await testInfo.attach("gpu-oracle.json", { body: JSON.stringify({ ...result, screenshot: undefined }, null, 2), contentType: "application/json" });
  await testInfo.attach("candidate.png", { body: Buffer.from(result.screenshot.split(",")[1], "base64"), contentType: "image/png" });
  expect(errors).toEqual([]); expect(result.error).toBe(0);
  expect(result.diagnostics.rendered).toBe(1);
  expect(result.interiorMax).toBeLessThan(.001);
  expect(result.outsideMax).toBeGreaterThan(.005);
  const near = result.samples.find((v: { d: number }) => v.d >= .01)!;
  expect(near.r / .4).toBeGreaterThan(.05);
  expect(near.r / .4).toBeLessThan(.10);
});

import type { FixtureOptions } from "./fixtures/ndcg-glow";
import type { Page, TestInfo } from "@playwright/test";
async function runFixture(page: Page, options: FixtureOptions, info: TestInfo) {
  await page.goto("about:blank"); await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const result = await page.evaluate(options => (window as unknown as { NdcgFixture: typeof import("./fixtures/ndcg-glow") }).NdcgFixture.fixture(options), options);
  await info.attach("metrics.json", { body: JSON.stringify({ ...result, screenshot: undefined }, null, 2), contentType: "application/json" });
  expect(result.error).toBe(0); return result;
}

for (const kind of ["ship", "submarine", "aircraft", "wildlife", "sea-creature"] as const) {
  test(`${kind}: registered native parts create real exterior light without aura geometry`, async ({ page }, info) => {
    const result = await runFixture(page, { kind, parts: true }, info);
    expect(result.diagnostics.sourceMeshes).toBe(2); expect(result.diagnostics.haloMeshes).toBe(0);
    expect(result.interiorMax).toBeLessThan(.001); expect(result.outsideMax).toBeGreaterThan(.005);
    const sample = result.samples.find(v => v.d >= .01)!;
    expect(sample.b).toBeGreaterThan(sample.g * 1.9); expect(sample.b).toBeGreaterThan(sample.r * 7.5);
  });
}

for (const mode of ["hidden", "source", "destination"] as const) {
  test(`${mode}: glow cannot disclose a denied source or paint through a nearer occluder`, async ({ page }, info) => {
    const result = await runFixture(page, mode === "hidden" ? { hidden: true } : { block: mode }, info);
    if (mode !== "destination") expect(result.outsideMax).toBeLessThan(.0001);
    else { expect(Math.max(...result.destination.map(Math.abs))).toBeLessThan(.0001); expect(result.outsideMax).toBeGreaterThan(.005); }
  });
}

test("two separate sources preserve a dark gap rather than becoming one orb", async ({ page }, info) => {
  const result = await runFixture(page, { gap: true }, info);
  expect(result.center[0] / .4).toBeGreaterThan(.005);
  expect(result.center[0] / .4).toBeLessThan(.025);
});

test("unclipped source outside the viewport still contributes its authorized edge halo", async ({ page }, info) => {
  const result = await runFixture(page, { x: -250 }, info);
  expect(result.diagnostics.rendered).toBe(1); expect(result.outsideMax).toBeGreaterThan(.0001);
});

for (const dpr of [1, 2, 3]) for (const height of [32, 64, 128]) {
  test(`native ${height}px at DPR ${dpr}: bounded tail and source-relative scale`, async ({ page }, info) => {
    const result = await runFixture(page, { dpr, height }, info);
    expect(result.interiorMax).toBeLessThan(.001);
    expect(result.outsideMax).toBeGreaterThan(.001);
    const far = result.samples.find(v => v.d >= .1)!;
    expect(far.r / .4).toBeLessThanOrEqual(.002);
    const beyond = result.samples.filter(v => v.d >= .23);
    expect(beyond.every(v => Math.abs(v.r) < .00001)).toBe(true);
  });
}
