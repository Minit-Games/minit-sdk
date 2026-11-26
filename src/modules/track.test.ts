import { TextEncoder as NodeTextEncoder } from "node:util";
import type { TrackProperties } from "./track";
import type { TrackDropReason, TrackedEntry } from "./trackDevBuffer";

// jsdom lacks TextEncoder; every runtime the SDK ships to has it.
if (typeof (globalThis as { TextEncoder?: unknown }).TextEncoder === "undefined") {
    (globalThis as { TextEncoder?: unknown }).TextEncoder =
        NodeTextEncoder as unknown as typeof globalThis.TextEncoder;
}

const BUDGET = 3072;

function utf8Bytes(value: string): number {
    return new NodeTextEncoder().encode(value).length;
}

function lineBytes(key: string, props: Record<string, unknown>, t: number): number {
    return utf8Bytes(JSON.stringify([key, props, t]));
}

function propsForLineBytes(key: string, t: number, target: number): TrackProperties {
    return { v: "a".repeat(target - lineBytes(key, { v: "" }, t)) };
}

function propsWithCount(count: number): TrackProperties {
    const props: TrackProperties = {};
    for (let i = 0; i < count; i++) {
        props[`p${i}`] = i;
    }
    return props;
}

type InvalidCase = { label: string; key: unknown; props: unknown; reason: TrackDropReason };

const invalidCases: InvalidCase[] = [
    { label: "an empty key", key: "", props: undefined, reason: "invalid_key" },
    { label: "a number key", key: 42, props: undefined, reason: "invalid_key" },
    { label: "an undefined key", key: undefined, props: undefined, reason: "invalid_key" },
    { label: "a null key", key: null, props: undefined, reason: "invalid_key" },
    { label: "an object key", key: { key: "x" }, props: undefined, reason: "invalid_key" },
    { label: "the minit.result key", key: "minit.result", props: undefined, reason: "reserved_key" },
    { label: "the minit.loading_done key", key: "minit.loading_done", props: undefined, reason: "reserved_key" },
    { label: "a custom minit.-prefixed key", key: "minit.custom", props: undefined, reason: "reserved_key" },
    { label: "null properties", key: "ok", props: null, reason: "invalid_props" },
    { label: "array properties", key: "ok", props: ["a"], reason: "invalid_props" },
    { label: "string properties", key: "ok", props: "a=1", reason: "invalid_props" },
    { label: "number properties", key: "ok", props: 7, reason: "invalid_props" },
    { label: "Map properties", key: "ok", props: new Map([["a", 1]]), reason: "invalid_props" },
    { label: "Date properties", key: "ok", props: new Date(0), reason: "invalid_props" },
    {
        label: "properties with a throwing getter",
        key: "ok",
        props: { get level(): number { throw new Error("unavailable"); } },
        reason: "invalid_props",
    },
    { label: "an empty property name", key: "ok", props: { "": 1 }, reason: "invalid_props" },
    { label: "a NaN value", key: "ok", props: { v: NaN }, reason: "invalid_props" },
    { label: "an Infinity value", key: "ok", props: { v: Infinity }, reason: "invalid_props" },
    { label: "a -Infinity value", key: "ok", props: { v: -Infinity }, reason: "invalid_props" },
    { label: "a null value", key: "ok", props: { v: null }, reason: "invalid_props" },
    { label: "an undefined value", key: "ok", props: { v: undefined }, reason: "invalid_props" },
    { label: "a nested object value", key: "ok", props: { v: { a: 1 } }, reason: "invalid_props" },
    { label: "an array value", key: "ok", props: { v: [1, 2] }, reason: "invalid_props" },
];

type ValidCase = { label: string; key: string; props: TrackProperties | undefined };

