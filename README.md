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

// Read a config value the host passed in as a URL param — the knobs
// you declared in meta.json's `config` (see Game metadata below), which
// is what lets other creators post mods of your game. Returns a string
// (or undefined if the key is missing and no default is supplied) —
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

- `**initializeSDK(config?)**` — call once at startup to bootstrap the SDK and set up backward-compat shims. Cheap and synchronous. The optional `config` arg can apply a background (`config.background`) and inject meta tags (`config.metaTags: true`).
- `**loadingDone()**` — call once when the game is interactive (assets loaded, first frame ready). Until this fires, the app keeps a loading state on top of the WebView; the player sees the loader, not your game. Calling it more than once is a no-op.
- `**reportResult(result, options?)**` — call once when the game ends. The host immediately overlays its own result screen, takes focus away from the WebView, and prepares to tear it down. **Do not** render any "submitted" confirmation in-game, and stop scheduling animations / audio / network calls after the call.

**No start menu, no replay menu.** A Minit drop is one session: load → play → result. Do **not** add a title screen, "Play" / "Start" button, or tap-to-begin gate — after assets are ready, call `loadingDone()` and drop the player straight into the first interactive frame. When the run ends, call `reportResult(...)` immediately; do **not** show an in-game "Play again" / replay / game-over menu. The host owns what happens next.

The `flavorText` option is a short caption rendered beneath the score on the host's result screen, and is also surfaced in the activity feed where friends see this player's results.

Each flavor text should highlight **one interesting statistic or moment from the session** that is **not the score itself** — something that helps another reader picture how the run went: a best combo, a hilarious mistake, a close call, an odd habit, and the like. Track these stats during gameplay and pick the most memorable one at `reportResult` time.


| Good                                    | Avoid                                         |
| --------------------------------------- | --------------------------------------------- |
| `'12x combo — then whiffed the finish'` | `'Great run!'` (generic confirmation)         |
| `'Fell off the edge 4 times'`           | `'Score: 1500'` (repeats the result)          |
| `'Longest streak: 8 matches'`           | `'You won!'` (the host already celebrates)    |
| `'Used undo 7 times'`                   | Restating rank, time, or points already shown |


Do not render flavor text in-game — pass it only via `reportResult`.

### UI entry point

```ts
import { showPositiveFeedback, createHeaderBar, spawnRewards } from '@minit-games/sdk/ui';

// Feedback pop-up — fire on every moment with clear emotional weight
showPositiveFeedback('Combo x3!');  // scoring, combos, bonuses, level ups
showNegativeFeedback('Life Lost');  // mistakes, penalties, lives lost, time up
showNeutralFeedback('x2 Speed');    // modifiers, streak resets, neutral milestones

// Header bar — positioning and alignment only (no custom styling by default)
const header = createHeaderBar({ y: 60, padding: 40 });
const turns = header.addPanel({ label: 'Turns', value: 10 });           // left (default)
const score = header.addPanel({ label: 'Score', value: 0, align: 'right' });

// When the player earns points at a world position, fly rewards to the panel —
// one icon per point, not one icon per scoring event.
// +1: a single flyToPanel call. +N (N > 1): spawnRewards clusters large payouts.
score.flyToPanel({
    start: { x: 200, y: 400 },
    onArrive: () => score.setValue(Number(score.getValue()) + 1, { animate: true })
});

spawnRewards(12, {
    start: { x: 200, y: 400 },
    target: score.getPosition(),
    onAllArrive: () => score.setValue(Number(score.getValue()) + 12, { animate: true })
});
```

#### Feedback conventions

Feedback pops should fire on **every moment with clear emotional weight** — by default, unless the creator asks otherwise. The flash is non-blocking (floats over gameplay, auto-dismisses in ~1 s), so it never interrupts input.


