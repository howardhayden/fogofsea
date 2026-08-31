import { expect, test, type Locator, type Page } from "@playwright/test";

async function openSession(page: Page) {
  await page.goto("/");
  const privacyDialog = page.getByRole("dialog", { name: "HOW SHOULD THIS GAME REMEMBER YOU?" });
  await expect(privacyDialog).toBeVisible();
  await page.getByRole("button", { name: "PLAY WITHOUT BROWSER SAVING" }).click();
  await expect(privacyDialog).toBeHidden();
  if ((page.viewportSize()?.width ?? 1_000) <= 760) {
    await page.locator(".mobile-disclosure summary").click();
    await page.getByRole("button", { name: "VISUALIZATION", exact: true }).click();
  }
}

test("scenario weather uses natural cloud-cover labels", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 1_000) <= 760, "Desktop mission conditions remain visible during the assertion.");
  await openSession(page);
  const weather = page.locator(".conditions-grid > div").filter({ hasText: "WEATHER" });
  await expect(weather).toBeVisible();
  await expect(weather).not.toContainText(/broken/i);
  await expect(page.locator("#mission-analysis")).not.toContainText(/\bbroken clouds?\b/i);
});

async function openForceDesignOnDesktop(page: Page) {
  if ((page.viewportSize()?.width ?? 1_000) <= 760) return;
  await page.locator(".warfare-grid").getByRole("button", { name: /Intelligence and reconnaissance/i }).click();
  await page.locator("#strategic-end-state").selectOption("access");
  await page.locator("#strategic-primary-theory").selectOption("sun-tzu");
  await page.locator("#strategic-partner-theory").selectOption("clausewitz");
  await page.locator("#strategic-guardrail").selectOption("escalation");
  await page.getByRole("button", { name: "CONTINUE TO FORCE DESIGN", exact: true }).click();
}

async function addOneVisibleVesselOnDesktop(page: Page) {
  if ((page.viewportSize()?.width ?? 1_000) <= 760) return;
  await openForceDesignOnDesktop(page);
  await page.getByRole("button", { name: "Add one Fleet aviation ship" }).click();
  await expect.poll(async () => page.locator(".battlefield-canvas .fallback-ship").count()).toBeGreaterThan(0);
}

async function canvasDifferenceMetrics(page: Page, first: string, second: string) {
  return page.evaluate(async ({ firstCapture, secondCapture }) => {
    const decode = async (capture: string) => {
      const image = new Image();
      image.src = `data:image/png;base64,${capture}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Pixel comparison context unavailable");
      context.drawImage(image, 0, 0);
      return context.getImageData(0, 0, canvas.width, canvas.height);
    };
    const [before, after] = await Promise.all([decode(firstCapture), decode(secondCapture)]);
    let changed = 0;
    let softEdge = 0;
    let strongCore = 0;
    let nativeCool = 0;
    let minX = before.width;
    let maxX = -1;
    let minY = before.height;
    let maxY = -1;
    for (let index = 0; index < before.data.length; index += 4) {
      const redDifference = after.data[index] - before.data[index];
      const greenDifference = after.data[index + 1] - before.data[index + 1];
      const blueDifference = after.data[index + 2] - before.data[index + 2];
      const absoluteDifference = Math.abs(redDifference) + Math.abs(greenDifference) + Math.abs(blueDifference);
      if (absoluteDifference >= 4 && absoluteDifference < 45) softEdge += 1;
      if (absoluteDifference >= 100) strongCore += 1;
      if (greenDifference >= 6 && greenDifference >= redDifference + 2 && blueDifference >= redDifference) nativeCool += 1;
      if (absoluteDifference < 12) continue;
      changed += 1;
      const pixel = index / 4;
      const x = pixel % before.width;
      const y = Math.floor(pixel / before.width);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    return {
      width: before.width,
      height: before.height,
      changed,
      softEdge,
      strongCore,
      nativeCool,
      footprintWidth: maxX < 0 ? 0 : maxX - minX + 1,
      footprintHeight: maxY < 0 ? 0 : maxY - minY + 1,
    };
  }, { firstCapture: first, secondCapture: second });
}

async function cleanCanvasCapture(canvas: Locator) {
  const page = canvas.page();
  const overlapping = page.locator(".battlefield-canvas > :not(canvas), .mission-panel, .force-panel, .plot-topline");
  const previousVisibility = await overlapping.evaluateAll((elements) => elements.map((element) => {
    const htmlElement = element as HTMLElement;
    const value = htmlElement.style.getPropertyValue("visibility");
    const priority = htmlElement.style.getPropertyPriority("visibility");
    htmlElement.style.setProperty("visibility", "hidden", "important");
    return { value, priority };
  }));
  try {
    return (await canvas.screenshot()).toString("base64");
  } finally {
    await overlapping.evaluateAll((elements, states) => elements.forEach((element, index) => {
      const htmlElement = element as HTMLElement;
      const state = states[index];
      if (!state?.value) htmlElement.style.removeProperty("visibility");
      else htmlElement.style.setProperty("visibility", state.value, state.priority);
    }), previousVisibility);
  }
}

async function changedPixelCount(page: Page, first: string, second: string) {
  return page.evaluate(async ({ firstCapture, secondCapture }) => {
    const decode = async (capture: string) => {
      const image = new Image();
      image.src = `data:image/png;base64,${capture}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Pixel comparison context unavailable");
      context.drawImage(image, 0, 0);
      return context.getImageData(0, 0, canvas.width, canvas.height);
    };
    const [left, right] = await Promise.all([decode(firstCapture), decode(secondCapture)]);
    if (left.width !== right.width || left.height !== right.height) return Number.POSITIVE_INFINITY;
    let changed = 0;
    for (let index = 0; index < left.data.length; index += 4) {
      const difference = Math.abs(left.data[index] - right.data[index])
        + Math.abs(left.data[index + 1] - right.data[index + 1])
        + Math.abs(left.data[index + 2] - right.data[index + 2]);
      if (difference >= 12) changed += 1;
    }
    return changed;
  }, { firstCapture: first, secondCapture: second });
}

