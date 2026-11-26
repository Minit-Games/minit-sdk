export type TrackDropReason =
    | "invalid-key"
    | "reserved-key"
    | "invalid-props"
    | "invalid-prop-key"
    | "invalid-prop-value"
    | "budget"
    | "after-result"
    | "invalid_key"
    | "reserved_key"
    | "invalid_props"
    | "after_result";

export type TrackedEntry =
    | { kind: "event"; key: string; props: Record<string, boolean | number | string>; bytes?: number; t: number }
    | { kind: "drop"; key: string; reason: TrackDropReason; t: number };

export interface TrackedUsage {
    bytes: number;
    budgetDrops: number;
}

type Listener = (entry: TrackedEntry) => void;

export const MAX_DEV_ENTRIES = 500;

const entries: TrackedEntry[] = [];
const listeners = new Set<Listener>();
const usage: TrackedUsage = { bytes: 0, budgetDrops: 0 };
const receivedByKey = new Map<string, number>();

export interface ReportedResult {
    result: number | string;
    stars: number;
    flavorText?: string;
    userData?: string;
    durationMs: number;
}

export type ConfigSource = "injected" | "default" | "missing";

export interface ConfigRequest {
    key: string;
    value: string | undefined;
    source: ConfigSource;
}

const configRequests = new Map<string, ConfigRequest>();
const configListeners = new Set<(requests: readonly ConfigRequest[]) => void>();

export function recordConfigRequest(request: ConfigRequest): void {
    const previous = configRequests.get(request.key);
    if (previous && previous.value === request.value && previous.source === request.source) {
        return;
    }
    configRequests.set(request.key, request);
    const requests = getConfigRequests();
    for (const listener of configListeners) {
        try {
            listener(requests);
        } catch {
            // A broken listener must not make a config read throw.
        }
    }
}

export function getConfigRequests(): readonly ConfigRequest[] {
    return [...configRequests.values()];
}

export function subscribeConfigRequests(listener: (requests: readonly ConfigRequest[]) => void): void {
    configListeners.add(listener);
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

export interface PendingResult {
    reportedAt: number;
    delayMs: number;
}

let pendingResult: PendingResult | undefined;
const pendingListeners = new Set<(pending: PendingResult) => void>();

export function recordResultPending(delayMs: number): void {
    pendingResult = { reportedAt: performance.now(), delayMs };
    for (const listener of pendingListeners) {
        try {
            listener(pendingResult);
        } catch {
            // A broken listener must not make reportResult() throw.
        }
    }
}

export function getPendingResult(): PendingResult | undefined {
    return pendingResult;
}

export function subscribePendingResult(listener: (pending: PendingResult) => void): void {
    pendingListeners.add(listener);
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

export function recordTrackedEvent(
    key: string,
    props: Record<string, boolean | number | string>,
    bytes?: number,
    t = Math.round(performance.now()),
): void {
    usage.bytes += bytes ?? 0;
    receivedByKey.set(key, getReceivedCount(key) + 1);
    append({ kind: "event", key, props: { ...props }, bytes, t });
}

export function recordTrackedDrop(key: string, reason: TrackDropReason): void {
    if (reason === "budget") {
        usage.budgetDrops++;
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
