import { addBackground, addDropBackground } from "./background";

describe("addBackground", () => {
    beforeEach(() => {
        document.head.innerHTML = "";
        document.body.innerHTML = "";
    });

    describe("container element", () => {
        it("creates a #game-background div and prepends it to <body>", () => {
            addBackground();
            const bg = document.getElementById("game-background");
            expect(bg).not.toBeNull();
            expect(bg!.parentElement).toBe(document.body);
            expect(document.body.firstElementChild).toBe(bg);
        });

        it("prepends the background before existing body content", () => {
            const existing = document.createElement("div");
            existing.id = "game-root";
            document.body.appendChild(existing);

            addBackground();

            expect(document.body.firstElementChild!.id).toBe("game-background");
        });

        it("reuses an existing background element instead of creating a duplicate", () => {
            addBackground();
            addBackground();
            expect(document.querySelectorAll("#game-background")).toHaveLength(1);
        });

        it("uses a custom containerId when provided", () => {
            addBackground({ backgroundColor: "#fff", containerId: "custom-bg" });
            expect(document.getElementById("custom-bg")).not.toBeNull();
            expect(document.getElementById("game-background")).toBeNull();
        });

        it("applies fixed, full-screen, non-interactive positioning styles", () => {
            addBackground();
            const bg = document.getElementById("game-background")!;
            expect(bg.style.position).toBe("fixed");
            expect(bg.style.inset).toBe("0");
            expect(bg.style.zIndex).toBe("0");
            expect(bg.style.pointerEvents).toBe("none");
            expect(bg.style.display).toBe("flex");
        });
    });

    describe("background color", () => {
        it("applies the default background color when none is given", () => {
            addBackground();
            const bg = document.getElementById("game-background")!;
            // Source sets rgba(198,198,198,1); cssstyle normalizes alpha-1 to rgb().
            expect(bg.style.backgroundColor).toBe("rgb(198, 198, 198)");
        });

        it("applies a custom background color", () => {
            addBackground({ backgroundColor: "rgb(10, 20, 30)" });
            const bg = document.getElementById("game-background")!;
            expect(bg.style.backgroundColor).toBe("rgb(10, 20, 30)");
        });

        it("updates the color when called again on the same element", () => {
            addBackground({ backgroundColor: "rgb(1, 2, 3)" });
            addBackground({ backgroundColor: "rgb(9, 8, 7)" });
            const bg = document.getElementById("game-background")!;
            expect(bg.style.backgroundColor).toBe("rgb(9, 8, 7)");
        });
    });

    describe("image branch", () => {
        it("does not add an image container when no image is provided", () => {
            addBackground({ backgroundColor: "#000" });
            const bg = document.getElementById("game-background")!;
            expect(bg.querySelector("img")).toBeNull();
        });

        it("adds a full-screen <img> with the given source", () => {
            addBackground({ backgroundColor: "#000", image: { src: "pic.png" } });
            const img = document
                .getElementById("game-background")!
                .querySelector("img");
            expect(img).not.toBeNull();
            expect(img!.getAttribute("src")).toBe("pic.png");
            expect(img!.style.width).toBe("100%");
            expect(img!.style.height).toBe("100%");
        });

        it("overscans the image container by 1px so WebKit's edge seam stays off-screen (DROP-8459)", () => {
            addBackground({ backgroundColor: "#000", image: { src: "pic.svg" } });
            const img = document
                .getElementById("game-background")!
                .querySelector("img")!;
            const imgContainer = img.parentElement!;
            expect(imgContainer.style.position).toBe("absolute");
            expect(imgContainer.style.inset).toBe("-1px");
            expect(imgContainer.style.overflow).toBe("hidden");
        });

        it("defaults objectFit to 'cover' and opacity to '1'", () => {
            addBackground({ backgroundColor: "#000", image: { src: "pic.png" } });
            const img = document
                .getElementById("game-background")!
                .querySelector("img")!;
            expect(img.style.objectFit).toBe("cover");
            expect(img.style.opacity).toBe("1");
        });

        it("honors custom fit and opacity", () => {
            addBackground({
                backgroundColor: "#000",
                image: { src: "pic.png", fit: "contain", opacity: 0.5 },
            });
            const img = document
                .getElementById("game-background")!
                .querySelector("img")!;
            expect(img.style.objectFit).toBe("contain");
            expect(img.style.opacity).toBe("0.5");
        });

        it("applies a blur filter (and slight upscale) when blur > 0", () => {
            addBackground({
                backgroundColor: "#000",
                image: { src: "pic.png", blur: 4 },
            });
            const img = document
                .getElementById("game-background")!
                .querySelector("img")!;
            expect(img.style.filter).toBe("blur(4px)");
            expect(img.style.transform).toBe("scale(1.1)");
        });

        it("does not apply a blur filter when blur is 0 or absent", () => {
            addBackground({
                backgroundColor: "#000",
                image: { src: "pic.png", blur: 0 },
            });
            const img = document
                .getElementById("game-background")!
                .querySelector("img")!;
            expect(img.style.filter).toBe("");
        });
    });

    describe("shapes branch", () => {
        it("does not add shapes when shapes are absent or disabled", () => {
            addBackground({ backgroundColor: "#000", shapes: { enabled: false } });
            const bg = document.getElementById("game-background")!;
            expect(bg.querySelectorAll("svg")).toHaveLength(0);
        });

        it("renders the default of 20 shape SVGs when enabled", () => {
            addBackground({ backgroundColor: "#3366cc", shapes: { enabled: true } });
            const bg = document.getElementById("game-background")!;
            expect(bg.querySelectorAll("svg")).toHaveLength(20);
        });

        it("renders the requested shape count", () => {
            addBackground({
                backgroundColor: "#3366cc",
                shapes: { enabled: true, count: 7 },
            });
            const bg = document.getElementById("game-background")!;
            expect(bg.querySelectorAll("svg")).toHaveLength(7);
        });

        it("injects the float keyframes style once when animate is on (default)", () => {
            addBackground({
                backgroundColor: "#3366cc",
                shapes: { enabled: true, count: 3 },
            });
            expect(document.getElementById("drop-shape-animation")).not.toBeNull();
        });

        it("does not inject the animation style when animate is disabled", () => {
            addBackground({
                backgroundColor: "#3366cc",
                shapes: { enabled: true, count: 3, animate: false },
            });
            expect(document.getElementById("drop-shape-animation")).toBeNull();
        });
    });

    describe("addDropBackground (backward-compat alias)", () => {
        it("is the same function reference as addBackground", () => {
            expect(addDropBackground).toBe(addBackground);
        });

        it("also creates the background element", () => {
            addDropBackground({ backgroundColor: "#000" });
            expect(document.getElementById("game-background")).not.toBeNull();
        });
    });
});
