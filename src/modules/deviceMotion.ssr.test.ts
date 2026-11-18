/**
 * @jest-environment node
 */
describe("requestDeviceMotionPermission without a window (SSR)", () => {
    it("runs with window undefined", () => {
        expect(typeof window).toBe("undefined");
    });

    it("imports without throwing", () => {
        expect(() => require("./deviceMotion.js")).not.toThrow();
    });

    it("resolves 'unsupported'", async () => {
        const { requestDeviceMotionPermission } = await import("./deviceMotion.js");
        await expect(requestDeviceMotionPermission()).resolves.toBe("unsupported");
    });
});
