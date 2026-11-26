import { TextEncoder as NodeTextEncoder } from "node:util";

// jsdom lacks TextEncoder; track() byte-counts payloads.
if (typeof (globalThis as { TextEncoder?: unknown }).TextEncoder === "undefined") {
    (globalThis as { TextEncoder?: unknown }).TextEncoder =
        NodeTextEncoder as unknown as typeof globalThis.TextEncoder;
}

const PANEL_SELECTOR = "#minit-track-dev-panel";

function installHost(): void {
    window.minit = {
        environment: "app",
        dropConfig: {},
        reportResult: () => {},
        loadingDone: () => {},
        track: () => {},
    } as never;
}

async function loadSdk() {
    jest.resetModules();
    const { track } = await import("./track");
    const { loadingDone } = await import("./loadingDone");
    const { recordTrackedEvent, recordTrackedDrop, getTrackedEntries } = await import("./trackDevBuffer");
    const { showTrackDevPanel } = await import("./trackDevPanel");
    const { reportResult } = await import("./result");
    return { track, loadingDone, reportResult, recordTrackedEvent, recordTrackedDrop, getTrackedEntries, showTrackDevPanel };
}

// The SDK imports the panel lazily, so a mount triggered by track() lands a few microtasks later.
function flushPanelLoad(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

function panels(): Element[] {
    return Array.from(document.querySelectorAll(PANEL_SELECTOR));
}

function rows(kind?: "event" | "drop"): Element[] {
    const panel = document.querySelector(PANEL_SELECTOR);
    if (!panel) {
        return [];
    }
    const selector = kind ? `[data-kind="${kind}"]` : "[data-kind]";
    return Array.from(panel.querySelectorAll(selector));
}

function hoverDetail(row: Element): string {
    row.dispatchEvent(new MouseEvent("mouseenter"));
    return document.querySelector("#minit-track-dev-detail")?.textContent ?? "";
}

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
    const element = document.getElementById(id);
    if (!element) {
        throw new Error(`#${id} is not mounted`);
    }
    return element as T;
}

const launcher = () => byId<HTMLButtonElement>("minit-dev-launcher");
const tools = () => byId("minit-dev-tools");
const detail = () => byId("minit-track-dev-detail");
const replay = () => byId("minit-dev-replay");
const replayButton = () => replay().querySelector("button")!;

function ctrlM(init: KeyboardEventInit = {}): KeyboardEvent {
    const event = new KeyboardEvent("keydown", { key: "m", ctrlKey: true, bubbles: true, cancelable: true, ...init });
    window.dispatchEvent(event);
    return event;
}

function usageIndicator(): HTMLElement {
    const indicator = Array.from(tools().querySelectorAll<HTMLElement>("span[tabindex]")).find((span) =>
        /^\d+ \/ 3072 bytes$/.test(span.textContent ?? ""),
    );
    if (!indicator) {
        throw new Error("no usage indicator");
    }
    return indicator;
}

function usageText(): HTMLElement {
    return usageIndicator().lastElementChild as HTMLElement;
}

async function reportAndFlush(report: () => void): Promise<void> {
    report();
    await flushPanelLoad();
}

function toolButton(text: string): HTMLButtonElement {
    const button = Array.from(tools().querySelectorAll("button")).find((candidate) => candidate.textContent === text);
    if (!button) {
        throw new Error(`no "${text}" button`);
    }
    return button;
}

function tabs(): HTMLElement[] {
    return Array.from(tools().querySelectorAll<HTMLElement>('[role="tab"]'));
}

function countBadge(): string {
    return tabs()[1].querySelector("span")?.textContent ?? "";
}

function isOpen(): boolean {
    return tools().style.display === "flex";
}

function rowParts(row: Element): string[] {
    return Array.from(row.children).map((child) => child.textContent ?? "");
}

// jsdom has no layout; offsets follow the inline position like a fixed element would.
function followInlinePosition(element: HTMLElement): void {
    Object.defineProperty(element, "offsetLeft", { configurable: true, get: () => parseFloat(element.style.left) });
    Object.defineProperty(element, "offsetTop", { configurable: true, get: () => parseFloat(element.style.top) });
}

// jsdom has no PointerEvent constructor.
function pointer(type: string, x: number, y: number, pointerId = 1): MouseEvent {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
    Object.defineProperty(event, "pointerId", { value: pointerId });
    return event;
}

function dragLauncher(dx: number, dy: number): void {
    const target = launcher();
    target.dispatchEvent(pointer("pointerdown", 100, 100));
    target.dispatchEvent(pointer("pointermove", 100 + dx, 100 + dy));
    target.dispatchEvent(pointer("pointerup", 100 + dx, 100 + dy));
    target.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
}

function launcherPosition(): { left: string; top: string } {
    return { left: launcher().style.left, top: launcher().style.top };
}

async function mountPanel() {
    const sdk = await loadSdk();
    sdk.showTrackDevPanel();
    return sdk;
}

let now = 1000;

beforeEach(() => {
    localStorage.clear();
    now = 1000;
    jest.spyOn(performance, "now").mockImplementation(() => now);
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
    jest.useRealTimers();
    delete window.minit;
    document.body.innerHTML = "";
    jest.restoreAllMocks();
});

describe("track dev panel", () => {
    it("never renders while a host is present", async () => {
        installHost();
        const { track, loadingDone, showTrackDevPanel } = await loadSdk();

        track("level_start", { level: 1 });
        track("minit.reserved");
        loadingDone();
        showTrackDevPanel();
        await flushPanelLoad();

        expect(panels()).toHaveLength(0);
    });

    it("mounts on the first tracked event in dev mode and lists events newest first", async () => {
        const { track } = await loadSdk();

        now = 1111;
        track("level_start", { level: 3 });
        now = 2222;
        track("coin_pickup", { value: "gold" });
        now = 3333;
        track("boss_defeated", { flawless: true });
        await flushPanelLoad();

        expect(panels()).toHaveLength(1);
        const eventRows = rows("event");
        expect(eventRows).toHaveLength(3);
        const texts = eventRows.map((row) => row.textContent ?? "");

        expect(texts[0]).toContain("boss_defeated");
        expect(texts[0]).toContain("3.33s");
        expect(hoverDetail(eventRows[0])).toContain("flawless: true");

        expect(texts[1]).toContain("coin_pickup");
        expect(texts[1]).toContain("2.22s");
        expect(hoverDetail(eventRows[1])).toContain('value: "gold"');

        expect(texts[2]).toContain("level_start");
        expect(texts[2]).toContain("1.11s");
        expect(hoverDetail(eventRows[2])).toContain("level: 3");
    });

    it("shows drop warnings with their reason", async () => {
        const { track } = await loadSdk();

        now = 1000;
        track("minit.sneaky");
        now = 2000;
        track("lvl", { "": 1 });
        await flushPanelLoad();

        const dropRows = rows("drop");
        expect(dropRows).toHaveLength(2);
        expect(dropRows[0].textContent).toContain("lvl");
        expect(hoverDetail(dropRows[0])).toContain("reason: invalid property key");
        expect(dropRows[1].textContent).toContain("minit.sneaky");
        expect(hoverDetail(dropRows[1])).toContain("reason: reserved minit. prefix");
    });

    it("is idempotent and renders entries buffered before it was shown", async () => {
        const { recordTrackedEvent, showTrackDevPanel, track } = await loadSdk();

        now = 1500;
        recordTrackedEvent("early_event", { a: 1 });
        showTrackDevPanel();
        showTrackDevPanel();

        expect(panels()).toHaveLength(1);
        expect(rows("event")).toHaveLength(1);
        expect(rows("event")[0].textContent).toContain("early_event");

        now = 2500;
        track("later_event");

        expect(panels()).toHaveLength(1);
        const eventRows = rows("event");
        expect(eventRows).toHaveLength(2);
        expect(eventRows[0].textContent).toContain("later_event");
        expect(eventRows[1].textContent).toContain("early_event");
    });
});

