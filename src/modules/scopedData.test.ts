import { getScopedData, patchScopedData } from "./scopedData";

const DROP_ID = "11111111-2222-3333-4444-555555555555";

function setMinit(overrides: Record<string, unknown> = {}): void {
    window.minit = { baseDropId: DROP_ID, ...overrides } as never;
}

describe("getScopedData", () => {
    afterEach(() => {
        delete window.minit;
    });

    it("returns undefined when window.minit is absent", () => {
        expect(getScopedData()).toBeUndefined();
    });

    it("returns undefined when baseDropId is missing (game scope)", () => {
        window.minit = { userData: JSON.stringify({ x: 1 }) } as never;
        expect(getScopedData("game")).toBeUndefined();
    });

    it("returns undefined when userData is absent", () => {
        setMinit();
        expect(getScopedData("game")).toBeUndefined();
    });

    it("returns the per-game slot for the 'game' scope", () => {
        setMinit({
            userData: JSON.stringify({ [DROP_ID]: { score: 42 }, __global__: { pref: "a" } }),
        });
        expect(getScopedData("game")).toEqual({ score: 42 });
    });

    it("returns the '__global__' slot for the 'global' scope", () => {
        setMinit({
            userData: JSON.stringify({ [DROP_ID]: { score: 42 }, __global__: { pref: "a" } }),
        });
        expect(getScopedData("global")).toEqual({ pref: "a" });
    });

    it("defaults to the 'game' scope", () => {
        setMinit({ userData: JSON.stringify({ [DROP_ID]: { v: 1 } }) });
        expect(getScopedData()).toEqual({ v: 1 });
    });

    it("returns undefined when the slot key is missing", () => {
        setMinit({ userData: JSON.stringify({ __global__: { pref: "a" } }) });
        expect(getScopedData("game")).toBeUndefined();
    });

    it("returns undefined when userData is not valid JSON", () => {
        setMinit({ userData: "not json" });
        expect(getScopedData("game")).toBeUndefined();
    });

    it("returns undefined when userData parses to a non-object", () => {
        setMinit({ userData: JSON.stringify([1, 2, 3]) });
        expect(getScopedData("game")).toBeUndefined();
    });
});

describe("patchScopedData", () => {
    afterEach(() => {
        delete window.minit;
    });

    it("throws when baseDropId is missing (game scope)", () => {
        window.minit = {} as never;
        expect(() => patchScopedData({ a: 1 }, "game")).toThrow(/baseDropId/);
    });

    it("writes the per-game slot and preserves other slots", () => {
        setMinit({ userData: JSON.stringify({ __global__: { pref: "a" } }) });
        const result = patchScopedData({ score: 7 }, "game");
        expect(JSON.parse(result)).toEqual({
            __global__: { pref: "a" },
            [DROP_ID]: { score: 7 },
        });
    });

    it("writes the '__global__' slot regardless of baseDropId", () => {
        window.minit = {} as never;
        const result = patchScopedData({ pref: "b" }, "global");
        expect(JSON.parse(result)).toEqual({ __global__: { pref: "b" } });
    });

    it("overwrites the existing slot value", () => {
        setMinit({ userData: JSON.stringify({ [DROP_ID]: { score: 1 } }) });
        const result = patchScopedData({ score: 2 }, "game");
        expect(JSON.parse(result)).toEqual({ [DROP_ID]: { score: 2 } });
    });

    it("treats unparseable userData as empty and still writes", () => {
        setMinit({ userData: "not json" });
        const result = patchScopedData({ score: 1 }, "game");
        expect(JSON.parse(result)).toEqual({ [DROP_ID]: { score: 1 } });
    });

    it("defaults to the 'game' scope", () => {
        setMinit();
        const result = patchScopedData({ v: 1 });
        expect(JSON.parse(result)).toEqual({ [DROP_ID]: { v: 1 } });
    });
});
