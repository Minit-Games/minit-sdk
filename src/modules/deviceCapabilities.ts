export type MotionQuality = "full" | "reduced";

export type DeviceTier = "low" | "medium" | "high" | "unknown";

export function prefersReducedMotion(): boolean {
    return false;
}

export function getMotionQuality(): MotionQuality {
    return "full";
}

export function getDeviceTier(): DeviceTier {
    return "unknown";
}
