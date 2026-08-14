# Third-Party Notices

Every locked dependency declares a license approved by this project's open-license policy. The general allowlist contains permissive code licenses. The only reviewed font/data-package exceptions are the bundled Jost font under OFL-1.1 and build-time browser-compatibility data under CC-BY-4.0. `npm run verify:licenses` rejects missing declarations, unreviewed licenses, unapproved registries, mutable direct-version ranges, and prohibited package families.

Permissive code identifiers: 0BSD, Apache-2.0, BSD-2-Clause, BSD-3-Clause, BlueOak-1.0.0, ISC, MIT, and Python-2.0.

Installed license and notice texts are reproduced in `THIRD_PARTY_LICENSES.txt`. The static release also serves the runtime license texts at `/third-party-licenses.txt`. The complete machine-readable dependency graph is recorded in `SBOM.spdx.json`; the browser runtime subset is recorded in `SBOM.production.spdx.json`. Package distributions remain authoritative.

## Reviewed font and data materials

- @fontsource-variable/jost@5.3.0 packages the unmodified Jost variable font by the Jost Project Authors under the SIL Open Font License 1.1. The font is self-hosted.
- caniuse-lite@1.0.30001809 is build-time browser-compatibility data by Ben Briggs and contributors, used without project modification under Creative Commons Attribution 4.0. Source: <https://github.com/browserslist/caniuse-lite>.

## Adapted visual source

- The independent aurora engine adapts progressive domain-warp organization and smooth BasicGrid vector interpolation from FastNoise Lite 1.1.1 GLSL by Jordan Peck and contributors. A compact WebGL-1-compatible variant drives original long, tapered, three-dimensional spline-veils with fog and depth; no package runtime is bundled. License: MIT. Source: <https://github.com/Auburn/FastNoiseLite/blob/master/GLSL/FastNoiseLite.glsl>.

## Direct dependencies

| Package | Version | Scope | License | Source |
| --- | ---: | --- | --- | --- |
| @eslint/js | 9.39.4 | development | MIT | <https://www.npmjs.com/package/%40eslint%2Fjs> |
| @fontsource-variable/jost | 5.3.0 | runtime | OFL-1.1 | <https://www.npmjs.com/package/%40fontsource-variable%2Fjost> |
| @playwright/test | 1.62.1 | development | Apache-2.0 | <https://www.npmjs.com/package/%40playwright%2Ftest> |
| @types/node | 22.19.19 | development | MIT | <https://www.npmjs.com/package/%40types%2Fnode> |
| @types/react | 19.2.14 | development | MIT | <https://www.npmjs.com/package/%40types%2Freact> |
| @types/react-dom | 19.2.3 | development | MIT | <https://www.npmjs.com/package/%40types%2Freact-dom> |
| @types/three | 0.179.0 | development | MIT | <https://www.npmjs.com/package/%40types%2Fthree> |
| @typescript-eslint/parser | 8.66.0 | development | MIT | <https://www.npmjs.com/package/%40typescript-eslint%2Fparser> |
| @vitejs/plugin-react | 5.2.0 | development | MIT | <https://www.npmjs.com/package/%40vitejs%2Fplugin-react> |
| astronomy-engine | 2.1.19 | runtime | MIT | <https://www.npmjs.com/package/astronomy-engine> |
| eslint | 9.39.4 | development | MIT | <https://www.npmjs.com/package/eslint> |
| eslint-plugin-react-hooks | 7.1.1 | development | MIT | <https://www.npmjs.com/package/eslint-plugin-react-hooks> |
| react | 19.2.6 | runtime | MIT | <https://www.npmjs.com/package/react> |
| react-dom | 19.2.6 | runtime | MIT | <https://www.npmjs.com/package/react-dom> |
| three | 0.179.1 | runtime | MIT | <https://www.npmjs.com/package/three> |
| tsx | 4.23.5 | development | MIT | <https://www.npmjs.com/package/tsx> |
| typescript | 5.9.3 | development | Apache-2.0 | <https://www.npmjs.com/package/typescript> |
| vite | 7.3.6 | development | MIT | <https://www.npmjs.com/package/vite> |

## Complete locked inventory

### Apache-2.0

