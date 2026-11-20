import { callApiFunction, isTestEnvironment } from "../utils.js";
import { recordTrackedDrop, recordTrackedEvent } from "./trackDevBuffer.js";
import type { TrackDropReason } from "./trackDevBuffer.js";
import { showTrackDevPanel } from "./trackDevPanel.js";

export type TrackProperties = Record<string, boolean | number | string>;

// Hand-copied until packages/shared/src/trackEvents.ts in the minit-root monorepo
// becomes the shared source; minit-sdk cannot import across repositories.
const KEY_PATTERN = /^[A-Za-z0-9_.-]+$/;
const KEY_MAX_LENGTH = 64;
const RESERVED_KEY_PREFIX = "minit.";
const MAX_PROPS = 20;
const PROP_KEY_MAX_LENGTH = 40;
const STRING_VALUE_MAX_LENGTH = 256;
const MAX_PAYLOAD_BYTES = 2048;
const RATE_BURST = 5;
const RATE_REFILL_PER_SECOND = 5;
const MAX_EVENTS_PER_LOAD = 100;

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
    const reason = validate(key, properties);
    if (reason) {
        drop(key, reason);
        return;
    }
    const props = properties ?? {};

    if (isTestEnvironment()) {
        const limitReason = consumeDevLimits();
        if (limitReason) {
            drop(key, limitReason);
            return;
        }
        recordTrackedEvent(key, props);
        showTrackDevPanel();
    }

    callApiFunction(() => {
        try {
            window.minit?.track?.(key, props);
        } catch {
            // A host failure must never break the game.
        }
    }, () => `track => ${key}\nProps: ${JSON.stringify(props)}`);
}

function validate(key: unknown, properties: unknown): TrackDropReason | undefined {
    if (typeof key !== "string" || key.length > KEY_MAX_LENGTH || !KEY_PATTERN.test(key)) {
        return "invalid-key";
    }
    if (key.startsWith(RESERVED_KEY_PREFIX)) {
        return "reserved-key";
    }
    if (properties === undefined) {
        return undefined;
    }
    if (typeof properties !== "object" || properties === null || Array.isArray(properties)) {
        return "invalid-props";
    }
    const entries = Object.entries(properties);
    if (entries.length > MAX_PROPS) {
        return "too-many-props";
    }
    for (const [propKey, value] of entries) {
        if (propKey.length > PROP_KEY_MAX_LENGTH || !KEY_PATTERN.test(propKey)) {
            return "invalid-prop-key";
        }
        if (!isValidValue(value)) {
            return "invalid-prop-value";
        }
    }
    if (new TextEncoder().encode(JSON.stringify({ key, props: properties })).length > MAX_PAYLOAD_BYTES) {
        return "too-large";
    }
    return undefined;
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
    if (warnedReasons.has(reason)) {
        return;
    }
    warnedReasons.add(reason);
    console.warn(`[Minit] track dropped: ${reason}`);
    if (isTestEnvironment()) {
        recordTrackedDrop(typeof key === "string" ? key : String(key), reason);
        showTrackDevPanel();
    }
}
