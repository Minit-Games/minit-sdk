import { getLatoFontFaceCSS } from "./lato";

describe("getLatoFontFaceCSS", () => {
    it("returns a non-empty string", () => {
        const css = getLatoFontFaceCSS();
        expect(typeof css).toBe("string");
        expect(css.length).toBeGreaterThan(0);
    });

    it("contains @font-face blocks", () => {
        const css = getLatoFontFaceCSS();
        expect(css).toContain("@font-face");
    });

    it("declares font-family Lato", () => {
        const css = getLatoFontFaceCSS();
        expect(css).toMatch(/font-family:\s*['"]?Lato['"]?/);
    });

    it("includes a weight-400 rule", () => {
        const css = getLatoFontFaceCSS();
        expect(css).toMatch(/font-weight:\s*400/);
    });

    it("includes a weight-700 rule", () => {
        const css = getLatoFontFaceCSS();
        expect(css).toMatch(/font-weight:\s*700/);
    });

    it("uses data:font/woff2;base64 URIs for both weights", () => {
        const css = getLatoFontFaceCSS();
        const matches = css.match(/data:font\/woff2;base64,/g);
        expect(matches).not.toBeNull();
        expect(matches!.length).toBeGreaterThanOrEqual(2);
    });

    it("does not reference any external URLs", () => {
        const css = getLatoFontFaceCSS();
        expect(css).not.toMatch(/https?:\/\//);
        expect(css).not.toContain("fonts.googleapis.com");
        expect(css).not.toContain("fonts.gstatic.com");
    });

    it("does not touch the DOM when called", () => {
        const before = document.head.innerHTML;
        getLatoFontFaceCSS();
        expect(document.head.innerHTML).toBe(before);
    });
});
