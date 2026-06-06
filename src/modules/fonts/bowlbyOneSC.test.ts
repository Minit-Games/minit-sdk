import { getBowlbyOneSCFontFaceCSS } from "./bowlbyOneSC";

describe("getBowlbyOneSCFontFaceCSS", () => {
    it("returns a non-empty string", () => {
        const css = getBowlbyOneSCFontFaceCSS();
        expect(typeof css).toBe("string");
        expect(css.length).toBeGreaterThan(0);
    });

    it("contains an @font-face block", () => {
        const css = getBowlbyOneSCFontFaceCSS();
        expect(css).toContain("@font-face");
    });

    it("declares font-family 'Bowlby One SC'", () => {
        const css = getBowlbyOneSCFontFaceCSS();
        expect(css).toMatch(/font-family:\s*['"]?Bowlby One SC['"]?/);
    });

    it("includes a weight-400 rule", () => {
        const css = getBowlbyOneSCFontFaceCSS();
        expect(css).toMatch(/font-weight:\s*400/);
    });

    it("uses a data:font/woff2;base64 URI", () => {
        const css = getBowlbyOneSCFontFaceCSS();
        expect(css).toContain("data:font/woff2;base64,");
    });

    it("does not reference any external URLs", () => {
        const css = getBowlbyOneSCFontFaceCSS();
        expect(css).not.toMatch(/https?:\/\//);
        expect(css).not.toContain("fonts.googleapis.com");
        expect(css).not.toContain("fonts.gstatic.com");
    });

    it("does not touch the DOM when called", () => {
        const before = document.head.innerHTML;
        getBowlbyOneSCFontFaceCSS();
        expect(document.head.innerHTML).toBe(before);
    });
});
