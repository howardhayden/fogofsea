import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Academy from "../app/Academy";
import { ACADEMY_MODULES } from "../app/academyData";
import {
  ACADEMY_STRATEGY_DECISION_ATOMS,
  type AcademyDecisionAtomId,
} from "../app/academyDecisionAtoms";
import {
  deriveAcademyGuidance,
  NAVAL_THEORY_PROBLEM_MAPPINGS,
  scenarioTheoryLenses,
  selectAcademyScenarioContext,
  theoryLensesForNavalProblem,
  THEORY_ACADEMY_ATOM,
  THEORY_ACADEMY_MODULE,
  type AcademyGuidanceInput,
  type AcademyScenarioContext,
} from "../app/academyGuidance";
import { academyLessonAtoms } from "../app/academyTheoryAtoms";
import { generateScenario, type TheoryLens } from "../app/gameModel";

const DECISION_ATOM_IDS: AcademyDecisionAtomId[] = [
  "first-phase-warfare",
  "first-phase-end-state",
  "first-phase-primary-theory",
  "first-phase-partner-theory",
  "first-phase-guardrail",
];

const PUBLIC_SCENARIO_FIELDS = [
  "brief",
  "civilianContext",
  "constraints",
  "friendlySituation",
  "intelligence",
  "navalProblem",
  "objective",
  "opposingSituation",
  "politicalAim",
  "successConditions",
] as const;

const scenario: AcademyScenarioContext = {
  brief: "Keep the relief passage usable while preserving freedom of political choice ashore.",
  friendlySituation: "A small joint force can protect movement but cannot impose permanent control.",
  opposingSituation: "Mobile coastal and undersea threats can contest the passage without seeking battle.",
  civilianContext: "Neutral shipping and relief traffic continue to use the approaches.",
  objective: "Create a protected, observable passage and transition it to routine civil use.",
  intelligence: "Reports identify intermittent barriers, but their location and timing remain uncertain.",
  constraints: "Avoid widening the conflict or displacing civil authority.",
  successConditions: "Relief traffic completes a protected transit under a sustainable monitoring arrangement.",
  navalProblem: "Combine Corbett’s limited control of communications with Wegener’s emphasis on position and access. Decide what must concentrate, what can form barriers, and when the combination should dissolve.",
  politicalAim: "Preserve reliable access without creating an open-ended coercive commitment.",
};

