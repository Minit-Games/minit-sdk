/**
 * Tests for initializeSDK()'s console output (DROP-3936 — red phase, written
 * before the implementation).
 *
 * Contract under test (see DROP-3936): `window.minit.sdkVersion` was a
 * behavior-inert host-contract field that drifted three ways across surfaces
 * (1.3.0 live / 1.0.0 legacy stub / 1.7.2 npm package) with nothing branching
 * on it. It is being removed from the contract entirely, so
 * `initializeSDK()` must stop logging it — not merely log a corrected value.
 * console.log is silenced/captured, matching the pattern used by
 * random.test.ts.
 */

import { initializeSDK } from "./index";

describe("initializeSDK — console output", () => {
    afterEach(() => {
        jest.restoreAllMocks();
        delete window.minit;
    });

    it("does not log 'SDK Version:' anymore", () => {
        const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

        initializeSDK();

        const loggedText = logSpy.mock.calls.map((args) => args.join(" ")).join("\n");
        expect(loggedText).not.toContain("SDK Version:");
    });
});
