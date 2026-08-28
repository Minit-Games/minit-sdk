import { getBowlbyOneSCFontFaceCSS } from './fonts/bowlbyOneSC.js';

const FEEDBACK_CONTAINER_CLASS = "drop-feedback-text";

/** Must match the family name in the injected @font-face and CSS below. */
const FEEDBACK_FONT_FAMILY = "Bowlby One SC";

export type FeedbackVariant = "positive" | "neutral" | "negative";

/**
 * Wrap budget for a label that does not fit on one line: the font shrinks
 * until the text needs at most this many lines. Two keeps a pop reading as a
 * pop rather than a paragraph.
 */
const MAX_LINES = 2;

/**
 * Floor on that shrink. A label long enough to hit it is being used as prose
 * (the API asks for short, punchy text) — it wraps past MAX_LINES rather than
 * shrinking to something unreadable.
 */
const MIN_FONT_SCALE = 0.5;

/** Step the shrink walks down in when the opening estimate still overflows. */
const FONT_SCALE_STEP = 0.05;

/** Must match the `line-height` in the injected CSS. */
const LINE_HEIGHT = 1.1;

let stylesInjected = false;
let fontPreloaded = false;

/**
 * Preload the feedback font to avoid fallback font flash on first use.
 * Call this early in your game initialization (e.g., alongside initializeDropSDK).
 * This is optional - the font will still load on first showFeedback() call if not preloaded.
 *
 * The font is bundled as a base64-encoded woff2 data URI — no network request is made.
 *
 * @returns Promise that resolves when the font is loaded
 */
export async function preloadFeedbackFont(): Promise<void> {
    if (fontPreloaded) return;
    fontPreloaded = true;

    // Inject the @font-face CSS (bundled — no network request)
    injectStyles();

    // Wait for the font to actually load using the CSS Font Loading API
    try {
        await document.fonts.load("1em 'Bowlby One SC'");
    } catch (e) {
        // Font loading API not supported or failed, font is still injected via @font-face
        console.warn('[MinitSDK] Font preload check failed, font is still bundled');
    }
}

function injectStyles(): void {
    if (stylesInjected) return;
    stylesInjected = true;
    // Mark the font as preloaded: the @font-face rule embeds the font data as a
    // data URI, so the moment the CSS is injected the font bytes are already
    // in-page. Any subsequent call to preloadFeedbackFont() therefore has nothing
    // to wait for and returns early via the `if (fontPreloaded) return;` guard.
    fontPreloaded = true;

    const style = document.createElement('style');
    style.id = 'drop-feedback-text-styles';
    style.textContent = getBowlbyOneSCFontFaceCSS() + `
        .${FEEDBACK_CONTAINER_CLASS} {
            position: fixed;
            left: 50%;
            top: 50%;
            z-index: 10000;
            font-family: 'Bowlby One SC', sans-serif;
            font-size: clamp(40px, 12vw, 72px);
            line-height: 1.1;
            text-align: center;
            pointer-events: none;
            /* Labels are meant to be short and punchy, but a longer one must
               wrap onto a second line rather than stay on one line and be
               shrunk to illegibility by --fit-scale. pre-line keeps any
               explicit newline the caller passes; break-word is the last
               resort for a single word wider than the cap.

               width:max-content is what actually makes the cap bind: the
               element is fixed at left/top 50%, so its shrink-to-fit width
               would otherwise be limited by the space left of that offset
               (half the viewport) and a label would wrap far narrower than
               85vw. max-content sizing ignores the available space, and
               max-width then clamps it to the cap. */
            white-space: pre-line;
            overflow-wrap: break-word;
            width: max-content;
            max-width: 85vw;
            --fit-scale: 1;
            opacity: 0;
            transform: translate(-50%, -50%) scale(calc(0.5 * var(--fit-scale)));
            animation: feedbackPopIn 0.15s ease-out forwards;
        }

        .${FEEDBACK_CONTAINER_CLASS}.fade-out {
            animation: feedbackFadeOut 0.15s ease-in forwards;
        }

        @keyframes feedbackPopIn {
            0% {
                opacity: 0;
                transform: translate(-50%, -50%) scale(calc(0.5 * var(--fit-scale)));
            }
            70% {
                transform: translate(-50%, -50%) scale(calc(1.1 * var(--fit-scale)));
            }
            100% {
                opacity: 1;
                transform: translate(-50%, -50%) scale(var(--fit-scale));
            }
        }

        @keyframes feedbackFadeOut {
            0% {
                opacity: 1;
                transform: translate(-50%, -50%) scale(var(--fit-scale));
            }
            100% {
                opacity: 0;
                transform: translate(-50%, -50%) scale(calc(0.8 * var(--fit-scale))) translateY(-20px);
            }
        }

        /* Positive (Green) variant */
        .${FEEDBACK_CONTAINER_CLASS}.variant-positive {
            background: linear-gradient(to bottom, #a6db67, #6e9635);
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
            -webkit-text-stroke: 1px #346306;
            paint-order: stroke fill;
            filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 1));
        }

        /* Neutral (Orange) variant */
        .${FEEDBACK_CONTAINER_CLASS}.variant-neutral {
            background: linear-gradient(to bottom, #fbb03a, #f15a26);
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
            -webkit-text-stroke: 1px #77301d;
            paint-order: stroke fill;
            filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 1));
        }

        /* Negative (Red) variant */
        .${FEEDBACK_CONTAINER_CLASS}.variant-negative {
            background: linear-gradient(to bottom, #c43535, #7f2020);
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
            -webkit-text-stroke: 1px #350404;
            paint-order: stroke fill;
            filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 1));
        }
    `;
    document.head.appendChild(style);
}

