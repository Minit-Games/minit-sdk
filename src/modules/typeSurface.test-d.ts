// Type-level surface tests for v1.3.0 breaking changes.
// These are checked by tsc (npm run check) — not executed at runtime.
import { getUserData } from "./userData.js";
import type { ResultOptions } from "../minitApi.js";

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
