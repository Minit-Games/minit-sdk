/**
 * Tests for SDK viewability (DROP-8668, implemented by the paired DROP-8666
 * subtask — see viewability.ts).
 *
 * Public facade under test (see viewability.ts):
 * - `isViewable(): boolean`
 * - `onViewableChange(fn: (viewable: boolean) => void): () => void` — returns
 *   an unsubscribe function.
 *
 * Contract:
 * - Host present → `isViewable()` delegates to `window.minit.isViewable()`;
 *   `onViewableChange` registers via `window.minit.addEventListener(
 *   "viewableChange", ...)` and its unsubscribe calls
 *   `window.minit.removeEventListener("viewableChange", ...)` with the same
 *   handler reference that was registered. The host path is selected only
 *   when `isViewable`/`addEventListener`/`removeEventListener` are ALL
 *   present — `isViewable()` also seeds the dedup baseline below.
 * - Host absent → `isViewable()` mirrors
 *   `document.visibilityState === "visible"`; subscribing installs a
 *   `document.visibilitychange` listener.
 * - Host present but missing the new methods (older host object) → falls
 *   back to the document-based mechanism, never throws.
 * - `window.minit` is re-checked on every call — its absence is never
 *   cached, so a call before `window.minit` exists falls back, and a later
 *   call after it appears upgrades to host delegation.
 * - Duplicate subscribe with the same `fn` reference delivers only once.
 * - Calling the returned unsubscribe function more than once is a no-op.
 * - Delivery only happens on an ACTUAL value change — a same-value
 *   visibilitychange/viewableChange event must not re-deliver, including the
 *   very first host event when it matches the `isViewable()` baseline
 *   already read at subscribe time (DROP-8666 Copilot review finding).
 */

/** Overrides document.visibilityState and fires the event real hosts fire on change. */
function setVisibilityState(state: "visible" | "hidden"): void {
    Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => state,
    });
    document.dispatchEvent(new Event("visibilitychange"));
}

/** Minimal fake host exposing only the new viewability methods. */
function createFakeHost(overrides: {
    isViewable?: jest.Mock;
    addEventListener?: jest.Mock;
    removeEventListener?: jest.Mock;
} = {}) {
    return {
        isViewable: overrides.isViewable ?? jest.fn(() => true),
        addEventListener: overrides.addEventListener ?? jest.fn(),
        removeEventListener: overrides.removeEventListener ?? jest.fn(),
    };
}

