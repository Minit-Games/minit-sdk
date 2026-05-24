import { MinitApi } from "./minitApi.js";

declare global {
    interface Window {
        minit?: MinitApi;
        dropApi?: MinitApi; // backward-compat alias — set by SDK initialization
    }
}

export {};
