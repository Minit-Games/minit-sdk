# Interactive tutorials

First-play onboarding for Minit drops — modal instruction pills, pointing fingers, highlight rings, and swipe demos. **No PIXI or other rendering library required** — the overlay is pure DOM.

```bash
npm install @minit-games/sdk
```

Pass your game container (or omit it to use `document.body`). Coordinates are in the same logical space as your game viewport (width × height of the container).

```ts
const GAME_W = 960;
const GAME_H = 560;

const tutorial = createTutorialOverlay({
  container: gameRoot,
  width: GAME_W,
  height: GAME_H,
});
tutorial.highlight({ x: GAME_W / 2, y: GAME_H / 2 });
```

Pass `width` and `height` when your game uses a **fixed logical canvas** (e.g. 960×560) that CSS may scale to fit the screen. The overlay clips to `container` and scales gestures/pills to match. Omit both when `(x, y)` are already in the container's displayed pixel space.

**The modal pill sizes itself either way.** Its layout tokens are authored in the `referenceWidth` × `referenceHeight` design space declared in `theme.js` (960×1480). When you pass `width`/`height`, `showPill` consumes the tokens 1:1 at the 960px reference width and scales them proportionally on narrower fixed surfaces; height does not affect this multiplier. Without fixed dimensions — a fluid, CSS-pixel canvas — `showPill` instead scales the tokens by the contain-fit factor a fixed surface of the reference size would get on the current viewport, so the card keeps the same proportions (roughly 80% of the viewport width) rather than consuming a 48px font and 100px screen margin as raw pixels on a 390px-wide phone.

## Local preview

A minimal walkthrough game lives in `examples/tutorial-preview/`. It exercises every primitive (pill, highlight, tap finger, long-press, swipe) and the gating URL params.

```bash
npm run preview:tutorial
```

Opens **http://localhost:5173/** — rebuilds `dist/` first, then serves the example with native ESM (no bundler). It defaults to the fixed 960×560 surface; use `?minit_previewSurface=400x700` for an arbitrary fixed logical surface or `?minit_previewSurface=fluid` for a fluid canvas. The HUD also links the tutorial gating parameters.

## Gating — always check userData first

**Never show tutorial UI without calling `shouldShowTutorial()` first.** Returning players have persisted `userData` from a previous session — if you skip the check, they will see the tutorial again every launch.

```ts
import { shouldShowTutorial, createTutorialOverlay } from '@minit-games/sdk/ui';
import { reportResult } from '@minit-games/sdk';

// Capture once at boot — do not re-read mid-session.
const tutorialMode = shouldShowTutorial();

if (tutorialMode) {
  const tutorial = createTutorialOverlay({ container: gameRoot });

  // Prefer gestures + highlights over text — show WHAT to interact with, not a wall of copy.
  tutorial.highlight({ x: tileX, y: tileY });
  tutorial.showFinger({ x: tileX, y: tileY, gesture: 'tap' });

  // Only add a pill when the player genuinely cannot infer the rule from gestures alone.
  // Wire each step to game events — show one step at a time, advance when the player acts.
}

// EVERY reportResult call site — persist so the next launch skips the tutorial:
reportResult(score, {
  flavorText: '...',
  userData: 'true',
});
```

### Resolution order

| Priority | Condition | Result |
|----------|-----------|--------|
| 1 | `?tutorial=1` or `?tutorial=true` | Force **show** (QA) |
| 2 | `?tutorial=0` or `?tutorial=false` | Force **hide** |
| 3 | `getUserData()` is a non-empty string | **Hide** — host or a prior `reportResult` stored a value |
| 4 | (default) | **Show** — new player |

The drop's userData slot is configured in the [Creator Console](https://console.minit.games) at upload time. Game code does not pass a key name — the SDK reads the single slot via `getUserData()`.

### Persisting completion

Add `userData: 'true'` to **every** `reportResult(...)` call (game over, win, timeout, give-up). Do not gate on `if (tutorialMode)` — writing `'true'` idempotently is safe and self-heals if a prior session crashed before reporting.

Omitting `userData` leaves the slot unchanged and the tutorial **will show again** on the next launch.

### Local testing

| URL | Expected |
|-----|----------|
| `/?tutorial=1` | Tutorial always shows |
| `/?tutorial=0` | Tutorial never shows |
| `/` (no userData) | Tutorial shows |
| `/?userData=true` | Tutorial hidden (simulates returning player) |

In DevTools before reload:

```js
window.minit = { userData: 'true' };
```

## Primitives

