import { expect, test, type Page } from "@playwright/test";

type AudioAudit = {
  contexts: number;
  resumes: number;
  closes: number;
  oscillatorStarts: number;
  bufferStarts: number;
  connections: Array<{ from: string; to: string }>;
  gainEvents: Array<{ node: string; method: string; value: number }>;
};

async function openSession(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "PLAY WITHOUT BROWSER SAVING" }).click();
  await expect(page.locator(".battlefield-canvas")).toHaveCount(1);
}

async function installAudioAudit(page: Page) {
  await page.addInitScript(() => {
    const audit: AudioAudit = {
      contexts: 0,
      resumes: 0,
      closes: 0,
      oscillatorStarts: 0,
      bufferStarts: 0,
      connections: [],
      gainEvents: [],
    };
    let nodeSequence = 0;

    class MockAudioParam {
      value = 0;

      constructor(private readonly node: string) {}

      record(method: string, value: number) {
        this.value = value;
        audit.gainEvents.push({ node: this.node, method, value });
      }

      setValueAtTime(value: number) { this.record("setValueAtTime", value); }
      exponentialRampToValueAtTime(value: number) { this.record("exponentialRampToValueAtTime", value); }
      setTargetAtTime(value: number) { this.record("setTargetAtTime", value); }
      cancelScheduledValues() { this.record("cancelScheduledValues", this.value); }
    }

    class MockNode {
      readonly auditId: string;

      constructor(kind: string) {
        nodeSequence += 1;
        this.auditId = `${kind}-${nodeSequence}`;
      }

      connect(target: { auditId?: string }) {
        audit.connections.push({ from: this.auditId, to: target.auditId ?? "unknown" });
        return target;
      }

      addEventListener() {}
      stop() {}
    }

    class MockGain extends MockNode {
      gain: MockAudioParam;

      constructor() {
        super("gain");
        this.gain = new MockAudioParam(this.auditId);
      }
    }

    class MockOscillator extends MockNode {
      type = "sine";
      frequency: MockAudioParam;

      constructor() {
        super("oscillator");
        this.frequency = new MockAudioParam(this.auditId);
      }

      start() { audit.oscillatorStarts += 1; }
    }

    class MockBufferSource extends MockNode {
      buffer: unknown = null;

      constructor() { super("buffer-source"); }
      start() { audit.bufferStarts += 1; }
    }

    class MockFilter extends MockNode {
      type = "lowpass";
      frequency: MockAudioParam;

      constructor() {
        super("filter");
        this.frequency = new MockAudioParam(this.auditId);
      }
    }

    class MockAudioContext {
      readonly destination = { auditId: "destination" };
      readonly sampleRate = 8_000;
      readonly currentTime = 0;
      state = "suspended";

      constructor() { audit.contexts += 1; }
      createGain() { return new MockGain(); }
      createOscillator() { return new MockOscillator(); }
      createBufferSource() { return new MockBufferSource(); }
      createBiquadFilter() { return new MockFilter(); }
      createBuffer(_channels: number, length: number) {
        const channel = new Float32Array(length);
        return { getChannelData: () => channel };
      }
      async resume() {
        audit.resumes += 1;
        this.state = "running";
      }
      async close() {
        audit.closes += 1;
        this.state = "closed";
      }
      addEventListener() {}
      removeEventListener() {}
    }

    Object.defineProperty(window, "AudioContext", { configurable: true, value: MockAudioContext });
    Object.defineProperty(window, "__fogAudioAudit", { configurable: true, value: audit });
  });
}

async function readAudioAudit(page: Page) {
  return page.evaluate(() => (window as unknown as { __fogAudioAudit: AudioAudit }).__fogAudioAudit);
}

