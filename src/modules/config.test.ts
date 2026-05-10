import { getConfig, getConfigValue } from "./config";

function setQuery(query: string): void {
    window.history.replaceState({}, "", `/?${query}`);
}

describe("config", () => {
    afterEach(() => {
        window.history.replaceState({}, "", "/");
    });

    describe("getConfig", () => {
        it("returns an empty object when no query params are present", () => {
            expect(getConfig()).toEqual({});
        });

        it("returns all query params as a string map", () => {
            setQuery("a=1&b=two&c=");
            expect(getConfig()).toEqual({ a: "1", b: "two", c: "" });
        });

        it("excludes the reserved 'userData' param from the result", () => {
            setQuery("difficulty=hard&userData=someValue");
            expect(getConfig()).toEqual({ difficulty: "hard" });
        });

        it("does not exclude params that merely start with 'userData' (e.g. userData2)", () => {
            setQuery("userData2=value&other=x");
            expect(getConfig()).toEqual({ userData2: "value", other: "x" });
        });
    });

    describe("getConfigValue", () => {
        it("returns the param value when present", () => {
            setQuery("seed=abc");
            expect(getConfigValue("seed")).toBe("abc");
        });

        it("returns undefined when absent and no default is given", () => {
            expect(getConfigValue("missing")).toBeUndefined();
        });

        it("returns the string default when absent", () => {
            expect(getConfigValue("missing", "fallback")).toBe("fallback");
        });

        it("calls the function default lazily when absent", () => {
            const fn = jest.fn(() => "computed");
            expect(getConfigValue("missing", fn)).toBe("computed");
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it("does not call the function default when the param exists", () => {
            setQuery("k=v");
            const fn = jest.fn(() => "computed");
            expect(getConfigValue("k", fn)).toBe("v");
            expect(fn).not.toHaveBeenCalled();
        });

        it("returns empty string when the param is present but empty", () => {
            setQuery("k=");
            expect(getConfigValue("k", "fallback")).toBe("");
        });

        it("returns undefined for the 'userData' key even when the URL param is present", () => {
            setQuery("userData=foo");
            expect(getConfigValue("userData")).toBeUndefined();
        });

        it("returns string default for the 'userData' key", () => {
            setQuery("userData=foo");
            expect(getConfigValue("userData", "default")).toBe("default");
        });

        it("returns function default for the 'userData' key", () => {
            setQuery("userData=foo");
            expect(getConfigValue("userData", () => "lazy")).toBe("lazy");
        });

        it("does not block params that merely start with 'userData' (e.g. userData2)", () => {
            setQuery("userData2=value");
            expect(getConfigValue("userData2")).toBe("value");
        });
    });
});
