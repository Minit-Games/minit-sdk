export type TrackDropReason =
    | "invalid-key"
    | "reserved-key"
    | "invalid-props"
    | "too-many-props"
    | "invalid-prop-key"
    | "invalid-prop-value"
    | "too-large"
    | "rate"
    | "load-cap"
    | "bytes-cap"
    | "after-result";

export type TrackedEntry =
    | { kind: "event"; key: string; props: Record<string, boolean | number | string>; bytes?: number; t: number }
    | { kind: "drop"; key: string; reason: TrackDropReason; t: number };

export interface TrackedUsage {
    bytes: number;
    bytesCapDrops: number;
}

type Listener = (entry: TrackedEntry) => void;

export const MAX_DEV_ENTRIES = 500;

const entries: TrackedEntry[] = [];
const listeners = new Set<Listener>();
const usage: TrackedUsage = { bytes: 0, bytesCapDrops: 0 };
const receivedByKey = new Map<string, number>();

export interface ReportedResult {
    result: number | string;
    flavorText?: string;
    durationMs: number;
}

let playStartedAt: number | undefined;
let reportedResult: ReportedResult | undefined;
const resultListeners = new Set<(result: ReportedResult) => void>();

export function markPlayStarted(): void {
    playStartedAt = performance.now();
}

export function getPlayDurationMs(): number {
    return Math.round(performance.now() - (playStartedAt ?? 0));
}

export function getReportedResult(): ReportedResult | undefined {
    return reportedResult;
}

export function subscribeReportedResult(listener: (result: ReportedResult) => void): void {
    resultListeners.add(listener);
}

export function recordReportedResult(result: ReportedResult): void {
    reportedResult = result;
    for (const listener of resultListeners) {
        try {
            listener(result);
        } catch {
            // A broken listener must not make reportResult() throw.
        }
    }
}

export function getTrackedEntries(): readonly TrackedEntry[] {
    return entries;
}

export function getTrackedUsage(): Readonly<TrackedUsage> {
    return usage;
}

export function getReceivedCount(key: string): number {
    return receivedByKey.get(key) ?? 0;
}

export function subscribeTrackedEntries(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function recordTrackedEvent(key: string, props: Record<string, boolean | number | string>, bytes?: number): void {
    usage.bytes += bytes ?? 0;
    receivedByKey.set(key, getReceivedCount(key) + 1);
    append({ kind: "event", key, props: { ...props }, bytes, t: Math.round(performance.now()) });
}

export function recordTrackedDrop(key: string, reason: TrackDropReason): void {
    if (reason === "bytes-cap") {
        usage.bytesCapDrops++;
    }
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
