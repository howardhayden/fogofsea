# Deploy FOG OF SEA with GitHub, Cloudflare, and Hover

Evidence date: 2026-08-31

GitHub is the authoritative source and release-evidence surface. Cloudflare Workers Builds is the production build and static-asset host. Hover remains the registrar for `fogofsea.app`; after cutover, Cloudflare becomes the authoritative DNS provider. FOG OF SEA remains a static, local-first SPA with no application server, account system, database, runtime secret, analytics dependency, or telemetry endpoint.

Do not treat this document as proof that every account-side step is complete. The repository changes and GitHub release ruleset are implemented; the Cloudflare and Hover changes below still require the owner's authenticated service sessions.

## Atomic hosting requirements

| ID | Requirement and provenance | Evidence or acceptance condition | Current status |
| --- | --- | --- | --- |
| HOST-001 | GitHub remains the authoritative source. | Production builds resolve from `howardhayden/fogofsea` and protected `main`. | Implemented; active `main release gate` ruleset targets the default branch. |
| HOST-002 | Publication must follow positive conventional and browser evidence. | Pull requests cannot merge until `release-gate` and `browser-gate` pass. | Implemented; both GitHub Actions checks are required and branches must be current before merge. |
| HOST-003 | Cloudflare serves only the compiled static artifact. | `wrangler.jsonc` points to `./dist`; no Worker script, API, storage binding, or runtime secret exists. | Implemented and tested. |
| HOST-004 | Direct SPA navigation must recover to the application shell. | Unknown navigation requests receive `index.html` through `single-page-application` handling. | Implemented and tested. |
| HOST-005 | Security headers and immutable hashed-asset caching must survive hosting. | Cloudflare consumes `dist/_headers`; `/assets/*` is immutable for one year and the shell retains revalidation. | Implemented; verify on the deployed hostname. |
| HOST-006 | Hosting must not introduce product telemetry. | Web Analytics, Zaraz, third-party scripts, and application logs remain disabled; CSP retains `connect-src 'none'`. | Repository implemented; dashboard verification pending. |
| HOST-007 | The registrar cutover must preserve all non-web DNS records. | Cloudflare's zone contains every required MX, TXT, verification, and mail-related record before Hover nameservers change. | Pending owner review. |
| HOST-008 | The apex is canonical and `www` does not become a duplicate application origin. | `fogofsea.app` serves the Worker; `www.fogofsea.app` returns a permanent path- and query-preserving redirect. | Pending Cloudflare zone activation. |
| HOST-009 | DNSSEC must fail safely across the nameserver transition. | Any old DS record is removed before delegation changes; Cloudflare DNSSEC is enabled and its new DS values are added at Hover only after the zone is active. | Pending account access. |
| HOST-010 | Rollback must remain bounded. | A known prior Worker version and the pre-cutover DNS record inventory are retained; rollback steps are tested without deleting repository history. | Repository procedure documented; live evidence pending. |
| HOST-011 | Preview exposure must be deliberate. | Non-production builds stay disabled until Cloudflare Access protects preview URLs, or public-preview risk is explicitly accepted. | Preview capability explicit; Access/branch setting pending. |
| HOST-012 | GitHub Pages must not remain a competing publisher. | The Pages site is unpublished only after the Cloudflare custom domain is verified. | Pages workflow removed; account-side unpublish pending. |

## What the repository now enforces

- `.github/workflows/main.yml` runs on pull requests to `main`, pushes to `main`, and manual dispatch. `release-gate` installs the exact lockfile, runs `npm run release:check`, and preserves the verified `dist/` artifact for 14 days. `browser-gate` installs Chromium and executes the actual Playwright suite.
- The GitHub workflow has read-only repository permission and contains no Pages or Cloudflare deployment credential. Cloudflare's GitHub App owns deployment; GitHub Actions owns evidence.
- `.node-version` pins the Cloudflare and GitHub build runtime to Node.js `22.23.2`.
- `wrangler.jsonc` names the Worker `fog-of-sea`, serves `./dist`, enables SPA fallback, disables the production `workers.dev` alias, and explicitly enables version preview URLs.
- Wrangler is deliberately not included in the application lockfile, SBOM, or shipped artifact. The deployment scripts pin the infrastructure CLI to `wrangler@4.127.1`; this avoids importing Wrangler's deployment-only dependency tree into FOG OF SEA's application license boundary.
- `public/_headers` is copied by Vite to `dist/_headers`. Cloudflare Workers Static Assets applies the security policy to every static response and gives fingerprinted `/assets/*` files a one-year immutable browser cache. The HTML shell retains Cloudflare's normal revalidation behavior.
- The three player-facing references in `public/docs/` are copied into `dist/docs/` and remain reachable from the in-game Field Guide; internal design and red-team records remain repository evidence rather than player help.
- `npm run verify:hosting` and the release tests reject a changed artifact directory, lost SPA fallback, unpinned deployment command, missing browser gate, reintroduced Pages deployment, missing immutable cache rule, or weakened no-connection policy.
- The obsolete GitHub Pages workflow, Pages deployment guide, and root `CNAME` file are removed.

