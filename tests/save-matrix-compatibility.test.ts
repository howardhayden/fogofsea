import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { commandScenario } from "../app/commandPhase";
import { adversaryAssessmentOptions } from "../app/commandIntelligence";
import { deriveForceReadiness } from "../app/forceReadiness";
import { ADVERSARY_INTENT_ASSUMPTIONS, createInitialRigidState, resolveRigidTurn, type RigidGameState, type RigidOrders, type RigidTurnReport } from "../app/kriegsspiel";
import { formatPortableSave, parsePortableSave, type DecisionRecord, type PortableSave } from "../app/saveGame";
import { createScenarioMatrix } from "../app/scenarioMatrix";
import { INPUT_LIMITS } from "../app/inputSecurity";

type HistoricalSave = Omit<PortableSave, "version"> & { version: 4 };
type LegacyCampaign = {
  initialSave: HistoricalSave;
  states: Omit<RigidGameState, "reports">[];
  orders: RigidOrders[];
  reports: RigidTurnReport[];
  history: Omit<DecisionRecord, "rigidTurns">;
};

// Golden output was generated using an isolated git archive of this immutable
// pre-change commit, never regenerated with the new resolver. Repeated report
// prefixes are omitted only to keep the fixture compact.
const historical = JSON.parse(readFileSync(new URL("./fixtures/legacy-matrix-v1-campaigns.json", import.meta.url), "utf8")) as {
  sourceCommit: string;
  campaigns: LegacyCampaign[];
};

function expectedState(campaign: LegacyCampaign, turn: number): RigidGameState {
  return structuredClone({ ...campaign.states[turn], reports: campaign.reports.slice(0, turn) });
}

function legacySave(campaign: LegacyCampaign, turn: number): HistoricalSave {
  const save = structuredClone(campaign.initialSave);
  const state = expectedState(campaign, turn);
  save.game.rigidState = state;
  save.game.result = state.outcome;
  save.game.rigidOrders = campaign.orders[Math.min(turn, campaign.orders.length - 1)];
  if (state.phase === "complete") save.game.history = [{ ...campaign.history, rigidTurns: campaign.reports }];
  return save;
}

function readiness(save: HistoricalSave | PortableSave) {
  return deriveForceReadiness({ ...save.game, difficulty: save.preferences.difficulty,
    selectedArmaments: save.game.selectedArmaments ?? {}, selectedPartnerLens: save.game.selectedPartnerLens ?? "" }).rigidReadiness;
}

test("SAVE-MATRIX-01: immutable v4 campaigns retain every v1 report, draw, state and result through v5 import and continuation", () => {
  assert.equal(historical.sourceCommit, "56a8a9cffdb9831097efdc64a09dabd39f459779");
  assert.equal(historical.campaigns.length, 3);
  for (const campaign of historical.campaigns) {
    for (let turn = 0; turn < campaign.states.length; turn++) {
      const original = legacySave(campaign, turn);
      const restored = parsePortableSave(JSON.stringify(original));
      assert.equal(restored.version, 5);
      assert.equal(restored.game.scenario.matrix?.version, 1);
      assert.deepEqual(restored.game, original.game, `legacy ${original.preferences.difficulty}, checkpoint ${turn}`);
      assert.deepEqual(parsePortableSave(formatPortableSave(restored)), restored, "a migrated save can be exported and reloaded again");
      const rules = commandScenario(restored.game.scenario, restored.preferences.difficulty, restored.game.selectedLens);
      const force = readiness(restored);
      let state = restored.game.rigidState!;
      for (let next = turn; next < campaign.orders.length; next++) {
        state = resolveRigidTurn(state, campaign.orders[next], force, rules);
        assert.deepEqual(state, expectedState(campaign, next + 1), "new releases cannot rewrite any historical resolver outcome");
      }
    }
  }
});

