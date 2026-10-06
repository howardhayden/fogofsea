import * as THREE from "three";

type SkyTime = "dawn" | "day" | "dusk" | "night";
type SkyTheme = "light" | "dark";

/** Author tuning only. No persistent setting or extra animation clock. */
export const SKY_ATMOSPHERE_DEFAULTS = {
  enabled: true,
  backgroundNoiseOpacity: 0.045,
  backgroundNoiseScale: 5.5,
  twilightWarmth: 1,
} as const;

export type SkyAtmosphereTuning = {
  enabled: boolean;
  backgroundNoiseOpacity: number;
  backgroundNoiseScale: number;
  twilightWarmth: number;
};

function bounded(value: number, low: number, high: number, fallback: number) {
  return Number.isFinite(value) ? Math.max(low, Math.min(high, value)) : fallback;
}

export function skyTextureStrength(time: SkyTime, tuning: SkyAtmosphereTuning = SKY_ATMOSPHERE_DEFAULTS) {
  if (!tuning.enabled) return 0;
  return bounded(tuning.backgroundNoiseOpacity, 0, 0.08, 0.045)
    * { night: 1, dusk: 0.45, dawn: 0.4, day: 0.16 }[time];
}

/** Fog amount uses the existing horizon-density mapping. Warmth recedes
 * continuously through haze and is absent from mist/fog. */
export function twilightWarmth(
  time: SkyTime,
  horizonDensity: number,
  tuning: SkyAtmosphereTuning = SKY_ATMOSPHERE_DEFAULTS,
) {
  if (!tuning.enabled || (time !== "dawn" && time !== "dusk") || !Number.isFinite(horizonDensity)) return 0;
  const fogAmount = Math.max(0, (horizonDensity - 0.004) / 0.052);
  const fade = bounded((fogAmount - 0.08) / 0.24, 0, 1, 1);
  return (1 - fade * fade * (3 - 2 * fade)) * bounded(tuning.twilightWarmth, 0, 1, 1);
}

const WARM_TWILIGHT = {
  // Fresh Atlantic salmon pink opens into very pale banana cream at the horizon.
  // Keep dusk quieter than dawn and the dark interface's canopy more subdued.
  light: { dawn: [0xf29b88, 0xfff2d8, 0xfffbed], dusk: [0xe28c82, 0xfcecd2, 0xfff6e4] },
  dark: { dawn: [0xc9857c, 0xecddbd, 0xf7edd5], dusk: [0xb57470, 0xddceb3, 0xeee2c9] },
} as const;

/** Only the canopy colors change; water, lighting and star hue stay canonical. */
export function skyCanopyColors(
  original: readonly [number, number, number],
  theme: SkyTheme,
  time: SkyTime,
  horizonDensity: number,
  tuning: SkyAtmosphereTuning = SKY_ATMOSPHERE_DEFAULTS,
): readonly [number, number, number] {
  const amount = twilightWarmth(time, horizonDensity, tuning);
  if (!amount || (time !== "dawn" && time !== "dusk")) return original;
  const target = WARM_TWILIGHT[theme][time];
  return original.map((color, index) => new THREE.Color(color)
    .lerp(new THREE.Color(target[index]), amount).getHex()) as [number, number, number];
}

function fract(value: number) { return value - Math.floor(value); }

function skyHash(x: number, y: number, z: number) {
  x = fract(x * 0.1031); y = fract(y * 0.1031); z = fract(z * 0.1031);
  const dot = x * (y + 33.33) + y * (z + 33.33) + z * (x + 33.33);
  x += dot; y += dot; z += dot;
  return fract((x + y) * z);
}

function skyNoise(x: number, y: number, z: number) {
  const ix = Math.floor(x); const iy = Math.floor(y); const iz = Math.floor(z);
  const ease = (value: number) => value * value * (3 - 2 * value);
  const fx = ease(fract(x)); const fy = ease(fract(y)); const fz = ease(fract(z));
  const mix = (a: number, b: number, amount: number) => a + (b - a) * amount;
  return mix(
    mix(mix(skyHash(ix, iy, iz), skyHash(ix + 1, iy, iz), fx),
      mix(skyHash(ix, iy + 1, iz), skyHash(ix + 1, iy + 1, iz), fx), fy),
    mix(mix(skyHash(ix, iy, iz + 1), skyHash(ix + 1, iy, iz + 1), fx),
      mix(skyHash(ix, iy + 1, iz + 1), skyHash(ix + 1, iy + 1, iz + 1), fx), fy), fz);
}

/** Bake broad static noise into the existing canopy colors once. Interpolation
 * stays within its polygonal planes; there is no extra draw, texture allocation,
 * fragment shader, per-frame work or screen-space grain. */
export function addSkyTexture(
  geometry: THREE.BufferGeometry,
  time: SkyTime,
  tuning: SkyAtmosphereTuning = SKY_ATMOSPHERE_DEFAULTS,
) {
  const strength = skyTextureStrength(time, tuning);
  if (strength === 0) return;
  const scale = bounded(tuning.backgroundNoiseScale, 2, 12, 5.5);
  const positions = geometry.getAttribute("position");
  const colors = geometry.getAttribute("color");
  for (let index = 0; index < positions.count; index++) {
    const radius = Math.hypot(positions.getX(index), positions.getY(index), positions.getZ(index)) || 1;
    const x = positions.getX(index) / radius * scale;
    const y = positions.getY(index) / radius * scale;
    const z = positions.getZ(index) / radius * scale;
    const body = skyNoise(x, y, z) * 0.70
      + skyNoise(x * 2.07 + 13.7, y * 2.07 + 5.1, z * 2.07 + 9.3) * 0.26
      + skyNoise(x * 6.1 + 3.2, y * 6.1 + 11.4, z * 6.1 + 4.7) * 0.04;
    const factor = 1 + (body * 2 - 1) * strength;
    colors.setXYZ(index, colors.getX(index) * factor, colors.getY(index) * factor, colors.getZ(index) * factor);
  }
  colors.needsUpdate = true;
}
