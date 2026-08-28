/**
 * Regression guards for the feedback label line-budget fitting (PR #48).
 *
 * jsdom performs no layout: it resolves no `clamp()` font-size and reports
 * scrollWidth/scrollHeight as 0, so the fitting pass is inert here unless the
 * measurements it consumes are supplied. These tests therefore stub exactly
 * the three reads the fitting code makes — computed font size, the one-line
 * scrollWidth, and the wrapped scrollHeight — and assert the DECISION taken
 * from them. The stubbed relationship (`scrollHeight = lines * fontSize *
 * line-height`) is how a CSS line box with a unitless line-height composes,
 * and LINE_HEIGHT below must stay in step with the injected stylesheet.
 *
 * What this cannot cover is whether the browser wraps where we predict; that
 * is verified by eye in examples/tutorial-preview.
 */

const LINE_HEIGHT = 1.1;
const BASE_FONT_SIZE = 72;
/** window.innerWidth * 0.85 under jsdom's default 1024px viewport. */
const MAX_WIDTH = 1024 * 0.85;

/** Lines the fake layout reports, as a function of the current font scale. */
type WrapModel = (fontScale: number) => number;

/**
 * Install the layout doubles. `singleLineWidth` is what the element measures
 * under `white-space: nowrap` (the opening-estimate read); `wrap` decides how
 * many lines the same text occupies once wrapping is restored.
 */
function stubLayout(singleLineWidth: number, wrap: WrapModel): void {
    jest.spyOn(window, "getComputedStyle").mockImplementation(
        () => ({ fontSize: `${BASE_FONT_SIZE}px` }) as CSSStyleDeclaration,
    );

    const currentScale = (el: HTMLElement): number => {
        const px = parseFloat(el.style.fontSize);
        return px > 0 ? px / BASE_FONT_SIZE : 1;
    };

    Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
        configurable: true,
        get(this: HTMLElement) {
            if (this.style.whiteSpace === "nowrap") return singleLineWidth;
            // Wrapped text is held inside the cap by max-width; returning the
            // cap keeps the unbreakable-string safety net dormant.
            return MAX_WIDTH;
        },
    });

    Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
        configurable: true,
        get(this: HTMLElement) {
            const scale = currentScale(this);
            return wrap(scale) * BASE_FONT_SIZE * scale * LINE_HEIGHT;
        },
    });
}

function restoreLayout(): void {
    for (const prop of ["scrollWidth", "scrollHeight"]) {
        Object.defineProperty(HTMLElement.prototype, prop, {
            configurable: true,
            get() {
                return 0;
            },
        });
    }
}

/** Font scale the fitting pass settled on for the rendered label. */
function appliedFontScale(): number {
    const el = document.querySelector<HTMLElement>(".drop-feedback-text");
    if (!el) throw new Error("no feedback label rendered");
    const px = parseFloat(el.style.fontSize);
    return Number.isFinite(px) ? px / BASE_FONT_SIZE : 1;
}

