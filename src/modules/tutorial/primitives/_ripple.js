import { TUTORIAL_THEME } from '../theme.js';
import { hexColor, clamp01 } from './dom.js';

/**
 * Expanding ripple rings drawn on a canvas (DOM — no PIXI).
 *
 * @param {object} opts
 * @param {HTMLElement} opts.parent
 * @param {number} [opts.radius]
 * @param {number} [opts.strokeMax]
 * @param {number} [opts.color]
 * @param {number} [opts.periodMs]
 */
export function createRipplePair({ parent, radius, strokeMax, color, periodMs }) {
	const T = TUTORIAL_THEME;
	const rMax = radius !== undefined ? radius : T.ripple.radiusPx;
	const sMax = strokeMax !== undefined ? strokeMax : T.ripple.strokeMaxPx;
	const ringColor = hexColor(color !== undefined ? color : T.ripple.color);
	const period = periodMs !== undefined ? periodMs : T.ripple.periodMs;

	const pad = Math.ceil(rMax + sMax + 4);
	const size = pad * 2;
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
	parent.appendChild(canvas);

	const ctx = canvas.getContext('2d');
	const cx = size / 2;
	const cy = size / 2;

	function drawRing(t) {
		const life = clamp01(t);
		const r = rMax * life;
		const lineWidth = sMax * (1 - life) + 1;
		ctx.globalAlpha = 1 - life;
		ctx.beginPath();
		ctx.arc(cx, cy, Math.max(0, r), 0, Math.PI * 2);
		ctx.strokeStyle = ringColor;
		ctx.lineWidth = lineWidth;
		ctx.stroke();
	}

	function tick(time) {
		ctx.clearRect(0, 0, size, size);
		const t1 = (time % period) / period;
		const t2 = ((time + period / 2) % period) / period;
		drawRing(t1);
		drawRing(t2);
		ctx.globalAlpha = 1;
	}

	return { canvas, tick };
}
