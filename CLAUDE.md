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

## Persistent user data (keyed API, shipped in v1.0.9)

The per-creator userData record is shared across all of a creator's games and stored as an opaque string on the backend. The SDK owns the JSON serialisation — the backend never inspects the content.

**Wire format:** the backend stores and returns a single string. Internally the SDK serialises a `Record<string, string>` map to that string. The 4 KB cap applies to the serialised blob; exceeding it returns `400 { "message": "USER_DATA_TOO_LARGE" }`.

### Reading

`getUserData(key: string): string | undefined` — looks up `key` in the parsed blob.

Returns `undefined` when: no record exists for this player; the stored string is not valid JSON; the top-level value is not a plain object; or `key` is absent from the object. Returns `""` if the stored value at `key` is the empty string (distinct from `undefined`). Non-string values at a key (from legacy hand-crafted blobs) are coerced via `String()`.

### Writing

`reportResult(result, { userData?: Record<string, string> })` — pass a partial-patch map. The SDK merges it into the in-memory blob (accumulated since the module was loaded), then serialises and forwards the full merged blob to the host. Omitting `userData` (or passing `{}`) leaves the stored value unchanged — the host payload will not include a `userData` field.

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
