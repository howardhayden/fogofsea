/**
 * Frozen exhaustive planner reference from recovered FOG-OF-SEA v5.
 * Original app/formation.ts SHA-256: 8be900f79eb928de2f9324d9926c12e46d56bf1459b79ccdfc8d1894e007d611
 * Excerpt: start of file through createFormationPlan, immediately before
 * "export type FormationSample"; original excerpt SHA-256:
 * d5eb57e26096c526174c6cfed9e9b06961730eb2a331d623e970cdbb08ad7b4e
 * Original app/catalog.ts SHA-256: 70d7e7e0989a56c8d919c9980810d77da3fc0404d5dfc88851905e0a22dfdde6
 *
 * Only adaptations: freeze the catalog fields consumed by this planner,
 * remove unrelated motion imports, and rename the exported entry point.
 * Keep this independent of production placement/clearance helpers. Running
 * both versions on the same engine preserves exact numeric equality without
 * requiring different JS engines to serialize transcendental results alike.
 */
const PLATFORMS = [
  {
    "id": "fleet-aviation-ship",
    "screenUnit": false
  },
  {
    "id": "short-deck-aviation-ship",
    "screenUnit": false
  },
  {
    "id": "expeditionary-aviation-dock",
    "screenUnit": false
  },
  {
    "id": "uncrewed-aviation-ship",
    "screenUnit": false
  },
  {
    "id": "area-defense-destroyer",
    "screenUnit": true
  },
  {
    "id": "multirole-frigate",
    "screenUnit": true
  },
  {
    "id": "stealth-littoral-corvette",
    "screenUnit": true
  },
  {
    "id": "autonomous-mine-support-ship",
    "screenUnit": true
  },
  {
    "id": "air-independent-submarine",
    "screenUnit": false
  },
  {
    "id": "long-endurance-submarine",
    "screenUnit": false
  },
  {
    "id": "undersea-systems-tender",
    "screenUnit": false
  }
] as const;
const AIRCRAFT = [
  {
    "id": "deck-multirole-aircraft",
    "kind": "catapult"
  },
  {
    "id": "deck-long-range-strike-aircraft",
    "kind": "catapult"
  },
  {
    "id": "deck-interceptor-aircraft",
    "kind": "catapult"
  },
  {
    "id": "short-takeoff-aircraft",
    "kind": "short-deck"
  },
  {
    "id": "short-deck-strike-aircraft",
    "kind": "short-deck"
  },
  {
    "id": "electromagnetic-support-aircraft",
    "kind": "catapult"
  },
  {
    "id": "fixed-wing-surveillance-aircraft",
    "kind": "catapult"
  },
  {
    "id": "maritime-patrol-aircraft",
    "kind": "catapult"
  },
  {
    "id": "command-relay-aircraft",
    "kind": "catapult"
  },
  {
    "id": "rotary-surveillance-aircraft",
    "kind": "rotary"
  },
  {
    "id": "maritime-mission-helicopter",
    "kind": "rotary"
  },
  {
    "id": "mine-countermeasure-rotorcraft",
    "kind": "rotary"
  },
  {
    "id": "shipborne-rescue-rotorcraft",
    "kind": "rotary"
  },
  {
    "id": "heavy-utility-rotorcraft",
    "kind": "rotary"
  },
  {
    "id": "uncrewed-combat-aircraft",
    "kind": "uncrewed-fixed-wing"
  },
  {
    "id": "long-endurance-uncrewed-strike",
    "kind": "uncrewed-fixed-wing"
  },
  {
    "id": "low-signature-uncrewed-scout",
    "kind": "uncrewed-fixed-wing"
  },
  {
    "id": "uncrewed-refueling-aircraft",
    "kind": "uncrewed-fixed-wing"
  },
  {
    "id": "uncrewed-surveillance-rotorcraft",
    "kind": "uncrewed-vertical"
  },
  {
    "id": "uncrewed-logistics-aircraft",
    "kind": "uncrewed-vertical"
  }
] as const;

export type FormationPosition = readonly [number, number, number];
export type FormationDomain = "surface" | "subsurface" | "air";
export type FormationRole = "aviation-core" | "support-core" | "surface-screen" | "undersea-screen" | "rotary-support" | "fixed-wing-screen";
export type FormationUnit = {
  key: string;
  type: string;
  ordinal: number;
  domain: FormationDomain;
  role: FormationRole;
  position: FormationPosition;
  heading: number;
  visualScale: number;
  clearanceRadius: number;
};

/** Presentation-space distances, never tactical ranges or adjudication inputs. */
export const FORMATION_BOUNDS = { horizontal: 10.5, minimumY: -4.8, maximumY: 7.1 } as const;
const SUBMARINE_TYPES = new Set(["air-independent-submarine", "long-endurance-submarine"]);
const AVIATION_SHIPS = new Set(["fleet-aviation-ship", "short-deck-aviation-ship", "expeditionary-aviation-dock", "uncrewed-aviation-ship"]);
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function selectedCount(value: number | undefined) {
  if (value === undefined) return 0;
  // Match the save-format count domain. Reject invalid input instead of quietly
  // truncating a valid selection to a renderer-specific per-type/total limit.
  if (!Number.isInteger(value) || value < 0 || value > 99) throw new RangeError("Formation counts must be whole numbers from 0 to 99.");
  return value;
}

