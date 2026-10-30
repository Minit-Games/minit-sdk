/**
 * @jest-environment node
 */
import { getDeviceTier, getMotionQuality, prefersReducedMotion } from "./deviceCapabilities.js";

describe("device capability getters without a window (SSR)", () => {
    it("runs with window undefined", () => {
        expect(typeof window).toBe("undefined");
    });

    it("getMotionQuality returns 'full'", () => {
        expect(getMotionQuality()).toBe("full");
    });

    it("prefersReducedMotion returns false", () => {
        expect(prefersReducedMotion()).toBe(false);
    });

    it("getDeviceTier returns 'unknown'", () => {
        expect(getDeviceTier()).toBe("unknown");
    });
});
