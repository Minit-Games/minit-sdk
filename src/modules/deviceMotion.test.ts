import { requestDeviceMotionPermission } from "./deviceMotion.js";
import { requestDeviceMotionPermission as requestFromIndex } from "../index.js";

type RequestPermission = jest.Mock<Promise<string>, []>;

const EVENT_NAMES = ["DeviceMotionEvent", "DeviceOrientationEvent"] as const;

function installEvent(name: (typeof EVENT_NAMES)[number], requestPermission?: RequestPermission): void {
    const EventClass = class {} as unknown as Record<string, unknown>;
    if (requestPermission) EventClass.requestPermission = requestPermission;
    Object.defineProperty(window, name, { configurable: true, writable: true, value: EventClass });
}

function resolvesWith(value: string): RequestPermission {
    return jest.fn(() => Promise.resolve(value));
}

afterEach(() => {
    for (const name of EVENT_NAMES) Reflect.deleteProperty(window, name);
});

describe("requestDeviceMotionPermission", () => {
    it("is exported from the package entry point", () => {
        expect(requestFromIndex).toBe(requestDeviceMotionPermission);
    });

    it("resolves 'unsupported' when DeviceMotionEvent is missing", async () => {
        await expect(requestDeviceMotionPermission()).resolves.toBe("unsupported");
    });

    it("resolves 'unsupported' without prompting when only DeviceOrientationEvent exists", async () => {
        const orientation = resolvesWith("granted");
        installEvent("DeviceOrientationEvent", orientation);

        await expect(requestDeviceMotionPermission()).resolves.toBe("unsupported");
        expect(orientation).not.toHaveBeenCalled();
    });

    it("resolves 'granted' when DeviceMotionEvent has no requestPermission (Android, desktop)", async () => {
        installEvent("DeviceMotionEvent");
        installEvent("DeviceOrientationEvent");

        await expect(requestDeviceMotionPermission()).resolves.toBe("granted");
    });

    it("resolves 'granted' when both DeviceMotionEvent and DeviceOrientationEvent grant", async () => {
        const motion = resolvesWith("granted");
        const orientation = resolvesWith("granted");
        installEvent("DeviceMotionEvent", motion);
        installEvent("DeviceOrientationEvent", orientation);

        await expect(requestDeviceMotionPermission()).resolves.toBe("granted");
        expect(motion).toHaveBeenCalledTimes(1);
        expect(orientation).toHaveBeenCalledTimes(1);
    });

    it("resolves 'denied' when DeviceMotionEvent grants but DeviceOrientationEvent denies", async () => {
        const orientation = resolvesWith("denied");
        installEvent("DeviceMotionEvent", resolvesWith("granted"));
        installEvent("DeviceOrientationEvent", orientation);

        await expect(requestDeviceMotionPermission()).resolves.toBe("denied");
        expect(orientation).toHaveBeenCalledTimes(1);
    });

    it("resolves 'denied' when DeviceMotionEvent denies but DeviceOrientationEvent grants", async () => {
        installEvent("DeviceMotionEvent", resolvesWith("denied"));
        installEvent("DeviceOrientationEvent", resolvesWith("granted"));

        await expect(requestDeviceMotionPermission()).resolves.toBe("denied");
    });

    it("resolves 'denied' when a request resolves with anything other than 'granted'", async () => {
        installEvent("DeviceMotionEvent", resolvesWith("default"));
        installEvent("DeviceOrientationEvent", resolvesWith("granted"));

        await expect(requestDeviceMotionPermission()).resolves.toBe("denied");
    });

    it("resolves 'denied' instead of rejecting when requestPermission rejects", async () => {
        installEvent("DeviceMotionEvent", jest.fn(() => Promise.reject(new Error("NotAllowedError"))));
        installEvent("DeviceOrientationEvent", resolvesWith("granted"));

        await expect(requestDeviceMotionPermission()).resolves.toBe("denied");
    });

    it("resolves 'denied' instead of rejecting when requestPermission throws synchronously", async () => {
        installEvent("DeviceMotionEvent", resolvesWith("granted"));
        installEvent("DeviceOrientationEvent", jest.fn(() => {
            throw new Error("must be called from a user gesture");
        }));

        await expect(requestDeviceMotionPermission()).resolves.toBe("denied");
    });

    describe("only DeviceMotionEvent has requestPermission", () => {
        it.each(["granted", "denied"])("resolves '%s' from the motion request alone when DeviceOrientationEvent has no requestPermission", async (answer) => {
            const motion = resolvesWith(answer);
            installEvent("DeviceMotionEvent", motion);
            installEvent("DeviceOrientationEvent");

            await expect(requestDeviceMotionPermission()).resolves.toBe(answer);
            expect(motion).toHaveBeenCalledTimes(1);
        });

        it.each(["granted", "denied"])("resolves '%s' from the motion request alone when DeviceOrientationEvent is missing", async (answer) => {
            installEvent("DeviceMotionEvent", resolvesWith(answer));

            await expect(requestDeviceMotionPermission()).resolves.toBe(answer);
        });
    });
});
