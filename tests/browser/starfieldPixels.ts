import type { Locator, Page } from "@playwright/test";

export type StarfieldPixelMetrics = {
  width: number;
  height: number;
  bright: number;
  colorful: number;
  white: number;
  cool: number;
  roseViolet: number;
  horizontalBins: number[];
  components: number;
  pinpoint: number;
  far: number;
  near: number;
  fields: number;
  largest: number;
};

/** Measures the presented WebGL pixels by decoding a real element capture. */
export async function measureStarfieldPixels(page: Page, canvas: Locator): Promise<StarfieldPixelMetrics> {
  // Element captures include overlapping higher-z-index siblings. Playwright's
  // temporary screenshot stylesheet is intentionally rejected by the app CSP,
  // so hide those panels through reversible DOM properties for one frame.
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
    if (!context) throw new Error("Two-dimensional pixel-analysis context unavailable");
    context.drawImage(image, 0, 0);

    const { width, height } = decoded;
    const data = context.getImageData(0, 0, width, height).data;
    const horizontalBins = [0, 0, 0, 0];
    const coreMask = new Uint8Array(width * height);
    let bright = 0;
    let colorful = 0;
    let white = 0;
    let cool = 0;
    let roseViolet = 0;

    for (let index = 0; index < width * height; index++) {
      const red = data[index * 4];
      const green = data[index * 4 + 1];
      const blue = data[index * 4 + 2];
      const maximum = Math.max(red, green, blue);
      const minimum = Math.min(red, green, blue);
      if (maximum >= 145) {
        bright += 1;
        const x = index % width;
        horizontalBins[Math.min(3, Math.floor((x / width) * 4))] += 1;
      }
      // Count luminous facets, not the deliberately colorful pastel canopy.
      // The old 90–100 channel floor admitted broad areas of the background
      // gradient and made aurora/sky color look like star pixels. Requiring a
      // bright channel and adequate summed light preserves small pastel stars
      // while excluding low-energy atmospheric fields.
      if ((maximum >= 145 && maximum - minimum >= 35 && red + green + blue >= 350)
        || (minimum >= 155 && maximum - minimum <= 55)) coreMask[index] = 1;
      if (maximum >= 145 && maximum - minimum >= 35 && red + green + blue >= 350) colorful += 1;
      if (minimum >= 155 && maximum - minimum <= 55) white += 1;
      if (maximum >= 145 && blue >= 130 && (blue - red >= 35 || green - red >= 35)) cool += 1;
      if (Math.max(red, blue) >= 145 && green + 22 <= Math.max(red, blue)) roseViolet += 1;
    }

    const componentAreas: number[] = [];
    const queue = new Int32Array(width * height);
    for (let start = 0; start < coreMask.length; start++) {
      if (!coreMask[start]) continue;
      let head = 0;
      let tail = 1;
      let area = 0;
      queue[0] = start;
      coreMask[start] = 0;
      while (head < tail) {
        const current = queue[head++];
        area += 1;
        const x = current % width;
        const y = Math.floor(current / width);
        for (let offsetY = -1; offsetY <= 1; offsetY++) {
          for (let offsetX = -1; offsetX <= 1; offsetX++) {
            if ((!offsetX && !offsetY) || x + offsetX < 0 || x + offsetX >= width || y + offsetY < 0 || y + offsetY >= height) continue;
            const neighbor = current + offsetY * width + offsetX;
            if (!coreMask[neighbor]) continue;
            coreMask[neighbor] = 0;
            queue[tail++] = neighbor;
          }
        }
      }
      componentAreas.push(area);
    }

    return {
      width,
      height,
      bright,
      colorful,
      white,
      cool,
      roseViolet,
      horizontalBins,
      components: componentAreas.length,
      pinpoint: componentAreas.filter((area) => area <= 4).length,
      far: componentAreas.filter((area) => area >= 5 && area <= 24).length,
      near: componentAreas.filter((area) => area >= 25 && area <= 180).length,
      fields: componentAreas.filter((area) => area > 180).length,
      largest: Math.max(0, ...componentAreas),
    };
  }, capture.toString("base64"));
}
