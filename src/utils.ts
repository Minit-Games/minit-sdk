
export function getEnvironment() {
    return window.minit?.environment || "testing";
}

export function isApp() {
    return getEnvironment() === "app";
}

export function isTestEnvironment() {
    return getEnvironment() === "testing";
}

export function callApiFunction(callback: () => void, testMessage: string | (() => string)) {
    if(isTestEnvironment()) {
        const message = typeof testMessage === "string" ? testMessage : testMessage();
        console.log(`[DropSDK]`, message);
    }
    else {
        callback();
    }
}

export type Environment = ReturnType<typeof getEnvironment>;

// Backward-compat aliases
export const getDropEnvironment = getEnvironment;
export type DropEnvironment = Environment;
