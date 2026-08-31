import assert from "node:assert/strict";
import test from "node:test";
import { ACADEMY_MODULES, SOURCE_GROUPS } from "../../app/academyData";

test("RT-EDU-001: no fixed answer position can pass a disproportionate share of Academy checks", () => {
  const positionCounts = Array.from({ length: 4 }, (_, position) => (
    ACADEMY_MODULES.filter((module) => module.quiz.correct === position).length
  ));
  const maximumFairCount = Math.ceil(ACADEMY_MODULES.length / 4);

  assert.ok(positionCounts.every((count) => count > 0), `answer positions used: ${positionCounts.join(", ")}`);
  assert.ok(Math.max(...positionCounts) <= maximumFairCount, `answer-position counts: ${positionCounts.join(", ")}`);
  assert.ok(Math.max(...positionCounts) - Math.min(...positionCounts) <= 1, `answer-position counts: ${positionCounts.join(", ")}`);
});

test("RT-EDU-002: the curriculum states that scores are internal and theories remain contestable", () => {
  const lessonText = ACADEMY_MODULES.map((module) => [
    module.thesis,
    ...module.lesson,
    module.misreading,
    module.application,
    module.discussion,
    module.quiz.explanation,
  ].join(" ")).join(" ");
  const scopeText = SOURCE_GROUPS.flatMap((group) => group.items.map((item) => item.label)).join(" ");

  assert.match(lessonText, /not a probability estimate/i);
  assert.match(lessonText, /not to select one timeless master/i);
  assert.match(scopeText, /Scores describe internal rule compliance only/i);
});
