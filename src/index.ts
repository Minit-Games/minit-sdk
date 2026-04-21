import { addBackground } from "./modules/background";
import type { Background } from "./modules/background";
import { getConfig } from "./modules/config";
import { applyMetaTags } from "./modules/meta";
import { getEnvironment, isTestEnvironment } from "./utils";

// New clean names
export { getConfig, getConfigValue } from "./modules/config";
export { reportResult } from "./modules/result";
export { getUserData } from "./modules/userData";
export { loadingDone } from "./modules/loadingDone";
export { seededRandom, patchSeed } from "./modules/random";
export type { RandomModule } from "./modules/random";
export { addBackground } from "./modules/background";
export type { Background, ShadowOptions, ShapeOptions, ImageOptions } from "./modules/background";
export { applyMetaTags } from "./modules/meta";
export { getEnvironment, isApp, isTestEnvironment, callApiFunction } from "./utils";
export type { Environment } from "./utils";
export type { ResultOptions, MinitApi } from "./minitApi";

// Backward-compat aliases
export { getDropConfig, getDropConfigValue } from "./modules/config";
export { reportDropResult } from "./modules/result";
export { addDropBackground } from "./modules/background";
export type { DropBackground } from "./modules/background";
export { applyDropMetaTags } from "./modules/meta";
export { getDropEnvironment } from "./utils";
export type { DropEnvironment } from "./utils";
export type { DropResultOptions } from "./minitApi";

export interface SDKConfig {
    metaTags?: boolean;
    background?: Background;
}

export function initializeSDK(config?: SDKConfig): void {

    if(config?.metaTags === true)
    {
        applyMetaTags();
    }

    if(config)
    {
        if(config.background) {
            addBackground(config.background);
        }
    }

    // Backward-compat shim: keep window.dropApi pointing at window.minit
    // so existing published games that reference window.dropApi still work.
    if (window.minit) {
        window.dropApi = window.minit;
    }

    console.log("[DropSDK] Applied for environment:", getEnvironment(), ", SDK Version:", window.minit?.sdkVersion || "unknown");
    if(isTestEnvironment()) {
        console.log("[DropSDK] Config", getConfig());
    }

}

// Backward-compat alias
export const initializeDropSDK = initializeSDK;
