import { callApiFunction, isTestEnvironment } from "../utils.js";
import { recordTrackedEvent } from "./trackDevBuffer.js";

let _loadingDonePosted = false;

export function loadingDone(): void {
    if (_loadingDonePosted) {
        return;
    }
    _loadingDonePosted = true;

    if (isTestEnvironment()) {
        recordTrackedEvent("minit.loading_done", {});
        return;
    }

    callApiFunction(() => { window.minit?.loadingDone(); }, 'loadingDone');
}
