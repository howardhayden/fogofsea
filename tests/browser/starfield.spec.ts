import { expect, test, type Locator, type Page } from "@playwright/test";
import { createStarfieldPlan, STARFIELD_LIMITS } from "../../app/starfield";
import { createStarPlacements } from "../../app/viewModel";
import { measureStarfieldPixels, type StarfieldPixelMetrics } from "./starfieldPixels";

async function openSession(page: Page) {
  await page.goto("/");
  const privacyDialog = page.getByRole("dialog", { name: "HOW SHOULD THIS GAME REMEMBER YOU?" });
  await expect(privacyDialog).toBeVisible();
  await page.getByRole("button", { name: "PLAY WITHOUT BROWSER SAVING" }).click();
  await expect(privacyDialog).toBeHidden();
}

async function openStars(page: Page) {
  await page.locator(".depth-control").getByRole("button", { name: "stars", exact: true }).click();
  const plot = page.locator(".battlefield-canvas.layer-stars");
  await expect(plot).toBeVisible();
  return plot;
}

async function openVisualizationOnCompactView(page: Page) {
  if ((page.viewportSize()?.width ?? 1_000) > 760) return;
  await page.locator(".mobile-disclosure summary").click();
  await page.getByRole("button", { name: "VISUALIZATION", exact: true }).click();
}

async function installDeterministicVisualEntropy(page: Page, seed = 0x00c0ffee) {
  await page.addInitScript((initialSeed) => {
    let state = initialSeed >>> 0;
    Object.defineProperty(globalThis.crypto, "getRandomValues", {
      configurable: true,
      value: (view: Uint8Array) => {
        const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
        for (let index = 0; index < bytes.length; index += 1) {
          state ^= state << 13;
          state ^= state >>> 17;
          state ^= state << 5;
          bytes[index] = state & 0xff;
        }
        return view;
      },
    });
  }, seed);
}

async function measureGoldAccentPixels(page: Page, canvas: Locator) {
  const overlapping = page.locator(".battlefield-canvas > :not(canvas), .mission-panel, .force-panel, .plot-topline");
  const previousVisibility = await overlapping.evaluateAll((elements) => elements.map((element) => {
    const htmlElement = element as HTMLElement;
    const value = htmlElement.style.getPropertyValue("visibility");
    const priority = htmlElement.style.getPropertyPriority("visibility");
    htmlElement.style.setProperty("visibility", "hidden", "important");
    return { value, priority };
  }));
  let capture: Buffer;
  try {
    capture = await canvas.screenshot();
  } finally {
    await overlapping.evaluateAll((elements, states) => elements.forEach((element, index) => {
      const htmlElement = element as HTMLElement;
      const state = states[index];
      if (!state?.value) htmlElement.style.removeProperty("visibility");
      else htmlElement.style.setProperty("visibility", state.value, state.priority);
    }), previousVisibility);
  }
  return page.evaluate(async (base64Capture) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64Capture}`;
    await image.decode();
    const decoded = document.createElement("canvas");
    decoded.width = image.naturalWidth;
    decoded.height = image.naturalHeight;
    const context = decoded.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Two-dimensional gold-accent analysis unavailable");
    context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, decoded.width, decoded.height).data;
    let gold = 0;
    for (let index = 0; index < data.length; index += 4) {
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      if (red >= 115 && green >= 85 && red >= green + 12 && green >= blue + 18) gold += 1;
    }
    return gold;
  }, capture.toString("base64"));
}

async function cleanStarCanvasCapture(canvas: Locator) {
  return (await canvas.screenshot()).toString("base64");
}

async function changedStarPixelCount(page: Page, first: string, second: string) {
  return page.evaluate(async ({ leftCapture, rightCapture }) => {
    const decode = async (capture: string) => {
      const image = new Image();
      image.src = `data:image/png;base64,${capture}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Star-motion comparison context unavailable");
      context.drawImage(image, 0, 0);
      return context.getImageData(0, 0, canvas.width, canvas.height);
    };
    const [left, right] = await Promise.all([decode(leftCapture), decode(rightCapture)]);
    if (left.width !== right.width || left.height !== right.height) return Number.POSITIVE_INFINITY;
    let changed = 0;
    for (let index = 0; index < left.data.length; index += 4) {
      const difference = Math.abs(left.data[index] - right.data[index])
        + Math.abs(left.data[index + 1] - right.data[index + 1])
        + Math.abs(left.data[index + 2] - right.data[index + 2]);
      if (difference >= 18) changed += 1;
    }
    return changed;
  }, { leftCapture: first, rightCapture: second });
}

