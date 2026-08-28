/**
 * Regression guard for the pill layout-token scaling mode (PR #48).
 *
 * `primitives/pill.js` scales theme LENGTH tokens by the contain-fit factor a
 * fixed surface of the reference design space would get on the viewport. That
 * correction exists for FLUID, CSS-pixel canvases only. In fixed-logical mode
 * the layer transform already maps the design space onto the screen, and
 * `createViewportReader` returns the SUPPLIED logical size rather than the real
 * viewport — so applying the multiplier there shrinks the card a second time
 * (a 960x560 surface would get min(960/960, 560/1480) ~= 0.38).
 *
 * The observable proxy for the applied scale is the OK button's inline height,
 * written straight from `theme.modal.okButton.height` times that factor. jsdom
 * has no layout, but that value is set from tokens alone, so it reads back.
 */

import { createTutorialOverlay } from "./overlay.js";
import { TUTORIAL_THEME } from "./theme.js";

const OK_BUTTON_HEIGHT: number = TUTORIAL_THEME.modal.okButton.height;
const REF_W: number = TUTORIAL_THEME.referenceWidth;
const REF_H: number = TUTORIAL_THEME.referenceHeight;

/** Inline height of the pill's OK button, in px. */
function okButtonHeight(): number {
    const img = document.querySelector<HTMLImageElement>('img[alt="OK"]');
    if (!img) throw new Error("pill rendered no OK button");
    return parseFloat(img.style.height);
}

/**
 * jsdom ships no 2D canvas, so the pill's text measurement returns null.
 * Stub a context with proportional-enough metrics: the assertions below read
 * token-derived inline styles, not measured text, so exact widths are moot.
 */
function stubCanvasMeasurement(): jest.SpyInstance {
    return jest
        .spyOn(HTMLCanvasElement.prototype, "getContext")
        .mockReturnValue({
            font: "",
            measureText: (t: string) => ({ width: t.length * 10 }),
        } as unknown as CanvasRenderingContext2D);
}

describe("tutorial pill — layout-token scaling by canvas mode", () => {
    let overlay: ReturnType<typeof createTutorialOverlay> | null = null;

    beforeEach(() => {
        document.body.innerHTML = "";
        stubCanvasMeasurement();
    });

    afterEach(() => {
        overlay?.destroy?.();
        overlay = null;
        document.body.innerHTML = "";
        jest.restoreAllMocks();
    });

    it("consumes tokens 1:1 for a fixed logical surface, whatever its aspect", () => {
        // 960x560 is the documented landscape example: its height is far short
        // of the 1480 reference, so a viewport-derived factor would be ~0.38.
        overlay = createTutorialOverlay({ width: 960, height: 560 });
        overlay.showPill("Tap to play", { delay: 0 });

        expect(okButtonHeight()).toBe(OK_BUTTON_HEIGHT);
    });

    it("scales tokens by the contain-fit factor for a fluid canvas", () => {
        // No width/height -> the reader falls back to the window, so the factor
        // is the contain fit of the reference space into jsdom's viewport.
        const expected = Math.min(
            window.innerWidth / REF_W,
            window.innerHeight / REF_H,
        );
        // Guard the guard: a viewport that happened to match the design space
        // would make this assertion pass even with scaling removed entirely.
        expect(expected).not.toBeCloseTo(1, 2);

        overlay = createTutorialOverlay({});
        overlay.showPill("Tap to play", { delay: 0 });

        expect(okButtonHeight()).toBeCloseTo(OK_BUTTON_HEIGHT * expected, 5);
    });
});
