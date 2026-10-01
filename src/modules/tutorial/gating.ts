import { getConfigValue } from "../config.js";

/**
 * Decide whether to run the first-play tutorial for this Post.
 *
 * **Always call this before creating a tutorial overlay.** If it returns
 * `false`, do not show any tutorial UI — the host reports that this player has
 * already played this Game.
 *
 * Resolution order (top wins):
 * 1. `?tutorial=1` or `?tutorial=true` → force **show** (QA / preview)
 * 2. `?tutorial=0` or `?tutorial=false` → force **hide**
 * 3. `window.minit.hasPlayedGame === true` → **hide** (returning player; only the
 *    mobile app injects this flag, after a non-preview `reportResult`)
 * 4. otherwise → **show** (new players, web play, Studio preview, older app hosts)
 *
 * Gating needs nothing from the Game: do not persist `userData` for the tutorial.
 *
 * **Tutorial design:** prefer gestures over text. Use `highlight` to mark important
 * game elements, pair with `showFinger` / `showSwipe` to demonstrate actions, and
 * reserve `showPill` for rules gestures alone cannot convey. Do not pass visual
 * style overrides or edit theme.js unless the creator explicitly asks.
 */
export function shouldShowTutorial(): boolean {
    const override = getConfigValue("tutorial");
    if (override === "1" || override === "true") return true;
    if (override === "0" || override === "false") return false;

    return window.minit?.hasPlayedGame !== true;
}