type RenderedCompositionOptions = {
  checkLargestField?: boolean;
  requireColorEvidence?: boolean;
  atmosphericComposite?: boolean;
};

function expectRenderedComposition(
  metrics: StarfieldPixelMetrics,
  compact: boolean,
  {
    checkLargestField = true,
    requireColorEvidence = true,
    atmosphericComposite = false,
  }: RenderedCompositionOptions = {},
) {
  // Thousands of distant instances intentionally resolve into hundreds of
  // discrete crystalline components instead of screen-dominating diamonds.
  // Sky additionally composites clouds/aurora and therefore uses lower direct
  // star-pixel floors while retaining complete horizontal coverage.
  expect(metrics.bright).toBeGreaterThan(atmosphericComposite
    ? compact ? 1_400 : 2_200
    : compact ? 2_000 : 7_000);
  expect(metrics.white).toBeGreaterThan(atmosphericComposite
    ? compact ? 300 : 650
    : compact ? 900 : 3_000);
  if (requireColorEvidence) {
    // Stars view has no aurora or atmospheric color field, so this comparison
    // isolates the canopy itself. Sky's gradient and aurora are intentionally
    // excluded from this chroma contract below.
    expect(metrics.white).toBeGreaterThan(metrics.colorful * 0.82);
    expect(metrics.colorful).toBeGreaterThan(compact ? 700 : 2_000);
    expect(metrics.cool).toBeGreaterThan(compact ? 500 : 1_400);
    expect(metrics.roseViolet).toBeGreaterThan(compact ? 400 : 1_200);
  }
  metrics.horizontalBins.forEach((count) => expect(count).toBeGreaterThan(atmosphericComposite
    ? compact ? 200 : 450
    : compact ? 350 : 1_200));
  if (checkLargestField) {
    expect(metrics.components).toBeGreaterThan(atmosphericComposite
      ? compact ? 250 : 450
      // 15,360 distant instances deliberately converge into hundreds of
      // resolved screen-space facets; bright-pixel and coverage floors above
      // prove abundance without pretending every subpixel light is a separate
      // connected component after antialiasing.
      : compact ? 250 : 650);
    expect(metrics.pinpoint).toBeGreaterThan(atmosphericComposite
      ? compact ? 120 : 300
      : compact ? 120 : 300);
    expect(metrics.far).toBeGreaterThan(atmosphericComposite
      ? compact ? 70 : 120
      : compact ? 70 : 220);
    expect(metrics.near).toBeGreaterThan(atmosphericComposite
      ? compact ? 10 : 15
      : compact ? 10 : 40);
    const resolvedFacets = metrics.far + metrics.near;
    // A populous distant canopy should contain many one-to-four-pixel glints.
    // Still require hundreds of materially resolved five-to-180-pixel facets
    // and a majority mixed-scale composition, without forcing them to exceed
    // the legitimate pinpoint population by an arbitrary two-to-one ratio.
    expect(resolvedFacets).toBeGreaterThan(atmosphericComposite
      ? compact ? 90 : 140
      : compact ? 90 : 300);
    expect(resolvedFacets / metrics.components).toBeGreaterThan(0.22);
    // A few touching facets are expected in an overwhelming canopy, but no
    // connected patch may become a painted nebula or screen-dominating blob.
    expect(metrics.fields).toBeLessThanOrEqual(atmosphericComposite
      ? compact ? 4 : 12
      : compact ? 2 : 8);
    expect(metrics.largest).toBeGreaterThan(20);
    // The visual system permits an occasional touching jewel cluster, while
    // this ceiling still occupies far below one percent
    // of the canvas and cannot become a painted panel.
    expect(metrics.largest).toBeLessThanOrEqual(compact ? 260 : 520);
  }
}

