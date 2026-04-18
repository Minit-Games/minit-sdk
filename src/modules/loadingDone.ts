import { isTestEnvironment } from "../utils";

let _loadingDonePosted = false;

export function loadingDone(): void {
    if (_loadingDonePosted) {
        return;
    }
    _loadingDonePosted = true;

    if (isTestEnvironment()) {
        return;
    }

    if (!window.ReactNativeWebView) {
        return;
    }

    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'minitApi.loadingDone' }));
}
