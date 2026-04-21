# @minit-games/sdk

Official SDK for building Minit Games HTML5 mini-games. Provides the game lifecycle API, configuration helpers, UI components (tutorial overlays, feedback text, flying rewards, header bars), and background utilities.

## Install

```bash
npm install @minit-games/sdk
```

## Usage

### Core entry point

```ts
import { initializeSDK, getConfigValue, reportResult, loadingDone } from '@minit-games/sdk';

// Initialize with optional background
initializeSDK({
    background: {
        backgroundColor: '#1a1a2e',
        shapes: { enabled: true }
    }
});

// Read URL-param config (passed by the app)
const difficulty = getConfigValue('difficulty', 'normal');

// Signal that assets are loaded and the game is ready
loadingDone();

// At game end, report the result
reportResult(1500, { flavorText: 'Great run!' });
```

### UI entry point

```ts
import { showTutorial, hideTutorial, showPositiveFeedback, createHeaderBar, spawnReward } from '@minit-games/sdk/ui';

// Tutorial hint
showTutorial('Tap to jump!', 'center');
// ... on first player action:
hideTutorial();

// Feedback pop-up
showPositiveFeedback('Combo x3!');

// Header bar with score and turns panels
const header = createHeaderBar({ y: 60, padding: 40 });
const score = header.addPanel({ label: 'Score', value: 0, align: 'right', style: { valueColor: '#f7931e' } });
const turns = header.addPanel({ label: 'Turns', value: 10 });

// Animate a reward flying to the score panel
score.flyToPanel({
    start: { x: 200, y: 400 },
    visual: '⭐',
    onArrive: () => score.setValue(Number(score.getValue()) + 100, { animate: true })
});
```

## API overview

### `@minit-games/sdk` (core)

| Export | Description |
|--------|-------------|
| `initializeSDK(config?)` | Initialize the SDK; sets up background and backward-compat shims |
| `loadingDone()` | Signal to the app that the game is ready to be shown |
| `reportResult(result, options?)` | Submit the final game result |
| `getUserData()` | Read the per-creator persistent string blob (see [Persistent user data](#persistent-user-data)) |
| `getConfigValue(key, default?)` | Read a URL-param config value injected by the app |
| `getConfig()` | Get all URL-param config values as a plain object |
| `seededRandom()` | Deterministic random number (seeded from `?seed=` param) |
| `patchSeed(seed)` | Override the random seed at runtime |
| `addBackground(options?)` | Apply a styled background to the game container |
| `applyMetaTags()` | Inject charset + viewport meta tags |

#### Legacy aliases

For backward compatibility with games written against earlier versions, the old `Drop`-prefixed names are exported as aliases: `reportDropResult`, `getDropConfigValue`, `getDropConfig`, `initializeDropSDK`, `addDropBackground`, `applyDropMetaTags`, `getDropEnvironment`, and the types `DropBackground`/`DropResultOptions`/`DropEnvironment`.

## Persistent user data

Each player has a single string blob stored per creator — shared across all of your games and across any mods of those games. Use it to persist save data, settings, high scores, or any other per-player state.

### Reading

```ts
import { getUserData } from '@minit-games/sdk';

const raw = getUserData();  // string | undefined
```

- Returns `undefined` when no record exists for this player (first time they play any of your games).
- Returns `""` when the player previously stored an empty string — distinct from `undefined`.

### Writing

Pass `userData` as part of `reportResult`:

```ts
import { reportResult } from '@minit-games/sdk';

reportResult(score, { userData: JSON.stringify({ level: 3, coins: 42 }) });
```

The blob is written to the backend when the result is reported. Omitting `userData` (or not passing `options`) leaves the previously stored value unchanged.

### Limits

- **4096 UTF-8 bytes** maximum. Exceeding this causes the backend to return `400 { "message": "USER_DATA_TOO_LARGE" }` and the write is rejected. Keep the blob small; store references or deltas rather than full state where possible.

### Multiple games

Because the blob is keyed by `creatorId` — not by individual drop — all your games share the same record. If you publish more than one game, namespace your data with JSON keys so games don't overwrite each other:

```ts
const data = JSON.parse(getUserData() ?? '{}');
const gameState = data['my-platformer'] ?? { level: 1 };

// ... game logic ...

reportResult(score, {
  userData: JSON.stringify({ ...data, 'my-platformer': gameState })
});
```

> Convenience helpers for named-slot access are planned (available in a future SDK release) but not yet shipped.

---

### `@minit-games/sdk/ui`

| Export | Description |
|--------|-------------|
| `showTutorial(text, options?)` | Display a non-blocking tutorial hint overlay |
| `hideTutorial()` | Hide the current tutorial hint |
| `isTutorialVisible()` | Check if a tutorial hint is showing |
| `showFeedback(text, variant?, duration?)` | Show a temporary feedback pop-up (`"positive"`, `"neutral"`, `"negative"`) |
| `showPositiveFeedback(text, duration?)` | Convenience wrapper — green variant |
| `showNeutralFeedback(text, duration?)` | Convenience wrapper — orange variant |
| `showNegativeFeedback(text, duration?)` | Convenience wrapper — red variant |
| `preloadFeedbackFont()` | Preload the feedback font to avoid flash |
| `spawnReward(options)` | Animate a single reward icon from start → target |
| `spawnRewards(count, options, staggerMs?)` | Animate multiple reward icons with staggered timing |
| `createHeaderBar(config?)` | Create a header bar for displaying game stats |
| `getHeaderBar()` | Get the current header bar instance |

## License

MIT — see [LICENSE](./LICENSE).
