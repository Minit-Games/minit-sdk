import seedrandom from 'seedrandom';
import { getDropConfigValue } from './config';

export type RandomModule = { seedParam?: string; fallbackSeed?: string;  patchGlobal?: boolean };


const seed = getDropConfigValue("seed") ?? Date.now().toString();
console.log("[DropSDK] Random seed =", seed);
let random = seedrandom(seed, { global: false });

export function patchSeed(seed: string): void {
    console.log("[DropSDK] Patching global random with seed =", seed);
    random = seedrandom(seed, { global: false });
}

export function seededRandom() {
    return random();
}
