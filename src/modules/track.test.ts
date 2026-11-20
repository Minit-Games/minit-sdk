import { TextEncoder as NodeTextEncoder } from "node:util";
import type { TrackProperties } from "./track";
import type { TrackDropReason, TrackedEntry } from "./trackDevBuffer";

// jsdom lacks TextEncoder; every runtime the SDK ships to has it.
if (typeof (globalThis as { TextEncoder?: unknown }).TextEncoder === "undefined") {
    (globalThis as { TextEncoder?: unknown }).TextEncoder =
        NodeTextEncoder as unknown as typeof globalThis.TextEncoder;
}

const MAX_BYTES = 2048;

function utf8Bytes(value: string): number {
    return new NodeTextEncoder().encode(value).length;
}

function payloadBytes(key: string, props: Record<string, unknown>): number {
    return utf8Bytes(JSON.stringify({ key, props }));
}

function propsWithCount(count: number): TrackProperties {
    const props: TrackProperties = {};
    for (let i = 0; i < count; i++) {
        props[`p${i}`] = i;
    }
    return props;
}

function repeatedProps(count: number, value: string): TrackProperties {
    const props: TrackProperties = {};
    for (let i = 0; i < count; i++) {
        props[`p${i}`] = value;
    }
    return props;
}

function fillToBytes(key: string, char: string, target: number): TrackProperties {
    const props: Record<string, string> = {};
    for (let i = 0; i < 20; i++) {
        const name = `p${i}`;
        props[name] = "";
        for (const filler of [char, "a"]) {
            while (props[name].length < 256 && payloadBytes(key, { ...props, [name]: props[name] + filler }) <= target) {
                props[name] += filler;
            }
        }
        if (payloadBytes(key, props) === target) {
            return props;
        }
    }
    throw new Error(`fixture could not reach ${target} bytes`);
}

const MULTI_BYTE_E_PROPS = repeatedProps(6, "é".repeat(256));
const EMOJI_PROPS = repeatedProps(5, "😀".repeat(128));

type InvalidCase = { label: string; key: unknown; props: unknown; reason: TrackDropReason };

