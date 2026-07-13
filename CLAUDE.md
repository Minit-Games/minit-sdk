# CLAUDE.md — minit-sdk

Public npm package `@minit-games/sdk` (GitHub repo `Minit-Games/minit-sdk`), the engine-agnostic browser JS SDK for the Minit platform. Full maintainer reference — the `window.minit` contract, shared engine-facade pattern, distribution/release philosophy, and per-engine gotchas — lives in the consolidated SDK-maintenance doc: https://github.com/Minit-Games/minit-root/blob/develop/docs/sdk-maintenance.md

## Tutorial module & asset pipeline

`src/modules/tutorial/` hosts the first-play tutorial overlay: `shouldShowTutorial()` (gating — `?tutorial=` URL override wins, then hides for returning players whose userData slot is non-empty) and `createTutorialOverlay()` (DOM overlay with finger / swipe / highlight / pill primitives; design tokens in `theme.js`). `package.json` marks it in `sideEffects: ["**/modules/tutorial/**"]` so bundlers don't tree-shake it away.

Its assets go through a generate step: `scripts/bundle-tutorial-assets.mjs` embeds the OK-button SVG and SFX as data URIs into the auto-generated `src/modules/tutorial/assets/bundled.js` (`import.meta.url`-relative paths break under Vite dep pre-bundling). Because of this, `npm run build`, `npm run check`, and `npm run test` all run that bundling step before `tsc` / `jest`, and `build` additionally runs `scripts/copy-tutorial-assets.mjs` afterwards to copy the raw assets into `dist/`. `npm run preview:tutorial` builds and serves the local overlay preview (`examples/tutorial-preview/`).

## Release Process

Releases follow the canonical release-train workflow documented at [minit-root/docs/release-workflow.md](https://github.com/Minit-Games/minit-root/blob/develop/docs/release-workflow.md). That runbook is authoritative for *when* and *why* to release (versioning policy, release-train coordination, and the `-s ours` exception for the sdk's independent publish cadence). The subsection below covers *how the npm publish works for this specific repo* — mechanics that the cross-repo runbook does not replicate.

### npm publish specifics

Releases are cut from `develop`. The version bump lands on `develop` first, then is fast-forwarded to `master`.

1. From `develop`, bump the version and create a git tag:
   ```bash
   git checkout develop
   git pull
   npm version patch   # or minor / major
   ```
2. Push the commit and tag:
   ```bash
   git push
   git push --tags
   ```
3. GitHub Actions (`publish.yml`) detects the `v*.*.*` tag and runs `npm publish` automatically with npm provenance.
4. Verify the release at: https://www.npmjs.com/package/@minit-games/sdk
5. Promote `develop` → `master` so master reflects the published state:
   ```bash
   git checkout master
   git pull
   git merge --ff-only develop
   git push
   ```

> Publishing uses npm Trusted Publishing (OIDC) — no token secret required. The trusted publisher is configured at npmjs.com under the package's Settings → Trusted publishing, pointing at `Minit-Games/minit-sdk` + workflow `publish.yml`. The trusted publisher is not pinned to a branch, so publishes from develop work without reconfiguration.