function unit(type: string, ordinal: number, domain: FormationDomain, role: FormationRole, radius: number): FormationUnit {
  return {
    key: `${domain}:${type}:${ordinal}`,
    type,
    ordinal,
    domain,
    role,
    position: [0, 0, 0],
    heading: -0.16,
    visualScale: 1,
    clearanceRadius: radius,
  };
}

function placeRing(units: FormationUnit[], xRadius: number, zRadius: number, y: number, phase: number, centerSingle = false) {
  units.forEach((member, index) => {
    const angle = phase + index * Math.PI * 2 / units.length;
    member.position = centerSingle && units.length === 1 ? [0, y, 0] : [Math.cos(angle) * xRadius, y, Math.sin(angle) * zRadius];
  });
}

function placeAir(units: FormationUnit[], innerRadius: number, outerRadius: number, y: number, phase: number) {
  units.forEach((member, index) => {
    // A filled, staggered disc keeps large legal detachments individually
    // represented instead of stacking models into a fixed repeating grid.
    const radius = Math.sqrt(innerRadius ** 2 + (index + 0.5) / units.length * (outerRadius ** 2 - innerRadius ** 2));
    const angle = phase + index * GOLDEN_ANGLE;
    member.position = [Math.cos(angle) * radius, y + Math.sin(angle * 2) * 0.28, Math.sin(angle) * radius * 0.78];
    member.heading = -0.16 + Math.sin(angle) * 0.12;
  });
}

function distance(a: FormationPosition, b: FormationPosition) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/**
 * A stylized task-group tableau using the catalog's fictional roles: aviation
 * and support near the center, escorts around them, submarines outboard below,
 * rotary support nearer/lower, and fixed-wing aircraft higher/outboard.
 * Every selected catalog instance is represented. This changes no game state,
 * aircraft-host allocation, operational readiness, or real-world doctrine.
 */
export function createExhaustiveFormationReference(fleet: Readonly<Record<string, number>>, airWing: Readonly<Record<string, number>>): FormationUnit[] {
  const core: FormationUnit[] = [];
  const screen: FormationUnit[] = [];
  const subsurface: FormationUnit[] = [];
  const rotary: FormationUnit[] = [];
  const fixedWing: FormationUnit[] = [];
  // Catalog order, not object insertion order, determines layout and identity.
  for (const platform of PLATFORMS) {
    const count = selectedCount(fleet[platform.id]);
    for (let ordinal = 0; ordinal < count; ordinal++) {
      if (SUBMARINE_TYPES.has(platform.id)) subsurface.push(unit(platform.id, ordinal, "subsurface", "undersea-screen", 1.3));
      else if (AVIATION_SHIPS.has(platform.id)) core.push(unit(platform.id, ordinal, "surface", "aviation-core", 2.6));
      else if (platform.screenUnit) screen.push(unit(platform.id, ordinal, "surface", "surface-screen", 1.7));
      else core.push(unit(platform.id, ordinal, "surface", "support-core", 1.7));
    }
  }
  for (const aircraft of AIRCRAFT) {
    const count = selectedCount(airWing[aircraft.id]);
    const isRotary = aircraft.kind === "rotary" || aircraft.kind === "uncrewed-vertical";
    for (let ordinal = 0; ordinal < count; ordinal++) {
      (isRotary ? rotary : fixedWing).push(unit(aircraft.id, ordinal, "air", isRotary ? "rotary-support" : "fixed-wing-screen", aircraft.kind.startsWith("uncrewed") ? 0.88 : 1.1));
    }
  }

  placeRing(core, 3.5, 3.2, 0.16, Math.PI * 0.82, true);
  placeRing(screen, 8.3, 7.3, 0.16, Math.PI * 0.1);
  placeRing(subsurface, 8.8, 6.8, -4.25, Math.PI * 0.3);
  placeAir(rotary, 1.8, 6.7, 3.65, 0.6);
  placeAir(fixedWing, 3.2, 9.2, 6.45, 1.4);
  const units = [...core, ...screen, ...subsurface, ...rotary, ...fixedWing];
  // Fit the actual model envelopes to available space. Dense selections become
  // smaller; no selected unit disappears and no two target envelopes overlap.
  for (let a = 0; a < units.length; a++) {
    for (let b = a + 1; b < units.length; b++) {
      const scale = Math.min(1, distance(units[a].position, units[b].position) / ((units[a].clearanceRadius + units[b].clearanceRadius) * 1.08));
      units[a].visualScale = Math.min(units[a].visualScale, scale);
      units[b].visualScale = Math.min(units[b].visualScale, scale);
    }
  }
  units.forEach((member) => { member.clearanceRadius *= member.visualScale; });
  return units;
}

