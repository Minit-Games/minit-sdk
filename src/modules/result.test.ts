import { reportResult } from "./result";
import type { HostResultOptions } from "../minitApi";

// Capture calls to window.minit.reportResult so we can assert on payloads.
let calls: Array<{ result: number | string; options: HostResultOptions | undefined }> = [];

function setupMinit(userData?: Record<string, string>): void {
    calls = [];
    window.minit = {
        environment: "app",
        sdkVersion: "1.2.0",
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

    it("forwards a valid single-key userData to the host", () => {
        setupMinit();
        reportResult(100, { userData: { key: "foo", value: "bar" } });
        expect(calls[0].options).toEqual({ userData: { key: "foo", value: "bar" } });
    });

    it("forwards userData alongside other options", () => {
        setupMinit();
        reportResult(42, { flavorText: "Wow", userData: { key: "x", value: "1" } });
        expect(calls[0].options).toEqual({ flavorText: "Wow", userData: { key: "x", value: "1" } });
    });

    it("allows an empty-string value", () => {
        setupMinit();
        reportResult(100, { userData: { key: "k", value: "" } });
        expect(calls[0].options).toEqual({ userData: { key: "k", value: "" } });
    });

    it("omits userData from host payload when null is passed", () => {
        setupMinit();
        reportResult(10, { userData: null as any });
        expect((calls[0].options as Record<string, unknown> | undefined)?.["userData"]).toBeUndefined();
    });

    it("omits userData when an empty-string key is passed", () => {
        setupMinit();
        reportResult(10, { userData: { key: "", value: "v" } });
        expect((calls[0].options as Record<string, unknown> | undefined)?.["userData"]).toBeUndefined();
    });

    it("omits userData when key is missing (non-object guard)", () => {
        setupMinit();
        reportResult(10, { userData: "string-not-object" as any });
        expect((calls[0].options as Record<string, unknown> | undefined)?.["userData"]).toBeUndefined();
    });

    it("omits userData when an array is passed", () => {
        setupMinit();
        reportResult(10, { userData: ["not", "object"] as any });
        expect((calls[0].options as Record<string, unknown> | undefined)?.["userData"]).toBeUndefined();
    });

    it("preserves flavorText but omits userData when null is passed with other options", () => {
        setupMinit();
        reportResult(10, { userData: null as any, flavorText: "hi" });
        expect(calls[0].options).toEqual({ flavorText: "hi" });
        expect((calls[0].options as Record<string, unknown> | undefined)?.["userData"]).toBeUndefined();
    });

    it("omits userData when value is a number (not a string)", () => {
        setupMinit();
        reportResult(10, { userData: { key: "score", value: 42 as any } });
        expect((calls[0].options as Record<string, unknown> | undefined)?.["userData"]).toBeUndefined();
    });
});
