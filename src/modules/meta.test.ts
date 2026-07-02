import { applyMetaTags, applyDropMetaTags } from "./meta";

describe("meta", () => {
    beforeEach(() => {
        document.head.innerHTML = "";
    });

    describe("applyMetaTags", () => {
        it("appends a UTF-8 charset meta tag to <head>", () => {
            applyMetaTags();
            const charset = document.head.querySelector("meta[charset]");
            expect(charset).not.toBeNull();
            expect(charset!.getAttribute("charset")).toBe("UTF-8");
        });

        it("appends a viewport meta tag with the responsive content", () => {
            applyMetaTags();
            const viewport = document.head.querySelector("meta[name='viewport']");
            expect(viewport).not.toBeNull();
            expect(viewport!.getAttribute("content")).toBe(
                "width=device-width, initial-scale=1.0"
            );
        });

        it("appends exactly two meta tags per call", () => {
            applyMetaTags();
            expect(document.head.querySelectorAll("meta")).toHaveLength(2);
        });

        it("appends to — does not replace — existing head content", () => {
            const title = document.createElement("title");
            title.textContent = "Game";
            document.head.appendChild(title);

            applyMetaTags();

            expect(document.head.querySelector("title")).not.toBeNull();
            expect(document.head.querySelectorAll("meta")).toHaveLength(2);
        });
    });

    describe("applyDropMetaTags (backward-compat alias)", () => {
        it("is the same function reference as applyMetaTags", () => {
            expect(applyDropMetaTags).toBe(applyMetaTags);
        });

        it("also appends charset + viewport meta tags", () => {
            applyDropMetaTags();
            expect(document.head.querySelector("meta[charset]")).not.toBeNull();
            expect(
                document.head.querySelector("meta[name='viewport']")
            ).not.toBeNull();
        });
    });
});
