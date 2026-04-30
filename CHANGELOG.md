# Changelog

All notable changes to `@minit-games/sdk` are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.0] — 2026-04-30

### Breaking Changes

- **`reportResult` userData shape changed.** The `userData` option previously accepted a `Record<string, string>` multi-key patch map. It now accepts a single key/value object `{ key: string; value: string }`. Each call writes exactly one key in the player's record; keys not referenced in the call are left untouched.

  ```ts
  // Before (1.1.x) — multi-key patch, NO LONGER VALID
  reportResult(score, { userData: { level: '3', coins: '42' } });

  // After (1.2.0) — single key per call
  reportResult(score, { userData: { key: 'level', value: '3' } });
  ```

  Invalid shapes (non-object, array, empty `key` string, non-string `value`) are silently dropped — no `userData` field is forwarded to the host.

- **`getUserData` reads from a pre-parsed host object.** `window.minit.userData` is now injected by the host as a `Record<string, string>` plain object. The SDK no longer calls `JSON.parse` on a serialised string — it reads the key directly. Game code that previously relied on parsing behaviour will continue to work as long as the host (app) is updated to inject the parsed shape.

  - Returns `""` when the stored value for the key is the empty string — this is distinct from `undefined` ("absent").
  - Returns `undefined` when `window.minit.userData` is absent, when the key is not present, or when running outside a browser.

---

## [1.1.0]

Initial keyed userData API — superseded by 1.2.0.