test("SAVE-MATRIX-02: resolver provenance cannot be upgraded, downgraded or substituted in a resolved campaign", () => {
  const original = legacySave(historical.campaigns[1], 2);
  const restored = parsePortableSave(JSON.stringify(original));
  for (const target of ["scenario", "state", "both"] as const) {
    const corrupted = structuredClone(restored);
    if (target !== "state") corrupted.game.scenario.matrix!.version = 2;
    if (target !== "scenario") corrupted.game.rigidState!.matrix!.version = 2;
    assert.throws(() => parsePortableSave(JSON.stringify(corrupted)), /matrix|report chain|scenario/i);
  }
  const invalid = structuredClone(restored);
  (invalid.game.scenario.matrix as unknown as { version: number }).version = 3;
  assert.throws(() => parsePortableSave(JSON.stringify(invalid)), /scenario/i);
});

test("SAVE-MATRIX-03: current outer-draw saves round-trip and cannot masquerade as an old save wrapper", () => {
  const save = parsePortableSave(JSON.stringify(legacySave(historical.campaigns[1], 0)));
  const scenario = save.game.scenario;
  scenario.matrix = createScenarioMatrix({ exerciseId: scenario.id, climate: scenario.climate,
    regionId: scenario.regionId, season: scenario.season, adversaryCount: scenario.adversaryCount, version: 2 });
  const rules = commandScenario(scenario, save.preferences.difficulty, save.game.selectedLens);
  const force = readiness(save);
  const orders = historical.campaigns[1].orders[0];
  save.game.rigidState = resolveRigidTurn(createInitialRigidState(force, rules), orders, force, rules);
  save.game.rigidOrders = orders;
  assert.deepEqual(parsePortableSave(formatPortableSave(save)), save);
  for (const version of [1, 2, 3, 4]) {
    const downgraded = { ...save, version };
    assert.throws(() => parsePortableSave(JSON.stringify(downgraded)), /requires save format version 5/i);
  }
  const rerolled = structuredClone(save);
  const ultimate = rerolled.game.rigidState!.reports[0].matrixResolution!.ultimate;
  ultimate.draw = ultimate.draw === 100 ? 99 : ultimate.draw + 1;
  assert.throws(() => parsePortableSave(JSON.stringify(rerolled)), /umpire|matrix|report chain/i);
  const localDraw = structuredClone(save);
  Object.assign(localDraw.game.rigidState!.reports[0].matrixResolution!.components[0], { draw: 1, result: "success" });
  assert.throws(() => parsePortableSave(JSON.stringify(localDraw)), /umpire|matrix|report chain/i);
  const mixedArchive = { ...structuredClone(historical.campaigns[1].initialSave), version: 3 };
  mixedArchive.game.history = [{ ...historical.campaigns[1].history, rigidTurns: structuredClone(save.game.rigidState!.reports) }];
  for (const report of mixedArchive.game.history[0].rigidTurns!) {
    delete report.adversaryActions;
    delete report.inflictions;
    delete report.observationDomains;
  }
  assert.throws(() => parsePortableSave(JSON.stringify(mixedArchive)), /history requires save format version 5/i);
});

function earlySave(campaign: LegacyCampaign, turn: number, version: 1 | 2 | 3) {
  const save = { ...legacySave(campaign, turn), version };
  const state = save.game.rigidState!;
  state.version = 1;
  const earlyTranscript = (reports: RigidTurnReport[]) => reports.forEach((report) => {
    delete report.adversaryActions;
    delete report.inflictions;
    delete report.observationDomains;
    delete report.orders.adversaryAssessment;
  });
  earlyTranscript(state.reports);
  // Detach history before removing old presentation fields from the fixture.
  save.game.history = structuredClone(save.game.history);
  save.game.history.forEach((record) => earlyTranscript(record.rigidTurns ?? []));
  if (version < 3 && state.outcome) {
    const { won, score, title, notes } = state.outcome;
    state.outcome = { won, score, title, notes } as typeof state.outcome;
    save.game.result = { ...state.outcome };
  }
  return save;
}

