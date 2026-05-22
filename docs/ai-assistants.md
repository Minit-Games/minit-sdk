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
The game is ready. Please run `npm run build` and give me a ZIP of the `dist/` folder.
```

The AI will run the build step and hand you a ZIP that contains the compiled output. That ZIP is what you upload to the [Creator Console](https://console.minit.games).

## Uploading

Go to [console.minit.games](https://console.minit.games), open your drop, and upload the ZIP. If the upload is rejected with a message about unexpected files or folder structure, double-check that the ZIP was made from `dist/` and not from the project root.

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
