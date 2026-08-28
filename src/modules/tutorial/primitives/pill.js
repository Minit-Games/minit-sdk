// Modal instruction pill — DOM rendering, DOM input blocking.

import { okButtonImgUrl, okSoundUrl, popInSoundUrl } from '../assets/bundled.js';
import { TUTORIAL_THEME } from '../theme.js';
import {
	easeInQuad,
	easeOutBack,
	hexColor,
	lerp,
	removeElement,
} from './dom.js';

const audioCache = new Map();
function playOneShot(url, volume) {
	try {
		let el = audioCache.get(url);
		if (!el) {
			el = new Audio(url);
			el.preload = 'auto';
			audioCache.set(url, el);
		}
		el.volume = Math.max(0, Math.min(1, Number(volume) || 0));
		try { el.currentTime = 0; } catch { /* not yet loaded */ }
		const p = el.play();
		if (p && typeof p.catch === 'function') p.catch(() => {});
	} catch { /* headless / blocked audio */ }
}

function hardWrapText(text, maxWidth, font) {
	if (!maxWidth) return text;
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');
	ctx.font = font;
	const lines = [];
	for (const para of text.split('\n')) {
		const words = para.split(' ');
		let line = '';
		for (const word of words) {
			const test = line ? `${line} ${word}` : word;
			if (ctx.measureText(test).width > maxWidth && line) {
				lines.push(line);
				line = word;
			} else {
				line = test;
			}
		}
		lines.push(line);
	}
	return lines.join('\n');
}

/**
 * Layout tokens live in theme.js in a fixed design space
 * (`referenceWidth` x `referenceHeight`). Fixed logical surfaces already use
 * the layer transform, but surfaces narrower than the reference width still
 * need their pill lengths reduced proportionally. Their multiplier therefore
 * uses width/referenceWidth only, clamped at 1 so short or wide fixed surfaces
 * do not shrink by height or inflate the authored tokens.
 *
 * Fluid CSS-pixel canvases have no layer transform, so they retain the
 * contain-fit multiplier min(viewportW/refW, viewportH/refH). Keeping height
 * out of the logical branch preserves the authored 1:1 tokens on the
 * documented 960x560 surface.
 *
 * @param {boolean} isLogical
 * @returns {number} 1 when the viewport already matches the design space.
 */
function pillLayoutScale(T, viewport, isLogical) {
	const refW = T.referenceWidth;
	const refH = T.referenceHeight;
	if (!(refW > 0) || !(refH > 0)) return 1;
	if (isLogical) {
		const s = Math.min(1, viewport.width / refW);
		return s > 0 && Number.isFinite(s) ? s : 1;
	}
	const w = viewport.width > 0 ? viewport.width / refW : 1;
	const h = viewport.height > 0 ? viewport.height / refH : w;
	const s = Math.min(w, h);
	return s > 0 && Number.isFinite(s) ? s : 1;
}

/** Shallow copy of the pill/modal tokens with every length multiplied by `s`. */
function scalePillTheme(T, s) {
	if (s === 1) return T;
	const px = (v) => (typeof v === 'number' ? v * s : v);
	const atLeast1 = (v) => (typeof v === 'number' ? Math.max(1, v * s) : v);
	return {
		...T,
		pill: {
			...T.pill,
			padX: px(T.pill.padX),
			padY: px(T.pill.padY),
			screenMarginX: px(T.pill.screenMarginX),
			cornerRadius: px(T.pill.cornerRadius),
			fontSize: px(T.pill.fontSize),
			lineHeight: px(T.pill.lineHeight),
			dropShadow: T.pill.dropShadow && {
				...T.pill.dropShadow,
				blur: px(T.pill.dropShadow.blur),
				distance: px(T.pill.dropShadow.distance),
			},
			outline: T.pill.outline && {
				...T.pill.outline,
				width: atLeast1(T.pill.outline.width),
			},
		},
		modal: {
			...T.modal,
			okButton: {
				...T.modal.okButton,
				height: px(T.modal.okButton.height),
				marginTop: px(T.modal.okButton.marginTop),
				marginBottom: px(T.modal.okButton.marginBottom),
			},
			nudge: T.modal.nudge && {
				...T.modal.nudge,
				flashWidthPx: atLeast1(T.modal.nudge.flashWidthPx),
			},
		},
	};
}