test("SAVE-MATRIX-04: real pre-v3 active and completed campaigns migrate without a reexport dead end", () => {
  for (const campaign of historical.campaigns) for (const version of [1, 2, 3] as const) {
    for (const turn of [2, 6]) {
      const oldSave = earlySave(campaign, turn, version);
      const restored = parsePortableSave(JSON.stringify(oldSave));
      assert.equal(restored.version, 5);
      assert.equal(restored.game.scenario.matrix?.version, 1);
      assert.equal(restored.game.rigidState?.version, 2);
      const expected = expectedState(campaign, turn);
      for (const key of ["contactQuality", "readiness", "integrity", "supply", "escalation", "objectiveProgress", "opposingCohesion"] as const) {
        assert.equal(restored.game.rigidState![key], expected[key]);
      }
      expected.reports.forEach((report, index) => {
        const actual = restored.game.rigidState!.reports[index];
        assert.deepEqual(actual.delta, report.delta);
        assert.deepEqual(actual.matrixInput, report.matrixInput);
        assert.deepEqual(actual.matrixResolution, report.matrixResolution);
      });
      if (expected.outcome) {
        assert.deepEqual(restored.game.result, expected.outcome);
        assert.equal(restored.game.history[0].transcriptVersion, 1);
        assert.deepEqual(restored.game.history[0].rigidTurns, oldSave.game.history[0].rigidTurns);
      }
      assert.deepEqual(parsePortableSave(formatPortableSave(restored)), restored);
    }
  }
});

test("SAVE-MATRIX-05: historical outcome migration never bypasses exact replay or forgery checks", () => {
  const campaign = historical.campaigns[1];
  for (const corruption of ["delta", "score", "outcome-mismatch", "present-breakdown"] as const) {
    const save = earlySave(campaign, 6, 2);
    if (corruption === "delta") save.game.rigidState!.reports[0].delta.supply += 1;
    if (corruption === "score") {
      save.game.result!.score += 1;
      save.game.rigidState!.outcome!.score += 1;
    }
    if (corruption === "outcome-mismatch") save.game.result!.won = !save.game.result!.won;
    if (corruption === "present-breakdown") Object.assign(save.game.rigidState!.outcome!, { breakdown: {} });
    assert.throws(() => parsePortableSave(JSON.stringify(save)), /umpire|matrix|result|report chain/i, corruption);
  }
  const active = earlySave(campaign, 2, 2);
  active.game.rigidState!.integrity += 1;
  assert.throws(() => parsePortableSave(JSON.stringify(active)), /umpire|matrix|report chain/i);
});

test("SAVE-MATRIX-06: archival transcript metadata cannot weaken live-state or new-matrix validation", () => {
  const campaign = historical.campaigns[1];
  const restored = parsePortableSave(JSON.stringify(earlySave(campaign, 6, 3)));
  assert.equal(restored.game.history[0].transcriptVersion, 1);
  const missingProvenance = structuredClone(restored);
  delete missingProvenance.game.history[0].transcriptVersion;
  assert.throws(() => parsePortableSave(JSON.stringify(missingProvenance)), /Decision data/i);
  const invalidVersion = structuredClone(restored);
  Object.assign(invalidVersion.game.history[0], { transcriptVersion: 3 });
  assert.throws(() => parsePortableSave(JSON.stringify(invalidVersion)), /Decision data/i);
  const currentAsArchive = structuredClone(restored);
  const report = currentAsArchive.game.history[0].rigidTurns![0];
  Object.assign(report.matrixResolution!, { version: 2 });
  assert.throws(() => parsePortableSave(JSON.stringify(currentAsArchive)), /Decision data/i);
  const liveDowngrade = structuredClone(restored);
  liveDowngrade.game.rigidState!.version = 1;
  Object.assign(liveDowngrade.game.rigidState!, { transcriptVersion: 1 });
  assert.throws(() => parsePortableSave(JSON.stringify(liveDowngrade)), /typed intelligence/i);
});

