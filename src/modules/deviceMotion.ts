export type DeviceMotionPermission = "granted" | "denied" | "unsupported";

export async function requestDeviceMotionPermission(): Promise<DeviceMotionPermission> {
    throw new Error("not implemented");
}
