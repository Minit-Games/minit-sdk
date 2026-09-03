import { getConfigValue } from "../config.js";
import { getUserData } from "../userData.js";

/**
 * Decide whether to run the first-play tutorial for this Post.
 *
 * **Always call this before creating a tutorial overlay.** If it returns
 * `false`, do not show any tutorial UI — the host has persisted userData for
 * this player (they have played before).
 *
 * Resolution order (top wins):
 * 1. `?tutorial=1` or `?tutorial=true` → force **show** (QA / preview)
 * 2. `?tutorial=0` or `?tutorial=false` → force **hide**
 * 3. `getUserData()` is a non-empty string → **hide** (returning player; host or a
 *    previous `reportResult` already stored a value in the Game's userData slot)
 * 4. otherwise → **show** (default-on for new players)
 *
 * After any play session, persist the flag from **every** `reportResult` call:
 * `reportResult(score, { userData: 'true', ... })`. Omitting `userData` leaves
 * the slot unchanged and the tutorial will show again on the next launch.
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

    const data = getUserData();
    // Any persisted non-empty value means this player has played before.
    if (data !== undefined && data !== "") return false;

    return true;
}