test("topbar bull and pointed-anchor mark remains legible in dark and light themes", async ({ page }) => {
  await openSession(page);

  const faviconModes = () => page.evaluate(() => [...document.querySelectorAll<HTMLLinkElement>('link[rel="icon"][media]')].map((link) => ({
    file: new URL(link.href).pathname,
    media: link.media,
    matches: matchMedia(link.media).matches,
  })));
  expect(await faviconModes()).toEqual([
    { file: "/favicon.svg", media: "(prefers-color-scheme: dark)", matches: true },
    { file: "/favicon-day.svg", media: "(prefers-color-scheme: light)", matches: false },
  ]);
  await page.emulateMedia({ colorScheme: "light" });
  expect(await faviconModes()).toEqual([
    { file: "/favicon.svg", media: "(prefers-color-scheme: dark)", matches: false },
    { file: "/favicon-day.svg", media: "(prefers-color-scheme: light)", matches: true },
  ]);

  const mark = page.locator(".brand-mark");
  const icon = mark.locator('svg[data-brand-symbol="bull-pointed-anchor"]');
  await expect(icon).toBeVisible();
  await expect(icon.locator(".brand-bull")).toHaveCount(1);
  await expect(icon.locator(".icon-anchor")).toHaveCount(1);

  const sample = () => icon.evaluate((element) => {
    const color = (selector: string, property: "fill" | "stroke") => getComputedStyle(element.querySelector(selector)!).getPropertyValue(property);
    const anchor = element.querySelector<SVGElement>(".icon-anchor")!;
    const iconRect = element.getBoundingClientRect();
    const markRect = element.parentElement!.getBoundingClientRect();
    return {
      iconRect: { top: iconRect.top, right: iconRect.right, bottom: iconRect.bottom, left: iconRect.left, width: iconRect.width, height: iconRect.height },
      markRect: { top: markRect.top, right: markRect.right, bottom: markRect.bottom, left: markRect.left, width: markRect.width, height: markRect.height },
      ground: color(".icon-ground", "fill"),
      horn: color(".icon-horn", "fill"),
      faceA: color(".icon-face-a", "fill"),
      faceB: color(".icon-face-b", "fill"),
      faceC: color(".icon-face-c", "fill"),
      anchor: color(".icon-anchor", "stroke"),
      anchorWidth: getComputedStyle(anchor).strokeWidth,
      anchorJoin: getComputedStyle(anchor).strokeLinejoin,
      theme: document.querySelector(".app")!.classList.contains("theme-light") ? "light" : "dark",
    };
  });

  const dark = await sample();
  expect(dark.theme).toBe("dark");
  expect(dark.iconRect.width).toBeGreaterThanOrEqual(36);
  expect(dark.iconRect.height).toBeGreaterThanOrEqual(36);
  expect(dark.iconRect.left).toBeGreaterThanOrEqual(dark.markRect.left);
  expect(dark.iconRect.top).toBeGreaterThanOrEqual(dark.markRect.top);
  expect(dark.iconRect.right).toBeLessThanOrEqual(dark.markRect.right);
  expect(dark.iconRect.bottom).toBeLessThanOrEqual(dark.markRect.bottom);
  expect(dark.anchorJoin).toBe("miter");
  expect(Number.parseFloat(dark.anchorWidth)).toBeGreaterThanOrEqual(2);
  for (const color of [dark.ground, dark.horn, dark.faceA, dark.faceB, dark.faceC, dark.anchor]) {
    expect(color).toMatch(/^(rgb|color\()/);
    expect(color).not.toBe("rgba(0, 0, 0, 0)");
  }

  await page.getByRole("button", { name: "Switch to light interface" }).click();
  await expect.poll(async () => (await sample()).ground).not.toBe(dark.ground);
  const light = await sample();
  expect(light.theme).toBe("light");
  expect(light.anchorJoin).toBe("miter");
  expect(light.iconRect).toEqual(dark.iconRect);
  expect(light.ground).not.toBe(dark.ground);
  expect(light.faceA).not.toBe(dark.faceA);
  expect(light.anchor).not.toBe(dark.anchor);
});

test("quiet ambiance becomes audible only after explicit user activation", async ({ page }) => {
  await installAudioAudit(page);
  await openSession(page);

  const before = await readAudioAudit(page);
  expect(before.contexts).toBe(0);
  expect(before.resumes).toBe(0);
  expect(before.oscillatorStarts).toBe(0);
  expect(before.bufferStarts).toBe(0);

  const enable = page.locator(".sound-toggle");
  await expect(enable).toHaveAccessibleName("Enable quiet ambiance and sound effects");
  await enable.click();
  await expect(enable).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => (await readAudioAudit(page)).oscillatorStarts).toBeGreaterThanOrEqual(4);
  await expect.poll(async () => (await readAudioAudit(page)).bufferStarts).toBeGreaterThanOrEqual(1);

  const after = await readAudioAudit(page);
  expect(after.contexts).toBe(1);
  expect(after.resumes).toBe(1);
  expect(after.connections).toContainEqual({ from: "gain-1", to: "destination" });

  const graphGain = (node: string) => after.gainEvents
    .filter((event) => event.node === node && (event.method === "setValueAtTime" || event.method === "setTargetAtTime"))
    .at(-1)?.value;
  const master = graphGain("gain-1");
  const ambiance = graphGain("gain-2");
  const effects = graphGain("gain-3");
  expect(master).toBeGreaterThan(0);
  expect(ambiance).toBeGreaterThan(0);
  expect(effects).toBeGreaterThan(0);
  expect(ambiance!).toBeLessThan(effects!);
});