describe("feedback label — line-budget fitting", () => {
    let showFeedback: typeof import("./feedback").showFeedback;

    beforeEach(async () => {
        jest.resetModules();
        document.head.innerHTML = "";
        document.body.innerHTML = "";
        Object.defineProperty(document, "fonts", {
            configurable: true,
            writable: true,
            // `check` reporting true keeps the post-swap refit out of the way;
            // it has its own test below.
            value: { load: jest.fn().mockResolvedValue([]), check: () => true },
        });
        ({ showFeedback } = await import("./feedback"));
    });

    afterEach(() => {
        jest.restoreAllMocks();
        restoreLayout();
        document.body.innerHTML = "";
    });

    it("shrinks a label that wraps to three lines while measuring under 2x the cap", () => {
        // The defect this guards: the shrink used to be gated on the one-line
        // width exceeding MAX_LINES * cap. Greedy wrapping puts three words of
        // 0.6x the cap on three lines even though they sum to 1.8x, so such a
        // label stayed at full size and blew the two-line budget.
        stubLayout(MAX_WIDTH * 1.8, (scale) => (scale >= 1 ? 3 : 2));

        showFeedback("Alpha Bravo Charlie");

        expect(appliedFontScale()).toBeLessThan(1);
    });

    it("leaves a label that already fits the budget at full size", () => {
        stubLayout(MAX_WIDTH * 0.5, () => 1);

        showFeedback("Combo x3!");

        expect(appliedFontScale()).toBe(1);
    });

    it("does not shrink past the readability floor", () => {
        // Prose that never fits two lines at any scale: the shrink must stop
        // at MIN_FONT_SCALE and let it wrap instead of becoming unreadable.
        stubLayout(MAX_WIDTH * 12, () => 5);

        showFeedback("A whole sentence used where a punchy label was asked for");

        expect(appliedFontScale()).toBeCloseTo(0.5, 5);
    });

    it("re-fits once the real font swaps in", async () => {
        // font-display: swap means the first measurement can land in the
        // fallback face and be invalidated when Bowlby One SC arrives. Model
        // that: the label fits at first, then needs three lines in the wider
        // display face, and must be shrunk after the swap rather than left
        // at the size the fallback earned.
        const loaded = Promise.resolve([]);
        (document.fonts as unknown as { check: () => boolean }).check = () => false;
        (document.fonts as unknown as { load: jest.Mock }).load = jest
            .fn()
            .mockReturnValue(loaded);

        let swapped = false;
        stubLayout(MAX_WIDTH * 1.8, (scale) => {
            if (!swapped) return 1;
            return scale >= 1 ? 3 : 2;
        });

        showFeedback("Alpha Bravo Charlie");
        expect(appliedFontScale()).toBe(1);

        swapped = true;
        await loaded;
        await Promise.resolve();

        expect(appliedFontScale()).toBeLessThan(1);
    });

    it("survives a Font Loading API stub that exposes check but not load", () => {
        // Hosts stub `document.fonts` unevenly — feedback.test.ts in this very
        // repo defines only `load`. The mirror shape (check, no load) used to
        // throw a TypeError straight out of showFeedback into the game.
        Object.defineProperty(document, "fonts", {
            configurable: true,
            writable: true,
            value: { check: () => false },
        });
        stubLayout(MAX_WIDTH * 0.5, () => 1);

        expect(() => showFeedback("Combo x3!")).not.toThrow();
        expect(document.querySelector(".drop-feedback-text")).not.toBeNull();
    });

    it("skips the post-swap re-fit for a label already fading out", () => {
        let resolveLoad!: (v: unknown) => void;
        const loaded = new Promise((r) => {
            resolveLoad = r;
        });
        (document.fonts as unknown as { check: () => boolean }).check = () => false;
        (document.fonts as unknown as { load: jest.Mock }).load = jest
            .fn()
            .mockReturnValue(loaded);

        let swapped = false;
        stubLayout(MAX_WIDTH * 1.8, (scale) => {
            if (!swapped) return 1;
            return scale >= 1 ? 3 : 2;
        });

        showFeedback("Alpha Bravo Charlie");
        const el = document.querySelector<HTMLElement>(".drop-feedback-text")!;

        // The pop has started disappearing before the font resolved.
        el.classList.add("fade-out");
        swapped = true;
        resolveLoad([]);

        return loaded.then(() => Promise.resolve()).then(() => {
            expect(appliedFontScale()).toBe(1);
        });
    });

    it("widens the budget to the line count the caller forced with newlines", () => {
        // `white-space: pre-line` honours these breaks, so a deliberate
        // three-line label can never reach a two-line target — shrinking it
        // would just drive it to the floor for nothing.
        stubLayout(MAX_WIDTH * 0.9, () => 3);

        showFeedback("Ready\nSet\nGo");

        expect(appliedFontScale()).toBe(1);
    });
});
