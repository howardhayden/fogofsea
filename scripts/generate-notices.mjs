import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const checkOnly = process.argv.includes("--check");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lock = JSON.parse(await readFile(path.join(root, "package-lock.json"), "utf8"));
const rootPackage = lock.packages[""];
const runtimeDirectNames = new Set(Object.keys(rootPackage.dependencies ?? {}));
const developmentDirectNames = new Set(Object.keys(rootPackage.devDependencies ?? {}));
const directNames = new Set([...runtimeDirectNames, ...developmentDirectNames]);
const inventory = new Map();

function packageNameFromPath(packagePath) {
  return packagePath.split("node_modules/").at(-1);
}

for (const [packagePath, metadata] of Object.entries(lock.packages ?? {})) {
  if (!packagePath || !metadata.version) continue;
  const name = packageNameFromPath(packagePath);
  const key = `${name}@${metadata.version}`;
  if (!inventory.has(key)) {
    inventory.set(key, {
      name,
      version: metadata.version,
      license: metadata.license ?? "MISSING",
      paths: [],
      runtime: false,
      optionalOnly: true,
    });
  }
  const item = inventory.get(key);
  item.paths.push({ packagePath, optional: Boolean(metadata.optional) });
  item.runtime ||= !metadata.dev;
  item.optionalOnly &&= Boolean(metadata.optional);
}

const sorted = [...inventory.values()].sort(
  (left, right) => left.name.localeCompare(right.name) || left.version.localeCompare(right.version),
);
const grouped = Map.groupBy(sorted, (item) => item.license);
const direct = sorted.filter((item) => directNames.has(item.name));

const adaptedAuroraNotice = "- The independent aurora engine adapts progressive domain-warp organization and smooth BasicGrid vector interpolation from FastNoise Lite 1.1.1 GLSL by Jordan Peck and contributors. A compact WebGL-1-compatible variant drives original long, tapered, three-dimensional spline-veils with fog and depth; no package runtime is bundled. License: MIT. Source: <https://github.com/Auburn/FastNoiseLite/blob/master/GLSL/FastNoiseLite.glsl>.";
const adaptedAuroraLicenseLines = [
  "================================================================================",
  "ADAPTED SOURCE: FastNoise Lite GLSL 1.1.1 domain-warp technique (not a bundled package)",
  "================================================================================",
  "MIT License",
  "",
  "Copyright(c) 2020 Jordan Peck (jordan.me2@gmail.com)",
  "Copyright(c) 2020 Contributors",
  "",
  "Permission is hereby granted, free of charge, to any person obtaining a copy",
  "of this software and associated documentation files (the \"Software\"), to deal",
  "in the Software without restriction, including without limitation the rights",
  "to use, copy, modify, merge, publish, distribute, sublicense, and/or sell",
  "copies of the Software, and to permit persons to whom the Software is",
  "furnished to do so, subject to the following conditions:",
  "",
  "The above copyright notice and this permission notice shall be included in all",
  "copies or substantial portions of the Software.",
  "",
  "THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR",
  "IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,",
  "FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE",
  "AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER",
  "LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,",
  "OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE",
  "SOFTWARE.",
  "",
];

const noticeLines = [
  "# Third-Party Notices",
  "",
  "Every locked dependency declares a license approved by this project's open-license policy. The general allowlist contains permissive code licenses. The only reviewed font/data-package exceptions are the bundled Jost font under OFL-1.1 and build-time browser-compatibility data under CC-BY-4.0. `npm run verify:licenses` rejects missing declarations, unreviewed licenses, unapproved registries, mutable direct-version ranges, and prohibited package families.",
  "",
  "Permissive code identifiers: 0BSD, Apache-2.0, BSD-2-Clause, BSD-3-Clause, BlueOak-1.0.0, ISC, MIT, and Python-2.0.",
  "",
  "Installed license and notice texts are reproduced in `THIRD_PARTY_LICENSES.txt`. The static release also serves the runtime license texts at `/third-party-licenses.txt`. The complete machine-readable dependency graph is recorded in `SBOM.spdx.json`; the browser runtime subset is recorded in `SBOM.production.spdx.json`. Package distributions remain authoritative.",
  "",
  "## Reviewed font and data materials",
  "",
  "- @fontsource-variable/jost@5.3.0 packages the unmodified Jost variable font by the Jost Project Authors under the SIL Open Font License 1.1. The font is self-hosted.",
  "- caniuse-lite@1.0.30001809 is build-time browser-compatibility data by Ben Briggs and contributors, used without project modification under Creative Commons Attribution 4.0. Source: <https://github.com/browserslist/caniuse-lite>.",
  "",
  "## Adapted visual source",
  "",
  adaptedAuroraNotice,
  "",
  "## Direct dependencies",
  "",
  "| Package | Version | Scope | License | Source |",
  "| --- | ---: | --- | --- | --- |",
  ...direct.map((item) => {
    const scope = runtimeDirectNames.has(item.name) ? "runtime" : "development";
    return `| ${item.name} | ${item.version} | ${scope} | ${item.license} | <https://www.npmjs.com/package/${encodeURIComponent(item.name)}> |`;
  }),
  "",
  "## Complete locked inventory",
  "",
  ...[...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([license, packages]) => [
      `### ${license}`,
      "",
      ...packages.map((item) => {
        const qualifiers = [item.runtime ? "runtime" : "development"];
        if (item.optionalOnly) qualifiers.push("optional platform package");
        return `- ${item.name}@${item.version} — ${qualifiers.join(", ")}`;
      }),
      "",
    ]),
  "## Original project assets",
  "",
  "The interface geometry, abstract wave-and-fog mark, procedural weather visuals, and browser-synthesized sound design are original project code. No recordings, samples, vocals, institutional marks, course assets, or remote media are bundled.",
  "",
];