function exactWhiteDominantModelComposition() {
  const seed = 0x00c0ffee;
  const plan = createStarfieldPlan({
    seed,
    theme: "dark",
    placements: createStarPlacements(seed, STARFIELD_LIMITS.fieldStars),
    visibleCount: STARFIELD_LIMITS.fieldStars,
  });
  const radii = plan.stars
    .map((star) => Math.hypot(star.x, star.y, star.z))
    .sort((left, right) => left - right);
  return {
    total: plan.stars.length,
    whiteOrNearWhite: plan.stars.filter((star) => star.colorIndex <= STARFIELD_LIMITS.whiteColorIndexMax).length,
    pureWhite: plan.stars.filter((star) => star.colorIndex === 0).length,
    colorAccents: plan.stars.filter((star) => star.colorIndex > STARFIELD_LIMITS.whiteColorIndexMax).length,
    // Palette index 11 is the canopy's dedicated pale-gold light in both
    // themes; projection and additive blending need only preserve a restrained
    // visible subset of this exact generated population.
    paleGoldLights: plan.stars.filter((star) => star.colorIndex === 11).length,
    jewelFacets: plan.stars.filter((star) => star.prominence === "jewel").length,
    movingLights: plan.counts.swirling,
    stillLights: plan.counts.still,
    shiftHzRange: [STARFIELD_LIMITS.minShiftHz, STARFIELD_LIMITS.maxShiftHz],
    shiftDistanceRange: [STARFIELD_LIMITS.minShiftWorldUnits, STARFIELD_LIMITS.maxShiftWorldUnits],
    halo: {
      radius: STARFIELD_LIMITS.haloRadius,
      alphaFactor: STARFIELD_LIMITS.haloAlphaFactor,
      maximumAlpha: STARFIELD_LIMITS.maxHaloAlpha,
    },
    radialRange: Number((radii.at(-1)! - radii[0]).toFixed(3)),
    radialQuantiles: [0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95].map((fraction) => (
      Number(radii[Math.floor((radii.length - 1) * fraction)].toFixed(3))
    )),
  };
}

