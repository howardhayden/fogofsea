import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Academy from "../app/Academy";
import { ACADEMY_MODULES } from "../app/academyData";
import {
  deriveAcademyGuidance,
  NAVAL_THEORY_PROBLEM_MAPPINGS,
  scenarioTheoryLenses,
  selectAcademyScenarioContext,
  theoryLensesForNavalProblem,
  THEORY_ACADEMY_MODULE,
  type AcademyGuidanceInput,
  type AcademyScenarioContext,
} from "../app/academyGuidance";
import { generateScenario, type TheoryLens } from "../app/gameModel";

const scenario: AcademyScenarioContext = {
  navalProblem: "Combine Corbett’s limited control of communications with Wegener’s emphasis on position and access. Decide what must concentrate, what can form barriers, and when the combination should dissolve.",
  lenses: ["corbett", "wegener", "richmond", "clausewitz"],
  required: ["reconnaissance", "undersea-operations"],
  recommended: ["electromagnetic-operations"],
  minimumUncrewed: 4,
};

function guidanceInput(overrides: Partial<AcademyGuidanceInput> = {}): AcademyGuidanceInput {
  return {
    scenario,
    gameplayPhase: "strategy",
    workspaceView: "decisions",
    selectedLens: "",
    selectedPartnerLens: "",
    ...overrides,
  };
}

function renderAcademy(overrides: Partial<AcademyGuidanceInput> = {}, initialModuleId?: string) {
  const input = guidanceInput(overrides);
  return renderToStaticMarkup(createElement(Academy, {
    initialModuleId,
    onClose: () => undefined,
    completed: [],
    onCompletedChange: () => undefined,
    savingEnabled: false,
    ...input,
  }));
}

test("scenario guidance follows theories bound to the holistic comparative problem", () => {
  assert.deepEqual(scenarioTheoryLenses(scenario), ["corbett", "wegener"]);
  const guidance = deriveAcademyGuidance(guidanceInput());

  assert.equal(guidance.source, "scenario");
  assert.deepEqual(guidance.theoryLenses, ["corbett", "wegener"]);
  assert.deepEqual(guidance.theoryModuleIds, ["corbett", "maritime-schools"]);
  assert.deepEqual(guidance.contextModuleIds, ["strategy-grammar"]);
  assert.deepEqual(guidance.defaultExpandedModuleIds, ["corbett", "maritime-schools", "strategy-grammar"]);
  assert.equal(guidance.primaryModuleId, "corbett");
});

test("structured problem metadata, not keyword matching, determines scenario theories", () => {
  const namePatterns: Record<TheoryLens, RegExp> = {
    "sun-tzu": /\bsun\s+tzu\b/iu,
    clausewitz: /\bclausewitz\b/iu,
    mahan: /\bmahan(?:ian)?\b/iu,
    aube: /\baube\b/iu,
    corbett: /\bcorbett\b/iu,
    richmond: /\brichmond\b/iu,
    wegener: /\bwegener\b/iu,
    castex: /\bcastex\b/iu,
    panikkar: /\bpanikkar\b/iu,
    gorshkov: /\bgorshkov\b/iu,
    "liu-huaqing": /\bliu\s+huaqing\b/iu,
    till: /\bTill\b/u,
    galula: /\bgalula\b/iu,
  };
  assert.equal(NAVAL_THEORY_PROBLEM_MAPPINGS.length, 30);
  assert.equal(new Set(NAVAL_THEORY_PROBLEM_MAPPINGS.map(({ problem }) => problem)).size, 30);
  for (const mapping of NAVAL_THEORY_PROBLEM_MAPPINGS) {
    const namesInAuthoredOrder = (Object.entries(namePatterns) as Array<[TheoryLens, RegExp]>)
      .map(([lens, pattern]) => ({ lens, index: mapping.problem.search(pattern) }))
      .filter(({ index }) => index >= 0)
      .sort((left, right) => left.index - right.index)
      .map(({ lens }) => lens);
    assert.deepEqual(mapping.lenses, namesInAuthoredOrder, mapping.problem);
  }

  assert.deepEqual(theoryLensesForNavalProblem(scenario), ["corbett", "wegener"]);
  const presentationOnly = {
    ...scenario,
    lenses: ["sun-tzu", "mahan"] as TheoryLens[],
    navalProblem: "Compare Sun Tzu with Mahan.",
  };
  assert.deepEqual(theoryLensesForNavalProblem(presentationOnly), []);
  assert.deepEqual(scenarioTheoryLenses(presentationOnly), ["sun-tzu", "mahan"]);
});

