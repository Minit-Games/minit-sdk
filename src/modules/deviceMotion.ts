import { browserWindow } from "../utils.js";

export type DeviceMotionPermission = "granted" | "denied" | "unsupported";

type PermissionEventConstructor = {
    requestPermission?: () => Promise<string>;
};

type PermissionWindow = Window & {
    DeviceMotionEvent?: PermissionEventConstructor;
    DeviceOrientationEvent?: PermissionEventConstructor;
};

export async function requestDeviceMotionPermission(): Promise<DeviceMotionPermission> {
    if (typeof window === "undefined") return "unsupported";

    const sdkWindow = browserWindow() as PermissionWindow;
    const motionEvent = sdkWindow.DeviceMotionEvent;
    if (!motionEvent) return "unsupported";
    if (typeof motionEvent.requestPermission !== "function") return "granted";

    try {
        const requests = [motionEvent.requestPermission()];
        const orientationEvent = sdkWindow.DeviceOrientationEvent;
        if (typeof orientationEvent?.requestPermission === "function") {
            requests.push(orientationEvent.requestPermission());
        }

        const permissions = await Promise.all(requests);
        return permissions.every((permission) => permission === "granted") ? "granted" : "denied";
    } catch {
        return "denied";
    }
}