test("SAVE-MATRIX-07: legacy pending assumptions must be supported before they become a current save", () => {
  const campaign = historical.campaigns[1];
  const options = adversaryAssessmentOptions(expectedState(campaign, 2));
  const unavailable = ADVERSARY_INTENT_ASSUMPTIONS.find((value) => !options.intent.some((option) => option.value === value));
  assert.ok(unavailable);
  for (const version of [1, 2, 3] as const) {
    const save = earlySave(campaign, 2, version);
    save.game.rigidOrders = { ...save.game.rigidOrders!, adversaryAssessment: { intent: unavailable } };
    assert.throws(() => parsePortableSave(JSON.stringify(save)), /Pending adversary assumptions/i);
  }
});

type PreUmpireSave = Omit<PortableSave, "version" | "game"> & {
  version: 1 | 2;
  game: Omit<PortableSave["game"], "result" | "rigidState" | "rigidOrders"> & {
    result: { won: boolean; score: number; title: string; notes: string[] };
  };
};

// This wire-format fixture was independently accepted by the immutable
// 56a8a9c parser, including its historical 102 -> 100 score normalization.
function preUmpireSave(): PreUmpireSave {
  return JSON.parse(readFileSync(new URL("./fixtures/pre-umpire-v2-save.json", import.meta.url), "utf8"));
}

const archiveNote = "Archived pre-umpire result; no replayable command turns were recorded.";

test("SAVE-MATRIX-08: detached pre-umpire results survive as visible archives, never invented campaigns", () => {
  for (const version of [1, 2] as const) {
    const original = preUmpireSave();
    original.version = version;
    const restored = parsePortableSave(JSON.stringify(original));
    assert.equal(restored.game.result, null);
    assert.equal(restored.game.rigidState, null);
    assert.equal(restored.game.rigidOrders, null);
    for (const key of ["scenario", "fleet", "airWing", "selectedWarfare", "selectedEndState", "selectedLens", "selectedGuardrail", "rationale", "assumptions", "termination"] as const) {
      assert.deepEqual(restored.game[key], original.game[key], key);
    }
    const archive = restored.game.history.at(-1)!;
    assert.deepEqual(archive.legacyResultArchive, { sourceVersion: version, won: true, originalScore: 102 });
    assert.equal(archive.rigidTurns, undefined);
    assert.equal(archive.transcriptVersion, undefined);
    assert.equal(archive.score, 100);
    assert.equal(archive.outcome, original.game.result.title);
    assert.deepEqual(archive.notes, [...original.game.result.notes, archiveNote]);
    assert.match(formatPortableSave(restored), /Archived legacy result: reported victory; original score 102/);
    let roundtrip = restored;
    for (let count = 0; count < 3; count++) {
      roundtrip = parsePortableSave(formatPortableSave(roundtrip));
      assert.deepEqual(roundtrip, restored);
    }
    const emptyPlanning = preUmpireSave();
    Object.assign(emptyPlanning.game, { selectedWarfare: [], selectedEndState: "", selectedLens: "", selectedPartnerLens: "", selectedGuardrail: "" });
    const empty = parsePortableSave(JSON.stringify(emptyPlanning));
    assert.equal(empty.game.history.at(-1)!.endState, "");
    assert.deepEqual(parsePortableSave(formatPortableSave(empty)), empty);
  }
});