const validCases: ValidCase[] = [
    { label: "no properties", key: "level.start", props: undefined },
    { label: "a 1000-char key", key: "k".repeat(1000), props: {} },
    { label: "a key with spaces and slashes", key: "level start/boss", props: {} },
    { label: "a non-ASCII key", key: "größe 🎮", props: {} },
    { label: "a key that only resembles the reserved prefix", key: "minitgame.start", props: {} },
    { label: "50 properties", key: "ok", props: propsWithCount(50) },
    { label: "a long non-ASCII property name with a space", key: "ok", props: { ["größe ".repeat(20)]: 1 } },
    {
        label: "boolean, finite number and string values",
        key: "ok",
        props: { won: true, lost: false, score: -12.5, zero: 0, name: "boss", empty: "" },
    },
    { label: "a 1000-char string value", key: "ok", props: { v: "x".repeat(1000) } },
    { label: "a null-prototype properties object", key: "ok", props: Object.assign(Object.create(null), { a: 1 }) },
    { label: "class-instance properties, as the host injection accepts them", key: "ok", props: new (class Props { a = 1; })() as unknown as TrackProperties },
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
    it("propsForLineBytes hits the requested stored line size exactly", () => {
        expect(lineBytes("ok", propsForLineBytes("ok", 1000, 300), 1000)).toBe(300);
        expect(lineBytes("ok", propsForLineBytes("ok", 1000, BUDGET), 1000)).toBe(BUDGET);
    });
});

function expectForwardedUnchanged(hostTrack: jest.Mock, key: unknown, props: unknown, call = 0): void {
    expect(hostTrack.mock.calls[call][0]).toBe(key);
    expect(hostTrack.mock.calls[call][1]).toBe(props);
}

describe("track — no validation in host mode", () => {
    it.each(invalidCases)("forwards $label to the host unchanged, without a warning", async ({ key, props }) => {
        const hostTrack = jest.fn();
        installHost("app", hostTrack);
        const { track, getTrackedEntries } = await loadSdk();

        track(key as string, props as TrackProperties);

        expect(hostTrack).toHaveBeenCalledTimes(1);
        expectForwardedUnchanged(hostTrack, key, props);
        expect(warnSpy).not.toHaveBeenCalled();
        expect(getTrackedEntries()).toEqual([]);
    });

    it("forwards a symbol key unchanged", async () => {
        const hostTrack = jest.fn();
        installHost("app", hostTrack);
        const { track } = await loadSdk();
        const key = Symbol("k");

        track(key as unknown as string, { level: 1 });

        expect(hostTrack).toHaveBeenCalledTimes(1);
        expect(hostTrack.mock.calls[0][0]).toBe(key);
        expect(warnSpy).not.toHaveBeenCalled();
    });

    it("forwards every invalid call, not just the first per reason", async () => {
        const hostTrack = jest.fn();
        installHost("app", hostTrack);
        const { track } = await loadSdk();
        const nanProps = { v: NaN };
        const emptyNameProps = { "": 1 };

        track("");
        track("");
        track("minit.custom");
        track("minit.result");
        track("ok", emptyNameProps);
        track("ok", nanProps);

        expect(hostTrack).toHaveBeenCalledTimes(6);
        expectForwardedUnchanged(hostTrack, "", undefined, 0);
        expectForwardedUnchanged(hostTrack, "", undefined, 1);
        expectForwardedUnchanged(hostTrack, "minit.custom", undefined, 2);
        expectForwardedUnchanged(hostTrack, "minit.result", undefined, 3);
        expectForwardedUnchanged(hostTrack, "ok", emptyNameProps, 4);
        expectForwardedUnchanged(hostTrack, "ok", nanProps, 5);
        expect(warnSpy).not.toHaveBeenCalled();
    });

    it.each(validCases)("forwards $label to the host unchanged", async ({ key, props }) => {
        const hostTrack = jest.fn();
        installHost("app", hostTrack);
        const { track } = await loadSdk();

        track(key, props);

        expect(hostTrack).toHaveBeenCalledTimes(1);
        expectForwardedUnchanged(hostTrack, key, props);
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

        expect(getTrackedEntries()).toEqual([{ kind: "event", key, props: props ?? {}, bytes: lineBytes(key, { ...props }, 1000), t: 1000 }]);
        expect(warnSpy).not.toHaveBeenCalled();
    });
});

