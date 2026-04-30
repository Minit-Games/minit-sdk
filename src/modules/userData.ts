/**
 * Returns the value stored under `key` in the per-creator userData record.
 *
 * The host injects `window.minit.userData` as a pre-parsed `Record<string, string>`.
 * This function reads it directly — no JSON parsing is performed in the SDK.
 *
 * Returns `undefined` when:
 * - Running outside a browser (SSR / test environment without `window`).
 * - `window.minit` or `window.minit.userData` is absent or `null`.
 * - `window.minit.userData` is not a non-null, non-array object (host bug — e.g. a
 *   legacy JSON string or an array injected by a misconfigured host).
 * - The key is not present in the record.
 * - The value at `key` is not a string (host bug — non-string values are silently dropped).
 *
 * Returns `""` if the stored value at `key` is the empty string (distinct from
 * `undefined`).
 */
export function getUserData(key: string): string | undefined {
    if (typeof window === "undefined") return undefined;

    const record = window.minit?.userData;
    if (record == null) return undefined;
    if (typeof record !== "object" || Array.isArray(record)) return undefined;

    if (!Object.prototype.hasOwnProperty.call(record, key)) return undefined;

    const v = record[key];
    return typeof v === "string" ? v : undefined;
}