describe("dev tools launcher", () => {
    it("mounts once, closed, at the lower-right corner", async () => {
        const { showTrackDevPanel } = await mountPanel();
        showTrackDevPanel();

        expect(document.querySelectorAll("#minit-dev-launcher")).toHaveLength(1);
        expect(document.querySelectorAll("#minit-dev-tools")).toHaveLength(1);
        expect(launcherPosition()).toEqual({
            left: `${window.innerWidth - 48 - 12}px`,
            top: `${window.innerHeight - 48 - 12}px`,
        });
        expect(launcher().getAttribute("aria-expanded")).toBe("false");
        expect(isOpen()).toBe(false);
    });

    it("never mounts while a host is present", async () => {
        installHost();
        await mountPanel();

        expect(document.getElementById("minit-dev-launcher")).toBeNull();
        expect(document.getElementById("minit-dev-tools")).toBeNull();
    });

    it("toggles the tools panel on tap", async () => {
        await mountPanel();

        launcher().click();
        expect(isOpen()).toBe(true);
        expect(launcher().getAttribute("aria-expanded")).toBe("true");

        launcher().click();
        expect(isOpen()).toBe(false);
        expect(launcher().getAttribute("aria-expanded")).toBe("false");
    });

    it("is a native button, so Enter and Space activate the same toggle", async () => {
        await mountPanel();

        expect(launcher().tagName).toBe("BUTTON");
        expect(launcher().type).toBe("button");
        launcher().dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 }));
        expect(isOpen()).toBe(true);
    });

    it("toggles with Ctrl+M and hides the detail popup on close", async () => {
        const { recordTrackedEvent } = await mountPanel();
        recordTrackedEvent("level_start", {});

        const opening = ctrlM();
        expect(opening.defaultPrevented).toBe(true);
        expect(isOpen()).toBe(true);
        hoverDetail(rows()[0]);
        expect(detail().style.display).toBe("block");

        ctrlM({ key: "M" });

        expect(isOpen()).toBe(false);
        expect(launcher().getAttribute("aria-expanded")).toBe("false");
        expect(detail().style.display).toBe("none");
    });

    it("ignores m with other modifiers or without Ctrl", async () => {
        await mountPanel();

        ctrlM({ ctrlKey: false });
        ctrlM({ altKey: true });
        ctrlM({ shiftKey: true });
        ctrlM({ metaKey: true });

        expect(isOpen()).toBe(false);
    });

    it("shows the replay button only while open, and closes the panel and reloads on click", async () => {
        await mountPanel();
        const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
        expect(replay().style.display).toBe("none");

        launcher().click();
        expect(replay().style.display).toBe("flex");

        replayButton().click();
        // jsdom cannot stub location.reload; its unimplemented-navigation report proves the call.
        expect(String(consoleError.mock.calls[0]?.[0])).toContain("navigation");

        expect(isOpen()).toBe(false);
        expect(replay().style.display).toBe("none");
    });

    it("restores the open state and size after a remount", async () => {
        await mountPanel();
        launcher().click();
        tools().style.width = "333px";
        tools().style.height = "222px";
        launcher().click();
        launcher().click();
        document.body.innerHTML = "";

        await mountPanel();

        expect(isOpen()).toBe(true);
        expect(tools().style.width).toBe("333px");
        expect(tools().style.height).toBe("222px");
    });

    it("restores the launcher position after a remount", async () => {
        await mountPanel();
        followInlinePosition(launcher());
        dragLauncher(-60, -40);
        const moved = launcherPosition();
        document.body.innerHTML = "";

        await mountPanel();

        expect(launcherPosition()).toEqual(moved);
    });
});

describe("dev tools launcher drag", () => {
    it("moves past the threshold without toggling the panel", async () => {
        await mountPanel();
        followInlinePosition(launcher());

        dragLauncher(-300, -200);

        expect(launcherPosition()).toEqual({
            left: `${window.innerWidth - 60 - 300}px`,
            top: `${window.innerHeight - 60 - 200}px`,
        });
        expect(isOpen()).toBe(false);
    });

    it("clamps the launcher inside the viewport", async () => {
        await mountPanel();
        followInlinePosition(launcher());

        dragLauncher(-5000, -5000);
        expect(launcherPosition()).toEqual({ left: "12px", top: "12px" });

        dragLauncher(5000, 5000);
        expect(launcherPosition()).toEqual({
            left: `${window.innerWidth - 60}px`,
            top: `${window.innerHeight - 60}px`,
        });
    });

    it("treats a move below the threshold as a tap", async () => {
        await mountPanel();
        followInlinePosition(launcher());
        const before = launcherPosition();

        dragLauncher(3, 3);

        expect(launcherPosition()).toEqual(before);
        expect(isOpen()).toBe(true);
    });

    it("still toggles on a tap after a drag", async () => {
        await mountPanel();
        followInlinePosition(launcher());

        dragLauncher(-100, -100);
        launcher().click();

        expect(isOpen()).toBe(true);
    });

    it("toggles on the next click after a drag cancelled without a click", async () => {
        await mountPanel();
        followInlinePosition(launcher());

        launcher().dispatchEvent(pointer("pointerdown", 100, 100));
        launcher().dispatchEvent(pointer("pointermove", 50, 50));
        launcher().dispatchEvent(pointer("pointercancel", 50, 50));
        launcher().dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));

        expect(isOpen()).toBe(true);
    });

    it("toggles on keyboard activation after a drag that ended without a click", async () => {
        await mountPanel();
        followInlinePosition(launcher());

        launcher().dispatchEvent(pointer("pointerdown", 100, 100));
        launcher().dispatchEvent(pointer("pointermove", 50, 50));
        launcher().dispatchEvent(pointer("pointerup", 50, 50));
        launcher().dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 }));

        expect(isOpen()).toBe(true);
    });

    it("ignores moves of another pointer", async () => {
        await mountPanel();
        followInlinePosition(launcher());
        const before = launcherPosition();

        launcher().dispatchEvent(pointer("pointerdown", 100, 100, 1));
        launcher().dispatchEvent(pointer("pointermove", 400, 400, 2));

        expect(launcherPosition()).toEqual(before);
    });

    it("keeps pointer and click events from reaching the game", async () => {
        const { recordTrackedEvent } = await mountPanel();
        recordTrackedEvent("level_start", {});
        launcher().click();
        const seen: string[] = [];
        const listener = (event: Event) => seen.push(event.type);
        for (const type of ["pointerdown", "pointermove", "pointerup", "click"]) {
            document.addEventListener(type, listener);
        }

        dragLauncher(-50, -50);
        const row = rows()[0];
        row.dispatchEvent(pointer("pointerdown", 0, 0));
        row.dispatchEvent(pointer("pointerup", 0, 0));
        row.dispatchEvent(new MouseEvent("click", { bubbles: true }));

        for (const type of ["pointerdown", "pointermove", "pointerup", "click"]) {
            document.removeEventListener(type, listener);
        }
        expect(seen).toEqual([]);
    });
});

