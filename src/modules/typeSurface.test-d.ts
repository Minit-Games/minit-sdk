// Type-level surface tests for v1.3.0 breaking changes.
// These are checked by tsc (npm run check) — not executed at runtime.
import { getUserData } from "./userData.js";
import type { ResultOptions, MinitApi } from "../minitApi.js";
import { getMotionQuality, prefersReducedMotion, getDeviceTier } from "../index.js";
import type { MotionQuality, DeviceTier } from "../index.js";

// --- getUserData ---

// Valid: parameterless call
const _a: string | undefined = getUserData();

// Invalid: old keyed signature must be a TypeScript error
// @ts-expect-error getUserData no longer accepts a key argument
getUserData("key");

// --- ResultOptions userData ---

// Valid: string
const _opts1: ResultOptions = { userData: "hello" };
// Valid: empty string
const _opts2: ResultOptions = { userData: "" };
// Valid: omitted
const _opts3: ResultOptions = {};

// Invalid: old { key, value } object shape must be a TypeScript error
// @ts-expect-error userData must be a string, not { key, value }
const _opts4: ResultOptions = { userData: { key: "foo", value: "bar" } };

// --- MinitApi.sdkVersion removal (DROP-3936) ---
//
// `sdkVersion` was a behavior-inert host-contract field that drifted three
// ways across surfaces (1.3.0 live / 1.0.0 legacy stub / 1.7.2 npm package)
// with nothing branching on it, so it was removed from MinitApi entirely.
// Constructing a MinitApi value WITHOUT it must compile cleanly — this guards
// against `sdkVersion` being reintroduced as a required field.
const _minitApiNoSdkVersion: MinitApi = {
    environment: "web",
    dropConfig: {},
    reportResult: () => {},
    loadingDone: () => {},
};

// Invalid: `sdkVersion` must be an excess property on MinitApi, not merely
// omittable. Assigning an object literal that includes it relies on
// TypeScript's excess-property check, which only fires for a property that
// does not exist on the target type at all. If `sdkVersion` is reintroduced
// — even as an optional field — the literal below stops being excess and
// this assertion stops erroring, so the `@ts-expect-error` becomes unused
// and `npm run check` fails, catching the regression this test guards against.
// @ts-expect-error sdkVersion must not be a valid MinitApi property
const _minitApiWithSdkVersion: MinitApi = { environment: "web", dropConfig: {}, reportResult: () => {}, loadingDone: () => {}, sdkVersion: "1.7.2" };

// --- MinitApi.hasPlayedGame (optional; absent on older hosts) ---

const _minitApiHasPlayedGame: MinitApi = { environment: "web", dropConfig: {}, reportResult: () => {}, loadingDone: () => {}, hasPlayedGame: true };
const _minitApiNoHasPlayedGame: MinitApi = { environment: "web", dropConfig: {}, reportResult: () => {}, loadingDone: () => {} };
// @ts-expect-error hasPlayedGame must be a boolean
const _minitApiStringHasPlayedGame: MinitApi = { environment: "web", dropConfig: {}, reportResult: () => {}, loadingDone: () => {}, hasPlayedGame: "true" };

// --- Device capability getters and their exported types ---

const _motionQuality: MotionQuality = getMotionQuality();
const _motionQualityUnion: "full" | "reduced" = _motionQuality;
const _motionQualityFull: MotionQuality = "full";
const _motionQualityReduced: MotionQuality = "reduced";
// @ts-expect-error MotionQuality is only "full" | "reduced"
const _motionQualityInvalid: MotionQuality = "low";

const _prefersReducedMotion: boolean = prefersReducedMotion();
// @ts-expect-error prefersReducedMotion returns a boolean, not a string
const _prefersReducedMotionString: string = prefersReducedMotion();

const _deviceTier: DeviceTier = getDeviceTier();
const _deviceTierUnion: "low" | "medium" | "high" | "unknown" = _deviceTier;
const _deviceTiers: DeviceTier[] = ["low", "medium", "high", "unknown"];
// @ts-expect-error DeviceTier is only "low" | "medium" | "high" | "unknown"
const _deviceTierInvalid: DeviceTier = "ultra";

// --- MinitApi device capability fields (optional; absent on older hosts) ---

const _minitApiDeviceCapabilities: MinitApi = { environment: "app", dropConfig: {}, reportResult: () => {}, loadingDone: () => {}, deviceTier: "medium", motionQuality: "reduced", prefersReducedMotion: true };
const _minitApiPartialDeviceCapabilities: MinitApi = { environment: "app", dropConfig: {}, reportResult: () => {}, loadingDone: () => {}, deviceTier: "unknown" };
// @ts-expect-error deviceTier must be a DeviceTier
const _minitApiInvalidDeviceTier: MinitApi = { environment: "app", dropConfig: {}, reportResult: () => {}, loadingDone: () => {}, deviceTier: "ultra" };
// @ts-expect-error motionQuality must be a MotionQuality
const _minitApiInvalidMotionQuality: MinitApi = { environment: "app", dropConfig: {}, reportResult: () => {}, loadingDone: () => {}, motionQuality: "low" };
// @ts-expect-error prefersReducedMotion must be a boolean
const _minitApiStringPrefersReducedMotion: MinitApi = { environment: "app", dropConfig: {}, reportResult: () => {}, loadingDone: () => {}, prefersReducedMotion: "true" };
