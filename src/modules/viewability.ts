/**
 * SDK viewability facade (DROP-8666) — mirrors the host viewability signal
 * so Minit games can pause when covered.
 *
 * Host present (with the new methods) -> thin delegation to
 * `window.minit.isViewable()` / `window.minit.addEventListener(
 * "viewableChange", ...)` / `removeEventListener(...)`.
 *
 * Local-dev fallback (no `window.minit`, or an older host missing these
 * methods): `isViewable()` mirrors `document.visibilityState === "visible"`;
 * `onViewableChange` is driven by `document.visibilitychange`. Never throws
 * on an older host.
 *
 * `window.minit` presence/method-availability is re-checked on every
 * `isViewable()` call — never cached — so a call made before the host
 * appears falls back, then upgrades to host delegation on a later call once
 * the host appears. `onViewableChange` picks its delivery mechanism (host vs.
 * document) once, at subscribe time — there's no requirement to upgrade an
 * already-active subscription mid-flight.
 */

type ViewableChangeHandler = (viewable: boolean) => void;

// One subscription per user-supplied `fn` reference, so a duplicate
// `onViewableChange(fn)` call is a no-op instead of creating a second
// delivery path (and thus a double delivery).
const subscriptions = new Map<ViewableChangeHandler, () => void>();

export function isViewable(): boolean {
    const host = window.minit;
    if (host && typeof host.isViewable === "function") {
        return host.isViewable();
    }
    return document.visibilityState === "visible";
}

export function onViewableChange(fn: ViewableChangeHandler): () => void {
    const existingUnsubscribe = subscriptions.get(fn);
    if (existingUnsubscribe) {
        return existingUnsubscribe;
    }

    const host = window.minit;
    let unsubscribed = false;

    if (host && typeof host.addEventListener === "function" && typeof host.removeEventListener === "function") {
        // No initial baseline read from the host here — the first
        // 'viewableChange' event received after subscribing is always
        // delivered; only a repeat of the SAME value is deduped.
        let lastValue: boolean | undefined;

        const handler: ViewableChangeHandler = (viewable) => {
            if (viewable === lastValue) return;
            lastValue = viewable;
            fn(viewable);
        };

        host.addEventListener("viewableChange", handler);

        const unsubscribe = () => {
            if (unsubscribed) return;
            unsubscribed = true;
            host.removeEventListener?.("viewableChange", handler);
            subscriptions.delete(fn);
        };

        subscriptions.set(fn, unsubscribe);
        return unsubscribe;
    }

    // Document fallback — baseline is the CURRENT mirrored value at
    // subscribe time, so a visibilitychange event that leaves the mirrored
    // value unchanged (e.g. re-focus without an actual state flip) is not
    // redelivered.
    let lastValue = document.visibilityState === "visible";

    const handler = () => {
        const viewable = document.visibilityState === "visible";
        if (viewable === lastValue) return;
        lastValue = viewable;
        fn(viewable);
    };

    document.addEventListener("visibilitychange", handler);

    const unsubscribe = () => {
        if (unsubscribed) return;
        unsubscribed = true;
        document.removeEventListener("visibilitychange", handler);
        subscriptions.delete(fn);
    };

    subscriptions.set(fn, unsubscribe);
    return unsubscribe;
}