describe("dev tools panel", () => {
    it("shows the Minit SDK header and the Config, Tracking, Result, User data and Suggestions tabs", async () => {
        await mountPanel();

        expect(tools().getAttribute("aria-label")).toBe("Minit SDK");
        expect(tools().textContent).toContain("Minit SDK");
        expect(tabs().map((tab) => tab.firstChild?.textContent)).toEqual(["Config", "Tracking", "Result", "User data", "Suggestions"]);
        expect(tabs()[0].getAttribute("aria-selected")).toBe("true");
        expect(countBadge()).toBe("0");
    });

    it("counts entries in the tab badge as they arrive", async () => {
        const { recordTrackedEvent, track } = await loadSdk();
        recordTrackedEvent("early_event", {});
        track("level_start");
        await flushPanelLoad();
        expect(countBadge()).toBe("2");

        track("");
        expect(countBadge()).toBe("3");
    });

    it("lists rows newest first with the time in seconds and marks drops", async () => {
        const { track } = await loadSdk();

        now = 3420;
        track("level_start");
        now = 12345;
        track("bad", { v: NaN });
        await flushPanelLoad();

        expect(rows().map(rowParts)).toEqual([
            ["⚠ dropped bad", "12.35s"],
            ["level_start", "3.42s"],
        ]);
        expect(rows()[0].getAttribute("data-kind")).toBe("drop");
        expect(rows()[1].getAttribute("data-kind")).toBe("event");
    });

    it("shows a row for every dropped call while warning once per reason", async () => {
        const { track } = await loadSdk();

        for (let i = 0; i < 3; i++) {
            track(`big${i}`, { v: "x".repeat(4100) });
        }
        track("small");
        await flushPanelLoad();

        expect(rows("event")).toHaveLength(1);
        expect(rows("drop").map((row) => row.firstChild?.textContent)).toEqual([
            "⚠ dropped big2",
            "⚠ dropped big1",
            "⚠ dropped big0",
        ]);
        expect(console.warn).toHaveBeenCalledTimes(1);
    });

    it("shows at most MAX_DEV_ENTRIES rows, dropping the oldest", async () => {
        const { recordTrackedDrop } = await mountPanel();
        const { MAX_DEV_ENTRIES } = await import("./trackDevBuffer");

        for (let i = 0; i < MAX_DEV_ENTRIES + 2; i++) {
            recordTrackedDrop(`e${i}`, "budget");
        }

        const all = rows();
        expect(all).toHaveLength(MAX_DEV_ENTRIES);
        expect(all[0].firstChild?.textContent).toBe(`⚠ dropped e${MAX_DEV_ENTRIES + 1}`);
        expect(all[all.length - 1].firstChild?.textContent).toBe("⚠ dropped e2");
        expect(countBadge()).toBe(String(MAX_DEV_ENTRIES));
    });

    it("caps its height by the room above a launcher in the lower half", async () => {
        await mountPanel();
        jest.spyOn(launcher(), "getBoundingClientRect").mockReturnValue({
            left: 900,
            right: 948,
            top: 600,
            bottom: 648,
            width: 48,
            height: 48,
        } as DOMRect);

        launcher().click();

        expect(tools().style.maxHeight).toBe(`${600 - 8 - 12}px`);
        expect(tools().style.bottom).toBe(`${window.innerHeight - 600 + 8}px`);
    });

    it("caps its height by the room below a launcher in the upper half", async () => {
        await mountPanel();
        jest.spyOn(launcher(), "getBoundingClientRect").mockReturnValue({
            left: 12,
            right: 60,
            top: 300,
            bottom: 348,
            width: 48,
            height: 48,
        } as DOMRect);

        launcher().click();

        expect(tools().style.maxHeight).toBe(`${window.innerHeight - 348 - 8 - 12}px`);
        expect(tools().style.top).toBe(`${348 + 8}px`);
    });

    describe("horizontal anchoring on a narrow viewport", () => {
        const originalWidth = window.innerWidth;

        beforeEach(() => {
            Object.defineProperty(window, "innerWidth", { configurable: true, value: 375 });
        });

        afterEach(() => {
            Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth });
        });

        async function openWithLauncherAt(left: number) {
            await mountPanel();
            jest.spyOn(tools(), "getBoundingClientRect").mockReturnValue({ width: 300 } as DOMRect);
            jest.spyOn(launcher(), "getBoundingClientRect").mockReturnValue({
                left,
                right: left + 48,
                top: 600,
                bottom: 648,
                width: 48,
                height: 48,
            } as DOMRect);
            launcher().click();
        }

        it("keeps a left-anchored panel inside the viewport", async () => {
            await openWithLauncherAt(130);

            expect(tools().style.left).toBe(`${375 - 300 - 12}px`);
            expect(tools().style.right).toBe("");
        });

        it("aligns a right-anchored panel with the launcher's right edge", async () => {
            await openWithLauncherAt(300);

            expect(tools().style.left).toBe(`${300 + 48 - 300}px`);
        });

        it("keeps a right-anchored panel off the left edge", async () => {
            await openWithLauncherAt(200);

            expect(tools().style.left).toBe("12px");
        });
    });
});