const invalidCases: InvalidCase[] = [
    { label: "an empty key", key: "", props: undefined, reason: "invalid-key" },
    { label: "a 65-char key", key: "k".repeat(65), props: undefined, reason: "invalid-key" },
    { label: "a key with a space", key: "level start", props: undefined, reason: "invalid-key" },
    { label: "a key with a slash", key: "level/start", props: undefined, reason: "invalid-key" },
    { label: "a key with a non-ASCII letter", key: "größe", props: undefined, reason: "invalid-key" },
    { label: "a number key", key: 42, props: undefined, reason: "invalid-key" },
    { label: "an undefined key", key: undefined, props: undefined, reason: "invalid-key" },
    { label: "a null key", key: null, props: undefined, reason: "invalid-key" },
    { label: "an object key", key: { key: "x" }, props: undefined, reason: "invalid-key" },
    { label: "the minit.result key", key: "minit.result", props: undefined, reason: "reserved-key" },
    { label: "the minit.loading_done key", key: "minit.loading_done", props: undefined, reason: "reserved-key" },
    { label: "a custom minit.-prefixed key", key: "minit.custom", props: undefined, reason: "reserved-key" },
    { label: "null properties", key: "ok", props: null, reason: "invalid-props" },
    { label: "array properties", key: "ok", props: ["a"], reason: "invalid-props" },
    { label: "string properties", key: "ok", props: "a=1", reason: "invalid-props" },
    { label: "number properties", key: "ok", props: 7, reason: "invalid-props" },
    { label: "Map properties", key: "ok", props: new Map([["a", 1]]), reason: "invalid-props" },
    { label: "Date properties", key: "ok", props: new Date(0), reason: "invalid-props" },
    { label: "class-instance properties", key: "ok", props: new (class Props { a = 1; })(), reason: "invalid-props" },
    {
        label: "properties with a throwing getter",
        key: "ok",
        props: { get level(): number { throw new Error("unavailable"); } },
        reason: "invalid-props",
    },
    { label: "21 properties", key: "ok", props: propsWithCount(21), reason: "too-many-props" },
    { label: "an empty property name", key: "ok", props: { "": 1 }, reason: "invalid-prop-key" },
    { label: "a 41-char property name", key: "ok", props: { ["p".repeat(41)]: 1 }, reason: "invalid-prop-key" },
    { label: "a property name with a space", key: "ok", props: { "my prop": 1 }, reason: "invalid-prop-key" },
    { label: "a property name with a slash", key: "ok", props: { "a/b": 1 }, reason: "invalid-prop-key" },
    { label: "a 257-char string value", key: "ok", props: { v: "x".repeat(257) }, reason: "invalid-prop-value" },
    { label: "a NaN value", key: "ok", props: { v: NaN }, reason: "invalid-prop-value" },
    { label: "an Infinity value", key: "ok", props: { v: Infinity }, reason: "invalid-prop-value" },
    { label: "a -Infinity value", key: "ok", props: { v: -Infinity }, reason: "invalid-prop-value" },
    { label: "a null value", key: "ok", props: { v: null }, reason: "invalid-prop-value" },
    { label: "an undefined value", key: "ok", props: { v: undefined }, reason: "invalid-prop-value" },
    { label: "a nested object value", key: "ok", props: { v: { a: 1 } }, reason: "invalid-prop-value" },
    { label: "an array value", key: "ok", props: { v: [1, 2] }, reason: "invalid-prop-value" },
    { label: "a 2049-byte ASCII payload", key: "ok", props: fillToBytes("ok", "a", MAX_BYTES + 1), reason: "too-large" },
    { label: "a payload of é values under 2048 chars but over 2048 bytes", key: "ok", props: MULTI_BYTE_E_PROPS, reason: "too-large" },
    { label: "a payload of emoji values under 2048 chars but over 2048 bytes", key: "ok", props: EMOJI_PROPS, reason: "too-large" },
];

type ValidCase = { label: string; key: string; props: TrackProperties | undefined };

const validCases: ValidCase[] = [
    { label: "no properties", key: "level.start", props: undefined },
    { label: "a 64-char key", key: "k".repeat(64), props: {} },
    { label: "a key using every allowed symbol", key: "Level_Start-2.done", props: {} },
    { label: "a key that only resembles the reserved prefix", key: "minitgame.start", props: {} },
    { label: "20 properties", key: "ok", props: propsWithCount(20) },
    { label: "a 40-char property name", key: "ok", props: { ["p".repeat(40)]: 1 } },
    {
        label: "boolean, finite number and string values",
        key: "ok",
        props: { won: true, lost: false, score: -12.5, zero: 0, name: "boss", empty: "" },
    },
    { label: "a 256-char string value", key: "ok", props: { v: "x".repeat(256) } },
    { label: "an exactly 2048-byte ASCII payload", key: "ok", props: fillToBytes("ok", "a", MAX_BYTES) },
    { label: "an exactly 2048-byte payload with multi-byte values", key: "ok", props: fillToBytes("ok", "é", MAX_BYTES) },
    { label: "a null-prototype properties object", key: "ok", props: Object.assign(Object.create(null), { a: 1 }) },
];

function dropMessage(reason: TrackDropReason): string {
    return `[Minit] track dropped: ${reason}`;
}

function expectedDropEntry(key: unknown, reason: TrackDropReason, t: number) {
    return typeof key === "string"
        ? { kind: "drop", key, reason, t }
        : expect.objectContaining({ kind: "drop", reason, t });
}

function events(entries: readonly TrackedEntry[]) {
    return entries.filter((entry) => entry.kind === "event");
}

