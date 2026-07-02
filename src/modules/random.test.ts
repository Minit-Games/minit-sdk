/**
 * Tests for the deterministic PRNG wrapper.
 *
 * `random.ts` keeps a module-scoped generator, so each test resets the module
 * registry (jest.resetModules()) and re-imports it via a fresh dynamic import()
 * — matching the pattern used by headerPanel.test.ts. console.log is silenced
 * because the module logs the active seed on init/patch.
 */

function setQuery(query: string): void {
    window.history.replaceState({}, "", `/?${query}`);
}

function clearQuery(): void {
    window.history.replaceState({}, "", "/");
}

describe("random", () => {
    beforeEach(() => {
        jest.resetModules();
        jest.spyOn(console, "log").mockImplementation(() => {});
        clearQuery();
    });

    afterEach(() => {
        jest.restoreAllMocks();
        clearQuery();
    });

    describe("patchSeed + seededRandom", () => {
        it("produces a reproducible sequence for a fixed seed", async () => {
            const { patchSeed, seededRandom } = await import("./random");
            patchSeed("fixed-seed");
            const first = Array.from({ length: 5 }, () => seededRandom());
            patchSeed("fixed-seed");
            const second = Array.from({ length: 5 }, () => seededRandom());
            expect(second).toEqual(first);
        });

        it("produces different sequences for different seeds", async () => {
            const { patchSeed, seededRandom } = await import("./random");
            patchSeed("seed-a");
            const a = Array.from({ length: 5 }, () => seededRandom());
            patchSeed("seed-b");
            const b = Array.from({ length: 5 }, () => seededRandom());
            expect(b).not.toEqual(a);
        });

        it("advances the stream so consecutive draws differ", async () => {
            const { patchSeed, seededRandom } = await import("./random");
            patchSeed("advance-seed");
            expect(seededRandom()).not.toBe(seededRandom());
        });

        it("returns numbers in the [0, 1) range", async () => {
            const { patchSeed, seededRandom } = await import("./random");
            patchSeed("range-seed");
            for (let i = 0; i < 200; i++) {
                const v = seededRandom();
                expect(typeof v).toBe("number");
                expect(v).toBeGreaterThanOrEqual(0);
                expect(v).toBeLessThan(1);
            }
        });

        it("re-patching mid-stream resets it deterministically", async () => {
            const { patchSeed, seededRandom } = await import("./random");
            patchSeed("reset-seed");
            seededRandom();
            seededRandom();
            patchSeed("reset-seed");
            const afterReset = [seededRandom(), seededRandom()];
            patchSeed("reset-seed");
            const fresh = [seededRandom(), seededRandom()];
            expect(afterReset).toEqual(fresh);
        });
    });

    describe("lazy initialization from config", () => {
        it("seeds from the 'seed' URL config value on first use (and initializes only once)", async () => {
            setQuery("seed=url-seed");
            const { patchSeed, seededRandom } = await import("./random");
            const fromConfig = [seededRandom(), seededRandom(), seededRandom()];

            // If it re-seeded on every call, all three draws would be identical.
            // A genuinely advancing stream proves init happened exactly once.
            expect(fromConfig[0]).not.toBe(fromConfig[1]);

            // Explicitly patching with the same seed must reproduce the exact
            // sequence — proving ensureInitialized() used the config 'seed' value.
            patchSeed("url-seed");
            const fromPatch = [seededRandom(), seededRandom(), seededRandom()];
            expect(fromConfig).toEqual(fromPatch);
        });

        it("falls back to a Date.now()-based seed when no 'seed' config is present", async () => {
            // No seed param — should still yield valid numbers without throwing.
            const { seededRandom } = await import("./random");
            const v = seededRandom();
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(1);
        });
    });
});
