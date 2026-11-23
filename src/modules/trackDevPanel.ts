import { isTestEnvironment } from "../utils.js";
import { getLatoFontFaceCSS } from "./fonts/lato.js";
import {
    MAX_DEV_ENTRIES,
    getReceivedCount,
    getReportedResult,
    getTrackedEntries,
    getTrackedUsage,
    subscribeReportedResult,
    subscribeTrackedEntries,
} from "./trackDevBuffer.js";
import type { ReportedResult } from "./trackDevBuffer.js";
import {
    MAX_EVENTS_PER_LOAD,
    MAX_PAYLOAD_BYTES_PER_LOAD,
    MAX_PROPS,
    RATE_REFILL_PER_SECOND,
    RESERVED_KEY_PREFIX,
} from "./trackLimits.js";
import type { TrackDropReason, TrackedEntry } from "./trackDevBuffer.js";

const LAUNCHER_ID = "minit-dev-launcher";
const TOOLS_ID = "minit-dev-tools";
const PANEL_ID = "minit-track-dev-panel";
const DETAIL_ID = "minit-track-dev-detail";
const STYLE_ID = "minit-dev-tools-styles";
const LAYOUT_STORAGE_KEY = "minit-dev-tools-layout";
const SVG_NS = "http://www.w3.org/2000/svg";
const REPLAY_ID = "minit-dev-replay";

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
    warn: "#E5B84C",
    pos: "#4FBF86",
    onAccent: "#FFFFFF",
};

const USAGE_WARN_RATIO = 0.8;

const FONT = "Lato, system-ui, -apple-system, 'Segoe UI', sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const LAUNCHER_SIZE = 48;
const EDGE = 12;
const GAP = 8;
const DRAG_THRESHOLD = 6;
const Z_INDEX = "2147483647";
const PANEL_DEFAULT_WIDTH = 300;
const PANEL_DEFAULT_HEIGHT = 320;
const PANEL_MIN_WIDTH = 240;
const PANEL_MIN_HEIGHT = 160;
const GRIP_SIZE = 16;
const DETAIL_HIDE_DELAY_MS = 150;

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
    const tools = createToolsPanel([createTrackedEventsTool(detail), createResultTool()]);
    const launcher = createLauncher();

    const saved = loadLayout();
    if (saved.width !== undefined && saved.height !== undefined) {
        tools.panel.style.width = `${saved.width}px`;
        tools.panel.style.height = `${saved.height}px`;
    }
    const persist = () =>
        saveLayout({
            left: launcher.offsetLeft,
            top: launcher.offsetTop,
            width: parseFloat(tools.panel.style.width),
            height: parseFloat(tools.panel.style.height),
            open,
        });

    const replay = createReplayButton();

    let open = false;
    let closing: Animation[] = [];
    const setOpen = (next: boolean) => {
        open = next;
        persist();
        launcher.setAttribute("aria-expanded", String(open));
        closing.forEach((animation) => animation.cancel());
        closing = [];
        if (open) {
            tools.panel.style.display = "flex";
            replay.style.display = "flex";
            placeLauncher(launcher, launcher.offsetLeft, launcher.offsetTop);
            anchorTools(tools.panel, tools.grip, launcher);
            animatePanel(tools.panel, tools.grip, true);
            animateReplay(replay, launcher, true);
            return;
        }
        detail.style.display = "none";
        for (const [element, animation] of [
            [tools.panel, animatePanel(tools.panel, tools.grip, false)],
            [replay, animateReplay(replay, launcher, false)],
        ] as const) {
            if (animation) {
                animation.onfinish = () => {
                    element.style.display = "none";
                };
                closing.push(animation);
            } else {
                element.style.display = "none";
            }
        }
    };
    window.addEventListener("keydown", (event) => {
        if (event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey && event.key.toLowerCase() === "m") {
            event.preventDefault();
            setOpen(!open);
        }
    });

    makeDraggable(launcher, {
        onTap: () => setOpen(!open),
        onMove: () => {
            if (open) {
                anchorTools(tools.panel, tools.grip, launcher);
            }
            persist();
        },
    });

    makeHeaderDraggable(tools.header, tools.panel, launcher, () => {
        detail.style.display = "none";
        persist();
    });

    makeResizable(tools.panel, tools.grip, () => {
        detail.style.display = "none";
        anchorTools(tools.panel, tools.grip, launcher);
        persist();
    });

    window.addEventListener("resize", () => {
        placeLauncher(launcher, launcher.offsetLeft, launcher.offsetTop);
        if (open) {
            anchorTools(tools.panel, tools.grip, launcher);
        }
    });

    body.append(tools.panel, detail, replay, launcher);
    placeLauncher(
        launcher,
        saved.left ?? window.innerWidth - LAUNCHER_SIZE - EDGE,
        saved.top ?? window.innerHeight - LAUNCHER_SIZE - EDGE,
    );
    if (saved.open) {
        setOpen(true);
    }
}