describe("track — drop warnings", () => {
    it("warns once per reason per load in dev mode", async () => {
        const { track } = await loadSdk();

        track("");
        track("");
        expect(warnSpy.mock.calls).toEqual([[dropMessage("invalid_key")]]);

        track("minit.custom");
        expect(warnSpy.mock.calls).toEqual([[dropMessage("invalid_key")], [dropMessage("reserved_key")]]);

        track("minit.result");
        track(42 as unknown as string);
        expect(warnSpy).toHaveBeenCalledTimes(2);
    });

    it("warns invalid_props once for an empty property name followed by a NaN value", async () => {
        const { track, getTrackedEntries } = await loadSdk();

        track("ok", { "": 1 });
        track("ok", { v: NaN });

        expect(warnSpy.mock.calls).toEqual([[dropMessage("invalid_props")]]);
        expect(getTrackedEntries()).toEqual([
            { kind: "drop", key: "ok", reason: "invalid_props", t: 1000 },
            { kind: "drop", key: "ok", reason: "invalid_props", t: 1000 },
        ]);
    });

    it("never warns about an invalid call in host mode", async () => {
        installHost("app", jest.fn());
        const { track } = await loadSdk();

        for (const { key, props } of invalidCases) {
            track(key as string, props as TrackProperties);
        }

        expect(warnSpy).not.toHaveBeenCalled();
    });

    it("buffers a drop entry for every dropped call, stamped at that moment, while warning once per reason", async () => {
        const { track, getTrackedEntries } = await loadSdk();

        now = 1000;
        track("");
        now = 1100;
        track("ok", { "": 1 });
        now = 1200.6;
        track("minit.custom");

        expect(getTrackedEntries()).toEqual([
            { kind: "drop", key: "", reason: "invalid_key", t: 1000 },
            { kind: "drop", key: "ok", reason: "invalid_props", t: 1100 },
            { kind: "drop", key: "minit.custom", reason: "reserved_key", t: 1201 },
        ]);
        expect(events(getTrackedEntries())).toEqual([]);
        expect(warnSpy.mock.calls).toEqual([
            [dropMessage("invalid_key")],
            [dropMessage("invalid_props")],
            [dropMessage("reserved_key")],
        ]);
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

        expect(hostTrack).toHaveBeenCalledTimes(2);
        expect(hostTrack.mock.calls[0]).toEqual(["level.complete", { level: 3, perfect: true, boss: "slime" }]);
        expect(hostTrack.mock.calls[1][0]).toBe("level.start");
        expect(hostTrack.mock.calls[1][1]).toBeUndefined();
    });

    it("does not throw for a symbol key when the host has no track function", async () => {
        installHost("app");
        const { track } = await loadSdk();

        expect(() => track(Symbol("k") as unknown as string)).not.toThrow();
        expect(warnSpy).not.toHaveBeenCalled();
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

    it("leaves the budget to the host and buffers nothing", async () => {
        const hostTrack = jest.fn();
        installHost("app", hostTrack);
        const { track, getTrackedEntries } = await loadSdk();

        for (let i = 0; i < 20; i++) {
            track(`burst.${i}`, { v: "x".repeat(500) });
        }

        expect(hostTrack).toHaveBeenCalledTimes(20);
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
    ])("drops a key that cannot be stringified (%s) as invalid_key in dev mode", async (_label, key) => {
        const { track, getTrackedEntries } = await loadSdk();

        expect(() => track(key as unknown as string)).not.toThrow();

        expect(warnSpy.mock.calls).toEqual([[dropMessage("invalid_key")]]);
        expect(getTrackedEntries()).toEqual([{ kind: "drop", key: "(unprintable key)", reason: "invalid_key", t: 1000 }]);
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
            { kind: "event", key: "first", props: { a: 1 }, bytes: lineBytes("first", { a: 1 }, 1235), t: 1235 },
            { kind: "event", key: "second", props: {}, bytes: lineBytes("second", {}, 1500), t: 1500 },
        ]);
    });

    it("keeps the buffered props unchanged when the caller mutates its object afterwards", async () => {
        const { track, getTrackedEntries } = await loadSdk();
        const props: TrackProperties = { level: 1 };

        track("level.start", props);
        props.level = 2;
        props.extra = "x";

        expect(getTrackedEntries()).toEqual([{ kind: "event", key: "level.start", props: { level: 1 }, bytes: lineBytes("level.start", { level: 1 }, 1000), t: 1000 }]);
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
        expect(getTrackedEntries()).toEqual([{ kind: "event", key: "level.start", props: { level: 1 }, bytes: lineBytes("level.start", { level: 1 }, 1000), t: 1000 }]);
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
            { kind: "event", key: "a", props: {}, bytes: lineBytes("a", {}, 1000), t: 1000 },
            { kind: "event", key: "b", props: {}, bytes: lineBytes("b", {}, 1500), t: 1500 },
            { kind: "drop", key: "", reason: "invalid_key", t: 1700 },
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
            [{ kind: "event", key: "during", props: { n: 1 }, bytes: lineBytes("during", { n: 1 }, 1000), t: 1000 }],
            [{ kind: "drop", key: "", reason: "invalid_key", t: 1000 }],
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
            recordTrackedDrop(`e${i}`, "budget");
        }

        const entries = getTrackedEntries();
        expect(entries).toHaveLength(MAX_DEV_ENTRIES);
        expect(entries[0].key).toBe("e3");
        expect(entries[MAX_DEV_ENTRIES - 1].key).toBe(`e${MAX_DEV_ENTRIES + 2}`);
    });
});

