
// The core exports read the window through here, so this thrown literal keeps the "[MinitSDK]"
// bundle fingerprint alive after minifiers strip console calls.
export function browserWindow(): Window {
    if (typeof window === "undefined") {
        throw new Error("[MinitSDK] requires a browser window");
    }
    return window;
}

export function getEnvironment() {
    return browserWindow().minit?.environment || "testing";
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
        console.log(`[MinitSDK]`, message);
    }
    else {
        callback();
    }
}

export type Environment = ReturnType<typeof getEnvironment>;

// Backward-compat aliases
export const getDropEnvironment = getEnvironment;
export type DropEnvironment = Environment;