function drops(entries: readonly TrackedEntry[]) {
    return entries.filter((entry) => entry.kind === "drop");
}

function installHost(environment: "app" | "web" = "app", hostTrack?: (...args: unknown[]) => void): void {
    const host: Record<string, unknown> = {
        environment,
        dropConfig: {},
        reportResult: () => {},
        loadingDone: () => {},
    };
    if (hostTrack) {
        host.track = hostTrack;
    }
    window.minit = host as never;
}

async function loadSdk() {
    jest.resetModules();
    const { track } = await import("./track");
    const { getTrackedEntries, subscribeTrackedEntries } = await import("./trackDevBuffer");
    const { loadingDone } = await import("./loadingDone");
    const { reportResult } = await import("./result");
    return { track, getTrackedEntries, subscribeTrackedEntries, loadingDone, reportResult };
}

let now = 1000;
let warnSpy: jest.SpyInstance;

beforeEach(() => {
    now = 1000;
    jest.spyOn(performance, "now").mockImplementation(() => now);
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
    delete window.minit;
    document.body.innerHTML = "";
    jest.restoreAllMocks();
});

describe("track fixtures", () => {
    it("multi-byte payloads pass a character-length check but exceed 2048 UTF-8 bytes", () => {
        for (const props of [MULTI_BYTE_E_PROPS, EMOJI_PROPS]) {
            const json = JSON.stringify({ key: "ok", props });
            expect(json.length).toBeLessThanOrEqual(MAX_BYTES);
            expect(utf8Bytes(json)).toBeGreaterThan(MAX_BYTES);
            expect(Object.keys(props).length).toBeLessThanOrEqual(20);
            expect(Object.values(props).every((value) => String(value).length <= 256)).toBe(true);
        }
    });

    it("exact-size payloads hit the byte boundary precisely", () => {
        expect(payloadBytes("ok", fillToBytes("ok", "a", MAX_BYTES))).toBe(MAX_BYTES);
        expect(payloadBytes("ok", fillToBytes("ok", "é", MAX_BYTES))).toBe(MAX_BYTES);
        expect(payloadBytes("ok", fillToBytes("ok", "a", MAX_BYTES + 1))).toBe(MAX_BYTES + 1);
    });
});

describe("track — validation in host mode", () => {
    it.each(invalidCases)("drops $label with $reason and does not forward it", async ({ key, props, reason }) => {
        const hostTrack = jest.fn();
        installHost("app", hostTrack);
        const { track, getTrackedEntries } = await loadSdk();

        track(key as string, props as TrackProperties);

        expect(hostTrack).not.toHaveBeenCalled();
        expect(warnSpy.mock.calls).toEqual([[dropMessage(reason)]]);
        expect(getTrackedEntries()).toEqual([]);
    });

    it.each(validCases)("forwards $label to the host", async ({ key, props }) => {
        const hostTrack = jest.fn();
        installHost("app", hostTrack);
        const { track } = await loadSdk();

        track(key, props);

        expect(hostTrack).toHaveBeenCalledTimes(1);
        expect(hostTrack).toHaveBeenCalledWith(key, props ?? {});
        expect(warnSpy).not.toHaveBeenCalled();
    });
});

describe("track — validation in dev mode", () => {
    it.each(invalidCases)("drops $label with $reason and buffers one drop entry", async ({ key, props, reason }) => {
        const { track, getTrackedEntries } = await loadSdk();

        track(key as string, props as TrackProperties);

        expect(warnSpy.mock.calls).toEqual([[dropMessage(reason)]]);
        expect(getTrackedEntries()).toEqual([expectedDropEntry(key, reason, 1000)]);
    });

    it.each(validCases)("buffers $label as an event", async ({ key, props }) => {
        const { track, getTrackedEntries } = await loadSdk();

        track(key, props);

        expect(getTrackedEntries()).toEqual([{ kind: "event", key, props: props ?? {}, t: 1000 }]);
        expect(warnSpy).not.toHaveBeenCalled();
    });
});