function canAnimate(element: HTMLElement): boolean {
    return typeof element.animate === "function" && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function animateReplay(replay: HTMLElement, launcher: HTMLElement, showing: boolean): Animation | undefined {
    if (!canAnimate(replay)) {
        return undefined;
    }
    const towardLauncher = replay.offsetLeft < launcher.offsetLeft ? 12 : -12;
    const hidden = { opacity: 0, transform: `translateX(${towardLauncher}px) scale(0.85)` };
    const shown = { opacity: 1, transform: "none" };
    return replay.animate(showing ? [hidden, shown] : [shown, hidden], {
        duration: showing ? 200 : 140,
        delay: showing ? 60 : 0,
        easing: showing ? "cubic-bezier(0.2, 0.9, 0.3, 1.2)" : "ease-in",
        fill: "backwards",
    });
}

function animatePanel(panel: HTMLElement, grip: HTMLElement, opening: boolean): Animation | undefined {
    if (!canAnimate(panel)) {
        return undefined;
    }
    const originX = grip.dataset.h === "left" ? "right" : "left";
    const originY = grip.dataset.v === "top" ? "bottom" : "top";
    panel.style.transformOrigin = `${originY} ${originX}`;
    const hidden = { opacity: 0, transform: "scale(0.92)" };
    const shown = { opacity: 1, transform: "none" };
    return panel.animate(opening ? [hidden, shown] : [shown, hidden], {
        duration: opening ? 180 : 140,
        easing: opening ? "cubic-bezier(0.2, 0.9, 0.3, 1.2)" : "ease-in",
    });
}

interface PanelLayout {
    left?: number;
    top?: number;
    width?: number;
    height?: number;
    open?: boolean;
}

function loadLayout(): PanelLayout {
    try {
        const layout = JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY) ?? "{}");
        return typeof layout === "object" && layout !== null ? layout : {};
    } catch {
        return {};
    }
}