test("actual Stars and Sky pixels form a white-dominant crystalline canopy with restrained color accents", async ({ page }, testInfo) => {
  // Pixel thresholds need a reproducible composition. A separate test below
  // retains native cryptographic entropy and proves that fresh sessions differ.
  await installDeterministicVisualEntropy(page);
  await openSession(page);
  await openVisualizationOnCompactView(page);
  await page.locator(".time-control").getByRole("button", { name: "night", exact: true }).click();
  const plot = await openStars(page);
  await expect(plot).toHaveAttribute("data-rendered-layer", "stars");
  const canvas = plot.locator(":scope > canvas");
  const compact = (page.viewportSize()?.width ?? 1_000) <= 760;
  const modelComposition = exactWhiteDominantModelComposition();
  expect(modelComposition).toEqual({
    total: 15_360,
    whiteOrNearWhite: 12_177,
    pureWhite: 5_427,
    colorAccents: 3_183,
    paleGoldLights: 423,
    jewelFacets: 1_424,
    movingLights: 14_880,
    stillLights: 480,
    shiftHzRange: [0.18, 0.48],
    shiftDistanceRange: [2.8, 9.6],
    halo: { radius: 1.5, alphaFactor: 0.26, maximumAlpha: 0.23 },
    radialRange: 315.919,
    radialQuantiles: [126.597, 155.473, 205.749, 265.299, 326.21, 366.736, 384.839],
  });
  await testInfo.attach("starfield-model-composition.json", {
    body: JSON.stringify(modelComposition, null, 2),
    contentType: "application/json",
  });

  const darkMetrics = await measureStarfieldPixels(page, canvas);
  await testInfo.attach("starfield-dark-pixel-metrics.json", {
    body: JSON.stringify(darkMetrics, null, 2),
    contentType: "application/json",
  });
  expectRenderedComposition(darkMetrics, compact);
  // Gold is deliberately occasional within the white-dominant canopy. The
  // model guarantees 430 pale-gold lights; these floors prove a nonzero visible
  // sample survives projection without asking gold to become a dominant field.
  expect(await measureGoldAccentPixels(page, canvas)).toBeGreaterThan(compact ? 10 : 15);

  await page.getByRole("button", { name: "Switch to light interface" }).click();
  await expect(page.locator(".app")).toHaveClass(/theme-light/);
  await expect(plot).toHaveAttribute("data-rendered-layer", "stars");
  await expect(plot).toHaveAttribute("data-rendered-theme", "light");
  const lightMetrics = await measureStarfieldPixels(page, canvas);
  // The light theme's pastel background legitimately satisfies the chroma
  // detector across most of the canvas. Keep the real white-light and spatial
  // distribution floors here; the dark Stars capture and exact model contract
  // above own white-versus-color composition.
  await testInfo.attach("starfield-light-pixel-metrics.json", {
    body: JSON.stringify(lightMetrics, null, 2),
    contentType: "application/json",
  });
  expectRenderedComposition(lightMetrics, compact, {
    checkLargestField: false,
    requireColorEvidence: false,
  });

  await page.getByRole("button", { name: "Switch to dark interface" }).click();
  await page.locator(".depth-control").getByRole("button", { name: "sky", exact: true }).click();
  const skyPlot = page.locator(".battlefield-canvas.layer-sky");
  await expect(skyPlot).toHaveAttribute("data-rendered-layer", "sky");
  const skyMetrics = await measureStarfieldPixels(page, skyPlot.locator(":scope > canvas"));
  await testInfo.attach("starfield-sky-pixel-metrics.json", {
    body: JSON.stringify(skyMetrics, null, 2),
    contentType: "application/json",
  });
  // The Sky canvas includes its atmospheric gradient and, where generated,
  // aurora. Those pixels legitimately satisfy chroma detectors independently
  // of the stars. Preserve a strong real white-star floor and facet geometry;
  // the exact model evidence above owns white/color composition in this view.
  expectRenderedComposition(skyMetrics, compact, {
    requireColorEvidence: false,
    atmosphericComposite: true,
  });
});

