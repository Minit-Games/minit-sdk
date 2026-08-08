import { reportResult, reportDropResult } from "./result";
import type { HostResultOptions } from "../minitApi";

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
