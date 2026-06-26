import { TUTORIAL_THEME } from '../theme.js';
import {
	clamp01,
	createPrimitiveRoot,
	easeInCubic,
	easeOutCubic,
	lerp,
	removeElement,
	SWIPE_ORIGIN,
} from './dom.js';
import { createSwipeRingCue } from './_cues.js';

const MIN_TRAVEL_MS = 250;

export function createSwipe({
	container,
	tickRegistry,
	from,
	to,
	path,
	direction = 'up',
	glyph,
	fontSize,
	loop = true,
	cycleDurationMs,
	visible,
	// eslint-disable-next-line no-unused-vars
	echoCount,
}) {
	const T = TUTORIAL_THEME;
	const G = T.gesture;
	const dir = T.swipe.glyph[direction] ? direction : 'up';
	const emoji = glyph || T.swipe.glyph[dir];
	const fSize = fontSize !== undefined ? fontSize : T.swipe.fontSize;
	const cycle = cycleDurationMs !== undefined ? cycleDurationMs : T.swipe.cycleDurationMs;

	const fixed = G.pressDownMs + G.liftMs + G.loopGapMs;
	const travelMs = Math.max(MIN_TRAVEL_MS, cycle - fixed);

	const root = createPrimitiveRoot(container, 0, 0);

	const cue = createSwipeRingCue();
	root.appendChild(cue.root);

	const main = document.createElement('div');
	main.textContent = emoji;
	main.style.cssText = [
		'position:absolute',
		'left:0',
		'top:0',
		`font-size:${fSize}px`,
		'line-height:1',
		'pointer-events:none',
		'user-select:none',
		`transform-origin:${SWIPE_ORIGIN[dir] || '50% 50%'}`,
		'opacity:0',
		'will-change:transform,opacity',
	].join(';');
	root.appendChild(main);

	function resolvePath() {
		if (path !== undefined) {
			const pts = typeof path === 'function' ? path() : path;
			if (!Array.isArray(pts) || pts.length < 2) return null;
			for (const p of pts) if (!p) return null;
			return pts;
		}
		const a = typeof from === 'function' ? from() : from;
		const b = typeof to === 'function' ? to() : to;
		if (!a || !b) return null;
		return [a, b];
	}

	function pointAlong(pts, progress01) {
		if (pts.length === 1) return { x: pts[0].x, y: pts[0].y };
		let total = 0;
		const segLens = [];
		for (let i = 0; i < pts.length - 1; i++) {
			const dx = pts[i + 1].x - pts[i].x;
			const dy = pts[i + 1].y - pts[i].y;
			const L = Math.hypot(dx, dy);
			segLens.push(L);
			total += L;
		}
		if (total <= 0) return { x: pts[0].x, y: pts[0].y };
		const target = clamp01(progress01) * total;
		let consumed = 0;
		for (let i = 0; i < segLens.length; i++) {
			const L = segLens[i];
			if (target <= consumed + L || i === segLens.length - 1) {
				const local = L > 0 ? (target - consumed) / L : 0;
				return {
					x: lerp(pts[i].x, pts[i + 1].x, local),
					y: lerp(pts[i].y, pts[i + 1].y, local),
				};
			}
			consumed += L;
		}
		const last = pts[pts.length - 1];
		return { x: last.x, y: last.y };
	}

	let phase = 'gap';
	let phaseStart = performance.now();
	let removed = false;
	let frozen = false;
	let pressScale = G.liftedScale;
	let pressAlpha = G.liftedAlpha;

	function applyPress(p) {
		pressScale = lerp(G.liftedScale, 1, p);
		pressAlpha = lerp(G.liftedAlpha, 1, p);
		main.style.opacity = String(pressAlpha);
	}

	function setPhase(next, now) {
		phase = next;
		phaseStart = now;
		if (next === 'pressed') {
			cue.reset(now);
		} else if (next === 'gap' || next === 'pressDown' || next === 'lift') {
			cue.hide();
		}
	}

	function placeAt(pt) {
		main.style.transform = `translate(${pt.x}px, ${pt.y}px) scale(${pressScale})`;
		cue.root.style.transform = `translate(${pt.x}px, ${pt.y}px)`;
	}

	function tick(now) {
		if (removed) return;
		if (frozen) {
			main.style.opacity = '0';
			cue.hide();
			return;
		}
		if (typeof visible === 'function' && !visible()) {
			main.style.opacity = '0';
			cue.hide();
			return;
		}

		const pts = resolvePath();
		if (!pts) {
			main.style.opacity = '0';
			cue.hide();
			return;
		}
		const startPt = pts[0];
		const endPt = pts[pts.length - 1];

		const dt = now - phaseStart;
		switch (phase) {
			case 'gap':
				placeAt(startPt);
				applyPress(0);
				cue.hide();
				if (dt >= G.loopGapMs) setPhase('pressDown', now);
				break;
			case 'pressDown': {
				placeAt(startPt);
				const t = clamp01(dt / G.pressDownMs);
				applyPress(easeOutCubic(t));
				main.style.transform = `translate(${startPt.x}px, ${startPt.y}px) scale(${pressScale})`;
				if (t >= 1) setPhase('pressed', now);
				break;
			}
			case 'pressed': {
				const t = clamp01(dt / travelMs);
				const pt = pointAlong(pts, t);
				placeAt(pt);
				applyPress(1);
				main.style.transform = `translate(${pt.x}px, ${pt.y}px) scale(${pressScale})`;
				cue.render(t, now);
				if (t >= 1) setPhase('lift', now);
				break;
			}
			case 'lift': {
				placeAt(endPt);
				const t = clamp01(dt / G.liftMs);
				applyPress(1 - easeInCubic(t));
				main.style.transform = `translate(${endPt.x}px, ${endPt.y}px) scale(${pressScale})`;
				if (t >= 1) {
					if (!loop) {
						frozen = true;
						break;
					}
					setPhase('gap', now);
				}
				break;
			}
		}
	}

	const unregisterTick = tickRegistry.add(tick);

	return {
		container: root,
		remove() {
			if (removed) return;
			removed = true;
			unregisterTick();
			removeElement(root);
		},
	};
}