describe("track — drop warnings", () => {
    it.each(["host", "dev"] as const)("warns once per reason per load in %s mode", async (mode) => {
        if (mode === "host") {
            installHost("app", jest.fn());
        }
        const { track } = await loadSdk();

        track("");
        track("bad key");
        expect(warnSpy.mock.calls).toEqual([[dropMessage("invalid-key")]]);

        track("minit.custom");
        expect(warnSpy.mock.calls).toEqual([[dropMessage("invalid-key")], [dropMessage("reserved-key")]]);

        track("minit.result");
        track("a/b");
        expect(warnSpy).toHaveBeenCalledTimes(2);
    });

    it("buffers a drop entry for every dropped call, stamped at that moment, while warning once per reason", async () => {
        const { track, getTrackedEntries } = await loadSdk();

        now = 1000;
        track("");
        now = 1100;
        track("bad key");
        now = 1200.6;
        track("minit.custom");

        expect(getTrackedEntries()).toEqual([
            { kind: "drop", key: "", reason: "invalid-key", t: 1000 },
            { kind: "drop", key: "bad key", reason: "invalid-key", t: 1100 },
            { kind: "drop", key: "minit.custom", reason: "reserved-key", t: 1201 },
        ]);
        expect(events(getTrackedEntries())).toEqual([]);
        expect(warnSpy.mock.calls).toEqual([[dropMessage("invalid-key")], [dropMessage("reserved-key")]]);
    });

    it("never buffers an invalid call as an event", async () => {
        const { track, getTrackedEntries } = await loadSdk();

        for (const { key, props } of invalidCases) {
            track(key as string, props as TrackProperties);
        }

        expect(events(getTrackedEntries())).toEqual([]);
    });
});

describe("track — host forwarding", () => {
    it.each(["app", "web"] as const)("forwards key and properties to window.minit.track in the %s host", async (environment) => {
        const hostTrack = jest.fn();
        installHost(environment, hostTrack);
        const { track } = await loadSdk();

        track("level.complete", { level: 3, perfect: true, boss: "slime" });
        track("level.start");

        expect(hostTrack.mock.calls).toEqual([
            ["level.complete", { level: 3, perfect: true, boss: "slime" }],
            ["level.start", {}],
        ]);
    });

    it("logs the call and does not throw when the host has no track function", async () => {
        installHost("app");
        const { track, getTrackedEntries } = await loadSdk();

        expect(() => track("level.start", { level: 1 })).not.toThrow();
        expect(console.log).toHaveBeenCalledWith("[MinitSDK]", 'track => level.start\nProps: {"level":1}');
        expect(getTrackedEntries()).toEqual([]);
    });

    it("does not log when it forwards to the host", async () => {
        installHost("app", jest.fn());
        const { track } = await loadSdk();

        track("level.start");

        expect(console.log).not.toHaveBeenCalled();
    });

    it("does not throw when the host track function throws", async () => {
        const hostTrack = jest.fn(() => {
            throw new Error("host failure");
        });
        installHost("app", hostTrack);
        const { track } = await loadSdk();

        expect(() => track("level.start", { level: 1 })).not.toThrow();
        expect(hostTrack).toHaveBeenCalledTimes(1);
    });

    it("applies no rate limit or load cap and buffers nothing", async () => {
        const hostTrack = jest.fn();
        installHost("app", hostTrack);
        const { track, getTrackedEntries } = await loadSdk();

        for (let i = 0; i < 105; i++) {
            track(`burst.${i}`);
        }

        expect(hostTrack).toHaveBeenCalledTimes(105);
        expect(warnSpy).not.toHaveBeenCalled();
        expect(getTrackedEntries()).toEqual([]);
    });
});

