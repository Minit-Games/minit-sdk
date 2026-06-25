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

## Local preview

A minimal walkthrough game lives in `examples/tutorial-preview/`. It exercises every primitive (pill, highlight, tap finger, long-press, swipe) and the gating URL params.

```bash
npm run preview:tutorial
```

Opens **http://localhost:5173/** — rebuilds `dist/` first, then serves the example with native ESM (no bundler). HUD links cover `?tutorial=1`, `?tutorial=0`, and `?userData=true`.

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
  // ... step machine in game code; tutorial.destroy() when done
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

## Design principles — gestures first, text last

**Show, don't tell.** A looping finger or swipe demo is self-explanatory — the player should understand what to do from motion alone. Modal pills (`showPill`) block the game and force reading; use them sparingly.

### Priority order

1. **`highlight`** — draw the eye to the important element (button, tile, target, hazard) without covering it. Use on every step where something on screen needs attention.
2. **`showFinger` / `showSwipe`** — demonstrate the exact gesture the player should perform. Pair with a highlight on the same target whenever possible.
3. **`showPill`** — only when a rule is genuinely not guessable from gestures (non-obvious mechanic, stakes, or puzzle framing). Keep to one short sentence. Never open with a pill if a gesture would suffice.

### Typical step recipe

```ts
// 1. Highlight the target so the player knows WHERE to look
const ring = tutorial.highlight({ x: targetX, y: targetY });

// 2. Show HOW to interact — finger for tap/hold, swipe for drag
const finger = tutorial.showFinger({ x: targetX, y: targetY, gesture: 'tap' });

// 3. When the player completes the action, remove primitives and advance
function onTargetTapped() {
  ring.remove();
  finger.remove();
  // next step — highlight + gesture on the next element, not another pill
}
```

Combine **highlight + finger** on the same target for most steps. The highlight marks *what* matters; the finger marks *how* to act on it.

### Fixed styling — no overrides by default

All tutorial visuals (pill colors, finger emoji, ring size, fonts, timings) come from the SDK's bundled `theme.js`. **Do not change them** unless the creator explicitly asks for a different look.

| OK by default | Do not unless the creator requests it |
|---------------|--------------------------------------|
| `{ x, y }` position | Editing `theme.js` |
| `direction`, `gesture`, `from` / `to` / `path` | `fontSize`, `glyph`, `color`, `radius`, `pulseScale` |
| `onClose`, `delay` on pills | Custom HTML/CSS overlays or DOM styling on tutorial elements |
| `createTutorialOverlay({ container?, width?, height?, zIndex? })` | Per-call color/size overrides on any primitive |

`showPill` intentionally exposes **no** font/color/style overrides — every pill looks identical across drops. Finger, highlight, and swipe primitives accept some sizing overrides for edge cases, but **omit them by default**; the theme defaults cover the common case.

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

- Custom HTML/CSS tutorial overlays — use the SDK primitives for a consistent look and correct input blocking.
- Opening with a modal pill when a gesture would work — leads with `highlight` + `showFinger` / `showSwipe` instead.
- Text that only narrates the obvious ("Tap the button!") while a finger is already pointing at it.
- Styling overrides (`fontSize`, `glyph`, `color`, `pulseScale`, etc.) or edits to `theme.js` — the SDK ships a fixed look; only customize when the creator explicitly asks.

## Assets

Pill OK-button artwork and SFX ship inside the npm package under `dist/modules/tutorial/assets/`. Your bundler (Vite, etc.) traces the static imports automatically when you import from `@minit-games/sdk/ui`.
