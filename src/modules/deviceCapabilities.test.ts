import { getDeviceTier, getMotionQuality, prefersReducedMotion } from "./deviceCapabilities.js";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function setQuery(search: string): void {
    window.history.replaceState({}, "", search ? `?${search}` : "/");
}

function setHost(fields: Record<string, unknown>): void {
    window.minit = { environment: "app", dropConfig: {}, reportResult: () => {}, loadingDone: () => {}, ...fields } as never;
}

function stubMatchMedia(reduce: boolean): jest.Mock {
    const matchMedia = jest.fn((query: string) => ({
        matches: reduce && query === REDUCED_MOTION_QUERY,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
    }));
    Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: matchMedia });
    return matchMedia;
}

afterEach(() => {
    delete window.minit;
    delete (window as { matchMedia?: unknown }).matchMedia;
    setQuery("");
});

describe("prefersReducedMotion", () => {
    describe("?reducedMotion= override", () => {
        it.each(["1", "true"])("returns true with ?reducedMotion=%s even when host says false and matchMedia says false", (value) => {
            setHost({ prefersReducedMotion: false });
            stubMatchMedia(false);
            setQuery(`reducedMotion=${value}`);
            expect(prefersReducedMotion()).toBe(true);
        });

        it.each(["0", "false"])("returns false with ?reducedMotion=%s even when host says true and matchMedia says true", (value) => {
            setHost({ prefersReducedMotion: true });
            stubMatchMedia(true);
            setQuery(`reducedMotion=${value}`);
            expect(prefersReducedMotion()).toBe(false);
        });

        it.each(["yes", "2", ""])("ignores invalid ?reducedMotion=%s and uses the host value", (value) => {
            setHost({ prefersReducedMotion: true });
            stubMatchMedia(false);
            setQuery(`reducedMotion=${value}`);
            expect(prefersReducedMotion()).toBe(true);
        });

        it.each(["yes", "2", ""])("ignores invalid ?reducedMotion=%s and uses the matchMedia fallback without a host", (value) => {
            stubMatchMedia(true);
            setQuery(`reducedMotion=${value}`);
            expect(prefersReducedMotion()).toBe(true);
        });
    });

    describe("host prefersReducedMotion field", () => {
        it("returns true when the host says true, over a false matchMedia fallback", () => {
            setHost({ prefersReducedMotion: true });
            stubMatchMedia(false);
            expect(prefersReducedMotion()).toBe(true);
        });

        it("returns false when the host says false, over a true matchMedia fallback", () => {
            setHost({ prefersReducedMotion: false });
            stubMatchMedia(true);
            expect(prefersReducedMotion()).toBe(false);
        });

        it.each([
            ["the string \"true\"", "true"],
            ["the number 1", 1],
            ["null", null],
            ["an object", {}],
        ])("falls back to matchMedia when the host value is non-boolean (%s)", (_label, value) => {
            setHost({ prefersReducedMotion: value });
            stubMatchMedia(true);
            expect(prefersReducedMotion()).toBe(true);
        });

        it("falls back to matchMedia when an old host omits the field", () => {
            setHost({});
            stubMatchMedia(true);
            expect(prefersReducedMotion()).toBe(true);
        });
    });

    describe("no host (matchMedia fallback)", () => {
        it("returns true when (prefers-reduced-motion: reduce) matches", () => {
            const matchMedia = stubMatchMedia(true);
            expect(prefersReducedMotion()).toBe(true);
            expect(matchMedia).toHaveBeenCalledWith(REDUCED_MOTION_QUERY);
        });

        it("returns false when (prefers-reduced-motion: reduce) does not match", () => {
            stubMatchMedia(false);
            expect(prefersReducedMotion()).toBe(false);
        });

        it("returns false when matchMedia is unavailable", () => {
            expect(window.matchMedia).toBeUndefined();
            expect(prefersReducedMotion()).toBe(false);
        });
    });
});

