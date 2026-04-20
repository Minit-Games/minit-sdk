import { callApiFunction, isTestEnvironment } from "../utils";

let _loadingDonePosted = false;

export function loadingDone(): void {
    if (_loadingDonePosted) {
        return;
    }
    _loadingDonePosted = true;

    if (isTestEnvironment()) {
        return;
    }

    callApiFunction(() => { window.minit?.loadingDone(); }, 'loadingDone');
}
