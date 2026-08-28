/**
 * Regression guard for the pill layout-token scaling mode (PR #48), plus
 * DROP-8084's narrow-fixed-surface case.
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
 *
 * DROP-8084: a fixed logical surface materially NARROWER than the 960
 * reference width (e.g. width:400) currently consumes the tokens RAW —
 * `screenMarginX: 100` and `padX: 48` per side leave a text budget of
 * 400 - 200 - 96 = 104px, clamped up to the 120px floor in `createPill`,
 * which wraps a 48px font at roughly one word per line. The fix derives a
 * logical-mode multiplier from `logicalWidth / referenceWidth`, clamped to
 * at most 1.0 — 1.0 at the 960 reference (AC2), 400/960 ~= 0.4167 at 400.
 * The FLUID contain-fit formula (tested below, unchanged by this ticket)
 * keeps its own independent `min(viewportW/refW, viewportH/refH)` formula —
 * these new cases only exercise the fixed/logical path.
 */

import { createTutorialOverlay } from "./overlay.js";
import { TUTORIAL_THEME } from "./theme.js";

const OK_BUTTON_HEIGHT: number = TUTORIAL_THEME.modal.okButton.height;
const REF_W: number = TUTORIAL_THEME.referenceWidth;
const REF_H: number = TUTORIAL_THEME.referenceHeight;

const NARROW_WIDTH: number = 400;
const NARROW_HEIGHT: number = 700;
const WIDE_WIDTH: number = 1400;
const WIDE_HEIGHT: number = 2000;

/** Inline height of the pill's OK button, in px. */
function okButtonHeight(): number {
    const img = document.querySelector<HTMLImageElement>('img[alt="OK"]');
    if (!img) throw new Error("pill rendered no OK button");
    return parseFloat(img.style.height);
}

/**
 * The pill's primary message `<div>` — `makeTextEl` is the only place that
 * sets `white-space:pre-wrap`, so that inline style uniquely identifies it
 * without reaching into unexported internals.
 */
function pillTextEl(): HTMLDivElement {
    const el = Array.from(document.querySelectorAll<HTMLDivElement>("div")).find(
        (candidate) => candidate.style.whiteSpace === "pre-wrap",
    );
    if (!el) throw new Error("pill rendered no text element");
    return el;
}

/** The pill text element's `max-width`, in px. */
function pillTextMaxWidth(): number {
    return parseFloat(pillTextEl().style.maxWidth);
}

/**
 * Reproduces `hardWrapText`'s greedy line-break decision using the exact
 * proportional metric `stubCanvasMeasurement` installs below (`width =
 * length * 10`), so it predicts the SUT's own wrapping for a given text
 * budget without importing pill.js's unexported helper.
 */
function wrapLineCount(text: string, maxWidth: number): number {
    const words = text.split(" ");
    let lines = 1;
    let line = "";
    for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (test.length * 10 > maxWidth && line) {
            lines += 1;
            line = word;
        } else {
            line = test;
        }
    }
    return lines;
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

    // Copilot review finding on PR #49: the DROP-8084 fix that scaled the raw
    // 120/12/60 px constants by `layoutScale` for narrow fixed logical
    // surfaces applied that scale UNCONDITIONALLY, so a fluid canvas -- whose
    // `layoutScale` is the contain-fit factor, not 1 -- also had its icon-row
    // gap and text-budget floor shrunk, changing the PR #48-tuned fluid row
    // layout. The fix gates the 120/12/60 constants on `isLogical` so a
    // fluid canvas keeps them raw (unscaled); only the theme-token lengths
    // (fontSize etc, via `scalePillTheme`) still scale by the contain-fit
    // factor as before.
    it("keeps the row icon-gap and text-budget floor RAW (unscaled) for a fluid canvas", () => {
        const viewportW = window.innerWidth;
        const viewportH = window.innerHeight;
        const expected = Math.min(viewportW / REF_W, viewportH / REF_H);
        // Guard the guard: the contain-fit factor must be materially below 1,
        // or a raw vs. scaled constant would be indistinguishable here.
        expect(expected).toBeLessThan(0.9);

        const scaledMargin = TUTORIAL_THEME.pill.screenMarginX * expected;
        const scaledPadX = TUTORIAL_THEME.pill.padX * expected;
        const wrapWidth = Math.max(120, viewportW - 2 * scaledMargin - 2 * scaledPadX);
        // Guard the guard: the OUTER wrap-width floor must not itself bind,
        // or this test can't isolate the row-level (icon-gap/text-budget)
        // regression from the outer-floor one.
        expect(wrapWidth).toBeGreaterThan(120);

        const scaledIconH = TUTORIAL_THEME.pill.fontSize * expected;
        const rawIconTextGap = 12;
        const iconW = scaledIconH + rawIconTextGap;
        const expectedTextBudget = Math.max(60, wrapWidth - iconW);

        overlay = createTutorialOverlay({});
        overlay.showPill("", {
            rows: [{ text: "Match three gems", iconSrc: "icon.png" }],
            delay: 0,
        });

        expect(pillTextMaxWidth()).toBeCloseTo(expectedTextBudget, 3);
    });
});