- @dimforge/rapier3d-compat@0.12.0 — development
- @eslint/config-array@0.21.2 — development
- @eslint/config-helpers@0.4.2 — development
- @eslint/core@0.17.0 — development
- @eslint/object-schema@2.1.7 — development
- @eslint/plugin-kit@0.4.1 — development
- @humanfs/core@0.19.2 — development
- @humanfs/node@0.16.8 — development
- @humanfs/types@0.15.0 — development
- @humanwhocodes/module-importer@1.0.1 — development
- @humanwhocodes/retry@0.4.3 — development
- @playwright/test@1.62.1 — development
- baseline-browser-mapping@2.11.13 — development
- eslint-visitor-keys@3.4.3 — development
- eslint-visitor-keys@4.2.1 — development
- eslint-visitor-keys@5.0.1 — development
- playwright@1.62.1 — development
- playwright-core@1.62.1 — development
- typescript@5.9.3 — development

### BlueOak-1.0.0

- minimatch@10.2.6 — development

### BSD-2-Clause

- eslint-scope@8.4.0 — development
- espree@10.4.0 — development
- esrecurse@4.3.0 — development
- estraverse@5.3.0 — development
- esutils@2.0.3 — development
- uri-js@4.4.1 — development

### BSD-3-Clause

- @webgpu/types@0.1.71 — development
- esquery@1.7.0 — development
- source-map-js@1.2.1 — development

### CC-BY-4.0

- caniuse-lite@1.0.30001809 — development

### ISC

- electron-to-chromium@1.5.403 — development
- flatted@3.4.2 — development
- glob-parent@6.0.2 — development
- isexe@2.0.0 — development
- lru-cache@5.1.1 — development
- minimatch@3.1.5 — development
- picocolors@1.1.1 — development
- semver@6.3.1 — development
- semver@7.8.5 — development
- which@2.0.2 — development
- yallist@3.1.1 — development

### MIT

