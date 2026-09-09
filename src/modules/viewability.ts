/**
 * Stub for DROP-8666 — "Expose `isViewable()` and `viewableChange` in
 * `@minit-games/sdk`". The real implementation lands in the paired
 * implementation subtask; this file exists only so `viewability.test.ts`
 * (DROP-8668, written first / red-phase) resolves as a module.
 *
 * Target contract (see viewability.test.ts for the full behavioral spec):
 * - `isViewable()`: host present → delegate to `window.minit.isViewable()`;
 *   host absent/older (no `isViewable`) → mirror
 *   `document.visibilityState === "visible"`. Re-checked on every call — the
 *   presence (or absence) of `window.minit` is never cached.
 * - `onViewableChange(fn)`: host present with the new methods → register via
 *   `window.minit.addEventListener("viewableChange", ...)`, unsubscribe via
 *   `removeEventListener`; host absent/older → fall back to a
 *   `document.visibilitychange` listener. Delivers only on an actual value
 *   change, is idempotent for a duplicate `fn` registration, and unsubscribe
 *   is idempotent (safe to call more than once).
 *
 * Deliberately throwing (not a silent no-op) so every red-phase test fails on
 * behavior, not on module resolution.
 */

export function isViewable(): boolean {
    throw new Error("isViewable() is not implemented yet (DROP-8666)");
}

export function onViewableChange(_fn: (viewable: boolean) => void): () => void {
    throw new Error("onViewableChange() is not implemented yet (DROP-8666)");
}
