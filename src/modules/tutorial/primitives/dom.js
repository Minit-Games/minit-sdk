/** @typedef {{ width: number, height: number }} ViewportSize */

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);

export function hexColor(hex) {
	return `#${(hex >>> 0).toString(16).padStart(6, '0')}`;
}

export function easeOutCubic(t) {
	const u = 1 - t;
	return 1 - u * u * u;
}

export function easeInCubic(t) {
	return t * t * t;
}

export function easeOutBack(t) {
	const c1 = 1.70158;
	const c3 = c1 + 1;
	const u = t - 1;
	return 1 + c3 * u * u * u + c1 * u * u;
}

export function easeInQuad(t) {
	return t * t;
}

/** Transform-origin for finger emoji anchors (tip = interaction point). */
export const FINGER_ORIGIN = {
	up: '50% 0%',
	down: '50% 100%',
	left: '0% 50%',
	right: '100% 50%',
};

export const SWIPE_ORIGIN = {
	up: '50% 12%',
	down: '50% 88%',
};

/**
 * @param {HTMLElement} mount
 * @param {{ width?: number, height?: number }} [opts] - logical game size in px.
 *   When set, the layer uses this coordinate space and scales uniformly to fit
 *   the mount element's displayed size (fixed-aspect game canvases).
 * @returns {HTMLElement}
 */
export function createLayer(mount, { width, height } = {}) {
	const el = document.createElement('div');
	el.className = 'drop-tutorial-layer';
	el.style.cssText = [
		'position:absolute',
		'left:0',
		'top:0',
		'pointer-events:none',
		'overflow:hidden',
	].join(';');

	const logicalW = typeof width === 'number' && width > 0 ? width : null;
	const logicalH = typeof height === 'number' && height > 0 ? height : null;
	/** @type {ResizeObserver | null} */
	let ro = null;

	function syncSize() {
		if (logicalW && logicalH) {
			el.style.width = `${logicalW}px`;
			el.style.height = `${logicalH}px`;
			const sx = mount.clientWidth / logicalW;
			const sy = mount.clientHeight / logicalH;
			el.style.transformOrigin = 'top left';
			el.style.transform = `scale(${sx}, ${sy})`;
		} else {
			el.style.width = '100%';
			el.style.height = '100%';
			el.style.transform = '';
		}
	}

	syncSize();
	if (logicalW && logicalH && typeof ResizeObserver !== 'undefined') {
		ro = new ResizeObserver(syncSize);
		ro.observe(mount);
	}

	el._dropTutorialCleanup = () => ro?.disconnect();
	mount.appendChild(el);
	return el;
}

/**
 * @param {HTMLElement} parent
 * @param {number} x
 * @param {number} y
 * @returns {HTMLElement}
 */
export function createPrimitiveRoot(parent, x, y) {
	const root = document.createElement('div');
	root.className = 'drop-tutorial-primitive';
	root.style.cssText = 'position:absolute;pointer-events:none;left:0;top:0;will-change:transform,opacity;';
	setRootPosition(root, x, y);
	parent.appendChild(root);
	// PIXI-compat: stackit toggles `.container.visible`
	Object.defineProperty(root, 'visible', {
		get() {
			return root.style.visibility !== 'hidden';
		},
		set(v) {
			root.style.visibility = v ? 'visible' : 'hidden';
		},
	});
	return root;
}

/** @param {HTMLElement} root */
export function setRootPosition(root, x, y) {
	root.style.transform = `translate(${x}px, ${y}px)`;
}

/**
 * @param {HTMLElement} container
 * @param {{ width?: number, height?: number }} [logical]
 * @returns {() => ViewportSize}
 */
export function createViewportReader(container, logical) {
	return () => {
		if (logical?.width && logical?.height) {
			return { width: logical.width, height: logical.height };
		}
		if (container === document.body) {
			return { width: window.innerWidth, height: window.innerHeight };
		}
		return {
			width: container.clientWidth || window.innerWidth,
			height: container.clientHeight || window.innerHeight,
		};
	};
}

/**
 * @param {HTMLElement} el
 */
export function removeElement(el) {
	if (el.parentElement) el.parentElement.removeChild(el);
}