describe("dev tools panel lazy loading", () => {
    afterEach(() => {
        jest.dontMock("./trackDevPanel");
    });

    async function loadWithPanelSpy() {
        jest.resetModules();
        const factory = jest.fn(() => ({ showTrackDevPanel: jest.fn() }));
        jest.doMock("./trackDevPanel", factory);
        const { track } = await import("./track");
        const { loadingDone } = await import("./loadingDone");
        const { reportResult } = await import("./result");
        return { factory, track, loadingDone, reportResult };
    }

    it("never loads the panel module while a host is present", async () => {
        installHost();
        const { factory, track, loadingDone, reportResult } = await loadWithPanelSpy();

        track("level_start", { level: 1 });
        track("");
        loadingDone();
        reportResult(10);
        await flushPanelLoad();

        expect(factory).not.toHaveBeenCalled();
    });

    it("loads the panel module only once dev mode needs it", async () => {
        const { factory, track } = await loadWithPanelSpy();
        expect(factory).not.toHaveBeenCalled();

        track("level_start");
        await flushPanelLoad();

        expect(factory).toHaveBeenCalledTimes(1);
    });

    it("mounts the panel after the lazy load from loadingDone()", async () => {
        const { loadingDone } = await loadSdk();

        loadingDone();
        expect(panels()).toHaveLength(0);
        await flushPanelLoad();

        expect(panels()).toHaveLength(1);
        expect(rows("event").map((row) => row.getAttribute("data-key"))).toEqual(["minit.loading_done"]);
    });
});

describe("dev tools detail popup", () => {
    it("shows the key and time in its header", async () => {
        const { recordTrackedEvent } = await mountPanel();
        now = 3420;
        recordTrackedEvent("level_start", { level: 2 });

        hoverDetail(rows()[0]);

        expect(rowParts(detail().children[0])).toEqual(["level_start", "3.42s"]);
    });

    it("lists properties as name: value", async () => {
        const { recordTrackedEvent } = await mountPanel();
        recordTrackedEvent("level_end", { level: 2, won: false, mode: "hard" });

        hoverDetail(rows()[0]);

        const lines = Array.from(detail().children).map((child) => child.textContent);
        const footer = Array.from(detail().lastElementChild?.children ?? []).map((child) => child.textContent);
        expect(lines.slice(1, 4)).toEqual(["level: 2", "won: false", 'mode: "hard"']);
        expect(footer).toEqual(["received: 1", "source: minit"]);
    });

    it("says when an event has no properties", async () => {
        const { recordTrackedEvent } = await mountPanel();
        recordTrackedEvent("level_start", {});

        expect(hoverDetail(rows()[0])).toContain("no properties");
    });

    it("marks accepted minit. events as built in", async () => {
        const { recordTrackedEvent } = await mountPanel();
        recordTrackedEvent("minit.loading_done", {});

        expect(hoverDetail(rows()[0])).toContain("source: built in");
    });

    it("marks a dropped minit. call as coming from minit", async () => {
        const { track } = await loadSdk();
        now = 2500;
        track("minit.sneaky");
        await flushPanelLoad();

        hoverDetail(rows()[0]);

        expect(rowParts(detail().children[0])).toEqual(["⚠ dropped minit.sneaky", "2.50s"]);
        expect(detail().textContent).toContain("source: minit");
        expect(detail().textContent).not.toContain("built in");
    });

    it.each([
        ["invalid-key", "invalid key"],
        ["reserved-key", "reserved minit. prefix"],
        ["invalid-props", "properties are not an object"],
        ["invalid-prop-key", "invalid property key"],
        ["invalid-prop-value", "invalid property value"],
    ] as const)("explains the %s drop reason", async (reason, text) => {
        const { recordTrackedDrop, showTrackDevPanel } = await loadSdk();
        recordTrackedDrop("some_key", reason);
        showTrackDevPanel();

        hoverDetail(rows("drop")[0]);

        const lines = Array.from(detail().children).map((child) => child.textContent);
        expect(lines.slice(1)).toEqual([`reason: ${text}`, "source: minit"]);
    });

    it("hides shortly after the mouse leaves the row", async () => {
        const { recordTrackedEvent } = await mountPanel();
        recordTrackedEvent("level_start", {});
        const row = rows()[0];
        jest.useFakeTimers({ doNotFake: ["performance"] });

        hoverDetail(row);
        expect(detail().style.display).toBe("block");
        row.dispatchEvent(new MouseEvent("mouseleave"));
        expect(detail().style.display).toBe("block");

        jest.advanceTimersByTime(150);
        expect(detail().style.display).toBe("none");
    });

    it("stays open while the pointer is over it and hides after it leaves", async () => {
        const { recordTrackedEvent } = await mountPanel();
        recordTrackedEvent("level_start", {});
        const row = rows()[0];
        jest.useFakeTimers({ doNotFake: ["performance"] });

        hoverDetail(row);
        row.dispatchEvent(new MouseEvent("mouseleave"));
        detail().dispatchEvent(new MouseEvent("mouseenter"));
        jest.advanceTimersByTime(1000);
        expect(detail().style.display).toBe("block");

        detail().dispatchEvent(new MouseEvent("mouseleave"));
        jest.advanceTimersByTime(150);
        expect(detail().style.display).toBe("none");
    });

    it("is bounded to the viewport, scrollable and accepts pointer input", async () => {
        await mountPanel();

        expect(detail().style.maxHeight).toBe("calc(100vh - 24px)");
        expect(detail().style.overflowY).toBe("auto");
        expect(detail().style.pointerEvents).toBe("");
    });

    it("takes keyboard focus from its row on Enter and stays open while focused", async () => {
        const { recordTrackedEvent } = await mountPanel();
        recordTrackedEvent("level_end", { level: 2 });
        const row = rows()[0] as HTMLElement;
        jest.useFakeTimers({ doNotFake: ["performance"] });

        row.focus();
        row.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

        expect(detail().tabIndex).toBe(0);
        expect(document.activeElement).toBe(detail());
        expect(detail().style.display).toBe("block");
        row.dispatchEvent(new MouseEvent("mouseleave"));
        jest.advanceTimersByTime(1000);
        expect(detail().style.display).toBe("block");

        detail().blur();
        expect(detail().style.display).toBe("none");
    });

    it("shows on keyboard focus of a row and hides on blur", async () => {
        const { recordTrackedEvent } = await mountPanel();
        recordTrackedEvent("level_end", { level: 2 });
        const row = rows()[0] as HTMLElement;

        expect(row.tabIndex).toBe(0);
        expect(row.getAttribute("aria-describedby")).toBe(detail().id);
        expect(detail().getAttribute("role")).toBe("tooltip");

        row.focus();
        expect(document.activeElement).toBe(row);
        expect(detail().style.display).toBe("block");
        expect(detail().textContent).toContain("level: 2");

        row.blur();
        expect(detail().style.display).toBe("none");
    });
});

