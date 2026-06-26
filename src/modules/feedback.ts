import { getBowlbyOneSCFontFaceCSS } from './fonts/bowlbyOneSC.js';

const FEEDBACK_CONTAINER_CLASS = "drop-feedback-text";

export type FeedbackVariant = "positive" | "neutral" | "negative";

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
            text-align: center;
            pointer-events: none;
            white-space: nowrap;
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

    // Calculate fit scale if text is too wide
    const maxWidth = window.innerWidth * 0.85;
    const textWidth = element.scrollWidth;
    if (textWidth > maxWidth) {
        const fitScale = maxWidth / textWidth;
        element.style.setProperty('--fit-scale', fitScale.toString());
    }

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
