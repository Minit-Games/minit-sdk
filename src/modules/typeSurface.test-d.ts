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
// with nothing branching on it. It is being removed from MinitApi entirely:
// constructing a MinitApi value WITHOUT it must compile cleanly. Until the
// field is actually removed from MinitApi, `sdkVersion` stays a required
// string, so the object below (which omits it) is a genuine, UNSUPPRESSED
// compile error today — the expected red state for this ticket.
const _minitApiNoSdkVersion: MinitApi = {
    environment: "web",
    dropConfig: {},
    reportResult: () => {},
    loadingDone: () => {},
};
