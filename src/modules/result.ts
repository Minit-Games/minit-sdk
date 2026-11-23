import type { ResultOptions, HostResultOptions } from "../minitApi.js";
import { callApiFunction, isTestEnvironment } from "../utils.js";
import { closeTrackingAfterResult } from "./track.js";
import { getPlayDurationMs, recordReportedResult, recordResultPending, recordTrackedEvent } from "./trackDevBuffer.js";
import { showTrackDevPanel } from "./trackDevPanelLoader.js";
import { USER_DATA_MAX_BYTES } from "./userData.js";

// Hand-copied from packages/shared/src/creatorLimits.ts in the minit-root monorepo;
// minit-sdk cannot import across repositories.
const FLAVOR_TEXT_MAX_LENGTH = 64;

/**
 * Reports the run's outcome to the host and triggers its result screen. Call once, when the run ends.
 *
 * @param result A number for score/time games, or a result-group string (e.g. `'WIN'`).
 *   **For time-based games (`resultSorting: "fastestTime" | "slowestTime"`) the number is
 *   SECONDS, not milliseconds** — fractions are allowed (`42.5`). Pass `elapsedMs / 1000`.
 * @param options Optional `flavorText`, `userData`, `delay` (ms).
 */
export function reportResult(result: number|string, options?: ResultOptions): void {
    closeTrackingAfterResult();

    if(isTestEnvironment()) {

        recordTrackedEvent("minit.result", {});
        showTrackDevPanel();
        const reported = {
            result,
            flavorText: options?.flavorText,
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
