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
| `getConfigValue(key, default?)` | Read a URL-param config value injected by the app |
| `getConfig()` | Get all URL-param config values as a plain object |
| `seededRandom()` | Deterministic random number (seeded from `?seed=` param) |
| `patchSeed(seed)` | Override the random seed at runtime |
| `addBackground(options?)` | Apply a styled background to the game container |
| `applyMetaTags()` | Inject charset + viewport meta tags |

#### Legacy aliases

For backward compatibility with games written against earlier versions, the old `Drop`-prefixed names are exported as aliases: `reportDropResult`, `getDropConfigValue`, `getDropConfig`, `initializeDropSDK`, `addDropBackground`, `applyDropMetaTags`, `getDropEnvironment`, and the types `DropBackground`/`DropResultOptions`/`DropEnvironment`.

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
