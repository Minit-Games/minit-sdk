# @minit-games/sdk

Official SDK for building Minit Games HTML5 mini-games. Provides the game lifecycle API, configuration helpers, UI components (feedback text, flying rewards, header bars), and background utilities.

> **Building with an AI assistant?** Claude, ChatGPT, Gemini, Google AI Studio, Lovable, and similar tools can scaffold a complete Minit game — but they reliably miss two things: the game must be **built into a self-contained ZIP** before upload, and a handful of lifecycle calls must be wired correctly. See [Building & uploading your game](#building--uploading-your-game) and [Common mistakes AI assistants make](#common-mistakes-ai-assistants-make).

## Install

```bash
npm install @minit-games/sdk
```

## Usage

### Core entry point

```ts
import { initializeSDK, getConfigValue, reportResult, loadingDone } from '@minit-games/sdk';

// Bootstrap the SDK at startup. Accepts an optional config for
// background and meta-tag injection (see API overview below).
initializeSDK();

// Read URL-param config (passed by the app). Returns a string (or
// undefined if the key is missing and no default is supplied) —
// coerce with Number(...) / parseInt(...) for numeric mods.
const difficulty = getConfigValue('difficulty', 'normal');

// Signal that assets are loaded and the game is ready to be shown.
// Until this is called, the Minit app keeps a loading state on top
// of the WebView — call it as soon as the first interactive frame
// is ready.
loadingDone();

// At game end, report the result. The Minit app immediately overlays
// its own result screen on top of the WebView, so the game loses
// focus — do NOT render an in-game "result submitted" confirmation,
// and stop driving updates after this call.
reportResult(1500, { flavorText: '12x combo — then whiffed the finish' });
```

### Game lifecycle

The host (Minit app or web player) wraps the game in a controlled lifecycle. Three SDK calls drive it:

- **`initializeSDK(config?)`** — call once at startup to bootstrap the SDK and set up backward-compat shims. Cheap and synchronous. The optional `config` arg can apply a background (`config.background`) and inject meta tags (`config.metaTags: true`).
- **`loadingDone()`** — call once when the game is interactive (assets loaded, first frame ready). Until this fires, the app keeps a loading state on top of the WebView; the player sees the loader, not your game. Calling it more than once is a no-op.
- **`reportResult(result, options?)`** — call once when the game ends. The host immediately overlays its own result screen, takes focus away from the WebView, and prepares to tear it down. **Do not** render any "submitted" confirmation in-game, and stop scheduling animations / audio / network calls after the call.

The `flavorText` option is a short caption rendered beneath the score on the host's result screen, and is also surfaced in the activity feed where friends see this player's results.

Each flavor text should highlight **one interesting statistic or moment from the session** that is **not the score itself** — something that helps another reader picture how the run went: a best combo, a hilarious mistake, a close call, an odd habit, and the like. Track these stats during gameplay and pick the most memorable one at `reportResult` time.

| Good | Avoid |
|------|-------|
| `'12x combo — then whiffed the finish'` | `'Great run!'` (generic confirmation) |
| `'Fell off the edge 4 times'` | `'Score: 1500'` (repeats the result) |
| `'Longest streak: 8 matches'` | `'You won!'` (the host already celebrates) |
| `'Used undo 7 times'` | Restating rank, time, or points already shown |

Do not render flavor text in-game — pass it only via `reportResult`.

### UI entry point

```ts
import { showPositiveFeedback, createHeaderBar } from '@minit-games/sdk/ui';

// Feedback pop-up
showPositiveFeedback('Combo x3!');

// Header bar — positioning and alignment only (no custom styling by default)
const header = createHeaderBar({ y: 60, padding: 40 });
const turns = header.addPanel({ label: 'Turns', value: 10 });           // left (default)
const score = header.addPanel({ label: 'Score', value: 0, align: 'right' });

// When the player earns score at a world position, fly a reward to the panel — don't setValue instantly
score.flyToPanel({
    start: { x: 200, y: 400 },
    onArrive: () => score.setValue(Number(score.getValue()) + 100, { animate: true })
});
```

#### Header bar conventions

The header bar is the standard HUD across Minit drops. Treat it as **layout only**:

- **Position the bar** with `createHeaderBar({ y, padding })` — distance from the top and side inset.
- **Place panels** with `align: 'left'` (default) or `align: 'right'`. Put **Score on the right**; secondary stats (turns, moves, lives) on the left unless the creator says otherwise.
- Use **`layout: 'even'`** when panels should be spread evenly across the bar instead of grouped left/right.
- **Do not customize size or colors** — omit `style`, `defaultStyle`, `labelSize`, `valueSize`, and color fields unless the creator explicitly asks for a different look. The SDK ships fixed Lato styling.
- **Do not use emojis** in panels — use plain-text `label`s (e.g. `'Score'`, `'Turns'`), not the `icon` field. The same applies to flying rewards: omit `visual` for the default orange circle unless the creator requests something else.
- **Fly rewards into header panels when scoring or collecting resources.** Whenever the player earns score, currency, lives, or similar from a visible spot on screen, call `panel.flyToPanel({ start: { x, y }, onArrive: () => panel.setValue(...) })` on the matching header panel instead of bumping the value instantly. Use `spawnRewards(count, ...)` for large payouts to the same panel. Skip the fly animation only when there is no meaningful source position (e.g. passive time bonus) or when instant feedback is clearly better.

## Building & uploading your game

Minit games are uploaded to the [Creator Console](https://console.minit.games) as a **self-contained, pre-built ZIP**. Chat-based AI assistants (Claude, ChatGPT, Gemini, Google AI Studio, and others) can scaffold a complete game, but their output is almost always raw source — it needs a build step before it can be uploaded.

### What a Minit-ready ZIP looks like

- `index.html` at the **root** of the ZIP (the built entry point) — not inside a `dist/` subfolder
- All JS, CSS, and assets bundled alongside it — **including fonts** (see [Fonts and assets](#fonts-and-assets))
- **No** `src/` folder
- **No** `vite.config.*` or similar build config files
- **No** `package.json` at the root

If the Creator Console rejects your upload — for example because it detects a `src/` folder or a `vite.config.*` file — the project has not been built yet. Build it first, then zip the **contents** of the output folder.

### The build prompt

Once your game works in the AI's preview or chat environment, send it this message:

```
The game is ready. Please run `npm run build` and give me a ZIP whose root is the contents of the `dist/` folder — `index.html` should be at the top of the ZIP, not inside a `dist/` subfolder.
```

The AI will run the build and hand you a ZIP of the compiled output. That ZIP is what you upload at [console.minit.games](https://console.minit.games). If the upload is rejected with a message about unexpected files or folder structure, double-check the ZIP was made from `dist/` and not the project root.

### Google AI Studio (Build Mode)

Google AI Studio's **Build Mode** is a popular way to prototype Minit games. By default it exports the project's **source files** rather than a built bundle — so the default export button produces a ZIP the Creator Console will reject. Two ways around it:

- **Ask the AI to build for you** — send the build prompt above in the Build Mode chat; AI Studio runs `npm run build` and gives you a ZIP of `dist/`.
- **Build locally** — download the source export, then in the project folder run `npm install` followed by `npm run build`, and zip the **contents** of the `dist/` folder.

## Common mistakes AI assistants make

When an AI assistant integrates `@minit-games/sdk` for you, double-check these — they're the things assistants most often get wrong, and they all tie back to the [game lifecycle](#game-lifecycle):

- **No in-game "result submitted" UI.** After `reportResult(...)`, the Minit app overlays its own result screen and the game loses focus — any check-mark, toast, or "submitted" banner the AI added will never be seen. Ask it to remove them.
- **Call `loadingDone()` as soon as the first interactive frame is ready.** Until it fires, the app keeps a loading state on top of the WebView and the player is stuck on the loader. AIs sometimes wire it to a "Start" button or omit it entirely.
- **Coerce config values — they come back as strings (or `undefined`).** `getConfigValue('startScore') + 5` yields the string `'05'`, not `15`, and a missing key returns `undefined`. Wrap with `Number(...)` / `parseInt(...)` and supply a default for numeric mods.
- **`flavorText` is rendered by the host, not in-game.** It appears beneath the score on the result screen and in the activity feed — use it for a session stat or moment, never for confirmation copy, and never render it inside the game.
- **No `<link>` tags to Google Fonts.** AIs commonly add `<link rel="stylesheet" href="https://fonts.googleapis.com/...">` for styling. Those requests are blocked at runtime — the game runs sandboxed with no external network access. Bundle woff2 files and reference them with relative-path `@font-face` rules instead (see [Fonts and assets](#fonts-and-assets)). The SDK's own UI fonts — Lato and Bowlby One SC — are already inlined and need no action.

## API overview

### `@minit-games/sdk` (core)

| Export | Description |
|--------|-------------|
| `initializeSDK(config?)` | Initialize the SDK; sets up background and backward-compat shims |
| `loadingDone()` | Signal to the app that the game is ready to be shown |
| `reportResult(result, options?)` | Submit the final game result; optional `flavorText` for a session stat/moment (not the score) shown on the host result screen and activity feed |
| `getUserData()` | Read the player's persistent userData string (see [Persistent user data](#persistent-user-data)) |
| `getConfigValue(key, default?)` | Read a URL-param config value injected by the app |
| `getConfig()` | Get all URL-param config values as a plain object |
| `seededRandom()` | Deterministic random number (seeded from `?seed=` param) |
| `patchSeed(seed)` | Override the random seed at runtime |
| `addBackground(options?)` | Apply a styled background to the game container |
| `applyMetaTags()` | Inject charset + viewport meta tags |

#### Legacy aliases

For backward compatibility with games written against earlier versions, the old `Drop`-prefixed names are exported as aliases: `reportDropResult`, `getDropConfigValue`, `getDropConfig`, `initializeDropSDK`, `addDropBackground`, `applyDropMetaTags`, `getDropEnvironment`, and the types `DropBackground`/`DropResultOptions`/`DropEnvironment`.

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
| `showFeedback(text, variant?, duration?)` | Show a temporary feedback pop-up (`"positive"`, `"neutral"`, `"negative"`) |
| `showPositiveFeedback(text, duration?)` | Convenience wrapper — green variant |
| `showNeutralFeedback(text, duration?)` | Convenience wrapper — orange variant |
| `showNegativeFeedback(text, duration?)` | Convenience wrapper — red variant |
| `preloadFeedbackFont()` | Preload the feedback font to avoid flash |
| `spawnReward(options)` | Lower-level fly animation — prefer `panel.flyToPanel()` when a header panel exists |
| `spawnRewards(count, options, staggerMs?)` | Staggered fly animations for large gains to one panel |
| `createHeaderBar(config?)` | Standard HUD bar — position with `y`/`padding`, place panels with `align`; pair with `flyToPanel` for score/resources; see [Header bar conventions](#header-bar-conventions) |
| `getHeaderBar()` | Get the current header bar instance |

## Fonts and assets

### Game assets must be self-contained

Minit games run sandboxed — the game WebView has no external network access at runtime. All assets (images, audio, fonts, etc.) must ship inside the game ZIP. Any `<link>` to `fonts.googleapis.com` or any other external URL will fail silently when the game plays inside the app.

If your build does reference Google Fonts links, the Minit publish pipeline will attempt to inline the font data automatically at publish time. This is a best-effort safety net — do not rely on it. The correct approach is to bundle font files (woff2) inside your project and reference them with relative-path `@font-face` rules:

```css
@font-face {
    font-family: 'MyFont';
    src: url('./fonts/myfont.woff2') format('woff2');
    font-weight: 400;
}
```

After building, confirm that the font file appears in `dist/` alongside `index.html`.

### SDK UI fonts are built in

The SDK's own UI components (header panel, feedback text) bundle their fonts as base64-inlined woff2 — no network requests are made and they work fully offline. The bundled families are:

| Module | Font | Weight |
|--------|------|--------|
| `@minit-games/sdk/ui` — `createHeaderBar` | Lato | 400, 700 |
| `@minit-games/sdk/ui` — `showFeedback` / `preloadFeedbackFont` | Bowlby One SC | 400 |

Both families are latin subset. Their SIL OFL license texts ship in the [`licenses/`](./licenses/) directory (included in the npm package).

#### Bundle-size impact

The font data is tree-shaken per module — games pay only for what they import:

| Component | Adds to bundle |
|-----------|---------------|
| `createHeaderBar` (Lato 400 + 700) | ~37 KB base64 (~27.5 KB woff2) |
| `showFeedback` / `preloadFeedbackFont` (Bowlby One SC 400) | ~26 KB base64 (~19.4 KB woff2) |
| Neither | 0 KB |

Games that use neither `createHeaderBar` nor any feedback function pay no overhead. This per-module elimination applies when the game is built with a tree-shaking bundler (Vite, Rollup, esbuild, webpack); unbundled ESM consumers load whatever modules they import.

## License

MIT — see [LICENSE](./LICENSE).