| Method | Use | Blocks input? |
|--------|-----|---------------|
| `highlight({ x, y })` | **First choice** — expanding rings on an important element (does not cover it) | No |
| `showFinger({ x, y, gesture?, direction? })` | Looping tap/long-press demo — pair with `highlight` on the same target | No |
| `showSwipe({ from, to })` or `{ path }` | Looping drag/swipe demo | No |
| `showPill(text, { onClose, delay? })` | Modal text — **last resort** when gestures cannot convey the rule | **Yes** |
| `destroy()` | Tear down overlay + ticker | — |

All `(x, y)` coordinates are in **game viewport space** — the logical width/height passed to `createTutorialOverlay({ width, height })`, or the container's client size when those are omitted. Nothing renders outside the container; modal pills and input blocking are scoped to the canvas only.

The per-step state machine ("after first tap, show finger at next target") stays **in game code** — it depends on game-specific state.

## Design principles — step-by-step, state-reactive, gestures first

**The tutorial is a live guide, not a briefing.** It runs alongside the game and reacts to what the player actually does — each step appears only when the game reaches the state where that action is relevant, and disappears the moment the player completes it.

### Step-by-step, not upfront

Never dump instructions at the start. Instead:

1. The game begins immediately — no paused "tutorial mode" with walls of text.
2. When the game reaches a state that calls for guidance (a new element appears, an action becomes available), **show one step**: a highlight and/or finger on the relevant target.
3. Wait for the player to perform the action before advancing.
4. Reveal the next step only after the previous one succeeds.

A player should never be reading — they should be doing. Each step teaches exactly one thing in the moment it matters.

### State-reactive — follow the game, not a timer

Tutorial primitives must be wired to **game events and state**, not to fixed timeouts or a linear script that runs independently of play. Examples:

- Show a finger on the first enemy **when that enemy spawns**, not 2 seconds after load.
- Remove the swipe hint the moment the player **completes a swipe** — not on a timeout.
- Advance to "now avoid the hazard" step only when the hazard **actually appears**.
- If the player acts correctly before the hint appears, **skip that step entirely**.

The state machine lives in your game code, not in the tutorial library. The SDK primitives are stateless tools you call and remove; the logic for *when* to call them is yours.

```ts
// Example: step machine wired to game state
let tutorialStep = 0;

function onEnemySpawned(enemy) {
  if (tutorialStep !== 0) return;          // already past this step
  const ring = tutorial.highlight({ x: enemy.x, y: enemy.y });
  const finger = tutorial.showFinger({ x: enemy.x, y: enemy.y, gesture: 'tap' });

  function onEnemyTapped() {
    ring.remove();
    finger.remove();
    tutorialStep = 1;
    // next step fires only when the next relevant game event occurs
  }
  enemy.once('tapped', onEnemyTapped);
}

function onBonusTileAppeared(tile) {
  if (tutorialStep !== 1) return;          // not there yet — skip
  const ring = tutorial.highlight({ x: tile.x, y: tile.y });
  tile.once('collected', () => { ring.remove(); tutorialStep = 2; });
}
```

### Gestures first, text last — never both at once

**Show, don't tell.** A looping finger or swipe demo is self-explanatory — the player should understand what to do from motion alone. Modal pills (`showPill`) block the game and force reading; use them sparingly.

**Pills and gestures must alternate, never overlap.** Each step is either a *show* step (highlight + finger/swipe — the player can interact freely) or a *tell* step (pill only — gesture hints are removed first). Showing a finger while a pill is open creates visual noise and confuses the player about whether to read or act.

| Step type | What is visible | Player can interact? |
|-----------|-----------------|----------------------|
| Show | `highlight` + `showFinger` / `showSwipe` | Yes — input is open |
| Tell | `showPill` only — **remove any active gesture hints first** | No — input is blocked |

### Priority order

1. **`highlight`** — draw the eye to the important element (button, tile, target, hazard) without covering it. Use on every *show* step where something on screen needs attention.
2. **`showFinger` / `showSwipe`** — demonstrate the exact gesture the player should perform. Pair with a highlight on the same target whenever possible.
3. **`showPill`** — only when a rule is genuinely not guessable from gestures (non-obvious mechanic, stakes, or puzzle framing). Keep to one short sentence. **Remove all active gesture hints before opening a pill.** Never open with a pill if a gesture would suffice.

### Typical step recipe

