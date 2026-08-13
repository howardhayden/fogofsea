import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const permissiveCodeLicenses = new Set([
  "0BSD",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "BlueOak-1.0.0",
  "ISC",
  "MIT",
  "Python-2.0",
]);

// These are deliberately narrow font/data-package exceptions, not blanket license allowances.
// A version change requires an explicit policy review.
const reviewedExceptions = new Map([
  ["@fontsource-variable/jost@5.3.0", "OFL-1.1"],
  ["caniuse-lite@1.0.30001809", "CC-BY-4.0"],
]);

const deniedPackagePatterns = [
  /^sharp$/,
  /^@img\/sharp-/,
  /^lightningcss(?:-|$)/,
  /^axe-core$/,
];

function packageNameFromPath(packagePath) {
  return packagePath.split("node_modules/").at(-1);
}

const root = new URL("../", import.meta.url);
const packageJson = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
const lock = JSON.parse(await readFile(new URL("package-lock.json", root), "utf8"));
const notices = await readFile(new URL("THIRD_PARTY_NOTICES.md", root), "utf8");
const publicNotices = await readFile(new URL("public/third-party-notices.txt", root), "utf8");
const publicLicenseTexts = await readFile(new URL("public/third-party-licenses.txt", root), "utf8");
const licenseTexts = await readFile(new URL("THIRD_PARTY_LICENSES.txt", root), "utf8");
const failures = [];
const approvedExceptionIds = new Set();
let packageCount = 0;

if (lock.lockfileVersion !== 3) failures.push(`package-lock.json: expected lockfileVersion 3, found ${lock.lockfileVersion}`);

const rootLock = lock.packages?.[""] ?? {};
for (const section of ["dependencies", "devDependencies"]) {
  for (const [name, specification] of Object.entries(packageJson[section] ?? {})) {
    const lockedVersion = lock.packages?.[`node_modules/${name}`]?.version;
    if (!lockedVersion) {
      failures.push(`${name}: direct ${section} entry is not locked`);
      continue;
    }
    if (specification !== lockedVersion) {
      failures.push(`${name}: direct version must be exact (${specification} does not equal locked ${lockedVersion})`);
    }
    if (rootLock[section]?.[name] !== specification) {
      failures.push(`${name}: package.json and package-lock root ${section} disagree`);
    }
  }
}

for (const [packagePath, metadata] of Object.entries(lock.packages ?? {})) {
  if (!packagePath || !metadata.version) continue;
  packageCount += 1;
  const packageName = packageNameFromPath(packagePath);
  const packageId = `${packageName}@${metadata.version}`;
  const license = metadata.license;

  if (deniedPackagePatterns.some((pattern) => pattern.test(packageName))) {
    failures.push(`${packageId}: package family is prohibited by policy`);
  }

  if (permissiveCodeLicenses.has(license)) {
    // Approved without a package-specific exception.
  } else if (reviewedExceptions.get(packageId) === license) {
    approvedExceptionIds.add(packageId);
  } else {
    failures.push(`${packageId}: ${license || "missing license declaration"}`);
  }

  if (!metadata.integrity) failures.push(`${packageId}: missing registry integrity hash`);
  if (!metadata.resolved?.startsWith("https://registry.npmjs.org/")) {
    failures.push(`${packageId}: dependency is not locked to the npm registry`);
  }
  if (!notices.includes(`- ${packageId}`)) failures.push(`${packageId}: absent from THIRD_PARTY_NOTICES.md`);
  if (!publicNotices.includes(`- ${packageId}`)) failures.push(`${packageId}: absent from public/third-party-notices.txt`);
  if (!licenseTexts.includes(packageId)) failures.push(`${packageId}: absent from THIRD_PARTY_LICENSES.txt`);
  if (!metadata.dev && !publicLicenseTexts.includes(packageId)) {
    failures.push(`${packageId}: runtime license absent from public/third-party-licenses.txt`);
  }
}

for (const packageId of reviewedExceptions.keys()) {
  if (!approvedExceptionIds.has(packageId)) failures.push(`${packageId}: reviewed exception is stale or absent from the lockfile`);
}

assert.deepEqual(failures, [], `Dependency policy violations:\n${failures.join("\n")}`);
console.log(
  `License policy passed for ${packageCount} locked package paths: permissive code licenses plus ${approvedExceptionIds.size} reviewed font/data-package exceptions.`,
);
