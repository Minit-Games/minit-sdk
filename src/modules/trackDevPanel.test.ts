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
    return { track, loadingDone, recordTrackedEvent, recordTrackedDrop, getTrackedEntries, showTrackDevPanel };
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
    return tabs()[0].querySelector("span")?.textContent ?? "";
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
    target.click();
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
    now = 1000;
    jest.spyOn(performance, "now").mockImplementation(() => now);
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
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
        track("bad key!");

        const dropRows = rows("drop");
        expect(dropRows).toHaveLength(2);
        expect(dropRows[0].textContent).toContain("bad key!");
        expect(hoverDetail(dropRows[0])).toContain("reason: invalid key");
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

    it("closes from the close button and hides the detail popup", async () => {
        const { recordTrackedEvent } = await mountPanel();
        recordTrackedEvent("level_start", {});
        launcher().click();
        hoverDetail(rows()[0]);
        expect(detail().style.display).toBe("block");

        tools().querySelector<HTMLButtonElement>("[data-close]")?.click();

        expect(isOpen()).toBe(false);
        expect(launcher().getAttribute("aria-expanded")).toBe("false");
        expect(detail().style.display).toBe("none");
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
        toolButton("Group by key").click();

        for (const type of ["pointerdown", "pointermove", "pointerup", "click"]) {
            document.removeEventListener(type, listener);
        }
        expect(seen).toEqual([]);
    });
});

describe("dev tools panel", () => {
    it("shows the Minit SDK header and a single Tracking tab", async () => {
        await mountPanel();

        expect(tools().getAttribute("aria-label")).toBe("Minit SDK");
        expect(tools().textContent).toContain("Minit SDK");
        expect(tabs()).toHaveLength(1);
        expect(tabs()[0].firstChild?.textContent).toBe("Tracking");
        expect(tabs()[0].getAttribute("aria-selected")).toBe("true");
        expect(countBadge()).toBe("0");
    });

    it("counts entries in the tab badge as they arrive", async () => {
        const { recordTrackedEvent, track } = await loadSdk();
        recordTrackedEvent("early_event", {});
        track("level_start");
        expect(countBadge()).toBe("2");

        track("bad key!");
        expect(countBadge()).toBe("3");
    });

    it("lists rows newest first with the time in seconds and marks drops", async () => {
        const { track } = await loadSdk();

        now = 3420;
        track("level_start");
        now = 12345;
        track("bad key!");

        expect(rows().map(rowParts)).toEqual([
            ["⚠ dropped bad key!", "12.35s"],
            ["level_start", "3.42s"],
        ]);
        expect(rows()[0].getAttribute("data-kind")).toBe("drop");
        expect(rows()[1].getAttribute("data-kind")).toBe("event");
    });

    it("shows a row for every dropped call while warning once per reason", async () => {
        const { track } = await loadSdk();

        for (let i = 0; i < 7; i++) {
            track(`e${i}`);
        }

        expect(rows("event")).toHaveLength(5);
        expect(rows("drop").map((row) => row.firstChild?.textContent)).toEqual(["⚠ dropped e6", "⚠ dropped e5"]);
        expect(console.warn).toHaveBeenCalledTimes(1);
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

        expect(tools().style.maxHeight).toBe(`min(min(420px, 60vh), ${600 - 8 - 12}px)`);
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

        expect(tools().style.maxHeight).toBe(`min(min(420px, 60vh), ${window.innerHeight - 348 - 8 - 12}px)`);
        expect(tools().style.top).toBe(`${348 + 8}px`);
    });
});

