import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (relative) => readFile(new URL(relative, root), "utf8");
const [wranglerSource, packageSource, workflow, headers, nodeVersion] = await Promise.all([
  read("wrangler.jsonc"),
  read("package.json"),
  read(".github/workflows/main.yml"),
  read("public/_headers"),
  read(".node-version"),
]);

const wrangler = JSON.parse(wranglerSource);
const packageJson = JSON.parse(packageSource);
const headerRules = new Map(
  headers.trim().split(/\r?\n\s*\r?\n/u).map((block) => {
    const [pattern, ...lines] = block.split(/\r?\n/u);
    return [pattern.trim(), lines.map((line) => line.trim())];
  }),
);
const globalHeaders = headerRules.get("/*") ?? [];
const assetHeaders = headerRules.get("/assets/*") ?? [];

assert.equal(wrangler.name, "fog-of-sea");
assert.match(wrangler.compatibility_date, /^\d{4}-\d{2}-\d{2}$/);
assert.equal(wrangler.workers_dev, false, "The production workers.dev alias must remain disabled");
assert.equal(wrangler.preview_urls, true, "Version previews must be an explicit choice");
assert.deepEqual(wrangler.assets, {
  directory: "./dist",
  not_found_handling: "single-page-application",
});
assert.equal("main" in wrangler, false, "A static-only deployment must not add an application Worker");
assert.equal(nodeVersion.trim(), "22.23.2");
assert.equal(packageJson.scripts["deploy:cloudflare"], "npx --yes wrangler@4.127.1 deploy");
assert.equal(packageJson.scripts["preview:cloudflare"], "npx --yes wrangler@4.127.1 versions upload");
assert.match(packageJson.scripts["release:check"], /npm run check/);
assert.match(packageJson.scripts["release:check"], /npm run audit:dependencies/);
assert.match(workflow, /name: release-gate/);
assert.match(workflow, /name: browser-gate/);
assert.match(workflow, /npm run test:browser/);
assert.doesNotMatch(workflow, /deploy-pages|upload-pages-artifact|pages:\s*write/i);
assert(
  globalHeaders.includes("Cache-Control: public, max-age=0, must-revalidate, no-transform"),
  "HTML and SPA fallback responses must remain immediately revalidated and forbid payload transformation",
);
assert(
  assetHeaders.filter((header) => header === "! Cache-Control").length === 1,
  "Fingerprint-named assets must detach the global revalidation policy before setting their immutable policy",
);
assert(
  assetHeaders.includes("Cache-Control: public, max-age=31536000, immutable"),
  "Fingerprint-named assets must retain one-year immutable caching after detaching the document policy",
);
assert(
  assetHeaders.every((header) => !header.includes("no-transform")),
  "Fingerprint-named assets must remain eligible for edge compression",
);
assert.match(headers, /connect-src 'none'/i);

console.log("Cloudflare static-host configuration and GitHub release gates are internally consistent.");
