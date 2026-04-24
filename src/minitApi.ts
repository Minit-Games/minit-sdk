
export type ResultOptions = {
    flavorText?: string,
    delay?: number,
    // Partial patch: keys present in the map are merged into the stored blob.
    // Omit to leave the stored blob unchanged.
    userData?: Record<string, string>,
}

// Backward-compat alias
export type DropResultOptions = ResultOptions;

// Wire format sent to the host: userData is serialised to a JSON string by the SDK.
export type HostResultOptions = {
    flavorText?: string,
    delay?: number,
    userData?: string,
}

export type MinitApi = {
    environment: "app" | "web",
    sdkVersion: string,
    dropConfig: Record<string, string>,
    userData?: string,

    reportResult: (result: number|string, options?: HostResultOptions) => void,
    loadingDone: () => void,
}