function saveLayout(layout: PanelLayout): void {
    try {
        localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
    } catch {
        // Storage can be blocked (private mode, sandboxed iframe); the panel works without it.
    }
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
#${PANEL_ID} [data-kind]:focus-visible, #${DETAIL_ID}:focus-visible {
    outline: 2px solid ${COLORS.brandOrange};
    outline-offset: -2px;
}
#${TOOLS_ID} [aria-pressed="false"]:hover { color: ${COLORS.ink} !important; background: ${COLORS.hoverRow} !important; }
#${PANEL_ID}, #${DETAIL_ID} { scrollbar-width: thin; scrollbar-color: ${COLORS.border} transparent; }
@keyframes minit-row-in { from { opacity: 0; transform: translateX(-16px); } to { opacity: 1; transform: none; } }
#${PANEL_ID} [data-new] { animation: minit-row-in 220ms ease-out; }
@keyframes minit-result-in { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: none; } }
#${TOOLS_ID} [data-result] { animation: minit-result-in 260ms cubic-bezier(0.2, 0.9, 0.3, 1.2); }
@keyframes minit-received {
    0% { transform: scale(0); box-shadow: 0 0 0 0 rgba(79, 191, 134, 0.7); }
    45% { transform: scale(1.35); }
    70% { transform: scale(0.9); }
    100% { transform: scale(1); box-shadow: 0 0 0 8px rgba(79, 191, 134, 0); }
}
#${TOOLS_ID} [data-received] { animation: minit-received 600ms ease-out; }
@media (prefers-reduced-motion: reduce) {
    #${PANEL_ID} [data-new], #${TOOLS_ID} [data-result], #${TOOLS_ID} [data-received] { animation: none; }
}
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
    launcher.title = "Minit SDK tools (Ctrl+M)";
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
    const ns = SVG_NS;
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
    const clampedLeft = clamp(left, EDGE, maxLeft);
    const clampedTop = clamp(top, EDGE, maxTop);
    launcher.style.left = `${clampedLeft}px`;
    launcher.style.top = `${clampedTop}px`;

    const replay = document.getElementById(REPLAY_ID);
    if (replay) {
        const onRight = clampedLeft + LAUNCHER_SIZE / 2 > window.innerWidth / 2;
        replay.style.top = `${clampedTop + (LAUNCHER_SIZE - replay.offsetHeight) / 2}px`;
        replay.style.left = onRight
            ? `${clampedLeft - GAP - replay.offsetWidth}px`
            : `${clampedLeft + LAUNCHER_SIZE + GAP}px`;
    }
}

