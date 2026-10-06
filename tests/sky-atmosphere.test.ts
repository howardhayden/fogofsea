import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { createSkyCanopy } from "../app/battlefieldScene";
import { addSkyTexture, skyCanopyColors, skyTextureStrength, twilightWarmth, SKY_ATMOSPHERE_DEFAULTS } from "../app/skyAtmosphere";

test("texture is bounded, strongest at night and still present by day", () => {
  const day = skyTextureStrength("day");
  const dawn = skyTextureStrength("dawn");
  const dusk = skyTextureStrength("dusk");
  const night = skyTextureStrength("night");
  assert.ok(0 < day && day < dawn && dawn < dusk && dusk < night && night <= 0.08);
  assert.equal(skyTextureStrength("night", { ...SKY_ATMOSPHERE_DEFAULTS, enabled: false }), 0);
  assert.equal(skyTextureStrength("night", { ...SKY_ATMOSPHERE_DEFAULTS, backgroundNoiseOpacity: 100 }), 0.08);
  assert.equal(skyTextureStrength("night", { ...SKY_ATMOSPHERE_DEFAULTS, backgroundNoiseOpacity: NaN }), night);
});

test("warm twilight affects only clear/hazy dawn and dusk with a continuous fog fade", () => {
  for (const time of ["dawn", "dusk"] as const) {
    assert.equal(twilightWarmth(time, 0.004), 1);
    assert.equal(twilightWarmth(time, 0.004 + 0.052 * 0.08), 1);
    assert.ok(Math.abs(twilightWarmth(time, 0.004 + 0.052 * 0.20) - 0.5) < 1e-12);
    assert.equal(twilightWarmth(time, 0.004 + 0.052 * 0.32), 0);
    assert.equal(twilightWarmth(time, 0.056), 0);
    assert.equal(twilightWarmth(time, NaN), 0);
  }
  for (const time of ["day", "night"] as const) assert.equal(twilightWarmth(time, 0.004), 0);
});

test("salmon and cream twilight stays warm in both themes and preserves unaffected original palette identity", () => {
  const original = [0x292746, 0x604d6c, 0x9b6975] as const;
  for (const theme of ["dark", "light"] as const) {
    for (const time of ["dawn", "dusk"] as const) {
      for (const color of skyCanopyColors(original, theme, time, 0.004)) {
        const red = color >> 16;
        const green = (color >> 8) & 255;
        const blue = color & 255;
        assert.ok(red > green && green > blue, "warm twilight must not revert to magenta/purple");
      }
      assert.equal(skyCanopyColors(original, theme, time, 0.056), original);
      assert.equal(skyCanopyColors(original, theme, time, 0.004, { ...SKY_ATMOSPHERE_DEFAULTS, enabled: false }), original);
    }
    for (const time of ["day", "night"] as const) assert.equal(skyCanopyColors(original, theme, time, 0.004), original);
  }
});

test("canopy keeps original faceted geometry, one mesh, behind-scene order and native material", () => {
  const canopy = createSkyCanopy("dark", "night", 0.004);
  const original = new THREE.IcosahedronGeometry(330, 3);
  assert.deepEqual(canopy.geometry.getAttribute("position").array, original.getAttribute("position").array);
  const material = canopy.material as THREE.MeshBasicMaterial;
  assert.equal(material.type, "MeshBasicMaterial");
  assert.equal(material.depthTest, false);
  assert.equal(material.depthWrite, false);
  assert.equal(material.side, THREE.BackSide);
  assert.equal(canopy.renderOrder, -30);
  assert.equal(canopy.children.length, 0);
  assert.equal(canopy.frustumCulled, false);
  canopy.geometry.dispose(); material.dispose(); original.dispose();
});

test("every canopy uses the native material without a separate star-bloom texture or shader", () => {
  const native = new THREE.MeshBasicMaterial();
  for (const theme of ["dark", "light"] as const) {
    for (const time of ["night", "dawn", "day", "dusk"] as const) {
      const canopy = createSkyCanopy(theme, time, 0.004);
      const material = canopy.material as THREE.MeshBasicMaterial;
      assert.equal(material.map, null);
      assert.equal(material.alphaMap, null);
      assert.equal(material.onBeforeCompile, native.onBeforeCompile);
      assert.equal(material.customProgramCacheKey(), native.customProgramCacheKey());
      assert.deepEqual(material.userData, {});
      canopy.geometry.dispose();
      material.dispose();
    }
  }
  native.dispose();
});

test("background texture is baked once into bounded native-color vertex data", () => {
  const make = () => {
    const geometry = new THREE.IcosahedronGeometry(330, 3);
    const colors = new Float32Array(geometry.getAttribute("position").count * 3);
    for (let index = 0; index < colors.length; index += 3) colors.set([0.5, 0.3, 0.2], index);
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geometry;
  };
  const first = make(); const second = make(); const disabled = make();
  const originalPositions = new Float32Array(first.getAttribute("position").array);
  const originalColors = new Float32Array(first.getAttribute("color").array);
  addSkyTexture(first, "night"); addSkyTexture(second, "night");
  addSkyTexture(disabled, "night", { ...SKY_ATMOSPHERE_DEFAULTS, enabled: false });
  assert.deepEqual(first.getAttribute("color").array, second.getAttribute("color").array);
  assert.deepEqual(disabled.getAttribute("color").array, originalColors);
  assert.deepEqual(first.getAttribute("position").array, originalPositions);
  const colors = first.getAttribute("color");
  for (let index = 0; index < colors.count; index++) {
    const factor = colors.getX(index) / 0.5;
    assert.ok(factor >= 0.955 && factor <= 1.045);
    assert.ok(Math.abs(colors.getY(index) / 0.3 - factor) < 1e-6);
    assert.ok(Math.abs(colors.getZ(index) / 0.2 - factor) < 1e-6);
  }
  assert.ok(new Set(colors.array).size > 100, "tonal field should vary spatially");
  first.dispose(); second.dispose(); disabled.dispose();
});
