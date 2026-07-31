const audioContexts = new Set<AudioContext>();
const mediaElements = new Set<HTMLMediaElement>();

// These sets contain only items whose state was changed by the visibility
// handler, so an item that was already paused or suspended is not resumed.
const suspendedByVisibility = new Set<AudioContext>();
const pausedByVisibility = new Set<HTMLMediaElement>();

let listenerInstalled = false;

// Audio sources not explicitly registered here are intentionally unaffected.
export function registerAudioContext(context: AudioContext): void {
    audioContexts.add(context);
}

export function registerAudioElement(element: HTMLMediaElement): void {
    mediaElements.add(element);
}

function handleVisibilityChange(): void {
    if (document.hidden) {
        for (const context of audioContexts) {
            if (context.state === "running" && !suspendedByVisibility.has(context)) {
                suspendedByVisibility.add(context);
                void context.suspend().catch(() => {
                    suspendedByVisibility.delete(context);
                });
            }
        }

        for (const element of mediaElements) {
            if (!element.paused && !pausedByVisibility.has(element)) {
                pausedByVisibility.add(element);
                element.pause();
            }
        }

        return;
    }

    for (const context of suspendedByVisibility) {
        suspendedByVisibility.delete(context);
        if (context.state === "suspended") {
            void context.resume().catch(() => {});
        }
    }

    for (const element of pausedByVisibility) {
        pausedByVisibility.delete(element);
        if (element.paused) {
            void element.play().catch(() => {});
        }
    }
}

export function installAudioVisibilityListener(): void {
    if (listenerInstalled) {
        return;
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    listenerInstalled = true;
}