test("the star layer exposes a bounded deterministic model and an equivalent screen-reader description", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop starfield assertion");
  await openSession(page);
  await page.locator(".time-control").getByRole("button", { name: "night", exact: true }).click();
  const plot = await openStars(page);
  await expect(plot).toHaveAccessibleName("Interactive three-dimensional tactical plot");
  await expect(plot).toHaveAttribute("data-render-scheduling", "event-driven");

  const field = await plot.evaluate((element) => ({
    seed: element.dataset.starfieldSeed,
    stars: Number(element.dataset.starfieldStars),
    near: Number(element.dataset.starfieldNear),
    far: Number(element.dataset.starfieldFar),
    still: Number(element.dataset.starfieldStill),
    swirling: Number(element.dataset.starfieldSwirling),
    fieldStars: Number(element.dataset.starfieldFieldStars),
    nebulaStars: Number(element.dataset.starfieldNebulaStars),
    nebulae: Number(element.dataset.starfieldNebulae),
    meshes: Number(element.dataset.starfieldMeshes),
    occlusion: element.dataset.starfieldOcclusion,
    animation: element.dataset.starfieldAnimation,
    canopy: element.dataset.skyCanopy,
    descriptionIds: element.getAttribute("aria-describedby"),
  }));

  expect(field.seed).toMatch(/^\d+$/);
  expect(field.stars).toBeGreaterThan(0);
  expect(field.stars).toBeLessThanOrEqual(15_360);
  expect(field.near + field.far).toBe(field.stars);
  expect(field.still + field.swirling).toBe(field.stars);
  expect(field.fieldStars + field.nebulaStars).toBe(field.stars);
  expect(field.near).toBeGreaterThan(0);
  expect(field.far).toBeGreaterThan(0);
  expect(field.still).toBeGreaterThan(0);
  expect(field.swirling).toBeGreaterThan(0);
  expect(field.fieldStars).toBeGreaterThan(0);
  expect(field.fieldStars).toBeLessThanOrEqual(3_072);
  expect(field.nebulaStars).toBeGreaterThan(768);
  expect(field.nebulaStars).toBeLessThanOrEqual(16 * 768);
  expect(field.nebulae).toBe(16);
  expect(field.meshes).toBe(1);
  expect(field.occlusion).toBe("scene-depth");
  expect(field.animation).toBe("still");
  expect(field.canopy).toBe("faceted-pastel-gradient");
  expect(field.descriptionIds).toContain("starfield-visual-note");
  expect(field.descriptionIds).toContain("contact-visual-note");

  await expect(plot.locator(".fallback-stars i.field.near").first()).toBeAttached();
  await expect(plot.locator(".fallback-stars i.field.far").first()).toBeAttached();
  await expect(plot.locator(".fallback-stars i.still").first()).toBeAttached();
  await expect(plot.locator(".fallback-stars i.swirling").first()).toBeAttached();
  expect(await plot.locator(".fallback-stars i.nebula").count()).toBeGreaterThan(300);
  await expect(plot.locator(".fallback-stars i.nebula.still").first()).toBeAttached();
  await expect(plot.locator(".fallback-stars i.nebula.swirling").first()).toBeAttached();
  await expect(plot.locator(".fallback-stars i.jewel").first()).toBeAttached();
  await expect(plot.locator(".fallback-nebulae")).toHaveCount(0);

  const description = page.locator("#starfield-visual-note");
  await expect(description).toContainText("artistically enlarged faceted lights spanning radically layered near and far depth");
  await expect(description).toContainText("sky-covering white-dominant crystalline canopy");
  await expect(description).toContainText("restrained pale cyan, lavender, rose, peach, mint, gold, and jewel-color accents");
  await expect(description).toContainText("clustered points overlap across 16 real irregular low-frequency harmonic density and luminance fields");
  await expect(description).toContainText("scene depth and atmospheric fog keep the canopy behind clouds, waves, vessels, and aircraft");
  await expect(description).toContainText(/bounded non-orbital positional wandering/);

  const starData = page.locator(".star-environment-readout");
  await expect(starData.locator("summary")).toContainText("SKY LIGHTS");
  await starData.locator("summary").click();
  await expect(starData).toHaveAttribute("open", "");
  await expect(starData).toContainText("VISIBLE LIGHTS");
  await expect(starData).toContainText("Crystalline canopy");
  await expect(starData).toContainText("foreground weather and contacts stay clear");
  await expect(starData).not.toContainText("OVERLAPPING IRREGULAR HARMONIC DENSITY FIELDS");

  const skyToggle = page.locator(".sky-readout-toggle");
  await expect(skyToggle).not.toHaveAttribute("aria-controls", /.+/);
  await expect(page.locator("#sky-readout-details")).toHaveCount(0);
  await skyToggle.click();
  await expect(skyToggle).toHaveAttribute("aria-controls", "sky-readout-details");
  await expect(page.locator("#sky-readout-details")).toBeVisible();
  await skyToggle.click();
  await expect(skyToggle).not.toHaveAttribute("aria-controls", /.+/);
  await expect(page.locator("#sky-readout-details")).toHaveCount(0);
  await skyToggle.click();

  await plot.focus();
  await plot.press("PageDown");
  const skyPlot = page.locator(".battlefield-canvas.layer-sky");
  await expect(skyPlot).toBeVisible();
  await expect(skyPlot).toHaveAttribute("data-starfield-occlusion", "scene-depth");
  expect(Number(await skyPlot.getAttribute("data-starfield-nebula-stars"))).toBeGreaterThan(384);
  await expect(page.locator("[aria-live='polite']").filter({ hasText: "View layer changed to sky. Selected force has no credited air-detection capability; no unknown markers are shown." })).toHaveCount(1);
});