describe("track — robustness", () => {
    it.each([
        ["no arguments", []],
        ["a number key", [42]],
        ["a symbol key", [Symbol("k")]],
        ["a function as properties", ["ok", () => 1]],
        ["a circular properties object", ["ok", (() => { const c: Record<string, unknown> = {}; c.self = c; return c; })()]],
    ] as Array<[string, unknown[]]>)("never throws for %s in dev or host mode", async (_label, args) => {
        const callTrack = (track: (...a: unknown[]) => void) => track(...args);

        const dev = await loadSdk();
        expect(() => callTrack(dev.track as (...a: unknown[]) => void)).not.toThrow();

        installHost("app", jest.fn());
        const host = await loadSdk();
        expect(() => callTrack(host.track as (...a: unknown[]) => void)).not.toThrow();
    });

    it.each([
        ["a null-prototype object", Object.create(null)],
        ["a throwing Symbol.toPrimitive", { [Symbol.toPrimitive]: () => { throw new Error("nope"); } }],
    ])("drops a key that cannot be stringified (%s) as invalid-key in dev mode", async (_label, key) => {
        const { track, getTrackedEntries } = await loadSdk();

        expect(() => track(key as unknown as string)).not.toThrow();

        expect(warnSpy.mock.calls).toEqual([[dropMessage("invalid-key")]]);
        expect(getTrackedEntries()).toEqual([{ kind: "drop", key: "(unprintable key)", reason: "invalid-key", t: 1000 }]);
    });
});

describe("track — dev buffer", () => {
    it("stamps events with the rounded performance.now() at call time", async () => {
        const { track, getTrackedEntries } = await loadSdk();

        now = 1234.6;
        track("first", { a: 1 });
        now = 1500.2;
        track("second");

        expect(getTrackedEntries()).toEqual([
            { kind: "event", key: "first", props: { a: 1 }, t: 1235 },
            { kind: "event", key: "second", props: {}, t: 1500 },
        ]);
    });

    it("keeps the buffered props unchanged when the caller mutates its object afterwards", async () => {
        const { track, getTrackedEntries } = await loadSdk();
        const props: TrackProperties = { level: 1 };

        track("level.start", props);
        props.level = 2;
        props.extra = "x";

        expect(getTrackedEntries()).toEqual([{ kind: "event", key: "level.start", props: { level: 1 }, t: 1000 }]);
    });

    it("reads each property getter once and records that value", async () => {
        const { track, getTrackedEntries } = await loadSdk();
        let reads = 0;
        const props = {
            get level() {
                reads++;
                return reads;
            },
        };

        track("level.start", props);

        expect(reads).toBe(1);
        expect(getTrackedEntries()).toEqual([{ kind: "event", key: "level.start", props: { level: 1 }, t: 1000 }]);
    });

    it("lists entries oldest first across events and drops", async () => {
        const { track, getTrackedEntries } = await loadSdk();

        now = 1000;
        track("a");
        now = 1500;
        track("b");
        now = 1700;
        track("");

        expect(getTrackedEntries()).toEqual([
            { kind: "event", key: "a", props: {}, t: 1000 },
            { kind: "event", key: "b", props: {}, t: 1500 },
            { kind: "drop", key: "", reason: "invalid-key", t: 1700 },
        ]);
    });

    it("notifies a subscriber once per new entry until it unsubscribes", async () => {
        const { track, subscribeTrackedEntries } = await loadSdk();
        track("before");
        const listener = jest.fn();

        const unsubscribe = subscribeTrackedEntries(listener);
        track("during", { n: 1 });
        track("");
        unsubscribe();
        track("after");

        expect(listener.mock.calls).toEqual([
            [{ kind: "event", key: "during", props: { n: 1 }, t: 1000 }],
            [{ kind: "drop", key: "", reason: "invalid-key", t: 1000 }],
        ]);
    });

    it("keeps calling the other subscribers and never throws when one subscriber throws", async () => {
        const { track, subscribeTrackedEntries, getTrackedEntries } = await loadSdk();
        subscribeTrackedEntries(() => {
            throw new Error("listener failure");
        });
        const listener = jest.fn();
        subscribeTrackedEntries(listener);

        expect(() => track("level.start")).not.toThrow();
        expect(listener).toHaveBeenCalledTimes(1);
        expect(getTrackedEntries()).toHaveLength(1);
    });

    it("keeps only the newest MAX_DEV_ENTRIES entries", async () => {
        jest.resetModules();
        const { MAX_DEV_ENTRIES, recordTrackedDrop, getTrackedEntries } = await import("./trackDevBuffer");

        for (let i = 0; i < MAX_DEV_ENTRIES + 3; i++) {
            recordTrackedDrop(`e${i}`, "rate");
        }

        const entries = getTrackedEntries();
        expect(entries).toHaveLength(MAX_DEV_ENTRIES);
        expect(entries[0].key).toBe("e3");
        expect(entries[MAX_DEV_ENTRIES - 1].key).toBe(`e${MAX_DEV_ENTRIES + 2}`);
    });
});