- @babel/code-frame@7.29.7 — development
- @babel/compat-data@7.29.7 — development
- @babel/core@7.29.7 — development
- @babel/generator@7.29.8 — development
- @babel/helper-compilation-targets@7.29.7 — development
- @babel/helper-globals@7.29.7 — development
- @babel/helper-module-imports@7.29.7 — development
- @babel/helper-module-transforms@7.29.7 — development
- @babel/helper-plugin-utils@7.29.7 — development
- @babel/helper-string-parser@7.29.7 — development
- @babel/helper-validator-identifier@7.29.7 — development
- @babel/helper-validator-option@7.29.7 — development
- @babel/helpers@7.29.7 — development
- @babel/parser@7.29.8 — development
- @babel/plugin-transform-react-jsx-self@7.29.7 — development
- @babel/plugin-transform-react-jsx-source@7.29.7 — development
- @babel/template@7.29.7 — development
- @babel/traverse@7.29.8 — development
- @babel/types@7.29.8 — development
- @esbuild/aix-ppc64@0.28.1 — development, optional platform package
- @esbuild/android-arm@0.28.1 — development, optional platform package
- @esbuild/android-arm64@0.28.1 — development, optional platform package
- @esbuild/android-x64@0.28.1 — development, optional platform package
- @esbuild/darwin-arm64@0.28.1 — development, optional platform package
- @esbuild/darwin-x64@0.28.1 — development, optional platform package
- @esbuild/freebsd-arm64@0.28.1 — development, optional platform package
- @esbuild/freebsd-x64@0.28.1 — development, optional platform package
- @esbuild/linux-arm@0.28.1 — development, optional platform package
- @esbuild/linux-arm64@0.28.1 — development, optional platform package
- @esbuild/linux-ia32@0.28.1 — development, optional platform package
- @esbuild/linux-loong64@0.28.1 — development, optional platform package
- @esbuild/linux-mips64el@0.28.1 — development, optional platform package
- @esbuild/linux-ppc64@0.28.1 — development, optional platform package
- @esbuild/linux-riscv64@0.28.1 — development, optional platform package
- @esbuild/linux-s390x@0.28.1 — development, optional platform package
- @esbuild/linux-x64@0.28.1 — development, optional platform package
- @esbuild/netbsd-arm64@0.28.1 — development, optional platform package
- @esbuild/netbsd-x64@0.28.1 — development, optional platform package
- @esbuild/openbsd-arm64@0.28.1 — development, optional platform package
- @esbuild/openbsd-x64@0.28.1 — development, optional platform package
- @esbuild/openharmony-arm64@0.28.1 — development, optional platform package
- @esbuild/sunos-x64@0.28.1 — development, optional platform package
- @esbuild/win32-arm64@0.28.1 — development, optional platform package
- @esbuild/win32-ia32@0.28.1 — development, optional platform package
- @esbuild/win32-x64@0.28.1 — development, optional platform package
- @eslint-community/eslint-utils@4.9.1 — development
- @eslint-community/regexpp@4.12.2 — development
- @eslint/eslintrc@3.3.5 — development
- @eslint/js@9.39.4 — development
- @jridgewell/gen-mapping@0.3.13 — development
- @jridgewell/remapping@2.3.5 — development
- @jridgewell/resolve-uri@3.1.2 — development
- @jridgewell/sourcemap-codec@1.5.5 — development
- @jridgewell/trace-mapping@0.3.31 — development
- @napi-rs/lzma-linux-x64-gnu@1.5.1 — development, optional platform package
- @rolldown/pluginutils@1.0.0-rc.3 — development
- @rollup/rollup-android-arm-eabi@4.62.4 — development, optional platform package
- @rollup/rollup-android-arm64@4.62.4 — development, optional platform package
- @rollup/rollup-darwin-arm64@4.62.4 — development, optional platform package
- @rollup/rollup-darwin-x64@4.62.4 — development, optional platform package
- @rollup/rollup-freebsd-arm64@4.62.4 — development, optional platform package
- @rollup/rollup-freebsd-x64@4.62.4 — development, optional platform package
- @rollup/rollup-linux-arm-gnueabihf@4.62.4 — development, optional platform package
- @rollup/rollup-linux-arm-musleabihf@4.62.4 — development, optional platform package
- @rollup/rollup-linux-arm64-gnu@4.62.4 — development, optional platform package
- @rollup/rollup-linux-arm64-musl@4.62.4 — development, optional platform package
- @rollup/rollup-linux-loong64-gnu@4.62.4 — development, optional platform package
- @rollup/rollup-linux-loong64-musl@4.62.4 — development, optional platform package
- @rollup/rollup-linux-ppc64-gnu@4.62.4 — development, optional platform package
- @rollup/rollup-linux-ppc64-musl@4.62.4 — development, optional platform package
- @rollup/rollup-linux-riscv64-gnu@4.62.4 — development, optional platform package
- @rollup/rollup-linux-riscv64-musl@4.62.4 — development, optional platform package
- @rollup/rollup-linux-s390x-gnu@4.62.4 — development, optional platform package
- @rollup/rollup-linux-x64-gnu@4.62.4 — development, optional platform package
- @rollup/rollup-linux-x64-musl@4.62.4 — development, optional platform package
- @rollup/rollup-openbsd-x64@4.62.4 — development, optional platform package
- @rollup/rollup-openharmony-arm64@4.62.4 — development, optional platform package
- @rollup/rollup-win32-arm64-msvc@4.62.4 — development, optional platform package
- @rollup/rollup-win32-ia32-msvc@4.62.4 — development, optional platform package
- @rollup/rollup-win32-x64-gnu@4.62.4 — development, optional platform package
- @rollup/rollup-win32-x64-msvc@4.62.4 — development, optional platform package
- @tweenjs/tween.js@23.1.3 — development
- @types/babel__core@7.20.5 — development
- @types/babel__generator@7.27.0 — development
- @types/babel__template@7.4.4 — development
- @types/babel__traverse@7.28.0 — development
- @types/estree@1.0.9 — development
- @types/json-schema@7.0.15 — development
- @types/node@22.19.19 — development
- @types/react@19.2.14 — development
- @types/react-dom@19.2.3 — development
- @types/stats.js@0.17.4 — development
- @types/three@0.179.0 — development
- @types/webxr@0.5.24 — development
- @typescript-eslint/parser@8.66.0 — development
- @typescript-eslint/project-service@8.66.0 — development
- @typescript-eslint/scope-manager@8.66.0 — development
- @typescript-eslint/tsconfig-utils@8.66.0 — development
- @typescript-eslint/types@8.66.0 — development
- @typescript-eslint/typescript-estree@8.66.0 — development
- @typescript-eslint/visitor-keys@8.66.0 — development
- @vitejs/plugin-react@5.2.0 — development
- acorn@8.16.0 — development
- acorn-jsx@5.3.2 — development
- ajv@6.15.0 — development
- ansi-styles@4.3.0 — development
- astronomy-engine@2.1.19 — runtime
- balanced-match@1.0.2 — development
- balanced-match@4.0.4 — development
- brace-expansion@1.1.18 — development
- brace-expansion@5.0.9 — development
- browserslist@4.28.8 — development
- callsites@3.1.0 — development
- chalk@4.1.2 — development
- color-convert@2.0.1 — development
- color-name@1.1.4 — development
- concat-map@0.0.1 — development
- convert-source-map@2.0.0 — development
- cross-spawn@7.0.6 — development
- csstype@3.2.3 — development
- debug@4.4.3 — development
- deep-is@0.1.4 — development
- esbuild@0.28.1 — development
- escalade@3.2.0 — development
- escape-string-regexp@4.0.0 — development
- eslint@9.39.4 — development
- eslint-plugin-react-hooks@7.1.1 — development
- fast-deep-equal@3.1.3 — development
- fast-json-stable-stringify@2.1.0 — development
- fast-levenshtein@2.0.6 — development
- fdir@6.5.0 — development
- fflate@0.8.3 — development
- file-entry-cache@8.0.0 — development
- find-up@5.0.0 — development
- flat-cache@4.0.1 — development
- fsevents@2.3.2 — development, optional platform package
- fsevents@2.3.3 — development, optional platform package
- gensync@1.0.0-beta.2 — development
- globals@14.0.0 — development
- has-flag@4.0.0 — development
- hermes-estree@0.25.1 — development
- hermes-parser@0.25.1 — development
- ignore@5.3.2 — development
- import-fresh@3.3.1 — development
- imurmurhash@0.1.4 — development
- is-extglob@2.1.1 — development
- is-glob@4.0.3 — development
- js-tokens@4.0.0 — development
- js-yaml@4.3.1 — development
- jsesc@3.1.0 — development
- json-buffer@3.0.1 — development
- json-schema-traverse@0.4.1 — development
- json-stable-stringify-without-jsonify@1.0.1 — development
- json5@2.2.3 — development
- keyv@4.5.4 — development
- levn@0.4.1 — development
- locate-path@6.0.0 — development
- lodash.merge@4.6.2 — development
- meshoptimizer@0.22.0 — development
- ms@2.1.3 — development
- nanoid@3.3.18 — development
- natural-compare@1.4.0 — development
- node-releases@2.0.53 — development
- optionator@0.9.4 — development
- p-limit@3.1.0 — development
- p-locate@5.0.0 — development
- parent-module@1.0.1 — development
- path-exists@4.0.0 — development
- path-key@3.1.1 — development
- picomatch@4.0.4 — development
- picomatch@4.0.5 — development
- postcss@8.5.26 — development
- prelude-ls@1.2.1 — development
- punycode@2.3.1 — development
- react@19.2.6 — runtime
- react-dom@19.2.6 — runtime
- react-refresh@0.18.0 — development
- resolve-from@4.0.0 — development
- rollup@4.62.4 — development
- scheduler@0.27.0 — runtime
- shebang-command@2.0.0 — development
- shebang-regex@3.0.0 — development
- strip-json-comments@3.1.1 — development
- supports-color@7.2.0 — development
- three@0.179.1 — runtime
- tinyglobby@0.2.17 — development
- ts-api-utils@2.5.0 — development
- tsx@4.23.5 — development
- type-check@0.4.0 — development
- undici-types@6.21.0 — development
- update-browserslist-db@1.3.1 — development
- vite@7.3.6 — development
- word-wrap@1.2.5 — development
- yocto-queue@0.1.0 — development
- zod@4.4.3 — development
- zod-validation-error@4.0.2 — development

### OFL-1.1

- @fontsource-variable/jost@5.3.0 — runtime

### Python-2.0

- argparse@2.0.1 — development

## Original project assets

The interface geometry, abstract wave-and-fog mark, procedural weather visuals, and browser-synthesized sound design are original project code. No recordings, samples, vocals, institutional marks, course assets, or remote media are bundled.