describe("dev tools detail popup size and received count", () => {
    it("shows the size for creator events and counts accepted events per key", async () => {
        const { track } = await loadSdk();
        track("coin", { v: 1 });
        now += 200;
        track("coin", { v: 2 });
        await flushPanelLoad();

        const expectedSize = new NodeTextEncoder().encode(JSON.stringify(["coin", { v: 2 }, 1200])).length;
        const text = hoverDetail(rows()[0]);
        expect(text).toContain(`size: ${expectedSize} B`);
        expect(text).toContain("received: 2");
    });

    it("shows the result, stars and flavor text of minit.result", async () => {
        const { reportResult } = await mountPanel();
        reportResult(42, { flavorText: "Nice run", delay: 10_000 });

        const text = hoverDetail(rows()[0]);

        expect(text).toContain("result: 42");
        expect(text).toContain("stars: 3");
        expect(text).toContain('flavorText: "Nice run"');
    });

    it("omits the size for built-in events", async () => {
        const { recordTrackedEvent } = await mountPanel();
        recordTrackedEvent("minit.loading_done", {});

        const text = hoverDetail(rows()[0]);

        expect(text).not.toContain("size:");
        expect(text).toContain("received: 1");
    });

    it.each([
        ["budget", "over the 3072-byte event budget for this play"],
        ["after-result", "sent after reportResult()"],
    ] as const)("explains the %s drop reason", async (reason, text) => {
        const { recordTrackedDrop, showTrackDevPanel } = await loadSdk();
        recordTrackedDrop("some_key", reason);
        showTrackDevPanel();

        expect(hoverDetail(rows("drop")[0])).toContain(`reason: ${text}`);
    });
});

describe("dev tools usage indicator", () => {
    const RGB = { ink: "rgb(151, 162, 189)", warn: "rgb(229, 184, 76)", neg: "rgb(224, 108, 108)" };

    it("shows the budget used as used / 3072 bytes", async () => {
        const { recordTrackedEvent } = await mountPanel();
        expect(usageIndicator().textContent).toBe("0 / 3072 bytes");

        recordTrackedEvent("a", {}, 100);
        recordTrackedEvent("b", {}, 1024);

        expect(usageIndicator().textContent).toBe("1124 / 3072 bytes");
        expect(usageText().style.color).toBe(RGB.ink);
    });

    it("does not count built-in events toward the budget", async () => {
        const { loadingDone, reportResult } = await mountPanel();

        loadingDone();
        reportResult(1);

        expect(usageIndicator().textContent).toBe("0 / 3072 bytes");
    });

    it("turns warn at 80% and neg at the budget", async () => {
        const { recordTrackedEvent } = await mountPanel();

        recordTrackedEvent("a", {}, Math.ceil(3072 * 0.8));
        expect(usageText().style.color).toBe(RGB.warn);

        recordTrackedEvent("b", {}, 3072);
        expect(usageText().style.color).toBe(RGB.neg);
    });

    it("turns neg after a budget drop", async () => {
        const { recordTrackedEvent, recordTrackedDrop } = await mountPanel();
        recordTrackedEvent("a", {}, 10);

        recordTrackedDrop("b", "budget");

        expect(usageText().style.color).toBe(RGB.neg);
    });

    it("shows the Event budget detail on hover and on focus", async () => {
        await mountPanel();

        usageIndicator().dispatchEvent(new MouseEvent("mouseenter"));
        expect(detail().style.display).toBe("block");
        expect(detail().textContent).toContain("Event budget");

        usageIndicator().dispatchEvent(new MouseEvent("mouseleave"));
        usageIndicator().focus();
        expect(detail().style.display).toBe("block");
        expect(detail().textContent).toContain("Event budget");
    });
});

describe("dev tools Result tab", () => {
    it("shows a pending placeholder, then opens the panel on the Result tab once the result arrives", async () => {
        const { reportResult } = await mountPanel();
        expect(tabs()[2].querySelector("span")?.title).toBe("Result pending");
        expect(tools().textContent).toContain("No result received yet.");

        await reportAndFlush(() => reportResult(42));

        expect(isOpen()).toBe(true);
        expect(tabs()[2].getAttribute("aria-selected")).toBe("true");
        expect(tabs()[2].querySelector("span")?.title).toBe("Result received");
        expect(tabs()[2].querySelector("span")?.getAttribute("aria-label")).toBe("Result received");
    });

    it("shows the score, flavor text and play duration", async () => {
        const { reportResult } = await mountPanel();
        now = 2500;

        await reportAndFlush(() => reportResult(42, { flavorText: "Nice run" }));

        const card = tools().querySelector("[data-result]");
        expect(card?.textContent).toContain("42");
        expect(card?.textContent).toContain("Nice run");
        expect(card?.textContent).toContain("⏱ 2.50s");
    });

    it("shows the dev stars", async () => {
        const { reportResult } = await mountPanel();

        await reportAndFlush(() => reportResult(42));

        const stars = tools().querySelector<HTMLElement>("[data-result] [data-stars]");
        expect(stars?.dataset.stars).toBe("3");
        expect(stars?.getAttribute("aria-label")).toBe("3 of 3 stars");
    });

    it("omits the flavor text badge when none is given", async () => {
        const { reportResult } = await mountPanel();

        await reportAndFlush(() => reportResult("WIN"));

        const card = tools().querySelector("[data-result]");
        expect(card?.textContent).toContain("WIN");
        expect(card?.textContent).not.toContain("Flavor Text");
    });

    it("does not render the removed fullscreen result overlay", async () => {
        const { reportResult } = await mountPanel();

        await reportAndFlush(() => reportResult(1));

        expect(document.getElementById("dashboard-overlay")).toBeNull();
    });
});

describe("dev tools Config tab", () => {
    const configTab = () => tabs()[0];
    const configRows = () =>
        Array.from(tools().querySelectorAll<HTMLElement>("[data-config-key]:not([data-config-key='tutorial'])"));

    it("shows a placeholder until a config value is requested", async () => {
        await mountPanel();

        expect(tools().textContent).toContain("No config values requested yet.");
        expect(configTab().querySelector("span")?.textContent).toBe("0");
    });

    it("renders one row per key with value and source, counting distinct keys", async () => {
        await mountPanel();
        const { recordConfigRequest } = await import("./trackDevBuffer");

        recordConfigRequest({ key: "seed", value: "abc", source: "injected" });
        recordConfigRequest({ key: "mode", value: "", source: "default" });
        recordConfigRequest({ key: "gone", value: undefined, source: "missing" });
        recordConfigRequest({ key: "seed", value: "xyz", source: "injected" });

        expect(configRows().map((row) => Array.from(row.children).map((child) => child.textContent))).toEqual([
            ["injected", "seed", "xyz", "✎"],
            ["default", "mode", '""', "✎"],
            ["missing", "gone", "—", "✎"],
        ]);
        expect(configTab().querySelector("span")?.textContent).toBe("3");
    });
});