function pillTextStyle(T) {
	const lh = typeof T.pill.lineHeight === 'number'
		? T.pill.lineHeight
		: Math.round(T.pill.fontSize * (T.pill.lineHeightFactor || 1.25));
	const ds = T.pill.dropShadow;
	const angle = ds?.angle ?? Math.PI / 4;
	const dist = ds?.distance ?? 0;
	const ox = Math.round(Math.cos(angle) * dist);
	const oy = Math.round(Math.sin(angle) * dist);
	return {
		fontFamily: T.pill.fontFamily,
		fontSize: `${T.pill.fontSize}px`,
		fontWeight: T.pill.fontWeight,
		color: hexColor(T.pill.fontColor),
		lineHeight: `${lh}px`,
		textShadow: ds
			? `${ox}px ${oy}px ${ds.blur ?? 0}px rgba(0,0,0,${ds.alpha ?? 1})`
			: 'none',
	};
}

function makeTextEl(text, wrapWidth, align, T) {
	const style = pillTextStyle(T);
	const measureFont = `${T.pill.fontWeight || 'normal'} ${T.pill.fontSize}px ${T.pill.fontFamily}`;
	const wrapped = wrapWidth > 0 ? hardWrapText(text, wrapWidth, measureFont) : text;
	const el = document.createElement('div');
	el.textContent = wrapped;
	el.style.cssText = [
		'white-space:pre-wrap',
		`text-align:${align}`,
		`font-family:${style.fontFamily}`,
		`font-size:${style.fontSize}`,
		`font-weight:${style.fontWeight}`,
		`color:${style.color}`,
		`line-height:${style.lineHeight}`,
		`text-shadow:${style.textShadow}`,
		wrapWidth > 0 ? `max-width:${wrapWidth}px` : '',
		'pointer-events:none',
	].filter(Boolean).join(';');
	return el;
}

/** @param {Array<{ text: string, iconSrc?: string }>} rows */
function buildPillRowsDom(rows, wrapWidth, T) {
	const iconH = T.pill.fontSize;
	const iconTextGap = 12;
	const rowGap = Math.round(T.pill.fontSize * 0.4);
	const root = document.createElement('div');
	root.style.cssText = 'display:flex;flex-direction:column;align-items:center;pointer-events:none;';

	let maxW = 0;
	let totalH = 0;

	rows.forEach((row, idx) => {
		const rowEl = document.createElement('div');
		rowEl.style.cssText = `display:flex;align-items:center;gap:${iconTextGap}px;`;
		if (row.iconSrc) {
			const img = document.createElement('img');
			img.src = row.iconSrc;
			img.alt = '';
			img.draggable = false;
			img.style.cssText = `height:${iconH}px;width:auto;flex-shrink:0;pointer-events:none;`;
			rowEl.appendChild(img);
		}
		const iconW = row.iconSrc ? iconH + iconTextGap : 0;
		const textBudget = wrapWidth > 0 ? Math.max(60, wrapWidth - iconW) : 0;
		rowEl.appendChild(makeTextEl(row.text, textBudget, 'left', T));
		root.appendChild(rowEl);
		if (idx > 0) totalH += rowGap;
		totalH += iconH;
		maxW = Math.max(maxW, wrapWidth > 0 ? wrapWidth : 200);
	});

	root._rowsWidth = maxW;
	root._rowsHeight = totalH;
	return root;
}

