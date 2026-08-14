# DEPLOY FOG OF SEA WITH GITHUB PAGES

This repository is ready to build and publish the optimized game from `main`. Do not move the contents of `dist/` into the repository root. The root `index.html` is Vite source; GitHub Actions compiles it and deploys only the finished `dist/` artifact.

## One-time GitHub setup

1. Push this complete repository to `howardhayden/fogofsea` on the `main` branch.
2. Open **Settings → Pages** in that repository.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Under **Custom domain**, enter `fogofsea.app`, save it, and enable **Enforce HTTPS** when GitHub makes the option available.
5. Open the repository's **Actions** tab. The workflow named **Deploy GitHub Pages** runs automatically for every push to `main`. A successful run contains both a `build` job and a `deploy` job.

The workflow is stored at `.github/workflows/main.yml`. It installs the exact lockfile, runs the release checks, builds with Vite, uploads `dist/`, and publishes that artifact. The default branch source is never served directly.

## Hover DNS

For the apex domain `fogofsea.app`, keep these four `A` records at Hover:

| Host | Type | Value |
| --- | --- | --- |
| `@` | `A` | `185.199.108.153` |
| `@` | `A` | `185.199.109.153` |
| `@` | `A` | `185.199.110.153` |
| `@` | `A` | `185.199.111.153` |

For `www.fogofsea.app`, use a `CNAME` record whose value is `howardhayden.github.io`. GitHub's Pages settings are authoritative for the custom domain when deployment uses GitHub Actions; the root `CNAME` file is retained as a readable repository record.

DNS and HTTPS certificate changes can take time to propagate. Do not change the workflow or flatten the build while waiting.

## What the published artifact contains

Vite copies the player references from `public/docs/` into `dist/docs/`, along with both favicons, open-source notices, license texts, and `_headers`. The app's Field Guide links to those deployed files with relative URLs.

GitHub Pages does not apply Netlify-style `_headers` files. FOG OF SEA still ships its restrictive Content Security Policy and referrer policy in `index.html`; policies that require HTTP response headers depend on the hosting provider. The `_headers` file remains useful to the bundled local server and compatible static hosts.

## Updating the live game

Commit and push source changes to `main`. Do not upload generated asset files to the repository root. Wait for **Actions → Deploy GitHub Pages** to finish, then refresh `https://fogofsea.app/`. If the workflow fails, open the failed `build` job; deployment is intentionally blocked whenever a release check fails.

Official references:

- [Configuring a publishing source for GitHub Pages](https://docs.github.com/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Managing a custom domain for GitHub Pages](https://docs.github.com/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
- [Troubleshooting custom domains and GitHub Pages](https://docs.github.com/pages/configuring-a-custom-domain-for-your-github-pages-site/troubleshooting-custom-domains-and-github-pages)
