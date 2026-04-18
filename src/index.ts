import { addDropBackground } from "./modules/background";
import type { DropBackground } from "./modules/background";
import { getDropConfig } from "./modules/config";
import { applyDropMetaTags } from "./modules/meta";
import { getDropEnvironment, isTestEnvironment } from "./utils";

export { getDropConfig, getDropConfigValue } from "./modules/config";
export { reportDropResult } from "./modules/result";
export { loadingDone } from "./modules/loadingDone";
export { seededRandom, patchSeed } from "./modules/random";
export type { RandomModule } from "./modules/random";
export { addDropBackground } from "./modules/background";
export type { DropBackground, ShadowOptions, ShapeOptions, ImageOptions } from "./modules/background";
export { applyDropMetaTags } from "./modules/meta";
export { getDropEnvironment, isApp, isTestEnvironment, callApiFunction } from "./utils";
export type { DropEnvironment } from "./utils";
export type { DropResultOptions, MinitApi } from "./minitApi";

export interface SDKConfig {
    metaTags?: boolean;
    background?: DropBackground;
}

export function initializeDropSDK(config?: SDKConfig): void {

    if(config?.metaTags === true)
    {
        applyDropMetaTags();
    }

    if(config)
    {
        if(config.background) {
            addDropBackground(config.background);
        }
    }

    // Backward-compat shim: keep window.dropApi pointing at window.minit
    // so existing published games that reference window.dropApi still work.
    if (window.minit) {
        window.dropApi = window.minit;
    }

    console.log("[DropSDK] Applied for environment:", getDropEnvironment(), ", SDK Version:", window.minit?.sdkVersion || "unknown");
    if(isTestEnvironment()) {
        console.log("[DropSDK] Config", getDropConfig());
    }

}
