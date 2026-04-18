const FEEDBACK_CONTAINER_CLASS = "drop-feedback-text";

export type FeedbackVariant = "positive" | "neutral" | "negative";

let stylesInjected = false;
let fontPreloaded = false;

const FEEDBACK_FONT_URL = 'https://fonts.googleapis.com/css2?family=Bowlby+One+SC&display=swap';

/**
 * Preload the feedback font to avoid fallback font flash on first use.
 * Call this early in your game initialization (e.g., alongside initializeDropSDK).
 * This is optional - the font will still load on first showFeedback() call if not preloaded.
 *
 * @returns Promise that resolves when the font is loaded
 */
export async function preloadFeedbackFont(): Promise<void> {
    if (fontPreloaded) return;
    fontPreloaded = true;

    // Add the font stylesheet link
    const fontLink = document.createElement('link');
    fontLink.href = FEEDBACK_FONT_URL;
    fontLink.rel = 'stylesheet';
    document.head.appendChild(fontLink);

    // Wait for the font to actually load using the CSS Font Loading API
    try {
        await document.fonts.load("1em 'Bowlby One SC'");
    } catch (e) {
        // Font loading API not supported or failed, font will load via stylesheet
        console.warn('[Feedback] Font preload failed, will load on first use');
    }
}

function injectStyles(): void {
    if (stylesInjected) return;
    stylesInjected = true;

    // Load font if not already preloaded
    if (!fontPreloaded) {
        fontPreloaded = true;
        const fontLink = document.createElement('link');
        fontLink.href = FEEDBACK_FONT_URL;
        fontLink.rel = 'stylesheet';
        document.head.appendChild(fontLink);
    }

    const style = document.createElement('style');
    style.id = 'drop-feedback-text-styles';
    style.textContent = `
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
 * @param text - The feedback text to display (e.g., "Great!", "Combo x2", "Life Lost")
 * @param variant - The color variant: "positive" (green), "neutral" (orange), or "negative" (red)
 * @param duration - How long the text stays visible in milliseconds (default: 1000ms)
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
 * Convenience wrapper for showFeedback with "positive" variant.
 */
export function showPositiveFeedback(text: string, duration?: number): void {
    showFeedback(text, "positive", duration);
}

/**
 * Show neutral (orange) feedback text.
 * Convenience wrapper for showFeedback with "neutral" variant.
 */
export function showNeutralFeedback(text: string, duration?: number): void {
    showFeedback(text, "neutral", duration);
}

/**
 * Show negative (red) feedback text.
 * Convenience wrapper for showFeedback with "negative" variant.
 */
export function showNegativeFeedback(text: string, duration?: number): void {
    showFeedback(text, "negative", duration);
}
