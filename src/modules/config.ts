
// URL params whose keys start with this prefix are reserved for the userData local-dev
// fallback (see userData.ts). They must not appear in getConfig() / getConfigValue()
// results so that config and userData namespaces remain distinct.
const USER_DATA_PARAM_PREFIX = "userData.";

export function getConfig(): Record<string, string> {
    const urlParams = new URLSearchParams(window.location.search);
    const config: Record<string, string> = {};
    urlParams.forEach((value, key) => {
        if (key.startsWith(USER_DATA_PARAM_PREFIX)) return;
        config[key] = value;
    });
    return config;
}

export function getConfigValue(key: string): string | undefined;
export function getConfigValue(
  key: string,
  defaultValue: string | (() => string)
): string;
export function getConfigValue(
  key: string,
  defaultValue?: string | (() => string)
): string | undefined {
  // userData.* keys are reserved — never expose them through getConfigValue.
  if (key.startsWith(USER_DATA_PARAM_PREFIX)) {
    if (defaultValue === undefined) return undefined;
    return typeof defaultValue === 'function' ? defaultValue() : defaultValue;
  }

  const urlParams = new URLSearchParams(window.location.search);

  const value = urlParams.get(key);
  if (value !== null) {
    return value;
  }

  if (defaultValue === undefined) {
    return undefined;
  }

  return typeof defaultValue === 'function'
    ? defaultValue()
    : defaultValue;
}

// Backward-compat aliases
export const getDropConfig = getConfig;
export { getConfigValue as getDropConfigValue };