test("surface waves expose a bounded screen-reader model and animate only when motion is allowed", async ({ page }) => {
  await openSession(page);
  const plot = page.locator(".battlefield-canvas.layer-surface");
  await expect(plot).toHaveAttribute("data-rendered-layer", "surface");
  const model = await plot.evaluate((element) => ({
    components: Number(element.dataset.waveComponents),
    foam: Number(element.dataset.waveFoamPatches),
    heading: Number(element.dataset.waveHeading),
    peakToTrough: Number(element.dataset.wavePeakToTrough),
    describedBy: element.getAttribute("aria-describedby") ?? "",
  }));
  expect(model.components).toBe(3);
  expect(model.foam).toBeGreaterThanOrEqual(0);
  expect(model.foam).toBeLessThanOrEqual(42);
  expect(model.heading).toBeGreaterThanOrEqual(0);
  expect(model.heading).toBeLessThan(360);
  expect(model.peakToTrough).toBeGreaterThan(0);
  expect(model.describedBy).toContain("wave-visual-note");
  await expect(page.locator("#wave-visual-note")).toContainText("Narrow crests, broad troughs, and a forward lip");
  await expect(page.locator("#wave-visual-note")).toContainText("Surface vessels heave and roll");

  const reducedState = await plot.evaluate((element) => ({
    scheduling: element.dataset.renderScheduling,
    starAnimation: element.dataset.starfieldAnimation,
    dreamEmission: element.dataset.dreamEmission,
    cloudMotion: element.dataset.cloudMotion,
    auroraMotion: element.dataset.auroraMotion,
  }));
  await page.waitForTimeout(650);
  expect(reducedState).toMatchObject({
    scheduling: "event-driven",
    starAnimation: "still",
    cloudMotion: "still",
    auroraMotion: "none",
  });
  await expect(plot).toHaveAttribute("data-render-scheduling", "event-driven");
  expect(await page.locator(".fallback-waves").evaluate((node) => getComputedStyle(node).animationName)).toBe("none");

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await openSession(page);
  const movingPlot = page.locator(".battlefield-canvas.layer-surface");
  await expect(movingPlot).toHaveAttribute("data-render-scheduling", "animated");
  const movingCanvas = movingPlot.locator(":scope > canvas");
  const movingBefore = await cleanCanvasCapture(movingCanvas);
  await page.waitForTimeout(850);
  const movingAfter = await cleanCanvasCapture(movingCanvas);
  expect(await changedPixelCount(page, movingBefore, movingAfter)).toBeGreaterThan((page.viewportSize()?.width ?? 1_000) <= 760 ? 160 : 900);
  const waveAnimation = await page.locator(".fallback-waves").evaluate((node) => ({
    name: getComputedStyle(node).animationName,
    duration: Number.parseFloat(getComputedStyle(node).animationDuration),
  }));
  expect(waveAnimation.name).toBe("wave-drift");
  expect(waveAnimation.duration).toBeGreaterThanOrEqual(2.7);
});