describe("getMotionQuality", () => {
    describe("?motionQuality= override", () => {
        it("returns 'reduced' with ?motionQuality=reduced over a host 'full'", () => {
            setHost({ motionQuality: "full" });
            setQuery("motionQuality=reduced");
            expect(getMotionQuality()).toBe("reduced");
        });

        it("returns 'full' with ?motionQuality=full over a host 'reduced' and a reduced-motion preference", () => {
            setHost({ motionQuality: "reduced", prefersReducedMotion: true });
            stubMatchMedia(true);
            setQuery("motionQuality=full");
            expect(getMotionQuality()).toBe("full");
        });

        it("returns 'full' with ?motionQuality=full even when ?reducedMotion=1", () => {
            setQuery("motionQuality=full&reducedMotion=1");
            expect(getMotionQuality()).toBe("full");
        });

        it.each(["low", "1", ""])("ignores invalid ?motionQuality=%s and uses the host value", (value) => {
            setHost({ motionQuality: "reduced" });
            setQuery(`motionQuality=${value}`);
            expect(getMotionQuality()).toBe("reduced");
        });

        it.each(["low", "1", ""])("ignores invalid ?motionQuality=%s and uses the fallback without a host", (value) => {
            stubMatchMedia(true);
            setQuery(`motionQuality=${value}`);
            expect(getMotionQuality()).toBe("reduced");
        });
    });

    describe("host motionQuality field", () => {
        it("returns the host 'reduced' over a non-reduced fallback", () => {
            setHost({ motionQuality: "reduced", prefersReducedMotion: false });
            stubMatchMedia(false);
            expect(getMotionQuality()).toBe("reduced");
        });

        it("returns the host 'full' over a reduced-motion fallback", () => {
            setHost({ motionQuality: "full", prefersReducedMotion: true });
            stubMatchMedia(true);
            expect(getMotionQuality()).toBe("full");
        });

        it.each([
            ["an unknown string", "low"],
            ["the number 0", 0],
            ["a boolean", true],
            ["null", null],
        ])("falls back when the host value is invalid (%s)", (_label, value) => {
            setHost({ motionQuality: value });
            stubMatchMedia(true);
            expect(getMotionQuality()).toBe("reduced");
        });

        it("falls back when an old host omits the field", () => {
            setHost({});
            stubMatchMedia(true);
            expect(getMotionQuality()).toBe("reduced");
        });
    });

    describe("fallback follows prefersReducedMotion()", () => {
        it("returns 'reduced' when matchMedia reports a reduced-motion preference", () => {
            stubMatchMedia(true);
            expect(getMotionQuality()).toBe("reduced");
        });

        it("returns 'full' when matchMedia reports no reduced-motion preference", () => {
            stubMatchMedia(false);
            expect(getMotionQuality()).toBe("full");
        });

        it("returns 'full' when matchMedia is unavailable", () => {
            expect(getMotionQuality()).toBe("full");
        });

        it("returns 'reduced' when the host prefersReducedMotion is true and motionQuality is absent", () => {
            setHost({ prefersReducedMotion: true });
            stubMatchMedia(false);
            expect(getMotionQuality()).toBe("reduced");
        });

        it.each(["1", "true"])("returns 'reduced' with ?reducedMotion=%s and no host motionQuality", (value) => {
            stubMatchMedia(false);
            setQuery(`reducedMotion=${value}`);
            expect(getMotionQuality()).toBe("reduced");
        });

        it.each(["0", "false"])("returns 'full' with ?reducedMotion=%s despite a reduced-motion matchMedia", (value) => {
            stubMatchMedia(true);
            setQuery(`reducedMotion=${value}`);
            expect(getMotionQuality()).toBe("full");
        });

        it("keeps the host motionQuality over a ?reducedMotion= override", () => {
            setHost({ motionQuality: "full" });
            setQuery("reducedMotion=1");
            expect(getMotionQuality()).toBe("full");
        });
    });
});

describe("getDeviceTier", () => {
    describe("?deviceTier= override", () => {
        it.each(["low", "medium", "high", "unknown"])("returns '%s' from ?deviceTier= over a different host value", (value) => {
            setHost({ deviceTier: value === "high" ? "low" : "high" });
            setQuery(`deviceTier=${value}`);
            expect(getDeviceTier()).toBe(value);
        });

        it.each(["ultra", "HIGH", "1", ""])("ignores invalid ?deviceTier=%s and uses the host value", (value) => {
            setHost({ deviceTier: "medium" });
            setQuery(`deviceTier=${value}`);
            expect(getDeviceTier()).toBe("medium");
        });

        it.each(["ultra", "HIGH", "1", ""])("ignores invalid ?deviceTier=%s and returns 'unknown' without a host", (value) => {
            setQuery(`deviceTier=${value}`);
            expect(getDeviceTier()).toBe("unknown");
        });
    });

    describe("host deviceTier field", () => {
        it.each(["low", "medium", "high", "unknown"])("returns the host value '%s'", (value) => {
            setHost({ deviceTier: value });
            expect(getDeviceTier()).toBe(value);
        });

        it.each([
            ["an unknown string", "ultra"],
            ["the number 2", 2],
            ["a boolean", true],
            ["null", null],
        ])("returns 'unknown' when the host value is invalid (%s)", (_label, value) => {
            setHost({ deviceTier: value });
            expect(getDeviceTier()).toBe("unknown");
        });

        it("returns 'unknown' when an old host omits the field", () => {
            setHost({});
            expect(getDeviceTier()).toBe("unknown");
        });
    });

    describe("no host", () => {
        it.each([true, false])("returns 'unknown' regardless of matchMedia (reduce=%s)", (reduce) => {
            stubMatchMedia(reduce);
            expect(getDeviceTier()).toBe("unknown");
        });

        it("returns 'unknown' when matchMedia is unavailable", () => {
            expect(getDeviceTier()).toBe("unknown");
        });
    });
});
