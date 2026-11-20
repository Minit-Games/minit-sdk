import { callApiFunction, isTestEnvironment } from "../utils.js";
import { recordTrackedDrop, recordTrackedEvent } from "./trackDevBuffer.js";
import type { TrackDropReason } from "./trackDevBuffer.js";
import { showTrackDevPanel } from "./trackDevPanelLoader.js";
import {
    KEY_MAX_LENGTH,
    KEY_PATTERN,
    MAX_EVENTS_PER_LOAD,
    MAX_PAYLOAD_BYTES,
    MAX_PROPS,
    PROP_KEY_MAX_LENGTH,
    RATE_BURST,
    RATE_REFILL_PER_SECOND,
    RESERVED_KEY_PREFIX,
    STRING_VALUE_MAX_LENGTH,
} from "./trackLimits.js";

export type TrackProperties = Record<string, boolean | number | string>;

const TOKEN_COST_MS = 1000 / RATE_REFILL_PER_SECOND;
const BUCKET_CAPACITY_MS = RATE_BURST * TOKEN_COST_MS;

const warnedReasons = new Set<TrackDropReason>();
let bucketMs = BUCKET_CAPACITY_MS;
let bucketUpdatedAt: number | undefined;
let acceptedEvents = 0;

/**
 * Records a custom gameplay event for the creator's analytics. Invalid or excess calls are
 * dropped with a console warning; it never throws.
 *
 * @param key 1–64 chars of `A-Z a-z 0-9 _ . -`; the `minit.` prefix is reserved.
 * @param properties Up to 20 properties of boolean, finite number or string (≤ 256 chars).
 */
export function track(key: string, properties?: TrackProperties): void {
    const result = validate(key, properties);
    if ("reason" in result) {
        drop(key, result.reason);
        return;
    }
    const { props } = result;

    if (isTestEnvironment()) {
        const limitReason = consumeDevLimits();
        if (limitReason) {
            drop(key, limitReason);
            return;
        }
        recordTrackedEvent(key, props);
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

function validate(key: unknown, properties: unknown): { props: TrackProperties } | { reason: TrackDropReason } {
    if (typeof key !== "string" || key.length > KEY_MAX_LENGTH || !KEY_PATTERN.test(key)) {
        return { reason: "invalid-key" };
    }
    if (key.startsWith(RESERVED_KEY_PREFIX)) {
        return { reason: "reserved-key" };
    }
    if (properties === undefined) {
        return { props: {} };
    }
    const entries = snapshotEntries(properties);
    if (!entries) {
        return { reason: "invalid-props" };
    }
    if (entries.length > MAX_PROPS) {
        return { reason: "too-many-props" };
    }
    for (const [propKey, value] of entries) {
        if (propKey.length > PROP_KEY_MAX_LENGTH || !KEY_PATTERN.test(propKey)) {
            return { reason: "invalid-prop-key" };
        }
        if (!isValidValue(value)) {
            return { reason: "invalid-prop-value" };
        }
    }
    const props = Object.fromEntries(entries) as TrackProperties;
    if (new TextEncoder().encode(JSON.stringify({ key, props })).length > MAX_PAYLOAD_BYTES) {
        return { reason: "too-large" };
    }
    return { props };
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
            return true;
        case "number":
            return Number.isFinite(value);
        case "string":
            return value.length <= STRING_VALUE_MAX_LENGTH;
        default:
            return false;
    }
}

function consumeDevLimits(): TrackDropReason | undefined {
    if (acceptedEvents >= MAX_EVENTS_PER_LOAD) {
        return "load-cap";
    }
    // Millisecond credit instead of fractional tokens keeps the refill exact at integer times.
    const now = performance.now();
    bucketMs = Math.min(BUCKET_CAPACITY_MS, bucketMs + now - (bucketUpdatedAt ?? now));
    bucketUpdatedAt = now;
    if (bucketMs < TOKEN_COST_MS) {
        return "rate";
    }
    bucketMs -= TOKEN_COST_MS;
    acceptedEvents++;
    return undefined;
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
