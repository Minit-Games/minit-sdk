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
    const { recordTrackedEvent, getTrackedEntries } = await import("./trackDevBuffer");
    const { showTrackDevPanel } = await import("./trackDevPanel");
    return { track, loadingDone, recordTrackedEvent, getTrackedEntries, showTrackDevPanel };
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
        expect(texts[0]).toContain("3333");
        expect(texts[0]).toContain("flawless");
        expect(texts[0]).toContain("true");

        expect(texts[1]).toContain("coin_pickup");
        expect(texts[1]).toContain("2222");
        expect(texts[1]).toContain("value");
        expect(texts[1]).toContain("gold");

        expect(texts[2]).toContain("level_start");
        expect(texts[2]).toContain("1111");
        expect(texts[2]).toContain("level");
        expect(texts[2]).toContain("3");
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
        expect(dropRows[0].textContent).toContain("invalid-key");
        expect(dropRows[1].textContent).toContain("minit.sneaky");
        expect(dropRows[1].textContent).toContain("reserved-key");
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
