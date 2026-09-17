import { reportResult, reportDropResult } from "./result";
import type { HostResultOptions } from "../minitApi";
import { TextEncoder as NodeTextEncoder } from "node:util";

// GOTCHA (DROP-8991): this repo's Jest `testEnvironment` is jsdom, and jsdom
// 20 does not implement `TextEncoder` on its global — unlike every real
// runtime this SDK ships to (browsers, and Node hosts). Left unpolyfilled,
// `new TextEncoder()` throws a ReferenceError here, which would make the
// byte-length warning tests below exercise this environment's own missing
// global instead of the SDK's "TextEncoder unavailable" guard. Polyfill it
// once for this file so the normal-path tests see the same global the
// implementation will call; the dedicated "TextEncoder unavailable" test
// further below still simulates the true edge case by deleting it again
// (and restoring it) within its own test.
if (typeof (globalThis as { TextEncoder?: unknown }).TextEncoder === "undefined") {
    (globalThis as { TextEncoder?: unknown }).TextEncoder =
        NodeTextEncoder as unknown as typeof globalThis.TextEncoder;
}

// Capture calls to window.minit.reportResult so we can assert on payloads.
let calls: Array<{ result: number | string; options: HostResultOptions | undefined }> = [];

function setupMinit(userData?: string): void {
    calls = [];
    window.minit = {
        environment: "app",
        dropConfig: {},
        userData,
        reportResult: (result: number | string, options?: HostResultOptions) => {
            calls.push({ result, options });
        },
        loadingDone: () => {},
    } as never;
}

describe("reportResult", () => {
    afterEach(() => {
        delete window.minit;
        calls = [];
    });

    it("sends no userData field when options are omitted", () => {
        setupMinit();
        reportResult(100);
        expect(calls).toHaveLength(1);
        expect(calls[0].options).toBeUndefined();
    });

    it("sends no userData field when options object has no userData", () => {
        setupMinit();
        reportResult(100, { flavorText: "Nice!" });
        expect(calls[0].options).toEqual({ flavorText: "Nice!" });
        expect((calls[0].options as Record<string, unknown>)["userData"]).toBeUndefined();
    });

    it("sends no userData field when options object is empty", () => {
        setupMinit();
        reportResult(100, {});
        expect(calls[0].options).toBeUndefined();
    });

    it("wraps string userData into { value } for the host", () => {
        setupMinit();
        reportResult(100, { userData: "savedState" });
        expect(calls[0].options).toEqual({ userData: { value: "savedState" } });
    });

    it("wraps userData alongside other options", () => {
        setupMinit();
        reportResult(42, { flavorText: "Wow", userData: "data" });
        expect(calls[0].options).toEqual({ flavorText: "Wow", userData: { value: "data" } });
    });

    it("wraps empty string userData into { value: '' } (distinct from omission)", () => {
        setupMinit();
        reportResult(100, { userData: "" });
        expect(calls[0].options).toEqual({ userData: { value: "" } });
    });

    it("preserves flavorText alongside wrapped userData", () => {
        setupMinit();
        reportResult(10, { userData: "v", flavorText: "hi" });
        expect(calls[0].options).toEqual({ userData: { value: "v" }, flavorText: "hi" });
    });

    it("omits userData from host payload when null is passed (JS misuse guard)", () => {
        setupMinit();
        reportResult(100, { userData: null as any });
        expect(calls[0].options).toBeUndefined();
    });

    it("omits userData from host payload when a number is passed (JS misuse guard)", () => {
        setupMinit();
        reportResult(100, { userData: 42 as any });
        expect(calls[0].options).toBeUndefined();
    });

    it("omits userData from host payload when a v1.2-style object is passed (JS misuse guard)", () => {
        setupMinit();
        reportResult(100, { userData: { value: "x" } as any });
        expect(calls[0].options).toBeUndefined();
    });
});

describe("reportDropResult (backward-compat alias)", () => {
    afterEach(() => {
        delete window.minit;
        calls = [];
    });

    it("is the same function reference as reportResult", () => {
        expect(reportDropResult).toBe(reportResult);
    });

    it("wraps string userData into { value } via the alias", () => {
        setupMinit();
        reportDropResult(99, { userData: "level5" });
        expect(calls).toHaveLength(1);
        expect(calls[0].result).toBe(99);
        expect(calls[0].options).toEqual({ userData: { value: "level5" } });
    });

    it("omits userData from the alias host payload when options are omitted", () => {
        setupMinit();
        reportDropResult(1);
        expect(calls[0].options).toBeUndefined();
    });
});