test("subsurface cosmos never bypasses the active celestial sightline", async ({ page }) => {
  await openSession(page);
  await page.locator(".time-control").getByRole("button", { name: "night", exact: true }).click();
  await page.locator(".depth-control").getByRole("button", { name: "subsurface", exact: true }).click();
  const plot = page.locator(".battlefield-canvas.layer-subsurface");
  await expect(plot).toHaveAttribute("data-rendered-layer", "subsurface");
  const state = await plot.evaluate((element) => ({
    bodyVisible: element.dataset.celestialVisible === "true",
    stars: Number(element.dataset.starfieldStars),
    nebulae: Number(element.dataset.starfieldNebulae),
    appearance: element.dataset.starfieldAppearance,
    aperture: element.dataset.subsurfaceAperture,
    precipitationRendered: element.dataset.precipitationRendered,
    precipitationParticles: Number(element.dataset.precipitationParticles),
    rainCurtains: Number(element.dataset.rainCurtains),
    describedBy: element.getAttribute("aria-describedby") ?? "",
  }));
  expect(state.describedBy).toContain("subsurface-optics-note");
  expect(state.precipitationRendered).toBe("none");
  expect(state.precipitationParticles).toBe(0);
  expect(state.rainCurtains).toBe(0);
  await expect(plot.locator(".fallback-weather")).toHaveCount(0);
  if (state.bodyVisible) {
    expect(state.aperture).toBe("open");
    expect(state.stars).toBeGreaterThan(0);
    expect(state.appearance).toBe("direct through the water surface");
    await expect(page.locator("#subsurface-optics-note")).toContainText("not a reflection");
  } else {
    expect(state.stars).toBe(0);
    expect(state.nebulae).toBe(0);
    await expect(page.locator("#subsurface-optics-note")).toContainText(/no sun, moon, star, or nebula is visible underwater/i);
  }
  await plot.locator(".sky-readout-toggle").click();
  await expect(plot.locator("#sky-readout-details")).toContainText(state.bodyVisible ? "directly through the water surface—not as a reflection" : "does not pass the modeled water-and-weather sightline");
});

test("moon phase surfaces leave the unilluminated side transparent", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "One rendered DOM contract is sufficient");
  await openSession(page);
  await page.locator(".time-control").getByRole("button", { name: "night", exact: true }).click();
  const plot = page.locator(".battlefield-canvas");
  await expect(plot).toHaveAttribute("data-moon-phase-geometry", "illuminated-facets-only");
  await expect(plot).toHaveAttribute("data-moon-dark-side", "transparent");

  const swatch = page.locator(".sky-readout-toggle .moon-phase-swatch");
  await expect(swatch).toHaveAttribute("data-dark-side", "transparent");
  await expect(swatch.locator("path").first()).not.toHaveAttribute("d", /NaN|Infinity/);
  await expect(swatch.locator("rect")).toHaveCount(1);
  await expect(swatch.locator("[fill='#111827'], [fill='#000'], [fill='black']")).toHaveCount(0);
  expect(await swatch.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
});

