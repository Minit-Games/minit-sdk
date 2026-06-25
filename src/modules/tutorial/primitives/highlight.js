import { TUTORIAL_THEME } from '../theme.js';
import { createRipplePair } from './_ripple.js';
import { createPrimitiveRoot, removeElement, setRootPosition } from './dom.js';

export function createHighlight({
	container, tickRegistry, x, y,
	radius, color, strokeMax, periodMs, pulseScale,
}) {
	const T = TUTORIAL_THEME;
	const ps = typeof pulseScale === 'number' && pulseScale > 0 ? pulseScale : 1;
	const r = (radius !== undefined ? radius : T.highlight.radiusPx) * ps;
	const sm = (strokeMax !== undefined ? strokeMax : T.highlight.strokeMaxPx) * ps;

	const root = createPrimitiveRoot(container, x, y);

	const ripple = createRipplePair({
		parent: root,
		radius: r,
		strokeMax: sm,
		color: color !== undefined ? color : T.highlight.color,
		periodMs: periodMs !== undefined ? periodMs : T.highlight.periodMs,
	});

	let removed = false;
	function tick(time) {
		if (removed) return;
		ripple.tick(time);
	}
	const unregisterTick = tickRegistry.add(tick);

	return {
		container: root,
		setPosition(nx, ny) {
			if (removed) return;
			setRootPosition(root, nx, ny);
		},
		remove() {
			if (removed) return;
			removed = true;
			unregisterTick();
			removeElement(root);
		},
	};
}
