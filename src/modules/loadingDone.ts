import { callApiFunction, isTestEnvironment } from "../utils.js";
import { markPlayStarted, recordTrackedEvent } from "./trackDevBuffer.js";
import { showTrackDevPanel } from "./trackDevPanelLoader.js";

let _loadingDonePosted = false;

export function loadingDone(): void {
    if (_loadingDonePosted) {
        return;
    }
    _loadingDonePosted = true;

    if (isTestEnvironment()) {
        markPlayStarted();
        recordTrackedEvent("minit.loading_done", {});
        showTrackDevPanel();
        return;
    }

    callApiFunction(() => { window.minit?.loadingDone(); }, 'loadingDone');
}
