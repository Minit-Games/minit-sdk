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

import * as sdk from "./index";
import { initializeSDK } from "./index";
import { track } from "./modules/track";

describe("public exports", () => {
    it("re-exports track from the package entry point", () => {
        const exported = (sdk as unknown as Record<string, unknown>).track;
        expect(typeof exported).toBe("function");
        expect(exported).toBe(track);
    });
});

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