describe("reportResult — web environment dispatch", () => {
    afterEach(() => {
        delete window.minit;
        calls = [];
    });

    it("wraps string userData into { value } when environment is 'web'", () => {
        calls = [];
        window.minit = {
            environment: "web",
            dropConfig: {},
            reportResult: (result: number | string, options?: HostResultOptions) => {
                calls.push({ result, options });
            },
            loadingDone: () => {},
        } as never;

        reportResult(77, { userData: "bestScore=42" });

        expect(calls).toHaveLength(1);
        expect(calls[0].result).toBe(77);
        expect(calls[0].options).toEqual({ userData: { value: "bestScore=42" } });
    });

    it("omits userData from host payload in the web environment when not provided", () => {
        calls = [];
        window.minit = {
            environment: "web",
            dropConfig: {},
            reportResult: (result: number | string, options?: HostResultOptions) => {
                calls.push({ result, options });
            },
            loadingDone: () => {},
        } as never;

        reportResult(10);

        expect(calls[0].options).toBeUndefined();
    });

    it("wraps empty string userData into { value: '' } in the web environment", () => {
        calls = [];
        window.minit = {
            environment: "web",
            dropConfig: {},
            reportResult: (result: number | string, options?: HostResultOptions) => {
                calls.push({ result, options });
            },
            loadingDone: () => {},
        } as never;

        reportResult(10, { userData: "" });

        expect(calls[0].options).toEqual({ userData: { value: "" } });
    });
});

