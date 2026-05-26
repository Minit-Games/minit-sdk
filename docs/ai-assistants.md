# Using AI assistants to build Minit games

Any chat-based AI assistant — Claude, ChatGPT, Gemini, and others — can scaffold a complete Minit game from a description. This guide covers the one extra step that most creators miss: turning the AI's output into an upload-ready ZIP.

## What a Minit-ready ZIP looks like

The [Creator Console](https://console.minit.games) expects a self-contained, pre-built game:

- `index.html` at the root of the ZIP (the built entry point)
- All JS, CSS, and assets bundled alongside it
- **No** `src/` folder
- **No** `vite.config.*` or similar build config files
- **No** `package.json` at the root

If the Creator Console rejects your upload — for example, because it detects a `src/` folder or a `vite.config.*` file — the project has not been built yet. Follow the steps below to build it first.

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
- **`flavorText` is rendered by the host, not in-game.** It appears beneath the score on the app's result screen and in the activity feed. Use it for context (`'Beat the expert!'`) — not for confirmation copy.

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