test("SAVE-MATRIX-09: archival migration reuses matching records and respects history and note capacities", () => {
  const original = preUmpireSave();
  const initial = parsePortableSave(JSON.stringify(original));
  const matching = structuredClone(initial.game.history.at(-1)!);
  delete matching.legacyResultArchive;
  matching.notes = [...original.game.result.notes];
  matching.id = "existing-pre-umpire-record";
  original.game.history = [matching];
  const reused = parsePortableSave(JSON.stringify(original));
  assert.equal(reused.game.history.length, 1);
  assert.equal(reused.game.history[0].id, matching.id);
  assert.deepEqual(reused.game.history[0].notes, [...matching.notes, archiveNote]);
  assert.deepEqual(parsePortableSave(formatPortableSave(reused)), reused);

  original.game.history = Array.from({ length: 200 }, (_, index) => ({ ...structuredClone(matching), id: `historical-${index}`, outcome: `Historical result ${index}` }));
  assert.throws(() => parsePortableSave(JSON.stringify(original)), /decision history is full/i);
  original.game.history[199] = matching;
  const full = parsePortableSave(JSON.stringify(original));
  assert.equal(full.game.history.length, 200);
  assert.deepEqual(parsePortableSave(formatPortableSave(full)), full);

  const fullNotes = preUmpireSave();
  fullNotes.game.result.notes = Array.from({ length: 200 }, (_, index) => `Original note ${index}.`);
  const bounded = parsePortableSave(JSON.stringify(fullNotes));
  const notes = bounded.game.history.at(-1)!.notes;
  assert.equal(notes.length, 200);
  assert.equal(notes[0], `${fullNotes.game.result.notes[0]}\n${archiveNote}`);
  assert.deepEqual(notes.slice(1), fullNotes.game.result.notes.slice(1));
  assert.deepEqual(parsePortableSave(formatPortableSave(bounded)), bounded);
  fullNotes.game.result.notes = Array.from({ length: 200 }, () => "x".repeat(INPUT_LIMITS.recordText));
  assert.throws(() => parsePortableSave(JSON.stringify(fullNotes)), /2 MB local limit|no room for its required archive note/i);
  const nearLimit = preUmpireSave();
  nearLimit.game.result.notes = [];
  const bytes = () => new TextEncoder().encode(JSON.stringify(nearLimit)).byteLength;
  while (bytes() < INPUT_LIMITS.portableSaveBytes - 103) {
    nearLimit.game.result.notes.push("x".repeat(Math.min(INPUT_LIMITS.recordText, INPUT_LIMITS.portableSaveBytes - 103 - bytes())));
  }
  assert.ok(bytes() < INPUT_LIMITS.portableSaveBytes);
  assert.throws(() => parsePortableSave(JSON.stringify(nearLimit)), /archived pre-umpire result exceeds the portable-save limits/i);
});

test("SAVE-MATRIX-10: detached archival metadata cannot bypass structural, presentation or live-state validation", () => {
  for (const corruption of ["title", "notes", "extra-result-field"] as const) {
    const old = preUmpireSave();
    if (corruption === "title") old.game.result.title += "\u0000";
    if (corruption === "notes") old.game.result.notes.push("\u0000");
    if (corruption === "extra-result-field") Object.assign(old.game.result, { breakdown: {} });
    assert.throws(() => parsePortableSave(JSON.stringify(old)), /decision fields/i, corruption);
  }
  const initial = parsePortableSave(JSON.stringify(preUmpireSave()));
  for (const corruption of ["score", "turns", "archive-key", "note", "live-result"] as const) {
    const bad = structuredClone(initial);
    const archive = bad.game.history.at(-1)!;
    if (corruption === "score") archive.score--;
    if (corruption === "turns") archive.rigidTurns = [];
    if (corruption === "archive-key") Object.assign(archive.legacyResultArchive!, { canonical: true });
    if (corruption === "note") archive.notes = archive.notes.filter((note) => note !== archiveNote);
    if (corruption === "live-result") bad.game.result = expectedState(historical.campaigns[1], 6).outcome;
    assert.throws(() => parsePortableSave(JSON.stringify(bad)), /Decision data|canonical umpire state/i, corruption);
  }
});
