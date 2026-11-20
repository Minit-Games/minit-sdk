import { isTestEnvironment } from "../utils.js";
import { getLatoFontFaceCSS } from "./fonts/lato.js";
import { MAX_DEV_ENTRIES, getTrackedEntries, subscribeTrackedEntries } from "./trackDevBuffer.js";
import { MAX_EVENTS_PER_LOAD, MAX_PROPS, RATE_REFILL_PER_SECOND, RESERVED_KEY_PREFIX } from "./trackLimits.js";
import type { TrackDropReason, TrackedEntry } from "./trackDevBuffer.js";

const LAUNCHER_ID = "minit-dev-launcher";
const TOOLS_ID = "minit-dev-tools";
const PANEL_ID = "minit-track-dev-panel";
const DETAIL_ID = "minit-track-dev-detail";
const STYLE_ID = "minit-dev-tools-styles";

const COLORS = {
    brandOrange: "#F2790F",
    surface: "#171F33",
    surfaceSunk: "#0E1424",
    border: "#283252",
    hoverRow: "#1E2740",
    ink: "#EAEEF7",
    inkSecondary: "#97A2BD",
    inkMuted: "#6B7691",
    neg: "#E06C6C",
    onAccent: "#FFFFFF",
};

const FONT = "Lato, system-ui, -apple-system, 'Segoe UI', sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const LAUNCHER_SIZE = 48;
const EDGE = 12;
const GAP = 8;
const DRAG_THRESHOLD = 6;
const Z_INDEX = "9999";
const PANEL_MAX_HEIGHT = "min(420px, 60vh)";

const LOGO_VIEWBOX = "0 0 610.4 800";
const LOGO_SHAPES: ReadonlyArray<[string, Record<string, string>]> = [
    [
        "path",
        {
            d: "M610.4,390.35v-216.37C610.4,78.04,532.35,0,436.42,0c-52.33,0-99.3,23.26-131.22,59.94C273.28,23.26,226.31,0,173.98,0,78.05,0,0,78.04,0,173.98v320.82c0,168.29,136.91,305.2,305.2,305.2s305.2-136.91,305.2-305.2v-104.45h0ZM522.75,494.8c0,120.15-97.4,217.55-217.55,217.55h0c-120.15,0-217.55-97.4-217.55-217.55V173.98c0-47.67,38.65-86.32,86.32-86.32s86.32,38.65,86.32,86.32v166.47c0,.07,0,.13,0,.2s0,.13,0,.19v.39h.02c.32,24.53,20.27,44.33,44.88,44.33s44.56-19.8,44.88-44.33h.02v-.38c0-.07.01-.13.01-.2s0-.13-.01-.2v-166.47c0-47.67,38.65-86.32,86.32-86.32s86.32,38.65,86.32,86.32v302.8h0v18.02Z",
        },
    ],
    ["circle", { cx: "301.07", cy: "574.92", r: "37.8" }],
    ["circle", { cx: "411.75", cy: "471.14", r: "37.8" }],
    ["circle", { cx: "198.65", cy: "471.14", r: "37.8" }],
    ["polygon", { points: "437.43 498.88 326.97 602.46 276.25 546.43 386.06 443.41 437.43 498.88" }],
    ["polygon", { points: "171.72 497.67 274.14 601.45 329.77 550.33 225.59 444.62 171.72 497.67" }],
];

const ISOLATED_EVENTS = [
    "pointerdown",
    "pointermove",
    "pointerup",
    "pointercancel",
    "mousedown",
    "mouseup",
    "click",
    "touchstart",
    "touchmove",
    "touchend",
    "touchcancel",
    "wheel",
] as const;

interface DevTool {
    label: string;
    badge?: HTMLElement;
    content: HTMLElement;
    tab?: HTMLButtonElement;
}

let mounted = false;

export function showTrackDevPanel(): void {
    if (mounted || typeof document === "undefined" || !isTestEnvironment()) {
        return;
    }
    mounted = true;
    if (document.body) {
        mount(document.body);
    } else {
        document.addEventListener("DOMContentLoaded", () => mount(document.body), { once: true });
    }
}