test("reflection and aurora visual states have explicit nonvisual equivalents across themes", async ({ page }) => {
  const renderErrors: string[] = [];
  page.on("pageerror", (error) => renderErrors.push(error.message));
  await openSession(page);
  await page.locator(".time-control").getByRole("button", { name: "day", exact: true }).click();
  const plot = page.locator(".battlefield-canvas.layer-surface");
  await expect(plot).toHaveAttribute("data-rendered-layer", "surface");
  await expect(plot).toHaveAttribute("data-aurora", "none");
  await expect(plot).toHaveAttribute("data-aurora-bands", "0");
  await expect(plot).toHaveAttribute("data-aurora-darkness", "0.00");
  await expect(plot.locator(".fallback-aurora")).toHaveCount(0);
  const reflection = await plot.getAttribute("data-celestial-reflection");
  await plot.locator(".sky-readout-toggle").click();
  if (reflection === "sun") {
    await expect(plot.locator("#sky-readout-details")).toContainText("broken facets on the water are its reflection");
    await expect(plot.locator(".fallback-celestial-reflection.sun")).toBeAttached();
  } else {
    await expect(plot.locator("#sky-readout-details")).toContainText("not visible because it is below the horizon");
  }

  await page.locator(".time-control").getByRole("button", { name: "night", exact: true }).click();
  await expect(plot).toHaveAttribute("data-rendered-layer", "surface");
  const aurora = await plot.getAttribute("data-aurora");
  const auroraBands = Number(await plot.getAttribute("data-aurora-bands"));
  const auroraGeometry = await plot.getAttribute("data-aurora-geometry");
  const auroraMotion = await plot.getAttribute("data-aurora-motion");
  if (aurora === "none") {
    expect(auroraBands).toBe(0);
    expect(auroraGeometry).toBe("none");
    expect(auroraMotion).toBe("none");
    await expect(page.locator("#aurora-visual-note")).toHaveCount(0);
  } else {
    expect(["northern", "southern"]).toContain(aurora);
    expect(auroraBands).toBeGreaterThanOrEqual(5);
    expect(auroraGeometry).toBe("domain-warp-spline-multiveils");
    expect(auroraMotion).toBe("still");
    await expect(page.locator("#aurora-visual-note")).toContainText("long, tapered, low-poly curtain paths");
    await expect(plot).toHaveAttribute("data-aurora-engine", "fastnoise-lite-domain-warp-mit-adaptation");
    await expect(page.locator("#aurora-visual-note")).toContainText("five unjoined translucent veils");
    await expect(page.locator("#aurora-visual-note")).toContainText("distinct complementary color along its lower edge");
    await expect(page.locator("#aurora-visual-note")).toContainText("zero by day, clearly visible at dawn, brighter at dusk, and brightest at night");
    await expect(page.locator(".fallback-aurora i")).toHaveCount(auroraBands);
    expect(await page.locator(".fallback-aurora").evaluate((node) => getComputedStyle(node).mixBlendMode)).toBe("normal");
    const fallbackCurtains = await page.locator(".fallback-aurora i").evaluateAll((nodes) => nodes.map((node) => {
      const style = getComputedStyle(node);
      return {
        filter: style.filter,
        lowerEdgeColor: style.getPropertyValue("--aurora-lower-edge").trim(),
        minWidth: style.minWidth,
        mask: style.maskImage || style.webkitMaskImage,
        widthRatio: node.getBoundingClientRect().width / (node.parentElement?.getBoundingClientRect().width || 1),
        heightRatio: node.getBoundingClientRect().height / (node.parentElement?.getBoundingClientRect().height || 1),
      };
    }));
    expect(fallbackCurtains.every((curtain) => curtain.filter.includes("blur") && curtain.filter.includes("drop-shadow"))).toBe(true);
    expect(fallbackCurtains.every((curtain) => /^#[0-9a-f]{6}$/i.test(curtain.lowerEdgeColor))).toBe(true);
    expect(fallbackCurtains.every((curtain) => curtain.minWidth === "0px")).toBe(true);
    expect(fallbackCurtains.every((curtain) => curtain.mask.includes("linear-gradient") && !curtain.mask.includes("radial-gradient"))).toBe(true);
    expect(fallbackCurtains.every((curtain) => curtain.widthRatio >= 0.95 && curtain.heightRatio >= 0.14)).toBe(true);
  }

  const beforeTheme = await plot.evaluate((element) => ({
    seed: element.dataset.starfieldSeed,
    wave: element.dataset.waveHeading,
  }));
  await page.getByRole("button", { name: "Switch to light interface" }).click();
  await expect(plot).toHaveAttribute("data-rendered-theme", "light");
  const afterTheme = await plot.evaluate((element) => ({
    seed: element.dataset.starfieldSeed,
    wave: element.dataset.waveHeading,
  }));
  expect(afterTheme).toEqual(beforeTheme);
  expect(renderErrors, "aurora and atmosphere shaders must render without page errors").toEqual([]);
});

test("weather exposes bounded tiers, meteorological clouds, and elevation-responsive fog", async ({ page }) => {
  await openSession(page);
  const plot = page.locator(".battlefield-canvas.layer-surface");
  await expect(plot).toHaveAttribute("data-rendered-layer", "surface");
  const model = await plot.evaluate((element) => ({
    tier: Number(element.dataset.weatherTier),
    fogClass: element.dataset.fogClass,
    fogBanks: Number(element.dataset.fogBanks),
    fogDensity: Number(element.dataset.fogDensity),
    cloudRegime: element.dataset.cloudRegime,
    cloudMasses: Number(element.dataset.cloudMasses),
    cloudLobes: Number(element.dataset.cloudLobes),
    cloudGeometry: element.dataset.cloudGeometry,
    cloudMotion: element.dataset.cloudMotion,
    presentation: element.dataset.precipitationPresentation,
    source: element.dataset.precipitationSource,
    cells: Number(element.dataset.precipitationCells),
    particleSize: Number(element.dataset.precipitationParticleSize),
    fallSpeed: Number(element.dataset.precipitationFallSpeed),
    streakLength: Number(element.dataset.precipitationStreakLength),
    particles: Number(element.dataset.precipitationParticles),
    curtains: Number(element.dataset.rainCurtains),
    stormLight: element.dataset.stormLight,
    describedBy: element.getAttribute("aria-describedby") ?? "",
  }));
  expect(model.tier).toBeGreaterThanOrEqual(0);
  expect(model.tier).toBeLessThanOrEqual(5);
  expect(["clear", "haze", "mist", "fog", "dense-fog"]).toContain(model.fogClass);
  expect(model.fogBanks).toBeGreaterThanOrEqual(0);
  expect(model.fogBanks).toBeLessThanOrEqual(6);
  expect(model.fogDensity).toBeGreaterThan(0);
  expect(["clear", "cumulus", "altocumulus", "stratocumulus", "stratus", "nimbostratus", "cumulonimbus"]).toContain(model.cloudRegime);
  expect(model.cloudLobes).toBeGreaterThanOrEqual(0);
  expect(model.cloudLobes).toBeLessThanOrEqual(48);
  expect(model.cloudMasses).toBeGreaterThanOrEqual(0);
  expect(model.cloudMasses).toBeLessThanOrEqual(10);
  expect(["none", "cohesive-faceted-shells"]).toContain(model.cloudGeometry);
  expect(["none", "still"]).toContain(model.cloudMotion);
  expect(["none", "light", "steady", "heavy", "squall", "extreme"]).toContain(model.presentation);
  expect(model.source).toBe("cloud-bases");
  expect(model.cells).toBeGreaterThanOrEqual(0);
  expect(model.cells).toBeLessThanOrEqual(8);
  expect(model.particleSize).toBeGreaterThanOrEqual(1);
  expect(model.fallSpeed).toBeGreaterThanOrEqual(0);
  expect(model.streakLength).toBeGreaterThanOrEqual(0);
  expect(model.particles).toBeGreaterThanOrEqual(0);
  expect(model.particles).toBeLessThanOrEqual(8_800);
  expect(model.curtains).toBeGreaterThanOrEqual(0);
  expect(model.curtains).toBeLessThanOrEqual(6);
  expect(["none", "localized-non-flashing"]).toContain(model.stormLight);
  expect(model.describedBy).toContain("weather-visual-note");
  await expect(page.locator("#weather-visual-note")).toContainText("Fog thins smoothly with upward view angle and observer altitude");
  await expect(plot.locator(".fallback-fog i")).toHaveCount(model.fogBanks);
  await expect(plot.locator(".fallback-clouds i")).toHaveCount(model.cloudMasses);
  await expect(plot.locator(".fallback-weather > i")).toHaveCount(model.cells);
  const initialDensity = Number(await plot.getAttribute("data-fog-density"));
  await plot.focus();
  for (let index = 0; index < 4; index++) await plot.press("ArrowUp");
  await expect.poll(async () => Number(await plot.getAttribute("data-fog-density"))).toBeLessThanOrEqual(initialDensity);
  const fallbackFog = plot.locator(".fallback-fog i").first();
  const fogAnimation = await fallbackFog.count()
    ? await fallbackFog.evaluate((node) => getComputedStyle(node).animationName)
    : "none";
  expect(fogAnimation).toBe("none");
});

test("regional wildlife is bounded environmental scenery and never a tactical contact", async ({ page }) => {
  await openSession(page);
  let plot = page.locator(".battlefield-canvas.layer-surface");
  await expect(plot).toHaveAttribute("data-rendered-layer", "surface");
  await expect(plot).toHaveAttribute("data-wildlife-status", "environmental-nontactical");
  const surface = await plot.evaluate((element) => ({
    groups: Number(element.dataset.wildlifeGroups),
    individuals: Number(element.dataset.wildlifeIndividuals),
    proximity: element.dataset.wildlifeProximity,
    motion: element.dataset.wildlifeMotion,
    describedBy: element.getAttribute("aria-describedby") ?? "",
  }));
  expect(surface.groups).toBeGreaterThanOrEqual(0);
  expect(surface.groups).toBeLessThanOrEqual(6);
  expect(surface.individuals).toBeGreaterThanOrEqual(0);
  expect(surface.individuals).toBeLessThanOrEqual(48);
  expect(["near-land", "coastal", "offshore"]).toContain(surface.proximity);
  expect(["none", "active-pose-frozen", "bounded-route-active"]).toContain(surface.motion);
  await expect(plot).toHaveAttribute("data-wildlife-engine", surface.individuals ? "articulated-low-poly-wildlife" : "none");
  await expect(plot.locator(".fallback-wildlife i")).toHaveCount(surface.individuals);
  if (surface.individuals > 0) {
    await expect(plot).toHaveAttribute("data-wildlife-interaction", "click-or-keyboard-greeting");
    await expect(plot).toHaveAttribute("data-wildlife-route", "closed-ecological-waypoints");
    expect(surface.describedBy).toContain("wildlife-visual-note");
    await expect(page.locator("#wildlife-visual-note")).toContainText("fits the accepted region");
    await expect(page.locator("#wildlife-visual-note")).toContainText("non-tactical scenery");
    await expect(page.locator("#wildlife-visual-note")).toContainText("never represents a contact");
    await expect(page.locator("#wildlife-visual-note")).toContainText("bounded ecological route");
    await expect(page.locator("#wildlife-visual-note")).toContainText("never the whole group");
    await expect(page.locator("#wildlife-visual-note")).toContainText("confused head scratch");
    const greet = plot.locator(".wildlife-keyboard-greet");
    await greet.focus();
    await expect(greet).toBeVisible();
    await greet.press("Enter");
    await expect(plot.locator("#wildlife-reaction-status")).not.toBeEmpty();
    await expect(plot).not.toHaveAttribute("data-wildlife-last-reaction", "none");
    await expect(plot.locator(".fallback-wildlife i.reacting")).toHaveCount(1);
  } else {
    await expect(plot).toHaveAttribute("data-wildlife-interaction", "none");
    await expect(plot.locator(".wildlife-keyboard-greet")).toHaveCount(0);
  }

  await plot.locator(".depth-control").getByRole("button", { name: "stars", exact: true }).click();
  plot = page.locator(".battlefield-canvas.layer-stars");
  await expect(plot).toHaveAttribute("data-rendered-layer", "stars");
  await expect(plot).toHaveAttribute("data-wildlife-individuals", "0");
  await expect(plot.locator(".fallback-wildlife i")).toHaveCount(0);

  await plot.locator(".depth-control").getByRole("button", { name: "subsurface", exact: true }).click();
  plot = page.locator(".battlefield-canvas.layer-subsurface");
  await expect(plot).toHaveAttribute("data-rendered-layer", "subsurface");
  expect(await plot.locator(".fallback-wildlife .wildlife-air, .fallback-wildlife .wildlife-ice, .fallback-wildlife .wildlife-surface").count()).toBe(0);
});

test("selected operational subjects breathe faintly while stars remain a separate motion channel", async ({ page }) => {
  test.setTimeout(90_000);
  const shaderErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && /shader|webgl program|gl_invalid/i.test(message.text())) shaderErrors.push(message.text());
  });
  await openSession(page);
  await addOneVisibleVesselOnDesktop(page);
  await page.locator(".time-control").getByRole("button", { name: "night", exact: true }).click();
  let plot = page.locator(".battlefield-canvas.layer-surface");
  await expect(plot).toHaveAttribute("data-dream-emission", "still");
  await expect(plot).toHaveAttribute("data-dream-emission-halo", "dual-native-color-shell");
  await expect(plot).toHaveAttribute("data-dream-emission-occlusion", "scene-depth-fog-waves");
  await expect(page.locator("#weather-visual-note")).toContainText("thin, soft native-color halos");
  await expect(page.locator("#weather-visual-note")).toContainText("scene depth, fog, and waves continue to soften or cover them");
  const unitCount = await plot.locator(".fallback-ship, .fallback-aircraft").count();
  if ((page.viewportSize()?.width ?? 1_000) > 760) expect(unitCount).toBeGreaterThan(0);
  await expect(plot.locator(".fallback-dream-halo")).toHaveCount(unitCount);
  if (unitCount > 0) {
    const reduced = await plot.locator(".fallback-dream-halo").first().evaluate((halo) => ({
      animation: getComputedStyle(halo).animationName,
      opacity: Number.parseFloat(getComputedStyle(halo).opacity),
      scale: getComputedStyle(halo).scale,
      color: getComputedStyle(halo).color,
      z: Number(getComputedStyle(halo).zIndex),
    }));
    expect(reduced.animation).toBe("none");
    expect(reduced.opacity).toBeGreaterThanOrEqual(0.18);
    expect(Number.parseFloat(reduced.scale)).toBeGreaterThanOrEqual(1.06);
    expect(reduced.color).not.toBe("rgb(255, 255, 255)");
    expect(reduced.z).toBeLessThan(Number(await plot.locator(".fallback-waves").evaluate((waves) => getComputedStyle(waves).zIndex)));
  }

  await page.locator(".time-control").getByRole("button", { name: "day", exact: true }).click();
  await expect(plot).toHaveAttribute("data-dream-emission", "off");
  await expect(plot).toHaveAttribute("data-dream-emission-halo", "none");
  if (unitCount > 0) await expect(plot.locator(".fallback-dream-halo").first()).toBeHidden();

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await openSession(page);
  await addOneVisibleVesselOnDesktop(page);
  await page.locator(".time-control").getByRole("button", { name: "night", exact: true }).click();
  plot = page.locator(".battlefield-canvas.layer-surface");
  await expect(plot).toHaveAttribute("data-dream-emission", "breathing");
  const movingHalo = plot.locator(".fallback-dream-halo").first();
  if (await movingHalo.count()) {
    const motion = await movingHalo.evaluate((halo) => ({
      animation: getComputedStyle(halo).animationName,
      duration: Number.parseFloat(getComputedStyle(halo).animationDuration),
    }));
    expect(motion.animation).toBe("dream-emission-breathe");
    expect(motion.duration).toBeGreaterThanOrEqual(24);
    expect(motion.duration).toBeLessThanOrEqual(38);
  }
  await expect(plot).toHaveAttribute("data-starfield-animation", "alive-bounded-wander");
  await expect(plot).toHaveAttribute("data-webgl", "ready");
  expect(shaderErrors).toEqual([]);
});

