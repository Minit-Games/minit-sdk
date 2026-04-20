
export type ResultOptions = {
    flavorText?: string,
    delay?: number,
}

// Backward-compat alias
export type DropResultOptions = ResultOptions;

export type MinitApi = {
    environment: "app" | "web",
    sdkVersion: string,
    dropConfig: Record<string, string>,

    reportResult: (result: number|string, options?: ResultOptions) => void,
    loadingDone: () => void,
}