describe("dev tools tab persistence", () => {
    it("restores the selected tab after a remount", async () => {
        await mountPanel();
        tabs()[2].click();
        expect(tabs()[2].getAttribute("aria-selected")).toBe("true");
        document.body.innerHTML = "";

        await mountPanel();

        expect(tabs()[2].getAttribute("aria-selected")).toBe("true");
    });

    it("falls back to Tracking for an unknown saved tab", async () => {
        localStorage.setItem("minit-dev-tools-layout", JSON.stringify({ tab: "Nope" }));

        await mountPanel();

        expect(tabs()[0].getAttribute("aria-selected")).toBe("true");
    });
});

const GREEN = "rgb(79, 191, 134)";

function setUrl(search: string): void {
    window.history.replaceState({}, "", search ? `/?${search}` : "/");
}

function spyNavigation(): () => boolean {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    // jsdom cannot stub location.assign/reload; its unimplemented-navigation report proves the call.
    return () => consoleError.mock.calls.some((call) => String(call[0]).includes("navigation"));
}

function progressBar(label: string): HTMLElement {
    const bar = tools().querySelector<HTMLElement>(`[role="progressbar"][aria-label="${label}"]`);
    if (!bar) {
        throw new Error(`no "${label}" progress bar`);
    }
    return bar;
}

function switchNamed(label: string): HTMLButtonElement {
    const toggle = tools().querySelector<HTMLButtonElement>(`[role="switch"][aria-label="${label}"]`);
    if (!toggle) {
        throw new Error(`no "${label}" switch`);
    }
    return toggle;
}

function settingsButton(): HTMLButtonElement {
    return tools().querySelector<HTMLButtonElement>("[data-settings]")!;
}

function launcherAlert(): Element | null {
    return launcher().querySelector("[data-launcher-alert]");
}

describe("dev tools Tracking tab footer and notices", () => {
    const trackingPanel = () => byId(PANEL_SELECTOR.slice(1)).closest<HTMLElement>('[role="tabpanel"]')!;
    const dropNotice = () => trackingPanel().querySelector<HTMLElement>('[data-notice="error"]')!;

    it("reports the remaining event budget on the progress bar and indicator", async () => {
        const { recordTrackedEvent } = await mountPanel();
        expect(progressBar("Remaining event budget").getAttribute("aria-valuenow")).toBe("100");

        recordTrackedEvent("a", {}, 768);

        expect(progressBar("Remaining event budget").getAttribute("aria-valuenow")).toBe("75");
        expect(usageIndicator().textContent).toBe("768 / 3072 bytes");
    });

    it("shows the Minit Studio disclaimer", async () => {
        await mountPanel();

        expect(trackingPanel().querySelector('[data-notice="info"]')?.textContent).toBe(
            "Check out the tracked events for your games in Minit Studio!",
        );
    });

    it("has no drop notice or alerts while nothing was dropped", async () => {
        const { track } = await loadSdk();
        track("level_start");
        await flushPanelLoad();

        expect(dropNotice().style.display).toBe("none");
        expect(tabs()[1].querySelector("span")?.hasAttribute("data-alert")).toBe(false);
        expect(launcherAlert()).toBeNull();
    });

    it("lists dropped events by reason in a red notice and raises the tab and launcher alerts", async () => {
        const { track } = await loadSdk();
        track("bad", { v: NaN });
        await flushPanelLoad();

        expect(dropNotice().style.display).toBe("block");
        expect(Array.from(dropNotice().children).map((line) => line.textContent)).toEqual([
            "1 event was thrown away and never sent:",
            "1× invalid property value",
        ]);

        track("other", { v: null as unknown as string });
        track("minit.sneaky");

        expect(Array.from(dropNotice().children).map((line) => line.textContent)).toEqual([
            "3 events were thrown away and never sent:",
            "2× invalid property value",
            "1× reserved minit. prefix",
        ]);
        expect(tabs()[1].querySelector("span")?.hasAttribute("data-alert")).toBe(true);
        expect(launcherAlert()?.textContent).toBe("!");
        expect(launcher().getAttribute("aria-label")).toBe("Minit SDK tools — has errors");
    });
});

describe("dev tools Tracking row highlighting", () => {
    const marked = () => rows().map((row) => row.hasAttribute("data-same"));

    it("marks every row of the same kind and key on hover and clears it on leave", async () => {
        const { recordTrackedEvent, recordTrackedDrop } = await mountPanel();
        recordTrackedEvent("coin", {});
        recordTrackedEvent("jump", {});
        recordTrackedEvent("coin", {});
        recordTrackedDrop("coin", "budget");
        const [drop, coin] = rows();

        coin.dispatchEvent(new MouseEvent("mouseenter"));
        expect(marked()).toEqual([false, true, false, true]);

        coin.dispatchEvent(new MouseEvent("mouseleave"));
        expect(marked()).toEqual([false, false, false, false]);

        drop.dispatchEvent(new MouseEvent("mouseenter"));
        expect(marked()).toEqual([true, false, false, false]);
    });

    it("marks rows of the same type on focus and clears them on blur", async () => {
        const { recordTrackedEvent } = await mountPanel();
        recordTrackedEvent("coin", {});
        recordTrackedEvent("jump", {});
        recordTrackedEvent("coin", {});

        (rows()[0] as HTMLElement).focus();
        expect(marked()).toEqual([true, false, true]);

        (rows()[0] as HTMLElement).blur();
        expect(marked()).toEqual([false, false, false]);
    });
});