function mount(body: HTMLElement): void {
    injectStyles();

    const detail = createDetailPanel();
    const tools = createToolsPanel([createTrackedEventsTool(detail)]);
    const launcher = createLauncher();

    let open = false;
    const setOpen = (next: boolean) => {
        open = next;
        tools.panel.style.display = open ? "flex" : "none";
        launcher.setAttribute("aria-expanded", String(open));
        if (open) {
            anchorTools(tools.panel, launcher);
        } else {
            detail.style.display = "none";
        }
    };
    tools.close.onclick = () => setOpen(false);

    makeDraggable(launcher, {
        onTap: () => setOpen(!open),
        onMove: () => {
            if (open) {
                anchorTools(tools.panel, launcher);
            }
        },
    });

    window.addEventListener("resize", () => {
        placeLauncher(launcher, launcher.offsetLeft, launcher.offsetTop);
        if (open) {
            anchorTools(tools.panel, launcher);
        }
    });

    body.append(tools.panel, detail, launcher);
    placeLauncher(launcher, window.innerWidth - LAUNCHER_SIZE - EDGE, window.innerHeight - LAUNCHER_SIZE - EDGE);
}

function injectStyles(): void {
    if (document.getElementById(STYLE_ID)) {
        return;
    }
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent =
        getLatoFontFaceCSS() +
        `
#${LAUNCHER_ID} {
    -webkit-tap-highlight-color: transparent;
    -webkit-user-select: none;
    transition: transform 120ms ease, filter 120ms ease, box-shadow 120ms ease;
}
@media (hover: hover) {
    #${LAUNCHER_ID}:hover {
        transform: scale(1.06);
        filter: brightness(1.12);
        box-shadow: 0 10px 24px rgba(0, 0, 0, 0.45) !important;
    }
}
#${LAUNCHER_ID}:active { transform: scale(1); }
#${TOOLS_ID} [data-clear]:hover { color: ${COLORS.ink} !important; background: ${COLORS.hoverRow} !important; }
#${LAUNCHER_ID}:focus-visible, #${TOOLS_ID} button:focus-visible {
    outline: 2px solid ${COLORS.brandOrange};
    outline-offset: 2px;
}
#${PANEL_ID} [data-kind]:hover { background: ${COLORS.hoverRow}; }
#${PANEL_ID} [data-kind]:focus-visible {
    outline: 2px solid ${COLORS.brandOrange};
    outline-offset: -2px;
}
#${TOOLS_ID} [data-close]:hover { color: ${COLORS.ink}; background: ${COLORS.hoverRow}; }
#${TOOLS_ID} [aria-pressed="false"]:hover { color: ${COLORS.ink} !important; background: ${COLORS.hoverRow} !important; }
#${PANEL_ID} { scrollbar-width: thin; scrollbar-color: ${COLORS.border} transparent; }
`;
    document.head.append(style);
}

function isolate(element: HTMLElement): void {
    for (const type of ISOLATED_EVENTS) {
        element.addEventListener(type, (event) => event.stopPropagation(), { passive: true });
    }
}

function createLauncher(): HTMLButtonElement {
    const launcher = document.createElement("button");
    launcher.id = LAUNCHER_ID;
    launcher.type = "button";
    launcher.title = "Minit SDK tools";
    launcher.setAttribute("aria-label", "Minit SDK tools");
    launcher.setAttribute("aria-controls", TOOLS_ID);
    launcher.setAttribute("aria-expanded", "false");
    Object.assign(launcher.style, {
        position: "fixed",
        left: "0",
        top: "0",
        width: `${LAUNCHER_SIZE}px`,
        height: `${LAUNCHER_SIZE}px`,
        padding: "0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "50%",
        border: "2px solid rgba(255, 255, 255, 0.9)",
        background: COLORS.brandOrange,
        color: COLORS.onAccent,
        boxShadow: "0 6px 16px rgba(0, 0, 0, 0.35)",
        cursor: "grab",
        touchAction: "none",
        userSelect: "none",
        zIndex: Z_INDEX,
    });
    launcher.append(createLogoMark(22));
    return launcher;
}

function createLogoMark(height: number): SVGSVGElement {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", LOGO_VIEWBOX);
    svg.setAttribute("height", String(height));
    svg.setAttribute("width", String(Math.round((height * 610.4) / 800)));
    svg.setAttribute("fill", "currentColor");
    svg.setAttribute("aria-hidden", "true");
    svg.style.pointerEvents = "none";
    for (const [tag, attrs] of LOGO_SHAPES) {
        const shape = document.createElementNS(ns, tag);
        for (const [name, value] of Object.entries(attrs)) {
            shape.setAttribute(name, value);
        }
        svg.append(shape);
    }
    return svg;
}