/** Lines the label currently wraps onto, from its laid-out height. */
function renderedLines(element: HTMLElement, fontSize: number): number {
    const lineHeight = fontSize * LINE_HEIGHT;
    if (!(lineHeight > 0)) return 1;
    return Math.max(1, Math.round(element.scrollHeight / lineHeight));
}

/**
 * Shrink the FONT (not the transform) until the label wraps within its line
 * budget. A smaller font lets more words share a line, where a transform would
 * keep the same tall stack and only make it smaller.
 *
 * The budget is MAX_LINES, widened to whatever the caller forced with explicit
 * newlines — `white-space: pre-line` honours those, so a deliberate three-line
 * label must not be shrunk to MIN_FONT_SCALE chasing a two-line target it can
 * never reach.
 *
 * Line count is read from layout on EVERY pass rather than inferred from
 * width: greedy line breaking leaves a ragged tail, so a label narrower than
 * `maxWidth * MAX_LINES` can still wrap onto MAX_LINES + 1 lines (three words
 * each just over half the cap take a line apiece). The single-line width only
 * seeds the opening guess, and only when no explicit break makes it
 * meaningless. All measurements use layout values (scrollWidth/scrollHeight),
 * which the class's own transform does not affect.
 */
function fitLabelToLineBudget(element: HTMLElement, text: string, maxWidth: number): void {
    element.style.fontSize = '';
    const baseFontSize = parseFloat(window.getComputedStyle(element).fontSize);
    if (!(baseFontSize > 0) || !(maxWidth > 0)) return;

    const lineBudget = Math.max(MAX_LINES, text.split('\n').length);
    if (renderedLines(element, baseFontSize) <= lineBudget) return;

    // Seed from the one-line width: `nowrap` collapses newlines, so this is
    // only a usable estimate for text the caller did not pre-break.
    let fit = 1;
    if (lineBudget === MAX_LINES) {
        element.style.whiteSpace = 'nowrap';
        const singleLineWidth = element.scrollWidth;
        element.style.whiteSpace = '';
        if (singleLineWidth > maxWidth * lineBudget) {
            fit = Math.max(MIN_FONT_SCALE, (maxWidth * lineBudget) / singleLineWidth);
            element.style.fontSize = `${baseFontSize * fit}px`;
        }
    }

    while (fit > MIN_FONT_SCALE && renderedLines(element, baseFontSize * fit) > lineBudget) {
        fit = Math.max(MIN_FONT_SCALE, fit - FONT_SCALE_STEP);
        element.style.fontSize = `${baseFontSize * fit}px`;
    }
}

/**
 * Fit, then re-fit once the real font is in use.
 *
 * The @font-face is `font-display: swap` with a zero block period, so the very
 * first measurement after injecting it lays out in the fallback face and the
 * browser swaps Bowlby One SC in afterwards — different widths, different line
 * breaks, after fitting had finished. Callers who ran preloadFeedbackFont()
 * skip the second pass; everyone else gets it on the first label only.
 */
function fitLabel(element: HTMLElement, text: string, maxWidth: number): void {
    fitLabelToLineBudget(element, text, maxWidth);
    applyOverflowSafetyNet(element, maxWidth);

    let fontReady = true;
    try {
        fontReady = document.fonts?.check(`1em '${FEEDBACK_FONT_FAMILY}'`) ?? true;
    } catch {
        fontReady = true;
    }
    if (fontReady) return;

    document.fonts.load(`1em '${FEEDBACK_FONT_FAMILY}'`).then(() => {
        if (!element.isConnected) return;
        element.style.removeProperty('--fit-scale');
        fitLabelToLineBudget(element, text, maxWidth);
        applyOverflowSafetyNet(element, maxWidth);
    }).catch(() => { /* font stays on the fallback; the first fit still applies */ });
}