| Moment                                             | Variant              | Example text                                 |
| -------------------------------------------------- | -------------------- | -------------------------------------------- |
| Score / combo / collect bonus / clear level / win  | **positive** (green) | `"Combo x3!"`, `"+50"`, `"Level Up!"`        |
| Modifier active / streak reset / non-fatal warning | **neutral** (orange) | `"x2 Speed"`, `"Streak Lost"`, `"10s Left!"` |
| Life lost / mistake / penalty / time-up / fail     | **negative** (red)   | `"Life Lost"`, `"Wrong!"`, `"Time Up!"`      |


**Rules:**

- Fire feedback at the moment the event happens — not delayed, not bundled.
- Never silently subtract health, lives, or score. Always pair the change with a negative flash.
- Do **not** fire on every micro-action (each tile flip, each frame of movement) — only on moments the player will feel.
- Keep text short and punchy: one to three words. No punctuation needed except `!` for emphasis.

#### Input conventions

Minit games run on **mobile phones**. Touch is the only input that matters.

- **All interaction must work with `pointerdown` / `pointerup` / `pointermove`** (or the equivalent touch events). Pointer events fire for both touch and mouse, so they work in desktop browsers during development too.
- **Never rely on mouse-only events:** `mouseover`, `mouseenter`, `mouseleave`, `contextmenu`, scroll wheel (`wheel`). These do not fire on touch screens.
- **No hover states.** CSS `:hover` styles are ignored on touch — do not use them for anything functional (revealing buttons, showing tooltips, triggering state changes). Visual-only polish that degrades gracefully is acceptable, but gameplay must never depend on hover.
- **No keyboard controls.** Arrow keys, spacebar, and keyboard shortcuts do not exist on mobile. Do not wire game actions to `keydown` / `keyup` unless the creator explicitly asks for desktop support.
- **Tap targets must be large enough to hit with a finger** — aim for at least 44×44 CSS px. Tiny interactive areas that are easy to click with a cursor become unreachable on touch.
- **Drag / swipe must use pointer capture.** Call `element.setPointerCapture(e.pointerId)` on `pointerdown` so the gesture keeps tracking even when the finger slides off the element.

The header bar is the standard HUD across Minit drops. Treat it as **layout only**:

- **Position the bar** with `createHeaderBar({ y, padding })` — distance from the top and side inset.
- **Place panels** with `align: 'left'` (default) or `align: 'right'`. Put **Score on the right**; secondary stats (turns, moves, lives) on the left unless the creator says otherwise.
- Use `**layout: 'even'`** when panels should be spread evenly across the bar instead of grouped left/right.
- **Do not customize size or colors** — omit `style`, `defaultStyle`, `labelSize`, `valueSize`, and color fields unless the creator explicitly asks for a different look. The SDK ships fixed Lato styling.
- **Do not use emojis** in panels — use plain-text `label`s (e.g. `'Score'`, `'Turns'`), not the `icon` field. The same applies to flying rewards: omit `visual` for the default orange circle unless the creator requests something else.
- **Fly one reward per point earned.** When an in-world event awards points, currency, lives, or similar, spawn **one flying icon per unit** — not a single icon per event regardless of payout size. For a **+1** gain, call `flyToPanel` once. For **+N** with N > 1, call `spawnRewards(N, { start, target: panel.getPosition(), onAllArrive: ... })` and bump the panel value in `onAllArrive`. When N is large, `spawnRewards` clusters into fewer, larger icons (e.g. bundles representing 5, 25, 125 points) so the HUD still reads clearly without hundreds of circles. Skip the fly animation only when there is no meaningful source position (e.g. passive time bonus) or when instant feedback is clearly better.

## Building & uploading your game

