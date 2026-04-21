export function getUserData(): string | undefined {
    if (typeof window === "undefined") return undefined;
    return window.minit?.userData;
}