function guidanceInput(overrides: Partial<AcademyGuidanceInput> = {}): AcademyGuidanceInput {
  return {
    scenario,
    gameplayPhase: "strategy",
    workspaceView: "decisions",
    selectedWarfare: [],
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

function tagForDataAttribute(html: string, attribute: string, value: string) {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tag = html.match(new RegExp(`<details[^>]*${attribute}="${escaped}"[^>]*>`, "u"))?.[0];
  assert.ok(tag, `missing disclosure ${attribute}=${value}`);
  return tag;
}

function hasOpenAttribute(tag: string) {
  return /\sopen(?:="")?(?=\s|>)/u.test(tag);
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

test("the first-phase guide has exactly five decision atoms in gameplay order", () => {
  assert.deepEqual(ACADEMY_STRATEGY_DECISION_ATOMS.map((atom) => atom.id), DECISION_ATOM_IDS);
  assert.deepEqual(ACADEMY_STRATEGY_DECISION_ATOMS.map((atom) => atom.number), ["01", "02", "03", "04", "05"]);
  assert.deepEqual(ACADEMY_STRATEGY_DECISION_ATOMS.map((atom) => atom.evidence.map(({ key }) => key)), [
    ["brief", "friendlySituation", "opposingSituation", "objective", "intelligence"],
    ["politicalAim", "objective", "successConditions", "constraints"],
    ["navalProblem", "politicalAim"],
    ["navalProblem"],
    ["constraints", "civilianContext", "politicalAim"],
  ]);
  assert.deepEqual(deriveAcademyGuidance(guidanceInput()).decisionAtomIds, DECISION_ATOM_IDS);

  for (const atom of ACADEMY_STRATEGY_DECISION_ATOMS) {
    assert.ok(atom.prompt.trim(), `${atom.id} lacks a decision prompt`);
    assert.ok(atom.evidence.length > 0, `${atom.id} lacks public evidence`);
    for (const { key } of atom.evidence) {
      assert.ok(PUBLIC_SCENARIO_FIELDS.includes(key), `${atom.id} reads non-public field ${key}`);
      assert.ok(scenario[key].trim(), `${atom.id} receives empty public evidence ${key}`);
    }
  }
});

test("brief guidance follows thinkers named in the holistic comparative problem", () => {
  assert.deepEqual(scenarioTheoryLenses(scenario), ["corbett", "wegener"]);
  const guidance = deriveAcademyGuidance(guidanceInput());

  assert.equal(guidance.source, "brief");
  assert.deepEqual(guidance.decisionAtomIds, DECISION_ATOM_IDS);
  assert.deepEqual(guidance.theoryLenses, ["corbett", "wegener"]);
  assert.deepEqual(guidance.theoryAtomIds, [
    THEORY_ACADEMY_ATOM.corbett.atomId,
    THEORY_ACADEMY_ATOM.wegener.atomId,
  ]);
  assert.deepEqual(guidance.theoryModuleIds, ["corbett", "maritime-schools"]);
  assert.deepEqual(guidance.contextModuleIds, ["strategy-grammar"]);
  assert.deepEqual(guidance.defaultExpandedModuleIds, ["corbett", "maritime-schools", "strategy-grammar"]);
  assert.equal(guidance.primaryModuleId, "corbett");
  assert.equal(guidance.theoryRelevanceLabel, "NAMED IN THE BRIEF");
});

test("exact public problem prose, not keywords or hidden metadata, determines brief-linked theories", () => {
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

  assert.deepEqual(theoryLensesForNavalProblem(scenario.navalProblem), ["corbett", "wegener"]);
  assert.deepEqual(theoryLensesForNavalProblem("Compare Sun Tzu with Mahan."), []);
});

test("unknown public problem prose fails closed without a hidden-theory fallback", () => {
  const unknownScenario = {
    ...scenario,
    navalProblem: "Compare the available mechanisms without naming a school in this older save.",
    lenses: ["sun-tzu", "mahan"],
  } as AcademyScenarioContext & { lenses: TheoryLens[] };
  const guidance = deriveAcademyGuidance(guidanceInput({ scenario: unknownScenario }));

  assert.deepEqual(scenarioTheoryLenses(unknownScenario), []);
  assert.deepEqual(guidance.theoryLenses, []);
  assert.deepEqual(guidance.theoryAtomIds, []);
  assert.deepEqual(guidance.theoryModuleIds, []);
  assert.deepEqual(guidance.contextModuleIds, ["strategy-grammar"]);
  assert.deepEqual(guidance.defaultExpandedModuleIds, ["strategy-grammar"]);
  assert.equal(guidance.primaryModuleId, "strategy-grammar");
});

test("one provisional player theory cannot steer Academy recommendations", () => {
  const baseline = deriveAcademyGuidance(guidanceInput());
  const provisional = deriveAcademyGuidance(guidanceInput({ selectedLens: "sun-tzu" }));

  assert.equal(provisional.source, "brief");
  assert.deepEqual(provisional.theoryLenses, baseline.theoryLenses);
  assert.deepEqual(provisional.defaultExpandedModuleIds, baseline.defaultExpandedModuleIds);
  assert.match(provisional.explanation, /incomplete choice cannot steer/iu);
});

test("a complete distinct pair echoes the player's recorded theories without judging them", () => {
  const guidance = deriveAcademyGuidance(guidanceInput({
    selectedLens: "sun-tzu",
    selectedPartnerLens: "mahan",
  }));

  assert.equal(guidance.source, "player-selections");
  assert.deepEqual(guidance.decisionAtomIds, DECISION_ATOM_IDS);
  assert.deepEqual(guidance.theoryLenses, ["sun-tzu", "mahan"]);
  assert.deepEqual(guidance.theoryAtomIds, [
    THEORY_ACADEMY_ATOM["sun-tzu"].atomId,
    THEORY_ACADEMY_ATOM.mahan.atomId,
  ]);
  assert.deepEqual(guidance.theoryModuleIds, ["sun-tzu", "mahan"]);
  assert.ok(!guidance.defaultExpandedModuleIds.includes("corbett"));
  assert.equal(guidance.theoryRelevanceLabel, "YOUR RECORDED THEORY");
  assert.match(guidance.explanation, /without being checked or endorsed/iu);

  const sharedModule = deriveAcademyGuidance(guidanceInput({
    selectedLens: "aube",
    selectedPartnerLens: "richmond",
  }));
  assert.deepEqual(sharedModule.theoryAtomIds, [
    THEORY_ACADEMY_ATOM.aube.atomId,
    THEORY_ACADEMY_ATOM.richmond.atomId,
  ]);
  assert.notEqual(sharedModule.theoryAtomIds[0], sharedModule.theoryAtomIds[1]);
  assert.deepEqual(sharedModule.theoryModuleIds, ["maritime-schools"]);
});

test("duplicate or incomplete theory selections remain anchored to public prose", () => {
  const duplicate = deriveAcademyGuidance(guidanceInput({
    selectedLens: "corbett",
    selectedPartnerLens: "corbett",
  }));
  const partnerOnly = deriveAcademyGuidance(guidanceInput({ selectedPartnerLens: "mahan" }));
  assert.equal(duplicate.source, "brief");
  assert.equal(partnerOnly.source, "brief");
  assert.deepEqual(partnerOnly.theoryLenses, scenarioTheoryLenses(scenario));
});

test("visualization opens operational geometry without broadening the theory set", () => {
  const guidance = deriveAcademyGuidance(guidanceInput({ workspaceView: "visualization" }));

  assert.deepEqual(guidance.theoryModuleIds, ["corbett", "maritime-schools"]);
  assert.deepEqual(guidance.contextModuleIds, ["jomini"]);
  assert.equal(guidance.primaryModuleId, "jomini");
  assert.equal(guidance.heading, "Help for visualization");
});

test("later-phase context follows only player-authored selections and stays bounded", () => {
  const force = deriveAcademyGuidance(guidanceInput({
    gameplayPhase: "force",
    workspaceView: "force",
    selectedWarfare: ["undersea-operations"],
  }));
  const safeguarding = deriveAcademyGuidance(guidanceInput({
    gameplayPhase: "force",
    workspaceView: "force",
    selectedWarfare: ["maritime-interdiction"],
  }));
  const uncrewed = deriveAcademyGuidance(guidanceInput({
    gameplayPhase: "force",
    workspaceView: "force",
    selectedWarfare: ["reconnaissance"],
  }));
  const noSelection = deriveAcademyGuidance(guidanceInput({
    gameplayPhase: "force",
    workspaceView: "force",
    selectedWarfare: [],
  }));
  const command = deriveAcademyGuidance(guidanceInput({ gameplayPhase: "command", workspaceView: "command" }));
  const debrief = deriveAcademyGuidance(guidanceInput({ gameplayPhase: "debrief", workspaceView: "command" }));

  assert.deepEqual(force.contextModuleIds, ["undersea-campaigns"]);
  assert.deepEqual(safeguarding.contextModuleIds, ["littoral-safeguarding"]);
  assert.deepEqual(uncrewed.contextModuleIds, ["maritime-uncrewed"]);
  assert.deepEqual(noSelection.contextModuleIds, ["risk-resilience"]);
  assert.deepEqual(command.contextModuleIds, ["compound-uncertainty"]);
  assert.deepEqual(debrief.contextModuleIds, ["synthesis"]);
  assert.equal(force.primaryModuleId, "undersea-campaigns");
  assert.equal(command.primaryModuleId, "compound-uncertainty");
  assert.equal(debrief.primaryModuleId, "synthesis");
  for (const result of [force, safeguarding, uncrewed, noSelection, command, debrief]) {
    assert.ok(result.contextModuleIds.length <= 1);
    assert.deepEqual(
      new Set(result.defaultExpandedModuleIds),
      new Set([...result.theoryModuleIds, ...result.contextModuleIds]),
    );
  }
});

test("phase, workspace, and selection combinations keep one immediate contextual lesson", () => {
  const phases = ["strategy", "force", "command", "debrief"] as const;
  const views = ["mission", "decisions", "force", "command", "visualization"] as const;
  const authorityCases = [
    { selectedLens: "" as const, selectedPartnerLens: "" as const, source: "brief" },
    { selectedLens: "sun-tzu" as const, selectedPartnerLens: "mahan" as const, source: "player-selections" },
  ];

  for (const gameplayPhase of phases) {
    for (const workspaceView of views) {
      for (const authority of authorityCases) {
        const guidance = deriveAcademyGuidance(guidanceInput({
          gameplayPhase,
          workspaceView,
          selectedWarfare: ["mine-countermeasures"],
          ...authority,
        }));
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

test("every theory and derived default resolves to an existing Academy module", () => {
  const moduleIds = new Set(ACADEMY_MODULES.map((module) => module.id));
  for (const [lens, moduleId] of Object.entries(THEORY_ACADEMY_MODULE) as Array<[TheoryLens, string]>) {
    assert.ok(moduleIds.has(moduleId), `${lens} maps to missing module ${moduleId}`);
  }

  const atomEntries = Object.entries(THEORY_ACADEMY_ATOM) as Array<[
    TheoryLens,
    { atomId: string; moduleId: string },
  ]>;
  assert.deepEqual(
    atomEntries.map(([lens]) => lens).sort(),
    (Object.keys(THEORY_ACADEMY_MODULE) as TheoryLens[]).sort(),
  );
  assert.equal(new Set(atomEntries.map(([, atom]) => atom.atomId)).size, atomEntries.length);
  assert.equal(atomEntries.length, 13);
  for (const [lens, atom] of atomEntries) {
    assert.equal(atom.moduleId, THEORY_ACADEMY_MODULE[lens], `${lens} atom changed module authority`);
    assert.ok(moduleIds.has(atom.moduleId), `${lens} atom maps to missing module ${atom.moduleId}`);
  }

  const guidance = deriveAcademyGuidance(guidanceInput({ workspaceView: "visualization" }));
  for (const moduleId of guidance.defaultExpandedModuleIds) {
    assert.ok(moduleIds.has(moduleId), `derived missing module ${moduleId}`);
  }
});

test("strategist atoms preserve existing curriculum prose and module progress keys", () => {
  assert.equal(ACADEMY_MODULES.length, 25);
  for (const module of ACADEMY_MODULES) {
    const atoms = academyLessonAtoms(module);
    const source = module.lesson.join(" ");
    if (atoms.length > 0) {
      assert.equal(
        atoms.flatMap((atom) => atom.paragraphs).join(" "),
        source,
        `${module.id} atomization must preserve exact lesson order and coverage`,
      );
    }
    for (const atom of atoms) {
      assert.equal(atom.moduleId, module.id);
      for (const paragraph of atom.paragraphs) {
        assert.ok(source.includes(paragraph), `${atom.atomId} introduced prose outside ${module.id}`);
      }
    }
  }
});

test("every brief-mapped strategist renders a substantive open premise", () => {
  const lenses = Object.keys(THEORY_ACADEMY_ATOM) as TheoryLens[];

  for (const lens of lenses) {
    const mapping = NAVAL_THEORY_PROBLEM_MAPPINGS.find(({ lenses: mapped }) => mapped.includes(lens));
    assert.ok(mapping, `${lens} has no public-problem mapping`);
    const target = THEORY_ACADEMY_ATOM[lens];
    const module = ACADEMY_MODULES.find((candidate) => candidate.id === target.moduleId);
    assert.ok(module, `${lens} maps to missing module ${target.moduleId}`);
    const atom = academyLessonAtoms(module).find((candidate) => candidate.atomId === target.atomId);
    assert.ok(atom, `${lens} maps to missing atom ${target.atomId}`);
    const premise = atom.paragraphs[0] || "";
    assert.ok(premise.length >= 120, `${lens} premise is not substantive`);

    const html = renderAcademy({ scenario: { ...scenario, navalProblem: mapping.problem } });
    const disclosure = tagForDataAttribute(html, "data-academy-guide-theory-atom", target.atomId);
    assert.equal(hasOpenAttribute(disclosure), true, `${lens} premise must start open`);
    const renderedPremise = renderToStaticMarkup(createElement("p", null, premise));
    assert.ok(html.includes(renderedPremise), `${lens} full premise is not present in Now`);
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

test("the runtime projection exposes exactly the public Academy field allowlist", () => {
  const fullScenario = generateScenario(0, seededRandom(91827));
  const selected = selectAcademyScenarioContext(fullScenario);

  assert.deepEqual(Object.keys(selected).sort(), [...PUBLIC_SCENARIO_FIELDS]);
  for (const key of PUBLIC_SCENARIO_FIELDS) assert.equal(selected[key], fullScenario[key]);
  for (const prohibited of [
    "required",
    "recommended",
    "endState",
    "guardrail",
    "lenses",
    "minimumEscort",
    "minimumAirDefense",
    "minimumAsw",
    "minimumUncrewed",
    "matrix",
    "adversaryCount",
    "score",
  ]) {
    assert.equal(prohibited in selected, false, `projection leaked ${prohibited}`);
  }
});

test("mutating hidden answers before projection cannot steer guidance or rendered DOM", () => {
  const baselineFull = generateScenario(11, seededRandom(77341));
  const mutatedFull = {
    ...baselineFull,
    required: ["land-attack", "missile-defense"],
    recommended: ["air-defense"],
    endState: baselineFull.endState === "denial" ? "access" : "denial",
    guardrail: baselineFull.guardrail === "civilian" ? "sustainability" : "civilian",
    lenses: ["sun-tzu", "mahan"],
    minimumEscort: baselineFull.minimumEscort + 91,
    minimumAirDefense: baselineFull.minimumAirDefense + 92,
    minimumAsw: baselineFull.minimumAsw + 93,
    minimumUncrewed: baselineFull.minimumUncrewed + 94,
    adversaryCount: 99,
    matrix: { hiddenAnswer: "changed" },
    contacts: [{ domain: "subsurface", x: 0.4, y: 0.8 }],
    score: 100,
    result: { won: true },
  } as unknown as typeof baselineFull;
  const baselineProjection = selectAcademyScenarioContext(baselineFull);
  const mutatedProjection = selectAcademyScenarioContext(mutatedFull);

  assert.deepEqual(mutatedProjection, baselineProjection);
  const playerAuthored = {
    gameplayPhase: "strategy" as const,
    workspaceView: "decisions" as const,
    selectedWarfare: ["surface-operations"] as const,
    selectedLens: "" as const,
    selectedPartnerLens: "" as const,
  };
  assert.deepEqual(
    deriveAcademyGuidance({ scenario: mutatedProjection, ...playerAuthored }),
    deriveAcademyGuidance({ scenario: baselineProjection, ...playerAuthored }),
  );
  assert.equal(
    renderAcademy({ scenario: mutatedProjection, ...playerAuthored }),
    renderAcademy({ scenario: baselineProjection, ...playerAuthored }),
  );
});

test("the default Academy SSR opens NOW with five methods and every relevant premise", () => {
  const guidance = deriveAcademyGuidance(guidanceInput());
  const html = renderAcademy();
  const guidePanelTag = html.match(/<div[^>]*id="academy-panel-guide"[^>]*>/u)?.[0];
  const libraryPanelTag = html.match(/<div[^>]*id="academy-panel-course"[^>]*>/u)?.[0];
  const comparePanelTag = html.match(/<div[^>]*id="academy-panel-compare"[^>]*>/u)?.[0];
  const sourcesPanelTag = html.match(/<div[^>]*id="academy-panel-sources"[^>]*>/u)?.[0];
  assert.ok(guidePanelTag);
  assert.ok(libraryPanelTag);
  assert.ok(comparePanelTag);
  assert.ok(sourcesPanelTag);
  assert.doesNotMatch(guidePanelTag, /\shidden(?:="")?/u);
  for (const hiddenPanel of [libraryPanelTag, comparePanelTag, sourcesPanelTag]) {
    assert.match(hiddenPanel, /\shidden(?:="")?/u);
  }
  assert.match(html, /id="academy-view-guide"[^>]*aria-selected="true"/u);
  assert.match(html, /id="academy-view-course"[^>]*aria-selected="false"/u);
  assert.match(html, /data-guidance-source="brief"/u);

  const decisionTags = [...html.matchAll(/<details[^>]*data-academy-decision-atom="([^"]+)"[^>]*>/gu)];
  assert.deepEqual(decisionTags.map((match) => match[1]), DECISION_ATOM_IDS);
  assert.equal(decisionTags.length, 5);
  assert.ok(decisionTags.every((match) => hasOpenAttribute(match[0])));

  const theoryTags = [...html.matchAll(/<details[^>]*data-academy-guide-theory-atom="([^"]+)"[^>]*>/gu)];
  assert.deepEqual(theoryTags.map((match) => match[1]), guidance.theoryAtomIds);
  assert.ok(theoryTags.every((match) => hasOpenAttribute(match[0])));
  assert.equal(theoryTags.length, 2);
  assert.equal([...html.matchAll(/NAMED IN THE BRIEF/gu)].length >= theoryTags.length, true);

  const lessonBody = html.match(/<details[^>]*class="lesson-body"[^>]*>/u)?.[0];
  assert.ok(lessonBody);
  assert.equal(hasOpenAttribute(lessonBody), false, "Library lesson body must start closed behind its hidden panel");
  for (const disclosureClass of [
    "lesson-objectives",
    "academy-disclosure",
    "seminar-prompt",
    "knowledge-check",
    "reading-list",
  ]) {
    const tags = [...html.matchAll(new RegExp(`<details[^>]*class="[^"]*${disclosureClass}[^"]*"[^>]*>`, "gu"))];
    assert.ok(tags.length > 0, `missing ${disclosureClass} progressive disclosure`);
    assert.ok(tags.every((match) => !hasOpenAttribute(match[0])), `${disclosureClass} must start closed`);
  }
});

test("an explicit lesson target enters Library while preserving bounded relevance", () => {
  const html = renderAcademy({
    gameplayPhase: "debrief",
    workspaceView: "command",
    selectedLens: "sun-tzu",
    selectedPartnerLens: "galula",
  }, "strategy-grammar");

  assert.match(html, /id="academy-view-course"[^>]*aria-selected="true"/u);
  assert.match(html, /aria-current="page" class="active[^"]*"[^>]*data-academy-module-id="strategy-grammar"/u);
  assert.match(html, /data-module-id="strategy-grammar" open=""/u);
  assert.match(html, /LESSON · REQUESTED HELP/u);
  assert.match(html, /Sun Tzu and strategic advantage/u);
  assert.match(html, /Galula and counterinsurgency/u);
  assert.match(html, /Comparative strategy practicum/u);
  assert.equal([...html.matchAll(/data-academy-relevant="true"/gu)].length, 3);

  const explicitTheory = renderAcademy({}, "galula");
  const explicitTheoryAtom = tagForDataAttribute(explicitTheory, "data-academy-atom-id", THEORY_ACADEMY_ATOM.galula.atomId);
  assert.equal(hasOpenAttribute(explicitTheoryAtom), true);
  assert.doesNotMatch(explicitTheoryAtom, /data-academy-atom-relevant=/u);

  const explicitSharedModule = renderAcademy({
    selectedLens: "sun-tzu",
    selectedPartnerLens: "mahan",
  }, "maritime-schools");
  assert.match(explicitSharedModule, /data-module-id="maritime-schools" open=""/u);
  for (const lens of ["aube", "richmond", "wegener", "castex"] as const) {
    assert.equal(
      hasOpenAttribute(tagForDataAttribute(explicitSharedModule, "data-academy-atom-id", THEORY_ACADEMY_ATOM[lens].atomId)),
      false,
    );
  }
});

test("the rendered Academy changes theory premises only for a complete recorded pair", () => {
  const provisional = renderAcademy({ selectedLens: "sun-tzu" });
  const complete = renderAcademy({ selectedLens: "sun-tzu", selectedPartnerLens: "mahan" });

  assert.match(provisional, /data-guidance-source="brief"/u);
  assert.equal(
    hasOpenAttribute(tagForDataAttribute(provisional, "data-academy-guide-theory-atom", THEORY_ACADEMY_ATOM.corbett.atomId)),
    true,
  );
  assert.match(complete, /data-guidance-source="player-selections"/u);
  assert.equal(
    hasOpenAttribute(tagForDataAttribute(complete, "data-academy-guide-theory-atom", THEORY_ACADEMY_ATOM["sun-tzu"].atomId)),
    true,
  );
  assert.match(complete, /without being checked or endorsed/iu);
  assert.doesNotMatch(complete, /correct theory|recommended theory|best theory/iu);
});

test("grouped mappings open every relevant Guide premise while unrelated curriculum stays disclosed", () => {
  const comparativeScenario: AcademyScenarioContext = {
    ...scenario,
    navalProblem: "Use Castex’s combinations to connect Aube’s dispersed pressure with Mahanian mass. Explain where concentration becomes necessary and where it would instead expose the force to defeat in detail.",
  };
  const guidance = deriveAcademyGuidance(guidanceInput({ scenario: comparativeScenario }));
  assert.deepEqual(guidance.theoryLenses, ["castex", "aube", "mahan"]);
  assert.deepEqual(guidance.theoryAtomIds, [
    THEORY_ACADEMY_ATOM.castex.atomId,
    THEORY_ACADEMY_ATOM.aube.atomId,
    THEORY_ACADEMY_ATOM.mahan.atomId,
  ]);
  assert.deepEqual(guidance.theoryModuleIds, ["maritime-schools", "mahan"]);

  const html = renderAcademy({ scenario: comparativeScenario });
  const guideTheoryTags = [...html.matchAll(/<details[^>]*data-academy-guide-theory-atom="([^"]+)"[^>]*>/gu)];
  assert.deepEqual(guideTheoryTags.map((match) => match[1]), guidance.theoryAtomIds);
  assert.ok(guideTheoryTags.every((match) => hasOpenAttribute(match[0])));
  assert.equal(guideTheoryTags.length, 3);
  assert.doesNotMatch(html, new RegExp(`data-academy-guide-theory-atom="${THEORY_ACADEMY_ATOM.richmond.atomId}"`, "u"));
  assert.doesNotMatch(html, new RegExp(`data-academy-guide-theory-atom="${THEORY_ACADEMY_ATOM.wegener.atomId}"`, "u"));

  const libraryBody = html.match(/<details[^>]*class="lesson-body"[^>]*>/u)?.[0];
  assert.ok(libraryBody);
  assert.equal(hasOpenAttribute(libraryBody), false);
});

test("all 480 generated scenarios receive complete first-phase support in Strategy", () => {
  const random = seededRandom(27183);
  const moduleIds = new Set(ACADEMY_MODULES.map((module) => module.id));
  const coveredTheoryLenses = new Set<TheoryLens>();
  const coveredProblems = new Set<string>();

  for (let index = 0; index < 480; index += 1) {
    const generated = generateScenario(index, random);
    const projected = selectAcademyScenarioContext(generated);
    const problemTheoryLenses = theoryLensesForNavalProblem(projected.navalProblem);
    coveredProblems.add(projected.navalProblem);
    for (const lens of problemTheoryLenses) coveredTheoryLenses.add(lens);
    const guidance = deriveAcademyGuidance({
      scenario: projected,
      gameplayPhase: "strategy",
      workspaceView: "decisions",
      selectedWarfare: [],
      selectedLens: "",
      selectedPartnerLens: "",
    });

    assert.equal(guidance.source, "brief");
    assert.deepEqual(guidance.decisionAtomIds, DECISION_ATOM_IDS, `exercise ${generated.id} lost a first-phase method`);
    for (const atom of ACADEMY_STRATEGY_DECISION_ATOMS) {
      assert.ok(atom.evidence.length > 0, `${atom.id} has no evidence definition`);
      for (const { key } of atom.evidence) {
        assert.ok(projected[key].trim(), `exercise ${generated.id} has no visible ${key} evidence for ${atom.id}`);
      }
    }
    assert.ok(problemTheoryLenses.length >= 2, `exercise ${generated.id} has no public-prose theory pair`);
    assert.deepEqual(guidance.theoryLenses, problemTheoryLenses, `exercise ${generated.id} changed public-prose theories`);
    assert.deepEqual(
      guidance.theoryAtomIds,
      problemTheoryLenses.map((lens) => THEORY_ACADEMY_ATOM[lens].atomId),
      `exercise ${generated.id} changed authored strategist order`,
    );
    assert.equal(guidance.theoryAtomIds.length, guidance.theoryLenses.length, `exercise ${generated.id} collapsed strategist atoms`);
    assert.equal(new Set(guidance.theoryAtomIds).size, guidance.theoryAtomIds.length, `exercise ${generated.id} repeats a strategist atom`);
    assert.deepEqual(guidance.contextModuleIds, ["strategy-grammar"]);
    assert.equal(guidance.defaultExpandedModuleIds.length, new Set(guidance.defaultExpandedModuleIds).size);
    for (const moduleId of guidance.defaultExpandedModuleIds) {
      assert.ok(moduleIds.has(moduleId), `exercise ${generated.id} resolves missing module ${moduleId}`);
    }
  }
  assert.equal(coveredProblems.size, 30);
  assert.deepEqual([...coveredTheoryLenses].sort(), Object.keys(THEORY_ACADEMY_MODULE).sort());
});