describe("viewability", () => {
    beforeEach(() => {
        jest.resetModules();
    });

    afterEach(() => {
        delete window.minit;
        jest.restoreAllMocks();
        // Reset back to jsdom's default (visible) shape.
        Object.defineProperty(document, "visibilityState", {
            configurable: true,
            get: () => "visible",
        });
    });

    // -------------------------------------------------------------------------
    // isViewable() — host present
    // -------------------------------------------------------------------------

    describe("isViewable — host present", () => {
        it("delegates to window.minit.isViewable()", async () => {
            const hostIsViewable = jest.fn(() => true);
            window.minit = createFakeHost({ isViewable: hostIsViewable }) as never;

            const { isViewable } = await import("./viewability");
            expect(isViewable()).toBe(true);
            expect(hostIsViewable).toHaveBeenCalledTimes(1);
        });

        it("returns the host's current value, including false", async () => {
            const hostIsViewable = jest.fn(() => false);
            window.minit = createFakeHost({ isViewable: hostIsViewable }) as never;

            const { isViewable } = await import("./viewability");
            expect(isViewable()).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    // isViewable() — host absent
    // -------------------------------------------------------------------------

    describe("isViewable — host absent", () => {
        it("mirrors document.visibilityState === 'visible' as true", async () => {
            setVisibilityState("visible");

            const { isViewable } = await import("./viewability");
            expect(isViewable()).toBe(true);
        });

        it("mirrors document.visibilityState === 'hidden' as false", async () => {
            setVisibilityState("hidden");

            const { isViewable } = await import("./viewability");
            expect(isViewable()).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    // isViewable() — older host present but missing the new method
    // -------------------------------------------------------------------------

    describe("isViewable — host present but missing isViewable (older host)", () => {
        it("falls back to document.visibilityState without throwing", async () => {
            window.minit = { environment: "app" } as never;
            setVisibilityState("visible");

            const { isViewable } = await import("./viewability");
            expect(() => isViewable()).not.toThrow();
            expect(isViewable()).toBe(true);
        });
    });

    // -------------------------------------------------------------------------
    // isViewable() — window.minit absence is never cached
    // -------------------------------------------------------------------------

    describe("isViewable — called before window.minit exists", () => {
        it("falls back, then upgrades to host delegation once window.minit appears", async () => {
            setVisibilityState("hidden");

            const { isViewable } = await import("./viewability");
            expect(isViewable()).toBe(false); // no host yet -> fallback

            const hostIsViewable = jest.fn(() => true);
            window.minit = createFakeHost({ isViewable: hostIsViewable }) as never;

            expect(isViewable()).toBe(true); // upgrades on next call
            expect(hostIsViewable).toHaveBeenCalledTimes(1);
        });
    });

    // -------------------------------------------------------------------------
    // onViewableChange() — host present
    // -------------------------------------------------------------------------

    describe("onViewableChange — host present", () => {
        it("installs window.minit.addEventListener('viewableChange', <handler>)", async () => {
            const host = createFakeHost();
            window.minit = host as never;

            const { onViewableChange } = await import("./viewability");
            const fn = jest.fn();
            onViewableChange(fn);

            const viewableChangeRegistrations = host.addEventListener.mock.calls.filter(
                ([eventName]) => eventName === "viewableChange"
            );
            expect(viewableChangeRegistrations).toHaveLength(1);
            expect(typeof viewableChangeRegistrations[0][1]).toBe("function");
        });

        it("unsubscribe calls window.minit.removeEventListener with the same handler that was registered", async () => {
            const host = createFakeHost();
            window.minit = host as never;

            const { onViewableChange } = await import("./viewability");
            const fn = jest.fn();
            const unsubscribe = onViewableChange(fn);
            const registeredHandler = host.addEventListener.mock.calls[0][1];

            unsubscribe();

            expect(host.removeEventListener).toHaveBeenCalledTimes(1);
            expect(host.removeEventListener).toHaveBeenCalledWith("viewableChange", registeredHandler);
        });

        it("calling unsubscribe a second time is a no-op (does not throw, does not double-remove)", async () => {
            const host = createFakeHost();
            window.minit = host as never;

            const { onViewableChange } = await import("./viewability");
            const unsubscribe = onViewableChange(jest.fn());

            unsubscribe();
            expect(() => unsubscribe()).not.toThrow();
            expect(host.removeEventListener).toHaveBeenCalledTimes(1);
        });

        it("delivers the value the host's handler is invoked with", async () => {
            // Baseline (isViewable()) is false so that delivering `true` is
            // an actual change and is not suppressed by the dedup baseline.
            const host = createFakeHost({ isViewable: jest.fn(() => false) });
            window.minit = host as never;

            const { onViewableChange } = await import("./viewability");
            const fn = jest.fn();
            onViewableChange(fn);
            const registeredHandler = host.addEventListener.mock.calls[0][1];

            registeredHandler(true);

            expect(fn).toHaveBeenCalledWith(true);
        });
    });

    // -------------------------------------------------------------------------
    // onViewableChange() — host absent (document-based fallback)
    // -------------------------------------------------------------------------

    describe("onViewableChange — host absent (document fallback)", () => {
        it("installs a document 'visibilitychange' listener when subscribing", async () => {
            const addSpy = jest.spyOn(document, "addEventListener");

            const { onViewableChange } = await import("./viewability");
            onViewableChange(jest.fn());

            const visibilityChangeRegistrations = addSpy.mock.calls.filter(
                ([eventName]) => eventName === "visibilitychange"
            );
            expect(visibilityChangeRegistrations.length).toBeGreaterThanOrEqual(1);
        });

        it("delivers the mirrored value when document.visibilitychange fires with an actual change", async () => {
            setVisibilityState("visible");

            const { onViewableChange } = await import("./viewability");
            const fn = jest.fn();
            onViewableChange(fn);

            setVisibilityState("hidden");

            expect(fn).toHaveBeenCalledWith(false);
        });

        it("calling the returned unsubscribe a second time is a no-op (does not throw, does not double-remove)", async () => {
            const removeSpy = jest.spyOn(document, "removeEventListener");

            const { onViewableChange } = await import("./viewability");
            const unsubscribe = onViewableChange(jest.fn());

            unsubscribe();
            expect(() => unsubscribe()).not.toThrow();

            const visibilityChangeRemovals = removeSpy.mock.calls.filter(
                ([eventName]) => eventName === "visibilitychange"
            );
            // Either torn down exactly once, or (if the SDK keeps one shared
            // persistent listener for the module's lifetime) never torn down —
            // either way it must never be removed twice for one unsubscribe pair.
            expect(visibilityChangeRemovals.length).toBeLessThanOrEqual(1);
        });
    });

    // -------------------------------------------------------------------------
    // onViewableChange() — older host present but missing the new methods
    // -------------------------------------------------------------------------

    describe("onViewableChange — host present but missing addEventListener/removeEventListener (older host)", () => {
        it("falls back to the document-based mechanism without throwing", async () => {
            window.minit = { environment: "app" } as never;

            const { onViewableChange } = await import("./viewability");
            const fn = jest.fn();
            expect(() => onViewableChange(fn)).not.toThrow();

            setVisibilityState("hidden");
            expect(fn).toHaveBeenCalledWith(false);
        });
    });

    // -------------------------------------------------------------------------
    // Duplicate subscribe with the same fn — idempotent registration
    // -------------------------------------------------------------------------

    describe("duplicate subscribe with the same fn", () => {
        it("delivers only once per change in document-fallback mode", async () => {
            setVisibilityState("visible");

            const { onViewableChange } = await import("./viewability");
            const fn = jest.fn();
            onViewableChange(fn);
            onViewableChange(fn);

            setVisibilityState("hidden");

            expect(fn).toHaveBeenCalledTimes(1);
            expect(fn).toHaveBeenCalledWith(false);
        });

        it("delivers only once per change in host mode, even if the host is asked to fire every registered handler", async () => {
            // Baseline (isViewable()) is false so that firing `true` below
            // is an actual change and is not suppressed by the dedup baseline.
            const host = createFakeHost({ isViewable: jest.fn(() => false) });
            window.minit = host as never;

            const { onViewableChange } = await import("./viewability");
            const fn = jest.fn();
            onViewableChange(fn);
            onViewableChange(fn);

            // Simulate the host firing every handler it currently has
            // registered for 'viewableChange' — this is what would happen if
            // the facade (incorrectly) registered the same fn twice.
            const registeredHandlers = host.addEventListener.mock.calls
                .filter(([eventName]) => eventName === "viewableChange")
                .map(([, handler]) => handler as (v: boolean) => void);
            registeredHandlers.forEach((handler) => handler(true));

            expect(fn).toHaveBeenCalledTimes(1);
        });
    });

    // -------------------------------------------------------------------------
    // Delivery only on an ACTUAL value change
    // -------------------------------------------------------------------------

    describe("viewableChange fires only on an actual value change", () => {
        it("does not re-deliver when visibilitychange fires but the value stays visible (true -> true)", async () => {
            setVisibilityState("visible");

            const { onViewableChange } = await import("./viewability");
            const fn = jest.fn();
            onViewableChange(fn);

            setVisibilityState("visible"); // no actual change

            expect(fn).not.toHaveBeenCalled();
        });

        it("does not re-deliver when visibilitychange fires but the value stays hidden (false -> false)", async () => {
            setVisibilityState("hidden");

            const { onViewableChange } = await import("./viewability");
            const fn = jest.fn();
            onViewableChange(fn);

            setVisibilityState("hidden"); // no actual change

            expect(fn).not.toHaveBeenCalled();
        });

        it("delivers exactly once per real transition across visible -> hidden -> visible, ignoring repeats", async () => {
            setVisibilityState("visible");

            const { onViewableChange } = await import("./viewability");
            const fn = jest.fn();
            onViewableChange(fn);

            setVisibilityState("hidden");
            setVisibilityState("hidden"); // repeat, must not re-deliver
            setVisibilityState("visible");
            setVisibilityState("visible"); // repeat, must not re-deliver

            expect(fn).toHaveBeenCalledTimes(2);
            expect(fn).toHaveBeenNthCalledWith(1, false);
            expect(fn).toHaveBeenNthCalledWith(2, true);
        });

        it("does not re-deliver when the host fires viewableChange with the same value twice", async () => {
            // Baseline (isViewable()) is false so the first `true` delivery
            // below is an actual change; the second is the same-value repeat
            // this test is guarding against.
            const host = createFakeHost({ isViewable: jest.fn(() => false) });
            window.minit = host as never;

            const { onViewableChange } = await import("./viewability");
            const fn = jest.fn();
            onViewableChange(fn);
            const registeredHandler = host.addEventListener.mock.calls[0][1];

            registeredHandler(true);
            registeredHandler(true); // same value again

            expect(fn).toHaveBeenCalledTimes(1);
        });

        it("does not deliver the host's first event when it matches the isViewable() baseline read at subscribe time (no actual change)", async () => {
            // Regression guard (DROP-8666 Copilot review): the host path
            // must seed its dedup baseline from isViewable() BEFORE
            // registering the listener, so a host that redelivers the
            // current value as its first event (or a subscribe racing a
            // host-side transition) can never violate the documented
            // "actual value change" guarantee (README § Viewability).
            const host = createFakeHost({ isViewable: jest.fn(() => true) });
            window.minit = host as never;

            const { onViewableChange } = await import("./viewability");
            const fn = jest.fn();
            onViewableChange(fn);
            const registeredHandler = host.addEventListener.mock.calls[0][1];

            registeredHandler(true); // matches isViewable() baseline -> not an actual change

            expect(fn).not.toHaveBeenCalled();
        });
    });
});