describe("dev tools Config tab tutorial row, editor and reset", () => {
    const configRows = () => Array.from(tools().querySelectorAll<HTMLElement>("[data-config-key]"));
    const editDialog = () => document.querySelector<HTMLElement>('[role="dialog"][aria-label="Edit config"]');
    const editButton = (index: number) => configRows()[index].querySelector<HTMLButtonElement>("[data-edit]")!;

    afterEach(() => {
        setUrl("");
    });

    async function mountWithConfig() {
        const sdk = await mountPanel();
        const { recordConfigRequest } = await import("./trackDevBuffer");
        recordConfigRequest({ key: "seed", value: "abc", source: "injected" });
        recordConfigRequest({ key: "mode", value: "easy", source: "default" });
        return sdk;
    }

    it("starts with the tutorial row whose switch is on for a first-time user", async () => {
        await mountWithConfig();

        expect(configRows().map((row) => row.dataset.configKey)).toEqual(["tutorial", "seed", "mode"]);
        expect(configRows()[0].contains(switchNamed("First-time user"))).toBe(true);
        expect(switchNamed("First-time user").getAttribute("aria-checked")).toBe("true");
    });

    it("turns the switch off when ?hasPlayedGame=true simulates a returning player", async () => {
        setUrl("hasPlayedGame=true");
        await mountPanel();

        expect(switchNamed("First-time user").getAttribute("aria-checked")).toBe("false");
    });

    it("reloads with new params when the tutorial switch is toggled", async () => {
        setUrl("hasPlayedGame=true&tutorial=1");
        await mountPanel();
        const navigated = spyNavigation();

        switchNamed("First-time user").click();

        expect(navigated()).toBe(true);
    });

    it("starts regular rows with the source pill and ends them with an edit button", async () => {
        await mountWithConfig();
        const seedRow = configRows()[1];

        expect(seedRow.firstElementChild?.textContent).toBe("injected");
        expect(seedRow.lastElementChild).toBe(editButton(1));
        expect(editButton(1).getAttribute("aria-label")).toBe("Edit seed");
    });

    it("opens the editor with one input per key and focuses the clicked one", async () => {
        await mountWithConfig();

        editButton(2).click();

        const dialog = editDialog();
        expect(dialog).not.toBeNull();
        const inputs = Array.from(dialog!.querySelectorAll("input"));
        expect(inputs.map((input) => input.previousElementSibling?.textContent)).toEqual(["seed", "mode"]);
        expect(inputs[0].value).toBe("abc");
        expect(inputs[1].value).toBe("");
        expect(inputs[1].placeholder).toBe("default: easy");
        expect(document.activeElement).toBe(inputs[1]);
    });

    it("closes the editor on Escape", async () => {
        await mountWithConfig();
        editButton(1).click();

        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

        expect(editDialog()).toBeNull();
    });

    it("stays open when a press inside the dialog ends on the backdrop, and closes on a backdrop click", async () => {
        await mountWithConfig();
        editButton(1).click();
        const backdrop = editDialog()!;
        const form = backdrop.querySelector("form")!;

        form.dispatchEvent(pointer("pointerdown", 0, 0));
        backdrop.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        expect(editDialog()).not.toBeNull();

        backdrop.dispatchEvent(pointer("pointerdown", 0, 0));
        backdrop.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        expect(editDialog()).toBeNull();
    });

    it("reloads with the edited values on Apply & reload", async () => {
        await mountWithConfig();
        editButton(1).click();
        const navigated = spyNavigation();
        const apply = Array.from(editDialog()!.querySelectorAll("button")).find(
            (button) => button.textContent === "Apply & reload",
        )!;

        apply.click();

        expect(navigated()).toBe(true);
    });

    it("disables Reset to defaults when only userData is in the URL", async () => {
        setUrl("userData=abc");
        await mountPanel();

        const reset = tools().querySelector<HTMLButtonElement>("[data-config-reset]")!;
        expect(reset.textContent).toBe("Reset to defaults");
        expect(reset.disabled).toBe(true);
    });

    it("enables Reset to defaults for injected params and reloads on click", async () => {
        setUrl("seed=abc&userData=abc");
        await mountPanel();
        const navigated = spyNavigation();

        const reset = tools().querySelector<HTMLButtonElement>("[data-config-reset]")!;
        expect(reset.disabled).toBe(false);
        reset.click();

        expect(navigated()).toBe(true);
    });
});

describe("dev tools Result tab userData button and auto-open", () => {
    it.each([
        ["received", "abc"],
        ["none", undefined],
        ["too-big", "x".repeat(1025)],
    ] as const)("marks the userData button as %s", async (state, userData) => {
        const { reportResult } = await mountPanel();

        await reportAndFlush(() => reportResult(1, { userData }));

        expect(tools().querySelector("[data-user-data]")?.getAttribute("data-user-data")).toBe(state);
    });

    it("switches to the User data tab when the userData button is clicked", async () => {
        const { reportResult } = await mountPanel();
        await reportAndFlush(() => reportResult(1, { userData: "abc" }));

        tools().querySelector<HTMLButtonElement>("[data-user-data]")!.click();

        expect(tabs()[3].getAttribute("aria-selected")).toBe("true");
        expect(tabs()[2].getAttribute("aria-selected")).toBe("false");
    });

    it("stays closed on a result when Open on result is turned off", async () => {
        localStorage.setItem("minit-dev-tools-settings", JSON.stringify({ autoOpenOnResult: false }));
        const { reportResult } = await mountPanel();

        await reportAndFlush(() => reportResult(42));

        expect(isOpen()).toBe(false);
        expect(tabs()[2].getAttribute("aria-selected")).toBe("false");
    });
});

describe("dev tools User data tab", () => {
    const editor = () => tools().querySelector<HTMLTextAreaElement>("[data-user-data-input]")!;
    const userDataPanel = () => editor().closest<HTMLElement>('[role="tabpanel"]')!;
    const notice = () => userDataPanel().querySelector<HTMLElement>("[data-notice]")!;
    const tabBadge = () => tabs()[3].querySelector<HTMLElement>("span")!;

    afterEach(() => {
        setUrl("");
    });

    it("shows an empty editor when no user data is loaded", async () => {
        await mountPanel();

        expect(editor().value).toBe("");
        expect(editor().placeholder).toBe("No user data yet. Type or paste it here.");
        expect(progressBar("Remaining user data size").getAttribute("aria-valuenow")).toBe("100");
    });

    it("shows ?userData verbatim", async () => {
        setUrl(`userData=${encodeURIComponent('{"level":3}')}`);
        await mountPanel();

        expect(editor().value).toBe('{"level":3}');
        expect(notice().style.display).toBe("none");
    });

    it("switches to the reported value after reportResult() with a success notice", async () => {
        setUrl("userData=old");
        const { reportResult } = await mountPanel();

        await reportAndFlush(() => reportResult(1, { userData: "new" }));

        expect(editor().value).toBe("new");
        expect(notice().style.display).toBe("block");
        expect(notice().dataset.notice).toBe("success");
        expect(notice().firstElementChild?.textContent).toBe("User data updated");
    });

    it("keeps the loaded value when the result reports no userData", async () => {
        setUrl("userData=old");
        const { reportResult } = await mountPanel();

        await reportAndFlush(() => reportResult(1));

        expect(editor().value).toBe("old");
        expect(notice().style.display).toBe("none");
    });

    it("reflects the size on the progress bar", async () => {
        const { reportResult } = await mountPanel();

        await reportAndFlush(() => reportResult(1, { userData: "x".repeat(512) }));

        expect(progressBar("Remaining user data size").getAttribute("aria-valuenow")).toBe("50");
    });

    it("flags reported user data over 1024 bytes with a notice and both alert badges", async () => {
        const { reportResult } = await mountPanel();
        expect(tabBadge().style.display).toBe("none");

        await reportAndFlush(() => reportResult(1, { userData: "x".repeat(1025) }));

        expect(notice().style.display).toBe("block");
        expect(notice().dataset.notice).toBe("error");
        expect(notice().firstElementChild?.textContent).toBe("User data too big");
        expect(tabBadge().style.display).toBe("flex");
        expect(tabBadge().textContent).toBe("!");
        expect(launcherAlert()).not.toBeNull();
        expect(progressBar("Remaining user data size").getAttribute("aria-valuenow")).toBe("0");
    });

    it("does not flag exactly 1024 bytes", async () => {
        const { reportResult } = await mountPanel();

        await reportAndFlush(() => reportResult(1, { userData: "x".repeat(1024) }));

        expect(notice().dataset.notice).toBe("success");
        expect(launcherAlert()).toBeNull();
    });

    it("enables Apply only after an edit", async () => {
        await mountPanel();
        const apply = tools().querySelector<HTMLButtonElement>('[data-user-data-action="apply"]')!;
        expect(apply.disabled).toBe(true);

        editor().value = "anything, not just JSON";
        editor().dispatchEvent(new Event("input"));

        expect(apply.disabled).toBe(false);
    });
});