function attachInputBlocker({ mount, layerZIndex, getOkRect, getCardRect, isInteractable, onPressVisual, onTap, onDeadTap }) {
	const blocker = document.createElement('div');
	const blockZ = (layerZIndex !== undefined ? layerZIndex : 1000) + 1;
	blocker.style.cssText = [
		'position:absolute',
		'left:0',
		'top:0',
		'width:100%',
		'height:100%',
		`z-index:${blockZ}`,
		'background:transparent',
		'touch-action:none',
		'-webkit-user-select:none',
		'user-select:none',
		'-webkit-tap-highlight-color:transparent',
		'cursor:default',
	].join(';');

	let pressedPointerId = null;
	let pressStartedOnCard = false;

	function isInsideRect(rect, clientX, clientY) {
		if (!rect) return false;
		return clientX >= rect.left && clientX <= rect.right
			&& clientY >= rect.top && clientY <= rect.bottom;
	}
	function isOverOk(clientX, clientY) { return isInsideRect(getOkRect(), clientX, clientY); }
	function isOverCard(clientX, clientY) {
		if (typeof getCardRect !== 'function') return true;
		return isInsideRect(getCardRect(), clientX, clientY);
	}

	const onPointerDown = (e) => {
		e.preventDefault();
		e.stopPropagation();
		const overCard = isOverCard(e.clientX, e.clientY);
		if (!overCard && typeof onDeadTap === 'function') onDeadTap();
		if (!isInteractable()) return;
		pressedPointerId = e.pointerId;
		pressStartedOnCard = overCard;
		if (pressStartedOnCard && isOverOk(e.clientX, e.clientY)) onPressVisual(true);
		try { blocker.setPointerCapture(e.pointerId); } catch { /* old browsers */ }
	};
	const onPointerMove = (e) => {
		e.preventDefault();
		e.stopPropagation();
		if (pressedPointerId !== e.pointerId) return;
		onPressVisual(pressStartedOnCard && isOverOk(e.clientX, e.clientY));
	};
	const onPointerUp = (e) => {
		e.preventDefault();
		e.stopPropagation();
		if (pressedPointerId !== e.pointerId) return;
		const startedOnCard = pressStartedOnCard;
		const endedOnCard = isOverCard(e.clientX, e.clientY);
		onPressVisual(false);
		pressedPointerId = null;
		pressStartedOnCard = false;
		try { blocker.releasePointerCapture(e.pointerId); } catch { /* old */ }
		if (startedOnCard && endedOnCard && isInteractable()) onTap();
	};
	const onPointerCancel = (e) => {
		e.preventDefault();
		e.stopPropagation();
		if (pressedPointerId !== e.pointerId) return;
		onPressVisual(false);
		pressedPointerId = null;
		pressStartedOnCard = false;
	};

	const swallow = (e) => {
		e.preventDefault();
		e.stopPropagation();
	};

	blocker.addEventListener('pointerdown', onPointerDown);
	blocker.addEventListener('pointermove', onPointerMove);
	blocker.addEventListener('pointerup', onPointerUp);
	blocker.addEventListener('pointercancel', onPointerCancel);
	blocker.addEventListener('mousedown', swallow);
	blocker.addEventListener('mousemove', swallow);
	blocker.addEventListener('mouseup', swallow);
	blocker.addEventListener('click', swallow);
	blocker.addEventListener('dblclick', swallow);
	blocker.addEventListener('contextmenu', swallow);
	blocker.addEventListener('touchstart', swallow, { passive: false });
	blocker.addEventListener('touchmove', swallow, { passive: false });
	blocker.addEventListener('touchend', swallow, { passive: false });
	blocker.addEventListener('touchcancel', swallow, { passive: false });
	blocker.addEventListener('wheel', swallow, { passive: false });

	const onKey = (e) => {
		e.preventDefault();
		e.stopImmediatePropagation();
	};
	window.addEventListener('keydown', onKey, true);
	window.addEventListener('keyup', onKey, true);
	window.addEventListener('keypress', onKey, true);

	mount.appendChild(blocker);

	return () => {
		if (blocker.parentElement) blocker.parentElement.removeChild(blocker);
		window.removeEventListener('keydown', onKey, true);
		window.removeEventListener('keyup', onKey, true);
		window.removeEventListener('keypress', onKey, true);
	};
}

