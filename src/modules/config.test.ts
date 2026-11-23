import { getConfig, getConfigValue, readInjectedConfig } from "./config";
import { getConfigRequests, subscribeConfigRequests } from "./trackDevBuffer";

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

        it("excludes the reserved 'hasPlayedGame' param from the result", () => {
            setQuery("difficulty=hard&hasPlayedGame=true");
            expect(getConfig()).toEqual({ difficulty: "hard" });
            expect(readInjectedConfig()).toEqual({ difficulty: "hard" });
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

        it("returns undefined for the 'hasPlayedGame' key even when the URL param is present", () => {
            setQuery("hasPlayedGame=true");
            expect(getConfigValue("hasPlayedGame")).toBeUndefined();
        });

        it("returns the default for the 'hasPlayedGame' key", () => {
            setQuery("hasPlayedGame=true");
            expect(getConfigValue("hasPlayedGame", "default")).toBe("default");
            expect(getConfigValue("hasPlayedGame", () => "lazy")).toBe("lazy");
        });

        it("does not record the 'hasPlayedGame' key in the dev buffer", () => {
            setQuery("hasPlayedGame=true");
            getConfig();
            getConfigValue("hasPlayedGame");
            expect(getConfigRequests().some((request) => request.key === "hasPlayedGame")).toBe(false);
        });
    });

    describe("dev buffer recording", () => {
        const requestFor = (key: string) => getConfigRequests().find((request) => request.key === key);

        it("records an injected value, a default, a function default and a missing key", () => {
            setQuery("rec_injected=1");

            getConfigValue("rec_injected", "x");
            getConfigValue("rec_default", "fallback");
            getConfigValue("rec_fn", () => "computed");
            getConfigValue("rec_missing");

            expect(requestFor("rec_injected")).toEqual({ key: "rec_injected", value: "1", source: "injected" });
            expect(requestFor("rec_default")).toEqual({ key: "rec_default", value: "fallback", source: "default" });
            expect(requestFor("rec_fn")).toEqual({ key: "rec_fn", value: "computed", source: "default" });
            expect(requestFor("rec_missing")).toEqual({ key: "rec_missing", value: undefined, source: "missing" });
        });

        it("records every injected key from getConfig but not from readInjectedConfig", () => {
            setQuery("rec_all_a=1&rec_all_b=2");

            expect(readInjectedConfig()).toEqual({ rec_all_a: "1", rec_all_b: "2" });
            expect(requestFor("rec_all_a")).toBeUndefined();

            getConfig();
            expect(requestFor("rec_all_a")?.source).toBe("injected");
            expect(requestFor("rec_all_b")?.value).toBe("2");
        });

        it("keeps one entry per key with the latest value and skips notifying on unchanged re-reads", () => {
            const listener = jest.fn();
            subscribeConfigRequests(listener);

            getConfigValue("rec_once", "a");
            getConfigValue("rec_once", "a");
            getConfigValue("rec_once", "b");

            expect(getConfigRequests().filter((request) => request.key === "rec_once")).toHaveLength(1);
            expect(requestFor("rec_once")?.value).toBe("b");
            expect(listener).toHaveBeenCalledTimes(2);
        });
    });
});
