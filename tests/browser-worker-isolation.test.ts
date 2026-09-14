import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

function readWorkerConfiguration(ci: boolean) {
  const env = { ...process.env };
  if (ci) env.CI = "true";
  else delete env.CI;
  const result = execFileSync(process.execPath, [
    "--import", "tsx", "--input-type=module", "-e",
    'import config from "./playwright.config.ts"; console.log(JSON.stringify({ workers: config.workers, retries: config.retries, forbidOnly: config.forbidOnly, projects: config.projects.map(project => project.name) }));',
  ], { cwd: fileURLToPath(new URL("../", import.meta.url)), env, encoding: "utf8", timeout: 10_000 });
  return JSON.parse(result) as { workers?: number; retries: number; forbidOnly: boolean; projects: string[] };
}

test("CI-ISOLATION-01: shared CI uses one worker without adding retries or omitting a viewport", () => {
  assert.deepEqual(readWorkerConfiguration(true), {
    workers: 1, retries: 0, forbidOnly: true, projects: ["desktop-chromium", "mobile-chromium"],
  });
});

test("CI-ISOLATION-02: local worker selection retains its default and the same coverage", () => {
  assert.deepEqual(readWorkerConfiguration(false), {
    retries: 0, forbidOnly: true, projects: ["desktop-chromium", "mobile-chromium"],
  });
});
