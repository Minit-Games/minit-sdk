import { getUserData } from "./userData";

describe("getUserData", () => {
    afterEach(() => {
        delete window.minit;
    });

    it("returns undefined when window.minit is absent", () => {
        expect(getUserData("foo")).toBeUndefined();
    });

    it("returns undefined when userData is not set", () => {
        window.minit = {} as never;
        expect(getUserData("foo")).toBeUndefined();
    });

    it("returns undefined when userData is undefined", () => {
        window.minit = { userData: undefined } as never;
        expect(getUserData("foo")).toBeUndefined();
    });

    it("returns the value at the given key", () => {
        window.minit = { userData: '{"foo":"bar"}' } as never;
        expect(getUserData("foo")).toBe("bar");
    });

    it("returns undefined for a key not present in the object", () => {
        window.minit = { userData: '{"foo":"bar"}' } as never;
        expect(getUserData("missing")).toBeUndefined();
    });

    it("returns empty string (not undefined) when the stored value is ''", () => {
        window.minit = { userData: '{"foo":""}' } as never;
        expect(getUserData("foo")).toBe("");
    });

    it("returns undefined when userData is not valid JSON", () => {
        window.minit = { userData: "not json" } as never;
        expect(getUserData("foo")).toBeUndefined();
    });

    it("returns undefined when userData parses to a plain string (not an object)", () => {
        window.minit = { userData: '"a string not an object"' } as never;
        expect(getUserData("foo")).toBeUndefined();
    });

    it("returns undefined when userData parses to an array", () => {
        window.minit = { userData: '["array","not","object"]' } as never;
        expect(getUserData("foo")).toBeUndefined();
    });

    it("returns undefined when userData parses to null", () => {
        window.minit = { userData: "null" } as never;
        expect(getUserData("foo")).toBeUndefined();
    });

    it("coerces a non-string value at the key to a string (legacy blobs)", () => {
        // A hand-crafted or legacy blob where the value is a number.
        window.minit = { userData: '{"score":42}' } as never;
        expect(getUserData("score")).toBe("42");
    });
});