describe("track — dev budget", () => {
    function sequence(entries: readonly TrackedEntry[]): string[] {
        return entries.map((entry) => (entry.kind === "drop" ? `drop:${entry.reason}` : entry.key));
    }

    it("accepts events until the budget is exactly used", async () => {
        const { track, getTrackedEntries } = await loadSdk();
        const { getTrackedUsage } = await import("./trackDevBuffer");

        for (let i = 0; i < 3; i++) {
            track(`e${i}`, propsForLineBytes(`e${i}`, 1000, 1000));
        }
        track("last", propsForLineBytes("last", 1000, BUDGET - 3000));

        expect(sequence(getTrackedEntries())).toEqual(["e0", "e1", "e2", "last"]);
        expect(getTrackedUsage().bytes).toBe(BUDGET);
        expect(warnSpy).not.toHaveBeenCalled();
    });

    it("drops the event that would go over the budget whole, warns once, and still fits a smaller later event", async () => {
        const { track, getTrackedEntries } = await loadSdk();
        const { getTrackedUsage } = await import("./trackDevBuffer");
        track("fill", propsForLineBytes("fill", 1000, BUDGET - 50));

        track("big", propsForLineBytes("big", 1000, 51));
        track("big", propsForLineBytes("big", 1000, 51));
        track("small", propsForLineBytes("small", 1000, 50));

        expect(sequence(getTrackedEntries())).toEqual(["fill", "drop:budget", "drop:budget", "small"]);
        expect(getTrackedUsage().bytes).toBe(BUDGET);
        expect(warnSpy.mock.calls).toEqual([[dropMessage("budget")]]);
    });

    it("counts multi-byte characters as UTF-8 bytes", async () => {
        const { track, getTrackedEntries } = await loadSdk();
        track("fill", propsForLineBytes("fill", 1000, BUDGET - 100));
        const multiByte = { v: "é".repeat(60) };
        expect(JSON.stringify(["mb", multiByte, 1000]).length).toBeLessThan(100);
        expect(lineBytes("mb", multiByte, 1000)).toBeGreaterThan(100);

        track("mb", multiByte);
        track("ascii", { v: "e".repeat(60) });

        expect(sequence(getTrackedEntries())).toEqual(["fill", "drop:budget", "ascii"]);
    });

    it("measures the stored line including its t", async () => {
        const { track, getTrackedEntries } = await loadSdk();

        now = 123456.7;
        track("timed", { level: 3 });

        expect(getTrackedEntries()[0]).toEqual(
            expect.objectContaining({ bytes: utf8Bytes(JSON.stringify(["timed", { level: 3 }, 123457])) }),
        );
    });

    it("accepts many calls in one tick while under the budget", async () => {
        const { track, getTrackedEntries } = await loadSdk();

        for (let i = 0; i < 150; i++) {
            track(`tick.${i}`);
        }

        expect(events(getTrackedEntries())).toHaveLength(150);
        expect(warnSpy).not.toHaveBeenCalled();
    });

    it("does not count validation-dropped calls toward the budget", async () => {
        const { track, getTrackedEntries } = await loadSdk();
        const { getTrackedUsage } = await import("./trackDevBuffer");

        track("ok", { v: NaN });
        track("");
        expect(getTrackedUsage().bytes).toBe(0);

        track("full", propsForLineBytes("full", 1000, BUDGET));
        expect(events(getTrackedEntries())).toHaveLength(1);
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

    it("records minit.result with the reported result and the dev stars for every reportResult call", async () => {
        const { reportResult, getTrackedEntries } = await loadSdk();

        now = 3000;
        reportResult(10);
        now = 4000;
        reportResult("WIN");

        expect(getTrackedEntries()).toEqual([
            { kind: "event", key: "minit.result", props: { result: 10, stars: 3 }, t: 3000 },
            { kind: "event", key: "minit.result", props: { result: "WIN", stars: 3 }, t: 4000 },
        ]);
    });

    it("carries result, stars and flavorText on minit.result before the delayed result arrives, and no percentile", async () => {
        const { reportResult, getTrackedEntries } = await loadSdk();
        const { getReportedResult } = await import("./trackDevBuffer");

        reportResult(42.5, { flavorText: "Speedy!", userData: "x", delay: 500 });

        expect(getReportedResult()).toBeUndefined();
        expect(getTrackedEntries()).toEqual([
            { kind: "event", key: "minit.result", props: { result: 42.5, stars: 3, flavorText: "Speedy!" }, t: 1000 },
        ]);
    });

    it("does not count toward the creator budget", async () => {
        const { track, loadingDone, reportResult, getTrackedEntries } = await loadSdk();
        const { getTrackedUsage } = await import("./trackDevBuffer");

        loadingDone();
        track("full", propsForLineBytes("full", 1000, BUDGET));
        track("over");
        reportResult(1, { flavorText: "Done" });

        expect(getTrackedEntries().map((entry) => (entry.kind === "drop" ? `drop:${entry.reason}` : entry.key))).toEqual([
            "minit.loading_done",
            "full",
            "drop:budget",
            "minit.dropped",
            "minit.result",
        ]);
        expect(getTrackedUsage().bytes).toBe(BUDGET);
    });

    it("is not buffered in host mode", async () => {
        installHost("app", jest.fn());
        const { loadingDone, reportResult, getTrackedEntries } = await loadSdk();

        loadingDone();
        reportResult(5);

        expect(getTrackedEntries()).toEqual([]);
    });
});

describe("track — result ordering", () => {
    it("reaches the host through window.minit for both track and reportResult, in call order, without a direct bridge post", async () => {
        const calls: string[] = [];
        const postMessage = jest.fn();
        (window as unknown as { ReactNativeWebView: unknown }).ReactNativeWebView = { postMessage };
        const parentPost = jest.spyOn(window.parent, "postMessage").mockImplementation(() => {});
        installHost("app", (key) => calls.push(`track:${String(key)}`));
        (window.minit as unknown as { reportResult: (result: unknown) => void }).reportResult = (result) =>
            calls.push(`result:${String(result)}`);
        const { track, reportResult } = await loadSdk();

        track("a");
        track("b");
        reportResult(7);

        expect(calls).toEqual(["track:a", "track:b", "result:7"]);
        expect(postMessage).not.toHaveBeenCalled();
        expect(parentPost).not.toHaveBeenCalled();
        delete (window as unknown as { ReactNativeWebView?: unknown }).ReactNativeWebView;
    });
});

describe("track — after reportResult", () => {
    it("drops later calls with after_result in dev mode", async () => {
        const { track, reportResult, getTrackedEntries } = await loadSdk();

        reportResult(1);
        track("late");

        const entries = getTrackedEntries();
        expect(entries[entries.length - 1]).toEqual({ kind: "drop", key: "late", reason: "after_result", t: 1000 });
        expect(warnSpy).toHaveBeenCalledWith(dropMessage("after_result"));
    });

    it.each([
        ["a non-number/string result", { score: 1 }],
        ["NaN", NaN],
        ["Infinity", Infinity],
    ])("keeps tracking open after %s", async (_label, value) => {
        const { track, reportResult, getTrackedEntries } = await loadSdk();

        reportResult(value as never);
        track("still_open");

        expect(getTrackedEntries()).toEqual([expect.objectContaining({ kind: "event", key: "still_open" })]);
    });

    it("does not forward later calls to the host", async () => {
        const hostTrack = jest.fn();
        installHost("app", hostTrack);
        const { track, reportResult } = await loadSdk();

        track("before");
        reportResult(1);
        track("after");

        expect(hostTrack).toHaveBeenCalledTimes(1);
        expect(warnSpy).toHaveBeenCalledWith(dropMessage("after_result"));
    });

    it.each([
        ["a number", 1],
        ["a string", "WIN"],
    ])("stops forwarding invalid and valid calls after %s result in host mode, warning after_result once", async (_label, value) => {
        const hostTrack = jest.fn();
        installHost("app", hostTrack);
        const { track, reportResult, getTrackedEntries } = await loadSdk();

        reportResult(value);
        track("after");
        track("");
        track("minit.custom");
        track("ok", { v: NaN });

        expect(hostTrack).not.toHaveBeenCalled();
        expect(warnSpy.mock.calls).toEqual([[dropMessage("after_result")]]);
        expect(getTrackedEntries()).toEqual([]);
    });

    it.each([
        ["a non-number/string result", { score: 1 }],
        ["NaN", NaN],
        ["Infinity", Infinity],
    ])("keeps forwarding unchanged in host mode after %s", async (_label, value) => {
        const hostTrack = jest.fn();
        installHost("app", hostTrack);
        const { track, reportResult } = await loadSdk();
        const props = { v: NaN };

        reportResult(value as never);
        track("", props);

        expect(hostTrack).toHaveBeenCalledTimes(1);
        expectForwardedUnchanged(hostTrack, "", props);
        expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining("track dropped"));
    });
});

describe("track — minit.dropped in dev mode", () => {
    function keysOf(entries: readonly TrackedEntry[]): string[] {
        return entries.map((entry) => (entry.kind === "drop" ? `drop:${entry.reason}` : entry.key));
    }

    it("records per-reason counts of every dropped call immediately before minit.result, with the same t", async () => {
        const { track, reportResult, getTrackedEntries } = await loadSdk();

        track("");
        track(42 as unknown as string);
        track("minit.custom");
        track("ok", { "": 1 });
        track("ok", { v: NaN });
        track("ok", null as unknown as TrackProperties);
        track("fill", propsForLineBytes("fill", 1000, BUDGET - 50));
        track("big", propsForLineBytes("big", 1000, 51));
        track("big", propsForLineBytes("big", 1000, 51));
        now = 5000.4;
        reportResult(10);

        const entries = getTrackedEntries();
        expect(entries.slice(-2)).toEqual([
            { kind: "event", key: "minit.dropped", props: { invalid_key: 2, reserved_key: 1, invalid_props: 3, budget: 2 }, t: 5000 },
            { kind: "event", key: "minit.result", props: { result: 10, stars: 3 }, t: 5000 },
        ]);
    });

    it("omits reasons with no drops", async () => {
        const { track, reportResult, getTrackedEntries } = await loadSdk();

        track("minit.custom");
        track("ok");
        reportResult("WIN");

        expect(keysOf(getTrackedEntries())).toEqual(["drop:reserved_key", "ok", "minit.dropped", "minit.result"]);
        expect(getTrackedEntries()[2]).toEqual({ kind: "event", key: "minit.dropped", props: { reserved_key: 1 }, t: 1000 });
    });

    it("records no minit.dropped when nothing was dropped", async () => {
        const { track, reportResult, getTrackedEntries } = await loadSdk();

        track("ok");
        reportResult(1);

        expect(keysOf(getTrackedEntries())).toEqual(["ok", "minit.result"]);
    });

    it("keeps minit.dropped outside the creator budget", async () => {
        const { track, reportResult } = await loadSdk();
        const { getTrackedUsage } = await import("./trackDevBuffer");

        track("ok", { level: 1 });
        track("");
        const bytesBefore = getTrackedUsage().bytes;
        reportResult(1);

        expect(getTrackedUsage().bytes).toBe(bytesBefore);
    });

    it("never counts after_result drops", async () => {
        const { track, reportResult, getTrackedEntries } = await loadSdk();

        track("");
        reportResult(1);
        track("late");
        track("");
        reportResult(2);

        expect(keysOf(getTrackedEntries())).toEqual([
            "drop:invalid_key",
            "minit.dropped",
            "minit.result",
            "drop:after_result",
            "drop:after_result",
            "minit.result",
        ]);
        expect(getTrackedEntries()[1]).toEqual(expect.objectContaining({ key: "minit.dropped", props: { invalid_key: 1 } }));
    });

    it("records no minit.dropped when the only drops come after the result", async () => {
        const { track, reportResult, getTrackedEntries } = await loadSdk();

        reportResult(1);
        track("late");
        reportResult(2);

        expect(keysOf(getTrackedEntries())).toEqual(["minit.result", "drop:after_result", "minit.result"]);
    });

    it("records minit.dropped at most once per play", async () => {
        const { track, reportResult, getTrackedEntries } = await loadSdk();

        track("");
        reportResult(1);
        reportResult("WIN");

        expect(keysOf(getTrackedEntries())).toEqual(["drop:invalid_key", "minit.dropped", "minit.result", "minit.result"]);
    });

    it.each([
        ["a non-number/string result", { score: 1 }],
        ["NaN", NaN],
        ["Infinity", Infinity],
    ])("records neither minit.dropped nor minit.result for %s, and keeps counting until a closing result", async (_label, value) => {
        const { track, reportResult, getTrackedEntries } = await loadSdk();

        track("");
        reportResult(value as never);
        expect(keysOf(getTrackedEntries())).toEqual(["drop:invalid_key"]);

        track("minit.custom");
        now = 2000;
        reportResult(3);

        expect(keysOf(getTrackedEntries())).toEqual(["drop:invalid_key", "drop:reserved_key", "minit.dropped", "minit.result"]);
        expect(getTrackedEntries()[2]).toEqual({
            kind: "event",
            key: "minit.dropped",
            props: { invalid_key: 1, reserved_key: 1 },
            t: 2000,
        });
    });

    it("is never recorded by the SDK in host mode", async () => {
        installHost("app", jest.fn());
        const { track, reportResult, getTrackedEntries } = await loadSdk();

        track("");
        track("minit.custom");
        reportResult(1);
        track("late");

        expect(getTrackedEntries()).toEqual([]);
    });
});
