// @minit-games/sdk — interactive tutorial overlay (DOM)
//
// Gating lives in gating.ts: shouldShowTutorial() — call BEFORE any tutorial UI.
// This file hosts createTutorialOverlay({ container }) and the visible primitives
// (modal pill, pointing finger, highlight ring, swipe trail). Design tokens: theme.js.

import { TUTORIAL_THEME } from './theme.js';
import { createFinger } from './primitives/finger.js';
import { createPill } from './primitives/pill.js';
import { createHighlight } from './primitives/highlight.js';
import { createSwipe } from './primitives/swipe.js';
import { createLayer, createViewportReader } from './primitives/dom.js';

/**
 * Create a DOM overlay that hosts tutorial primitives. No PIXI required.
 *
 * **Design:** prefer gestures over text. Use `highlight` to mark important game
 * elements, pair with `showFinger` / `showSwipe` to demonstrate actions, and
 * reserve `showPill` for rules that gestures alone cannot convey.
 *
 * @param {object} opts
 * @param {HTMLElement} [opts.container=document.body] - game canvas element the
 *   overlay covers. Must use `position: relative` (set automatically unless
 *   `document.body`). Tutorial UI is clipped to this element — nothing renders
 *   outside the canvas bounds.
 * @param {number} [opts.width] - logical canvas width in px (e.g. 960). When
 *   set together with `height`, `(x, y)` coords use this fixed space and the
 *   layer scales to fit the container's CSS size.
 * @param {number} [opts.height] - logical canvas height in px (e.g. 560).
 * @param {number} [opts.zIndex=TUTORIAL_THEME.zIndex]
 * @returns {TutorialOverlay}
 */
export function createTutorialOverlay({ container, width, height, zIndex } = {}) {
	const mount = container || document.body;
	if (mount !== document.body) {
		const pos = getComputedStyle(mount).position;
		if (pos === 'static') mount.style.position = 'relative';
		if (getComputedStyle(mount).overflow === 'visible') {
			mount.style.overflow = 'hidden';
		}
	}

	const logical = (width && height) ? { width, height } : undefined;
	const layer = createLayer(mount, logical ?? {});
	layer.style.zIndex = String(zIndex !== undefined ? zIndex : TUTORIAL_THEME.zIndex);

	const getViewport = createViewportReader(mount, logical);

	const tickFns = new Set();
	let rafId = 0;
	function tick(now) {
		for (const fn of tickFns) fn(now);
		if (!destroyed) rafId = requestAnimationFrame(tick);
	}
	rafId = requestAnimationFrame(tick);

	const tickRegistry = {
		add(fn) {
			tickFns.add(fn);
			return () => tickFns.delete(fn);
		},
	};

	const teardownFns = new Set();
	const teardownRegistry = {
		add(fn) {
			teardownFns.add(fn);
			return () => teardownFns.delete(fn);
		},
	};

	let destroyed = false;
	let activePillCount = 0;
	let isFirstPill = true;

	function resolveFirstPillDelay(delay) {
		const base = (delay === undefined || delay === 0)
			? TUTORIAL_THEME.pill.defaultDelaySeconds
			: delay;
		return Math.max(base, TUTORIAL_THEME.pill.firstPillMinDelaySeconds);
	}

	return {
		/** The underlying DOM layer, exposed for advanced use. */
		container: layer,

		get isPillOpen() {
			return activePillCount > 0;
		},

		showFinger(opts) {
			if (destroyed) return null;
			return createFinger({ container: layer, tickRegistry, ...opts });
		},

		showPill(text, opts = {}) {
			if (destroyed) return null;
			const pillOpts = isFirstPill
				? { ...opts, delay: resolveFirstPillDelay(opts.delay) }
				: opts;
			if (isFirstPill) isFirstPill = false;
			activePillCount++;
			let closedCleanly = false;
			const userOnClose = opts.onClose;
			let removePreemptTeardown;
			removePreemptTeardown = teardownRegistry.add(() => {
				if (!closedCleanly) {
					closedCleanly = true;
					activePillCount = Math.max(0, activePillCount - 1);
				}
			});
			function innerOnClose() {
				if (closedCleanly) return;
				closedCleanly = true;
				activePillCount = Math.max(0, activePillCount - 1);
				removePreemptTeardown();
				if (typeof userOnClose === 'function') userOnClose();
			}
			const vp = getViewport();
			return createPill({
				container: layer,
				mount,
				layerZIndex: zIndex !== undefined ? zIndex : TUTORIAL_THEME.zIndex,
				getViewport,
				text,
				tickRegistry,
				teardownRegistry,
				...pillOpts,
				x: pillOpts.x !== undefined ? pillOpts.x : vp.width / 2,
				y: pillOpts.y !== undefined ? pillOpts.y : vp.height / 2,
				onClose: innerOnClose,
			});
		},

		highlight(opts) {
			if (destroyed) return null;
			return createHighlight({ container: layer, tickRegistry, ...opts });
		},

		showSwipe(opts) {
			if (destroyed) return null;
			return createSwipe({ container: layer, tickRegistry, ...opts });
		},

		destroy() {
			if (destroyed) return;
			destroyed = true;
			activePillCount = 0;
			for (const fn of teardownFns) {
				try { fn(); } catch { /* never let one bad teardown block the rest */ }
			}
			teardownFns.clear();
			tickFns.clear();
			cancelAnimationFrame(rafId);
			if (typeof layer._dropTutorialCleanup === 'function') layer._dropTutorialCleanup();
			if (layer.parentElement) layer.parentElement.removeChild(layer);
		},
	};
}
