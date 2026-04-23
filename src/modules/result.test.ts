import { reportResult, _resetBlobForTests } from "./result";
import type { HostResultOptions } from "../minitApi";

// Capture calls to window.minit.reportResult so we can assert on payloads.
let calls: Array<{ result: number | string; options: HostResultOptions | undefined }> = [];

function setupMinit(userData?: string): void {
    calls = [];
    window.minit = {
        environment: "app",
        sdkVersion: "1.1.0",
        dropConfig: {},
        userData,
        reportResult: (result: number | string, options?: HostResultOptions) => {
            calls.push({ result, options });
        },
        loadingDone: () => {},
    } as never;
    _resetBlobForTests();
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

    it("serialises a userData patch and forwards it to the host", () => {
        setupMinit();
        reportResult(100, { userData: { foo: "bar" } });
        expect(calls[0].options).toEqual({ userData: '{"foo":"bar"}' });
    });

    it("accumulates patches across sequential calls", () => {
        setupMinit();
        reportResult(100, { userData: { a: "1" } });
        reportResult(200, { userData: { b: "2" } });
        expect(calls[1].options).toEqual({ userData: '{"a":"1","b":"2"}' });
    });

    it("merges patch on top of existing userData from the host", () => {
        setupMinit('{"existing":"value"}');
        reportResult(100, { userData: { new: "val" } });
        expect(calls[0].options).toEqual({ userData: '{"existing":"value","new":"val"}' });
    });

    it("starts from {} when initial userData is garbage JSON", () => {
        setupMinit("not json");
        reportResult(100, { userData: { foo: "bar" } });
        expect(calls[0].options).toEqual({ userData: '{"foo":"bar"}' });
    });

    it("omits userData from the host payload when an empty patch is supplied", () => {
        setupMinit();
        reportResult(100, { userData: {} });
        // Empty patch → no userData in host payload.
        expect((calls[0].options as Record<string, unknown> | undefined)?.["userData"]).toBeUndefined();
    });

    it("overwrites an existing key on a subsequent patch", () => {
        setupMinit('{"key":"old"}');
        reportResult(100, { userData: { key: "new" } });
        expect(calls[0].options).toEqual({ userData: '{"key":"new"}' });
    });

    it("preserves non-userData options alongside the serialised blob", () => {
        setupMinit();
        reportResult(42, { flavorText: "Wow", userData: { x: "1" } });
        expect(calls[0].options).toEqual({ flavorText: "Wow", userData: '{"x":"1"}' });
    });

    it("omits userData when null is passed (non-object guard)", () => {
        setupMinit();
        reportResult(10, { userData: null as any });
        expect((calls[0].options as Record<string, unknown> | undefined)?.["userData"]).toBeUndefined();
    });

    it("omits userData when a string is passed (non-object guard)", () => {
        setupMinit();
        _resetBlobForTests();
        reportResult(10, { userData: "string-not-object" as any });
        expect((calls[0].options as Record<string, unknown> | undefined)?.["userData"]).toBeUndefined();
    });

    it("omits userData when an array is passed (non-object guard)", () => {
        setupMinit();
        _resetBlobForTests();
        reportResult(10, { userData: ["not", "object"] as any });
        expect((calls[0].options as Record<string, unknown> | undefined)?.["userData"]).toBeUndefined();
    });

    it("preserves flavorText but omits userData when null is passed with other options", () => {
        setupMinit();
        _resetBlobForTests();
        reportResult(10, { userData: null as any, flavorText: "hi" });
        expect(calls[0].options).toEqual({ flavorText: "hi" });
        expect((calls[0].options as Record<string, unknown> | undefined)?.["userData"]).toBeUndefined();
    });
});
