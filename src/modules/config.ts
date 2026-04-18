
export function getDropConfig(): Record<string, string> {
    const urlParams = new URLSearchParams(window.location.search);
    const config: Record<string, string> = {};
    urlParams.forEach((value, key) => {
        config[key] = value;
    });
    return config;
}

export function getDropConfigValue(key: string): string | undefined;
export function getDropConfigValue(
  key: string,
  defaultValue: string | (() => string)
): string;
export function getDropConfigValue(
  key: string,
  defaultValue?: string | (() => string)
): string | undefined {
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
