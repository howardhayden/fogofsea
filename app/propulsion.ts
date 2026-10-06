/** Presentation assumptions for fictional catalog types, never performance
 * specifications, propulsion claims about a real class, or adjudication data.
 * Handling combines hull/airframe role with propulsor; energy source alone does
 * not determine turning ability. Values are scene units and seconds. */
export type PropulsionKind = "multi-screw" | "twin-screw" | "waterjet" | "azimuth-thruster" | "electric-screw" | "pumpjet" | "turbofan" | "turboprop" | "rotor" | "electric-rotor";
export type MotionProfile = Readonly<{
  propulsion: PropulsionKind;
  handling: "large-displacement" | "escort" | "littoral" | "precision-support" | "quiet-patrol" | "ocean-submarine" | "fast-fixed-wing" | "persistent-fixed-wing" | "rotary";
  minimumDuration: number;
  relativeSpeed: number;
  acceleration: number;
  maxBank: number;
  propulsorRate: number;
  disturbance: number;
}>;

const profile = (propulsion: PropulsionKind, handling: MotionProfile["handling"], minimumDuration: number, relativeSpeed: number, acceleration: number, maxBank = 0, propulsorRate = 1, disturbance = 1): MotionProfile =>
  Object.freeze({ propulsion, handling, minimumDuration, relativeSpeed, acceleration, maxBank, propulsorRate, disturbance });
const carrier = profile("multi-screw", "large-displacement", 5.1, 1.6, 0.5, 0, 0.65, 1);
const aviation = profile("twin-screw", "large-displacement", 4.7, 1.8, 0.6, 0, 0.75, 0.9);
const destroyer = profile("twin-screw", "escort", 3.8, 2.2, 0.8, 0, 1, 0.85);
const frigate = profile("twin-screw", "escort", 3.5, 2.3, 0.9, 0, 0.9, 0.7);
const corvette = profile("waterjet", "littoral", 2.7, 2.8, 1.5, 0, 1.4, 0.55);
const support = profile("azimuth-thruster", "precision-support", 3.8, 1.8, 0.85, 0, 0.8, 0.5);
const aip = profile("electric-screw", "quiet-patrol", 4.2, 1.65, 0.6, 0, 0.65, 0.2);
const oceanSub = profile("pumpjet", "ocean-submarine", 3.7, 2.2, 0.8, 0, 0.9, 0.3);
const fighter = profile("turbofan", "fast-fixed-wing", 2.7, 4.2, 2.3, 0.65, 1, 0.25);
const strike = profile("turbofan", "fast-fixed-wing", 3.2, 3.5, 1.7, 0.5, 1, 0.22);
const patrol = profile("turboprop", "persistent-fixed-wing", 3.8, 2.8, 1.2, 0.38, 1.1, 0.2);
const helicopter = profile("rotor", "rotary", 2.8, 2.1, 1.45, 0.28, 1, 0.8);
const heavyRotor = profile("rotor", "rotary", 3.5, 1.7, 1, 0.22, 0.8, 1);
const smallRotor = profile("electric-rotor", "rotary", 2.2, 1.8, 1.8, 0.3, 1.3, 0.35);

export const PROPULSION_PROFILES: Readonly<Record<string, MotionProfile>> = Object.freeze({
  "fleet-aviation-ship": carrier,
  "short-deck-aviation-ship": aviation,
  "expeditionary-aviation-dock": aviation,
  "uncrewed-aviation-ship": aviation,
  "area-defense-destroyer": destroyer,
  "multirole-frigate": frigate,
  "stealth-littoral-corvette": corvette,
  "autonomous-mine-support-ship": support,
  "undersea-systems-tender": support,
  "air-independent-submarine": aip,
  // The catalog deliberately leaves this propulsion unspecified: a ducted
  // propulsor is one plausible visual assumption, not a new catalog fact.
  "long-endurance-submarine": oceanSub,
  "deck-multirole-aircraft": fighter,
  "deck-long-range-strike-aircraft": strike,
  "deck-interceptor-aircraft": fighter,
  "short-takeoff-aircraft": fighter,
  "short-deck-strike-aircraft": strike,
  "electromagnetic-support-aircraft": strike,
  "fixed-wing-surveillance-aircraft": patrol,
  "maritime-patrol-aircraft": patrol,
  "command-relay-aircraft": patrol,
  "rotary-surveillance-aircraft": heavyRotor,
  "maritime-mission-helicopter": helicopter,
  "mine-countermeasure-rotorcraft": heavyRotor,
  "shipborne-rescue-rotorcraft": helicopter,
  "heavy-utility-rotorcraft": heavyRotor,
  "uncrewed-combat-aircraft": strike,
  "long-endurance-uncrewed-strike": patrol,
  "low-signature-uncrewed-scout": strike,
  "uncrewed-refueling-aircraft": strike,
  "uncrewed-surveillance-rotorcraft": smallRotor,
  "uncrewed-logistics-aircraft": smallRotor,
});

export function formationMotionProfile(type: string): MotionProfile {
  const result = Object.hasOwn(PROPULSION_PROFILES, type) ? PROPULSION_PROFILES[type] : undefined;
  if (!result) throw new RangeError(`No presentation propulsion profile for ${type}.`);
  return result;
}

/** The scene follows an underway group. Relative station changes are added to
 * this common advance before computing rudder-steered hull headings. */
export const FORMATION_GROUP_ADVANCE = 4;
/** One shared circuit preserves separation between fixed-wing station slots. */
export const FIXED_WING_PATROL_RATE = Math.PI * 2 / 80;