test("one provisional player theory cannot steer Academy recommendations", () => {
  const baseline = deriveAcademyGuidance(guidanceInput());
  const provisional = deriveAcademyGuidance(guidanceInput({ selectedLens: "sun-tzu" }));

  assert.equal(provisional.source, "scenario");
  assert.deepEqual(provisional.theoryLenses, baseline.theoryLenses);
  assert.deepEqual(provisional.defaultExpandedModuleIds, baseline.defaultExpandedModuleIds);
  assert.match(provisional.explanation, /incomplete pair does not steer/);
});

test("a complete distinct pair changes theory help to the player's recorded selections", () => {
  const guidance = deriveAcademyGuidance(guidanceInput({
    selectedLens: "sun-tzu",
    selectedPartnerLens: "mahan",
  }));

  assert.equal(guidance.source, "player-selections");
  assert.deepEqual(guidance.theoryLenses, ["sun-tzu", "mahan"]);
  assert.deepEqual(guidance.theoryModuleIds, ["sun-tzu", "mahan"]);
  assert.ok(!guidance.defaultExpandedModuleIds.includes("corbett"));
  assert.match(guidance.explanation, /neither changes nor judges/);

  const sharedModule = deriveAcademyGuidance(guidanceInput({
    selectedLens: "aube",
    selectedPartnerLens: "richmond",
  }));
  assert.deepEqual(sharedModule.theoryModuleIds, ["maritime-schools"]);
  assert.match(sharedModule.explanation, /both recorded theories is open/);
  assert.doesNotMatch(sharedModule.explanation, /Both lessons/);
});

test("duplicate or incomplete selections remain scenario-derived", () => {
  const duplicate = deriveAcademyGuidance(guidanceInput({
    selectedLens: "corbett",
    selectedPartnerLens: "corbett",
  }));
  const partnerOnly = deriveAcademyGuidance(guidanceInput({ selectedPartnerLens: "mahan" }));
  assert.equal(duplicate.source, "scenario");
  assert.equal(partnerOnly.source, "scenario");
  assert.deepEqual(partnerOnly.theoryLenses, scenarioTheoryLenses(scenario));
});

test("visualization proactively opens operational geometry without broadening the theory set", () => {
  const guidance = deriveAcademyGuidance(guidanceInput({ workspaceView: "visualization" }));

  assert.deepEqual(guidance.theoryModuleIds, ["corbett", "maritime-schools"]);
  assert.deepEqual(guidance.contextModuleIds, ["jomini"]);
  assert.equal(guidance.primaryModuleId, "jomini");
  assert.equal(guidance.heading, "Help for visualization");
});

test("gameplay phase contributes no more than one bounded contextual lesson", () => {
  const force = deriveAcademyGuidance(guidanceInput({ gameplayPhase: "force", workspaceView: "force" }));
  const command = deriveAcademyGuidance(guidanceInput({ gameplayPhase: "command", workspaceView: "command" }));
  const debrief = deriveAcademyGuidance(guidanceInput({ gameplayPhase: "debrief", workspaceView: "command" }));
  const safeguarding = deriveAcademyGuidance(guidanceInput({
    gameplayPhase: "force",
    workspaceView: "force",
    scenario: { ...scenario, required: ["maritime-interdiction"], recommended: [], minimumUncrewed: 4 },
  }));
  const uncrewed = deriveAcademyGuidance(guidanceInput({
    gameplayPhase: "force",
    workspaceView: "force",
    scenario: { ...scenario, required: ["reconnaissance"], recommended: [], minimumUncrewed: 1 },
  }));

  assert.deepEqual(force.contextModuleIds, ["undersea-campaigns"]);
  assert.deepEqual(safeguarding.contextModuleIds, ["littoral-safeguarding"]);
  assert.deepEqual(uncrewed.contextModuleIds, ["maritime-uncrewed"]);
  assert.deepEqual(command.contextModuleIds, ["compound-uncertainty"]);
  assert.deepEqual(debrief.contextModuleIds, ["synthesis"]);
  assert.equal(force.primaryModuleId, "undersea-campaigns");
  assert.equal(command.primaryModuleId, "compound-uncertainty");
  assert.equal(debrief.primaryModuleId, "synthesis");
  for (const result of [force, command, debrief]) {
    assert.ok(result.contextModuleIds.length <= 1);
    assert.deepEqual(
      new Set(result.defaultExpandedModuleIds),
      new Set([...result.theoryModuleIds, ...result.contextModuleIds]),
    );
  }
});

