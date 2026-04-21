/**
 * Scoped convenience helpers for per-game or creator-wide user data.
 *
 * The per-creator userData blob is shared across all games from the same creator.
 * These helpers use `window.minit.baseDropId` as the `'game'` namespace key, and
 * the reserved key `"__global__"` for the `'global'` scope — a literal string that
 * cannot collide with any UUID-shaped baseDropId.
 *
 * Blob shape (internal — not part of the public contract):
 * ```json
 * {
 *   "<baseDropId>": { ...per-game state... },
 *   "__global__": { ...creator-wide state... }
 * }
 * ```
 */

const GLOBAL_KEY = "__global__";

/** Parse userData safely; returns a plain object or null on any failure. */
function parseUserDataObject(): Record<string, unknown> | null {
    const raw = window.minit?.userData;
    if (raw === undefined) return null;
    try {
        const parsed: unknown = JSON.parse(raw);
        if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
        }
    } catch {
        // parse failure — treat as absent
    }
    return null;
}

/**
 * Read a scoped slice of the shared userData blob.
 *
 * - `scope === 'game'` (default) — reads the slot keyed by `window.minit.baseDropId`.
 *   This is the per-title namespace; different games by the same creator don't interfere.
 * - `scope === 'global'` — reads the reserved `"__global__"` slot, shared across all
 *   your games (e.g. preferences, cross-game unlocks).
 *
 * Returns `undefined` when:
 * - Running outside a browser (SSR / test environment)
 * - `scope === 'game'` and `window.minit.baseDropId` is absent (old host app — degrade gracefully)
 * - No userData stored yet, blob not parseable, or the key is absent
 */
export function getScopedData<T = unknown>(scope: "game" | "global" = "game"): T | undefined {
    if (typeof window === "undefined") return undefined;

    let key: string;
    if (scope === "global") {
        key = GLOBAL_KEY;
    } else {
        const baseDropId = window.minit?.baseDropId;
        // Old app versions don't inject baseDropId — return undefined so callers can
        // degrade gracefully instead of crashing.
        if (!baseDropId) return undefined;
        key = baseDropId;
    }

    const obj = parseUserDataObject();
    if (obj === null) return undefined;
    if (!(key in obj)) return undefined;
    return obj[key] as T;
}

/**
 * Write a scoped slice of the shared userData blob and return the serialized string
 * to pass to `reportResult`.
 *
 * - `scope === 'game'` (default) — writes to the slot keyed by `window.minit.baseDropId`.
 *   **Throws** if `baseDropId` is unavailable — the host app is too old; surfaces the
 *   problem during development rather than silently losing data.
 * - `scope === 'global'` — writes to the reserved `"__global__"` key; always works
 *   regardless of host app version.
 *
 * Current blob parse failures are treated as `{}` — existing data is not required.
 *
 * Usage:
 * ```ts
 * reportResult(score, { userData: patchScopedData(gameState) })
 * reportResult(score, { userData: patchScopedData(prefs, 'global') })
 * ```
 */
export function patchScopedData<T>(value: T, scope: "game" | "global" = "game"): string {
    if (typeof window === "undefined") {
        throw new Error("patchScopedData: not running in a browser context");
    }
    let key: string;
    if (scope === "global") {
        key = GLOBAL_KEY;
    } else {
        const baseDropId = window.minit?.baseDropId;
        if (!baseDropId) {
            throw new Error(
                "patchScopedData: window.minit.baseDropId is not available — is the host app recent enough?"
            );
        }
        key = baseDropId;
    }

    const obj = parseUserDataObject() ?? {};
    obj[key] = value;
    return JSON.stringify(obj);
}
