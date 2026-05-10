
export type ResultOptions = {
    flavorText?: string,
    delay?: number,
    // Single-slot write: store a string value in the player's userData slot.
    // Omit to leave the stored value unchanged.
    userData?: string,
}

// Backward-compat alias
export type DropResultOptions = ResultOptions;

// Wire format sent to the host: userData is forwarded as a string.
// Derived from ResultOptions so new fields automatically propagate here too.
export type HostResultOptions = Omit<ResultOptions, 'userData'> & {
    userData?: string;
};

export type MinitApi = {
    environment: "app" | "web",
    sdkVersion: string,
    dropConfig: Record<string, string>,
    userData?: string,

    reportResult: (result: number|string, options?: HostResultOptions) => void,
    loadingDone: () => void,
}
