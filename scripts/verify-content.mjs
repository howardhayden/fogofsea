import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const roots = ["app", "public", "tests", "scripts", ".vscode", ".github"];
const files = [
  "README.md",
  "ACCESSIBILITY.md",
  "DEPLOY-CLOUDFLARE.md",
  "RELEASE_QA.md",
  "PLAYTEST_PROTOCOL.md",
  "SECURITY.md",
  "START-HERE.md",
  "THIRD_PARTY_NOTICES.md",
  "LICENSE",
  "index.html",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "vite.config.ts",
  "playwright.config.ts",
  "eslint.config.mjs",
  "wrangler.jsonc",
];

async function collect(relative) {
  const absolute = path.join(root, relative);
  for (const entry of await readdir(absolute, { withFileTypes: true })) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) await collect(child);
    else if (/\.(?:css|html|json|md|mjs|mts|svg|ts|tsx|txt|ya?ml)$/i.test(entry.name)) files.push(child);
  }
}

for (const relative of roots) await collect(relative);
files.sort();
const source = (await Promise.all(files.map(async (file) => `${file}\n${await readFile(path.join(root, file), "utf8")}`))).join("\n");
const encodedExactTerms = [
  "T3BlbkFJ",
  "Q2hhdEdQVA==",
  "QXBwZW5kaXggRA==",
  "QXBwZW5kaXggRGVsdGE=",
  "VS5TLiBOYXZ5",
  "RGVwYXJ0bWVudCBvZiB0aGUgTmF2eQ==",
  "aW50ZXJuYXRpb25hbA==",
  "bm9ubWlsaXRhcnk=",
  "dHJpZGVudA==",
  "YnVsbCBoZWFk",
];
const encodedWords = ["VVNO", "bWlsaXRhcnk=", "bmF2eQ==", "bmF0aW9u", "bmF0aW9uYWw=", "QUk="];
const failures = [];

for (const value of encodedExactTerms) {
  const term = Buffer.from(value, "base64").toString("utf8");
  if (source.toLocaleLowerCase().includes(term.toLocaleLowerCase())) failures.push(term);
}
for (const value of encodedWords) {
  const term = Buffer.from(value, "base64").toString("utf8");
  if (new RegExp(`\\b${term}\\b`, "i").test(source)) failures.push(term);
}

assert.deepEqual(failures, [], `Disallowed public-facing terms found: ${failures.join(", ")}`);
console.log(`Content policy passed across ${files.length} public-facing source and documentation files.`);
