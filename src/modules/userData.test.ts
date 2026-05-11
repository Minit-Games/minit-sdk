import { getUserData } from "./userData";

function setQuery(query: string): void {
    window.history.replaceState({}, "", `/?${query}`);
}

function clearQuery(): void {
    window.history.replaceState({}, "", "/");
}

describe("getUserData", () => {
    afterEach(() => {
        delete window.minit;
        clearQuery();
    });

    // -------------------------------------------------------------------------
    // Host-injected string value via window.minit.userData
    // -------------------------------------------------------------------------

    it("returns undefined when window.minit is absent and no URL params are set", () => {
        expect(getUserData()).toBeUndefined();
    });

    it("returns undefined when userData is not set (window.minit = {})", () => {
        window.minit = {} as never;
        expect(getUserData()).toBeUndefined();
    });

    it("returns the host-injected string value", () => {
        window.minit = { userData: "hello" } as never;
        expect(getUserData()).toBe("hello");
    });

    it("returns empty string (not undefined) when the injected value is ''", () => {
        window.minit = { userData: "" } as never;
        expect(getUserData()).toBe("");
    });

    it("returns undefined (does not throw) when userData is null and no URL params are set", () => {
        window.minit = { userData: null } as never;
        expect(() => getUserData()).not.toThrow();
        expect(getUserData()).toBeUndefined();
    });

    it("returns undefined when a buggy host injects a number instead of a string", () => {
        window.minit = { userData: 42 } as never;
        expect(getUserData()).toBeUndefined();
    });

    it("returns undefined when a buggy host injects an object instead of a string", () => {
        window.minit = { userData: { foo: "bar" } } as never;
        expect(getUserData()).toBeUndefined();
    });

    it("returns undefined when a buggy host injects an array instead of a string", () => {
        window.minit = { userData: ["a", "b"] } as never;
        expect(getUserData()).toBeUndefined();
    });

    // -------------------------------------------------------------------------
    // URL-param fallback — no host injection (window.minit absent / null / undefined)
    // -------------------------------------------------------------------------

    it("returns URL-param value when window.minit is absent", () => {
        setQuery("userData=fromUrl");
        expect(getUserData()).toBe("fromUrl");
    });

    it("returns URL-param value when window.minit.userData is undefined", () => {
        window.minit = { userData: undefined } as never;
        setQuery("userData=fromUrl");
        expect(getUserData()).toBe("fromUrl");
    });

    it("returns URL-param value when window.minit.userData is null", () => {
        window.minit = { userData: null } as never;
        setQuery("userData=fromUrl");
        expect(getUserData()).toBe("fromUrl");
    });

    it("falls back to URL param when window.minit is set but userData property is absent", () => {
        window.minit = {} as never;
        setQuery("userData=fromUrl");
        expect(getUserData()).toBe("fromUrl");
    });

    it("returns undefined when no URL param and window.minit.userData is absent", () => {
        window.minit = {} as never;
        expect(getUserData()).toBeUndefined();
    });

    it("returns empty string when URL-param value is empty", () => {
        setQuery("userData=");
        expect(getUserData()).toBe("");
    });

    // -------------------------------------------------------------------------
    // Host-injected wins over URL param
    // -------------------------------------------------------------------------

    it("host-injected string wins over URL param", () => {
        window.minit = { userData: "hostValue" } as never;
        setQuery("userData=urlValue");
        expect(getUserData()).toBe("hostValue");
    });

    it("host-injected empty string wins over URL param", () => {
        window.minit = { userData: "" } as never;
        setQuery("userData=urlValue");
        expect(getUserData()).toBe("");
    });

    // -------------------------------------------------------------------------
    // URL-decoding and edge cases
    // -------------------------------------------------------------------------

    it("URL-decodes the param value exactly once", () => {
        setQuery("userData=tutorialPlayed%3Dtrue");
        // %3D → '=' (decoded once); must NOT be double-decoded
        expect(getUserData()).toBe("tutorialPlayed=true");
    });

    it("first occurrence wins when the same key appears twice", () => {
        setQuery("userData=A&userData=B");
        expect(getUserData()).toBe("A");
    });
});
