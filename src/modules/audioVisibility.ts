/**
 * STUB (DROP-5254 red phase) — registry surface only.
 *
 * The real implementation (DROP-5253) wires these registrations into a
 * `document.visibilitychange` listener installed once by `initializeSDK()`
 * (see src/index.ts): on hide, every registered `AudioContext` that is
 * currently running is suspended and every registered `HTMLMediaElement`
 * that is currently playing is paused; on show, only the audio the listener
 * itself suspended/paused is resumed — never audio the game paused on its
 * own. That behavior does not exist yet; these functions intentionally no-op
 * so audioVisibility.test.ts fails on assertions, not on a missing export.
 */

export function registerAudioContext(_context: AudioContext): void {
    // no-op stub — see DROP-5253
}

export function registerAudioElement(_element: HTMLMediaElement): void {
    // no-op stub — see DROP-5253
}
