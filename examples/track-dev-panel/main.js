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

on('reserved', () => track('minit.sneaky'));
on('invalid', () => track('bad key!'));
on('loading-done', () => loadingDone());
on('report-result', () => reportResult(1234, { flavorText: 'Preview run' }));
