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

## Persistent user data (DROP-910, shipped in v1.0.7)

`getUserData(): string | undefined` — returns the per-creator blob injected by the host app. `undefined` = no record; `""` = explicitly stored empty (distinct from `undefined`).

`reportResult(result, { userData?: string })` — write path: pass the blob alongside the result and the app+backend will persist it. Omit to leave the stored value unchanged. Cap: 4096 UTF-8 bytes. Exceeding the cap returns `400 { "message": "USER_DATA_TOO_LARGE" }`.

The record is keyed by `(userId, creatorId)` — shared across all games by that creator and across mods. Creators with multiple games should namespace with JSON (e.g. `{"gameA": {...}}`). Convenience helpers coming in DROP-930.

## Release Process

1. Bump the version and create a git tag:
   ```bash
   npm version patch   # or minor / major
   ```
2. Push the commit and tag:
   ```bash
   git push
   git push --tags
   ```
3. GitHub Actions (`publish.yml`) detects the `v*.*.*` tag and runs `npm publish` automatically with npm provenance.
4. Verify the release at: https://www.npmjs.com/package/@minit-games/sdk

> Publishing uses npm Trusted Publishing (OIDC) — no token secret required. The trusted publisher is configured at npmjs.com under the package's Settings → Trusted publishing, pointing at `Minit-Games/minit-sdk` + workflow `publish.yml`.
