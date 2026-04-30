
export type ResultOptions = {
    flavorText?: string,
    delay?: number,
    // Single-key write: store one key/value pair in the player's userData.
    // Omit to leave the stored value unchanged.
    userData?: { key: string; value: string },
}

// Backward-compat alias
export type DropResultOptions = ResultOptions;

// Wire format sent to the host: userData is forwarded as-is (single-key object).
// Derived from ResultOptions so new fields automatically propagate here too.
export type HostResultOptions = Omit<ResultOptions, 'userData'> & {
    userData?: { key: string; value: string };
};

export type MinitApi = {
    environment: "app" | "web",
    sdkVersion: string,
    dropConfig: Record<string, string>,
    userData?: Record<string, string>,

    reportResult: (result: number|string, options?: HostResultOptions) => void,
    loadingDone: () => void,
}
