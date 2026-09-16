
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
    dropConfig: Record<string, string>,
    // Both spellings, deliberately: both hosts now also inject the same
    // object under `config` (the app originally injected only `config`,
    // while the web runtime and this type declared only `dropConfig` —
    // DROP-8886 aligned both hosts to expose both). Optional here so an
    // older host snapshot or a minimal test double built against just
    // `dropConfig` still satisfies this type.
    config?: Record<string, string>,
    userData?: string,

    reportResult: (result: number|string, options?: HostResultOptions) => void,
    loadingDone: () => void,

    // Optional — mobile-app-host only (injected by preLoad.ts's window.minit;
    // absent from the web runtime's window.minit, and from older mobile
    // hosts). See src/modules/viewability.ts for the local-dev / host-absent
    // fallback that covers their absence.
    isViewable?: () => boolean,
    addEventListener?: (event: "viewableChange", fn: (viewable: boolean) => void) => void,
    removeEventListener?: (event: "viewableChange", fn: (viewable: boolean) => void) => void,
}
