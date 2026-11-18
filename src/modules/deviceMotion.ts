import { browserWindow } from "../utils.js";

export type DeviceMotionPermission = "granted" | "denied" | "unsupported";

type PermissionEventConstructor = {
    requestPermission?: () => Promise<string>;
};

type PermissionWindow = Window & {
    DeviceMotionEvent?: PermissionEventConstructor;
    DeviceOrientationEvent?: PermissionEventConstructor;
};

/**
 * Request access to the device motion and orientation sensors. Never rejects.
 *
 * Call it synchronously from a `click`, `pointerup`, or `touchend` handler —
 * not `pointerdown`/`touchstart`, which iOS does not treat as a user
 * activation: there it resolves `"denied"` without ever showing a prompt.
 *
 * `"granted"` only means the browser allows listening (desktop browsers grant
 * with no sensor). Switch to tilt once a real `deviceorientation` event
 * arrives, and keep a touch fallback for every result.
 */
export async function requestDeviceMotionPermission(): Promise<DeviceMotionPermission> {
    if (typeof window === "undefined") return "unsupported";

    const sdkWindow = browserWindow() as PermissionWindow;
    const motionEvent = sdkWindow.DeviceMotionEvent;
    if (!motionEvent) return "unsupported";
    if (typeof motionEvent.requestPermission !== "function") return "granted";

    const requests = [isGranted(motionEvent)];
    const orientationEvent = sdkWindow.DeviceOrientationEvent;
    if (typeof orientationEvent?.requestPermission === "function") {
        requests.push(isGranted(orientationEvent));
    }

    const grants = await Promise.all(requests);
    return grants.every(Boolean) ? "granted" : "denied";
}

async function isGranted(event: PermissionEventConstructor): Promise<boolean> {
    try {
        return (await event.requestPermission?.()) === "granted";
    } catch {
        return false;
    }
}
