# CLAUDE.md — minit-sdk

Internal ops reference for the `@minit-games/sdk` package. Public npm package; GitHub repo: `Minit-Games/minit-sdk`.

## Commands

```bash
npm install        # Install dependencies
npm run check      # TypeScript type check (tsc --noEmit)
npm run build      # Compile to dist/ (ESM + .d.ts)
```

## Build conventions

The SDK builds with `"module": "NodeNext"` + `"moduleResolution": "NodeNext"` in `tsconfig.json`. Production source files in `src/**` (everything except `*.test.ts`) **must** use explicit `.js` extensions on relative imports (e.g. `from "./utils.js"`, `from "../minitApi.js"`). The `.js` refers to the emitted file — TypeScript leaves these specifiers untouched, and Node strict ESM rejects extensionless relative imports.

Test files (`*.test.ts`) deliberately use extensionless relative imports — they run under `tsconfig.test.json` which overrides to `module: commonjs` / `moduleResolution: node`, and `jest.config.cjs` includes a `moduleNameMapper` that strips a trailing `.js` suffix from relative specifiers so ts-jest still resolves `.ts` source files when a production file imports them.

## Entry Points

| Import path | Description |
|---|---|
| `@minit-games/sdk` | Core SDK — `initializeSDK`, `reportResult`, `getUserData`, `getConfigValue`, `loadingDone`, etc. |
| `@minit-games/sdk/ui` | UI helpers |

## Bundled Fonts

The SDK vendors all fonts as base64-encoded woff2 data URIs — no runtime network requests to `fonts.googleapis.com` or `fonts.gstatic.com` are made. Fonts are injected via `@font-face` CSS rules at module initialisation.

| Module | Font | Used by |
|---|---|---|
| `src/modules/fonts/lato.ts` | Lato 400 + 700, latin subset | `headerPanel` (`injectStyles`) |
| `src/modules/fonts/bowlbyOneSC.ts` | Bowlby One SC 400, latin subset | `feedback` (`injectStyles` / `preloadFeedbackFont`) |

The font modules export a single `get*FontFaceCSS()` function and are tree-shaken away if the consuming module is unused. Each module is intentionally split so games using only `feedback` don't bundle Lato, and games using only `headerPanel` don't bundle Bowlby One SC.

SIL OFL license texts for both families are shipped in the `licenses/` directory and are included in the npm package via the `files` field in `package.json`. Do not remove them — they are legally required when distributing the font data.

To update a font (e.g. new version from Google Fonts):
1. Download the new woff2 from fonts.gstatic.com (fetch the Google Fonts CSS with a modern Chrome UA to get the woff2 URL)
2. Base64-encode: `base64 -i <file>.woff2 | tr -d '\n'`
3. Replace the constant in the corresponding `src/modules/fonts/*.ts` file
4. Update the license file if the copyright year or holder changed

## Persistent user data (single-slot API, updated in v1.3.0)

The per-creator userData slot is shared across all of a creator's games. The host (app) owns serialization and transport — `window.minit.userData` is injected as a primitive `string | undefined`; the SDK never calls `JSON.parse` on it.

### Reading

`getUserData(): string | undefined` — reads `window.minit.userData` directly. No key argument. Falls back to the `?userData=<value>` URL param when `window.minit.userData` is `undefined` or `null` (local-dev convenience — any host-injected string, including `""`, wins over the URL param).

Returns `undefined` when: no value is stored for this player; `window.minit.userData` is absent and the `?userData` URL param is also absent. Returns `""` if the stored value is the empty string (distinct from `undefined`).

`userData` is a reserved URL-param key — it is stripped from `getConfig()`/`getConfigValue()` so it never bleeds into the config API. Only the exact key `userData` is reserved (keys like `userData2` are unaffected).

### Writing

`reportResult(result, { userData?: string })` — pass a plain string to store. An empty string `""` is a valid write. Omitting `userData` (or not passing `options`) leaves the stored value unchanged — the host payload will not include a `userData` field.

**Wire shape (internal detail):** the SDK's public API accepts a bare string, but before forwarding to the host the string is wrapped into `{ value: string }` — i.e. the postMessage carries `userData: { value: "<the string>" }`. This matches `UserDataPatchSchema` in `@minit/shared/zod` (extensible for future fields). Games always see and pass the bare string; the wrapping is an SDK-internal concern and must not appear in the public README.

## Docs

`docs/ai-assistants.md` — creator-facing guide for building and uploading AI-generated game projects. Covers the required build step, what a valid ZIP looks like, and a Google AI Studio callout.

## Branch flow

- `develop` — default branch. Feature branches fork from `develop` and PRs target `develop` (squash merge).
- `master` — mirrors the currently-published state of the npm package. Updated by fast-forwarding `develop` → `master` after a release, same pattern as the other Minit-Games sub-repos (see `../CLAUDE.md`).

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
