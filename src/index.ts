import { addBackground } from "./modules/background.js";
import type { Background } from "./modules/background.js";
import { getConfig } from "./modules/config.js";
import { applyMetaTags } from "./modules/meta.js";
import { installAudioVisibilityListener } from "./modules/audioVisibility.js";
import { getEnvironment, isTestEnvironment } from "./utils.js";

// New clean names
export { getConfig, getConfigValue } from "./modules/config.js";
export { reportResult } from "./modules/result.js";
export { getUserData } from "./modules/userData.js";
export { loadingDone } from "./modules/loadingDone.js";
export { seededRandom, patchSeed } from "./modules/random.js";
export type { RandomModule } from "./modules/random.js";
export { addBackground } from "./modules/background.js";
export type { Background, ShadowOptions, ShapeOptions, ImageOptions } from "./modules/background.js";
export { applyMetaTags } from "./modules/meta.js";
export { getEnvironment, isApp, isTestEnvironment, callApiFunction } from "./utils.js";
export type { Environment } from "./utils.js";
export type { ResultOptions, MinitApi } from "./minitApi.js";

// Backward-compat aliases
export { getDropConfig, getDropConfigValue } from "./modules/config.js";
export { reportDropResult } from "./modules/result.js";
export { addDropBackground } from "./modules/background.js";
export type { DropBackground } from "./modules/background.js";
export { applyDropMetaTags } from "./modules/meta.js";
export { getDropEnvironment } from "./utils.js";
export type { DropEnvironment } from "./utils.js";
export type { DropResultOptions } from "./minitApi.js";

export interface SDKConfig {
    metaTags?: boolean;
    background?: Background;
}

export function initializeSDK(config?: SDKConfig): void {

    installAudioVisibilityListener();

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

    console.log("[MinitSDK] Applied for environment:", getEnvironment(), ", SDK Version:", window.minit?.sdkVersion || "unknown");
    if(isTestEnvironment()) {
        console.log("[MinitSDK] Config", getConfig());
    }

}

// Backward-compat alias
export const initializeDropSDK = initializeSDK;
