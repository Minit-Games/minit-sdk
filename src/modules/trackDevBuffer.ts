export type TrackDropReason =
    | "invalid-key"
    | "reserved-key"
    | "invalid-props"
    | "too-many-props"
    | "invalid-prop-key"
    | "invalid-prop-value"
    | "too-large"
    | "rate"
    | "load-cap";

export type TrackedEntry =
    | { kind: "event"; key: string; props: Record<string, boolean | number | string>; t: number }
    | { kind: "drop"; key: string; reason: TrackDropReason; t: number };

export function getTrackedEntries(): readonly TrackedEntry[] {
    return [];
}

export function subscribeTrackedEntries(listener: (entry: TrackedEntry) => void): () => void {
    void listener;
    return () => {};
}
