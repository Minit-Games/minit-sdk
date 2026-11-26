import { track } from '/dist/modules/track.js';
import { loadingDone } from '/dist/modules/loadingDone.js';
import { reportResult } from '/dist/modules/result.js';

let level = 0;

function on(id, handler) {
	document.getElementById(id).addEventListener('click', handler);
}

on('valid', () => {
	level++;
	track('level_start', { level, mode: 'classic', hard: level % 2 === 0 });
});

on('burst', () => {
	for (let i = 0; i < 10; i++) {
		track('coin_pickup', { index: i });
	}
});

on('large', () => {
	const props = {};
	for (let i = 0; i < 7; i++) {
		props[`chunk${i}`] = 'x'.repeat(250);
	}
	track('replay_snapshot', props);
});

on('reserved', () => track('minit.sneaky'));
on('invalid', () => track(''));
on('loading-done', () => loadingDone());
on('report-result', () => reportResult(1234, { flavorText: 'Preview run', userData: `level=${level}` }));