describe("dev tools panel grouping", () => {
    it("groups rows by kind and key with a count and the latest time", async () => {
        const { recordTrackedEvent, track } = await mountPanel();
        const toggle = toolButton("Group by key");
        expect(toggle.getAttribute("aria-pressed")).toBe("false");

        now = 1000;
        recordTrackedEvent("coin", {});
        now = 2000;
        recordTrackedEvent("jump", {});
        now = 3000;
        recordTrackedEvent("coin", {});
        now = 4000;
        track("minit.coin");
        now = 4500;
        track("minit.coin");

        toggle.click();

        expect(toggle.getAttribute("aria-pressed")).toBe("true");
        expect(rows().map(rowParts)).toEqual([
            ["⚠ dropped minit.coin", "4.50s", "2"],
            ["coin", "3.00s", "2"],
            ["jump", "2.00s", "1"],
        ]);
    });

    it("updates the grouped view as entries arrive", async () => {
        const { recordTrackedEvent } = await mountPanel();
        now = 1000;
        recordTrackedEvent("coin", {});
        now = 2000;
        recordTrackedEvent("jump", {});
        toolButton("Group by key").click();

        now = 5000;
        recordTrackedEvent("coin", {});

        expect(rows().map(rowParts)).toEqual([
            ["coin", "5.00s", "2"],
            ["jump", "2.00s", "1"],
        ]);
    });

    it("restores the flat list when toggled off", async () => {
        const { recordTrackedEvent } = await mountPanel();
        now = 1000;
        recordTrackedEvent("coin", {});
        now = 2000;
        recordTrackedEvent("coin", {});
        const toggle = toolButton("Group by key");

        toggle.click();
        expect(rows()).toHaveLength(1);
        toggle.click();

        expect(toggle.getAttribute("aria-pressed")).toBe("false");
        expect(rows().map(rowParts)).toEqual([
            ["coin", "2.00s"],
            ["coin", "1.00s"],
        ]);
    });
});

describe("dev tools panel clear", () => {
    it("empties the list and the badge without touching the dev buffer", async () => {
        const { recordTrackedEvent, getTrackedEntries } = await mountPanel();
        recordTrackedEvent("coin", {});
        recordTrackedEvent("jump", {});

        toolButton("Clear").click();

        expect(rows()).toHaveLength(0);
        expect(countBadge()).toBe("0");
        expect(document.querySelector(PANEL_SELECTOR)?.textContent).toBe("No events tracked yet.");
        expect(getTrackedEntries()).toHaveLength(2);
    });

    it("shows entries tracked after clearing, in flat and grouped mode", async () => {
        const { recordTrackedEvent, track } = await mountPanel();
        recordTrackedEvent("coin", {});
        toolButton("Clear").click();

        track("jump");
        expect(rows().map((row) => row.firstChild?.textContent)).toEqual(["jump"]);
        expect(countBadge()).toBe("1");

        toolButton("Group by key").click();
        toolButton("Clear").click();
        track("jump");
        expect(rows().map((row) => rowParts(row)[2])).toEqual(["1"]);
    });

    it("leaves the track() rate limit in force", async () => {
        const { track } = await loadSdk();
        for (let i = 0; i < 5; i++) {
            track(`e${i}`);
        }
        toolButton("Clear").click();

        track("after_clear");

        expect(rows().map(rowParts)).toEqual([["⚠ dropped after_clear", "1.00s"]]);
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
        expect(lines.slice(1)).toEqual(["level: 2", "won: false", 'mode: "hard"', "source: minit"]);
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

        hoverDetail(rows()[0]);

        expect(rowParts(detail().children[0])).toEqual(["⚠ dropped minit.sneaky", "2.50s"]);
        expect(detail().textContent).toContain("source: minit");
        expect(detail().textContent).not.toContain("built in");
    });

    it.each([
        ["invalid-key", "invalid key"],
        ["reserved-key", "reserved minit. prefix"],
        ["invalid-props", "properties are not an object"],
        ["too-many-props", "too many properties (more than 20)"],
        ["invalid-prop-key", "invalid property key"],
        ["invalid-prop-value", "invalid property value"],
        ["too-large", "event too large"],
        ["rate", "rate limit exceeded (5 per second)"],
        ["load-cap", "more than 100 events this load"],
    ] as const)("explains the %s drop reason", async (reason, text) => {
        const { recordTrackedDrop, showTrackDevPanel } = await loadSdk();
        recordTrackedDrop("some_key", reason);
        showTrackDevPanel();

        hoverDetail(rows("drop")[0]);

        const lines = Array.from(detail().children).map((child) => child.textContent);
        expect(lines.slice(1)).toEqual([`reason: ${text}`, "source: minit"]);
    });

    it("hides on mouse leave", async () => {
        const { recordTrackedEvent } = await mountPanel();
        recordTrackedEvent("level_start", {});
        const row = rows()[0];

        hoverDetail(row);
        expect(detail().style.display).toBe("block");
        row.dispatchEvent(new MouseEvent("mouseleave"));

        expect(detail().style.display).toBe("none");
    });
});