test("phase, workspace, and authority combinations keep one immediate contextual answer", () => {
  const phases = ["strategy", "force", "command", "debrief"] as const;
  const views = ["mission", "decisions", "force", "command", "visualization"] as const;
  const authorityCases = [
    { selectedLens: "" as const, selectedPartnerLens: "" as const, source: "scenario" },
    { selectedLens: "sun-tzu" as const, selectedPartnerLens: "mahan" as const, source: "player-selections" },
  ];

  for (const gameplayPhase of phases) {
    for (const workspaceView of views) {
      for (const authority of authorityCases) {
        const guidance = deriveAcademyGuidance(guidanceInput({ gameplayPhase, workspaceView, ...authority }));
        assert.equal(guidance.source, authority.source);
        assert.ok(guidance.contextModuleIds.length <= 1);
        if (workspaceView === "visualization") {
          assert.deepEqual(guidance.contextModuleIds, ["jomini"]);
          assert.equal(guidance.primaryModuleId, "jomini");
        } else if (gameplayPhase !== "strategy" && guidance.contextModuleIds.length) {
          assert.equal(guidance.primaryModuleId, guidance.contextModuleIds[0]);
        }
      }
    }
  }
});

test("older valid scenario prose receives a bounded two-lens fallback", () => {
  const legacy: AcademyScenarioContext = {
    ...scenario,
    navalProblem: "Compare the available mechanisms without naming a school in this older save.",
  };
  assert.deepEqual(scenarioTheoryLenses(legacy), ["corbett", "wegener"]);
});

test("every theory mapping and derived default points to an existing Academy module", () => {
  const moduleIds = new Set(ACADEMY_MODULES.map((module) => module.id));
  for (const [lens, moduleId] of Object.entries(THEORY_ACADEMY_MODULE) as Array<[TheoryLens, string]>) {
    assert.ok(moduleIds.has(moduleId), `${lens} maps to missing module ${moduleId}`);
  }

  const guidance = deriveAcademyGuidance(guidanceInput({ workspaceView: "visualization" }));
  for (const moduleId of guidance.defaultExpandedModuleIds) {
    assert.ok(moduleIds.has(moduleId), `derived missing module ${moduleId}`);
  }
});

test("guidance derivation is deterministic and does not mutate canonical state", () => {
  const input = guidanceInput();
  const before = JSON.stringify(input);
  const first = deriveAcademyGuidance(input);
  const second = deriveAcademyGuidance(input);

  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(input), before);
});

test("the runtime Academy boundary strips hidden scenario state and aliases", () => {
  const fullScenario = {
    ...scenario,
    matrix: { committedTurnDraws: [0.1, 0.9] },
    contacts: [{ domain: "subsurface", x: 0.4, y: 0.8 }],
    score: 100,
  };
  const selected = selectAcademyScenarioContext(fullScenario);

  assert.deepEqual(Object.keys(selected).sort(), [
    "lenses",
    "minimumUncrewed",
    "navalProblem",
    "recommended",
    "required",
  ]);
  assert.equal("matrix" in selected, false);
  assert.equal("adversaryCount" in selected, false);
  assert.equal("contacts" in selected, false);
  assert.equal("score" in selected, false);
  assert.notEqual(selected.lenses, fullScenario.lenses);
  assert.notEqual(selected.required, fullScenario.required);
  assert.notEqual(selected.recommended, fullScenario.recommended);
});

test("hidden adjudication and score-shaped fields cannot steer Academy guidance", () => {
  const baseline = guidanceInput();
  const extended = {
    ...baseline,
    scenario: {
      ...baseline.scenario,
      committedDraws: [0, 1, 0.5],
      hiddenEvents: ["future-disruption"],
      score: 100,
      contacts: [{ domain: "subsurface", x: 0.4, y: 0.8 }],
      adversaryCount: 3,
    },
    result: { won: true },
  } as unknown as AcademyGuidanceInput;

  assert.deepEqual(deriveAcademyGuidance(extended), deriveAcademyGuidance(baseline));
});