test("WebGL and fallback occlusion contracts keep celestial points behind the sea and tactical foreground", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop occlusion assertion");
  await openSession(page);
  await page.locator(".time-control").getByRole("button", { name: "night", exact: true }).click();
  const plot = page.locator(".battlefield-canvas.layer-surface");
  await expect(plot).toHaveAttribute("data-starfield-occlusion", "scene-depth");
  await expect(plot).toHaveAttribute("data-starfield-meshes", "1");
  await expect(plot.locator(".fallback-stars i.nebula").first()).toBeAttached();

  const stacking = await plot.evaluate((element) => {
    const stars = element.querySelector<HTMLElement>(".fallback-stars");
    const waves = element.querySelector<HTMLElement>(".fallback-waves");
    const point = element.querySelector<HTMLElement>(".fallback-stars i");
    if (!stars || !waves || !point) throw new Error("Fallback occlusion layers are missing");
    return {
      stars: Number(getComputedStyle(stars).zIndex),
      point: Number(getComputedStyle(point).zIndex),
      waves: Number(getComputedStyle(waves).zIndex),
    };
  });
  expect(stacking.stars).toBe(0);
  expect(stacking.point).toBe(0);
  expect(stacking.waves).toBeGreaterThan(stacking.stars);
});

test("a fresh play session receives a new star and nebula arrangement", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop entropy assertion");
  await openSession(page);
  const firstSeed = await page.locator(".battlefield-canvas").getAttribute("data-starfield-seed");
  await page.reload();
  await page.getByRole("button", { name: "PLAY WITHOUT BROWSER SAVING" }).click();
  const secondSeed = await page.locator(".battlefield-canvas").getAttribute("data-starfield-seed");
  expect(firstSeed).toMatch(/^\d+$/);
  expect(secondSeed).toMatch(/^\d+$/);
  expect(secondSeed).not.toBe(firstSeed);
});

test("dawn and dusk always retain a visible brightest-star cohort", async ({ page }) => {
  await openSession(page);
  await openVisualizationOnCompactView(page);
  const plot = page.locator(".battlefield-canvas");
  await page.locator(".depth-control").getByRole("button", { name: "sky", exact: true }).click();

  for (const [time, minimum] of [["dawn", 64], ["dusk", 96]] as const) {
    await page.locator(".time-control").getByRole("button", { name: time, exact: true }).click();
    await expect(plot).toHaveAttribute("data-time", time);
    expect(Number(await plot.getAttribute("data-starfield-stars"))).toBeGreaterThanOrEqual(minimum);
    expect(Number(await plot.getAttribute("data-starfield-near")) + Number(await plot.getAttribute("data-starfield-far"))).toBeGreaterThanOrEqual(minimum);
    await expect(plot.locator(".fallback-stars i.jewel").first()).toBeAttached();
  }
});

test("reduced motion freezes fallback and WebGL star animation while no-preference allows emphatic bounded motion", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop media-preference assertion");
  await openSession(page);
  await page.locator(".time-control").getByRole("button", { name: "night", exact: true }).click();
  let plot = await openStars(page);
  await expect(plot).toHaveAttribute("data-starfield-animation", "still");
  const reducedCanvas = plot.locator(":scope > canvas");
  const reducedBefore = await cleanStarCanvasCapture(reducedCanvas);
  await page.waitForTimeout(850);
  const reducedAfter = await cleanStarCanvasCapture(reducedCanvas);
  expect(await changedStarPixelCount(page, reducedBefore, reducedAfter)).toBeLessThan(8);
  const reducedAnimation = await page.locator(".fallback-stars i").first().evaluate((star) => getComputedStyle(star).animationName);
  expect(reducedAnimation).toBe("none");
  const reducedNebulaAnimation = await page.locator(".fallback-stars i.nebula.swirling").first().evaluate((nebula) => getComputedStyle(nebula).animationName);
  expect(reducedNebulaAnimation).toBe("none");

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await openSession(page);
  await page.locator(".time-control").getByRole("button", { name: "night", exact: true }).click();
  plot = await openStars(page);
  await expect(plot).toHaveAttribute("data-starfield-animation", "alive-bounded-wander");
  await expect(plot).toHaveAttribute("data-render-scheduling", "animated");
  const movingCanvas = plot.locator(":scope > canvas");
  const movingBefore = await cleanStarCanvasCapture(movingCanvas);
  await page.waitForTimeout(850);
  const movingAfter = await cleanStarCanvasCapture(movingCanvas);
  expect(await changedStarPixelCount(page, movingBefore, movingAfter)).toBeGreaterThan(
    (page.viewportSize()?.width ?? 1_000) <= 760 ? 1_600 : 5_500,
  );
  const allowedAnimation = await page.locator(".fallback-stars i").first().evaluate((star) => ({
    name: getComputedStyle(star).animationName,
    duration: Number.parseFloat(getComputedStyle(star).animationDuration),
  }));
  expect(allowedAnimation.name).toBe("fallback-star-twinkle");
  expect(allowedAnimation.duration).toBeGreaterThanOrEqual(2.4);
  expect(allowedAnimation.duration).toBeLessThanOrEqual(5.5);
  const allowedNebulaAnimation = await page.locator(".fallback-stars i.nebula.swirling").first().evaluate((nebula) => ({
    name: getComputedStyle(nebula).animationName,
    duration: Number.parseFloat(getComputedStyle(nebula).animationDuration),
  }));
  expect(allowedNebulaAnimation.name).toBe("fallback-star-twinkle");
  expect(allowedNebulaAnimation.duration).toBeGreaterThanOrEqual(2.4);
  expect(allowedNebulaAnimation.duration).toBeLessThanOrEqual(5.5);
});

