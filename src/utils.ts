

export function getDropEnvironment() {
    return window.minit?.environment || "testing";
}

export function isApp() {
    return getDropEnvironment() === "app";
}

export function isTestEnvironment() {
    return getDropEnvironment() === "testing";
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

export type DropEnvironment = ReturnType<typeof getDropEnvironment>;
