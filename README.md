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
| `getUserData()` | Read the player's persistent userData string (see [Persistent user data](#persistent-user-data)) |
| `getConfigValue(key, default?)` | Read a URL-param config value injected by the app |
| `getConfig()` | Get all URL-param config values as a plain object |
| `seededRandom()` | Deterministic random number (seeded from `?seed=` param) |
| `patchSeed(seed)` | Override the random seed at runtime |
| `addBackground(options?)` | Apply a styled background to the game container |
| `applyMetaTags()` | Inject charset + viewport meta tags |

#### Legacy aliases

For backward compatibility with games written against earlier versions, the old `Drop`-prefixed names are exported as aliases: `reportDropResult`, `getDropConfigValue`, `getDropConfig`, `initializeDropSDK`, `addDropBackground`, `applyDropMetaTags`, `getDropEnvironment`, and the types `DropBackground`/`DropResultOptions`/`DropEnvironment`.

## Using with AI assistants

Chat-based AI assistants (Claude, ChatGPT, Gemini, and others) can scaffold a complete Minit game project, but the output is typically source code — it needs a build step before it can be uploaded. Once your game is working in the AI's preview, give it this prompt:

```
The game is ready. Please run `npm run build` and give me a ZIP whose root is the contents of the `dist/` folder — `index.html` should be at the top of the ZIP, not inside a `dist/` subfolder.
```

That ZIP is what you upload to the [Creator Console](https://console.minit.games). For a full walkthrough — including a Google AI Studio callout and what to do if the upload is rejected — see [docs/ai-assistants.md](./docs/ai-assistants.md).

## Persistent user data

Each player has a single string slot stored per creator — shared across all of your games. The host (app) owns serialisation and transport; the SDK reads `window.minit.userData` as a plain `string | undefined` and the string value is forwarded unchanged (no JSON parse, no normalization). Use it to persist save data, settings, high scores, or any other per-player state (encode multiple values into a single string if needed).

### Reading

```ts
import { getUserData } from '@minit-games/sdk';

const savedState = getUserData();  // string | undefined
```

- Returns `undefined` when no value is stored for this player or when running outside the host app.
- Returns `""` when the stored value is the empty string — distinct from `undefined`.

### Local userData testing

During `npm run dev`, you can seed `getUserData` via a URL param — no app host required:

```
?userData=tutorialPlayed%3Dtrue
```

`getUserData()` will return `'tutorialPlayed=true'`.

URL-param values apply only when the host has not injected `window.minit.userData` (i.e. the property is `undefined` or `null`). Any host-injected string (including `""`) wins over the URL param — URL params are a local-dev convenience only.

> `userData` is a reserved URL-param key. It is stripped from `getConfig()` and `getConfigValue()`, so `getConfigValue('userData')` always returns `undefined` (or its default). Read userData exclusively via `getUserData()`.

### Writing

Pass a string as `userData` in `reportResult`:

```ts
import { reportResult } from '@minit-games/sdk';

// Persist a plain string
reportResult(score, { userData: 'tutorialDone' });

// Encode multiple values into one string
const state = JSON.stringify({ level: 3, highScore: 1500 });
reportResult(score, { userData: state });
```

Omitting `userData` (or not passing `options`) leaves the stored value unchanged. An empty string `""` is a valid value and will overwrite any previously stored data.

### Limits

- **1 KB (1024 UTF-8 bytes)** maximum. Writes that exceed this limit are rejected and the existing value is left unchanged.

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