## 1. Confirm the GitHub evidence run

1. Open `https://github.com/howardhayden/fogofsea/actions`.
2. Open the newest **Release gate** workflow run for this migration commit.
3. Confirm both jobs finish successfully: **release-gate** and **browser-gate**.
4. Open **Artifacts** and confirm `fog-of-sea-dist-<commit SHA>` exists. Do not deploy if either job is red, cancelled, or absent.

GitHub first had to observe the required check names successfully before they could be selected in the ruleset.

### First-run correction evidence

GitHub run `33344735391` on migration commit `cdf04b5` proved that `release-gate` passes and preserves the static artifact, but correctly blocked release when `browser-gate` reported four failures across 160 scheduled tests: 98 passed and 58 were skipped after failure. Review showed two assertions naming text that the current interface no longer contains, one 30-second test budget that expired under hosted-runner load after its behavior checks had progressed, and one rare exact-hue pixel floor that is not stable at a 320-pixel headless-GPU projection despite the exact generated model and broader rendered-chroma checks remaining intact. The correction updates the assertions to current accessible names, retains the same behavioral checks with a bounded 90-second budget, and separates exact compact model evidence from larger-viewport rare-hue rendering evidence.

Correction run `33345328073` on exact-tree commit `90624df` reduced the browser result to two failures, 100 passes, and the same 58 intentional project skips. It exposed the remaining stale `COMPATIBLE … aircraft` variants in that roster test—the interface consistently uses `COMPATIBILITY · credited/selected`—and a second full motion-contract test whose two complete reduced-motion and animated setup paths exceed 30 seconds under hosted-runner load. The follow-up corrects the whole label family and assigns that test the same bounded 90-second budget without removing an assertion.

Verification run `33345872836` on commit `585df3a` then passed both jobs. `browser-gate` recorded 102 passes, 58 intentional project-specific skips, and zero failures in 6.7 minutes. Only after that positive evidence was the active GitHub ruleset `main release gate` (ruleset `21889558`) created for the default branch.

## 2. Protect `main` in GitHub

The active configuration was created after the green run above. Use these steps to inspect it or reproduce it if it is ever removed:

1. Open **Repository → Settings → Rules → Rulesets → New ruleset → New branch ruleset**.
2. Name it `main release gate`; set **Enforcement status** to **Active**.
3. Target the default branch, or include branch `main` exactly.
4. Enable **Restrict deletions**, **Block force pushes**, **Require a pull request before merging**, **Require conversation resolution before merging**, and **Require status checks to pass**.
5. Add required checks `release-gate` and `browser-gate`. Select GitHub Actions as the expected source if GitHub offers it.
6. Enable **Require branches to be up to date before merging**. Do not add a routine bypass actor.
7. Save, then open the ruleset in **Evaluate** or its rule-insights view and confirm `main` is targeted.

The ruleset is active with no bypass actors. If it is ever disabled or loses either required check, treat direct publication from `main` as a release blocker until protection is restored.

## 3. Import the repository into Cloudflare Workers Builds

1. In Cloudflare, open **Workers & Pages → Create application → Import a repository**.
2. Connect the **Cloudflare Workers and Pages** GitHub App to `howardhayden/fogofsea`. Grant access only to the repositories Cloudflare must deploy.
3. Select `howardhayden/fogofsea`.
4. Set the Worker name to `fog-of-sea`. This must match `wrangler.jsonc` exactly.
5. Use these build settings:

   | Setting | Exact value |
   | --- | --- |
   | Production branch | `main` |
   | Root directory | `/` (repository root) |
   | Build command | `npm ci && npm run release:check` |
   | Deploy command | `npm run deploy:cloudflare` |
   | Non-production branch deploy command | `npm run preview:cloudflare` |
   | Build variable | `SKIP_DEPENDENCY_INSTALL=1` |

