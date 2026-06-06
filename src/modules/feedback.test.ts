/**
 * Tests for feedback module font injection — verifies that:
 * 1. No external <link> elements pointing at fonts.googleapis.com /
 *    fonts.gstatic.com are created.
 * 2. The @font-face styles are injected exactly once even when
 *    showFeedback() and preloadFeedbackFont() are called multiple times.
 * 3. The injected CSS contains the expected "Bowlby One SC" family /
 *    weight and uses data: URIs.
 *
 * jsdom does not implement the CSS Font Loading API (document.fonts.load).
 * We supply a minimal mock before each test so preloadFeedbackFont() can
 * exercise its full path without throwing.  The mock is cleaned up in
 * afterEach via jest.restoreAllMocks().
 *
 * Module-level state (stylesInjected, fontPreloaded) is reset between
 * each test by calling jest.resetModules() and re-importing via a fresh
 * dynamic import().
 */

function mockDocumentFonts(): void {
    // jsdom omits document.fonts — provide a minimal stub so
    // preloadFeedbackFont()'s `await document.fonts.load(...)` resolves.
    if (!("fonts" in document)) {
        Object.defineProperty(document, "fonts", {
            value: { load: jest.fn().mockResolvedValue([]) },
            configurable: true,
            writable: true,
        });
    } else {
        (document.fonts as unknown as { load: jest.Mock }).load = jest
            .fn()
            .mockResolvedValue([]);
    }
}

