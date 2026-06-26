import { USER_DATA_PARAM_KEY } from "../userData.js";
import { shouldShowTutorial } from "./gating.js";

function setQuery(search: string): void {
    window.history.replaceState({}, "", search ? `?${search}` : "/");
}

describe("shouldShowTutorial", () => {
    afterEach(() => {
        delete window.minit;
        setQuery("");
    });

    it("shows tutorial when userData is absent (new player)", () => {
        expect(shouldShowTutorial()).toBe(true);
    });

    it("shows tutorial when userData is empty string", () => {
        window.minit = { userData: "" } as never;
        expect(shouldShowTutorial()).toBe(true);
    });

    it("hides tutorial when host injected userData (returning player)", () => {
        window.minit = { userData: "true" } as never;
        expect(shouldShowTutorial()).toBe(false);
    });

    it("hides tutorial when userData is any other persisted string", () => {
        window.minit = { userData: JSON.stringify({ level: 3 }) } as never;
        expect(shouldShowTutorial()).toBe(false);
    });

    it("hides tutorial when local ?userData= URL param is set", () => {
        setQuery(`${USER_DATA_PARAM_KEY}=true`);
        expect(shouldShowTutorial()).toBe(false);
    });

    it("force-shows with ?tutorial=1 even when userData is set", () => {
        window.minit = { userData: "true" } as never;
        setQuery("tutorial=1");
        expect(shouldShowTutorial()).toBe(true);
    });

    it("force-shows with ?tutorial=true", () => {
        window.minit = { userData: "true" } as never;
        setQuery("tutorial=true");
        expect(shouldShowTutorial()).toBe(true);
    });

    it("force-hides with ?tutorial=0", () => {
        setQuery("tutorial=0");
        expect(shouldShowTutorial()).toBe(false);
    });

    it("force-hides with ?tutorial=false", () => {
        setQuery("tutorial=false");
        expect(shouldShowTutorial()).toBe(false);
    });
});
