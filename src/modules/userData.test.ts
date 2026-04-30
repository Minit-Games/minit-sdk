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
});
