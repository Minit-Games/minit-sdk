/**
 * Tests for the reward-icon module.
 *
 * The internal pure helpers (darkenColor / lightenColor / clusterIntoDenominations)
 * are not exported, so they are exercised through the public spawnReward /
 * spawnRewards surface:
 *   - darkenColor is observable via the rendered circle's border color.
 *   - lightenColor only feeds the `background` gradient shorthand, which jsdom's
 *     cssstyle drops (stored as ""), so it runs (covered) but cannot be asserted.
 *   - clusterIntoDenominations is observed via the number of spawned icons.
 *
 * spawnReward appends its element synchronously (before the rAF animation), so
 * element assertions need no timer advancement. Fake timers keep the deferred
 * animation timers from firing (which would eventually remove the element) and
 * let the spawnRewards stagger setTimeouts be advanced deterministically.
 *
 * `stylesInjected` is module-scoped, so each test resets the registry and
 * re-imports via dynamic import() — matching headerPanel.test.ts.
 */

const START = { x: 0, y: 0 };
const TARGET = { x: 100, y: 100 };

describe("reward", () => {
    beforeEach(() => {
        jest.resetModules();
        jest.useFakeTimers();
        document.head.innerHTML = "";
        document.body.innerHTML = "";
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    describe("spawnReward — element creation", () => {
        it("appends a .drop-reward-icon element to document.body by default", async () => {
            const { spawnReward } = await import("./reward");
            spawnReward({ start: START, target: TARGET });
            const el = document.querySelector(".drop-reward-icon");
            expect(el).not.toBeNull();
            expect(el!.parentElement).toBe(document.body);
        });

        it("positions and sizes the element from start + size", async () => {
            const { spawnReward } = await import("./reward");
            spawnReward({ start: { x: 12, y: 34 }, target: TARGET, size: 80 });
            const el = document.querySelector(".drop-reward-icon") as HTMLElement;
            expect(el.style.left).toBe("12px");
            expect(el.style.top).toBe("34px");
            expect(el.style.width).toBe("80px");
            expect(el.style.height).toBe("80px");
        });

        it("applies scale to the base size", async () => {
            const { spawnReward } = await import("./reward");
            spawnReward({ start: START, target: TARGET, size: 40, scale: 2 });
            const el = document.querySelector(".drop-reward-icon") as HTMLElement;
            expect(el.style.width).toBe("80px");
        });

        it("uses the provided zIndex", async () => {
            const { spawnReward } = await import("./reward");
            spawnReward({ start: START, target: TARGET, zIndex: 42 });
            const el = document.querySelector(".drop-reward-icon") as HTMLElement;
            expect(el.style.zIndex).toBe("42");
        });

        it("appends into a custom container and adds the in-container class", async () => {
            const { spawnReward } = await import("./reward");
            const container = document.createElement("div");
            document.body.appendChild(container);

            spawnReward({ start: START, target: TARGET, container });

            const el = container.querySelector(".drop-reward-icon");
            expect(el).not.toBeNull();
            expect(el!.classList.contains("in-container")).toBe(true);
        });
    });

    describe("spawnReward — visual branches", () => {
        it("renders an emoji span with the emoji text", async () => {
            const { spawnReward } = await import("./reward");
            spawnReward({
                visual: { type: "emoji", emoji: "🍎" },
                start: START,
                target: TARGET,
            });
            const span = document.querySelector(".reward-emoji");
            expect(span).not.toBeNull();
            expect(span!.tagName).toBe("SPAN");
            expect(span!.textContent).toBe("🍎");
        });

        it("renders an <img> for the image visual", async () => {
            const { spawnReward } = await import("./reward");
            spawnReward({
                visual: { type: "image", src: "coin.png" },
                start: START,
                target: TARGET,
            });
            const img = document.querySelector("img.reward-image") as HTMLImageElement;
            expect(img).not.toBeNull();
            expect(img.getAttribute("src")).toBe("coin.png");
        });

        it("renders a circle by default (no visual given)", async () => {
            const { spawnReward } = await import("./reward");
            spawnReward({ start: START, target: TARGET });
            expect(document.querySelector(".reward-circle")).not.toBeNull();
        });

        // darkenColor(color, 0.35) is observable via the circle's border color.
        it.each([
            ["#808080", "#272727"], // mid grey → darkened
            ["#0000c8", "#00006f"], // exercises padStart with leading zeros
            ["#000000", "#000000"], // clamps to zero, stays black
        ])(
            "sets the circle border via darkenColor for %s",
            async (input, expectedBorder) => {
                const { spawnReward } = await import("./reward");
                spawnReward({
                    visual: { type: "color", color: input },
                    start: START,
                    target: TARGET,
                });
                const circle = document.querySelector(".reward-circle") as HTMLElement;
                expect(circle.style.borderColor).toBe(expectedBorder);
            }
        );
    });

    describe("spawnReward — style injection", () => {
        it("injects the reward styles once on first spawn", async () => {
            const { spawnReward } = await import("./reward");
            spawnReward({ start: START, target: TARGET });
            expect(document.getElementById("drop-reward-icon-styles")).not.toBeNull();
        });

        it("does not inject a second style element on repeated spawns", async () => {
            const { spawnReward } = await import("./reward");
            spawnReward({ start: START, target: TARGET });
            spawnReward({ start: START, target: TARGET });
            spawnReward({ start: START, target: TARGET });
            expect(
                document.querySelectorAll("style#drop-reward-icon-styles")
            ).toHaveLength(1);
        });
    });

    describe("spawnRewards — clustering into denominations", () => {
        // staggerMs=1 keeps all outer spawn timers within a few ms; advancing 20ms
        // fires them all but stays well under the ~600ms animation-removal chain.
        function countAfterSpawn(
            spawn: (count: number, opts: any, stagger?: number) => void,
            count: number
        ): number {
            spawn(count, { start: START, target: TARGET, size: 50 }, 1);
            jest.advanceTimersByTime(20);
            return document.querySelectorAll(".drop-reward-icon").length;
        }

        it("spawns one icon per point when count <= 5", async () => {
            const { spawnRewards } = await import("./reward");
            expect(countAfterSpawn(spawnRewards, 3)).toBe(3);
        });

        it("spawns exactly 5 icons when count is 5", async () => {
            const { spawnRewards } = await import("./reward");
            expect(countAfterSpawn(spawnRewards, 5)).toBe(5);
        });

        it("clusters count=6 into two icons (5 + 1)", async () => {
            const { spawnRewards } = await import("./reward");
            expect(countAfterSpawn(spawnRewards, 6)).toBe(2);
        });

        it("clusters count=130 into two icons (125 + 5)", async () => {
            const { spawnRewards } = await import("./reward");
            expect(countAfterSpawn(spawnRewards, 130)).toBe(2);
        });

        it("caps very large counts at 5 icons", async () => {
            const { spawnRewards } = await import("./reward");
            expect(countAfterSpawn(spawnRewards, 1000)).toBe(5);
        });
    });
});
