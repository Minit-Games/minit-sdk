/**
 * Returns the value stored under `key` in the per-creator userData blob.
 *
 * The host injects `window.minit.userData` as an opaque JSON string whose
 * top-level shape is `Record<string, string>`.  This function parses that
 * string and returns the value at the requested key.
 *
 * Returns `undefined` when:
 * - Running outside a browser (SSR / test environment without `window`).
 * - `window.minit` or `window.minit.userData` is absent.
 * - The stored string is not valid JSON.
 * - The parsed JSON is not a plain object (e.g. `null`, array, or primitive).
 * - The key is not present in the object.
 *
 * If the value stored at `key` is not a string (shouldn't happen with v2 SDK
 * data, but possible with legacy hand-crafted blobs), it is coerced via
 * `String(value)` so callers always receive a string rather than crashing.
 */
export function getUserData(key: string): string | undefined {
    if (typeof window === "undefined") return undefined;

    const raw = window.minit?.userData;
    if (raw === undefined) return undefined;

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return undefined;
    }

    // Must be a plain object — reject null, arrays, and primitives.
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        return undefined;
    }

    const obj = parsed as Record<string, unknown>;
    if (!(key in obj)) return undefined;

    const value = obj[key];
    // Coerce non-string values (legacy / hand-crafted blobs) rather than returning undefined.
    return typeof value === "string" ? value : String(value);
}