describe("feedback — no external <link> injection", () => {
    beforeEach(() => {
        jest.resetModules();
        document.head.innerHTML = "";
        document.body.innerHTML = "";
        mockDocumentFonts();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("showFeedback creates zero <link> elements pointing at fonts.googleapis.com", async () => {
        const { showFeedback } = await import("./feedback");
        showFeedback("Test");
        const links = document.head.querySelectorAll("link[href*='fonts.googleapis.com']");
        expect(links).toHaveLength(0);
    });

    it("showFeedback creates zero <link> elements pointing at fonts.gstatic.com", async () => {
        const { showFeedback } = await import("./feedback");
        showFeedback("Test");
        const links = document.head.querySelectorAll("link[href*='fonts.gstatic.com']");
        expect(links).toHaveLength(0);
    });

    it("preloadFeedbackFont creates zero <link> elements pointing at fonts.googleapis.com", async () => {
        const { preloadFeedbackFont } = await import("./feedback");
        await preloadFeedbackFont();
        const links = document.head.querySelectorAll("link[href*='fonts.googleapis.com']");
        expect(links).toHaveLength(0);
    });

    it("creates zero stylesheet <link> elements with http/https hrefs", async () => {
        const { showFeedback } = await import("./feedback");
        showFeedback("Test");
        const links = Array.from(document.head.querySelectorAll("link[rel='stylesheet']"));
        const externalLinks = links.filter((el) =>
            /^https?:\/\//i.test((el as HTMLLinkElement).href)
        );
        expect(externalLinks).toHaveLength(0);
    });
});

describe("feedback — single injection guard", () => {
    beforeEach(() => {
        jest.resetModules();
        document.head.innerHTML = "";
        document.body.innerHTML = "";
        mockDocumentFonts();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("injects exactly one <style> after the first showFeedback() call", async () => {
        const { showFeedback } = await import("./feedback");
        showFeedback("Test");
        const styles = document.head.querySelectorAll("style#drop-feedback-text-styles");
        expect(styles).toHaveLength(1);
    });

    it("does not inject a second <style> when showFeedback() is called twice", async () => {
        const { showFeedback } = await import("./feedback");
        showFeedback("First");
        showFeedback("Second");
        const styles = document.head.querySelectorAll("style#drop-feedback-text-styles");
        expect(styles).toHaveLength(1);
    });

    it("does not inject a second <style> when preloadFeedbackFont() followed by showFeedback()", async () => {
        const { preloadFeedbackFont, showFeedback } = await import("./feedback");
        await preloadFeedbackFont();
        showFeedback("After preload");
        const styles = document.head.querySelectorAll("style#drop-feedback-text-styles");
        expect(styles).toHaveLength(1);
    });

    it("preloadFeedbackFont() is idempotent — calling it twice injects one <style>", async () => {
        const { preloadFeedbackFont } = await import("./feedback");
        await preloadFeedbackFont();
        await preloadFeedbackFont();
        const styles = document.head.querySelectorAll("style#drop-feedback-text-styles");
        expect(styles).toHaveLength(1);
    });

    it("the injected CSS contains only one @font-face block for Bowlby One SC", async () => {
        const { showFeedback } = await import("./feedback");
        showFeedback("A");
        showFeedback("B");
        const styleEl = document.head.querySelector("style#drop-feedback-text-styles");
        const css = styleEl?.textContent ?? "";
        const matches = css.match(/@font-face/g);
        // There should be exactly 1 @font-face for Bowlby One SC
        expect(matches?.length ?? 0).toBe(1);
    });
});

describe("feedback — injected CSS content", () => {
    beforeEach(() => {
        jest.resetModules();
        document.head.innerHTML = "";
        document.body.innerHTML = "";
        mockDocumentFonts();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("injected style contains font-family 'Bowlby One SC'", async () => {
        const { showFeedback } = await import("./feedback");
        showFeedback("Test");
        const styleEl = document.head.querySelector("style#drop-feedback-text-styles");
        expect(styleEl).not.toBeNull();
        expect(styleEl!.textContent).toMatch(/font-family:\s*['"]?Bowlby One SC['"]?/);
    });

    it("injected style contains a weight-400 rule for Bowlby One SC", async () => {
        const { showFeedback } = await import("./feedback");
        showFeedback("Test");
        const css = document.head.querySelector("style#drop-feedback-text-styles")?.textContent ?? "";
        expect(css).toMatch(/font-weight:\s*400/);
    });

    it("injected style uses data:font/woff2;base64 URI (not an external URL)", async () => {
        const { showFeedback } = await import("./feedback");
        showFeedback("Test");
        const css = document.head.querySelector("style#drop-feedback-text-styles")?.textContent ?? "";
        expect(css).toContain("data:font/woff2;base64,");
        expect(css).not.toMatch(/https?:\/\/fonts\.googleapis\.com/);
        expect(css).not.toMatch(/https?:\/\/fonts\.gstatic\.com/);
    });

    it("preloadFeedbackFont() also injects the Bowlby One SC CSS", async () => {
        const { preloadFeedbackFont } = await import("./feedback");
        await preloadFeedbackFont();
        const css = document.head.querySelector("style#drop-feedback-text-styles")?.textContent ?? "";
        expect(css).toMatch(/font-family:\s*['"]?Bowlby One SC['"]?/);
        expect(css).toContain("data:font/woff2;base64,");
    });
});

describe("feedback — preloadFeedbackFont handles missing Font Loading API gracefully", () => {
    beforeEach(() => {
        jest.resetModules();
        document.head.innerHTML = "";
        document.body.innerHTML = "";
        // Simulate an environment where document.fonts.load throws
        Object.defineProperty(document, "fonts", {
            value: {
                load: jest.fn().mockRejectedValue(new Error("Font Loading API not supported")),
            },
            configurable: true,
            writable: true,
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("resolves without throwing even when document.fonts.load rejects", async () => {
        const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
        const { preloadFeedbackFont } = await import("./feedback");
        await expect(preloadFeedbackFont()).resolves.toBeUndefined();
        warnSpy.mockRestore();
    });

    it("still injects the @font-face CSS even when document.fonts.load rejects", async () => {
        jest.spyOn(console, "warn").mockImplementation(() => {});
        const { preloadFeedbackFont } = await import("./feedback");
        await preloadFeedbackFont();
        const styleEl = document.head.querySelector("style#drop-feedback-text-styles");
        expect(styleEl).not.toBeNull();
        expect(styleEl!.textContent).toMatch(/font-family:\s*['"]?Bowlby One SC['"]?/);
    });
});
