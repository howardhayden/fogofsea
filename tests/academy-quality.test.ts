import assert from "node:assert/strict";
import test from "node:test";
import { ACADEMY_MODULES, THINKER_COMPARISON, THINKER_CLUSTERS } from "../app/academyData";

test("every Academy module presents a complete, assessable argument", () => {
  const ids = new Set<string>();
  const numbers = new Set<string>();
  for (const module of ACADEMY_MODULES) {
    assert.ok(!ids.has(module.id), `duplicate module id ${module.id}`);
    assert.ok(!numbers.has(module.number), `duplicate module number ${module.number}`);
    ids.add(module.id);
    numbers.add(module.number);
    assert.ok(module.objectives.length >= 3, `${module.id} needs three objectives`);
    assert.ok(module.lesson.length >= 3 && module.lesson.every((paragraph) => paragraph.length >= 180), `${module.id} needs three substantive lesson paragraphs`);
    assert.ok(module.concepts.length >= 3, `${module.id} needs at least three defined concepts`);
    assert.ok(module.readings.length >= 3, `${module.id} needs primary and secondary reading leads`);
    assert.ok(module.quiz.options.length >= 4 && module.quiz.correct >= 0 && module.quiz.correct < module.quiz.options.length, `${module.id} quiz is invalid`);
    assert.ok(module.application.length >= 80 && module.discussion.length >= 70 && module.misreading.length >= 70, `${module.id} needs application, discussion, and misconception checks`);
  }
});

test("the maritime curriculum covers fleet, commerce, undersea, and uncrewed strategy", () => {
  const maritime = ACADEMY_MODULES.filter((module) => ["mahan", "corbett", "maritime-schools", "global-seapower", "maritime-uncrewed", "undersea-campaigns"].includes(module.id));
  assert.equal(maritime.length, 6);
  const corpus = maritime.flatMap((module) => [module.title, module.subtitle, module.thesis, ...module.lesson, ...module.readings]).join(" ");
  for (const concept of ["guerre de course", "guerre d’escadre", "wolfpack", "barrier ambush", "uncrewed", "attritable", "human", "commerce", "communications", "political purpose"]) {
    assert.match(corpus.toLowerCase(), new RegExp(concept.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `missing ${concept}`);
  }
  for (const thinker of ["Mahan", "Aube", "Corbett", "Richmond", "Castex", "Till", "Hughes", "Scharre", "Payne", "Horowitz"]) {
    assert.match(corpus, new RegExp(thinker), `missing ${thinker}`);
  }
});

test("comparison material includes contemporary human–machine and fleet analysis", () => {
  const thinkers = THINKER_COMPARISON.map((row) => row.thinker);
  for (const thinker of ["Wayne P. Hughes Jr.", "Paul Scharre", "Kenneth Payne", "Michael C. Horowitz"]) assert.ok(thinkers.includes(thinker));
  assert.ok(THINKER_CLUSTERS.some((cluster) => /AUTONOMOUS/.test(cluster.period) && /authority/.test(cluster.synthesis)));
});

test("risk and multi-adversary teaching connects crisis phases, coordination, and strategic theory", () => {
  const riskModules = ACADEMY_MODULES.filter((module) => ["risk-resilience", "multi-adversary-risk"].includes(module.id));
  assert.equal(riskModules.length, 2);
  const corpus = riskModules.flatMap((module) => [module.title, module.subtitle, module.thesis, ...module.lesson, ...module.concepts.map((item) => `${item.term} ${item.definition}`), ...module.readings]).join(" ");
  for (const concept of ["preparedness", "response", "recovery", "mitigation", "residual risk", "coordination", "Mahanian", "deterrence", "nuclear", "selective coordination"]) {
    assert.match(corpus.toLowerCase(), new RegExp(concept.toLowerCase()), `missing ${concept}`);
  }
  const thinkers = THINKER_COMPARISON.map((row) => row.thinker);
  for (const thinker of ["Thomas Schelling", "Robert Jervis", "Ortwin Renn"]) assert.ok(thinkers.includes(thinker));
});

test("littoral safeguarding distinguishes trafficking and illicit-network categories", () => {
  const module = ACADEMY_MODULES.find((item) => item.id === "littoral-safeguarding");
  assert.ok(module);
  const corpus = [
    module.title,
    module.subtitle,
    module.thesis,
    ...module.objectives,
    ...module.lesson,
    ...module.concepts.map((item) => `${item.term} ${item.definition}`),
    module.misreading,
    module.application,
    module.discussion,
    ...module.readings,
  ].join(" ").toLocaleLowerCase().replace(/[–—-]/g, " ");

  for (const category of [
    "trafficking in persons",
    "forced labor",
    "arms",
    "controlled contraband",
    "wildlife",
    "cultural property",
    "stolen goods",
    "sanctions evasion",
  ]) assert.match(corpus, new RegExp(category), `missing distinct illicit-network category: ${category}`);

  assert.match(corpus, /not established by irregular migration or transportation alone/);
  assert.match(corpus, /different harms, authorities, evidence, safety/);
  assert.match(corpus, /indicator relevant to one category cannot become proof of another/);
  assert.match(corpus, /people, ecosystems, heritage, and lawful movement/);
});

test("compound-uncertainty teaching separates scale from difficulty and makes chance auditable", () => {
  const module = ACADEMY_MODULES.find((item) => item.id === "compound-uncertainty");
  assert.ok(module);
  const corpus = [
    module.title,
    module.subtitle,
    module.thesis,
    ...module.objectives,
    ...module.lesson,
    ...module.concepts.map((item) => `${item.term} ${item.definition}`),
    module.misreading,
    module.application,
    module.discussion,
    ...module.readings,
  ].join(" ").toLocaleLowerCase();

  for (const concept of [
    "force scale and decision difficulty are different axes",
    "small sailing craft",
    "armed merchant raiders",
    "massive opposing formation",
    "hurricane",
    "typhoon",
    "ground aircraft",
    "recovery window",
    "risk-insensitive leader",
    "outranked",
    "overruled",
    "nested outcome matrix",
    "probability range",
    "committed draw",
    "reloading the same pre-decision state",
    "at least three materially different",
  ]) assert.match(corpus, new RegExp(concept), `missing compound-uncertainty concept: ${concept}`);

  assert.match(corpus, /same class of tropical cyclone named in different ocean basins/);
  assert.match(corpus, /affect opponents under the same exposure rules/);
  assert.match(corpus, /shared dependencies must not be counted as independent evidence/);
  assert.equal(module.quiz.correct, 2);
});