/**
 * Safety net only: the width cap + overflow-wrap already keep the text inside
 * `maxWidth`, so this shrink fires only where wrapping cannot (a browser that
 * ignores overflow-wrap on an unbreakable string).
 */
function applyOverflowSafetyNet(element: HTMLElement, maxWidth: number): void {
    const textWidth = element.scrollWidth;
    if (textWidth > maxWidth) {
        element.style.setProperty('--fit-scale', (maxWidth / textWidth).toString());
    }
}

/**
 * Show a temporary feedback text on the center of the screen.
 * The text is non-interactive and auto-dismisses after ~1 second.
 *
 * **Use feedback for strong, non-gameplay-disturbing moments — by default.**
 * Any moment the player will clearly feel (a score milestone, a mistake, a life lost,
 * a bonus) should be surfaced with the matching variant. The pop floats over gameplay and
 * auto-dismisses, so it never blocks input. Omitting feedback on these moments makes the
 * game feel unresponsive.
 *
 * Variant guide — prefer the specific wrappers over calling this directly:
 *
 * | Moment | Variant | Wrapper |
 * |--------|---------|---------|
 * | Score / combo / collect bonus / level up / win | positive (green) | `showPositiveFeedback` |
 * | Modifier applied / streak reset / neutral milestone | neutral (orange) | `showNeutralFeedback` |
 * | Life lost / mistake / penalty / time-up / fail | negative (red) | `showNegativeFeedback` |
 *
 * Do **not** fire on every small action (each tile tap, each step) — only on moments with
 * clear emotional weight. When in doubt, use it; a missing flash is more noticeable than a
 * brief one.
 *
 * @param text - Short, punchy label (e.g. "Combo x3!", "Life Lost", "Level Up!")
 * @param variant - "positive" (green), "neutral" (orange), or "negative" (red)
 * @param duration - Visible duration in ms (default: 1000ms)
 */
export function showFeedback(text: string, variant: FeedbackVariant = "neutral", duration: number = 1000): void {
    injectStyles();

    const element = document.createElement('div');
    element.className = `${FEEDBACK_CONTAINER_CLASS} variant-${variant}`;
    element.textContent = text;

    // Temporarily make invisible to measure
    element.style.visibility = 'hidden';
    element.style.animation = 'none';
    document.body.appendChild(element);

    // The base size is tuned for a short, punchy label — a whole sentence at
    // that size wraps into a tower of near-empty lines.
    fitLabel(element, text, window.innerWidth * 0.85);

    // Now show with animation
    element.style.visibility = '';
    element.style.animation = '';

    // Schedule fade-out
    setTimeout(() => {
        element.classList.add('fade-out');

        // Remove element after fade-out animation completes
        setTimeout(() => {
            element.remove();
        }, 150);
    }, duration);
}

/**
 * Show positive (green) feedback text.
 *
 * Use for: scoring, combos, collecting bonuses, clearing a level, winning, any moment
 * the player did something right. Default choice whenever the player succeeds.
 *
 * Examples: `"Combo x3!"`, `"+50"`, `"Level Up!"`, `"Nice!"`, `"Perfect!"`
 */
export function showPositiveFeedback(text: string, duration?: number): void {
    showFeedback(text, "positive", duration);
}

/**
 * Show neutral (orange) feedback text.
 *
 * Use for: modifiers that activate, streak resets, items that are notable but neither
 * clearly good nor bad, warnings that aren't yet fatal (e.g. low time).
 *
 * Examples: `"x2 Speed"`, `"Streak Lost"`, `"Bonus Round"`, `"10s Left!"`
 */
export function showNeutralFeedback(text: string, duration?: number): void {
    showFeedback(text, "neutral", duration);
}

/**
 * Show negative (red) feedback text.
 *
 * Use for: losing a life, making a mistake, receiving a penalty, failing a level,
 * time running out, any moment the player took a hit. Always use this — never silently
 * subtract health or lives without feedback.
 *
 * Examples: `"Life Lost"`, `"Wrong!"`, `"Miss!"`, `"-10"`, `"Time Up!"`
 */
export function showNegativeFeedback(text: string, duration?: number): void {
    showFeedback(text, "negative", duration);
}
