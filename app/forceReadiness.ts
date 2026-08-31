import { AIRCRAFT, PLATFORMS } from "./catalog";
import { largestInventedDistance } from "./catalogMath";
import { evaluateForceAdaptation } from "./forceAdaptation";
import {
  ARMAMENTS,
  aircraftAffiliations,
  calculateMissionCreditedForcePoints,
  evaluateArmamentFit,
  evaluateAviationFit,
  hasSelectedAffiliation,
  type Difficulty,
  type EndState,
  type Guardrail,
  type Scenario,
  type TheoryLens,
  type Warfare,
} from "./gameModel";
import type { RigidForceManifestEntry, RigidReadiness } from "./kriegsspiel";
import { evaluatePlanningReadiness } from "./planningAssessment";

export type ForceReadinessInput = {
  scenario: Scenario;
  difficulty: Difficulty;
  fleet: Readonly<Record<string, number>>;
  airWing: Readonly<Record<string, number>>;
  selectedArmaments: Readonly<Record<string, number>>;
  selectedWarfare: Warfare[];
  selectedEndState: EndState | "";
  selectedLens: TheoryLens | "";
  selectedPartnerLens: TheoryLens | "";
  selectedGuardrail: Guardrail | "";
};

/**
 * Derive every force-credit and command-readiness value from the saved,
 * player-visible selections. Keeping this pure calculation outside the page
 * lets the import boundary replay an umpire state without trusting stored
 * readiness, deltas, or claimed outcomes.
 */
