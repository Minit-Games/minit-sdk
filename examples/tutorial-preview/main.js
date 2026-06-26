import { shouldShowTutorial } from '/dist/modules/tutorial/gating.js';
import { createTutorialOverlay } from '/dist/modules/tutorial/overlay.js';

// Minimal host shim for local preview (no bundler).
window.minit = window.minit || { sdkVersion: 'preview' };

function reportResult(score, opts) {
	console.log('[preview] reportResult', score, opts);
}

const game = document.getElementById('game');
const statusEl = document.getElementById('status');
const scoreEl = document.getElementById('score');
const tapTarget = document.getElementById('tap-target');
const holdTarget = document.getElementById('hold-target');
const swipeDot = document.getElementById('swipe-dot');

let score = 0;
let tutorial = null;
let activeHandles = [];
let step = 0;

const GAME_W = 960;
const GAME_H = 560;

/** Element center in fixed logical game coordinates (matches canvas size). */
function targetCenter(el) {
	return {
		x: el.offsetLeft + el.offsetWidth / 2,
		y: el.offsetTop + el.offsetHeight / 2,
	};
}

function swipePath() {
	const lane = document.getElementById('swipe-lane');
	const y = lane.offsetTop + lane.offsetHeight / 2;
	const x1 = lane.offsetLeft + 40;
	const x2 = lane.offsetLeft + lane.offsetWidth - 40;
	return [{ x: x1, y }, { x: x2, y }];
}

function clearHandles() {
	for (const h of activeHandles) {
		try { h.remove(); } catch { /* already removed */ }
	}
	activeHandles = [];
}

function setStatus(text) {
	statusEl.textContent = text;
}

function bumpScore(n) {
	score += n;
	scoreEl.textContent = `Score: ${score}`;
}

function finishTutorial() {
	clearHandles();
	if (tutorial) {
		tutorial.destroy();
		tutorial = null;
	}
	setStatus('Tutorial complete — play freely');
	reportResult(score, { userData: 'true', flavorText: 'Finished the tutorial walkthrough.' });
}

function runStep() {
	clearHandles();
	if (!tutorial) return;

	switch (step) {
		case 0: {
			setStatus('Step 1/4 — intro pill');
			activeHandles.push(tutorial.showPill('Quick tour: tap, hold, and swipe.', {
				delay: 0,
				onClose: () => { step = 1; runStep(); },
			}));
			break;
		}
		case 1: {
			setStatus('Step 2/4 — tap the red tile');
			const c = targetCenter(tapTarget);
			activeHandles.push(tutorial.highlight({ x: c.x, y: c.y, pulseScale: 1.2 }));
			activeHandles.push(tutorial.showFinger({ x: c.x, y: c.y, gesture: 'tap', direction: 'up' }));
			break;
		}
		case 2: {
			setStatus('Step 3/4 — hold the purple tile');
			tapTarget.classList.add('done');
			const c = targetCenter(holdTarget);
			activeHandles.push(tutorial.highlight({ x: c.x, y: c.y, pulseScale: 1.2 }));
			activeHandles.push(tutorial.showFinger({ x: c.x, y: c.y, gesture: 'longPress', direction: 'up' }));
			break;
		}
		case 3: {
			setStatus('Step 4/4 — swipe the lane');
			holdTarget.classList.add('done');
			const [a, b] = swipePath();
			activeHandles.push(tutorial.highlight({ x: (a.x + b.x) / 2, y: a.y, pulseScale: 2.5 }));
			activeHandles.push(tutorial.showSwipe({
				from: () => swipePath()[0],
				to: () => swipePath()[1],
				cycleDurationMs: 1800,
			}));
			break;
		}
		case 4: {
			setStatus('Done pill');
			activeHandles.push(tutorial.showPill('Nice! You are ready to play.', {
				delay: 0,
				onClose: finishTutorial,
			}));
			break;
		}
		default:
			finishTutorial();
	}
}

function startTutorial() {
	if (tutorial) tutorial.destroy();
	tutorial = createTutorialOverlay({
		container: game,
		width: GAME_W,
		height: GAME_H,
		zIndex: 50,
	});
	step = 0;
	tapTarget.classList.remove('done');
	holdTarget.classList.remove('done');
	runStep();
}

function onTapTarget() {
	if (step !== 1) return;
	bumpScore(10);
	step = 2;
	runStep();
}

function onHoldTarget() {
	if (step !== 2) return;
	bumpScore(20);
	step = 3;
	runStep();
}

function onSwipeComplete() {
	if (step !== 3) return;
	bumpScore(30);
	swipeDot.classList.add('visible');
	step = 4;
	runStep();
}

// --- Input ---
tapTarget.addEventListener('click', onTapTarget);

let holdTimer = null;
holdTarget.addEventListener('pointerdown', (e) => {
	if (step !== 2) return;
	holdTarget.setPointerCapture(e.pointerId);
	holdTimer = setTimeout(() => {
		holdTimer = null;
		onHoldTarget();
	}, 600);
});
holdTarget.addEventListener('pointerup', () => {
	if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
});
holdTarget.addEventListener('pointercancel', () => {
	if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
});

let swipeStart = null;
game.addEventListener('pointerdown', (e) => {
	if (step !== 3) return;
	swipeStart = { x: e.clientX, y: e.clientY };
});
game.addEventListener('pointerup', (e) => {
	if (step !== 3 || !swipeStart) return;
	const dx = e.clientX - swipeStart.x;
	swipeStart = null;
	if (Math.abs(dx) > 80) onSwipeComplete();
});

document.getElementById('restart').addEventListener('click', () => {
	if (!shouldShowTutorial()) {
		setStatus('Tutorial gated off — use “Force tutorial” or clear ?userData');
		return;
	}
	score = 0;
	scoreEl.textContent = 'Score: 0';
	swipeDot.classList.remove('visible');
	startTutorial();
});

// --- Boot ---
if (shouldShowTutorial()) {
	setStatus('Tutorial starting…');
	startTutorial();
} else {
	setStatus('Tutorial skipped (returning player or ?tutorial=0)');
}
