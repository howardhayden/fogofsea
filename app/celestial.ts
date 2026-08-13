import { Body, Equator, Horizon, Illumination, MoonPhase, Observer } from "astronomy-engine";

export type CelestialClimate = "ocean" | "arctic" | "antarctic";
export type CelestialTime = "dawn" | "day" | "dusk" | "night";

export type CelestialBodyState = {
  altitude: number;
  azimuth: number;
  aboveHorizon: boolean;
};

export type CelestialState = {
  date: Date;
  localTimeLabel: string;
  observer: { latitude: number; longitude: number };
  sun: CelestialBodyState;
  moon: CelestialBodyState & {
    phaseAngle: number;
    illumination: number;
    phaseName: string;
    phaseGlyph: string;
    waxing: boolean;
  };
};

const PHASES = [
  { maximum: 22.5, name: "new moon", glyph: "🌑" },
  { maximum: 67.5, name: "waxing crescent", glyph: "🌒" },
  { maximum: 112.5, name: "first quarter", glyph: "🌓" },
  { maximum: 157.5, name: "waxing gibbous", glyph: "🌔" },
  { maximum: 202.5, name: "full moon", glyph: "🌕" },
  { maximum: 247.5, name: "waning gibbous", glyph: "🌖" },
  { maximum: 292.5, name: "last quarter", glyph: "🌗" },
  { maximum: 337.5, name: "waning crescent", glyph: "🌘" },
  { maximum: 360, name: "new moon", glyph: "🌑" },
];

function scenarioDate(calendarDate: string, time: CelestialTime, longitude: number) {
  const hour = time === "dawn" ? 6 : time === "day" ? 13 : time === "dusk" ? 18 : 23;
  const localMidnight = Date.parse(`${calendarDate}T00:00:00.000Z`);
  return new Date(localMidnight + (hour - longitude / 15) * 60 * 60 * 1000);
}

function horizontal(body: Body, date: Date, observer: Observer): CelestialBodyState {
  const equatorial = Equator(body, date, observer, true, true);
  const position = Horizon(date, observer, equatorial.ra, equatorial.dec, "normal");
  return {
    altitude: position.altitude,
    azimuth: position.azimuth,
    aboveHorizon: position.altitude >= -0.8,
  };
}

export function getCelestialState(calendarDate: string, time: CelestialTime, latitude: number, longitude: number): CelestialState {
  const date = scenarioDate(calendarDate, time, longitude);
  const observer = new Observer(latitude, longitude, 0);
  const phaseAngle = MoonPhase(date);
  const illumination = Illumination(Body.Moon, date).phase_fraction;
  const phase = PHASES.find((item) => phaseAngle < item.maximum) ?? PHASES[PHASES.length - 1];

  return {
    date,
    localTimeLabel: `${calendarDate} · ${time === "dawn" ? "06:00" : time === "day" ? "13:00" : time === "dusk" ? "18:00" : "23:00"} local time`,
    observer: { latitude, longitude },
    sun: horizontal(Body.Sun, date, observer),
    moon: {
      ...horizontal(Body.Moon, date, observer),
      phaseAngle,
      illumination,
      phaseName: phase.name,
      phaseGlyph: phase.glyph,
      waxing: phaseAngle < 180,
    },
  };
}

export function horizontalVector(azimuth: number, altitude: number) {
  const az = azimuth * Math.PI / 180;
  const alt = altitude * Math.PI / 180;
  const horizontalRadius = Math.cos(alt);
  return {
    x: Math.sin(az) * horizontalRadius,
    y: Math.sin(alt),
    z: -Math.cos(az) * horizontalRadius,
  };
}

/**
 * Project the illuminated portion of the lunar sphere into a small, faceted
 * HUD silhouette. The polygon contains only lit surface: an unilluminated
 * hemisphere is transparent rather than represented by a dark disk.
 *
 * Astronomy Engine reports 0 degrees at new moon, 180 at full moon, and then
 * continues through the waning half. Northern-hemisphere waxing light is on
 * the right; the apparent orientation reverses in the southern hemisphere.
 */
export function moonIlluminatedPath(phaseAngle: number, southernHemisphere = false, segments = 12) {
  const safeSegments = Math.max(6, Math.min(24, Math.floor(Number.isFinite(segments) ? segments : 12)));
  const normalized = ((Number.isFinite(phaseAngle) ? phaseAngle : 0) % 360 + 360) % 360;
  const radians = normalized * Math.PI / 180;
  const illumination = (1 - Math.cos(radians)) / 2;
  if (illumination < 0.0005) return "";

  const waxing = normalized > 0 && normalized < 180;
  const edgeSign = waxing ? 1 : -1;
  const terminatorSign = waxing ? 1 : -1;
  const points: Array<readonly [number, number]> = [];
  const coordinate = (value: number) => Math.round(value * 1_000) / 1_000;
  const orientX = (value: number) => coordinate(southernHemisphere ? -value : value);

  // Follow the illuminated limb from top to bottom, then return along the
  // projected terminator. Straight segments retain the crystalline language.
  for (let index = 0; index <= safeSegments; index += 1) {
    const y = -1 + index * 2 / safeSegments;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    points.push([orientX(edgeSign * radius), coordinate(y)]);
  }
  for (let index = safeSegments; index >= 0; index -= 1) {
    const y = -1 + index * 2 / safeSegments;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const terminator = terminatorSign * Math.cos(radians) * radius;
    points.push([orientX(terminator), coordinate(y)]);
  }

  return points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x} ${y}`).join(" ") + " Z";
}

export function compassPoint(azimuth: number) {
  const points = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return points[Math.round((((azimuth % 360) + 360) % 360) / 45) % points.length];
}