/**
 * @param {object} opts
 * @param {HTMLElement} opts.container - tutorial layer (pill visuals render here)
 * @param {HTMLElement} opts.mount - game canvas (input blocker covers this element only)
 * @param {number} [opts.layerZIndex]
 * @param {() => { width: number, height: number }} opts.getViewport
 * @param {boolean} [opts.isLogical] - true when the overlay renders into a fixed
 *   logical surface (createTutorialOverlay got width/height). Pill lengths
 *   scale down when that surface is narrower than the reference width; fluid
 *   canvases instead use the viewport contain-fit correction. See
 *   pillLayoutScale.
 */
export function createPill({
	container, mount, layerZIndex, getViewport, isLogical, tickRegistry, teardownRegistry,
	text, rows, x, y, delay, onClose,
}) {
	const viewport = getViewport();
	const T = scalePillTheme(
		TUTORIAL_THEME,
		pillLayoutScale(TUTORIAL_THEME, viewport, isLogical),
	);
	const okBtnTheme = T.modal.okButton;
	const screenW = viewport.width;

	const resolvedDelay = delay === undefined ? T.pill.defaultDelaySeconds : delay;
	const delayMs = Math.max(0, (Number(resolvedDelay) || 0) * 1000);

	const visualRoot = document.createElement('div');
	visualRoot.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;';
	container.appendChild(visualRoot);

	const card = document.createElement('div');
	card.style.cssText = 'position:absolute;transform-origin:center center;will-change:transform,opacity;pointer-events:none;';
	visualRoot.appendChild(card);

	const sideMargin = T.pill.screenMarginX;
	const wrapWidth = screenW > 0
		? Math.max(120, screenW - 2 * sideMargin - 2 * T.pill.padX)
		: 0;

	const targetH = okBtnTheme.height || 100;
	const okImg = document.createElement('img');
	okImg.src = okButtonImgUrl;
	okImg.alt = 'OK';
	okImg.draggable = false;
	okImg.style.cssText = `display:block;height:${targetH}px;width:auto;margin:0 auto;transform-origin:center center;will-change:transform,opacity;pointer-events:none;`;

	let okBodyWidth = targetH;
	okImg.onload = () => {
		okBodyWidth = targetH * ((okImg.naturalWidth / okImg.naturalHeight) || 1);
	};

	const okButton = {
		element: okImg,
		bodyHeight: targetH,
		get bodyWidth() { return okBodyWidth; },
		isPressed: false,
		alpha: okBtnTheme.openFromAlpha ?? 0,
		scale: okBtnTheme.openFromScale ?? 0.6,
		bubbleScale: 1,
		setPressed(pressed) {
			okButton.isPressed = pressed;
			okButton.applyVisual();
		},
		applyVisual() {
			const pressedMul = okButton.isPressed ? (okBtnTheme.pressedScale ?? 0.94) : 1;
			const s = okButton.scale * okButton.bubbleScale * pressedMul;
			okImg.style.opacity = String(okButton.alpha);
			okImg.style.transform = `scale(${s})`;
		},
	};
	okButton.applyVisual();

	let primaryContent;
	let primaryH;
	let primaryW;
	if (rows && rows.length > 0) {
		primaryContent = buildPillRowsDom(rows, wrapWidth, T);
		primaryH = primaryContent._rowsHeight;
		primaryW = primaryContent._rowsWidth;
	} else {
		primaryContent = makeTextEl(text || '', wrapWidth, 'center', T);
		primaryH = Math.round(T.pill.fontSize * (T.pill.lineHeightFactor || 1.25));
		primaryW = wrapWidth > 0 ? wrapWidth : 200;
	}

	let footerLabel = null;
	let footerH = 0;
	const footerGap = Math.round(T.pill.fontSize * 0.6);
	if (rows && rows.length > 0 && text) {
		footerLabel = makeTextEl(text, wrapWidth, 'center', T);
		footerH = footerGap + Math.round(T.pill.fontSize * (T.pill.lineHeightFactor || 1.25));
	}

	const okMarginBottom = Number.isFinite(okBtnTheme.marginBottom) ? okBtnTheme.marginBottom : 0;
	const innerW = Math.max(primaryW, footerLabel ? wrapWidth : 0, okBodyWidth);
	const innerH = primaryH + footerH + okBtnTheme.marginTop + targetH + okMarginBottom;
	const cardW = innerW + T.pill.padX * 2;
	const cardH = innerH + T.pill.padY * 2;

	const bgHex = T.pill.bgColor >>> 0;
	const cardBg = document.createElement('div');
	cardBg.style.cssText = [
		'position:relative',
		`width:${cardW}px`,
		`min-height:${cardH}px`,
		`background:rgba(${(bgHex >> 16) & 0xff},${(bgHex >> 8) & 0xff},${bgHex & 0xff},${T.pill.bgAlpha ?? 1})`,
		`border-radius:${T.pill.cornerRadius}px`,
		T.pill.outline
			? `outline:${T.pill.outline.width}px solid ${hexColor(T.pill.outline.color)}`
			: '',
		'box-sizing:border-box',
		`padding:${T.pill.padY}px ${T.pill.padX}px`,
		'pointer-events:none',
	].filter(Boolean).join(';');

	const flashOutline = document.createElement('div');
	flashOutline.style.cssText = [
		'position:absolute',
		'inset:0',
		`border-radius:${T.pill.cornerRadius}px`,
		`border:${T.modal.nudge?.flashWidthPx ?? 6}px solid ${hexColor(T.modal.nudge?.flashColor ?? 0xffffff)}`,
		'opacity:0',
		'pointer-events:none',
		'box-sizing:border-box',
	].join(';');
	cardBg.appendChild(flashOutline);

	const contentWrap = document.createElement('div');
	contentWrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;';
	contentWrap.appendChild(primaryContent);
	if (footerLabel) {
		footerLabel.style.marginTop = `${footerGap}px`;
		contentWrap.appendChild(footerLabel);
	}
	const okWrap = document.createElement('div');
	okWrap.style.cssText = `margin-top:${okBtnTheme.marginTop}px;margin-bottom:${okMarginBottom}px;`;
	okWrap.appendChild(okImg);
	contentWrap.appendChild(okWrap);
	cardBg.appendChild(contentWrap);
	card.appendChild(cardBg);

	let phase = delayMs > 0 ? 'delay' : 'popIn';
	let phaseStartTime = performance.now();
	let cardScale = T.modal.popIn.fromScale;
	let rootAlpha = phase === 'delay' ? 0 : T.modal.popIn.fromAlpha;
	let popOutFromAlpha = 1;
	let popOutFromScale = 1;
	let unregisterTick;
	let unregisterTeardown;
	let detachBlocker;
	let destroyed = false;

	let pillPopInStartedAt = phase === 'popIn' ? phaseStartTime : null;
	let okRevealPhase = 'hidden';
	let okRevealStartedAt = 0;
	let nudgeStartAt = null;
	let nextBubbleAt = 0;
	let bubbleStartAt = null;

	const soundsCfg = T.pill?.sounds;
	const soundsEnabled = !soundsCfg || soundsCfg.enabled !== false;

	function playPopInSound() {
		if (!soundsEnabled) return;
		playOneShot(popInSoundUrl, soundsCfg?.popInVolume ?? 0.5);
	}
	function playOkSound() {
		if (!soundsEnabled) return;
		playOneShot(okSoundUrl, soundsCfg?.okVolume ?? 0.6);
	}

	if (phase === 'popIn') playPopInSound();

	function scheduleNextBubble(now) {
		const cfg = okBtnTheme.idleBubble;
		if (!cfg) { nextBubbleAt = Infinity; return; }
		const min = cfg.minIntervalMs ?? 1000;
		const max = cfg.maxIntervalMs ?? 2000;
		nextBubbleAt = now + Math.min(min, max) + Math.random() * Math.abs(max - min);
	}

	function triggerNudge() {
		if (phase !== 'popIn' && phase !== 'shown') return;
		nudgeStartAt = performance.now();
	}

	function applyVisuals() {
		visualRoot.style.opacity = String(rootAlpha);
		card.style.left = `${x}px`;
		card.style.top = `${y}px`;
		card.style.transform = `translate(-50%, -50%) scale(${cardScale})`;
	}

	function destroyNow() {
		phase = 'destroyed';
		destroyed = true;
		if (typeof detachBlocker === 'function') {
			detachBlocker();
			detachBlocker = null;
		}
		if (typeof unregisterTick === 'function') unregisterTick();
		if (typeof unregisterTeardown === 'function') unregisterTeardown();
		removeElement(visualRoot);
	}

	function startPopOut() {
		if (phase === 'popOut' || phase === 'destroyed') return;
		if (phase === 'delay') {
			destroyNow();
			if (typeof onClose === 'function') onClose();
			return;
		}
		popOutFromAlpha = rootAlpha;
		popOutFromScale = cardScale;
		phase = 'popOut';
		phaseStartTime = performance.now();
	}

	function tick(now) {
		if (phase === 'destroyed') return;
		const elapsed = now - phaseStartTime;

		if (phase === 'delay') {
			if (elapsed >= delayMs) {
				phase = 'popIn';
				phaseStartTime = now;
				rootAlpha = T.modal.popIn.fromAlpha;
				playPopInSound();
				pillPopInStartedAt = now;
			} else {
				applyVisuals();
				return;
			}
		}

		if (pillPopInStartedAt !== null && phase !== 'popOut') {
			const openDelay = okBtnTheme.openDelayMs ?? 250;
			const openDuration = okBtnTheme.openDurationMs ?? 240;
			const fromAlpha = okBtnTheme.openFromAlpha ?? 0;
			const fromScale = okBtnTheme.openFromScale ?? 0.6;
			const sinceOpen = now - pillPopInStartedAt;

			if (okRevealPhase === 'hidden') {
				if (sinceOpen >= openDelay) {
					okRevealPhase = 'popIn';
					okRevealStartedAt = now;
				} else {
					okButton.alpha = fromAlpha;
					okButton.scale = fromScale;
					okButton.applyVisual();
				}
			}
			if (okRevealPhase === 'popIn') {
				const t = Math.min((now - okRevealStartedAt) / openDuration, 1);
				okButton.alpha = lerp(fromAlpha, 1, t);
				okButton.scale = lerp(fromScale, 1, easeOutBack(t));
				okButton.applyVisual();
				if (t >= 1) {
					okRevealPhase = 'shown';
					okButton.alpha = 1;
					okButton.scale = 1;
					okButton.applyVisual();
					scheduleNextBubble(now);
					bubbleStartAt = null;
				}
			}
		}

		if (phase === 'popIn') {
			const d = T.modal.popIn.durationMs;
			const t = Math.min(elapsed / d, 1);
			cardScale = lerp(T.modal.popIn.fromScale, 1, easeOutBack(t));
			rootAlpha = lerp(T.modal.popIn.fromAlpha, 1, t);
			if (t >= 1) {
				phase = 'shown';
				cardScale = 1;
				rootAlpha = 1;
			}
		} else if (phase === 'shown' && okRevealPhase === 'shown') {
			if (okButton.isPressed) {
				okButton.bubbleScale = 1;
				bubbleStartAt = null;
				scheduleNextBubble(now);
				okButton.applyVisual();
			} else if (bubbleStartAt !== null) {
				const cfg = okBtnTheme.idleBubble || {};
				const duration = cfg.durationMs ?? 420;
				const peak = cfg.peakScale ?? 1.125;
				const preDip = cfg.preDipScale ?? 0.9625;
				const t = Math.min((now - bubbleStartAt) / duration, 1);
				let s;
				if (t < 0.25) {
					const u = t / 0.25;
					s = 1 + (preDip - 1) * Math.sin(u * Math.PI);
				} else {
					const u = (t - 0.25) / 0.75;
					s = 1 + (peak - 1) * Math.sin(u * Math.PI);
				}
				okButton.bubbleScale = s;
				okButton.applyVisual();
				if (t >= 1) {
					okButton.bubbleScale = 1;
					okButton.applyVisual();
					bubbleStartAt = null;
					scheduleNextBubble(now);
				}
			} else if (now >= nextBubbleAt) {
				bubbleStartAt = now;
			}
		} else if (phase === 'popOut') {
			const d = T.modal.popOut.durationMs;
			const t = Math.min(elapsed / d, 1);
			const eased = easeInQuad(t);
			cardScale = lerp(popOutFromScale, T.modal.popOut.toScale, eased);
			rootAlpha = lerp(popOutFromAlpha, T.modal.popOut.toAlpha, eased);
			if (t >= 1) {
				destroyNow();
				if (typeof onClose === 'function') onClose();
				return;
			}
		}

		if (phase === 'destroyed') return;

		if (nudgeStartAt !== null) {
			const N = T.modal.nudge || {};
			const bounceDur = N.bounceDurationMs ?? 200;
			const flashDur = N.flashDurationMs ?? 620;
			const flashCount = N.flashCount ?? 3;
			const peakScale = N.bouncePeakScale ?? 1.08;
			const nudgeElapsed = now - nudgeStartAt;

			if (phase === 'shown') cardScale = 1;
			const bt = Math.min(nudgeElapsed / bounceDur, 1);
			const factor = 1 + (peakScale - 1) * Math.sin(Math.PI * bt);
			cardScale *= factor;

			const ft = Math.min(nudgeElapsed / flashDur, 1);
			if (ft < 1) {
				const cycleT = (ft * flashCount) % 1;
				flashOutline.style.opacity = String(Math.sin(Math.PI * cycleT));
			} else {
				flashOutline.style.opacity = '0';
			}

			if (nudgeElapsed >= Math.max(bounceDur, flashDur)) {
				nudgeStartAt = null;
				if (phase === 'shown') cardScale = 1;
				flashOutline.style.opacity = '0';
			}
		}

		applyVisuals();
	}

	unregisterTick = tickRegistry.add(tick);
	applyVisuals();

	function getRect(el) {
		if (destroyed || !el.isConnected) return null;
		const r = el.getBoundingClientRect();
		if (!r.width && !r.height) return null;
		return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
	}

	detachBlocker = attachInputBlocker({
		mount,
		layerZIndex,
		getOkRect: () => getRect(okImg),
		getCardRect: () => getRect(cardBg),
		isInteractable: () =>
			(phase === 'popIn' || phase === 'shown') && okRevealPhase !== 'hidden',
		onPressVisual: (pressed) => okButton.setPressed(pressed),
		onTap: () => {
			playOkSound();
			startPopOut();
		},
		onDeadTap: triggerNudge,
	});

	unregisterTeardown = teardownRegistry.add(() => {
		if (typeof detachBlocker === 'function') {
			detachBlocker();
			detachBlocker = null;
		}
		phase = 'destroyed';
		destroyed = true;
		if (typeof unregisterTick === 'function') unregisterTick();
		removeElement(visualRoot);
	});

	return {
		container: card,
		remove() {
			startPopOut();
		},
	};
}
