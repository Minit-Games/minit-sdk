import { browserWindow } from "../utils.js";
import { recordConfigRequest } from "./trackDevBuffer.js";
import { USER_DATA_PARAM_KEY } from "./userData.js";

export const HAS_PLAYED_GAME_PARAM_KEY = "hasPlayedGame";

const RESERVED_PARAM_KEYS = new Set([USER_DATA_PARAM_KEY, HAS_PLAYED_GAME_PARAM_KEY]);

export function getConfig(): Record<string, string> {
    const config = readInjectedConfig();
    for (const [key, value] of Object.entries(config)) {
        recordConfigRequest({ key, value, source: "injected" });
    }
    return config;
}

export function readInjectedConfig(): Record<string, string> {
    const urlParams = new URLSearchParams(browserWindow().location.search);
    const config: Record<string, string> = {};
    urlParams.forEach((value, key) => {
        if (RESERVED_PARAM_KEYS.has(key)) return;
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
  // Host-flag fallbacks are reserved — never expose them through getConfigValue.
  if (RESERVED_PARAM_KEYS.has(key)) {
    if (defaultValue === undefined) return undefined;
    return typeof defaultValue === 'function' ? defaultValue() : defaultValue;
  }

  const urlParams = new URLSearchParams(browserWindow().location.search);

  const value = urlParams.get(key);
  if (value !== null) {
    recordConfigRequest({ key, value, source: "injected" });
    return value;
  }

  if (defaultValue === undefined) {
    recordConfigRequest({ key, value: undefined, source: "missing" });
    return undefined;
  }

  const resolved = typeof defaultValue === 'function'
    ? defaultValue()
    : defaultValue;
  recordConfigRequest({ key, value: resolved, source: "default" });
  return resolved;
}

// Backward-compat aliases
export const getDropConfig = getConfig;
export { getConfigValue as getDropConfigValue };