export function deriveForceReadiness(input: ForceReadinessInput) {
  const {
    scenario,
    difficulty,
    fleet,
    airWing,
    selectedArmaments,
    selectedWarfare,
    selectedEndState,
    selectedLens,
    selectedPartnerLens,
    selectedGuardrail,
  } = input;
  const surfaceCrew = PLATFORMS.reduce((sum, platform) => sum + platform.crew * (fleet[platform.id] || 0), 0);
  const aircrew = AIRCRAFT.reduce((sum, aircraft) => sum + aircraft.aircrew * (airWing[aircraft.id] || 0), 0);
  const aviationSupport = AIRCRAFT.reduce((sum, aircraft) => sum + aircraft.supportCrew * (airWing[aircraft.id] || 0), 0);
  const aviationFit = evaluateAviationFit(PLATFORMS, AIRCRAFT, fleet, airWing);
  const armamentFit = evaluateArmamentFit(PLATFORMS, AIRCRAFT, ARMAMENTS, fleet, aviationFit.supportedByAircraft, selectedArmaments);
  const pointCredit = calculateMissionCreditedForcePoints(
    PLATFORMS,
    AIRCRAFT,
    ARMAMENTS,
    fleet,
    aviationFit.supportedByAircraft,
    armamentFit.creditedByArmament,
    aviationFit.assignmentsByAircraft,
    armamentFit.assignmentsByArmament,
    selectedWarfare,
    Boolean(selectedEndState),
  );
  const { platformPoints, airPoints, armamentPoints } = pointCredit;
  const forcePoints = Math.round(pointCredit.total * 100) / 100;
  const uncrewedAircraft = AIRCRAFT
    .filter((item) => item.kind.startsWith("uncrewed-"))
    .reduce((sum, item) => sum + (pointCredit.creditedAircraft[item.id] || 0), 0);
  const creditedPlatforms = PLATFORMS.flatMap((platform) => Array.from(
    { length: pointCredit.creditedPlatforms[platform.id] || 0 },
    () => platform,
  ));
  const selectedAreas = new Set(selectedWarfare);
  const creditedAreas = (areas: Warfare[]) => pointCredit.ready ? areas.filter((area) => selectedAreas.has(area)) : [];
  const platformCoverage = new Set(creditedPlatforms.flatMap((platform) => creditedAreas(platform.warfare)));
  const aircraftCoverage = new Set(AIRCRAFT
    .filter((aircraft) => (pointCredit.creditedAircraft[aircraft.id] || 0) > 0)
    .flatMap((aircraft) => creditedAreas(aircraft.warfare)));
  const armamentCoverage = new Set(ARMAMENTS
    .filter((item) => (pointCredit.missionCreditedArmaments[item.id] || 0) > 0)
    .flatMap((item) => creditedAreas(item.warfare)));
  const allCoverage = new Set([...platformCoverage, ...aircraftCoverage, ...armamentCoverage]);
  const airDefenseShips = creditedPlatforms.reduce((sum, platform) => sum + platform.airDefenseValue, 0);
  const aswAssets = creditedPlatforms.reduce((sum, platform) => sum + platform.aswValue, 0)
    + Math.floor((pointCredit.creditedAircraft["maritime-mission-helicopter"] || 0) / 2)
    + Math.floor((pointCredit.creditedAircraft["maritime-patrol-aircraft"] || 0) / 2)
    + Math.floor((pointCredit.creditedAircraft["uncrewed-surveillance-rotorcraft"] || 0) / 4);
  const escorts = creditedPlatforms.filter((platform) => platform.screenUnit).length;
  const missionAircraftSelected = AIRCRAFT
    .filter((item) => hasSelectedAffiliation(aircraftAffiliations(item, ARMAMENTS), selectedWarfare))
    .reduce((sum, item) => sum + (airWing[item.id] || 0), 0);
  const missionAircraftCredited = Object.values(pointCredit.creditedAircraft).reduce((sum, count) => sum + count, 0);
  const missionArmamentsSelected = ARMAMENTS
    .filter((item) => hasSelectedAffiliation(item.warfare, selectedWarfare))
    .reduce((sum, item) => sum + (selectedArmaments[item.id] || 0), 0);
  const missionArmamentsCredited = Object.values(pointCredit.missionCreditedArmaments).reduce((sum, count) => sum + count, 0);
  const metrics = {
    surfaceCrew,
    aircrew,
    aviationSupport,
    aviationFit,
    armamentFit,
    pointCredit,
    uncrewedAircraft,
    platformPoints,
    airPoints,
    armamentPoints,
    forcePoints,
    forcePlanningReady: pointCredit.ready,
    allCoverage,
    airDefenseShips,
    aswAssets,
    escorts,
    missionAircraftSelected,
    missionAircraftCredited,
    missionArmamentsSelected,
    missionArmamentsCredited,
  };

  const forceAdaptation = evaluateForceAdaptation(
    scenario,
    PLATFORMS,
    AIRCRAFT,
    ARMAMENTS,
    pointCredit.creditedPlatforms,
    pointCredit.creditedAircraft,
    pointCredit.missionCreditedArmaments,
  );
  const planning = evaluatePlanningReadiness({
    scenario,
    selections: { selectedWarfare, selectedEndState, selectedLens, selectedPartnerLens, selectedGuardrail },
    metrics,
    difficulty,
    forceAdaptation,
  });

  const creditedAircraft = AIRCRAFT.filter((item) => (pointCredit.creditedAircraft[item.id] || 0) > 0);
  const creditedArmaments = ARMAMENTS.filter((item) => (pointCredit.missionCreditedArmaments[item.id] || 0) > 0);
  const aircraftReach = creditedAircraft.reduce((maximum, item) => Math.max(maximum, largestInventedDistance(item.missionReach)), 0);
  const packReach = creditedArmaments.reduce((maximum, item) => Math.max(maximum, largestInventedDistance(item.reach)), 0);
  const pairedAirEffectReach = creditedArmaments.reduce((maximum, armament) => {
    if (!(pointCredit.missionCreditedArmaments[armament.id] || 0)) return maximum;
    const assignments = armamentFit.assignmentsByArmament[armament.id] || {};
    const airborneHostReach = Object.entries(assignments).reduce((hostMaximum, [hostId, count]) => {
      const host = AIRCRAFT.find((item) => item.id === hostId);
      return count > 0 && host ? Math.max(hostMaximum, largestInventedDistance(host.missionReach)) : hostMaximum;
    }, 0);
    return Math.max(maximum, airborneHostReach ? airborneHostReach + largestInventedDistance(armament.reach) : 0);
  }, 0);
  const trackingMethods = new Set<string>();
  let trackCapacity = 0;
  for (const item of creditedAircraft) {
    const count = pointCredit.creditedAircraft[item.id] || 0;
    trackCapacity += item.trackCapacity * count;
    item.trackingMethods.forEach((method) => trackingMethods.add(method));
  }
  for (const item of creditedArmaments) {
    const count = pointCredit.missionCreditedArmaments[item.id] || 0;
    trackCapacity += item.trackCapacity * count;
    item.trackingMethods.forEach((method) => trackingMethods.add(method));
  }
  const lowSignaturePlatforms = PLATFORMS
    .filter((item) => item.visualSignature === "low")
    .reduce((sum, item) => sum + (pointCredit.creditedPlatforms[item.id] || 0), 0);
  const lowSignatureAir = creditedAircraft
    .filter((item) => item.visualSignature === "low")
    .reduce((sum, item) => sum + (pointCredit.creditedAircraft[item.id] || 0), 0);
  const uncrewedAirCount = creditedAircraft
    .filter((item) => item.kind.startsWith("uncrewed-"))
    .reduce((sum, item) => sum + (pointCredit.creditedAircraft[item.id] || 0), 0);
  const uncrewedSurfaceCount = (pointCredit.creditedPlatforms["uncrewed-aviation-ship"] || 0)
    + (pointCredit.creditedPlatforms["autonomous-mine-support-ship"] || 0);
  const uncrewedUnderseaCount = pointCredit.creditedPlatforms["undersea-systems-tender"] || 0;
  const submarineCount = (pointCredit.creditedPlatforms["air-independent-submarine"] || 0)
    + (pointCredit.creditedPlatforms["long-endurance-submarine"] || 0);
  const forceManifest: RigidForceManifestEntry[] = [
    ...PLATFORMS.flatMap((item) => {
      const quantity = pointCredit.creditedPlatforms[item.id] || 0;
      return quantity ? [{
        id: item.id,
        label: item.name,
        domain: item.id.includes("submarine") ? "subsurface" as const : "surface" as const,
        quantity,
        capabilities: [...item.capabilities],
      }] : [];
    }),
    ...AIRCRAFT.flatMap((item) => {
      const quantity = pointCredit.creditedAircraft[item.id] || 0;
      return quantity ? [{ id: item.id, label: item.name, domain: "air" as const, quantity, capabilities: [...item.capabilities] }] : [];
    }),
    ...ARMAMENTS.flatMap((item) => {
      const quantity = pointCredit.missionCreditedArmaments[item.id] || 0;
      return quantity ? [{ id: item.id, label: item.name, domain: "mission-pack" as const, quantity, capabilities: [item.role, item.reach] }] : [];
    }),
  ];
  const rigidReadiness: RigidReadiness = {
    planningScore: planning.assessment.score,
    missionReady: planning.fullyReady,
    requiredCoverage: scenario.required.filter((area) => allCoverage.has(area)).length,
    requiredCount: scenario.required.length,
    forcePoints,
    escortValue: escorts,
    airDefenseValue: airDefenseShips,
    underseaValue: aswAssets,
    uncrewedCount: uncrewedAirCount + uncrewedSurfaceCount + uncrewedUnderseaCount,
    uncrewedAirCount,
    uncrewedSurfaceCount,
    uncrewedUnderseaCount,
    submarineCount,
    supportedAircraftCount: aviationFit.supportedAircraft,
    compatibleArmamentCount: missionArmamentsCredited,
    maxReachNm: Math.max(25, aircraftReach, packReach, pairedAirEffectReach),
    trackCapacity,
    trackingMethods: [...trackingMethods].sort(),
    lowSignatureCount: lowSignaturePlatforms + lowSignatureAir,
    selectedUnitCount: Object.values(pointCredit.creditedPlatforms).reduce((sum, count) => sum + count, 0) + missionAircraftCredited,
    adaptationScore: forceAdaptation.score,
    adaptationLabel: forceAdaptation.label,
    adaptationEvidence: forceAdaptation.evidence,
    adaptationGaps: [
      ...forceAdaptation.criticalGaps,
      ...forceAdaptation.gaps.filter((gap) => !forceAdaptation.criticalGaps.includes(gap)),
    ],
    forceManifest,
  };

  return { metrics, forceAdaptation, ...planning, rigidReadiness };
}