describe("dev tools Suggestions tab", () => {
    const checkStatus = (title: string) =>
        tools().querySelector(`[data-check="${title}"] [data-check-status]`)?.getAttribute("data-check-status");
    const badge = () => tabs()[4].querySelector("span")?.textContent;

    it("shows one row per check with a status icon", async () => {
        await mountPanel();

        expect(Array.from(tools().querySelectorAll("[data-check]")).map((row) => row.getAttribute("data-check"))).toEqual([
            "Uses the Minit SDK",
            "Signals when it is ready to play",
            "Reports a result",
            "First-play tutorial",
            "Declares config values",
            "No external requests",
        ]);
        expect(checkStatus("Uses the Minit SDK")).toBe("pass");
        expect(checkStatus("Signals when it is ready to play")).toBe("warn");
        expect(checkStatus("Reports a result")).toBe("unverified");
        expect(checkStatus("First-play tutorial")).toBe("warn");
        expect(checkStatus("Declares config values")).toBe("unverified");
    });

    it("warns about config values once meta.json cannot be fetched", async () => {
        await mountPanel();

        await flushPanelLoad();

        expect(checkStatus("Declares config values")).toBe("warn");
        expect(tools().querySelector('[data-check="Declares config values"]')?.textContent).toContain(
            "Couldn't load meta.json",
        );
    });

    it("passes checks as the game calls loadingDone(), reportResult() and shouldShowTutorial()", async () => {
        const { loadingDone, reportResult } = await mountPanel();
        const { shouldShowTutorial } = await import("./tutorial/gating");
        await flushPanelLoad();
        expect(badge()).toBe("2/6");

        loadingDone();
        expect(checkStatus("Signals when it is ready to play")).toBe("pass");

        reportResult(10);
        expect(checkStatus("Reports a result")).toBe("pass");

        shouldShowTutorial();
        expect(checkStatus("First-play tutorial")).toBe("pass");

        expect(badge()).toBe("5/6");
    });
});

describe("dev tools Settings", () => {
    it("opens the Settings view from the gear button with both switches on by default", async () => {
        await mountPanel();

        settingsButton().click();

        expect(settingsButton().getAttribute("aria-pressed")).toBe("true");
        expect(tabs().every((tab) => tab.getAttribute("aria-selected") === "false")).toBe(true);
        expect(switchNamed("Open on result").getAttribute("aria-checked")).toBe("true");
        expect(switchNamed("Close on replay").getAttribute("aria-checked")).toBe("true");
    });

    it("persists Close on replay and then keeps the panel open on Replay", async () => {
        await mountPanel();
        launcher().click();
        settingsButton().click();
        const navigated = spyNavigation();

        switchNamed("Close on replay").click();
        expect(JSON.parse(localStorage.getItem("minit-dev-tools-settings") ?? "{}")).toEqual({
            autoOpenOnResult: true,
            closeOnReplay: false,
        });

        replayButton().click();

        expect(navigated()).toBe(true);
        expect(isOpen()).toBe(true);
    });

    it("loads saved settings on mount", async () => {
        localStorage.setItem("minit-dev-tools-settings", JSON.stringify({ autoOpenOnResult: false, closeOnReplay: false }));

        await mountPanel();

        expect(switchNamed("Open on result").getAttribute("aria-checked")).toBe("false");
        expect(switchNamed("Close on replay").getAttribute("aria-checked")).toBe("false");
    });

    it("falls back to defaults for corrupt saved settings", async () => {
        localStorage.setItem("minit-dev-tools-settings", "{nope");

        await mountPanel();

        expect(switchNamed("Open on result").getAttribute("aria-checked")).toBe("true");
        expect(switchNamed("Close on replay").getAttribute("aria-checked")).toBe("true");
    });
});

describe("dev tools launcher result indicator", () => {
    const ring = () => launcher().querySelector("[data-result-countdown]");
    const check = () => launcher().querySelector("[data-result-check]");

    it("turns the launcher green and shows the check overlay when the result arrives", async () => {
        const { reportResult } = await mountPanel();
        expect(check()).toBeNull();

        await reportAndFlush(() => reportResult(1));

        expect(launcher().style.background).toBe(GREEN);
        expect(check()).not.toBeNull();
    });

    it("shows no countdown ring for a delayed result without animation support", async () => {
        const { reportResult } = await mountPanel();
        jest.useFakeTimers({ doNotFake: ["performance"] });

        reportResult(1, { delay: 500 });
        expect(ring()).toBeNull();
        expect(check()).not.toBeNull();
        expect(launcher().style.background).not.toBe(GREEN);

        jest.advanceTimersByTime(500);
        expect(launcher().style.background).toBe(GREEN);
    });

    describe("with animation support", () => {
        const fakeAnimation = () => ({ cancel: () => {}, finished: Promise.resolve(), onfinish: null });

        beforeEach(() => {
            (Element.prototype as { animate?: unknown }).animate = jest.fn(fakeAnimation);
        });

        afterEach(() => {
            delete (Element.prototype as { animate?: unknown }).animate;
        });

        it("shows a countdown ring while a delayed result is pending and removes it on arrival", async () => {
            const { reportResult } = await mountPanel();
            jest.useFakeTimers({ doNotFake: ["performance"] });

            reportResult(1, { delay: 500 });
            expect(ring()).not.toBeNull();

            jest.advanceTimersByTime(500);
            expect(ring()).toBeNull();
            expect(launcher().style.background).toBe(GREEN);
        });

        it("shows no countdown ring for an immediate result", async () => {
            const { reportResult } = await mountPanel();

            await reportAndFlush(() => reportResult(1));

            expect(ring()).toBeNull();
            expect(check()).not.toBeNull();
        });
    });
});
