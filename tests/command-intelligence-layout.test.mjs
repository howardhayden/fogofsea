import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(relativePath, import.meta.url), "utf8");

function blocksForPrelude(source, prelude) {
  const blocks = [];
  let cursor = 0;

  while (cursor < source.length) {
    const start = source.indexOf(prelude, cursor);
    if (start < 0) break;
    const openingBrace = source.indexOf("{", start + prelude.length);
    assert.notEqual(openingBrace, -1, `Missing opening brace after ${prelude}`);

    let depth = 1;
    let index = openingBrace + 1;
    for (; index < source.length && depth > 0; index += 1) {
      if (source[index] === "{") depth += 1;
      else if (source[index] === "}") depth -= 1;
    }
    assert.equal(depth, 0, `Unclosed block after ${prelude}`);
    blocks.push(source.slice(openingBrace + 1, index - 1));
    cursor = index;
  }

  return blocks;
}

function ruleBody(source, selector) {
  const blocks = blocksForPrelude(source, selector);
  assert.ok(blocks.length > 0, `Missing rule for ${selector}`);
  return blocks[0];
}

test("command intelligence and orders are direct page siblings in reading order", async () => {
  const page = await read("../app/page.tsx");
  const activeCommand = page.match(
    /\{rigidState && rigidState\.phase === "active" && \(\s*<>\s*<CommandIntelligencePanel\b[\s\S]*?onOrdersChange=\{sessionActions\.updateOrders\}\s*\/>\s*<CommandPanel\b[\s\S]*?onReturn=\{requestReturnToPlanning\}\s*\/>\s*<\/>(?:\s*)\)\}/u,
  );

  assert.ok(activeCommand, "the left intelligence panel must directly precede the command card in the page fragment");
});

test("desktop command layout reserves bounded left and right panel lanes", async () => {
  const css = await read("../app/globals.css");
  const desktopBlocks = blocksForPrelude(css, "@media (min-width: 761px)");
  assert.ok(desktopBlocks.length > 0, "missing desktop workspace media query");
  const desktop = desktopBlocks.find((block) => block.includes("--command-intel-width"));
  assert.ok(desktop, "desktop command layout must declare its panel widths");

  const phaseCommand = ruleBody(desktop, ".workspace.phase-command");
  assert.match(phaseCommand, /--command-intel-width:\s*clamp\(240px,\s*28vw,\s*360px\)/u);
  assert.match(phaseCommand, /--command-orders-width:\s*clamp\(340px,\s*40vw,\s*460px\)/u);
  assert.match(phaseCommand, /--battlefield-safe-left:\s*calc\(var\(--command-intel-width\) \+ 32px\)/u);
  assert.match(phaseCommand, /--battlefield-safe-right:\s*calc\(var\(--command-orders-width\) \+ 32px\)/u);

  const intelligence = ruleBody(css, ".tactical-panel > .command-intelligence-panel");
  assert.match(intelligence, /left:\s*16px/u);
  assert.match(intelligence, /width:\s*var\(--command-intel-width,/u);
  assert.match(intelligence, /overflow:\s*auto/u);
  assert.doesNotMatch(intelligence, /right:\s*16px/u);

  const orders = ruleBody(css, ".tactical-panel > .kriegsspiel-panel");
  assert.match(orders, /right:\s*16px/u);
  assert.match(orders, /width:\s*var\(--command-orders-width,/u);
  assert.match(orders, /overflow:\s*auto/u);
  assert.doesNotMatch(orders, /left:\s*16px/u);
});

test("the 761 through 1023 pixel command layout removes auxiliary HUD collisions", async () => {
  const css = await read("../app/globals.css");
  const tablet = blocksForPrelude(css, "@media (min-width: 761px) and (max-width: 1023px)")[0];
  assert.ok(tablet, "missing the tablet command collision boundary");

  for (const selector of [
    ".workspace.phase-command .plot-data-readout",
    ".workspace.phase-command .sky-readout",
    ".workspace.phase-command .environment-readout",
  ]) {
    assert.ok(tablet.includes(selector), `${selector} must participate in tablet HUD suppression`);
  }
  assert.match(tablet, /\.workspace\.phase-command \.environment-readout\s*\{\s*display:\s*none;?\s*\}/u);
});

test("compact command uses one vertical tactical scroll and normal-flow panels", async () => {
  const css = await read("../app/globals.css");
  const compact = blocksForPrelude(css, "@media (max-width: 760px)")
    .find((block) => block.includes(".workspace.phase-command.mobile-view-command .tactical-panel"));
  assert.ok(compact, "missing compact command reflow block");

  const scrollOwner = ruleBody(compact, ".workspace.phase-command.mobile-view-command .tactical-panel");
  assert.match(scrollOwner, /overflow-x:\s*hidden/u);
  assert.match(scrollOwner, /overflow-y:\s*auto/u);
  assert.match(scrollOwner, /overscroll-behavior:\s*contain/u);
  assert.match(scrollOwner, /scrollbar-gutter:\s*stable/u);
  assert.match(scrollOwner, /padding:\s*12px/u);

  const normalFlowSelector = ".workspace.phase-command.mobile-view-command .tactical-panel > :is(.command-intelligence-panel, .kriegsspiel-panel)";
  const normalFlow = ruleBody(compact, normalFlowSelector);
  assert.match(normalFlow, /position:\s*relative/u);
  assert.match(normalFlow, /inset:\s*auto/u);
  assert.match(normalFlow, /width:\s*100%/u);
  assert.match(normalFlow, /max-height:\s*none/u);
  assert.match(normalFlow, /overflow:\s*visible/u);

  const visualizationSelector = ".workspace.phase-command.mobile-view-visualization .tactical-panel > :is(.kriegsspiel-panel, .command-intelligence-panel)";
  assert.match(ruleBody(compact, visualizationSelector), /display:\s*none/u);
});

test("intelligence controls and log expose stable accessible contracts", async () => {
  const [panel, css] = await Promise.all([
    read("../app/CommandIntelligencePanel.tsx"),
    read("../app/CommandIntelligencePanel.css"),
  ]);

  for (const id of [
    "command-intelligence-heading",
    "command-known",
    "command-potentials",
    "command-log",
    "command-log-immediate",
    "command-log-history",
  ]) {
    assert.ok(panel.includes(`id="${id}"`), `missing stable #${id} anchor`);
  }
  assert.match(panel, /id=\{`command-history-turn-\$\{turn\.occurredTurn\}`\}/u);
  assert.match(panel, />Discovered during Turn \{group\.discoveredTurn\}<\/h5>/u);
  assert.match(panel, /<details\b(?=[^>]*\bid="command-log-history")(?=[^>]*\bclassName="situation-history")[^>]*>\s*<summary>HISTORY/u);

  assert.match(ruleBody(css, ".intelligence-assumption-field select"), /min-height:\s*44px/u);
  assert.match(ruleBody(css, ".situation-history > summary"), /min-height:\s*44px/u);
});
