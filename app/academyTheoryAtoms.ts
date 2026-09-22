import type { TheoryLens } from "./gameModel";
import type { AcademyModule } from "./academyData";

export type AcademyTheoryAtomTarget = {
  atomId: string;
  moduleId: string;
};

export type AcademyLessonAtom = AcademyTheoryAtomTarget & {
  title: string;
  theoryLens?: TheoryLens;
  paragraphs: readonly string[];
};

/**
 * Scenario theory relevance is addressable at strategist granularity even
 * where the existing curriculum intentionally keeps several thinkers inside
 * one comparative module shell. Module IDs remain stable for saved progress.
 */
export const THEORY_ACADEMY_ATOM: Readonly<Record<TheoryLens, AcademyTheoryAtomTarget>> = {
  "sun-tzu": { atomId: "theory-sun-tzu", moduleId: "sun-tzu" },
  clausewitz: { atomId: "theory-clausewitz", moduleId: "clausewitz" },
  mahan: { atomId: "theory-mahan", moduleId: "mahan" },
  aube: { atomId: "theory-aube", moduleId: "maritime-schools" },
  corbett: { atomId: "theory-corbett", moduleId: "corbett" },
  richmond: { atomId: "theory-richmond", moduleId: "maritime-schools" },
  wegener: { atomId: "theory-wegener", moduleId: "maritime-schools" },
  castex: { atomId: "theory-castex", moduleId: "maritime-schools" },
  panikkar: { atomId: "theory-panikkar", moduleId: "global-seapower" },
  gorshkov: { atomId: "theory-gorshkov", moduleId: "global-seapower" },
  "liu-huaqing": { atomId: "theory-liu-huaqing", moduleId: "global-seapower" },
  till: { atomId: "theory-till", moduleId: "global-seapower" },
  galula: { atomId: "theory-galula", moduleId: "galula" },
};

function lessonParagraph(module: AcademyModule, index: number) {
  const paragraph = module.lesson[index];
  if (!paragraph) throw new Error(`Academy module ${module.id} is missing lesson paragraph ${index}.`);
  return paragraph;
}

function splitAt(paragraph: string, anchor: string, moduleId: string) {
  const index = paragraph.indexOf(anchor);
  if (index <= 0) throw new Error(`Academy module ${moduleId} is missing atom anchor ${anchor}.`);
  return [paragraph.slice(0, index).trim(), paragraph.slice(index).trim()] as const;
}

function maritimeSchoolAtoms(module: AcademyModule): readonly AcademyLessonAtom[] {
  const [comparisonFrame, richmondAndWegener] = splitAt(
    lessonParagraph(module, 1),
    "Richmond joined",
    module.id,
  );
  const [richmond, wegener] = splitAt(richmondAndWegener, "Wegener argued", module.id);
  const [castex, synthesis] = splitAt(
    lessonParagraph(module, 2),
    "These theories can be combined only conditionally:",
    module.id,
  );

  return [
    { ...THEORY_ACADEMY_ATOM.aube, theoryLens: "aube", title: "THÉOPHILE AUBE", paragraphs: [lessonParagraph(module, 0)] },
    { atomId: "maritime-schools-comparison-frame", moduleId: module.id, title: "RICHMOND AND WEGENER", paragraphs: [comparisonFrame] },
    { ...THEORY_ACADEMY_ATOM.richmond, theoryLens: "richmond", title: "HERBERT RICHMOND", paragraphs: [richmond] },
    { ...THEORY_ACADEMY_ATOM.wegener, theoryLens: "wegener", title: "WOLFGANG WEGENER", paragraphs: [wegener] },
    { ...THEORY_ACADEMY_ATOM.castex, theoryLens: "castex", title: "RAOUL CASTEX", paragraphs: [castex] },
    { atomId: "maritime-schools-synthesis", moduleId: module.id, title: "COMPARATIVE SYNTHESIS", paragraphs: [synthesis] },
  ];
}

function globalSeapowerAtoms(module: AcademyModule): readonly AcademyLessonAtom[] {
  const [panikkar, liu] = splitAt(lessonParagraph(module, 1), "Liu Huaqing’s", module.id);
  const [till, synthesis] = splitAt(
    lessonParagraph(module, 2),
    "Gorshkov’s comprehensive state power",
    module.id,
  );

  return [
    { ...THEORY_ACADEMY_ATOM.gorshkov, theoryLens: "gorshkov", title: "SERGEI GORSHKOV", paragraphs: [lessonParagraph(module, 0)] },
    { ...THEORY_ACADEMY_ATOM.panikkar, theoryLens: "panikkar", title: "K. M. PANIKKAR", paragraphs: [panikkar] },
    { ...THEORY_ACADEMY_ATOM["liu-huaqing"], theoryLens: "liu-huaqing", title: "LIU HUAQING", paragraphs: [liu] },
    { ...THEORY_ACADEMY_ATOM.till, theoryLens: "till", title: "GEOFFREY TILL", paragraphs: [till] },
    { atomId: "global-seapower-synthesis", moduleId: module.id, title: "COMPARATIVE SYNTHESIS", paragraphs: [synthesis] },
  ];
}

const SHARED_MODULE_ATOMS: Readonly<Record<string, (module: AcademyModule) => readonly AcademyLessonAtom[]>> = {
  "maritime-schools": maritimeSchoolAtoms,
  "global-seapower": globalSeapowerAtoms,
};

export function academyLessonAtoms(module: AcademyModule): readonly AcademyLessonAtom[] {
  const shared = SHARED_MODULE_ATOMS[module.id];
  if (shared) return shared(module);

  const target = Object.entries(THEORY_ACADEMY_ATOM).find(([, value]) => value.moduleId === module.id);
  if (!target) return [];
  const [theoryLens, value] = target as [TheoryLens, AcademyTheoryAtomTarget];
  return [{
    ...value,
    theoryLens,
    title: module.title,
    paragraphs: module.lesson,
  }];
}