function makeDraggable(launcher: HTMLButtonElement, handlers: { onTap: () => void; onMove: () => void }): void {
    isolate(launcher);
    let start: { x: number; y: number; left: number; top: number; id: number } | null = null;
    let dragged = false;

    launcher.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) {
            return;
        }
        event.preventDefault();
        start = { x: event.clientX, y: event.clientY, left: launcher.offsetLeft, top: launcher.offsetTop, id: event.pointerId };
        dragged = false;
        launcher.setPointerCapture?.(event.pointerId);
    });
    launcher.addEventListener("pointermove", (event) => {
        if (!start || event.pointerId !== start.id) {
            return;
        }
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (!dragged && Math.hypot(dx, dy) < DRAG_THRESHOLD) {
            return;
        }
        dragged = true;
        launcher.style.cursor = "grabbing";
        placeLauncher(launcher, start.left + dx, start.top + dy);
        handlers.onMove();
    });
    const end = (event: PointerEvent) => {
        if (!start || event.pointerId !== start.id) {
            return;
        }
        start = null;
        launcher.style.cursor = "grab";
        launcher.releasePointerCapture?.(event.pointerId);
    };
    launcher.addEventListener("pointerup", end);
    launcher.addEventListener("pointercancel", (event) => {
        if (start?.id === event.pointerId) {
            dragged = false;
        }
        end(event);
    });
    launcher.addEventListener("click", (event) => {
        // Keyboard activation has detail 0 and must never be eaten by a drag that ended without a click.
        if (dragged && event.detail !== 0) {
            dragged = false;
            return;
        }
        handlers.onTap();
    });
}

