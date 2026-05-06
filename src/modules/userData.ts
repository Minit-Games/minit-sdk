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
 * Reserved URL-param namespace for the userData local-dev fallback.
 * Keys that start with this prefix are read by {@link getUserDataFromUrlParams} and
 * filtered out of `getConfig()` / `getConfigValue()` so the two namespaces stay distinct.
 *
 * Exported so `config.ts` can import it — not re-exported from the package entry point.
 */
export const USER_DATA_PARAM_PREFIX = "userData.";

/**
 * Reads a single `?userData.<key>=<value>` entry from the current URL search string and
 * returns its value, or `undefined` if not present.
 *
 * Same-key-twice semantics: first occurrence wins, via `URLSearchParams.get()`.
 * Empty key after the prefix (`userData.=value`) is ignored — guarded by the explicit
 * `key === ""` check below.
 *
 * Only called from {@link getUserData}, which already guards against `window` being
 * undefined — this function can therefore assume a browser environment.
 */
function getUserDataFromUrlParams(key: string): string | undefined {
    // An empty key would match `?userData.=value`, which we intentionally ignore.
    if (key === "") return undefined;

    const value = new URLSearchParams(window.location.search).get(USER_DATA_PARAM_PREFIX + key);
    // URLSearchParams.get returns null when absent; normalise to undefined.
    return value !== null ? value : undefined;
}
