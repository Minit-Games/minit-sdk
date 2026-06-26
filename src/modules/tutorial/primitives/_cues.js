import { TUTORIAL_THEME } from '../theme.js';
import { hexColor, lerp, clamp01 } from './dom.js';

function makeCueCanvas(size) {
	const canvas = document.createElement('canvas');
	canvas.width = size;
	canvas.height = size;
	canvas.style.cssText = [
		'position:absolute',
		'left:0',
		'top:0',
		`width:${size}px`,
		`height:${size}px`,
		'margin-left:' + (-size / 2) + 'px',
		'margin-top:' + (-size / 2) + 'px',
		'pointer-events:none',
	].join(';');
	return canvas;
}

/** Tap cue: radial sparkle lines at the fingertip. */
export function createSparkleCue() {
	const T = TUTORIAL_THEME.gesture.tap;
	const size = Math.ceil(T.sparkleOuterEndPx * 2 + 8);
	const canvas = makeCueCanvas(size);
	const ctx = canvas.getContext('2d');
	const cx = size / 2;
	const cy = size / 2;
	const color = hexColor(T.sparkleColor);

	function render(progress01) {
		const t = clamp01(progress01);
		const innerR = lerp(T.sparkleInnerStartPx, T.sparkleInnerEndPx, t);
		const outerR = lerp(T.sparkleOuterStartPx, T.sparkleOuterEndPx, t);
		const alpha = t < 0.5 ? 1 : 1 - (t - 0.5) * 2;

		ctx.clearRect(0, 0, size, size);
		ctx.globalAlpha = alpha;
		ctx.strokeStyle = color;
		ctx.lineWidth = T.sparkleStrokePx;
		ctx.lineCap = 'round';
		const N = T.sparkleCount;
		for (let i = 0; i < N; i++) {
			const a = (i / N) * Math.PI * 2 - Math.PI / 2;
			ctx.beginPath();
			ctx.moveTo(cx + Math.cos(a) * innerR, cy + Math.sin(a) * innerR);
			ctx.lineTo(cx + Math.cos(a) * outerR, cy + Math.sin(a) * outerR);
			ctx.stroke();
		}
		ctx.globalAlpha = 1;
	}

	function reset() {
		ctx.clearRect(0, 0, size, size);
	}

	function hide() {
		reset();
	}

	return { root: canvas, render, reset, hide };
}

/** Long-press cue: slow expanding rings. */
export function createSlowRippleCue() {
	const T = TUTORIAL_THEME.gesture.longPress;
	const size = Math.ceil(T.ringRadiusPx * 2 + T.ringStrokeMaxPx + 8);
	const canvas = makeCueCanvas(size);
	const ctx = canvas.getContext('2d');
	const cx = size / 2;
	const cy = size / 2;
	const color = hexColor(T.ringColor);
	let startMs = 0;

	function drawRing(lifeT) {
		const t = clamp01(lifeT);
		ctx.beginPath();
		ctx.arc(cx, cy, T.ringRadiusPx * t, 0, Math.PI * 2);
		ctx.strokeStyle = color;
		ctx.lineWidth = T.ringStrokeMaxPx * (1 - t) + 1;
		ctx.globalAlpha = 1 - t;
		ctx.stroke();
	}

	function render(_progress01, now) {
		ctx.clearRect(0, 0, size, size);
		const elapsed = now - startMs;
		const t1 = (elapsed % T.ringPeriodMs) / T.ringPeriodMs;
		const t2 = ((elapsed + T.ringPeriodMs / 2) % T.ringPeriodMs) / T.ringPeriodMs;
		drawRing(t1);
		drawRing(t2);
		ctx.globalAlpha = 1;
	}

	function reset(now) {
		startMs = now;
		ctx.clearRect(0, 0, size, size);
	}

	function hide() {
		ctx.clearRect(0, 0, size, size);
	}

	return { root: canvas, render, reset, hide };
}

/** Swipe cue: fixed ring around the fingertip while traveling. */
export function createSwipeRingCue() {
	const T = TUTORIAL_THEME.gesture.swipe;
	const size = Math.ceil(T.ringRadiusPx * 2 + T.ringStrokePx + 8);
	const canvas = makeCueCanvas(size);
	const ctx = canvas.getContext('2d');
	const cx = size / 2;
	const cy = size / 2;
	const color = hexColor(T.ringColor);

	function render() {
		ctx.clearRect(0, 0, size, size);
		ctx.beginPath();
		ctx.arc(cx, cy, T.ringRadiusPx, 0, Math.PI * 2);
		ctx.strokeStyle = color;
		ctx.lineWidth = T.ringStrokePx;
		ctx.globalAlpha = 1;
		ctx.stroke();
	}

	function reset() {
		render();
	}

	function hide() {
		ctx.clearRect(0, 0, size, size);
	}

	render();
	return { root: canvas, render, reset, hide };
}
