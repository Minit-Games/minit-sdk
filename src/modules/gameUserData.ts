/**
 * Convenience helpers for namespaced per-game user data.
 *
 * The per-creator userData blob is shared across all games from the same creator.
 * These helpers use `window.minit.baseDropId` (injected by the host app in v1.0.8+)
 * as the namespace key so individual games don't accidentally overwrite each other.
 */

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
 * Read the current game's slice of the shared userData blob.
 *
 * Returns `undefined` when:
 * - Running outside a browser (SSR/test)
 * - `window.minit.baseDropId` is not set — this happens with older host app versions
 *   that pre-date DROP-930. Returning `undefined` rather than throwing keeps games
 *   forward-compatible: they can fall back to `getUserData()` or start fresh.
 * - No userData is stored yet
 * - The stored value is not a plain JSON object
 * - The key for this game is absent from the object
 */
export function getGameUserData<T = unknown>(): T | undefined {
    if (typeof window === "undefined") return undefined;
    const baseDropId = window.minit?.baseDropId;
    // Old app versions don't inject baseDropId — return undefined so callers can
    // degrade gracefully instead of crashing.
    if (!baseDropId) return undefined;

    const obj = parseUserDataObject();
    if (obj === null) return undefined;
    if (!(baseDropId in obj)) return undefined;
    return obj[baseDropId] as T;
}

/**
 * Write the current game's slice of the shared userData blob and return the
 * serialized string to pass to `reportResult`.
 *
 * Throws if `window.minit.baseDropId` is unavailable — this indicates the host
 * app is too old to support namespaced user data. Throwing is intentional: it
 * surfaces the problem clearly during development rather than silently losing data.
 *
 * Usage:
 * ```ts
 * reportResult(score, { userData: patchGameUserData(gameState) })
 * ```
 */
export function patchGameUserData<T>(value: T): string {
    const baseDropId = window.minit?.baseDropId;
    if (!baseDropId) {
        throw new Error(
            "patchGameUserData: window.minit.baseDropId is not available — is the host app recent enough?"
        );
    }

    const obj = parseUserDataObject() ?? {};
    obj[baseDropId] = value;
    return JSON.stringify(obj);
}
