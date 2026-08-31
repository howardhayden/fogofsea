import assert from "node:assert/strict";
import test from "node:test";
import { AIRCRAFT, PLATFORMS } from "../../app/catalog";
import { ARMAMENTS, emptyCounts, evaluateArmamentFit, type Armament } from "../../app/gameModel";

function adversarialAllocation(
  platforms = PLATFORMS,
  aircraft = AIRCRAFT,
  armaments: Armament[] = ARMAMENTS,
) {
  const fleet = emptyCounts(platforms);
  fleet["stealth-littoral-corvette"] = 1;
  fleet["undersea-systems-tender"] = 1;

  const selectedArmaments = emptyCounts(armaments);
  selectedArmaments["mine-neutralization-pack"] = 2;
  selectedArmaments["shipborne-asw-pack"] = 1;
  selectedArmaments["vessel-electromagnetic-deception-pack"] = 2;

  return evaluateArmamentFit(
    platforms,
    aircraft,
    armaments,
    fleet,
    emptyCounts(aircraft),
    selectedArmaments,
  );
}

test("RT-RULE-003A exact armament matching finds the feasible five-pack allocation", () => {
  const fit = adversarialAllocation();

  assert.equal(fit.totalSelected, 5);
  assert.equal(fit.totalCredited, 5);
  assert.equal(fit.deficit, 0);
  assert.deepEqual(fit.assignmentsByArmament["mine-neutralization-pack"], {
    "undersea-systems-tender": 2,
  });
  assert.deepEqual(fit.assignmentsByArmament["shipborne-asw-pack"], {
    "undersea-systems-tender": 1,
  });
  assert.deepEqual(fit.assignmentsByArmament["vessel-electromagnetic-deception-pack"], {
    "stealth-littoral-corvette": 2,
  });
});

test("RT-RULE-003B exact armament matching is invariant to catalog and host order", () => {
  const reorderedArmaments = [...ARMAMENTS]
    .reverse()
    .map((armament) => ({ ...armament, hostIds: [...armament.hostIds].reverse() }));
  const baseline = adversarialAllocation();
  const reordered = adversarialAllocation(
    [...PLATFORMS].reverse(),
    [...AIRCRAFT].reverse(),
    reorderedArmaments,
  );

  assert.deepEqual(reordered, baseline);
});
