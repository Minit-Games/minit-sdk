/**
 * Tests for SDK visibility-driven audio pause/resume (DROP-5254 — red phase,
 * written before the implementation in DROP-5253).
 *
 * Contract under test (see DROP-5252/DROP-5253):
 * - `initializeSDK()` installs a single `document.visibilitychange` listener,
 *   never more than one even across repeated init calls.
 * - On `document.hidden === true`, every registered `AudioContext` that is
 *   currently running is suspended, and every registered `HTMLMediaElement`
 *   that is currently playing is paused.
 * - On `document.hidden === false`, only the audio the listener itself
 *   suspended/paused on the way in gets resumed/played again — audio the
 *   game paused on its own (before the tab hid) is left alone.
 * - Both directions are idempotent: repeated visibilitychange events in the
 *   same hidden state must not double-suspend/-resume.
 * - An empty registry must no-op safely.
 *
 * `registerAudioContext` / `registerAudioElement` currently come from a
 * no-op stub module (src/modules/audioVisibility.ts) — DROP-5253 replaces the
 * stub with the real registry + listener wiring inside `initializeSDK()`.
 * Until then every assertion below that depends on suspend/resume actually
 * happening is expected to fail.
 */

import { initializeSDK } from "../index";
import { registerAudioContext, registerAudioElement } from "./audioVisibility";

/** Minimal AudioContext double: tracks state and records suspend()/resume() calls. */
function createFakeAudioContext(initialState: "running" | "suspended" = "running") {
    const ctx = {
        state: initialState,
        suspend: jest.fn(() => {
            ctx.state = "suspended";
            return Promise.resolve();
        }),
        resume: jest.fn(() => {
            ctx.state = "running";
            return Promise.resolve();
        }),
    };
    return ctx as unknown as AudioContext & { state: string };
}

/** Minimal <audio>/<video> double: tracks paused and records play()/pause() calls. */
function createFakeMediaElement(initiallyPaused = false) {
    const el = {
        paused: initiallyPaused,
        play: jest.fn(() => {
            el.paused = false;
            return Promise.resolve();
        }),
        pause: jest.fn(() => {
            el.paused = true;
        }),
    };
    return el as unknown as HTMLMediaElement & { paused: boolean };
}

/** Flips document.hidden and fires the event the SDK listener reacts to. */
function setHidden(hidden: boolean): void {
    Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => hidden,
    });
    document.dispatchEvent(new Event("visibilitychange"));
}

describe("visibility-driven audio pause/resume", () => {
    afterEach(() => {
        jest.restoreAllMocks();
        delete window.minit;
        // Reset document.hidden back to its default (visible) shape.
        Object.defineProperty(document, "hidden", {
            configurable: true,
            get: () => false,
        });
    });

    describe("hide/show toggling", () => {
        it("suspends a registered running AudioContext on hide and resumes it on show", () => {
            initializeSDK();
            const ctx = createFakeAudioContext("running");
            registerAudioContext(ctx);

            setHidden(true);
            expect(ctx.suspend).toHaveBeenCalledTimes(1);

            setHidden(false);
            expect(ctx.resume).toHaveBeenCalledTimes(1);
        });

        it("pauses a registered playing media element on hide and resumes playback on show", () => {
            initializeSDK();
            const audio = createFakeMediaElement(false);
            registerAudioElement(audio);

            setHidden(true);
            expect(audio.pause).toHaveBeenCalledTimes(1);

            setHidden(false);
            expect(audio.play).toHaveBeenCalledTimes(1);
        });
    });

    describe("empty registry", () => {
        it("no-ops safely when nothing has been registered", () => {
            initializeSDK();
            expect(() => setHidden(true)).not.toThrow();
            expect(() => setHidden(false)).not.toThrow();
        });
    });

    describe("idempotent rapid toggling", () => {
        it("does not double-suspend or double-resume a context across repeated visibilitychange spam", () => {
            initializeSDK();
            const ctx = createFakeAudioContext("running");
            registerAudioContext(ctx);

            // Rapid hide spam — should suspend exactly once.
            setHidden(true);
            setHidden(true);
            setHidden(true);
            expect(ctx.suspend).toHaveBeenCalledTimes(1);

            // Rapid show spam — should resume exactly once.
            setHidden(false);
            setHidden(false);
            setHidden(false);
            expect(ctx.resume).toHaveBeenCalledTimes(1);
        });

        it("does not double-pause or double-play a media element across repeated visibilitychange spam", () => {
            initializeSDK();
            const audio = createFakeMediaElement(false);
            registerAudioElement(audio);

            setHidden(true);
            setHidden(true);
            expect(audio.pause).toHaveBeenCalledTimes(1);

            setHidden(false);
            setHidden(false);
            expect(audio.play).toHaveBeenCalledTimes(1);
        });
    });

    describe("game-paused context is not force-resumed", () => {
        it("only resumes contexts the listener itself suspended, leaving a game-paused context alone", () => {
            initializeSDK();

            // The game already paused this one itself, before the tab hid.
            const gamePaused = createFakeAudioContext("suspended");
            // This one is actively running when the tab hides.
            const running = createFakeAudioContext("running");

            registerAudioContext(gamePaused);
            registerAudioContext(running);

            setHidden(true);
            // The already-suspended context needs no action from the listener.
            expect(gamePaused.suspend).not.toHaveBeenCalled();
            // The running one gets suspended by the listener.
            expect(running.suspend).toHaveBeenCalledTimes(1);

            setHidden(false);
            // Only the context the listener suspended is resumed.
            expect(running.resume).toHaveBeenCalledTimes(1);
            expect(gamePaused.resume).not.toHaveBeenCalled();
        });
    });

    describe("initializeSDK() listener registration", () => {
        it("registers the visibilitychange listener exactly once even when called twice", async () => {
            // The module holds a `listenerInstalled` guard at module scope, so
            // reset the registry and re-import to get a fresh, unregistered
            // instance for this test — matching loadingDone.test.ts.
            jest.resetModules();
            const { initializeSDK: freshInitializeSDK } = await import("../index");

            const addSpy = jest.spyOn(document, "addEventListener");

            freshInitializeSDK();
            freshInitializeSDK();

            const visibilityChangeRegistrations = addSpy.mock.calls.filter(
                ([eventName]) => eventName === "visibilitychange"
            );
            expect(visibilityChangeRegistrations).toHaveLength(1);
        });
    });
});
