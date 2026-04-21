import { getUserData } from "./userData";

describe("getUserData", () => {
    afterEach(() => {
        delete window.minit;
    });

    it("returns undefined when window.minit is absent", () => {
        expect(getUserData()).toBeUndefined();
    });

    it("returns undefined when userData is not set", () => {
        window.minit = {} as never;
        expect(getUserData()).toBeUndefined();
    });

    it("returns the stored userData string", () => {
        window.minit = { userData: '{"foo":1}' } as never;
        expect(getUserData()).toBe('{"foo":1}');
    });

    it("distinguishes empty string from undefined", () => {
        window.minit = { userData: "" } as never;
        expect(getUserData()).toBe("");
    });
});
