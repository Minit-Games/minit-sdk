// Type-level surface tests for v1.3.0 breaking changes.
// These are checked by tsc (npm run check) — not executed at runtime.
import { getUserData } from "./userData.js";
import type { ResultOptions, MinitApi } from "../minitApi.js";

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