6. Add no runtime variables, secrets, KV namespaces, D1 databases, R2 buckets, service bindings, analytics bindings, or server-side logs. The game requires none.
7. Initially disable **Builds for non-production branches** under **Settings → Build → Branch control**. Version previews are public when enabled. Enable branch previews only after configuring Cloudflare Access for this Worker's preview URLs, unless public previews are an explicit decision.
8. Select **Save and Deploy**. The pinned deploy command creates a static-only Worker version from the verified `dist/`.
9. Open the generated version preview URL from the deployment record. Confirm the privacy gate appears, direct navigation such as `/academy` returns the SPA rather than a Cloudflare 404, browser saving remains opt-in, and the browser network panel shows no application requests to third-party origins.

`workers_dev` is false, so the unversioned production `fog-of-sea.<account>.workers.dev` route remains disabled. `preview_urls` is intentionally true so an exact version can be inspected before the custom domain moves.

## 4. Add `fogofsea.app` to Cloudflare without losing DNS records

1. In Cloudflare, open **Domains → Onboard a domain**, enter `fogofsea.app`, and select the desired plan.
2. Allow the initial DNS scan, then compare Cloudflare's proposed records against Hover's current DNS page. Record or export the Hover zone before changing anything.
3. Preserve every non-web record exactly, especially MX, SPF, DKIM, DMARC, domain-verification, and other TXT records. Cloudflare's scan is not proof of completeness.
4. Keep the existing GitHub Pages web records temporarily. They provide the rollback origin until the Worker custom domain is ready.
5. Copy the two Cloudflare-assigned authoritative nameservers. Do not substitute nameservers from another Cloudflare zone.

If Hover shows an existing DNSSEC DS record, remove that DS record before changing nameservers. A DS record for the old DNS provider combined with Cloudflare nameservers can make the entire domain fail validation.

## 5. Change only the nameservers at Hover

1. Sign in to Hover with 2FA and open `fogofsea.app`.
2. On the domain **Overview** page, find **Nameservers** and select **Edit**.
3. Remove the existing authoritative nameservers and enter the two exact nameservers assigned by Cloudflare. All nameservers must belong to Cloudflare; do not mix Hover and Cloudflare nameservers.
4. Select **Save nameservers**.
5. Do not edit the domain's registration, contact, renewal, transfer-lock, or ownership settings. Hover remains the registrar.

Hover states that nameserver propagation can take 24–48 hours. Cloudflare may report activation sooner. Continue only when Cloudflare marks the zone **Active** and independent NS lookups return the assigned Cloudflare nameservers.

## 6. Move the apex from GitHub Pages to the Worker

1. In Cloudflare, open **Workers & Pages → fog-of-sea → Settings → Domains & Routes → Add → Custom Domain**.
2. Enter `fogofsea.app` and select **Add Custom Domain**. Cloudflare creates the Worker DNS record and certificate.
3. If Cloudflare reports a conflicting apex record, remove only the old GitHub Pages A/AAAA/CNAME web records for the apex, then immediately retry **Add Custom Domain**. Do not remove MX, TXT, mail, or verification records.
4. Wait for the custom domain and certificate to become active. Confirm `https://fogofsea.app/` loads the same verified version and that a direct nested path returns the application shell.
5. In **SSL/TLS**, use **Full (strict)** where the dashboard presents an encryption-mode choice. Enable **Always Use HTTPS** after the custom domain certificate is active. Do not preload HSTS during the cutover; that would make rollback less forgiving.

## 7. Redirect `www` to the apex

1. In Cloudflare DNS, create a proxied CNAME record: name `www`, target `fogofsea.app`, TTL **Auto**.
2. Open **Rules → Redirect Rules → Single Redirect** and create `www to apex`.
3. Use wildcard request URL `http*://www.fogofsea.app/*`.
4. Use target URL `https://fogofsea.app/${2}`, status `301`, and enable **Preserve query string**.
5. Verify both `http://www.fogofsea.app/example` and `https://www.fogofsea.app/example?x=1` resolve once to `https://fogofsea.app/example` with the query preserved.