function placeLauncher(launcher: HTMLElement, left: number, top: number): void {
    const maxLeft = Math.max(EDGE, window.innerWidth - LAUNCHER_SIZE - EDGE);
    const maxTop = Math.max(EDGE, window.innerHeight - LAUNCHER_SIZE - EDGE);
    launcher.style.left = `${clamp(left, EDGE, maxLeft)}px`;
    launcher.style.top = `${clamp(top, EDGE, maxTop)}px`;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

function createToolsPanel(toolList: DevTool[]): { panel: HTMLElement; close: HTMLButtonElement } {
    const panel = document.createElement("div");
    panel.id = TOOLS_ID;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Minit SDK");
    isolate(panel);
    Object.assign(panel.style, {
        display: "none",
        flexDirection: "column",
        position: "fixed",
        width: "300px",
        maxWidth: `calc(100vw - ${EDGE * 2}px)`,
        maxHeight: PANEL_MAX_HEIGHT,
        background: COLORS.surface,
        color: COLORS.ink,
        border: `1px solid ${COLORS.border}`,
        borderRadius: "14px",
        boxShadow: "0 12px 32px rgba(0, 0, 0, 0.45)",
        fontFamily: FONT,
        fontSize: "12px",
        lineHeight: "1.4",
        overflow: "hidden",
        zIndex: Z_INDEX,
    });

    const header = document.createElement("div");
    Object.assign(header.style, {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "10px 8px 8px 12px",
        flexShrink: "0",
    });
    const badge = document.createElement("span");
    Object.assign(badge.style, {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "22px",
        height: "22px",
        borderRadius: "50%",
        background: COLORS.brandOrange,
        color: COLORS.onAccent,
        flexShrink: "0",
    });
    badge.append(createLogoMark(12));
    const title = document.createElement("span");
    title.textContent = "Minit SDK";
    Object.assign(title.style, { flex: "1", fontSize: "14px", fontWeight: "700", letterSpacing: "0.01em" });
    const close = document.createElement("button");
    close.type = "button";
    close.dataset.close = "";
    close.textContent = "×";
    close.setAttribute("aria-label", "Close Minit SDK tools");
    Object.assign(close.style, {
        width: "26px",
        height: "26px",
        padding: "0",
        border: "none",
        borderRadius: "8px",
        background: "transparent",
        color: COLORS.inkSecondary,
        font: `400 18px/1 ${FONT}`,
        cursor: "pointer",
    });
    header.append(badge, title, close);

    const tabBar = document.createElement("div");
    tabBar.setAttribute("role", "tablist");
    Object.assign(tabBar.style, {
        display: "flex",
        gap: "4px",
        padding: "0 12px",
        borderBottom: `1px solid ${COLORS.border}`,
        flexShrink: "0",
    });

    const body = document.createElement("div");
    Object.assign(body.style, { display: "flex", flexDirection: "column", minHeight: "0", flex: "1" });

    const select = (active: DevTool) => {
        for (const tool of toolList) {
            const selected = tool === active;
            tool.content.style.display = selected ? "flex" : "none";
            tool.tab?.setAttribute("aria-selected", String(selected));
            if (tool.tab) {
                tool.tab.style.color = selected ? COLORS.ink : COLORS.inkSecondary;
                tool.tab.style.borderBottomColor = selected ? COLORS.brandOrange : "transparent";
            }
        }
    };

    for (const tool of toolList) {
        const tab = document.createElement("button");
        tab.type = "button";
        tab.setAttribute("role", "tab");
        tab.append(tool.label);
        if (tool.badge) {
            tab.append(tool.badge);
        }
        Object.assign(tab.style, {
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 2px 8px",
            marginBottom: "-1px",
            border: "none",
            borderBottom: "2px solid transparent",
            background: "transparent",
            font: `700 12px/1.2 ${FONT}`,
            cursor: "pointer",
        });
        tab.onclick = () => select(tool);
        tool.tab = tab;
        tabBar.append(tab);
        body.append(tool.content);
    }
    select(toolList[0]);

    panel.append(header, tabBar, body);
    return { panel, close };
}

function anchorTools(panel: HTMLElement, launcher: HTMLElement): void {
    const rect = launcher.getBoundingClientRect();
    const onRight = rect.left + rect.width / 2 > window.innerWidth / 2;
    const below = rect.top + rect.height / 2 < window.innerHeight / 2;
    const room = below ? window.innerHeight - rect.bottom - GAP - EDGE : rect.top - GAP - EDGE;
    panel.style.maxHeight = `min(${PANEL_MAX_HEIGHT}, ${Math.max(0, room)}px)`;
    panel.style.left = onRight ? "" : `${Math.max(EDGE, rect.left)}px`;
    panel.style.right = onRight ? `${Math.max(EDGE, window.innerWidth - rect.right)}px` : "";
    panel.style.top = below ? `${rect.bottom + GAP}px` : "";
    panel.style.bottom = below ? "" : `${window.innerHeight - rect.top + GAP}px`;
}

function createTrackedEventsTool(detail: HTMLElement): DevTool {
    const content = document.createElement("div");
    content.setAttribute("role", "tabpanel");
    Object.assign(content.style, { flexDirection: "column", minHeight: "0", flex: "1" });

    const toolbar = document.createElement("div");
    Object.assign(toolbar.style, {
        display: "flex",
        justifyContent: "flex-end",
        gap: "6px",
        padding: "8px 12px 4px",
        flexShrink: "0",
    });
    const pillStyle = {
        padding: "3px 10px",
        borderRadius: "999px",
        border: `1px solid ${COLORS.border}`,
        font: `700 11px/1.4 ${FONT}`,
        cursor: "pointer",
    };
    const clearButton = document.createElement("button");
    clearButton.type = "button";
    clearButton.dataset.clear = "";
    clearButton.textContent = "Clear";
    Object.assign(clearButton.style, pillStyle, { background: "transparent", color: COLORS.inkSecondary });
    const groupToggle = document.createElement("button");
    groupToggle.type = "button";
    groupToggle.textContent = "Group by key";
    Object.assign(groupToggle.style, pillStyle);
    toolbar.append(clearButton, groupToggle);

    const list = document.createElement("div");
    list.id = PANEL_ID;
    Object.assign(list.style, {
        overflowY: "auto",
        overscrollBehavior: "contain",
        padding: "0 0 6px",
        minHeight: "48px",
    });

    const empty = document.createElement("div");
    empty.textContent = "No events tracked yet.";
    Object.assign(empty.style, { padding: "12px", color: COLORS.inkMuted, textAlign: "center" });
    content.append(toolbar, list);

    const countBadge = document.createElement("span");
    Object.assign(countBadge.style, {
        minWidth: "18px",
        padding: "0 6px",
        boxSizing: "border-box",
        borderRadius: "999px",
        background: COLORS.border,
        color: COLORS.ink,
        font: `700 10px/16px ${FONT}`,
        textAlign: "center",
    });

    const tool: DevTool = { label: "Tracking", badge: countBadge, content };
    const entries: TrackedEntry[] = [];
    const groups = new Map<string, { row: HTMLElement; count: number; latest: TrackedEntry }>();
    let grouped = false;

    const createRow = (entry: TrackedEntry, count?: number): HTMLElement => {
        const row = renderRow(entry, count);
        const hideDetail = () => {
            detail.style.display = "none";
        };
        row.onmouseenter = () => showDetail(detail, row, entry);
        row.onmouseleave = hideDetail;
        row.onfocus = () => showDetail(detail, row, entry);
        row.onblur = hideDetail;
        return row;
    };

    const groupId = (entry: TrackedEntry) => `${entry.kind}:${entry.key}`;

    const show = (entry: TrackedEntry) => {
        if (!grouped) {
            list.insertBefore(createRow(entry), list.firstChild);
            return;
        }
        const id = groupId(entry);
        const group = groups.get(id);
        group?.row.remove();
        const count = (group?.count ?? 0) + 1;
        const row = createRow(entry, count);
        list.insertBefore(row, list.firstChild);
        groups.set(id, { row, count, latest: entry });
    };

    const evict = (entry: TrackedEntry) => {
        if (!grouped) {
            list.lastElementChild?.remove();
            return;
        }
        const id = groupId(entry);
        const group = groups.get(id);
        if (!group) {
            return;
        }
        if (group.count === 1) {
            group.row.remove();
            groups.delete(id);
            return;
        }
        const row = createRow(group.latest, group.count - 1);
        group.row.replaceWith(row);
        groups.set(id, { row, count: group.count - 1, latest: group.latest });
    };

    const setGrouped = (next: boolean) => {
        grouped = next;
        groupToggle.setAttribute("aria-pressed", String(grouped));
        Object.assign(groupToggle.style, {
            background: grouped ? COLORS.brandOrange : "transparent",
            borderColor: grouped ? COLORS.brandOrange : COLORS.border,
            color: grouped ? COLORS.onAccent : COLORS.inkSecondary,
        });
        detail.style.display = "none";
        groups.clear();
        list.replaceChildren(...(entries.length === 0 ? [empty] : []));
        entries.forEach(show);
    };
    groupToggle.onclick = () => setGrouped(!grouped);

    const add = (entry: TrackedEntry) => {
        entries.push(entry);
        empty.remove();
        show(entry);
        if (entries.length > MAX_DEV_ENTRIES) {
            evict(entries.shift()!);
        }
        countBadge.textContent = String(entries.length);
    };

    clearButton.onclick = () => {
        entries.length = 0;
        countBadge.textContent = "0";
        setGrouped(grouped);
    };

    setGrouped(false);
    countBadge.textContent = "0";
    getTrackedEntries().forEach(add);
    subscribeTrackedEntries(add);
    return tool;
}

function formatSeconds(ms: number): string {
    return `${(ms / 1000).toFixed(2)}s`;
}

function renderRow(entry: TrackedEntry, count?: number): HTMLElement {
    const row = document.createElement("div");
    row.dataset.kind = entry.kind;
    row.tabIndex = 0;
    row.setAttribute("aria-describedby", DETAIL_ID);
    Object.assign(row.style, {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "5px 12px",
        borderLeft: `3px solid ${entry.kind === "drop" ? COLORS.neg : "transparent"}`,
        cursor: "pointer",
    });

    const key = document.createElement("span");
    Object.assign(key.style, {
        flex: "1",
        minWidth: "0",
        fontWeight: "700",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    });
    const time = document.createElement("span");
    Object.assign(time.style, {
        flexShrink: "0",
        color: COLORS.inkMuted,
        fontFamily: MONO,
        fontSize: "11px",
    });
    time.textContent = formatSeconds(entry.t);

    if (entry.kind === "event") {
        key.textContent = entry.key;
    } else {
        row.style.color = COLORS.neg;
        key.textContent = `⚠ dropped ${entry.key}`;
    }
    row.append(key, time);

    if (count !== undefined) {
        const badge = document.createElement("span");
        badge.textContent = String(count);
        Object.assign(badge.style, {
            flexShrink: "0",
            minWidth: "22px",
            padding: "1px 7px",
            boxSizing: "border-box",
            borderRadius: "999px",
            background: entry.kind === "drop" ? COLORS.neg : COLORS.border,
            color: entry.kind === "drop" ? COLORS.onAccent : COLORS.ink,
            font: `700 11px/1.4 ${FONT}`,
            textAlign: "center",
        });
        row.append(badge);
    }
    return row;
}

function createDetailPanel(): HTMLElement {
    const detail = document.createElement("div");
    detail.id = DETAIL_ID;
    detail.setAttribute("role", "tooltip");
    Object.assign(detail.style, {
        display: "none",
        position: "fixed",
        width: "max-content",
        minWidth: `min(240px, calc(100vw - ${EDGE * 2}px))`,
        maxWidth: `min(360px, calc(100vw - ${EDGE * 2}px))`,
        padding: "12px 16px 14px",
        boxSizing: "border-box",
        background: COLORS.surfaceSunk,
        color: COLORS.inkSecondary,
        border: `1px solid ${COLORS.border}`,
        borderRadius: "12px",
        boxShadow: "0 12px 32px rgba(0, 0, 0, 0.45)",
        fontFamily: MONO,
        fontSize: "12px",
        lineHeight: "1.7",
        wordBreak: "break-all",
        pointerEvents: "none",
        zIndex: Z_INDEX,
    });
    return detail;
}

function renderDetailHeader(entry: TrackedEntry): HTMLElement {
    const header = document.createElement("div");
    Object.assign(header.style, {
        display: "flex",
        alignItems: "baseline",
        gap: "12px",
        paddingBottom: "8px",
        marginBottom: "8px",
        borderBottom: `1px solid ${COLORS.border}`,
    });
    const key = document.createElement("span");
    key.textContent = entry.kind === "event" ? entry.key : `⚠ dropped ${entry.key}`;
    Object.assign(key.style, {
        flex: "1",
        minWidth: "0",
        color: entry.kind === "event" ? COLORS.ink : COLORS.neg,
        font: `700 13px/1.4 ${FONT}`,
    });
    const time = document.createElement("span");
    time.textContent = formatSeconds(entry.t);
    Object.assign(time.style, { flexShrink: "0", color: COLORS.inkMuted, fontSize: "11px" });
    header.append(key, time);
    return header;
}

function describeDropReason(reason: TrackDropReason): string {
    switch (reason) {
        case "invalid-key":
            return "invalid key";
        case "reserved-key":
            return `reserved ${RESERVED_KEY_PREFIX} prefix`;
        case "invalid-props":
            return "properties are not an object";
        case "too-many-props":
            return `too many properties (more than ${MAX_PROPS})`;
        case "invalid-prop-key":
            return "invalid property key";
        case "invalid-prop-value":
            return "invalid property value";
        case "too-large":
            return "event too large";
        case "rate":
            return `rate limit exceeded (${RATE_REFILL_PER_SECOND} per second)`;
        case "load-cap":
            return `more than ${MAX_EVENTS_PER_LOAD} events this load`;
    }
}

function showDetail(detail: HTMLElement, row: HTMLElement, entry: TrackedEntry): void {
    const lines =
        entry.kind === "event"
            ? Object.entries(entry.props).map(([name, value]) => `${name}: ${JSON.stringify(value)}`)
            : [`reason: ${describeDropReason(entry.reason)}`];
    if (lines.length === 0) {
        lines.push("no properties");
    }
    const source = document.createElement("div");
    source.textContent = `source: ${entry.kind === "event" && entry.key.startsWith(RESERVED_KEY_PREFIX) ? "built in" : "minit"}`;
    Object.assign(source.style, {
        paddingTop: "8px",
        marginTop: "8px",
        borderTop: `1px solid ${COLORS.border}`,
        color: COLORS.inkMuted,
    });
    detail.replaceChildren(
        renderDetailHeader(entry),
        ...lines.map((text) => {
            const line = document.createElement("div");
            line.textContent = text;
            return line;
        }),
        source,
    );
    detail.style.color = entry.kind === "event" ? COLORS.inkSecondary : COLORS.neg;
    detail.style.display = "block";

    const panelRect = document.getElementById(TOOLS_ID)?.getBoundingClientRect() ?? row.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const width = detail.offsetWidth;
    const roomLeft = panelRect.left - GAP - EDGE;
    const roomRight = window.innerWidth - panelRect.right - GAP - EDGE;
    const left = roomLeft >= roomRight ? panelRect.left - GAP - width : panelRect.right + GAP;
    detail.style.left = `${clamp(left, EDGE, Math.max(EDGE, window.innerWidth - width - EDGE))}px`;
    detail.style.top = `${clamp(rowRect.top, EDGE, Math.max(EDGE, window.innerHeight - detail.offsetHeight - EDGE))}px`;
}