function createReplayButton(): HTMLButtonElement {
    const replay = document.createElement("button");
    replay.id = REPLAY_ID;
    replay.type = "button";
    replay.title = "Reload the game";
    Object.assign(replay.style, {
        position: "fixed",
        display: "none",
        alignItems: "center",
        gap: "6px",
        height: "32px",
        padding: "0 14px 0 11px",
        borderRadius: "999px",
        border: `1px solid ${COLORS.border}`,
        background: COLORS.surface,
        color: COLORS.ink,
        boxShadow: "0 6px 16px rgba(0, 0, 0, 0.35)",
        font: `700 12px/1 ${FONT}`,
        cursor: "pointer",
        zIndex: Z_INDEX,
    });
    const icon = document.createElementNS(SVG_NS, "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("width", "14");
    icon.setAttribute("height", "14");
    icon.setAttribute("fill", "none");
    icon.setAttribute("stroke", "currentColor");
    icon.setAttribute("stroke-width", "2.5");
    icon.setAttribute("stroke-linecap", "round");
    icon.setAttribute("stroke-linejoin", "round");
    icon.setAttribute("aria-hidden", "true");
    for (const d of ["M21 12a9 9 0 1 1-2.64-6.36", "M21 3v6h-6"]) {
        const path = document.createElementNS(SVG_NS, "path");
        path.setAttribute("d", d);
        icon.append(path);
    }
    replay.append(icon, "Replay");
    replay.onclick = () => location.reload();
    isolate(replay);
    return replay;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

function createToolsPanel(toolList: DevTool[]): { panel: HTMLElement; header: HTMLElement; grip: HTMLElement } {
    const panel = document.createElement("div");
    panel.id = TOOLS_ID;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Minit SDK");
    isolate(panel);
    Object.assign(panel.style, {
        display: "none",
        flexDirection: "column",
        position: "fixed",
        width: `${PANEL_DEFAULT_WIDTH}px`,
        height: `${PANEL_DEFAULT_HEIGHT}px`,
        maxWidth: `calc(100vw - ${EDGE * 2}px)`,
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
    header.style.cursor = "grab";
    header.style.touchAction = "none";
    header.append(badge, title);

    const tabBar = document.createElement("div");
    tabBar.setAttribute("role", "tablist");
    Object.assign(tabBar.style, {
        display: "flex",
        gap: "20px",
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

    const grip = document.createElement("div");
    grip.setAttribute("aria-hidden", "true");
    Object.assign(grip.style, {
        position: "absolute",
        width: `${GRIP_SIZE}px`,
        height: `${GRIP_SIZE}px`,
        touchAction: "none",
        zIndex: "1",
    });
    grip.append(createGripDots());

    panel.append(header, tabBar, body, grip);
    return { panel, header, grip };
}

function anchorTools(panel: HTMLElement, grip: HTMLElement, launcher: HTMLElement): void {
    const rect = launcher.getBoundingClientRect();
    const onRight = rect.left + rect.width / 2 > window.innerWidth / 2;
    const below = rect.top + rect.height / 2 < window.innerHeight / 2;
    const room = below ? window.innerHeight - rect.bottom - GAP - EDGE : rect.top - GAP - EDGE;
    panel.style.maxHeight = `${Math.max(0, room)}px`;
    placeGrip(grip, onRight ? "left" : "right", below ? "bottom" : "top");
    const width = panel.getBoundingClientRect().width;
    const left = onRight ? rect.right - width : rect.left;
    panel.style.left = `${clamp(left, EDGE, Math.max(EDGE, window.innerWidth - width - EDGE))}px`;
    panel.style.top = below ? `${rect.bottom + GAP}px` : "";
    panel.style.bottom = below ? "" : `${window.innerHeight - rect.top + GAP}px`;
}

function placeGrip(grip: HTMLElement, horizontal: "left" | "right", vertical: "top" | "bottom"): void {
    grip.dataset.h = horizontal;
    grip.dataset.v = vertical;
    Object.assign(grip.style, {
        left: horizontal === "left" ? "3px" : "",
        right: horizontal === "right" ? "3px" : "",
        top: vertical === "top" ? "3px" : "",
        bottom: vertical === "bottom" ? "3px" : "",
        transform: `scale(${horizontal === "left" ? -1 : 1}, ${vertical === "top" ? -1 : 1})`,
        cursor: (horizontal === "left") === (vertical === "top") ? "nwse-resize" : "nesw-resize",
    });
}

function createGripDots(): SVGSVGElement {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${GRIP_SIZE} ${GRIP_SIZE}`);
    svg.setAttribute("width", String(GRIP_SIZE));
    svg.setAttribute("height", String(GRIP_SIZE));
    svg.style.display = "block";
    const centers = [3, 8, 13];
    centers.forEach((cy, row) =>
        centers.forEach((cx, column) => {
            if (row + column < 2) {
                return;
            }
            const dot = document.createElementNS(SVG_NS, "circle");
            dot.setAttribute("cx", String(cx));
            dot.setAttribute("cy", String(cy));
            dot.setAttribute("r", "1.5");
            dot.setAttribute("fill", COLORS.inkMuted);
            svg.append(dot);
        }),
    );
    return svg;
}

// The panel keeps its side of the launcher while dragging; re-anchoring mid-drag would flip it under the pointer.
function makeHeaderDraggable(header: HTMLElement, panel: HTMLElement, launcher: HTMLElement, onMove: () => void): void {
    header.addEventListener("pointerdown", (down) => {
        if (down.button !== 0) {
            return;
        }
        down.preventDefault();
        header.setPointerCapture(down.pointerId);
        header.style.cursor = "grabbing";
        const launcherStart = { left: launcher.offsetLeft, top: launcher.offsetTop };
        const panelStart = {
            left: parseFloat(panel.style.left),
            top: panel.style.top ? parseFloat(panel.style.top) : undefined,
            bottom: panel.style.bottom ? parseFloat(panel.style.bottom) : undefined,
        };
        const move = (event: PointerEvent) => {
            placeLauncher(
                launcher,
                launcherStart.left + event.clientX - down.clientX,
                launcherStart.top + event.clientY - down.clientY,
            );
            const dx = launcher.offsetLeft - launcherStart.left;
            const dy = launcher.offsetTop - launcherStart.top;
            panel.style.left = `${panelStart.left + dx}px`;
            if (panelStart.top !== undefined) {
                panel.style.top = `${panelStart.top + dy}px`;
            } else if (panelStart.bottom !== undefined) {
                panel.style.bottom = `${panelStart.bottom - dy}px`;
            }
            onMove();
        };
        const end = () => {
            header.style.cursor = "grab";
            header.removeEventListener("pointermove", move);
            header.removeEventListener("pointerup", end);
            header.removeEventListener("pointercancel", end);
        };
        header.addEventListener("pointermove", move);
        header.addEventListener("pointerup", end);
        header.addEventListener("pointercancel", end);
    });
}

function makeResizable(panel: HTMLElement, grip: HTMLElement, onResize: () => void): void {
    grip.addEventListener("pointerdown", (down) => {
        down.preventDefault();
        grip.setPointerCapture(down.pointerId);
        const start = panel.getBoundingClientRect();
        const xSign = grip.dataset.h === "left" ? -1 : 1;
        const ySign = grip.dataset.v === "top" ? -1 : 1;
        const move = (event: PointerEvent) => {
            const width = start.width + (event.clientX - down.clientX) * xSign;
            const height = start.height + (event.clientY - down.clientY) * ySign;
            panel.style.width = `${clamp(width, PANEL_MIN_WIDTH, window.innerWidth - EDGE * 2)}px`;
            panel.style.height = `${Math.max(PANEL_MIN_HEIGHT, height)}px`;
            onResize();
        };
        const end = () => {
            grip.removeEventListener("pointermove", move);
            grip.removeEventListener("pointerup", end);
            grip.removeEventListener("pointercancel", end);
        };
        grip.addEventListener("pointermove", move);
        grip.addEventListener("pointerup", end);
        grip.addEventListener("pointercancel", end);
    });
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
    const usageIndicator = document.createElement("span");
    usageIndicator.tabIndex = 0;
    usageIndicator.setAttribute("aria-describedby", DETAIL_ID);
    Object.assign(usageIndicator.style, { fontFamily: MONO, fontSize: "11px", cursor: "help" });
    toolbar.append(clearButton, groupToggle);

    const footer = document.createElement("div");
    Object.assign(footer.style, {
        display: "flex",
        justifyContent: "flex-end",
        padding: "6px 24px",
        borderTop: `1px solid ${COLORS.border}`,
        flexShrink: "0",
    });
    footer.append(usageIndicator);

    const list = document.createElement("div");
    list.id = PANEL_ID;
    Object.assign(list.style, {
        flex: "1",
        overflowY: "auto",
        overscrollBehavior: "contain",
        padding: "0 0 6px",
        minHeight: "48px",
    });

    const empty = document.createElement("div");
    empty.textContent = "No events tracked yet.";
    Object.assign(empty.style, { padding: "12px", color: COLORS.inkMuted, textAlign: "center" });
    content.append(toolbar, list, footer);

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

    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    const hideDetail = () => {
        clearTimeout(hideTimer);
        detail.style.display = "none";
    };
    const hideDetailSoon = () => {
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
            if (document.activeElement !== detail) {
                hideDetail();
            }
        }, DETAIL_HIDE_DELAY_MS);
    };
    detail.onmouseenter = () => clearTimeout(hideTimer);
    detail.onmouseleave = hideDetailSoon;
    detail.onblur = hideDetail;

    const attachDetail = (anchor: HTMLElement, render: () => void) => {
        const reveal = () => {
            clearTimeout(hideTimer);
            render();
        };
        anchor.onmouseenter = reveal;
        anchor.onmouseleave = hideDetailSoon;
        anchor.onfocus = reveal;
        anchor.onblur = (event) => {
            if (event.relatedTarget !== detail) {
                hideDetail();
            }
        };
        anchor.onkeydown = (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                reveal();
                detail.focus({ preventScroll: true });
            }
        };
    };

    const createRow = (entry: TrackedEntry, count?: number): HTMLElement => {
        const row = renderRow(entry, count);
        attachDetail(row, () => showDetail(detail, row, entry));
        return row;
    };

    const updateUsage = () => usageIndicator.replaceChildren(...renderUsage());
    attachDetail(usageIndicator, () => showUsageDetail(detail, usageIndicator));

    const replaceFocusedRow = (previous: HTMLElement, next: HTMLElement) => {
        if (document.activeElement === previous) {
            next.focus({ preventScroll: true });
        }
    };

    const groupId = (entry: TrackedEntry) => `${entry.kind}:${entry.key}`;

    const show = (entry: TrackedEntry, isNew = false) => {
        const create = (count?: number) => {
            const row = createRow(entry, count);
            if (isNew) {
                row.dataset.new = "";
            }
            return row;
        };
        if (!grouped) {
            list.insertBefore(create(), list.firstChild);
            return;
        }
        const id = groupId(entry);
        const group = groups.get(id);
        const count = (group?.count ?? 0) + 1;
        const row = create(count);
        list.insertBefore(row, list.firstChild);
        if (group) {
            replaceFocusedRow(group.row, row);
            group.row.remove();
        }
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
        group.row.after(row);
        replaceFocusedRow(group.row, row);
        group.row.remove();
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
        entries.forEach((entry) => show(entry));
    };
    groupToggle.onclick = () => setGrouped(!grouped);

    const add = (entry: TrackedEntry) => {
        entries.push(entry);
        empty.remove();
        show(entry, true);
        if (entries.length > MAX_DEV_ENTRIES) {
            evict(entries.shift()!);
        }
        countBadge.textContent = String(entries.length);
        updateUsage();
    };

    clearButton.onclick = () => {
        entries.length = 0;
        countBadge.textContent = "0";
        setGrouped(grouped);
    };

    setGrouped(false);
    countBadge.textContent = "0";
    updateUsage();
    getTrackedEntries().forEach(add);
    subscribeTrackedEntries(add);
    return tool;
}

function badgeHeader(text: string, color: string): HTMLElement {
    const header = document.createElement("div");
    header.textContent = text;
    Object.assign(header.style, {
        color,
        font: `800 10px/1.2 ${FONT}`,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
    });
    return header;
}

function badgeValue(text: string, style: Partial<CSSStyleDeclaration>): HTMLElement {
    const value = document.createElement("div");
    value.textContent = text;
    Object.assign(value.style, { maxWidth: "100%", overflowWrap: "anywhere" }, style);
    return value;
}

function createResultTool(): DevTool {
    const content = document.createElement("div");
    content.setAttribute("role", "tabpanel");
    Object.assign(content.style, {
        flexDirection: "column",
        minHeight: "0",
        flex: "1",
        overflow: "hidden",
        containerType: "size",
    });

    const status = document.createElement("span");
    Object.assign(status.style, {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "14px",
        height: "14px",
        boxSizing: "border-box",
        borderRadius: "50%",
        color: COLORS.onAccent,
        font: `900 9px/1 ${FONT}`,
    });

    const render = (reported: ReportedResult | undefined) => {
        status.title = reported ? "Result received" : "Result pending";
        status.setAttribute("aria-label", status.title);
        status.textContent = reported ? "✓" : "";
        status.style.border = reported ? "none" : `1.5px dashed ${COLORS.inkMuted}`;
        status.style.background = reported ? COLORS.pos : "transparent";
        delete status.dataset.received;
        if (reported) {
            void status.offsetWidth;
            status.dataset.received = "";
        }
        if (!reported) {
            const empty = document.createElement("div");
            empty.textContent = "No result received yet.";
            Object.assign(empty.style, {
                flex: "1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "12px",
                color: COLORS.inkMuted,
                font: `700 15px/1.4 ${FONT}`,
                textAlign: "center",
            });
            content.replaceChildren(empty);
            return;
        }
        const card = document.createElement("div");
        card.dataset.result = "";
        Object.assign(card.style, {
            flex: "1",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            position: "relative",
            padding: "16px 16px 44px",
            textAlign: "center",
        });

        const score = document.createElement("div");
        Object.assign(score.style, {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "4px",
            minWidth: "55%",
            maxWidth: "100%",
            boxSizing: "border-box",
            padding: "12px 28px 16px",
            borderRadius: "20px",
            border: "1px solid rgba(242, 121, 15, 0.55)",
            background: "linear-gradient(160deg, rgba(242, 121, 15, 0.22), rgba(242, 121, 15, 0.04) 70%)",
            boxShadow: "0 0 28px rgba(242, 121, 15, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.08)",
        });
        score.append(
            badgeHeader("Score", COLORS.brandOrange),
            badgeValue(String(reported.result), {
                color: COLORS.ink,
                font: `900 clamp(32px, 20cqmin, 88px)/1 ${FONT}`,
                textShadow: "0 2px 12px rgba(242, 121, 15, 0.35)",
            }),
        );
        card.append(score);

        if (reported.flavorText) {
            const flavor = document.createElement("div");
            Object.assign(flavor.style, {
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "3px",
                alignSelf: "stretch",
                boxSizing: "border-box",
                marginTop: "10px",
                padding: "8px 16px 10px",
                borderRadius: "12px",
                border: `1px solid ${COLORS.border}`,
                background: COLORS.surfaceSunk,
            });
            flavor.append(
                badgeHeader("Flavor Text", COLORS.inkMuted),
                badgeValue(reported.flavorText, {
                    color: COLORS.ink,
                    font: `700 clamp(12px, 5cqmin, 15px)/1.4 ${FONT}`,
                }),
            );
            card.append(flavor);
        }

        const duration = document.createElement("div");
        duration.textContent = `⏱ ${formatSeconds(reported.durationMs)}`;
        duration.title = "Play duration: from loadingDone() (or page load) to reportResult()";
        Object.assign(duration.style, {
            position: "absolute",
            right: "12px",
            bottom: "12px",
            padding: "4px 12px",
            borderRadius: "999px",
            background: COLORS.surfaceSunk,
            border: `1px solid ${COLORS.border}`,
            color: COLORS.inkSecondary,
            font: `700 12px/1.4 ${MONO}`,
        });
        card.append(duration);
        content.replaceChildren(card);
    };

    render(getReportedResult());
    subscribeReportedResult(render);
    return { label: "Result", badge: status, content };
}

function formatSeconds(ms: number): string {
    return `${(ms / 1000).toFixed(2)}s`;
}

function formatBytes(bytes: number): string {
    return bytes < 1024 ? `${bytes} B` : `${Number((bytes / 1024).toFixed(1))} KB`;
}

function usageColor(bytes: number, bytesCapDrops: number): string {
    if (bytesCapDrops > 0 || bytes >= MAX_PAYLOAD_BYTES_PER_LOAD) {
        return COLORS.neg;
    }
    return bytes >= MAX_PAYLOAD_BYTES_PER_LOAD * USAGE_WARN_RATIO ? COLORS.warn : COLORS.inkSecondary;
}

function renderUsage(): HTMLElement[] {
    const { bytes, bytesCapDrops } = getTrackedUsage();
    const size = document.createElement("span");
    size.textContent = `${formatBytes(bytes)} `;
    size.style.color = COLORS.inkSecondary;
    const percent = document.createElement("span");
    percent.textContent = `(${Math.round((bytes / MAX_PAYLOAD_BYTES_PER_LOAD) * 100)}%)`;
    percent.style.color = usageColor(bytes, bytesCapDrops);
    return [size, percent];
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
        maxHeight: `calc(100vh - ${EDGE * 2}px)`,
        overflowY: "auto",
        overscrollBehavior: "contain",
        zIndex: Z_INDEX,
    });
    detail.tabIndex = 0;
    isolate(detail);
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
        case "bytes-cap":
            return `event data this load would exceed ${formatBytes(MAX_PAYLOAD_BYTES_PER_LOAD)}`;
        case "after-result":
            return "sent after reportResult()";
    }
}

function renderFooter(lines: string[]): HTMLElement {
    const footer = document.createElement("div");
    Object.assign(footer.style, {
        paddingTop: "8px",
        marginTop: "8px",
        borderTop: `1px solid ${COLORS.border}`,
        color: COLORS.inkMuted,
    });
    footer.append(
        ...lines.map((text) => {
            const line = document.createElement("div");
            line.textContent = text;
            return line;
        }),
    );
    return footer;
}

function showUsageDetail(detail: HTMLElement, anchor: HTMLElement): void {
    const header = document.createElement("div");
    Object.assign(header.style, {
        display: "flex",
        alignItems: "baseline",
        gap: "12px",
        paddingBottom: "8px",
        marginBottom: "8px",
        borderBottom: `1px solid ${COLORS.border}`,
    });
    const title = document.createElement("span");
    title.textContent = "Total event size";
    Object.assign(title.style, { flex: "1", color: COLORS.ink, font: `700 13px/1.4 ${FONT}` });
    const total = document.createElement("span");
    total.append(...renderUsage());
    Object.assign(total.style, { flexShrink: "0", fontFamily: MONO, fontSize: "11px" });
    header.append(title, total);

    const explanation = document.createElement("div");
    explanation.textContent =
        `The sum of every tracked event's size. ` +
        `A game load may send at most ${formatBytes(MAX_PAYLOAD_BYTES_PER_LOAD)}; an event that would exceed it is dropped.`;

    detail.replaceChildren(header, explanation);
    Object.assign(detail.style, { color: COLORS.inkSecondary, fontFamily: FONT, wordBreak: "normal" });
    placeDetail(detail, anchor);
}

function showDetail(detail: HTMLElement, row: HTMLElement, entry: TrackedEntry): void {
    const lines =
        entry.kind === "event"
            ? Object.entries(entry.props).map(([name, value]) => `${name}: ${JSON.stringify(value)}`)
            : [`reason: ${describeDropReason(entry.reason)}`];
    if (lines.length === 0) {
        lines.push("no properties");
    }
    const footer = [`source: ${entry.kind === "event" && entry.key.startsWith(RESERVED_KEY_PREFIX) ? "built in" : "minit"}`];
    if (entry.kind === "event") {
        footer.unshift(`received: ${getReceivedCount(entry.key)}`);
        if (entry.bytes !== undefined) {
            footer.unshift(`size: ${formatBytes(entry.bytes)}`);
        }
    }
    detail.replaceChildren(
        renderDetailHeader(entry),
        ...lines.map((text) => {
            const line = document.createElement("div");
            line.textContent = text;
            return line;
        }),
        renderFooter(footer),
    );
    Object.assign(detail.style, {
        color: entry.kind === "event" ? COLORS.inkSecondary : COLORS.neg,
        fontFamily: MONO,
        wordBreak: "break-all",
    });
    placeDetail(detail, row);
}

function placeDetail(detail: HTMLElement, anchor: HTMLElement): void {
    detail.style.display = "block";
    const panelRect = document.getElementById(TOOLS_ID)?.getBoundingClientRect() ?? anchor.getBoundingClientRect();
    const rowRect = anchor.getBoundingClientRect();
    const width = detail.offsetWidth;
    const roomLeft = panelRect.left - GAP - EDGE;
    const roomRight = window.innerWidth - panelRect.right - GAP - EDGE;
    const left = roomLeft >= roomRight ? panelRect.left - GAP - width : panelRect.right + GAP;
    detail.style.left = `${clamp(left, EDGE, Math.max(EDGE, window.innerWidth - width - EDGE))}px`;
    detail.style.top = `${clamp(rowRect.top, EDGE, Math.max(EDGE, window.innerHeight - detail.offsetHeight - EDGE))}px`;
}