describe("track — dev token bucket", () => {
    it("accepts a burst of 5 and drops the 6th synchronous call with rate", async () => {
        const { track, getTrackedEntries } = await loadSdk();

        for (let i = 0; i < 6; i++) {
            track(`e${i}`);
        }

        expect(getTrackedEntries()).toEqual([
            ...[0, 1, 2, 3, 4].map((i) => ({ kind: "event", key: `e${i}`, props: {}, t: 1000 })),
            { kind: "drop", key: "e5", reason: "rate", t: 1000 },
        ]);
        expect(warnSpy.mock.calls).toEqual([[dropMessage("rate")]]);
    });

    it("refills 5 tokens after one second", async () => {
        const { track, getTrackedEntries } = await loadSdk();
        for (let i = 0; i < 6; i++) {
            track(`first.${i}`);
        }

        now += 1000;
        for (let i = 0; i < 6; i++) {
            track(`second.${i}`);
        }

        expect(events(getTrackedEntries()).map((entry) => entry.key)).toEqual([
            ...[0, 1, 2, 3, 4].map((i) => `first.${i}`),
            ...[0, 1, 2, 3, 4].map((i) => `second.${i}`),
        ]);
    });

    it("refills continuously at one token per 200 ms, and a dropped call consumes none", async () => {
        const { track, getTrackedEntries } = await loadSdk();
        for (let i = 0; i < 6; i++) {
            track(`burst.${i}`);
        }

        now = 1199;
        track("too.early");
        now = 1200;
        track("on.time");
        track("again");

        expect(events(getTrackedEntries()).map((entry) => entry.key)).toEqual([
            ...[0, 1, 2, 3, 4].map((i) => `burst.${i}`),
            "on.time",
        ]);
    });

    it("caps the bucket at 5 tokens however long it idles", async () => {
        const { track, getTrackedEntries } = await loadSdk();
        for (let i = 0; i < 5; i++) {
            track(`burst.${i}`);
        }

        now += 60_000;
        for (let i = 0; i < 6; i++) {
            track(`later.${i}`);
        }

        expect(events(getTrackedEntries())).toHaveLength(10);
        expect(events(getTrackedEntries()).map((entry) => entry.key)).not.toContain("later.5");
    });

    it("does not spend tokens on validation-dropped calls", async () => {
        const { track, getTrackedEntries } = await loadSdk();
        for (let i = 0; i < 10; i++) {
            track("bad key");
        }

        for (let i = 0; i < 5; i++) {
            track(`valid.${i}`);
        }

        expect(events(getTrackedEntries())).toHaveLength(5);
        expect(drops(getTrackedEntries()).map((entry) => entry.kind === "drop" && entry.reason)).not.toContain("rate");
    });
});

