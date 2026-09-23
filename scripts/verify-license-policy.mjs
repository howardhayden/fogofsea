import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const policyLicenseId = "LicenseRef-Hayden-Proprietary-1.1";
const policyLicenseName = "Hayden Howard Proprietary Product and Source License 1.1";
const canonicalLicenseSha256 = "07b7734eb4da7c79ffdd32d4641ab64eea1922e8149ebf50c430e5f54657628c";
const historicalLicense10Sha256 = "70f32807af282fd88e8a9cea97648f3d76846d9ab4ed5578b344bfce9bf58b3e";
const copySpecificNotice =
  "Permissions validly attached to earlier distributed copies remain governed by their own terms and do not automatically attach to later copies or snapshots.";
const preBaselineParent = "458339be3c2312cae2ae337820b6f121f9778304";
const lastMitSnapshot = "444f6e20ed85774438b6fd5f76a733723da9fe97";

async function read(relativePath) {
  return readFile(new URL(relativePath, root), "utf8");
}

async function readJson(relativePath) {
  return JSON.parse(await read(relativePath));
}

function normalizeProse(value) {
  return value.replace(/\s+/g, " ").trim();
}

const [
  licenseText,
  packageJson,
  packageLock,
  licenseMap,
  baseline,
  ...policySurfaces
] = await Promise.all([
  read("LICENSE"),
  readJson("package.json"),
  readJson("package-lock.json"),
  readJson("LICENSE-MAP.json"),
  read("COMMERCIAL_BASELINE.md"),
  ...[
    "COMMERCIAL-LICENSE.md",
    "LICENSING.md",
    "NOTICE",
    "PERMISSIVE-EXCEPTIONS.md",
    "README.md",
    "WORKFLOW-BOUNDARIES.md",
  ].map(read),
]);

assert.match(licenseText, new RegExp(`^# ${policyLicenseName}`, "m"));
assert.match(licenseText, new RegExp(`^SPDX-License-Identifier: ${policyLicenseId}$`, "m"));
assert.equal(
  createHash("sha256").update(licenseText).digest("hex"),
  canonicalLicenseSha256,
  "LICENSE must match the canonical 1.1 text exactly",
);
assert.ok(normalizeProse(licenseText).includes(copySpecificNotice), "LICENSE must state the copy-specific historical boundary");

assert.equal(packageJson.license, policyLicenseId, "package.json license must match the current policy");
assert.equal(packageLock.license, policyLicenseId, "package-lock.json license must match the current policy");
assert.equal(
  packageLock.packages?.[""]?.license,
  policyLicenseId,
  "package-lock.json root package license must match the current policy",
);
assert.equal(licenseMap.default_license, policyLicenseId, "LICENSE-MAP default must match the current policy");
assert.equal(licenseMap.source_available_not_open_source, true);
assert.equal(licenseMap.implementation_reuse_granted, false);
assert.equal(licenseMap.noncommercial_reuse_granted, false);
assert.deepEqual(licenseMap.permissive_exceptions, []);
assert.ok(normalizeProse(licenseMap.historical_notice).includes(copySpecificNotice));

for (const surface of policySurfaces) {
  assert.ok(
    normalizeProse(surface).includes(copySpecificNotice),
    "every current policy surface must state the copy-specific historical boundary",
  );
}

assert.ok(normalizeProse(baseline).includes(copySpecificNotice));
assert.ok(baseline.includes(`Pre-baseline parent: \`${preBaselineParent}\``));
assert.ok(baseline.includes(lastMitSnapshot));
assert.ok(baseline.includes(policyLicenseId));
assert.equal(
  createHash("sha256")
    .update(await read("LICENSES/HISTORICAL/Hayden-Howard-Proprietary-Product-and-Source-License-1.0.txt"))
    .digest("hex"),
  historicalLicense10Sha256,
  "historical 1.0 license evidence must remain byte-exact",
);

for (const sbomPath of ["SBOM.spdx.json", "SBOM.production.spdx.json"]) {
  const sbom = await readJson(sbomPath);
  const rootPackage = sbom.packages?.find((item) => item.SPDXID === "SPDXRef-Package-root");
  assert.equal(rootPackage?.licenseDeclared, policyLicenseId, `${sbomPath} root declared license must match`);
  assert.equal(rootPackage?.licenseConcluded, policyLicenseId, `${sbomPath} root concluded license must match`);
  const extracted = sbom.hasExtractedLicensingInfos?.filter((item) => item.licenseId === policyLicenseId) ?? [];
  assert.equal(extracted.length, 1, `${sbomPath} must define the custom LicenseRef exactly once`);
  assert.equal(extracted[0].name, policyLicenseName, `${sbomPath} custom license name must match`);
  assert.equal(extracted[0].extractedText, licenseText, `${sbomPath} custom license text must match LICENSE exactly`);
}

console.log("Current proprietary license policy, copy-specific history boundary, baseline pins, metadata, and SPDX LicenseRef records are aligned.");
