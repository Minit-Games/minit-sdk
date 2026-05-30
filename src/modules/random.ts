import seedrandom from 'seedrandom';
import { getConfigValue } from './config.js';

export type RandomModule = { seedParam?: string; fallbackSeed?: string;  patchGlobal?: boolean };

let random: seedrandom.PRNG | undefined;

function ensureInitialized(): void {
    if (random !== undefined) return;
    const seed = getConfigValue("seed") ?? Date.now().toString();
    console.log("[MinitSDK] Random seed =", seed);
    random = seedrandom(seed, { global: false });
}

export function patchSeed(seed: string): void {
    console.log("[MinitSDK] Patching global random with seed =", seed);
    random = seedrandom(seed, { global: false });
}

export function seededRandom() {
    ensureInitialized();
    return random!();
}
