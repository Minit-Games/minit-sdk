
export type ResultOptions = {
    /**
     * Short session caption for the host result screen and activity feed.
     * Highlight one interesting stat or moment from the run (best combo, funny mistake,
     * close call) — not the score itself or generic confirmation copy. Track session
     * stats during gameplay and pick the most memorable at game end.
     */
    flavorText?: string,
    delay?: number,
    // Single-slot write: store a string value in the player's userData slot.
    // Omit to leave the stored value unchanged.
    userData?: string,
}

// Backward-compat alias
export type DropResultOptions = ResultOptions;

// Wire format sent to the host: userData is wrapped into { value: string }
// matching UserDataPatchSchema in @minit/shared/zod.
// Derived from ResultOptions so new fields automatically propagate here too.
export type HostResultOptions = Omit<ResultOptions, 'userData'> & {
    userData?: { value: string };
};

export type MinitApi = {
    environment: "app" | "web",
    sdkVersion: string,
    dropConfig: Record<string, string>,
    userData?: string,

    reportResult: (result: number|string, options?: HostResultOptions) => void,
    loadingDone: () => void,
}
