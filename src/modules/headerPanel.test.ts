/**
 * Tests for headerPanel font injection — verifies that:
 * 1. No external <link> elements pointing at fonts.googleapis.com /
 *    fonts.gstatic.com are created.
 * 2. The @font-face styles are injected exactly once even when
 *    createHeaderBar() is called multiple times.
 * 3. The injected CSS contains the expected Lato families/weights and
 *    uses data: URIs.
 *
 * Module-level state (stylesInjected, headerInstance) is reset between
 * each test by calling jest.resetModules() and re-importing the module
 * via a fresh dynamic import().
 */

describe("headerPanel — no external <link> injection", () => {
    beforeEach(() => {
        jest.resetModules();
        document.head.innerHTML = "";
        document.body.innerHTML = "";
    });

    it("creates zero <link> elements pointing at fonts.googleapis.com", async () => {
        const { createHeaderBar } = await import("./headerPanel");
        createHeaderBar();
        const links = document.head.querySelectorAll("link[href*='fonts.googleapis.com']");
        expect(links).toHaveLength(0);
    });

    it("creates zero <link> elements pointing at fonts.gstatic.com", async () => {
        const { createHeaderBar } = await import("./headerPanel");
        createHeaderBar();
        const links = document.head.querySelectorAll("link[href*='fonts.gstatic.com']");
        expect(links).toHaveLength(0);
    });

    it("creates zero stylesheet <link> elements with http/https hrefs", async () => {
        const { createHeaderBar } = await import("./headerPanel");
        createHeaderBar();
        const links = Array.from(document.head.querySelectorAll("link[rel='stylesheet']"));
        const externalLinks = links.filter((el) =>
            /^https?:\/\//i.test((el as HTMLLinkElement).href)
        );
        expect(externalLinks).toHaveLength(0);
    });
});

