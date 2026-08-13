import { expect, test, type Page } from "@playwright/test";

type RenderedAudioSample = {
  contextState: AudioContextState | "missing";
  oscillatorStarts: number;
  peak: number;
  rms: number;
};

async function installRenderedAudioProbe(page: Page) {
  await page.addInitScript(() => {
    type RenderProbe = {
      analyser?: AnalyserNode;
      context?: AudioContext;
      oscillatorStarts: number;
    };
    const target = window as typeof window & { __renderedAudioProbe?: RenderProbe };
    const probe: RenderProbe = { oscillatorStarts: 0 };
    target.__renderedAudioProbe = probe;
    const NativeAudioContext = window.AudioContext;

    window.AudioContext = class extends NativeAudioContext {
      private applicationGainCount = 0;
      private readonly outputAnalyser: AnalyserNode;

      constructor(options?: AudioContextOptions) {
        super(options);
        this.outputAnalyser = super.createAnalyser();
        this.outputAnalyser.fftSize = 2_048;
        this.outputAnalyser.smoothingTimeConstant = 0;

        // Keep the analyser in the actively rendered graph without duplicating
        // audible output. The application master is connected to this branch
        // by the first createGain() call below.
        const silentSink = super.createGain();
        silentSink.gain.value = 0;
        this.outputAnalyser.connect(silentSink).connect(this.destination);
        probe.analyser = this.outputAnalyser;
        probe.context = this;
      }

      createGain() {
        const gain = super.createGain();
        this.applicationGainCount += 1;
        if (this.applicationGainCount === 1) gain.connect(this.outputAnalyser);
        return gain;
      }

      createOscillator() {
        const oscillator = super.createOscillator();
        const nativeStart = oscillator.start.bind(oscillator);
        oscillator.start = (when?: number) => {
          probe.oscillatorStarts += 1;
          nativeStart(when);
        };
        return oscillator;
      }
    };
  });
}

async function sampleRenderedAudio(page: Page): Promise<RenderedAudioSample> {
  return page.evaluate(() => {
    const probe = (window as typeof window & {
      __renderedAudioProbe?: {
        analyser?: AnalyserNode;
        context?: AudioContext;
        oscillatorStarts: number;
      };
    }).__renderedAudioProbe;
    if (!probe?.analyser || !probe.context) {
      return { contextState: "missing", oscillatorStarts: probe?.oscillatorStarts ?? 0, peak: 0, rms: 0 };
    }

    const samples = new Float32Array(probe.analyser.fftSize);
    probe.analyser.getFloatTimeDomainData(samples);
    let peak = 0;
    let sumOfSquares = 0;
    for (const value of samples) {
      peak = Math.max(peak, Math.abs(value));
      sumOfSquares += value * value;
    }
    return {
      contextState: probe.context.state,
      oscillatorStarts: probe.oscillatorStarts,
      peak,
      rms: Math.sqrt(sumOfSquares / samples.length),
    };
  });
}

test("a direct sound toggle resumes Web Audio and schedules audible procedural voices", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "One browser sound graph assertion is sufficient");

  await page.addInitScript(() => {
    type SoundProbe = { contexts: AudioContext[]; frequencies: number[] };
    const target = window as typeof window & { __soundProbe?: SoundProbe };
    target.__soundProbe = { contexts: [], frequencies: [] };
    const NativeAudioContext = window.AudioContext;
    window.AudioContext = class extends NativeAudioContext {
      constructor(options?: AudioContextOptions) {
        super(options);
        target.__soundProbe?.contexts.push(this);
      }

      createOscillator() {
        const oscillator = super.createOscillator();
        const nativeSetValue = oscillator.frequency.setValueAtTime.bind(oscillator.frequency);
        oscillator.frequency.setValueAtTime = (value, startTime) => {
          target.__soundProbe?.frequencies.push(value);
          return nativeSetValue(value, startTime);
        };
        return oscillator;
      }
    };
  });

  await page.goto("/");
  await page.getByRole("button", { name: "PLAY WITHOUT BROWSER SAVING" }).click();
  const toggle = page.locator(".sound-toggle");
  await expect(toggle).toHaveAccessibleName("Enable quiet ambiance and sound effects");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");

  await expect.poll(() => page.evaluate(() => {
    const probe = (window as typeof window & { __soundProbe?: { frequencies: number[] } }).__soundProbe;
    return probe?.frequencies.length ?? 0;
  })).toBeGreaterThanOrEqual(7);

  const probe = await page.evaluate(() => {
    const value = (window as typeof window & { __soundProbe?: { contexts: AudioContext[]; frequencies: number[] } }).__soundProbe;
    return {
      states: value?.contexts.map((context) => context.state) ?? [],
      frequencies: value?.frequencies ?? [],
    };
  });
  expect(probe.states).toEqual(["running"]);
  expect(probe.frequencies.some((frequency) => frequency >= 114 && frequency < 270)).toBe(true);
  expect(Math.min(...probe.frequencies)).toBeGreaterThanOrEqual(38);

  const initialFrequencyCount = probe.frequencies.length;
  await page.evaluate(async () => {
    const value = (window as typeof window & { __soundProbe?: { contexts: AudioContext[] } }).__soundProbe;
    await value?.contexts[0]?.suspend();
  });
  await page.getByText("SOUND", { exact: true }).click();
  await expect.poll(() => page.evaluate(() => {
    const value = (window as typeof window & { __soundProbe?: { contexts: AudioContext[] } }).__soundProbe;
    return value?.contexts[0]?.state;
  })).toBe("running");
  await expect.poll(() => page.evaluate((minimum) => {
    const value = (window as typeof window & { __soundProbe?: { frequencies: number[] } }).__soundProbe;
    return (value?.frequencies.length ?? 0) > minimum;
  }, initialFrequencyCount)).toBe(true);
});

test("scheduled ambiance produces a non-silent rendered signal at the application master", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "One real rendered-output assertion is sufficient");
  await installRenderedAudioProbe(page);

  await page.goto("/");
  await page.getByRole("button", { name: "PLAY WITHOUT BROWSER SAVING" }).click();
  await page.locator(".sound-toggle").click();

  await expect.poll(async () => (await sampleRenderedAudio(page)).oscillatorStarts, {
    message: "procedural sources should be scheduled after explicit activation",
  }).toBeGreaterThanOrEqual(7);
  await expect.poll(async () => (await sampleRenderedAudio(page)).rms, {
    intervals: [40, 60, 100, 160, 240],
    message: "scheduled sources must render a materially audible signal, not merely call start()",
    timeout: 4_000,
  }).toBeGreaterThan(0.0015);

  const rendered = await sampleRenderedAudio(page);
  expect(rendered.contextState).toBe("running");
  expect(rendered.peak).toBeGreaterThan(0.003);
  await testInfo.attach("rendered-audio-metrics.json", {
    body: JSON.stringify(rendered, null, 2),
    contentType: "application/json",
  });

  await page.locator(".sound-toggle").click();
  await expect.poll(async () => (await sampleRenderedAudio(page)).rms, {
    intervals: [100, 160, 240, 400],
    message: "muting should silence the rendered application master",
    timeout: 3_000,
  }).toBeLessThan(0.00001);
});
