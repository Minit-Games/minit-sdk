import type { ResultOptions, HostResultOptions } from "../minitApi.js";
import { callApiFunction, isTestEnvironment } from "../utils.js";
import { closeTrackingAfterResult } from "./track.js";
import {
    getPlayDurationMs,
    recordDroppedSummary,
    recordReportedResult,
    recordResultPending,
    recordTrackedEvent,
} from "./trackDevBuffer.js";
import { showTrackDevPanel } from "./trackDevPanelLoader.js";
import { USER_DATA_MAX_BYTES } from "./userData.js";

// Hand-copied from packages/shared/src/creatorLimits.ts in the minit-root monorepo;
// minit-sdk cannot import across repositories.
const FLAVOR_TEXT_MAX_LENGTH = 64;

// Mirrors the app's getStarsFromPercentage. Dev mode has no other players' results, and the
// host ranks a result at the 100th percentile until a game has more than 3 of them.
const DEV_RESULT_PERCENTILE = 100;

function starsFromPercentile(percentile: number): number {
    if (percentile >= 67) {
        return 3;
    }
    return percentile >= 34 ? 2 : 1;
}

/**
 * Reports the run's outcome to the host and triggers its result screen. Call once, when the run ends.
 *
 * @param result A number for score/time games, or a result-group string (e.g. `'WIN'`).
 *   **For time-based games (`resultSorting: "fastestTime" | "slowestTime"`) the number is
 *   SECONDS, not milliseconds** — fractions are allowed (`42.5`). Pass `elapsedMs / 1000`.
 * @param options Optional `flavorText`, `userData`, `delay` (ms).
 */
export function reportResult(result: number|string, options?: ResultOptions): void {
    if(typeof result !== "number" && typeof result !== "string") {
        console.warn(`[MinitSDK] reportResult(result) expects a number or a string, got ${typeof result}; the result was ignored and no result screen is shown.`);
        return;
    }
    // Matches the host's track script: a non-finite number is not a play result, so tracking stays open.
    const closesTracking = typeof result === "string" || Number.isFinite(result);
    if (closesTracking) {
        closeTrackingAfterResult();
    }

    if(isTestEnvironment()) {

        const flavorText = options?.flavorText;
        const stars = starsFromPercentile(DEV_RESULT_PERCENTILE);
        if (closesTracking) {
            const t = Math.round(performance.now());
            recordDroppedSummary(t);
            recordTrackedEvent("minit.result", typeof flavorText === "string" ? { result, stars, flavorText } : { result, stars }, undefined, t);
        }
        showTrackDevPanel();
        const reported = {
            result,
            stars,
            flavorText,
            userData: typeof options?.userData === "string" ? options.userData : undefined,
            durationMs: getPlayDurationMs(),
        };
        const delay = options?.delay ?? 0;
        if (delay > 0) {
            recordResultPending(delay);
        }
        setTimeout(() => recordReportedResult(reported), delay);
    }

    // Build the host-facing options, forwarding the single-key userData if present.
    const hostOptions: HostResultOptions | undefined = buildHostOptions(options);

    callApiFunction(() => {
        window.minit?.reportResult(result, hostOptions);
    }, `reportResult => ${result}\nOptions: ${JSON.stringify(hostOptions)}`);
}

/**
 * Converts public `ResultOptions` to the wire-format `HostResultOptions`.
 *
 * The `userData` field, when present as a bare string, is wrapped into
 * `{ value: string }` to match `UserDataPatchSchema` in `@minit/shared/zod`.
 * When absent (`undefined`) or not provided, the host payload omits the field.
 * An empty string `""` is a valid value and is forwarded to the host as `{ value: "" }`.
 *
 * Runtime guard: only values that satisfy `typeof userData === "string"` are
 * wrapped and forwarded. Any other value — `null`, number, object, array, or
 * `undefined` — is treated as "omit userData", regardless of TypeScript type
 * assertions. This prevents JS consumers (or `as any` casts) from producing
 * an invalid host wire shape such as `{ value: null }`.
 */
function buildHostOptions(options?: ResultOptions): HostResultOptions | undefined {
    if (!options) return undefined;

    const { userData, ...rest } = options;

    if (typeof options.flavorText === "string" && options.flavorText.length > FLAVOR_TEXT_MAX_LENGTH) {
        console.warn(
            `[MinitSDK] flavorText is ${options.flavorText.length} characters; the ${FLAVOR_TEXT_MAX_LENGTH}-character cap is exceeded, so the platform will truncate it.`,
        );
    }

    if (typeof userData === "string" && typeof TextEncoder !== "undefined") {
        const userDataBytes = new TextEncoder().encode(userData).length;
        if (userDataBytes > USER_DATA_MAX_BYTES) {
            console.warn(
                `[MinitSDK] userData is ${userDataBytes} UTF-8 bytes; the ${USER_DATA_MAX_BYTES}-byte cap is exceeded, so the platform will discard it.`,
            );
        }
    }

    if (typeof userData !== "string") {
        return Object.keys(rest).length > 0 ? rest : undefined;
    }

    return { ...rest, userData: { value: userData } };
}

// Backward-compat alias
export const reportDropResult = reportResult;