test("the rendered Academy opens the scenario-derived lesson and labels every suggestion", () => {
  const html = renderAcademy();
  assert.match(html, /data-guidance-source="scenario"/);
  assert.match(html, /data-module-id="corbett" open=""/);
  assert.match(html, /Corbett and maritime strategy/);
  assert.match(html, /SUGGESTED NOW/);
  assert.match(html, /Academy makes no selection/);
});

test("an explicit help target opens without hiding or broadening contextual suggestions", () => {
  const html = renderAcademy({
    gameplayPhase: "debrief",
    workspaceView: "command",
    selectedLens: "sun-tzu",
    selectedPartnerLens: "galula",
  }, "strategy-grammar");

  assert.match(html, /aria-current="page" class="active"[^>]*data-academy-module-id="strategy-grammar"/);
  assert.match(html, /data-module-id="strategy-grammar" open=""/);
  assert.match(html, /LESSON · REQUESTED HELP/);
  assert.match(html, /Sun Tzu and strategic advantage/);
  assert.match(html, /Galula and counterinsurgency/);
  assert.match(html, /Comparative strategy practicum/);
  assert.equal([...html.matchAll(/data-academy-suggested="true"/g)].length, 3);

  const overlapping = renderAcademy({}, "corbett");
  assert.match(overlapping, /data-module-id="corbett" open=""/);
  assert.match(overlapping, /LESSON · REQUESTED HELP/);
  assert.equal([...overlapping.matchAll(/data-academy-suggested="true"/g)].length, 3);
});

test("the rendered Academy changes defaults only for a complete theory pair", () => {
  const provisional = renderAcademy({ selectedLens: "sun-tzu" });
  const complete = renderAcademy({ selectedLens: "sun-tzu", selectedPartnerLens: "mahan" });

  assert.match(provisional, /data-guidance-source="scenario"/);
  assert.match(provisional, /data-module-id="corbett" open=""/);
  assert.match(complete, /data-guidance-source="player-selections"/);
  assert.match(complete, /data-module-id="sun-tzu" open=""/);
  assert.match(complete, /neither changes nor judges/);
});

test("the rendered compact visualization context opens Jomini without losing scenario suggestions", () => {
  const html = renderAcademy({ workspaceView: "visualization" });
  assert.match(html, /data-workspace-view="visualization"/);
  assert.match(html, /data-module-id="jomini" open=""/);
  assert.match(html, /Jomini and operational geometry/);
  assert.match(html, /Corbett and maritime strategy/);
});

test("a deterministic 480-scenario corpus keeps guidance canonical, bounded, and resolvable", () => {
  let state = 27183 >>> 0;
  const random = () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  const moduleIds = new Set(ACADEMY_MODULES.map((module) => module.id));
  const phases = ["strategy", "force", "command", "debrief"] as const;
  const coveredTheoryLenses = new Set<TheoryLens>();
  const coveredProblems = new Set<string>();

  for (let index = 0; index < 480; index += 1) {
    const generated = generateScenario(index, random);
    const problemTheoryLenses = theoryLensesForNavalProblem(generated);
    coveredProblems.add(generated.navalProblem);
    for (const lens of problemTheoryLenses) coveredTheoryLenses.add(lens);
    const guidance = deriveAcademyGuidance({
      scenario: generated,
      gameplayPhase: phases[index % phases.length],
      workspaceView: index % 5 === 0 ? "visualization" : index % 4 === 0 ? "force" : "decisions",
      selectedLens: "",
      selectedPartnerLens: "",
    });

    assert.equal(guidance.source, "scenario");
    assert.ok(problemTheoryLenses.length >= 2, `exercise ${generated.id} has no structured theory pair`);
    assert.deepEqual(guidance.theoryLenses, problemTheoryLenses, `exercise ${generated.id} fell through to legacy help`);
    assert.ok(guidance.contextModuleIds.length <= 1, `exercise ${generated.id} has unbounded context help`);
    assert.equal(
      guidance.defaultExpandedModuleIds.length,
      new Set(guidance.defaultExpandedModuleIds).size,
      `exercise ${generated.id} repeats a default module`,
    );
    for (const moduleId of guidance.defaultExpandedModuleIds) {
      assert.ok(moduleIds.has(moduleId), `exercise ${generated.id} resolves missing module ${moduleId}`);
    }
  }
  assert.equal(coveredProblems.size, 30);
  assert.deepEqual([...coveredTheoryLenses].sort(), Object.keys(THEORY_ACADEMY_MODULE).sort());
});