describe("tutorial pill — narrow fixed logical surface (DROP-8084)", () => {
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

    it("scales layout tokens down for a narrow fixed logical surface by width/referenceWidth", () => {
        const expectedScale = NARROW_WIDTH / REF_W;
        // Guard the guard: the ratio must be materially below 1, or this
        // assertion would pass even with no narrow-surface scaling at all.
        expect(expectedScale).toBeLessThan(0.5);

        overlay = createTutorialOverlay({ width: NARROW_WIDTH, height: NARROW_HEIGHT });
        overlay.showPill("Tap to play", { delay: 0 });

        expect(okButtonHeight()).toBeCloseTo(OK_BUTTON_HEIGHT * expectedScale, 5);
    });

    it("keeps the multiplier pinned to exactly 1.0 at the reference width, independent of aspect", () => {
        // Same width as the documented 960-wide example above, but a wildly
        // different height, to prove the multiplier is derived from width
        // alone -- not min(w/refW, h/refH) (the FLUID formula), which would
        // collapse this case to ~0.07 (100 / 1480).
        overlay = createTutorialOverlay({ width: REF_W, height: 100 });
        overlay.showPill("Tap to play", { delay: 0 });

        expect(okButtonHeight()).toBe(OK_BUTTON_HEIGHT);
    });

    it("clamps the multiplier at 1.0 for a surface wider than the reference (never inflates tokens)", () => {
        overlay = createTutorialOverlay({ width: WIDE_WIDTH, height: WIDE_HEIGHT });
        overlay.showPill("Tap to play", { delay: 0 });

        expect(okButtonHeight()).toBe(OK_BUTTON_HEIGHT);
    });

    it("gives a narrow fixed surface a text budget well above the one-word-per-line collapse floor", () => {
        const scale = NARROW_WIDTH / REF_W;
        const expectedWrapWidth = Math.max(
            120,
            NARROW_WIDTH
                - 2 * (TUTORIAL_THEME.pill.screenMarginX * scale)
                - 2 * (TUTORIAL_THEME.pill.padX * scale),
        );
        // Guard the guard: if the fixed formula still collapsed to the raw
        // 120px floor, this test would pass against the CURRENT broken
        // behaviour too, proving nothing.
        expect(expectedWrapWidth).not.toBe(120);
        // Sanity: still a meaningful fraction of the surface, not nearly
        // all of it (padding/margin still apply, just scaled).
        expect(expectedWrapWidth).toBeGreaterThan(NARROW_WIDTH * 0.5);
        expect(expectedWrapWidth).toBeLessThan(NARROW_WIDTH);

        overlay = createTutorialOverlay({ width: NARROW_WIDTH, height: NARROW_HEIGHT });
        overlay.showPill("Tap to play", { delay: 0 });

        expect(pillTextMaxWidth()).toBeCloseTo(expectedWrapWidth, 3);
    });

    it("wraps a multi-word phrase into materially fewer lines than the current one-word-heavy collapse", () => {
        const phrase = "Swipe carefully toward the glowing crystal tile";
        const scale = NARROW_WIDTH / REF_W;
        const brokenWrapWidth = Math.max(
            120,
            NARROW_WIDTH - 2 * TUTORIAL_THEME.pill.screenMarginX - 2 * TUTORIAL_THEME.pill.padX,
        );
        const fixedWrapWidth = Math.max(
            120,
            NARROW_WIDTH
                - 2 * (TUTORIAL_THEME.pill.screenMarginX * scale)
                - 2 * (TUTORIAL_THEME.pill.padX * scale),
        );
        const brokenLines = wrapLineCount(phrase, brokenWrapWidth);
        const fixedLines = wrapLineCount(phrase, fixedWrapWidth);
        // Guard the guard: the fixed budget must actually wrap into fewer
        // lines than the broken one, or the upper-bound assertion below
        // would be meaningless.
        expect(fixedLines).toBeLessThan(brokenLines);

        overlay = createTutorialOverlay({ width: NARROW_WIDTH, height: NARROW_HEIGHT });
        overlay.showPill(phrase, { delay: 0 });

        const renderedLines = pillTextEl().textContent?.split("\n").length ?? Infinity;
        expect(renderedLines).toBeLessThanOrEqual(fixedLines);
    });

    // Copilot review finding on PR #49: the wrap-width floor (120) and the
    // row-layout icon gap (12) / text-budget floor (60) in
    // `primitives/pill.js` were raw px, not theme tokens, so they stayed
    // full-size while `screenMarginX`/`padX` shrank with the surface. Below
    // a surface narrow enough to hit these floors, that mismatch pushes the
    // card's total width PAST `screenW - 2 * scaledMargin` -- the exact
    // region `screenMarginX` exists to keep clear.
    const VERY_NARROW_WIDTH = 160;
    const VERY_NARROW_HEIGHT = 300;

    it("scales the wrap-width floor itself, so a very narrow fixed logical surface doesn't push the card past its own screen margin", () => {
        const scale = VERY_NARROW_WIDTH / REF_W;
        const scaledMargin = TUTORIAL_THEME.pill.screenMarginX * scale;
        const scaledPadX = TUTORIAL_THEME.pill.padX * scale;
        const deductionWrapWidth = VERY_NARROW_WIDTH - 2 * scaledMargin - 2 * scaledPadX;

        // Guard the guard: this width must actually be narrow enough that
        // the RAW (unscaled) 120 floor would have won the `Math.max`, or the
        // two formulas below never diverge and the test proves nothing.
        expect(deductionWrapWidth).toBeLessThan(120);

        const expectedWrapWidth = Math.max(120 * scale, deductionWrapWidth);

        overlay = createTutorialOverlay({ width: VERY_NARROW_WIDTH, height: VERY_NARROW_HEIGHT });
        overlay.showPill("Tap to play", { delay: 0 });

        expect(pillTextMaxWidth()).toBeCloseTo(expectedWrapWidth, 3);

        // The card itself (text + its own padX on both sides) must fit
        // inside the margin-reserved region -- the invariant `screenMarginX`
        // exists for. A raw, unscaled 120 floor blows past it by ~9px here.
        const cardWidth = pillTextMaxWidth() + 2 * scaledPadX;
        const availableInsideMargin = VERY_NARROW_WIDTH - 2 * scaledMargin;
        expect(cardWidth).toBeLessThanOrEqual(availableInsideMargin + 1e-6);
    });

    it("scales the row icon-gap and text-budget floor, so an icon row's text budget doesn't exceed the row's own wrap width", () => {
        const width = 50;
        const height = 100;
        const scale = width / REF_W;
        const wrapWidth = Math.max(
            120 * scale,
            width - 2 * (TUTORIAL_THEME.pill.screenMarginX * scale) - 2 * (TUTORIAL_THEME.pill.padX * scale),
        );
        const scaledIconH = TUTORIAL_THEME.pill.fontSize * scale;
        const scaledIconTextGap = 12 * scale;
        const iconW = scaledIconH + scaledIconTextGap;
        const expectedTextBudget = Math.max(60 * scale, wrapWidth - iconW);

        // Guard the guard: at this width the RAW 60px floor (60 > wrapWidth)
        // would have won the row's own `Math.max`, forcing a text budget
        // bigger than the row's entire available width. If the scaled floor
        // doesn't win here, the two formulas never diverge.
        expect(expectedTextBudget).toBeLessThan(wrapWidth);
        expect(60).toBeGreaterThan(wrapWidth);

        overlay = createTutorialOverlay({ width, height });
        overlay.showPill("", {
            rows: [{ text: "Match three gems", iconSrc: "icon.png" }],
            delay: 0,
        });

        expect(pillTextMaxWidth()).toBeCloseTo(expectedTextBudget, 3);
        expect(pillTextMaxWidth()).toBeLessThanOrEqual(wrapWidth + 1e-6);
    });
});
