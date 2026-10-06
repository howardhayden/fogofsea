import { createElement, type ComponentProps } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import Battlefield from "../../../app/Battlefield";

/** Exercise real React commits, effects and WebGL allocations without relying
 * on frame timing thresholds or a test-only scene-generation counter. */
export async function probeBattlefieldUpdates() {
  const container = document.createElement("div");
  container.style.cssText = "position:fixed;inset:0 auto auto 0;width:600px;height:450px;z-index:10000";
  document.body.appendChild(container);
  const root = createRoot(container);
  let props: ComponentProps<typeof Battlefield> = {
    climate: "ocean", time: "day", clouds: "clear", precipitation: "none",
    seaState: 5, visibility: 20, season: "summer", scenarioDate: "2026-06-15",
    observerLatitude: 30, observerLongitude: -40, storming: false, lightningCapable: false,
    windHeading: 45, windSpeed: 8, currentHeading: 90, currentSpeed: 1, waveHeading: 60,
    region: "Open ocean", regionId: "open-ocean", fleet: {}, airWing: {},
    lowSignatureFleet: 0, lowSignatureAircraft: 0, exerciseId: 17, result: null,
    theme: "dark", contactVisibility: { air: false, surface: false, subsurface: false },
  };
  const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  const settle = async () => { await frame(); await frame(); };
  const render = async () => {
    flushSync(() => root.render(createElement(Battlefield, props)));
    await settle();
  };
  // A day scene with no emission uses only scene-owned buffers. Retain their
  // actual GL handles so scene replacement can prove deterministic release,
  // including InstancedMesh attributes that geometry.dispose does not own.
  const initialBuffers: { context: WebGL2RenderingContext; buffer: WebGLBuffer }[] = [];
  const prototypeCreateBuffer = WebGL2RenderingContext.prototype.createBuffer;
  WebGL2RenderingContext.prototype.createBuffer = function () {
    const buffer = prototypeCreateBuffer.call(this);
    if (buffer) initialBuffers.push({ context: this, buffer });
    return buffer;
  };
  try {
    await render();
  } finally {
    WebGL2RenderingContext.prototype.createBuffer = prototypeCreateBuffer;
  }
  const plot = container.querySelector<HTMLElement>(".battlefield-canvas")!;
  const canvas = plot.querySelector<HTMLCanvasElement>(":scope > canvas")!;
  if (!canvas || plot.dataset.webgl !== "ready") {
    root.unmount(); container.remove();
    throw new Error("Battlefield fixture requires a rendered WebGL frame");
  }
  const gl = canvas.getContext("webgl2")!;
  const sceneBuffers = initialBuffers.filter((entry) => entry.context === gl).map((entry) => entry.buffer);
  let bufferAllocations = 0;
  let sceneStateChanges = 0;
  let canvasResets = 0;
  const originalCreateBuffer = gl.createBuffer;
  gl.createBuffer = function () { bufferAllocations += 1; return originalCreateBuffer.call(this); };
  const observer = new MutationObserver((records) => { sceneStateChanges += records.length; });
  observer.observe(plot, { attributes: true, attributeFilter: ["data-webgl"] });
  for (const attribute of ["width", "height"] as const) {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, attribute)!;
    Object.defineProperty(canvas, attribute, {
      configurable: true,
      get() { return descriptor.get!.call(this); },
      set(value) { canvasResets += 1; descriptor.set!.call(this, value); },
    });
  }
  const snapshot = () => {
    sceneStateChanges += observer.takeRecords().length;
    return {
      bufferAllocations, sceneStateChanges, canvasResets,
      formationUnits: Number(plot.dataset.formationUnits),
      surfaceUnits: plot.querySelectorAll(".fallback-ship").length,
      aircraftUnits: plot.querySelectorAll(".fallback-aircraft").length,
      foamPatches: Number(plot.dataset.waveFoamPatches),
      initialSceneBuffers: sceneBuffers.length,
      liveInitialSceneBuffers: sceneBuffers.filter((buffer) => gl.isBuffer(buffer)).length,
      sameCanvas: plot.querySelector(":scope > canvas") === canvas,
      renderedContacts: Number(plot.dataset.visibleUnknownContacts), webgl: plot.dataset.webgl,
    };
  };
  try {
    // New empty arrays and records reproduce normal parent renders. The
    // delayed roster effect must also retain the previous unchanged counts.
    for (let index = 0; index < 3; index++) {
      props = { ...props, fleet: {}, airWing: {}, disclosedContacts: [],
        contactVisibility: { air: false, surface: false, subsurface: false } };
      await render();
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 600));
    await settle();
    const unchanged = snapshot();
    props = { ...props, disclosedContacts: undefined, currentPhaseContentActive: true };
    await render();
    const omitted = snapshot();
    // A real disclosure remains authoritative and must reach the replacement
    // scene even though its canvas dimensions and renderer are retained.
    props = { ...props, contactVisibility: { air: false, surface: true, subsurface: false },
      disclosedContacts: [{ id: "disclosed-surface", domain: "surface", x: 2, y: 0, z: 2, scale: 1, heading: 0 }] };
    await render();
    const disclosed = snapshot();
    // Separate synchronous React commits reproduce a rapid sequence of real
    // low-signature roster updates. No timer can elapse between these commits;
    // the old raw signature props still rebuilt the scene on every increment.
    for (let count = 1; count <= 4; count++) {
      props = { ...props, fleet: { "uncrewed-aviation-ship": count },
        airWing: { "low-signature-uncrewed-scout": count },
        lowSignatureFleet: count, lowSignatureAircraft: count };
      flushSync(() => root.render(createElement(Battlefield, props)));
    }
    const rapidRoster = snapshot();
    await new Promise<void>((resolve) => setTimeout(resolve, 600));
    await settle();
    const settledRoster = snapshot();
    // Verify that both signature totals eventually reach the actual visible
    // sky description, as well as the final eight formation instances.
    props = { ...props, time: "night" };
    const stars = Array.from(plot.querySelectorAll<HTMLButtonElement>(".depth-control button"))
      .find((button) => button.textContent === "stars")!;
    flushSync(() => { root.render(createElement(Battlefield, props)); stars.click(); });
    await settle();
    const nightSkyDescription = plot.querySelector("#battlefield-state-note")?.textContent;
    return { unchanged, omitted, disclosed, rapidRoster, settledRoster, nightSkyDescription, error: gl.getError() };
  } finally {
    observer.disconnect();
    gl.createBuffer = originalCreateBuffer;
    delete (canvas as Partial<HTMLCanvasElement>).width;
    delete (canvas as Partial<HTMLCanvasElement>).height;
    root.unmount();
    container.remove();
  }
}
