import { defineConfig, devices } from "@playwright/test";

const browserExecutable = process.env.FOG_TEST_BROWSER_PATH;

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:4174",
    colorScheme: "dark",
    contextOptions: { reducedMotion: "reduce" },
    launchOptions: browserExecutable ? {
      executablePath: browserExecutable,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    } : undefined,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4174 --strictPort",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: false,
    timeout: 30_000,
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 320, height: 800 } } },
  ],
});
