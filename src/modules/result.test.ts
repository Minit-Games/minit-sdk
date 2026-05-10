import { reportResult, reportDropResult } from "./result";
import type { HostResultOptions } from "../minitApi";

// Capture calls to window.minit.reportResult so we can assert on payloads.
let calls: Array<{ result: number | string; options: HostResultOptions | undefined }> = [];

function setupMinit(userData?: string): void {
    calls = [];
    window.minit = {
        environment: "app",
        sdkVersion: "1.3.0",
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

    it("forwards a string userData to the host", () => {
        setupMinit();
        reportResult(100, { userData: "savedState" });
        expect(calls[0].options).toEqual({ userData: "savedState" });
    });

    it("forwards userData alongside other options", () => {
        setupMinit();
        reportResult(42, { flavorText: "Wow", userData: "data" });
        expect(calls[0].options).toEqual({ flavorText: "Wow", userData: "data" });
    });

    it("forwards empty string userData to the host (distinct from omission)", () => {
        setupMinit();
        reportResult(100, { userData: "" });
        expect(calls[0].options).toEqual({ userData: "" });
    });

    it("preserves flavorText alongside userData", () => {
        setupMinit();
        reportResult(10, { userData: "v", flavorText: "hi" });
        expect(calls[0].options).toEqual({ userData: "v", flavorText: "hi" });
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

    it("forwards a string userData to the host via the alias", () => {
        setupMinit();
        reportDropResult(99, { userData: "level5" });
        expect(calls).toHaveLength(1);
        expect(calls[0].result).toBe(99);
        expect(calls[0].options).toEqual({ userData: "level5" });
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

    it("calls window.minit.reportResult with string userData when environment is 'web'", () => {
        calls = [];
        window.minit = {
            environment: "web",
            sdkVersion: "1.3.0",
            dropConfig: {},
            reportResult: (result: number | string, options?: HostResultOptions) => {
                calls.push({ result, options });
            },
            loadingDone: () => {},
        } as never;

        reportResult(77, { userData: "bestScore=42" });

        expect(calls).toHaveLength(1);
        expect(calls[0].result).toBe(77);
        expect(calls[0].options).toEqual({ userData: "bestScore=42" });
    });

    it("omits userData from host payload in the web environment when not provided", () => {
        calls = [];
        window.minit = {
            environment: "web",
            sdkVersion: "1.3.0",
            dropConfig: {},
            reportResult: (result: number | string, options?: HostResultOptions) => {
                calls.push({ result, options });
            },
            loadingDone: () => {},
        } as never;

        reportResult(10);

        expect(calls[0].options).toBeUndefined();
    });

    it("forwards empty string userData in the web environment", () => {
        calls = [];
        window.minit = {
            environment: "web",
            sdkVersion: "1.3.0",
            dropConfig: {},
            reportResult: (result: number | string, options?: HostResultOptions) => {
                calls.push({ result, options });
            },
            loadingDone: () => {},
        } as never;

        reportResult(10, { userData: "" });

        expect(calls[0].options).toEqual({ userData: "" });
    });
});