```ts
// ── SHOW step: gesture + highlight, input open ──────────────────────────────
const ring = tutorial.highlight({ x: targetX, y: targetY });
const finger = tutorial.showFinger({ x: targetX, y: targetY, gesture: 'tap' });

function onTargetTapped() {
  ring.remove();
  finger.remove();
  // advance to next step (another show step, or a tell step if a rule must be stated)
}

// ── TELL step (only if needed): remove gestures first, then show pill ────────
function showRuleStep() {
  ring.remove();   // clear any active gesture hints before opening a pill
  finger.remove();
  tutorial.showPill('One wrong tap ends the run.', {
    onClose: () => {
      // after the player dismisses, start the next show step
    },
  });
}
```

Combine **highlight + finger** on the same target for most steps. The highlight marks *what* matters; the finger marks *how* to act on it.

### Fixed styling — no overrides by default

All tutorial visuals (pill colors, finger emoji, ring size, fonts, timings) come from the SDK's bundled `theme.js`. **Do not change them** unless the creator explicitly asks for a different look.

| OK by default | Do not unless the creator requests it |
|---------------|--------------------------------------|
| `{ x, y }` position on gestures (`showFinger`, `showSwipe`, `highlight`) | Editing `theme.js` |
| `direction`, `gesture`, `from` / `to` / `path` | `fontSize`, `glyph`, `color`, `radius`, `pulseScale` |
| `onClose`, `delay` on pills | Custom HTML/CSS overlays or DOM styling on tutorial elements |
| `createTutorialOverlay({ container?, width?, height?, zIndex? })` | Per-call color/size overrides on any primitive |
| | **`showPill` position** — the pill is always centered by the SDK |

`showPill` intentionally exposes **no** font/color/style overrides and **no position argument** — every pill appears centered in the canvas and looks identical across drops. Do not attempt to reposition or restyle it (e.g. via wrapper `div`, CSS, or DOM mutation) unless the creator explicitly asks. Finger, highlight, and swipe primitives accept some sizing overrides for edge cases, but **omit them by default**; the theme defaults cover the common case.

### When text is OK

| Use a pill | Skip the pill |
|------------|---------------|
| A non-obvious rule the gestures cannot convey ("One wrong tap ends the run") | A single tap, swipe, or jump the finger already demonstrates |
| Puzzle/strategy framing before the first move makes sense | Arcade/reflex games where the core verb is obvious |
| Explaining the goal *after* the player just performed the first action (reward, not toll booth) | Restating what the looping hand already shows ("Tap to jump!") |

### When to use `highlight` alone

Use `highlight` without a finger when the element should be **noticed but not tapped yet** — e.g. a hazard appearing on screen, a power-up slot, or an exit tile the player will reach later. Add the finger once interaction is expected.

## Arcade vs puzzle games

- **Arcade / reflex** (tap, swipe, jump): **gesture-only** — `highlight` + `showFinger` / `showSwipe` from the first frame. No intro pill. Optionally one short pill *after* the first successful action to state the goal.
- **Puzzle / strategy**: a single short intro pill may be needed to frame the rules, but still follow immediately with `highlight` + finger on the first interactive element — the player should be acting within a second.

## Do not use

- A start menu or replay menu — the drop starts straight into gameplay and ends with `reportResult(...)` (see [README game lifecycle](./README.md#game-lifecycle)).
- Custom HTML/CSS tutorial overlays — use the SDK primitives for a consistent look and correct input blocking.
- **A block of text or multiple pills upfront** — show one step at a time, in the moment it is needed, not all instructions before play begins.
- **A fixed-timer script** — wire every hint to game state/events, not to `setTimeout`. If the player acts before the hint would appear, skip that step entirely.
- **Advancing steps on a timer** — advance only when the player completes the action, never automatically after N ms.
- Opening with a modal pill when a gesture would work — lead with `highlight` + `showFinger` / `showSwipe` instead.
- Text that only narrates the obvious ("Tap the button!") while a finger is already pointing at it.
- **Showing a gesture hint and a pill at the same time** — remove all active `highlight` / `showFinger` / `showSwipe` elements before calling `showPill`, and do not start gesture hints while a pill is open.
- Styling overrides (`fontSize`, `glyph`, `color`, `pulseScale`, etc.) or edits to `theme.js` — the SDK ships a fixed look; only customize when the creator explicitly asks.
- Repositioning the pill — `showPill` is always centered in the canvas by the SDK. Do not move it via CSS, wrapper elements, or DOM mutation unless the creator explicitly asks.

## Assets

Pill OK-button artwork and SFX are embedded as data URIs inside the SDK (same pattern as UI fonts) — no separate asset files to copy and no runtime fetches. Source files under `src/modules/tutorial/assets/` are rebuilt into `bundled.js` on `npm run build`.
