import { USER_DATA_PARAM_PREFIX } from "./userData";

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