describe("headerPanel — single injection guard", () => {
    beforeEach(() => {
        jest.resetModules();
        document.head.innerHTML = "";
        document.body.innerHTML = "";
    });

    it("injects exactly one <style> after the first createHeaderBar() call", async () => {
        const { createHeaderBar } = await import("./headerPanel");
        createHeaderBar();
        const styles = document.head.querySelectorAll("style#drop-header-bar-styles");
        expect(styles).toHaveLength(1);
    });

    it("does not inject a second <style> when createHeaderBar() is called twice", async () => {
        const { createHeaderBar } = await import("./headerPanel");
        createHeaderBar();
        createHeaderBar();
        const styles = document.head.querySelectorAll("style#drop-header-bar-styles");
        expect(styles).toHaveLength(1);
    });

    it("does not inject a second <style> after calling createHeaderBar() three times", async () => {
        const { createHeaderBar } = await import("./headerPanel");
        createHeaderBar();
        createHeaderBar();
        createHeaderBar();
        const styles = document.head.querySelectorAll("style#drop-header-bar-styles");
        expect(styles).toHaveLength(1);
    });

    it("the injected CSS contains only one @font-face block for Lato 400 regardless of call count", async () => {
        const { createHeaderBar } = await import("./headerPanel");
        createHeaderBar();
        createHeaderBar();
        const styleEl = document.head.querySelector("style#drop-header-bar-styles");
        const css = styleEl?.textContent ?? "";
        // Count occurrences of @font-face + Lato + 400
        const lato400Matches = css.match(/@font-face[\s\S]*?font-family:\s*['"]?Lato['"]?[\s\S]*?font-weight:\s*400/g);
        expect(lato400Matches?.length ?? 0).toBe(1);
    });

    it("the injected CSS contains only one @font-face block for Lato 700 regardless of call count", async () => {
        const { createHeaderBar } = await import("./headerPanel");
        createHeaderBar();
        createHeaderBar();
        const styleEl = document.head.querySelector("style#drop-header-bar-styles");
        const css = styleEl?.textContent ?? "";
        // Count occurrences of @font-face + Lato + 700
        const lato700Matches = css.match(/@font-face[\s\S]*?font-family:\s*['"]?Lato['"]?[\s\S]*?font-weight:\s*700/g);
        expect(lato700Matches?.length ?? 0).toBe(1);
    });
});

describe("headerPanel — injected CSS content", () => {
    beforeEach(() => {
        jest.resetModules();
        document.head.innerHTML = "";
        document.body.innerHTML = "";
    });

    it("injected style contains font-family Lato", async () => {
        const { createHeaderBar } = await import("./headerPanel");
        createHeaderBar();
        const styleEl = document.head.querySelector("style#drop-header-bar-styles");
        expect(styleEl).not.toBeNull();
        expect(styleEl!.textContent).toMatch(/font-family:\s*['"]?Lato['"]?/);
    });

    it("injected style contains a Lato weight-400 @font-face rule", async () => {
        const { createHeaderBar } = await import("./headerPanel");
        createHeaderBar();
        const css = document.head.querySelector("style#drop-header-bar-styles")?.textContent ?? "";
        expect(css).toMatch(/font-weight:\s*400/);
    });

    it("injected style contains a Lato weight-700 @font-face rule", async () => {
        const { createHeaderBar } = await import("./headerPanel");
        createHeaderBar();
        const css = document.head.querySelector("style#drop-header-bar-styles")?.textContent ?? "";
        expect(css).toMatch(/font-weight:\s*700/);
    });

    it("injected style uses data:font/woff2;base64 URIs (not external URLs)", async () => {
        const { createHeaderBar } = await import("./headerPanel");
        createHeaderBar();
        const css = document.head.querySelector("style#drop-header-bar-styles")?.textContent ?? "";
        expect(css).toContain("data:font/woff2;base64,");
        expect(css).not.toMatch(/https?:\/\/fonts\.googleapis\.com/);
        expect(css).not.toMatch(/https?:\/\/fonts\.gstatic\.com/);
    });
});

describe("headerPanel — sizing", () => {
    beforeEach(() => {
        jest.resetModules();
        document.head.innerHTML = "";
        document.body.innerHTML = "";
    });

    it("applies explicitly passed y, padding and font sizes as plain pixels", async () => {
        const { createHeaderBar } = await import("./headerPanel");
        createHeaderBar({ y: 28, padding: 22 }).addPanel({
            label: "Score",
            value: 0,
            style: { labelSize: 20, valueSize: 30 },
        });

        const bar = document.querySelector<HTMLElement>(".drop-header-bar")!;
        expect(bar.style.top).toBe("28px");
        expect(bar.style.paddingLeft).toBe("22px");
        expect(bar.querySelector<HTMLElement>(".panel-label")!.style.fontSize).toBe("20px");
        expect(bar.querySelector<HTMLElement>(".panel-value")!.style.fontSize).toBe("30px");
    });

    it("leaves default sizes to the scalable stylesheet instead of pinning pixels inline", async () => {
        const { createHeaderBar } = await import("./headerPanel");
        createHeaderBar().addPanel({ label: "Score", value: 0 });

        const bar = document.querySelector<HTMLElement>(".drop-header-bar")!;
        expect(bar.style.top).toBe("");
        expect(bar.style.paddingLeft).toBe("");
        expect(bar.querySelector<HTMLElement>(".panel-label")!.style.fontSize).toBe("");
        expect(bar.querySelector<HTMLElement>(".panel-value")!.style.fontSize).toBe("");
    });

    it("marks explicit sizes important so game CSS cannot override them", async () => {
        const { createHeaderBar } = await import("./headerPanel");
        createHeaderBar({ y: 28, padding: 22 }).addPanel({ label: "Score", value: 0, style: { valueSize: 30 } });

        const bar = document.querySelector<HTMLElement>(".drop-header-bar")!;
        expect(bar.style.getPropertyPriority("top")).toBe("important");
        expect(bar.style.getPropertyPriority("padding-left")).toBe("important");
        expect(bar.querySelector<HTMLElement>(".panel-value")!.style.getPropertyPriority("font-size")).toBe("important");
    });

    it("derives the header unit from the viewport only when there is no container", async () => {
        const { createHeaderBar } = await import("./headerPanel");
        createHeaderBar();
        const css = document.head.querySelector("style#drop-header-bar-styles")?.textContent ?? "";
        const unitRules = css.match(/[^{}]+\{\s*--drop-header-unit:[^}]*\}/g) ?? [];

        expect(unitRules).toHaveLength(1);
        expect(unitRules[0]).toContain(":not(.in-container)");
        expect(unitRules[0]).toContain("100vw");
    });
});
