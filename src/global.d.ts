import { MinitApi } from "./minitApi";

declare global {
    interface Window {
        minit?: MinitApi;
        dropApi?: MinitApi; // backward-compat alias — set by SDK initialization
        ReactNativeWebView?: {
            postMessage: (message: string) => void;
        };
    }
}

export {};
