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
    // Existing tests — window.minit.userData is a host-injected record
    // -------------------------------------------------------------------------

    it("returns undefined when window.minit is absent and no URL params are set", () => {
        expect(getUserData("foo")).toBeUndefined();
    });

    it("returns undefined when userData is not set (window.minit = {})", () => {
        window.minit = {} as never;
        expect(getUserData("foo")).toBeUndefined();
    });

    it("returns the value at the given key", () => {
        window.minit = { userData: { foo: "bar" } } as never;
        expect(getUserData("foo")).toBe("bar");
    });

    it("returns undefined for a key not present in the object", () => {
        window.minit = { userData: { foo: "bar" } } as never;
        expect(getUserData("missing")).toBeUndefined();
    });

    it("returns empty string (not undefined) when the stored value is ''", () => {
        window.minit = { userData: { foo: "" } } as never;
        expect(getUserData("foo")).toBe("");
    });

    it("returns undefined for prototype-chain keys not present in the object (toString)", () => {
        window.minit = { userData: { foo: "bar" } } as never;
        expect(getUserData("toString")).toBeUndefined();
    });

    it("returns undefined for prototype-chain keys not present in the object (constructor)", () => {
        window.minit = { userData: { foo: "bar" } } as never;
        expect(getUserData("constructor")).toBeUndefined();
    });

    it("returns undefined (does not throw) when userData is null and no URL params are set", () => {
        window.minit = { userData: null } as never;
        expect(() => getUserData("foo")).not.toThrow();
        expect(getUserData("foo")).toBeUndefined();
    });

    it("returns undefined when the stored value is a non-string (number)", () => {
        window.minit = { userData: { foo: 42 } } as never;
        expect(getUserData("foo")).toBeUndefined();
    });

    it("returns undefined when the stored value is a non-string (object)", () => {
        window.minit = { userData: { foo: { nested: true } } } as never;
        expect(getUserData("foo")).toBeUndefined();
    });

    it("returns undefined when userData is an array (host bug)", () => {
        window.minit = { userData: ["foo", "bar"] } as never;
        expect(getUserData("0")).toBeUndefined();
        expect(getUserData("foo")).toBeUndefined();
    });

    it("returns undefined when userData is a string (host bug)", () => {
        window.minit = { userData: "foo" } as never;
        expect(getUserData("0")).toBeUndefined();
        expect(getUserData("foo")).toBeUndefined();
    });

    // -------------------------------------------------------------------------
    // URL-param fallback — no host injection (window.minit absent / null / undefined)
    // -------------------------------------------------------------------------

    it("returns URL-param value when window.minit is absent", () => {
        setQuery("userData.foo=fromUrl");
        expect(getUserData("foo")).toBe("fromUrl");
    });

    it("returns URL-param value when window.minit.userData is undefined", () => {
        window.minit = { userData: undefined } as never;
        setQuery("userData.foo=fromUrl");
        expect(getUserData("foo")).toBe("fromUrl");
    });

    it("returns URL-param value when window.minit.userData is null", () => {
        window.minit = { userData: null } as never;
        setQuery("userData.foo=fromUrl");
        expect(getUserData("foo")).toBe("fromUrl");
    });

    it("falls back to URL params when window.minit is set but userData property is absent", () => {
        window.minit = {} as never;
        setQuery("userData.foo=fromUrl");
        expect(getUserData("foo")).toBe("fromUrl");
    });

    it("host-injected empty record {} wins over URL params", () => {
        window.minit = { userData: {} } as never;
        setQuery("userData.foo=fromUrl");
        // {} means "host says this player has no stored data" — URL param must NOT be consulted
        expect(getUserData("foo")).toBeUndefined();
    });

    it("host-injected populated record wins over URL params", () => {
        window.minit = { userData: { foo: "host" } } as never;
        setQuery("userData.foo=urlparam");
        expect(getUserData("foo")).toBe("host");
    });

    it("returns empty string when URL-param value is empty", () => {
        setQuery("userData.foo=");
        expect(getUserData("foo")).toBe("");
    });

    it("ignores entries with empty key after prefix (userData.=value)", () => {
        setQuery("userData.=value");
        expect(() => getUserData("")).not.toThrow();
        // The empty-key entry is skipped; no key should match
        expect(getUserData("")).toBeUndefined();
        expect(getUserData("value")).toBeUndefined();
    });

    it("reads multiple userData URL params independently", () => {
        setQuery("userData.a=1&userData.b=2");
        expect(getUserData("a")).toBe("1");
        expect(getUserData("b")).toBe("2");
    });

    it("URL-decodes values exactly once", () => {
        setQuery("userData.foo=tutorialPlayed%3Dtrue");
        // %3D → '=' (decoded once); must NOT be double-decoded
        expect(getUserData("foo")).toBe("tutorialPlayed=true");
    });

    it("first occurrence wins when the same key appears twice", () => {
        setQuery("userData.foo=A&userData.foo=B");
        expect(getUserData("foo")).toBe("A");
    });

    // -------------------------------------------------------------------------
    // Prototype-chain safety with URL params
    // -------------------------------------------------------------------------

    it("returns undefined for prototype-chain key 'toString' when no URL params are set", () => {
        // No host injection, no URL params — must not leak Object.prototype.toString
        expect(getUserData("toString")).toBeUndefined();
    });

    it("returns the URL-param value for prototype-chain key when explicitly set", () => {
        setQuery("userData.toString=evil");
        expect(getUserData("toString")).toBe("evil");
    });

    it("returns undefined for prototype-chain key 'toString' when a different URL param is set", () => {
        // Only 'evilProp' is in the URL — 'toString' must still return undefined
        setQuery("userData.evilProp=evil");
        expect(getUserData("toString")).toBeUndefined();
    });
});