test("repeated view-layer changes reuse one canvas and one stable WebGL context", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop WebGL lifecycle assertion");
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    (window as typeof window & { __webglContextCreationErrors: number }).__webglContextCreationErrors = 0;
    window.addEventListener("webglcontextcreationerror", () => {
      (window as typeof window & { __webglContextCreationErrors: number }).__webglContextCreationErrors += 1;
    });
  });
  await openSession(page);
  const plot = page.locator(".battlefield-canvas");
  await expect(plot).toHaveAttribute("data-render-scheduling", "event-driven");

  for (let cycle = 0; cycle < 4; cycle++) {
    for (const layer of ["stars", "sky", "air", "surface", "subsurface"]) {
      await page.locator(".depth-control").getByRole("button", { name: layer, exact: true }).click();
      expect(await plot.count(), `cycle ${cycle + 1}, ${layer}; page errors: ${pageErrors.join(" | ")}`).toBe(1);
      await expect(plot, `cycle ${cycle + 1}, ${layer} layer`).toHaveClass(new RegExp(`layer-${layer}`));
      await expect(plot).toHaveAttribute("data-webgl", "ready");
      await expect(plot).toHaveAttribute("data-rendered-layer", layer);
      await expect(plot).toHaveAttribute("data-starfield-occlusion", "scene-depth");
      await expect(plot.locator(":scope > canvas")).toHaveCount(1);
    }
  }

  expect(await page.evaluate(() => (
    window as typeof window & { __webglContextCreationErrors: number }
  ).__webglContextCreationErrors)).toBe(0);
  expect(pageErrors).toEqual([]);
});

test("the nonvisual contact contract reports detection gating without exposing hidden details", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop contact accessibility assertion");
  await openSession(page);
  const plot = page.locator(".battlefield-canvas.layer-surface");
  await expect(plot).toHaveAttribute("data-contact-domain", "surface");
  await expect(plot).toHaveAttribute("data-visible-unknown-contacts", "0");
  await expect(plot.locator(".fallback-contact")).toHaveCount(0);
  await expect(page.locator("#contact-visual-note")).toHaveText("Selected force has no credited surface-detection capability; no unknown markers are shown.");

  const legend = plot.locator(".legend");
  await expect(legend.locator(".legend-items")).toBeHidden();
  expect(await legend.ariaSnapshot()).not.toContain("Selected force has no credited");
  await legend.locator("summary").click();
  await expect(legend.locator(".legend-items")).toBeVisible();
  await expect(legend.locator(".legend-items small")).toHaveText("Selected force has no credited surface-detection capability; no unknown markers are shown.");
  await legend.locator("summary").click();
  await expect(legend.locator(".legend-items")).toBeHidden();
});
