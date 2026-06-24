# Using AI assistants to build Minit games

Any chat-based AI assistant — Claude, ChatGPT, Gemini, and others — can scaffold a complete Minit game from a description. This guide covers the one extra step that most creators miss: turning the AI's output into an upload-ready ZIP.

## What a Minit-ready ZIP looks like

The [Creator Console](https://console.minit.games) expects a self-contained, pre-built game:

- `index.html` at the root of the ZIP (the built entry point)
- All JS, CSS, and assets bundled alongside it — **including fonts** (see below)
- **No** `src/` folder
- **No** `vite.config.*` or similar build config files
- **No** `package.json` at the root

If the Creator Console rejects your upload — for example, because it detects a `src/` folder or a `vite.config.*` file — the project has not been built yet. Follow the steps below to build it first.

### Fonts must be bundled in the ZIP

Minit games run sandboxed with no external network access at runtime. Links to `fonts.googleapis.com` or any other external URL will fail silently when the game plays inside the app. All fonts must ship inside the ZIP.

The recommended approach is to bundle font files (woff2) in your project and reference them with relative-path `@font-face` rules rather than `<link>` tags to Google Fonts. If your build does include a Google Fonts link, the Minit publish pipeline will attempt to inline the font data automatically — but this is a best-effort safety net, not a guarantee.

The SDK's own UI components (header bar, feedback text) already bundle their fonts (Lato and Bowlby One SC) as inline data — no action needed on your part for those.

## The build prompt

Once your game is working in the AI's preview or chat environment, send it this message:

```
The game is ready. Please run `npm run build` and give me a ZIP whose root is the contents of the `dist/` folder — `index.html` should be at the top of the ZIP, not inside a `dist/` subfolder.
```

The AI will run the build step and hand you a ZIP that contains the compiled output. That ZIP is what you upload to the [Creator Console](https://console.minit.games).

## Uploading

Go to [console.minit.games](https://console.minit.games), open your drop, and upload the ZIP. If the upload is rejected with a message about unexpected files or folder structure, double-check that the ZIP was made from `dist/` and not from the project root.

## Common AI integration mistakes

When an AI assistant integrates `@minit-games/sdk` for you, double-check these points — they're the things AI assistants most often get wrong, and they all relate to the game lifecycle described in the [SDK README](../README.md#game-lifecycle):

- **No in-game "result submitted" UI.** When the game calls `reportResult(...)`, the Minit app immediately overlays its own result screen on top of the WebView and the game loses focus. Any check-mark badge, toast, or "submitted via SDK" banner the AI added will never be seen — ask the AI to remove it.
- **Call `loadingDone()` as soon as the first interactive frame is ready.** Until it fires, the app keeps a loading state on top of the WebView. AIs sometimes wire it to a "Start" button or omit it entirely, leaving the player stuck on a loader.
- **Coerce config values — they're returned as strings (or `undefined` for missing keys).** `getConfigValue('startScore') + 5` yields the string `'05'` instead of `15`, and a missing key returns `undefined`. Wrap with `Number(...)` / `parseInt(...)` (and supply a default) for numeric mods.
- **`flavorText` is rendered by the host, not in-game.** It appears beneath the score on the app's result screen and in the activity feed — pass it only in `reportResult(...)`. Each flavor text should call out **one memorable stat or moment from the session that is not the score** (best combo, funny fail, close call, quirk) so friends reading the feed understand how the run felt. Do not use generic confirmation copy (`'Great run!'`) or repeat the score/rank.
- **Remove `<link>` tags to Google Fonts.** AIs commonly add `<link rel="stylesheet" href="https://fonts.googleapis.com/...">` for styling. Those requests are blocked at runtime — the game runs sandboxed with no external network access. Replace them with woff2 font files bundled in the project and referenced via `@font-face` rules. (The SDK's own UI fonts — Lato and Bowlby One SC — are already inlined and need no action from you.)
- **Use the SDK header bar for stats — positioning only.** Call `createHeaderBar({ y, padding })` and add panels with `align: 'left'` or `'right'`. Put **Score on the right**; other stats on the left. Do not pass `style`, colors, or font-size overrides unless the creator explicitly asks. Do not use emojis in panel labels or flying-reward visuals — use plain-text labels and the default orange reward circle.
- **Fly score and resources into header panels.** When the player earns points, currency, lives, or similar from something on screen, use `panel.flyToPanel({ start, onArrive })` and update the panel in `onArrive` — not an instant `setValue`. Prefer `flyToPanel` over raw `spawnReward` whenever a header panel is the destination. Use `spawnRewards` for big batch gains. Only skip the fly when there is no source position or instant update is clearly appropriate.

## Google AI Studio (Build Mode)

Google AI Studio's **Build Mode** is a popular way to prototype Minit games. By default, Build Mode exports the project's source files rather than a built bundle — so the ZIP you get from the default export button will be rejected by the Creator Console.

You have two options:

### Option A — Ask the AI to build for you

In the Build Mode chat, send the build prompt above. AI Studio will run `npm run build` inside the project and give you a ZIP of `dist/`.

### Option B — Build locally yourself

1. Download the source export from AI Studio.
2. Unzip it and open a terminal in the project folder.
3. Run:
   ```bash
   npm install
   npm run build
   ```
4. Zip the contents of the `dist/` folder.
5. Upload that ZIP to the [Creator Console](https://console.minit.games).