// DROP-8991: buildHostOptions() must console.warn when flavorText or userData
// exceeds its cap, so a creator sees the problem in their own dev console
// instead of discovering a truncated/dropped value in production. The SDK
// only warns — it forwards the value unmodified; truncation stays the host's
// job (DROP-8990).
//
// Caps mirror packages/shared/src/creatorLimits.ts in the minit-root monorepo
// (flavorText: 64 chars, userData: 1024 UTF-8 bytes) — hand-copied here since
// no cross-repo import exists between minit-sdk and minit-root, same
// situation as the hand-mirrored SPDX_LICENSE_IDS.
describe("reportResult — over-limit constraint warnings (DROP-8991)", () => {
    afterEach(() => {
        delete window.minit;
        calls = [];
        jest.restoreAllMocks();
    });

    describe("flavorText (character-length cap: 64)", () => {
        it("does not warn when flavorText is exactly at the cap (64 chars)", () => {
            setupMinit();
            const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
            reportResult(100, { flavorText: "x".repeat(64) });
            expect(warnSpy).not.toHaveBeenCalled();
        });

        it("warns exactly once when flavorText exceeds the cap (65 chars)", () => {
            setupMinit();
            const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
            reportResult(100, { flavorText: "x".repeat(65) });
            expect(warnSpy).toHaveBeenCalledTimes(1);
        });

        it("names the field, actual length, cap, and consequence in the flavorText warning", () => {
            setupMinit();
            const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
            reportResult(100, { flavorText: "x".repeat(65) });

            expect(warnSpy).toHaveBeenCalledTimes(1);
            const message = warnSpy.mock.calls[0].join(" ");
            expect(message).toMatch(/^\[MinitSDK\]/);
            expect(message).toContain("flavorText");
            expect(message).toContain("65");
            expect(message).toContain("64");
            expect(message).toMatch(/truncat|discard|drop/i);
        });

        it("forwards an over-limit flavorText value to the host unmodified (no truncation in the SDK)", () => {
            setupMinit();
            jest.spyOn(console, "warn").mockImplementation(() => {});
            const longText = "x".repeat(65);
            reportResult(100, { flavorText: longText });
            expect(calls[0].options).toEqual({ flavorText: longText });
        });
    });

    describe("userData (UTF-8 byte-length cap: 1024)", () => {
        it("does not warn when userData is exactly at the cap (1024 bytes, ASCII)", () => {
            setupMinit();
            const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
            reportResult(100, { userData: "y".repeat(1024) });
            expect(warnSpy).not.toHaveBeenCalled();
        });

        it("warns exactly once when userData exceeds the cap (1025 bytes, ASCII)", () => {
            setupMinit();
            const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
            reportResult(100, { userData: "y".repeat(1025) });
            expect(warnSpy).toHaveBeenCalledTimes(1);
        });

        it("names the field, actual byte size, cap, and consequence in the userData warning", () => {
            setupMinit();
            const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
            reportResult(100, { userData: "y".repeat(1025) });

            expect(warnSpy).toHaveBeenCalledTimes(1);
            const message = warnSpy.mock.calls[0].join(" ");
            expect(message).toMatch(/^\[MinitSDK\]/);
            expect(message).toContain("userData");
            expect(message).toContain("1025");
            expect(message).toContain("1024");
            expect(message).toMatch(/truncat|discard|drop/i);
        });

        it("warns on a multi-byte userData string that is under the 1024 character count but over the 1024 UTF-8 byte cap", () => {
            setupMinit();
            const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

            // '€' (€) is 1 UTF-16 code unit / 3 UTF-8 bytes: 400 chars is
            // well under a naive 1024 *character* check, but 1200 UTF-8 bytes
            // is well over the actual 1024-*byte* cap. This is the exact case
            // a naive `.length` check misses.
            const multiByteValue = "€".repeat(400);
            expect(multiByteValue.length).toBeLessThan(1024);
            const actualByteLength = new TextEncoder().encode(multiByteValue).length;
            expect(actualByteLength).toBeGreaterThan(1024);

            reportResult(100, { userData: multiByteValue });

            expect(warnSpy).toHaveBeenCalledTimes(1);
            const message = warnSpy.mock.calls[0].join(" ");
            expect(message).toContain("userData");
            expect(message).toContain(String(actualByteLength));
            expect(message).toContain("1024");
        });

        it("forwards an over-limit userData value to the host unmodified (no truncation in the SDK)", () => {
            setupMinit();
            jest.spyOn(console, "warn").mockImplementation(() => {});
            const longValue = "y".repeat(1025);
            reportResult(100, { userData: longValue });
            expect(calls[0].options).toEqual({ userData: { value: longValue } });
        });
    });

    describe("no-warning cases", () => {
        it("does not warn when options are absent", () => {
            setupMinit();
            const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
            reportResult(100);
            expect(warnSpy).not.toHaveBeenCalled();
        });

        it("does not warn when options is an empty object", () => {
            setupMinit();
            const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
            reportResult(100, {});
            expect(warnSpy).not.toHaveBeenCalled();
        });

        it("does not warn when flavorText and userData are both well within their caps", () => {
            setupMinit();
            const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
            reportResult(100, { flavorText: "Nice combo!", userData: "level=3" });
            expect(warnSpy).not.toHaveBeenCalled();
        });
    });

    describe("per-field call count and payload identity", () => {
        it("warns exactly once per over-limit field, independently, when both fields exceed their caps in one call", () => {
            setupMinit();
            const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
            reportResult(100, { flavorText: "x".repeat(65), userData: "y".repeat(1025) });

            const flavorTextWarnings = warnSpy.mock.calls.filter((args) =>
                args.join(" ").includes("flavorText"),
            );
            const userDataWarnings = warnSpy.mock.calls.filter((args) =>
                args.join(" ").includes("userData"),
            );

            expect(warnSpy).toHaveBeenCalledTimes(2);
            expect(flavorTextWarnings).toHaveLength(1);
            expect(userDataWarnings).toHaveLength(1);
        });

        it("produces a byte-identical forwarded payload whether or not the warning fires", () => {
            setupMinit();
            jest.spyOn(console, "warn").mockImplementation(() => {});

            const withinCap = "x".repeat(64);
            const overCap = "x".repeat(65);

            reportResult(1, { flavorText: withinCap });
            const withinCapPayload = JSON.stringify(calls[0].options);

            calls = [];
            reportResult(1, { flavorText: overCap });
            const overCapPayload = JSON.stringify(calls[0].options);

            // The warning changes nothing about the shape or content of what's
            // forwarded to the host — only whether a console.warn call
            // happened alongside it.
            expect(withinCapPayload).toBe(JSON.stringify({ flavorText: withinCap }));
            expect(overCapPayload).toBe(JSON.stringify({ flavorText: overCap }));
        });
    });

    describe("environment independence", () => {
        it("warns even when window.minit is absent (isTestEnvironment() === true) — unlike callApiFunction's gated console.log", () => {
            const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
            reportResult(100, { flavorText: "x".repeat(65) });
            expect(warnSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe("TextEncoder unavailable", () => {
        it("does not throw and still forwards the value unmodified when TextEncoder is unavailable", () => {
            setupMinit();
            jest.spyOn(console, "warn").mockImplementation(() => {});

            const originalTextEncoder = (globalThis as { TextEncoder?: unknown }).TextEncoder;
            delete (globalThis as { TextEncoder?: unknown }).TextEncoder;

            try {
                const longValue = "y".repeat(2000);
                expect(() => reportResult(100, { userData: longValue })).not.toThrow();
                expect(calls).toHaveLength(1);
                expect(calls[0].options).toEqual({ userData: { value: longValue } });
            } finally {
                (globalThis as { TextEncoder?: unknown }).TextEncoder = originalTextEncoder;
            }
        });
    });
});
