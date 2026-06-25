import { TUTORIAL_THEME } from '../theme.js';
import {
	clamp01,
	createPrimitiveRoot,
	easeInCubic,
	easeOutCubic,
	FINGER_ORIGIN,
	lerp,
	removeElement,
	setRootPosition,
} from './dom.js';
import { createSparkleCue, createSlowRippleCue } from './_cues.js';

export function createFinger({
	container,
	tickRegistry,
	x,
	y,
	direction = 'up',
	gesture = 'tap',
	glyph,
	fontSize,
	hoverOffsetPx,
	// eslint-disable-next-line no-unused-vars
	pulseScale, rippleRadius, bob,
}) {
	const T = TUTORIAL_THEME;
	const G = T.gesture;
	const dir = T.finger.glyph[direction] ? direction : 'down';
	const emoji = glyph || T.finger.glyph[dir];
	const fSize = fontSize !== undefined ? fontSize : T.finger.fontSize;
	const baseOffset = hoverOffsetPx !== undefined ? hoverOffsetPx : T.finger.hoverOffsetPx;
	const tipInset = (T.finger.tipInsetFactor || 0) * fSize;
	const offset = baseOffset + tipInset;

	const root = createPrimitiveRoot(container, 0, 0);

	const cueAnchor = document.createElement('div');
	cueAnchor.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;';
	root.appendChild(cueAnchor);

	const cue = gesture === 'longPress' ? createSlowRippleCue() : createSparkleCue();
	cueAnchor.appendChild(cue.root);
	const cueDurationMs = gesture === 'longPress' ? G.longPress.cueDurationMs : G.tap.cueDurationMs;

	const finger = document.createElement('div');
	finger.textContent = emoji;
	finger.style.cssText = [
		'position:absolute',
		'left:0',
		'top:0',
		`font-size:${fSize}px`,
		'line-height:1',
		'pointer-events:none',
		'user-select:none',
		`transform-origin:${FINGER_ORIGIN[dir] || '50% 50%'}`,
		'will-change:transform,opacity',
	].join(';');
	root.appendChild(finger);

	let handBaseX = 0;
	let handBaseY = 0;

	function applyPosition(nx, ny) {
		handBaseX = nx + (dir === 'left' ? -offset : dir === 'right' ? offset : 0);
		handBaseY = ny + (dir === 'up' ? offset : dir === 'down' ? -offset : 0);
		finger.style.transform = `translate(${handBaseX}px, ${handBaseY}px)`;

		const tipX = nx + (dir === 'left' ? -baseOffset : dir === 'right' ? baseOffset : 0);
		const tipY = ny + (dir === 'up' ? baseOffset : dir === 'down' ? -baseOffset : 0);
		cueAnchor.style.transform = `translate(${tipX}px, ${tipY}px)`;
	}
	applyPosition(x, y);

	let phase = 'gap';
	let phaseStart = performance.now();
	let removed = false;
	let pressScale = G.liftedScale;
	let pressAlpha = G.liftedAlpha;

	function applyPress(p) {
		pressScale = lerp(G.liftedScale, 1, p);
		pressAlpha = lerp(G.liftedAlpha, 1, p);
		finger.style.opacity = String(pressAlpha);
		finger.style.transform = `translate(${handBaseX}px, ${handBaseY}px) scale(${pressScale})`;
	}

	function setPhase(next, now) {
		phase = next;
		phaseStart = now;
		if (next === 'pressed') {
			cue.reset(now);
		} else if (next === 'gap' || next === 'pressDown') {
			cue.hide();
		}
	}

	applyPress(0);
	cue.hide();

	function tick(now) {
		if (removed) return;
		const dt = now - phaseStart;
		switch (phase) {
			case 'gap':
				if (dt >= G.loopGapMs) setPhase('pressDown', now);
				break;
			case 'pressDown': {
				const t = clamp01(dt / G.pressDownMs);
				applyPress(easeOutCubic(t));
				if (t >= 1) setPhase('pressed', now);
				break;
			}
			case 'pressed':
				applyPress(1);
				cue.render(clamp01(dt / cueDurationMs), now);
				if (dt >= cueDurationMs) setPhase('lift', now);
				break;
			case 'lift': {
				const t = clamp01(dt / G.liftMs);
				applyPress(1 - easeInCubic(t));
				if (t >= 1) setPhase('gap', now);
				break;
			}
		}
	}

	const unregisterTick = tickRegistry.add(tick);

	function restartGesture(now = performance.now()) {
		if (removed) return;
		setPhase('gap', now);
		applyPress(0);
	}

	return {
		container: root,
		setPosition(nx, ny) {
			if (removed) return;
			applyPosition(nx, ny);
			finger.style.transform = `translate(${handBaseX}px, ${handBaseY}px) scale(${pressScale})`;
		},
		restartGesture,
		remove() {
			if (removed) return;
			removed = true;
			unregisterTick();
			removeElement(root);
		},
	};
}
