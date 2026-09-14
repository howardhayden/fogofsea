import * as THREE from "three";
import * as candidate from "../../../app/starfield";
import * as baseline from "../../../app/starfieldBaseline";
import { createStarPlacements } from "../../../app/viewModel";
import { attachDreamEmission, createDreamEmissionProfile, detachDreamEmission } from "../../../app/dreamEmission";
import { DreamGlowRenderer } from "../../../app/dreamGlowRenderer";
import { DreamGlowRenderer as BaselineGlow } from "../../../app/dreamGlowBaseline";

type Variant = "baseline" | "candidate";

export function denseFixture(count: number, pixelRatio: number) {
  const canvas = document.createElement("canvas"); document.body.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(pixelRatio); renderer.setSize(768, 512);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x111827);
  const camera = new THREE.PerspectiveCamera(42, 1.5, 0.1, 450); camera.position.set(0, 0, 10);
  const complete = baseline.createStarfieldPlan({ seed: 0xc0ffee, theme: "dark", placements: createStarPlacements(0xc0ffee, 3072), visibleCount: 3072 });
  const plan = { ...complete, stars: complete.stars.slice(0, count) };
  const fields = { baseline: baseline.createStarfield(scene, plan), candidate: candidate.createStarfield(scene, plan) };
  const body = new THREE.Group();
  body.add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.6, 2), new THREE.MeshStandardMaterial({ color: 0x639591, roughness: 0.3, metalness: 0.4 })));
  scene.add(body, new THREE.HemisphereLight(0xddeeff, 0x173241, 1.5));
  const light = new THREE.DirectionalLight(0xffffff, 2); light.position.set(3, 5, 3); scene.add(light);
  attachDreamEmission(body, createDreamEmissionProfile(5, "night", "ship"));
  const glow = { baseline: new BaselineGlow(renderer, [body]), candidate: new DreamGlowRenderer(renderer, [body]) };
  const gl = renderer.getContext();
  function draw(variant: Variant, time: number, angle = 0, withGlow = true, reduced = false) {
    const field = fields[variant]; fields.baseline.root.visible = variant === "baseline"; fields.candidate.root.visible = variant === "candidate";
    camera.rotation.set(Math.sin(angle * 0.3) * 0.65, angle, angle * 0.15);
    candidate.updateStarfield(field as candidate.StarfieldRuntime, time, reduced, camera.position);
    if (variant === "candidate") candidate.prepareStarfieldForCamera(fields.candidate, camera);
    if (withGlow) {
      if (variant === "candidate") glow.candidate.render(scene, camera, field.root);
      else glow.baseline.render(scene, camera);
    } else renderer.render(scene, camera);
    return field.starBatches[0]?.mesh.count ?? 0;
  }
  function read() {
    const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
    gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels); return pixels;
  }
  return {
    compare(time: number, angle: number, reduced = false) {
      draw("baseline", time, angle, true, reduced); const before = read(); const beforeCapture = canvas.toDataURL();
      const submitted = draw("candidate", time, angle, true, reduced); const after = read(); const afterCapture = canvas.toDataURL();
      let maximum = 0; let changed = 0; let bad = 0;
      for (let i = 0; i < before.length; i += 4) {
        const delta = Math.max(...[0, 1, 2, 3].map(c => Math.abs(before[i + c] - after[i + c])));
        maximum = Math.max(maximum, delta); if (delta) changed++; if (delta > 1) bad++;
      }
      return { count, pixelRatio, time, angle, reduced, submitted, maximum, changed, bad, glError: gl.getError(), beforeCapture, afterCapture };
    },
    async measure(variant: Variant, orbit: boolean, withGlow: boolean, duration = 2500) {
      // No framebuffer readback, finish, GL query or screenshot in this window.
      const frames: { at: number; cpu: number; submitted: number }[] = [];
      const start = performance.now();
      await new Promise<void>(resolve => {
        const step = (now: number) => {
          const t = (now - start) / 1000; const begin = performance.now();
          const submitted = draw(variant, t + 7, orbit ? t * 0.4 : 0, withGlow);
          frames.push({ at: begin, cpu: performance.now() - begin, submitted });
          if (performance.now() - start < duration) requestAnimationFrame(step); else resolve();
        }; requestAnimationFrame(step);
      });
      return { variant, orbit, withGlow, count, pixelRatio, duration: performance.now() - start, frames,
        intervals: frames.slice(1).map((f, i) => f.at - frames[i].at) };
    },
    dispose() {
      glow.baseline.dispose(); glow.candidate.dispose(); detachDreamEmission(body);
      scene.traverse(o => { if (o instanceof THREE.Mesh) { if (o instanceof THREE.InstancedMesh) o.dispose(); o.geometry.dispose(); const m = o.material; (Array.isArray(m) ? m : [m]).forEach(x => x.dispose()); } });
      renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
    },
  };
}
