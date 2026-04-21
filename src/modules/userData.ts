
export function getUserData(): string | undefined {
    if (typeof window === "undefined") return undefined;
    const minit = (window as unknown as { minit?: { userData?: string } }).minit;
    return minit?.userData;
}
