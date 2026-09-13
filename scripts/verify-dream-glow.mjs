import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { build } from "esbuild";
import { chromium } from "@playwright/test";

const output = "evidence/dream-glow/rendered";
await mkdir(output, { recursive: true });
const bundle = await build({ entryPoints: ["tests/dream-glow-render-fixture.ts"], bundle: true, format: "iife", globalName: "GlowFixture", write: false });
const browser = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const results = []; const failures = []; const errors = [];
try {
  const page = await browser.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.setContent("<!doctype html><html><body></body></html>");
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const cases = [
    ...["edge", "ship", "submarine", "aircraft", "rotorcraft", "sea-creature", "penguin", "seal", "whale", "dolphin", "shark", "seabird", "shorebird"].map((kind) => ({ kind })),
    { kind: "edge", dpr: 2 }, { kind: "edge", width: 320, height: 240 },
    { kind: "ship", occluder: "full" }, { kind: "penguin", occluder: "full" },
    { kind: "aircraft", occluder: "half" }, { kind: "ship", hidden: true },
    { kind: "aircraft", occluder: "half", dpr: 2 },
    { kind: "aircraft", occluder: "half", width: 320, height: 240 },
    { kind: "penguin", occluder: "half" },
    { kind: "submarine", occluder: "half" },
  ];
  for (let index = 0; index < cases.length; index++) {
    const result = await page.evaluate((options) => globalThis.GlowFixture.run(options), cases[index]);
    const stem = `${String(index).padStart(2, "0")}-${cases[index].kind}`;
    for (const field of ["before", "after"]) {
      await writeFile(`${output}/${stem}-${field}.png`, Buffer.from(result[field].split(",")[1], "base64"));
      delete result[field];
    }
    results.push(result);
    try {
      assert.equal(result.mode, "native-shape-field");
      assert.equal(result.glError, 0);
      assert.equal(result.registered, 1);
      if (cases[index].hidden || cases[index].occluder === "full") assert.equal(result.changed, 0, "hidden or fully occluded geometry must contribute no light");
      else assert.ok(result.changed > 0, "an enabled visible source must produce real changed pixels");
      if (cases[index].occluder === "half") assert.equal(result.leftChanged, 0, "near foreground must block destination spill");
      if (cases[index].kind === "edge") {
        assert.ok(result.radialProfile[0].relativeLight >= 0.05 && result.radialProfile[0].relativeLight <= 0.10, "positive near-halo gate");
        assert.ok(result.radialProfile[3].relativeLight <= 0.002, "far-tail darkness gate");
      }
    } catch (error) { failures.push({ case: cases[index], message: error.message }); }
  }
} finally {
  await browser.close();
  await writeFile(`${output}/results.json`, JSON.stringify({ results, failures, errors, note: "SwiftShader correctness evidence, not a representative-device performance qualification or perceptual reference approval." }, null, 2) + "\n");
}
assert.deepEqual(errors, [], "WebGL/shader errors");
assert.deepEqual(failures, [], "rendered glow acceptance failures");
console.log(`Passed ${results.length} rendered dream-glow fixtures`);
