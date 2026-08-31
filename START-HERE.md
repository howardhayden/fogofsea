# START FOG OF SEA IN VSCODIUM

No online repository, account, or publishing step is required.

Product, UX, interaction, graphics, privacy, service, research, microcopy, and evaluation documentation begins at [`docs/design/README.md`](docs/design/README.md). It distinguishes the as-built system from research hypotheses and roadmap work.

The current adversarial release decision and open strategic-validity blockers are recorded in [`docs/red-team/2026-08-30-initial-pass.md`](docs/red-team/2026-08-30-initial-pass.md). A green conventional test run is not a substitute for closing that red-team gate.

To publish the game from the repository's protected `main` branch, follow [`DEPLOY-CLOUDFLARE.md`](DEPLOY-CLOUDFLARE.md). GitHub validates and preserves release evidence; Cloudflare Workers Builds publishes the static `dist/`; Hover remains the registrar. Do not copy `dist` into the repository root.

Player-facing help is intentionally narrower. The in-game Field Guide links to bundled plain-language references under `public/docs/` for gameplay, security/privacy/saves, and accessibility/controls. Research artifacts such as personas, journey maps, and roadmaps are not exposed in ordinary play.

## Start the downloaded copy

1. Fully extract the ZIP into a new folder. Do not reuse an older extracted folder with the same name.
2. In VSCodium, choose **File → Open Folder** and open the new folder that directly contains `package.json`.
3. If an older game server is still running in another terminal, focus that terminal and press **Control+C**.
4. Choose **Terminal → New Terminal**.
5. Run:

   ```bash
   npm run play
   ```

6. Open the exact address printed by the terminal: `http://127.0.0.1:5173/`.

`npm start` is an equivalent shortcut. The downloaded ZIP already includes the optimized
browser release, so playing it does not install packages or contact a package registry. The
launcher uses only Node.js, serves only the bundled `dist` folder over the loopback interface,
and applies the release security headers. It does not open a browser automatically.

VSCodium also includes a ready-made command. Choose **Terminal → Run Task**, then run
**Fog of Sea: play bundled local release**.

The command intentionally refuses to use a different port. If it reports that port `5173` is already in use, an older local copy is still running. Stop that older process and run `npm run play` again.

## Do not use Live Server on the source folder

VSCodium Live Server extensions do not compile this project’s TypeScript and do not apply the
release security headers. They are not a supported way to start the source folder. Use the local
launcher above to play.

If Live Server is used accidentally, the source shell remains on a neutral loading state because
Live Server cannot compile the TypeScript application. Close it and use the launcher above.

## Edit the source

Source development requires one package installation. Choose **Terminal → New Terminal**, then
run:

```bash
npm ci
npm run dev
```

The development command uses the same exact local address and stops clearly when the port is
occupied. After changing source, refresh the optimized release with `npm run build`; then stop the
development server and use `npm run play` to inspect that release with its complete local security
headers. VSCodium exposes the install, source-editing, build, and local-play commands under
**Terminal → Run Task**.

Do not double-click `dist/index.html`; browser security rules make `file://` module loading and
browser storage unreliable.

## Expected first view

After choosing session-only or browser saving, the page remains one browser viewport tall. The sea visualization fills the background, with independently scrolling glass mission and force panels. On narrow windows, the game shows one selected workspace view at a time. Open the compact workspace menu to choose **Visualization**, the current phase, or a global destination such as **Academy** and **Field Guide**; the drawer closes automatically and focus moves into the selected view or dialog.
