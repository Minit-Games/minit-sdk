import { callApiFunction, isTestEnvironment } from "../utils.js";
import { getTrackedUsage, recordTrackedDrop, recordTrackedEvent } from "./trackDevBuffer.js";
import type { TrackDropReason } from "./trackDevBuffer.js";
import { showTrackDevPanel } from "./trackDevPanelLoader.js";
import { PLAY_BUDGET_BYTES, RESERVED_KEY_PREFIX } from "./trackLimits.js";

export type TrackProperties = Record<string, boolean | number | string>;

const warnedReasons = new Set<TrackDropReason>();
let resultReported = false;

export function closeTrackingAfterResult(): void {
    resultReported = true;
}

/**
 * Records a custom gameplay event for the creator's analytics. Invalid calls, events over the
 * 4 KB budget per play, and any call after `reportResult()` are dropped with a console warning;
 * it never throws.
 *
 * @param key Any non-empty string; the `minit.` prefix is reserved.
 * @param properties Properties with non-empty names and boolean, finite number or string values.
 */
export function track(key: string, properties?: TrackProperties): void {
    if (resultReported) {
        drop(key, "after-result");
        return;
    }
    const result = validate(key, properties);
    if ("reason" in result) {
        drop(key, result.reason);
        return;
    }
    const { props } = result;

    if (isTestEnvironment()) {
        const t = Math.round(performance.now());
        const bytes = new TextEncoder().encode(JSON.stringify([key, props, t])).length;
        if (getTrackedUsage().bytes + bytes > PLAY_BUDGET_BYTES) {
            drop(key, "budget");
            return;
        }
        recordTrackedEvent(key, props, bytes, t);
        showTrackDevPanel();
    }

    const message = () => `track => ${key}\nProps: ${JSON.stringify(props)}`;
    callApiFunction(() => {
        if (typeof window.minit?.track !== "function") {
            console.log("[MinitSDK]", message());
            return;
        }
        try {
            window.minit.track(key, props);
        } catch {
            // A host failure must never break the game.
        }
    }, message);
}

function validate(
    key: unknown,
    properties: unknown,
): { props: TrackProperties } | { reason: TrackDropReason } {
    if (typeof key !== "string" || key === "") {
        return { reason: "invalid-key" };
    }
    if (key.startsWith(RESERVED_KEY_PREFIX)) {
        return { reason: "reserved-key" };
    }
    const entries = properties === undefined ? [] : snapshotEntries(properties);
    if (!entries) {
        return { reason: "invalid-props" };
    }
    for (const [propKey, value] of entries) {
        if (propKey === "") {
            return { reason: "invalid-prop-key" };
        }
        if (!isValidValue(value)) {
            return { reason: "invalid-prop-value" };
        }
    }
    return { props: Object.fromEntries(entries) as TrackProperties };
}

function snapshotEntries(properties: unknown): [string, unknown][] | undefined {
    try {
        if (typeof properties !== "object" || properties === null) {
            return undefined;
        }
        const prototype = Object.getPrototypeOf(properties);
        if (prototype !== Object.prototype && prototype !== null) {
            return undefined;
        }
        return Object.entries(properties);
    } catch {
        return undefined;
    }
}

function isValidValue(value: unknown): boolean {
    switch (typeof value) {
        case "boolean":
        case "string":
            return true;
        case "number":
            return Number.isFinite(value);
        default:
            return false;
    }
}

function drop(key: unknown, reason: TrackDropReason): void {
    if (!warnedReasons.has(reason)) {
        warnedReasons.add(reason);
        console.warn(`[Minit] track dropped: ${reason}`);
    }
    if (isTestEnvironment()) {
        recordTrackedDrop(keyLabel(key), reason);
        showTrackDevPanel();
    }
}

function keyLabel(key: unknown): string {
    if (typeof key === "string") {
        return key;
    }
    try {
        return String(key);
    } catch {
        return "(unprintable key)";
    }
}
