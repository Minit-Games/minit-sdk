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
                void context.suspend().then(
                    () => {
                        // The tab may have already become visible again
                        // while suspend() was in flight; if so, resume now
                        // instead of leaving the context stuck suspended
                        // with nothing left tracking it for a resume. Only
                        // clear tracking once resume() actually succeeds so
                        // a rejection is retried on the next visibility
                        // toggle instead of being silently dropped.
                        if (!document.hidden && suspendedByVisibility.has(context)) {
                            void context.resume().then(
                                () => suspendedByVisibility.delete(context),
                                () => {}
                            );
                        }
                    },
                    () => {
                        suspendedByVisibility.delete(context);
                    }
                );
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
        // Only act on contexts whose suspend() has already settled; one
        // still in flight resumes itself once it settles (see above), so
        // deleting it from the set here would drop it while visible.
        if (context.state === "suspended") {
            // Keep tracking on rejection so the next visibility toggle
            // retries the resume() instead of leaving it silently suspended.
            void context.resume().then(
                () => suspendedByVisibility.delete(context),
                () => {}
            );
        } else {
            suspendedByVisibility.delete(context);
        }
    }

    for (const element of pausedByVisibility) {
        if (element.paused) {
            // Keep tracking on rejection so the next visibility toggle
            // retries the play() instead of leaving it silently paused.
            void element.play().then(
                () => pausedByVisibility.delete(element),
                () => {}
            );
        } else {
            pausedByVisibility.delete(element);
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
