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

type Listener = (entry: TrackedEntry) => void;

export const MAX_DEV_ENTRIES = 500;

const entries: TrackedEntry[] = [];
const listeners = new Set<Listener>();

export function getTrackedEntries(): readonly TrackedEntry[] {
    return entries;
}

export function subscribeTrackedEntries(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function recordTrackedEvent(key: string, props: Record<string, boolean | number | string>): void {
    append({ kind: "event", key, props: { ...props }, t:Math.round(performance.now()) });
}

export function recordTrackedDrop(key: string, reason: TrackDropReason): void {
    append({ kind: "drop", key, reason, t: Math.round(performance.now()) });
}

function append(entry: TrackedEntry): void {
    entries.push(entry);
    if (entries.length > MAX_DEV_ENTRIES) {
        entries.shift();
    }
    for (const listener of listeners) {
        try {
            listener(entry);
        } catch {
            // A broken listener must not make track() throw.
        }
    }
}