test("night dream emission produces a real, bounded, native-color WebGL aura", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 1_000) <= 760, "The same shader is covered once at full desktop pixel resolution.");
  await openSession(page);
  await openForceDesignOnDesktop(page);
  await page.locator(".time-control").getByRole("button", { name: "night", exact: true }).click();
  const plot = page.locator(".battlefield-canvas.layer-surface");
  await expect(plot).toHaveAttribute("data-webgl", "ready");
  const canvas = plot.locator(":scope > canvas");
  const emptyNight = await cleanCanvasCapture(canvas);

  await page.getByRole("button", { name: "Add one Fleet aviation ship" }).click();
  await expect.poll(async () => plot.locator(".fallback-ship").count()).toBeGreaterThan(0);
  await expect.poll(async () => Number(await plot.getAttribute("data-dream-emission-max-halo-meshes"))).toBe(84);
  await expect.poll(async () => Number(await plot.getAttribute("data-dream-emission-halo-meshes"))).toBe(2);
  const emittedNight = await cleanCanvasCapture(canvas);
  const metrics = await canvasDifferenceMetrics(page, emptyNight, emittedNight);

  // A crisp core and a lower-energy perimeter both change real canvas pixels.
  expect(metrics.strongCore).toBeGreaterThan(180);
  expect(metrics.softEdge).toBeGreaterThan(120);
  expect(metrics.nativeCool).toBeGreaterThan(60);
  expect(metrics.changed).toBeGreaterThan(320);
  // One unit must remain a local outline—not become a screen-sized light orb.
  expect(metrics.footprintWidth).toBeLessThan(metrics.width * 0.32);
  expect(metrics.footprintHeight).toBeLessThan(metrics.height * 0.32);
});