Minit games are uploaded to the [Creator Console](https://console.minit.games) as a **self-contained, pre-built ZIP**. Chat-based AI assistants (Claude, ChatGPT, Gemini, Google AI Studio, and others) can scaffold a complete game, but their output is almost always raw source — it needs a build step before it can be uploaded.

### What a Minit-ready ZIP looks like

- `index.html` at the **root** of the ZIP (the built entry point) — not inside a `dist/` subfolder
- All JS, CSS, and assets bundled alongside it — **including fonts** (see [Fonts and assets](#fonts-and-assets))
- **No** `src/` folder
- **No** `vite.config.`* or similar build config files
- **No** `package.json` at the root

If the Creator Console rejects your upload — for example because it detects a `src/` folder or a `vite.config.`* file — the project has not been built yet. Build it first, then zip the **contents** of the output folder.

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

## Game metadata (`meta.json`)

Every Minit game should ship with a `meta.json` file **at the root of the uploaded ZIP** (next to `index.html`). The Creator Console parses it on upload to pre-fill the new-Minit draft form — title, controls, logic, and description are all read from this file. AI assistants should create and maintain `meta.json` when a new game is started and keep it updated whenever the game concept changes.

### Format

```json
{
  "title": "Fruit Drop 🍉🗡️",
  "controls": "- **Swipe** to slice fruit\n- **Avoid** bombs — they end the run",
  "logic": "- Slice fruit flying up from the bottom\n- **Combo** multiple fruit for bonus points",
  "description": "## What's This? 🎮\n\nA juicy swipe-and-slice arcade game..."
}
```

### Fields

All fields below — including `config` (see next section) — are optional. Missing or empty fields are simply skipped during pre-fill. If `title` is absent, the console falls back to the ZIP filename.

| Field | Description |
| --- | --- |
| `title` | The game's display title. Format: `<Game name> <two thematically matching emojis>` — e.g. `"Fruit Drop 🍉🗡️"`. |
| `controls` | How the player controls the game. Markdown. 2–4 bullets covering inputs and their effects. |
| `logic` | The game's core rules and loop. Markdown. 2–4 bullets covering the core mechanic, scoring, and end condition. |
| `description` | Free-form Markdown body describing the game — what it feels like, scoring breakdown, tips, creator corner. |
| `resultSorting` | How results are ranked — `"highestScore"` (default), `"lowestScore"`, `"fastestTime"`, or `"slowestTime"`. See below. |
| `schemaVersion` | String or number. A forward-compatibility hook for future `meta.json` shape changes — nothing validates or branches on it today, so most builds simply omit it. |
| `config` | Array of tunable values the game exposes. See [`config`](#config). |
| `license` | SPDX identifier for the bundle's content, or `"proprietary"`. See [Licensing](#licensing). |
| `credits` | Freeform player-facing credit line for third-party assets. See [Licensing](#licensing). |
| `sourceUrl` | URL of the original asset/library source. Must start with `http://` or `https://`. |

Unrecognised top-level keys are ignored, so extras like `$schema` are safe to leave in the file.

### `resultSorting`

Which result wins, and therefore how the leaderboard is ordered. It presets the Scoring choice on the new-Minit form:

| Value | Meaning |
| --- | --- |
| `"highestScore"` | Highest score wins — the default when `resultSorting` is absent or invalid. |
| `"lowestScore"` | Lowest score wins (golf-style). |
| `"fastestTime"` | Fastest run wins — the reported number is treated as a time, not points. |
| `"slowestTime"` | Slowest run wins — likewise a time. |

This only sets the **initial** choice; the creator can still change it on the form before publishing. It does not change what your game passes to `reportResult(...)` — you always report a single number, and this is how the platform ranks and labels it. An unrecognised value is dropped silently and falls back to `"highestScore"`, leaving the rest of `meta.json` intact.

### `config`

An optional array of config value definitions the game exposes to creators. Missing is simply skipped; if present but malformed, `config` is skipped and the rest of `meta.json` still prefills. On upload, it prefills the **Project's** config definitions (not per-post values).

#### What config values are, and what they're for

A config value is a named, typed knob your game reads at runtime via [`getConfigValue()`](#core-entry-point) — a starting score, a difficulty preset, a theme color, an enemy speed. You declare the full set once here; the value each player actually gets is decided per post.

Why expose them:

- **Superposting / mods** — other creators post their own variation of your game (same build, different values) without touching your code. A game with no declared `config` has nothing to vary, so the console renders the "Allow Superposting" toggle disabled.
- **Your own variants** — post the same build several times with different values (easy / hard, seasonal palette) instead of rebuilding and re-uploading.

How a value gets from `meta.json` into the running game:

1. You declare it in `meta.json` and upload the ZIP → the console stores it as a **Project** config definition.
2. Each post of that project stores only the values it overrides; unset keys keep the declared default.
3. At play time the host appends **every** resolved key to the game URL as a query param — on the app and on the web player alike.
4. Your game reads it with `getConfigValue('key', 'fallback')`.

Practical notes:

- **Values always arrive as strings.** `"10"`, `"true"`, `"#f15a24"` — coerce with `Number(...)` / `=== 'true'` before use. See [Common mistakes](#common-mistakes-ai-assistants-make).
- **Still pass a default.** Every declared key is injected at play time, but a default keeps local dev and direct-URL testing working.
- **Test locally by appending the param yourself** — `index.html?difficulty=hard&startScore=50`.
- **Pick knobs that change how the game feels**, and keep it to a handful. Bound them (`min`/`max`, `minLength`/`maxLength`, or `range`) so a mod can't produce an unplayable game, and set `"moddable": false` on anything other creators shouldn't touch.
- `userData` is a reserved key and is never readable through `getConfigValue()` — see [Persistent user data](#persistent-user-data).
- **The full walkthrough is in the Creator Docs** — [The meta.json file](https://minit.studio/docs/declaring-config-values).

```ts
// meta.json declares: { "key": "startScore", "valueType": "number", "value": "10", "min": 0, "max": 100 }
const startScore = Number(getConfigValue('startScore', '10'));
const hardMode = getConfigValue('hardMode', 'false') === 'true';
```

#### Entry format

Max **25** entries. Each entry:

| Key | Required? | Description |
| --- | --- | --- |
| `key` | Yes | Non-empty string, compared after trimming surrounding whitespace. Must be unique across entries. |
| `valueType` | Yes | One of `string`, `number`, `boolean`, `color`. |
| `value` | At least one of `value` / `defaultValue` | The default value. Either the native JSON type or its string form works — `10` and `"10"`, `false` and `"false"` all normalize the same way. A boolean's string form must be exactly `"true"` or `"false"` (`"TRUE"` / `"1"` do not normalize), and a number's must parse to a finite number. A `string` value must actually be a string, and a `color` must be a hex string (`#RRGGBB` or `#RRGGBBAA`, case-insensitive). Sticking to strings everywhere is the safe habit, since that is what the game reads back at runtime. |
| `defaultValue` | — | Alias for `value`. If both are present, `value` wins. |
| `description` | No | Max 100 characters. An over-long description is dropped silently — the entry (and the rest of `config`) is still accepted. |
| `range` | No | Discrete allow-list of values, each matching `valueType`, displayed as a dropdown. `value` must be one of them. Mutually exclusive with the bound pairs below. |
| `min` / `max` | No | Inclusive value bounds for `number` entries — integers or floats, written as JSON numbers (not strings, unlike `value`). `min` must be ≤ `max`. |
| `minLength` / `maxLength` | No | Inclusive length bounds for `string` entries, written as non-negative JSON integers. `minLength` must be ≤ `maxLength`. |
| `moddable` | No | `true` = other creators may change this value in their mods, `false` = locked to your declared value, omitted = unmarked (treated as open, for back-compat). Locks only apply to other creators — you always have full access to your own game's values. |

Use `range` for a discrete set of allowed choices (a dropdown), or bounds for a continuous span. `min` and `max` apply only to `valueType: "number"`; `minLength` and `maxLength` apply only to `valueType: "string"`. `boolean` and `color` configs accept neither kind of bound.

Anything the rules above reject — a duplicate key, a `range` alongside a bound, a `min` on a `string`, a `value` outside its own `range`, a 26th entry — invalidates the **whole** `config` block, not just the offending entry. Like any other malformed `config`, it is skipped at upload while the rest of `meta.json` still prefills.

Bounds are enforced before a config value reaches the game. They do not change the runtime contract: `getConfigValue` still returns the already-resolved value as a string (or `undefined`).

```json
{
  "config": [
    { "key": "startScore", "valueType": "number", "value": "10", "min": 0, "max": 100, "moddable": true },
    { "key": "gravity", "valueType": "number", "value": "9.81", "min": 0.5, "max": 20.5 },
    { "key": "playerName", "valueType": "string", "value": "Tester", "minLength": 2, "maxLength": 20 },
    { "key": "hardMode", "valueType": "boolean", "value": "false", "moddable": false },
    { "key": "themeColor", "valueType": "color", "value": "#f15a24" },
    { "key": "difficulty", "valueType": "string", "value": "normal", "range": ["easy", "normal", "hard"] }
  ]
}
```

### Licensing

`license` declares the license of the **game/bundle as a whole** — it is never a declaration about an individual embedded asset. Bundling a font under the SIL Open Font License, for example, does not make the bundle's `license` value `OFL`; that's a per-asset detail for `THIRD-PARTY-NOTICES.txt` (below), not this field. If your game bundle includes third-party assets or libraries — sprites, music, SFX, fonts, code — declare where they came from. Three optional top-level fields cover it:

| Field | Description |
| --- | --- |
| `license` | An [SPDX identifier](https://spdx.org/licenses/) for the bundle's overall license, or `"proprietary"` if it's all your own. |
| `credits` | A freeform credit line shown to players (app burger menu, web project detail). |
| `sourceUrl` | Where the original asset or library came from. Must start with `http://` or `https://`. |

**Leaving `license` out is not a null/unknown state.** Per the Minit Terms of Service, an absent `license` resolves authoritatively to `"proprietary"` — the creator's own content, all rights reserved, with a non-exclusive, royalty-free, worldwide license granted to Minit to host and serve it. Absent and explicit `"proprietary"` now mean the same thing; declare an SPDX identifier only when it's the license you're actually granting for the bundle **as a whole** — not because the bundle happens to include third-party content under one (that detail belongs in `THIRD-PARTY-NOTICES.txt`, per above).

#### What each license allows

| License | Hosting | Modding | Notice |
| --- | :-: | :-: | --- |
| `CC0-1.0`, `Unlicense` | Yes | Yes | Not required |
| `MIT`, `BSD-2-Clause`, `BSD-3-Clause`, `Zlib`, `ISC` | Yes | Yes | Required |
| `Apache-2.0` | Yes | Yes | Required, plus reproduce any NOTICE file and mark modified files |
| `CC-BY-4.0` | Yes | Yes | Required, changes must be indicated |
| `CC-BY-SA-4.0` | Yes | Flagged | Required; derivatives inherit ShareAlike |
| `CC-BY-ND-4.0` | Yes | No | Required; modding forced off |
| `CC-BY-NC-4.0`, `CC-BY-NC-SA-4.0`, `CC-BY-NC-ND-4.0` | **No** | No | Rejected — the platform runs ads and a creator fund |
| `GPL-2.0`, `GPL-2.0-only`, `GPL-2.0-or-later`, `GPL-3.0`, `GPL-3.0-only`, `GPL-3.0-or-later` | **No** | No | Rejected — app-store distribution conflicts |
| `AGPL-3.0`, `AGPL-3.0-only`, `AGPL-3.0-or-later` | **No** | No | Rejected — network use triggers source disclosure |
| `"proprietary"` (also the default when `license` is absent) | Yes | Yes | Your own content |

A license in the **No** hosting rows fails the upload. SPDX deprecated the bare `GPL-2.0`/`GPL-3.0`/`AGPL-3.0` ids in favor of an explicit `-only`/`-or-later` suffix; the deprecated bare spelling and the current suffixed spelling are recognized and rejected identically here, so hosting outcome doesn't depend on which one you declare. That doesn't make `-only` and `-or-later` interchangeable, though — they grant different license scopes. Pick the suffix matching your actual license grant for new metadata; the bare deprecated ids are only for legacy metadata that already used them.

**The identifier is matched exactly, against this table only.** Anything else is accepted and ungated too — that covers a typo, but also a legitimate SPDX identifier the table doesn't carry, such as `MPL-2.0`. Unlike the deliberate `proprietary` default above, this is a data-quality miss, not a chosen resolution. Use the exact spelling from the table.

#### `THIRD-PARTY-NOTICES.txt`

A license marked *Required* in the Notice column needs a `THIRD-PARTY-NOTICES.txt` file at the **ZIP root**, next to `index.html` and `meta.json`. Uploading without one is not blocked — the [Creator Console](https://console.minit.games) warns and lets you proceed, so add the file before publishing.

`credits` does not substitute for it, and it does not substitute for `credits` — they satisfy different obligations. The file is the durable legal record that travels with the bundle; `credits` is the player-facing acknowledgment, which can be summarized or never opened.

One entry per third-party asset or library:

```text
THIRD-PARTY NOTICES
This bundle includes third-party material listed below. Each item is
governed by its own license, reproduced or referenced here as required.

--------------------------------------------------------------------------
Component:  PixelOrb Audio & Sprite Pack v2
Source:     https://example.com/assets/pixelorb
Author:     Orb Interactive Ltd.
License:    MIT

<full license text, or a pointer to where it is reproduced>
--------------------------------------------------------------------------
```

```json
{
  "license": "CC-BY-4.0",
  "credits": "Music: \"Neon Drift\" by Orb Interactive (CC-BY-4.0)",
  "sourceUrl": "https://example.com/assets/pixelorb"
}
```

### JSON Schema

A machine-readable JSON Schema (draft 2020-12) for the whole file ships in this repo at [`schemas/meta.schema.json`](./schemas/meta.schema.json). Point your editor at it to get completion and inline validation while authoring `meta.json`:

```json
{
  "$schema": "https://raw.githubusercontent.com/Minit-Games/minit-sdk/master/schemas/meta.schema.json",
  "title": "Fruit Drop 🍉🗡️"
}
```

The `$schema` key is ignored by the Creator Console's parser, so it is safe to leave in the uploaded file.

The schema encodes every rule described above — the per-type `value` shapes, the type restrictions on each bound pair, and the mutually-exclusive `range`/bounds rule — plus the top-level fields. Three rules it cannot express, which the console still enforces: `key` uniqueness, `value` having to be a member of `range`, and `min ≤ max` / `minLength ≤ maxLength`.

### ZIP placement

`meta.json` must sit at the **top level of the ZIP**, not nested inside any folder within the archive — it must be next to `index.html`. The console reads it directly from the ZIP's top level when processing the upload.

### Example

```json
{
  "title": "Fruit Drop 🍉🗡️",
  "controls": "- **Swipe** across the screen to slice fruit\n- **Avoid** the bombs — they end the run",
  "logic": "- Slice fruit as they fly up from the bottom\n- **Combo** multiple fruit in one swipe for bonus points\n- A single **bomb** hit ends the round — keep your swipes clean",
  "description": "## What's This? 🎮\n\nA juicy swipe-and-slice arcade game — chop fruit out of the air, dodge bombs, and rack up combos! 🍉🗡️\n\n## Scoring ⭐\n\n- **+1** per fruit sliced 🍓\n- **Combo multiplier** for multi-fruit swipes 🔥\n- Bombs end the run instantly 💣\n\n## Tips 💡\n\n- Long, sweeping swipes catch more fruit in one go ✂️\n- Watch the corners — bombs love to sneak in 👀\n- Coconuts are heavy — they need a stronger swipe 🥥\n\n## Creator Corner 🎨\n\n- Enjoy the game? Leave a cheer so we make more like this! 🎉\n- Game Version: 1"
}
```

---

## Common mistakes AI assistants make

When an AI assistant integrates `@minit-games/sdk` for you, double-check these — they're the things assistants most often get wrong, and they all tie back to the [game lifecycle](#game-lifecycle):

- **Create and maintain `meta.json` at the ZIP root.** When starting a new game, create a `meta.json` with `title`, `controls`, `logic`, and `description` fields following the [Game metadata](#game-metadata-metajson) format. Place it at the root of the uploaded ZIP alongside `index.html` — the Creator Console reads it from the ZIP root to pre-fill the draft. Update it whenever the game concept changes (new mechanic, scoring change, controls update).
- **Touch-only input — no mouse-specific events.** Games run on mobile phones; touch is the only input that matters. Use `pointerdown` / `pointerup` / `pointermove` for all interaction. Remove any `mouseover`, `mouseenter`, `wheel` (scroll), or `:hover`-dependent logic the AI added — these do not fire on touch screens. Tap targets must be at least 44×44 px. Drag / swipe gestures must call `element.setPointerCapture(e.pointerId)` on `pointerdown`. Do not add keyboard controls unless the creator asks for desktop support.
- **No in-game "result submitted" UI.** After `reportResult(...)`, the Minit app overlays its own result screen and the game loses focus — any check-mark, toast, or "submitted" banner the AI added will never be seen. Ask it to remove them.
- **No start menu or replay menu.** The game should begin straight into gameplay (no title screen, "Play" button, or tap-to-begin), and end with `reportResult(...)` — not an in-game "Play again" or game-over menu. The host handles restart and the result screen.
- **Fire feedback on every emotionally significant moment.** Score gain, combo, life lost, penalty, time-up, level clear — each needs a matching `showPositiveFeedback` / `showNegativeFeedback` / `showNeutralFeedback` call. The flash is non-blocking and auto-dismisses; omitting it makes the game feel unresponsive. Never silently subtract health or lives.
- **Call `loadingDone()` as soon as the first interactive frame is ready.** Until it fires, the app keeps a loading state on top of the WebView and the player is stuck on the loader. Do not wire it to a "Start" button — call it when gameplay is ready to begin.
- **Coerce config values — they come back as strings (or `undefined`).** `getConfigValue('startScore') + 5` yields the string `'05'`, not `15`, and a missing key returns `undefined`. Wrap with `Number(...)` / `parseInt(...)` and supply a default for numeric mods.
- `**flavorText` is rendered by the host, not in-game.** It appears beneath the score on the result screen and in the activity feed — use it for a session stat or moment, never for confirmation copy, and never render it inside the game.
- **One flying reward per point, not per event.** When a scoring action awards multiple points, spawn one icon per point via `spawnRewards(pointsEarned, ...)` — do not fly a single icon and jump the score by 10. Cluster large payouts into denominations like 5 / 25 / 125 automatically through `spawnRewards`.
- **No `<link>` tags to Google Fonts.** AIs commonly add `<link rel="stylesheet" href="https://fonts.googleapis.com/...">` for styling. Those requests are blocked at runtime — the game runs sandboxed with no external network access. Bundle woff2 files and reference them with relative-path `@font-face` rules instead (see [Fonts and assets](#fonts-and-assets)). The SDK's own UI fonts — Lato and Bowlby One SC — are already inlined and need no action.

## API overview

### `@minit-games/sdk` (core)


| Export                           | Description                                                                                                                                     |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `initializeSDK(config?)`         | Initialize the SDK; sets up background and backward-compat shims                                                                                |
| `loadingDone()`                  | Signal to the app that the game is ready to be shown                                                                                            |
| `reportResult(result, options?)` | Submit the final game result; optional `flavorText` for a session stat/moment (not the score) shown on the host result screen and activity feed |
| `getUserData()`                  | Read the player's persistent userData string (see [Persistent user data](#persistent-user-data))                                                |
| `getConfigValue(key, default?)`  | Read one config value the host injected as a URL param — always a string (see [`config`](#config))                                              |
| `registerAudioContext(context)`   | Opt in an `AudioContext` to auto-suspend when the browser tab hides and auto-resume when it shows (only if this listener suspended it)       |
| `registerAudioElement(element)`  | Opt in an `<audio>`/`<video>` element to auto-pause when the browser tab hides and auto-resume when it shows (only if this listener paused it) |
| `getConfig()`                    | Get all URL-param config values as a plain object                                                                                               |
| `seededRandom()`                 | Deterministic random number (seeded from `?seed=` param)                                                                                        |
| `patchSeed(seed)`                | Override the random seed at runtime                                                                                                             |
| `addBackground(options?)`        | Apply a styled background to the game container                                                                                                 |
| `applyMetaTags()`                | Inject charset + viewport meta tags                                                                                                             |


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


| Export                                     | Description                                                                                                                                                                  |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `showFeedback(text, variant?, duration?)`  | Show a temporary feedback pop-up (`"positive"`, `"neutral"`, `"negative"`)                                                                                                   |
| `showPositiveFeedback(text, duration?)`    | Convenience wrapper — green variant                                                                                                                                          |
| `showNeutralFeedback(text, duration?)`     | Convenience wrapper — orange variant                                                                                                                                         |
| `showNegativeFeedback(text, duration?)`    | Convenience wrapper — red variant                                                                                                                                            |
| `preloadFeedbackFont()`                    | Preload the feedback font to avoid flash                                                                                                                                     |
| `spawnReward(options)`                     | Lower-level single-icon fly animation — prefer `panel.flyToPanel()` for +1 gains                                                                                             |
| `spawnRewards(count, options, staggerMs?)` | Multi-point payout: spawns one icon per point, clustering into larger denominations (5 / 25 / 125 …) when `count` > 5                                                        |
| `createHeaderBar(config?)`                 | Standard HUD bar — position with `y`/`padding`, place panels with `align`; pair with `flyToPanel` for score/resources; see [Header bar conventions](#header-bar-conventions) |
| `getHeaderBar()`                           | Get the current header bar instance                                                                                                                                          |


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


| Module                                                         | Font          | Weight   |
| -------------------------------------------------------------- | ------------- | -------- |
| `@minit-games/sdk/ui` — `createHeaderBar`                      | Lato          | 400, 700 |
| `@minit-games/sdk/ui` — `showFeedback` / `preloadFeedbackFont` | Bowlby One SC | 400      |


Both families are latin subset. Their SIL OFL license texts ship in the `[licenses/](./licenses/)` directory (included in the npm package).

#### Bundle-size impact

The font data is tree-shaken per module — games pay only for what they import:


| Component                                                  | Adds to bundle                   |
| ---------------------------------------------------------- | -------------------------------- |
| `createHeaderBar` (Lato 400 + 700)                         | ~~37 KB base64 (~~27.5 KB woff2) |
| `showFeedback` / `preloadFeedbackFont` (Bowlby One SC 400) | ~~26 KB base64 (~~19.4 KB woff2) |
| Neither                                                    | 0 KB                             |


Games that use neither `createHeaderBar` nor any feedback function pay no overhead. This per-module elimination applies when the game is built with a tree-shaking bundler (Vite, Rollup, esbuild, webpack); unbundled ESM consumers load whatever modules they import.

## License

MIT — see [LICENSE](./LICENSE).
