/**
 * Returns the value stored under `key` in the per-creator userData record.
 *
 * The host injects `window.minit.userData` as a pre-parsed `Record<string, string>`.
 * This function reads it directly — no JSON parsing is performed in the SDK.
 *
 * **Local-dev fallback:** when `window.minit.userData` is `undefined` or `null` (i.e. no
 * host has injected it), the SDK falls back to URL params of the form
 * `?userData.<key>=<value>`. This lets creators test userData locally during `npm run dev`
 * without a host app. An injected empty record `{}` still wins over URL params — it means
 * "host says this player has no stored data".
 *
 * Returns `undefined` when:
 * - Running outside a browser (SSR / test environment without `window`).
 * - `window.minit` or `window.minit.userData` is absent or `null` AND the key is not
 *   present in the URL params.
 * - `window.minit.userData` is not a non-null, non-array object (host bug — e.g. a
 *   legacy JSON string or an array injected by a misconfigured host).
 * - The key is not present in the record (or URL params when falling back).
 * - The value at `key` is not a string (host bug — non-string values are silently dropped).
 *
 * Returns `""` if the stored value at `key` is the empty string (distinct from
 * `undefined`).
 */
export function getUserData(key: string): string | undefined {
    if (typeof window === "undefined") return undefined;

    const record = window.minit?.userData;

    // Only fall back to URL params when the host has NOT injected userData at all.
    // null and undefined both mean "no injection"; any other value (even {}) means
    // the host owns the record, so we go through the standard path below.
    if (record == null) {
        return getUserDataFromUrlParams(key);
    }

    if (typeof record !== "object" || Array.isArray(record)) return undefined;

    if (!Object.prototype.hasOwnProperty.call(record, key)) return undefined;

    const v = record[key];
    return typeof v === "string" ? v : undefined;
}

/**
 * Parses `?userData.<key>=<value>` entries from the current URL search string and
 * returns the value for `key`, or `undefined` if not present.
 *
 * Uses `Object.create(null)` internally so prototype-chain keys (e.g. `toString`,
 * `constructor`) cannot pollute the result — mirroring the `hasOwnProperty` guard used
 * for the host-injected record.
 *
 * Same-key-twice semantics: first occurrence wins, matching `URLSearchParams.get()`.
 * Empty key after the prefix (`userData.=value`) is ignored.
 */
function getUserDataFromUrlParams(key: string): string | undefined {
    // SSR guard: window.location may not exist in non-browser environments.
    if (typeof window === "undefined" || typeof window.location === "undefined") {
        return undefined;
    }

    const PREFIX = "userData.";
    const urlParams = new URLSearchParams(window.location.search);

    // Build a null-prototype map so prototype-chain keys cannot leak through.
    const parsed: Record<string, string> = Object.create(null) as Record<string, string>;

    urlParams.forEach((value, rawKey) => {
        if (!rawKey.startsWith(PREFIX)) return;
        const udKey = rawKey.slice(PREFIX.length);
        // Skip entries with an empty key after the prefix.
        if (udKey === "") return;
        // First occurrence wins — only set if not already present.
        if (!Object.prototype.hasOwnProperty.call(parsed, udKey)) {
            parsed[udKey] = value;
        }
    });

    if (!Object.prototype.hasOwnProperty.call(parsed, key)) return undefined;
    return parsed[key];
}
