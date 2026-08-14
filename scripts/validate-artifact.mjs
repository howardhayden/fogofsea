import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const buildRoot = path.join(projectRoot, "dist");
const requiredFiles = [
  "index.html",
  "_headers",
  "favicon.svg",
  "favicon-day.svg",
  "third-party-notices.txt",
  "third-party-licenses.txt",
];

for (const relative of requiredFiles) {
  assert((await stat(path.join(buildRoot, relative))).isFile(), `Missing release file: ${relative}`);
}

const html = await readFile(path.join(buildRoot, "index.html"), "utf8");
const headers = await readFile(path.join(buildRoot, "_headers"), "utf8");
assert.match(html, /<title>FOG OF SEA(?: — [^<]+)?<\/title>/);
assert.doesNotMatch(html, /https?:\/\//i, "Release HTML must not request remote assets");
assert.doesNotMatch(
  html,
  /LOCAL START REQUIRED|FOG OF SEA has not started|Open this extracted folder|Live Server/i,
  "Release shell must not show local-launch instructions",
);
assert.match(headers, /connect-src 'none'/i);
assert.match(headers, /frame-src 'none'/i);
assert.match(headers, /object-src 'none'/i);

for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
  const reference = match[1];
  if (reference.startsWith("//") || /^[a-z][a-z\d+.-]*:/i.test(reference)) continue;
  const localPath = reference.startsWith("/")
    ? path.join(buildRoot, reference.slice(1))
    : path.resolve(buildRoot, reference);
  assert((await stat(localPath)).isFile(), `Broken release reference: ${reference}`);
}

const emitted = [];
async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await collect(absolute);
    else emitted.push(path.relative(buildRoot, absolute));
  }
}
await collect(buildRoot);
assert.equal(emitted.some((file) => file.endsWith(".map")), false, "Release must not contain source maps");
assert(emitted.some((file) => file.endsWith(".js")), "Release must contain compiled scripts");
assert(emitted.some((file) => file.endsWith(".css")), "Release must contain compiled styles");
assert(emitted.some((file) => file.endsWith(".woff2")), "Release must contain the local font files");

for (const relative of emitted.filter((file) => file.endsWith(".html") || file.endsWith(".js"))) {
  const source = await readFile(path.join(buildRoot, relative), "utf8");
  assert.doesNotMatch(
    source,
    /LOCAL BUILD|LOCAL START REQUIRED|FOG OF SEA has not started/i,
    `Release file must not expose a local-build or local-start label: ${relative}`,
  );
}

console.log(`Validated static release artifact with ${emitted.length} files and no remote HTML assets or source maps.`);