const textGroups = new Map();
const runtimeTextGroups = new Map();
const packagesWithoutStandaloneText = [];
const runtimePackagesWithoutStandaloneText = [];

function addText(groupMap, content, packageLabel) {
  const digest = createHash("sha256").update(content).digest("hex");
  if (!groupMap.has(digest)) groupMap.set(digest, { content, packages: [] });
  groupMap.get(digest).packages.push(packageLabel);
}

for (const item of sorted) {
  // Optional platform packages differ by operating system. Their exact identities,
  // licenses, and source archives are recorded above and in the cross-platform SBOM;
  // excluding their local files keeps this generated text deterministic on every OS.
  const candidatePaths = item.optionalOnly
    ? []
    : item.paths.map(({ packagePath }) => path.join(root, packagePath));
  let foundText = false;

  for (const candidatePath of candidatePaths) {
    try {
      const files = (await readdir(candidatePath))
        .filter((name) => /^(licen[cs]e|copying|notice)(\.|$)/i.test(name))
        .sort();
      if (!files.length) continue;

      for (const file of files) {
        const content = (await readFile(path.join(candidatePath, file), "utf8")).trim();
        if (!content) continue;
        foundText = true;
        const packageLabel = `${item.name}@${item.version} (${file})`;
        addText(textGroups, content, packageLabel);
        if (item.runtime) addText(runtimeTextGroups, content, packageLabel);
      }
      if (foundText) break;
    } catch {
      // The inventory and SPDX output still retain the locked package and source archive.
    }
  }

  // Astronomy Engine carries its complete MIT notice in each distributed source
  // file rather than in a standalone LICENSE file. Preserve that notice explicitly.
  if (!foundText && item.name === "astronomy-engine" && candidatePaths.length) {
    const source = await readFile(path.join(candidatePaths[0], "astronomy.js"), "utf8");
    const comment = source.match(/^\/\*[\s\S]*?\*\//)?.[0]?.trim();
    if (comment) {
      const packageLabel = `${item.name}@${item.version} (astronomy.js embedded license)`;
      foundText = true;
      addText(textGroups, comment, packageLabel);
      if (item.runtime) addText(runtimeTextGroups, comment, packageLabel);
    }
  }

  if (!foundText) {
    const reason = item.optionalOnly ? "optional platform package" : "no standalone file in installed package";
    const missingLabel = `${item.name}@${item.version} — ${item.license}; ${reason}`;
    packagesWithoutStandaloneText.push(missingLabel);
    if (item.runtime) runtimePackagesWithoutStandaloneText.push(missingLabel);
  }
}

const licenseLines = [
  "FOG OF SEA — THIRD-PARTY LICENSE AND NOTICE TEXTS",
  "",
  "Generated from the exact package-lock.json dependency tree. This file reproduces every standalone license or notice file shipped by installed, non-optional packages. Optional platform packages are enumerated with their declared license and registry source in THIRD_PARTY_NOTICES.md and the SPDX files; they are not bundled into the static browser release.",
  "",
  ...adaptedAuroraLicenseLines,
  ...[...textGroups.values()]
    .sort((left, right) => left.packages[0].localeCompare(right.packages[0]))
    .flatMap((group) => [
      "================================================================================",
      `APPLIES TO: ${group.packages.join(", ")}`,
      "================================================================================",
      group.content,
      "",
    ]),
  "================================================================================",
  "LOCKED PACKAGES WITHOUT A STANDALONE INSTALLED LICENSE/NOTICE FILE",
  "================================================================================",
  "Their exact license declaration and source archive remain recorded in the notices and SPDX inventory.",
  ...packagesWithoutStandaloneText,
  "",
];

const runtimeLicenseLines = [
  "FOG OF SEA — STATIC RUNTIME THIRD-PARTY LICENSE AND NOTICE TEXTS",
  "",
  "This file accompanies the static browser release and contains the governing texts shipped by its runtime packages. Development-only tooling is inventoried separately in third-party-notices.txt and the downloadable source records.",
  "",
  ...adaptedAuroraLicenseLines,
  ...[...runtimeTextGroups.values()]
    .sort((left, right) => left.packages[0].localeCompare(right.packages[0]))
    .flatMap((group) => [
      "================================================================================",
      `APPLIES TO: ${group.packages.join(", ")}`,
      "================================================================================",
      group.content,
      "",
    ]),
  ...(runtimePackagesWithoutStandaloneText.length
    ? [
      "================================================================================",
      "RUNTIME PACKAGES WITHOUT A STANDALONE INSTALLED LICENSE/NOTICE FILE",
      "================================================================================",
      ...runtimePackagesWithoutStandaloneText,
      "",
    ]
    : []),
];

const noticeText = noticeLines.join("\n");
const licenseText = licenseLines.join("\n");
const runtimeLicenseText = runtimeLicenseLines.join("\n");

async function emit(relativePath, content) {
  const outputPath = path.join(root, relativePath);
  if (checkOnly) {
    const existing = await readFile(outputPath, "utf8");
    assert.equal(existing, content, `${relativePath} is stale; run npm run notices`);
    return;
  }
  await writeFile(outputPath, content);
}

await emit("THIRD_PARTY_NOTICES.md", noticeText);
await emit("THIRD_PARTY_LICENSES.txt", licenseText);
await emit("public/third-party-notices.txt", noticeText);
await emit("public/third-party-licenses.txt", runtimeLicenseText);

console.log(
  `${checkOnly ? "Verified" : "Generated"} notices for ${sorted.length} unique package versions and ${textGroups.size} distinct installed license/notice texts.`,
);
