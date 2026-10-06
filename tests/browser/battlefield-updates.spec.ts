import { expect, test } from "@playwright/test";

test("unchanged UI inputs retain the scene, contact changes update it, and rapid low-signature updates coalesce", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "React lifecycle and allocation checks need one desktop execution.");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const fixturePath = "/tests/browser/fixtures/battlefieldUpdates.ts";
    const { probeBattlefieldUpdates } = await import(/* @vite-ignore */ fixturePath) as typeof import("./fixtures/battlefieldUpdates");
    return probeBattlefieldUpdates();
  });
  await testInfo.attach("battlefield-update-allocations", {
    body: JSON.stringify(result, null, 2), contentType: "application/json",
  });
  for (const sample of [result.unchanged, result.omitted]) {
    expect(sample.bufferAllocations).toBe(0);
    expect(sample.sceneStateChanges).toBe(0);
    expect(sample.canvasResets).toBe(0);
    expect(sample.foamPatches).toBeGreaterThan(0);
    expect(sample.initialSceneBuffers).toBeGreaterThan(0);
    expect(sample.liveInitialSceneBuffers).toBe(sample.initialSceneBuffers);
    expect(sample.sameCanvas).toBe(true);
    expect(sample.webgl).toBe("ready");
  }
  expect(result.disclosed.bufferAllocations).toBeGreaterThan(0);
  expect(result.disclosed.sceneStateChanges).toBeGreaterThan(0);
  expect(result.disclosed.renderedContacts).toBe(1);
  expect(result.disclosed.canvasResets).toBe(0);
  expect(result.disclosed.liveInitialSceneBuffers).toBe(0);
  expect(result.disclosed.sameCanvas).toBe(true);
  expect(result.disclosed.webgl).toBe("ready");
  expect(result.rapidRoster.bufferAllocations).toBe(result.disclosed.bufferAllocations);
  expect(result.rapidRoster.sceneStateChanges).toBe(result.disclosed.sceneStateChanges);
  expect(result.rapidRoster.formationUnits).toBe(0);
  expect(result.rapidRoster.surfaceUnits).toBe(0);
  expect(result.rapidRoster.aircraftUnits).toBe(0);
  expect(result.settledRoster.bufferAllocations).toBeGreaterThan(result.rapidRoster.bufferAllocations);
  // One cleanup removes readiness and one completed replacement restores it.
  expect(result.settledRoster.sceneStateChanges - result.rapidRoster.sceneStateChanges).toBe(2);
  expect(result.settledRoster.formationUnits).toBe(8);
  expect(result.settledRoster.surfaceUnits).toBe(4);
  expect(result.settledRoster.aircraftUnits).toBe(4);
  expect(result.settledRoster.canvasResets).toBe(0);
  expect(result.settledRoster.sameCanvas).toBe(true);
  expect(result.settledRoster.webgl).toBe("ready");
  expect(result.nightSkyDescription?.toUpperCase()).toContain("PRISTINE LOW-SIGNATURE COSMOS");
  expect(result.error).toBe(0);
  expect(errors).toEqual([]);
});
