import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relative) => readFile(new URL(relative, import.meta.url), "utf8");

function ruleBody(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `Expected a CSS rule for ${selector}`);
  return match[1];
}

test("normal glass uses invisible edge tokens while utility affordances remain visible", async () => {
  const css = await read("../app/globals.css");
  const dark = ruleBody(css, ".app");
  const light = ruleBody(css, ".app.theme-light");

  for (const [theme, block] of [["dark", dark], ["light", light]]) {
    assert.match(block, /--line:\s*transparent\s*;/, `${theme} structural lines should be invisible`);
    assert.match(block, /--line-strong:\s*transparent\s*;/, `${theme} strong lines should be invisible`);
    assert.match(block, /--state-line:\s*transparent\s*;/, `${theme} state lines should be invisible`);
    assert.match(block, /--glass-rim:\s*transparent\s*;/, `${theme} glass rim should be invisible`);
    assert.match(block, /--utility-line:\s*rgba\([^;]+\)\s*;/, `${theme} utility line should remain visible`);
    assert.doesNotMatch(block, /--utility-line:\s*transparent\s*;/);
  }

  const scrollbarRoutes = css.match(/scrollbar-color:\s*var\(--utility-line\)\s+transparent/g) ?? [];
  assert.ok(scrollbarRoutes.length >= 4, "Scrollable workspaces should retain a visible utility thumb");
  assert.match(css, /\.source-groups a\s*\{[^}]*text-decoration-color:\s*var\(--utility-line\)/);
  assert.match(css, /\.sky-mini\s*>\s*i\s*\{[^}]*border-top:[^;]*var\(--utility-line\)/);
  const canonicalGlass = css.match(/\/\* Canonical app glass[\s\S]*?\*\/([\s\S]*?)\/\* Compact workspace navigation/)?.[1];
  assert.ok(canonicalGlass, "Expected the canonical glass authority");
  assert.match(canonicalGlass, /background-clip:\s*border-box\s*;/);
  assert.doesNotMatch(canonicalGlass, /background-clip:\s*padding-box\s*;/);
  assert.doesNotMatch(css, /background-clip:\s*padding-box\s*;/);
});

test("selection, phase, Academy, and command edges all consume the invisible state token", async () => {
  const [css, intelligenceCss, situationCss] = await Promise.all([
    read("../app/globals.css"),
    read("../app/CommandIntelligencePanel.css"),
    read("../app/TurnSituationPanel.css"),
  ]);

  assert.match(ruleBody(css, ".warfare-grid button.selected"), /border-color:\s*var\(--state-line\)/);
  assert.match(ruleBody(css, ".decision-step--current"), /border-color:\s*var\(--state-line\)/);
  assert.match(ruleBody(css, ".decision-step--current"), /box-shadow:[^;]*var\(--state-line\)/);
  assert.match(ruleBody(css, ".phase-continue-button"), /border:[^;]*var\(--state-line\)/);
  assert.match(ruleBody(css, ".academy-guidance"), /border:[^;]*var\(--state-line\)/);
  assert.match(ruleBody(css, ".academy-phase-focus"), /border:[^;]*var\(--line\)/);
  assert.match(ruleBody(css, ".phase-support-atom"), /border:[^;]*var\(--line\)/);
  assert.match(ruleBody(css, ".decision-evidence div"), /border:[^;]*var\(--line\)/);
  assert.match(ruleBody(css, ".decision-option-list li"), /border:[^;]*var\(--line\)/);
  assert.match(ruleBody(css, ".relevant-theory-atom"), /border:[^;]*var\(--line\)/);
  assert.match(ruleBody(css, ".academy-now-footer"), /border-top:[^;]*var\(--line\)/);
  assert.match(ruleBody(css, ".academy-view-tabs button.active::after"), /background:\s*var\(--state-line\)/);
  assert.match(ruleBody(css, ".result-learning"), /border-left:[^;]*var\(--state-line\)/);

  assert.match(ruleBody(intelligenceCss, ".intelligence-last-known"), /border-left:[^;]*var\(--state-line\)/);
  assert.match(intelligenceCss, /\.intelligence-immediate li,[\s\S]*?\{[^}]*border-left:[^;]*var\(--state-line\)/);
  assert.doesNotMatch(intelligenceCss, /border(?:-(?:top|right|bottom|left))?(?:-color)?:[^;]*(?:--accent|--danger|--gold)/);

  assert.match(ruleBody(situationCss, '.situation-turn-track li[aria-current="step"]'), /border-color:\s*var\(--state-line\)/);
  assert.match(ruleBody(situationCss, '.situation-event[data-severity="extreme"]'), /border-left-color:\s*var\(--state-line\)/);
  assert.doesNotMatch(situationCss, /border(?:-(?:top|right|bottom|left))?(?:-color)?:[^;]*(?:--accent|--danger|--gold)/);
});

test("contrast preferences restore edges without weakening keyboard focus", async () => {
  const css = await read("../app/globals.css");
  const contrast = css.match(/@media\s*\(prefers-contrast:\s*more\)\s*\{\s*\.app\s*,\s*\.app\.theme-light\s*\{([^}]*)\}/)?.[1];
  assert.ok(contrast, "Expected contrast restoration for both the base and higher-specificity light theme");
  for (const token of ["line", "line-strong", "state-line", "utility-line"]) {
    assert.match(contrast, new RegExp(`--${token}:\\s*currentColor\\s*;`));
  }
  assert.match(css, /@media\s*\(prefers-contrast:\s*more\)[\s\S]*?\.startup-fallback\s*\{\s*border-color:\s*currentColor\s*;/);
  assert.match(css, /@media\s*\(prefers-contrast:\s*more\)[\s\S]*?:focus-visible\s*\{[^}]*box-shadow:\s*0 0 0 3px currentColor/);

  assert.match(css, /:where\([^}]*:focus-visible\s*\{\s*outline:\s*3px solid var\(--accent-strong\)/);
  assert.match(css, /@media\s*\(forced-colors:\s*active\)[\s\S]*?\.startup-fallback,[\s\S]*?border-color:\s*CanvasText/);
  assert.match(css, /@media\s*\(forced-colors:\s*active\)[\s\S]*?border-color:\s*CanvasText/);
  assert.match(css, /@media\s*\(forced-colors:\s*active\)[\s\S]*?border:\s*1px solid ButtonText/);
  assert.match(css, /\.academy\s+:is\(button,\s*summary,\s*select,\s*input,\s*textarea,\s*a\[href\]\)\s*\{\s*border:\s*1px solid ButtonText/);
  assert.match(css, /\.academy\s+:where\(button,\s*summary,\s*select,\s*input,\s*textarea,\s*a\[href\]\):focus/);
  assert.match(css, /@media\s*\(forced-colors:\s*active\)[\s\S]*?outline:\s*3px solid Highlight/);
});
