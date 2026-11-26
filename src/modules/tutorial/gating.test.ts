import { USER_DATA_PARAM_KEY } from "../userData.js";
import { hasPlayedGame, shouldShowTutorial } from "./gating.js";

function setQuery(search: string): void {
    window.history.replaceState({}, "", search ? `?${search}` : "/");
}

describe("shouldShowTutorial", () => {
    afterEach(() => {
        delete window.minit;
        setQuery("");
    });

    describe("host hasPlayedGame flag", () => {
        it("shows tutorial when window.minit is absent (local dev)", () => {
            expect(shouldShowTutorial()).toBe(true);
        });

        it("shows tutorial when hasPlayedGame is absent (web play, Studio, old app)", () => {
            window.minit = {} as never;
            expect(shouldShowTutorial()).toBe(true);
        });

        it("hides tutorial when hasPlayedGame is true", () => {
            window.minit = { hasPlayedGame: true } as never;
            expect(shouldShowTutorial()).toBe(false);
        });

        it("shows tutorial when hasPlayedGame is false", () => {
            window.minit = { hasPlayedGame: false } as never;
            expect(shouldShowTutorial()).toBe(true);
        });

        it.each([
            ["the string \"true\"", "true"],
            ["the number 1", 1],
            ["an object", {}],
            ["null", null],
        ])("shows tutorial when hasPlayedGame is non-boolean (%s)", (_label, value) => {
            window.minit = { hasPlayedGame: value } as never;
            expect(shouldShowTutorial()).toBe(true);
        });
    });

    describe("userData no longer affects gating", () => {
        it("shows tutorial when host injected non-empty userData", () => {
            window.minit = { userData: "true" } as never;
            expect(shouldShowTutorial()).toBe(true);
        });

        it("shows tutorial when host injected any other persisted userData string", () => {
            window.minit = { userData: JSON.stringify({ level: 3 }) } as never;
            expect(shouldShowTutorial()).toBe(true);
        });

        it("shows tutorial when local ?userData= URL param is set", () => {
            setQuery(`${USER_DATA_PARAM_KEY}=true`);
            expect(shouldShowTutorial()).toBe(true);
        });

        it("shows tutorial when userData is set and hasPlayedGame is false", () => {
            window.minit = { userData: "true", hasPlayedGame: false } as never;
            expect(shouldShowTutorial()).toBe(true);
        });

        it("hides tutorial when hasPlayedGame is true even with empty userData", () => {
            window.minit = { userData: "", hasPlayedGame: true } as never;
            expect(shouldShowTutorial()).toBe(false);
        });
    });

    describe("?tutorial= override takes precedence over the host flag", () => {
        it.each(["1", "true"])("force-shows with ?tutorial=%s even when hasPlayedGame is true", (value) => {
            window.minit = { hasPlayedGame: true } as never;
            setQuery(`tutorial=${value}`);
            expect(shouldShowTutorial()).toBe(true);
        });

        it.each(["0", "false"])("force-hides with ?tutorial=%s when hasPlayedGame is false", (value) => {
            window.minit = { hasPlayedGame: false } as never;
            setQuery(`tutorial=${value}`);
            expect(shouldShowTutorial()).toBe(false);
        });

        it.each(["0", "false"])("force-hides with ?tutorial=%s when hasPlayedGame is absent", (value) => {
            setQuery(`tutorial=${value}`);
            expect(shouldShowTutorial()).toBe(false);
        });
    });

    describe("?hasPlayedGame= fallback without a host flag", () => {
        it("hides tutorial with ?hasPlayedGame=true in the testing environment", () => {
            setQuery("hasPlayedGame=true");
            expect(hasPlayedGame()).toBe(true);
            expect(shouldShowTutorial()).toBe(false);
        });

        it.each(["false", "1", ""])("shows tutorial with ?hasPlayedGame=%s", (value) => {
            setQuery(`hasPlayedGame=${value}`);
            expect(shouldShowTutorial()).toBe(true);
        });

        it("lets an injected hasPlayedGame win over the param", () => {
            window.minit = { hasPlayedGame: false } as never;
            setQuery("hasPlayedGame=true");
            expect(shouldShowTutorial()).toBe(true);
        });

        it("ignores the param outside the testing environment", () => {
            window.minit = { environment: "app" } as never;
            setQuery("hasPlayedGame=true");
            expect(shouldShowTutorial()).toBe(true);
        });

        it.each(["1", "true"])("still force-shows with ?tutorial=%s over the param", (value) => {
            setQuery(`hasPlayedGame=true&tutorial=${value}`);
            expect(shouldShowTutorial()).toBe(true);
        });

        it("still force-shows with ?tutorial=1 over both the param and an injected flag", () => {
            window.minit = { hasPlayedGame: true } as never;
            setQuery("hasPlayedGame=true&tutorial=1");
            expect(shouldShowTutorial()).toBe(true);
        });
    });
});
