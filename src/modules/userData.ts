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
 * - The value at `key` is `null` — treated identically to "key absent", so
 *   callers can reliably detect "unset" via `=== undefined`.
 *
 * Returns `""` if the stored value at `key` is the empty string (distinct from
 * `undefined`).  Non-null, non-string values at a key (from legacy hand-crafted
 * blobs) are coerced via `String()` so callers always receive a string.
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
    if (!Object.prototype.hasOwnProperty.call(obj, key)) return undefined;

    const value = obj[key];
    // Treat null the same as absent — callers detect "unset" via === undefined.
    if (value === null) return undefined;
    // Coerce other non-string values (legacy / hand-crafted blobs) rather than returning undefined.
    return typeof value === "string" ? value : String(value);
}
