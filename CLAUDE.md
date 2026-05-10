# CLAUDE.md — minit-sdk

Internal ops reference for the `@minit-games/sdk` package. Public npm package; GitHub repo: `Minit-Games/minit-sdk`.

## Commands

```bash
npm install        # Install dependencies
npm run check      # TypeScript type check (tsc --noEmit)
npm run build      # Compile to dist/ (ESM + .d.ts)
```

## Entry Points

| Import path | Description |
|---|---|
| `@minit-games/sdk` | Core SDK — `initializeSDK`, `reportResult`, `getUserData`, `getConfigValue`, `loadingDone`, etc. |
| `@minit-games/sdk/ui` | UI helpers |

## Persistent user data (single-slot API, updated in v1.3.0)

The per-creator userData slot is shared across all of a creator's games. The host (app) owns serialization and transport — `window.minit.userData` is injected as a primitive `string | undefined`; the SDK never calls `JSON.parse` on it.

### Reading

`getUserData(): string | undefined` — reads `window.minit.userData` directly. No key argument. Falls back to the `?userData=<value>` URL param when `window.minit.userData` is `undefined` or `null` (local-dev convenience — any host-injected string, including `""`, wins over the URL param).

Returns `undefined` when: no value is stored for this player; `window.minit.userData` is absent and the `?userData` URL param is also absent. Returns `""` if the stored value is the empty string (distinct from `undefined`).

`userData` is a reserved URL-param key — it is stripped from `getConfig()`/`getConfigValue()` so it never bleeds into the config API. Only the exact key `userData` is reserved (keys like `userData2` are unaffected).

### Writing

`reportResult(result, { userData?: string })` — pass a plain string to store. An empty string `""` is a valid write. Omitting `userData` (or not passing `options`) leaves the stored value unchanged — the host payload will not include a `userData` field.

## Branch flow

- `develop` — default branch. Feature branches fork from `develop` and PRs target `develop` (squash merge).
- `master` — mirrors the currently-published state of the npm package. Updated by fast-forwarding `develop` → `master` after a release, same pattern as the other Minit-Games sub-repos (see `../CLAUDE.md`).

## Release Process

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