describe("track — dev load cap", () => {
    async function acceptHundred() {
        const sdk = await loadSdk();
        for (let i = 0; i < 5; i++) {
            sdk.track(`e${i}`);
        }
        sdk.track("rate.dropped");
        sdk.track("bad key");
        sdk.track("minit.custom");
        for (let i = 5; i < 100; i++) {
            now += 200;
            sdk.track(`e${i}`);
        }
        return sdk;
    }

    it("accepts 100 creator events, not counting rate- or validation-dropped calls", async () => {
        const { getTrackedEntries } = await acceptHundred();

        const accepted = events(getTrackedEntries());
        expect(accepted).toHaveLength(100);
        expect(accepted[99]).toEqual({ kind: "event", key: "e99", props: {}, t: Math.round(now) });
    });

    it("drops the 101st valid call with load-cap even when tokens are available", async () => {
        const { track, getTrackedEntries } = await acceptHundred();

        now += 1000;
        track("e100");

        const entries = getTrackedEntries();
        expect(events(entries)).toHaveLength(100);
        expect(entries[entries.length - 1]).toEqual({ kind: "drop", key: "e100", reason: "load-cap", t: Math.round(now) });
        expect(warnSpy).toHaveBeenCalledWith(dropMessage("load-cap"));
    });
});

describe("track — default events", () => {
    it("records minit.loading_done once in dev mode", async () => {
        const { loadingDone, getTrackedEntries, subscribeTrackedEntries } = await loadSdk();
        const listener = jest.fn();
        subscribeTrackedEntries(listener);

        now = 2000.4;
        loadingDone();
        loadingDone();
        loadingDone();

        const expected = { kind: "event", key: "minit.loading_done", props: {}, t: 2000 };
        expect(getTrackedEntries()).toEqual([expected]);
        expect(listener.mock.calls).toEqual([[expected]]);
    });

    it("records minit.result for every reportResult call in dev mode", async () => {
        const { reportResult, getTrackedEntries } = await loadSdk();

        now = 3000;
        reportResult(10);
        now = 4000;
        reportResult("WIN");

        expect(getTrackedEntries()).toEqual([
            { kind: "event", key: "minit.result", props: {}, t: 3000 },
            { kind: "event", key: "minit.result", props: {}, t: 4000 },
        ]);
    });

    it("bypasses the token bucket and does not spend its tokens", async () => {
        const { track, loadingDone, reportResult, getTrackedEntries } = await loadSdk();

        loadingDone();
        for (let i = 0; i < 5; i++) {
            reportResult(i);
        }
        for (let i = 0; i < 5; i++) {
            track(`e${i}`);
        }
        track("e5");
        reportResult(99);

        const keys = events(getTrackedEntries()).map((entry) => entry.key);
        expect(keys.filter((key) => key === "minit.result")).toHaveLength(6);
        expect(keys.filter((key) => key === "minit.loading_done")).toHaveLength(1);
        expect(keys.filter((key) => key.startsWith("e"))).toEqual(["e0", "e1", "e2", "e3", "e4"]);
    });

    it("is still recorded after the creator load cap is exhausted", async () => {
        const { track, loadingDone, reportResult, getTrackedEntries } = await loadSdk();
        for (let i = 0; i < 100; i++) {
            now += 200;
            track(`e${i}`);
        }
        now += 1000;
        track("e100");

        loadingDone();
        reportResult(1);

        const entries = getTrackedEntries();
        expect(entries.slice(-3)).toEqual([
            { kind: "drop", key: "e100", reason: "load-cap", t: Math.round(now) },
            { kind: "event", key: "minit.loading_done", props: {}, t: Math.round(now) },
            { kind: "event", key: "minit.result", props: {}, t: Math.round(now) },
        ]);
    });

    it("is not buffered in host mode", async () => {
        installHost("app", jest.fn());
        const { loadingDone, reportResult, getTrackedEntries } = await loadSdk();

        loadingDone();
        reportResult(5);

        expect(getTrackedEntries()).toEqual([]);
    });
});