Do not attach `www.fogofsea.app` as a second application custom domain; that would create a second browser-storage origin and duplicate public application origin.

## 8. Re-enable DNSSEC through Cloudflare and Hover

1. Only after Cloudflare shows the zone and Worker domain as active, open **Cloudflare → DNS → Settings → DNSSEC** and enable DNSSEC.
2. Copy the DS values Cloudflare provides: key tag, algorithm, digest type, and digest.
3. In Hover, open the domain's **DNSSEC** section and select **Add DS record**.
4. Enter the Cloudflare values exactly and save.
5. Verify the zone resolves with DNSSEC validation. If validation fails, remove the incorrect Hover DS record before experimenting; an incorrect DS record can make the domain unreachable.

## 9. Disable competing publication and telemetry

After the Cloudflare apex, `www` redirect, security headers, and save behavior are verified:

1. In GitHub, open the repository's **Settings → Pages**. Under the live-site notice, use the menu and select **Unpublish site**. The repository and its history remain; only the old Pages deployment is removed.
2. In Cloudflare, confirm **Web Analytics** is not enabled for FOG OF SEA, no Zaraz tags exist for the zone, and no third-party script injection product is active.
3. Leave Cloudflare's ordinary aggregate infrastructure metrics available if desired; do not describe them as application telemetry and do not add a client-side beacon.
4. Fetch `/`, one hashed `/assets/` file, and a nested SPA path. Confirm:
   - HTML and nested navigation include the CSP, referrer, permissions, framing, resource, and MIME-sniffing policies from `_headers`.
   - A fingerprinted asset includes `Cache-Control: public, max-age=31536000, immutable`.
   - The HTML shell is revalidated rather than cached immutably.
   - No source map is served.
   - No application request leaves the same origin.

## 10. Rollback and recovery

If a Worker release is bad but DNS is healthy, use **Workers & Pages → fog-of-sea → Deployments** to roll back to the last verified Worker version. Do not rewrite Git history or delete the failed evidence.

If the custom-domain cutover fails before GitHub Pages is unpublished, remove the Worker custom domain and restore the recorded GitHub Pages apex records in Cloudflare DNS. Because Hover already delegates DNS to Cloudflare, do not switch nameservers back merely to change the web origin.

If the entire Cloudflare zone must be abandoned, first restore a complete DNS zone at Hover, disable Cloudflare DNSSEC, remove the Cloudflare DS record at Hover, and only then restore Hover nameservers. Nameserver rollback without the DNS and DNSSEC sequence can break web and mail together.

For every correction, preserve: failed deployment/version ID → observed symptom → exact configuration correction → new commit/version → GitHub gate results → browser/header verification.

## Current external completion boundary

The repository, workflow, static-host configuration, caching policy, tests, and runbook are complete in source. The following were not completed from this workspace and must not be represented as complete until verified in their respective accounts:

- GitHub Pages unpublication.
- Cloudflare Worker creation, GitHub App installation, Build settings, first deployment, preview protection, custom domains, redirect rule, TLS settings, and telemetry-product review.
- Cloudflare zone onboarding, DNS-record reconciliation, nameserver activation, and DNSSEC enablement.
- Hover nameserver replacement and DS-record management.
- Live-domain browser, response-header, cache, direct-navigation, save persistence, accessibility, and rollback verification.

## Current primary references

- [Cloudflare Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/)
- [Workers Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
- [Workers build branches](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/)
- [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)
- [SPA routing](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)
- [Static-asset response headers](https://developers.cloudflare.com/workers/static-assets/headers/)
- [Worker Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
- [Worker preview URLs and Access](https://developers.cloudflare.com/workers/versions-and-deployments/preview-urls/)
- [Cloudflare full DNS setup](https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/)
- [Cloudflare `www`-to-apex redirect](https://developers.cloudflare.com/rules/url-forwarding/examples/redirect-www-to-root/)
- [Hover nameserver changes](https://support.hover.com/support/solutions/articles/201000064742-changing-your-domain-nameservers)
- [Hover DNSSEC records](https://support.hover.com/support/solutions/articles/201000064716)
- [GitHub repository rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository)
- [GitHub Pages unpublication](https://docs.github.com/en/pages/getting-started-with-github-pages/unpublishing-a-github-pages-site)
