
export type ResultOptions = {
    flavorText?: string,
    delay?: number,
    userData?: string,
}

// Backward-compat alias
export type DropResultOptions = ResultOptions;

export type MinitApi = {
    environment: "app" | "web",
    sdkVersion: string,
    dropConfig: Record<string, string>,
    userData?: string,

    reportResult: (result: number|string, options?: ResultOptions) => void,
    loadingDone: () => void,
}
