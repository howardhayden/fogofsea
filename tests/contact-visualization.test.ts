import assert from "node:assert/strict";
import test from "node:test";
import { AIRCRAFT, PLATFORMS } from "../app/catalog";
import {
  CONTACT_LIMITS,
  canDiscloseOpposingImpact,
  contactDomainForView,
  contactsForView,
  createContactVisualizationPlan,
  deriveContactVisibility,
  type ContactVisibility,
} from "../app/contactVisualization";
import { ARMAMENTS } from "../app/gameModel";

const none: ContactVisibility = { air: false, surface: false, subsurface: false };

function visibility(
  platformCounts: Record<string, number> = {},
  aircraftCounts: Record<string, number> = {},
  armamentCounts: Record<string, number> = {},
) {
  return deriveContactVisibility({
    platformCounts,
    aircraftCounts,
    armamentCounts,
    platforms: PLATFORMS,
    aircraft: AIRCRAFT,
    armaments: ARMAMENTS,
  });
}

test("uncredited or unknown selections reveal no opposing contact markers", () => {
  assert.deepEqual(visibility(), none);
  assert.deepEqual(visibility(
    { "area-defense-destroyer": 0, "not-a-platform": 12 },
    { "fixed-wing-surveillance-aircraft": Number.NaN },
    { "airborne-acoustic-pack": -3 },
  ), none);

  const plan = createContactVisualizationPlan(27, none);
  assert.deepEqual(plan.counts, { air: 0, surface: 0, subsurface: 0 });
  assert.deepEqual(plan.contacts, []);
});

test("credited systems reveal only domains supported by their tracking role and method", () => {
  assert.deepEqual(visibility({}, {}, { "area-air-interceptor-pack": 1 }), {
    air: true,
    surface: false,
    subsurface: false,
  });
  assert.deepEqual(visibility({}, {}, { "surface-guided-effect-pack": 1 }), {
    air: false,
    surface: true,
    subsurface: false,
  });
  assert.deepEqual(visibility({}, {}, { "airborne-acoustic-pack": 1 }), {
    air: false,
    surface: false,
    subsurface: true,
  });

  assert.deepEqual(visibility({}, { "fixed-wing-surveillance-aircraft": 1 }), {
    air: true,
    surface: true,
    subsurface: false,
  });
  assert.deepEqual(visibility({}, { "maritime-mission-helicopter": 1 }), {
    air: false,
    surface: true,
    subsurface: true,
  });
  assert.deepEqual(visibility({ "air-independent-submarine": 1 }), {
    air: false,
    surface: true,
    subsurface: true,
  });
});

test("unknown-contact populations are deterministic, abstract, and strictly bounded", () => {
  const all: ContactVisibility = { air: true, surface: true, subsurface: true };
  const first = createContactVisualizationPlan(0x51a7, all);
  const repeated = createContactVisualizationPlan(0x51a7, all);
  const different = createContactVisualizationPlan(0x51a8, all);

  assert.deepEqual(repeated, first);
  assert.notDeepEqual(different.contacts, first.contacts);
  assert.ok(first.counts.air >= 1 && first.counts.air <= CONTACT_LIMITS.air);
  assert.ok(first.counts.surface >= 1 && first.counts.surface <= CONTACT_LIMITS.surface);
  assert.ok(first.counts.subsurface >= 1 && first.counts.subsurface <= CONTACT_LIMITS.subsurface);
  assert.ok(first.contacts.length <= CONTACT_LIMITS.total);
  first.contacts.forEach((contact) => {
    assert.deepEqual(Object.keys(contact).sort(), ["domain", "heading", "scale", "x", "y", "z"]);
    assert.ok(Number.isFinite(contact.x));
    assert.ok(Number.isFinite(contact.y));
    assert.ok(Number.isFinite(contact.z));
  });
});

test("view gating puts detectable air contacts in sky and air, with no cross-domain leakage", () => {
  const plan = createContactVisualizationPlan(91, { air: true, surface: true, subsurface: true });

  assert.equal(contactDomainForView("stars"), null);
  assert.equal(contactDomainForView("sky"), "air");
  assert.equal(contactDomainForView("air"), "air");
  assert.equal(contactDomainForView("surface"), "surface");
  assert.equal(contactDomainForView("subsurface"), "subsurface");
  assert.deepEqual(contactsForView(plan, "stars"), []);
  assert.ok(contactsForView(plan, "sky").length >= 1);
  assert.deepEqual(contactsForView(plan, "air"), contactsForView(plan, "sky"));
  assert.ok(contactsForView(plan, "air").every((contact) => contact.domain === "air"));
  assert.ok(contactsForView(plan, "surface").every((contact) => contact.domain === "surface"));
  assert.ok(contactsForView(plan, "subsurface").every((contact) => contact.domain === "subsurface"));
});

test("opposing impact assessments require contact quality and sensing in the affected domain", () => {
  const airOnly: ContactVisibility = { air: true, surface: false, subsurface: false };
  assert.equal(canDiscloseOpposingImpact("air", 40, airOnly), true);
  assert.equal(canDiscloseOpposingImpact("subsurface", 100, airOnly), false);
  assert.equal(canDiscloseOpposingImpact("surface", 100, airOnly), false);
  assert.equal(canDiscloseOpposingImpact("mission-pack", 40, airOnly), true);
  assert.equal(canDiscloseOpposingImpact("communications", 39, airOnly), false);
  assert.equal(canDiscloseOpposingImpact("air", Number.NaN, airOnly), false);
  assert.equal(canDiscloseOpposingImpact("air", 100, none), false);
});
