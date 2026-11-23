import { isTestEnvironment } from "../utils.js";
import { getLatoFontFaceCSS } from "./fonts/lato.js";
import {
    MAX_DEV_ENTRIES,
    getConfigRequests,
    getReceivedCount,
    getPendingResult,
    getReportedResult,
    subscribeConfigRequests,
    subscribePendingResult,
    getTrackedEntries,
    getTrackedUsage,
    subscribeReportedResult,
    subscribeTrackedEntries,
} from "./trackDevBuffer.js";
import type { ConfigRequest, ConfigSource, PendingResult, ReportedResult } from "./trackDevBuffer.js";
import {
    MAX_EVENTS_PER_LOAD,
    MAX_PAYLOAD_BYTES_PER_LOAD,
    MAX_PROPS,
    RATE_REFILL_PER_SECOND,
    RESERVED_KEY_PREFIX,
} from "./trackLimits.js";
import type { TrackDropReason, TrackedEntry } from "./trackDevBuffer.js";
import { USER_DATA_MAX_BYTES, USER_DATA_PARAM_KEY, getUserData } from "./userData.js";
import { HAS_PLAYED_GAME_PARAM_KEY } from "./config.js";
import { hasPlayedGame } from "./tutorial/gating.js";

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
    info: "#5B8DEF",
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
const PANEL_DEFAULT_WIDTH = 380;
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
    const attachDetail = createDetailAttacher(detail);
    const saved = loadLayout();
    let selectedTab = saved.tab;
    const alerts = createAlerts();
    const settings = loadSettings();
    let openTab = (_label: string) => {};
    const tools = createToolsPanel(
        [
            createConfigTool(body, detail, attachDetail),
            createTrackedEventsTool(detail, attachDetail, alerts),
            createResultTool((label) => openTab(label)),
            createUserDataTool(alerts),
            createSuggestionsTool(),
        ],
        createSettingsTool(settings),
        selectedTab,
        (label) => {
            selectedTab = label;
            persist();
        },
    );
    openTab = tools.selectLabel;
    const launcher = createLauncher();

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
            tab: selectedTab,
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
    replay.onclick = () => {
        if (settings.closeOnReplay) {
            setOpen(false);
        }
        location.reload();
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
    attachResultIndicator(launcher);
    attachAlertBadge(launcher, alerts);

    const showResult = () => {
        if (!settings.autoOpenOnResult) {
            return;
        }
        tools.selectLabel("Result");
        if (!open) {
            setOpen(true);
        }
    };
    if (getReportedResult()) {
        showResult();
    }
    subscribeReportedResult(showResult);
}

function attachAlertBadge(launcher: HTMLElement, alerts: Alerts): void {
    const badge = document.createElement("span");
    badge.dataset.launcherAlert = "";
    badge.textContent = "!";
    badge.setAttribute("aria-hidden", "true");
    Object.assign(badge.style, {
        position: "absolute",
        top: "-6px",
        right: "-6px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "18px",
        height: "18px",
        boxSizing: "border-box",
        borderRadius: "50%",
        border: `2px solid ${COLORS.surface}`,
        background: COLORS.neg,
        color: COLORS.onAccent,
        font: `900 10px/1 ${FONT}`,
        pointerEvents: "none",
    });
    alerts.subscribe((active) => {
        if (!active) {
            badge.remove();
            launcher.setAttribute("aria-label", "Minit SDK tools");
            return;
        }
        if (!badge.isConnected) {
            launcher.append(badge);
            if (canAnimate(badge)) {
                badge.animate([{ transform: "scale(0)" }, { transform: "scale(1.3)" }, { transform: "scale(1)" }], {
                    duration: 400,
                    easing: "ease-out",
                });
            }
        }
        launcher.setAttribute("aria-label", "Minit SDK tools — has errors");
    });
}

const RING_INSET = 5;

function attachResultIndicator(launcher: HTMLElement): void {
    const size = LAUNCHER_SIZE + RING_INSET * 2;
    const radius = size / 2 - 2;
    const circumference = 2 * Math.PI * radius;
    const ring = document.createElementNS(SVG_NS, "svg");
    ring.dataset.resultCountdown = "";
    ring.setAttribute("viewBox", `0 0 ${size} ${size}`);
    ring.setAttribute("aria-hidden", "true");
    Object.assign(ring.style, {
        position: "absolute",
        left: `${-RING_INSET - 2}px`,
        top: `${-RING_INSET - 2}px`,
        width: `${size}px`,
        height: `${size}px`,
        transform: "rotate(-90deg)",
        pointerEvents: "none",
        overflow: "visible",
    });
    const track = document.createElementNS(SVG_NS, "circle");
    const progress = document.createElementNS(SVG_NS, "circle");
    for (const [circle, color] of [
        [track, "rgba(255, 255, 255, 0.18)"],
        [progress, COLORS.pos],
    ] as const) {
        circle.setAttribute("cx", String(size / 2));
        circle.setAttribute("cy", String(size / 2));
        circle.setAttribute("r", String(radius));
        circle.setAttribute("fill", "none");
        circle.setAttribute("stroke", color);
        circle.setAttribute("stroke-width", "3");
        circle.setAttribute("stroke-linecap", "round");
    }
    progress.setAttribute("stroke-dasharray", String(circumference));
    ring.append(track, progress);

    const check = document.createElementNS(SVG_NS, "svg");
    check.dataset.resultCheck = "";
    check.setAttribute("viewBox", `0 0 ${LAUNCHER_SIZE} ${LAUNCHER_SIZE}`);
    check.setAttribute("aria-hidden", "true");
    Object.assign(check.style, {
        position: "absolute",
        left: "-2px",
        top: "-2px",
        width: `${LAUNCHER_SIZE}px`,
        height: `${LAUNCHER_SIZE}px`,
        pointerEvents: "none",
    });
    const disc = document.createElementNS(SVG_NS, "circle");
    disc.setAttribute("cx", String(LAUNCHER_SIZE / 2));
    disc.setAttribute("cy", String(LAUNCHER_SIZE / 2));
    disc.setAttribute("r", String(LAUNCHER_SIZE / 2));
    disc.setAttribute("fill", COLORS.pos);
    const tick = document.createElementNS(SVG_NS, "path");
    tick.setAttribute("d", "M14 25l7 7 13-14");
    tick.setAttribute("pathLength", "1");
    tick.setAttribute("fill", "none");
    tick.setAttribute("stroke", COLORS.onAccent);
    tick.setAttribute("stroke-width", "4.5");
    tick.setAttribute("stroke-linecap", "round");
    tick.setAttribute("stroke-linejoin", "round");
    tick.setAttribute("stroke-dasharray", "1");
    tick.setAttribute("stroke-dashoffset", "1");
    check.append(disc, tick);

    let tickOffset = 1;
    let waiting = false;
    let idle: Animation | undefined;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    const animated = canAnimate(launcher);

    const drawTick = (to: number, duration: number): Promise<unknown> => {
        const from = tickOffset;
        tickOffset = to;
        tick.setAttribute("stroke-dashoffset", String(to));
        if (!animated) {
            return Promise.resolve();
        }
        return tick.animate([{ strokeDashoffset: String(from) }, { strokeDashoffset: String(to) }], {
            duration,
            easing: "ease-out",
        }).finished;
    };

    const showCheck = () => {
        clearTimeout(hideTimer);
        if (check.isConnected) {
            return;
        }
        tickOffset = 1;
        tick.setAttribute("stroke-dashoffset", "1");
        launcher.append(check);
        if (animated) {
            check.animate([{ opacity: 0, transform: "scale(0.4)" }, { opacity: 1, transform: "scale(1)" }], {
                duration: 220,
                easing: "cubic-bezier(0.2, 0.9, 0.3, 1.2)",
            });
        }
    };

    let countdown: Animation | undefined;
    const startCountdown = (pending: PendingResult) => {
        const remaining = pending.delayMs - (performance.now() - pending.reportedAt);
        if (remaining <= 0) {
            return;
        }
        waiting = true;
        disc.setAttribute("fill", COLORS.warn);
        progress.setAttribute("stroke", COLORS.warn);
        showCheck();
        void drawTick(0, 320).then(() => {
            if (animated && waiting) {
                idle = check.animate([{ transform: "scale(1)" }, { transform: "scale(0.9)" }, { transform: "scale(1)" }], {
                    duration: 900,
                    iterations: Infinity,
                    easing: "ease-in-out",
                });
            }
        });
        if (typeof progress.animate !== "function") {
            return;
        }
        countdown?.cancel();
        launcher.append(ring);
        countdown = progress.animate(
            [{ strokeDashoffset: String(circumference * (remaining / pending.delayMs)) }, { strokeDashoffset: "0" }],
            { duration: remaining, easing: "linear", fill: "forwards" },
        );
    };

    const celebrate = () => {
        countdown?.cancel();
        countdown = undefined;
        ring.remove();
        idle?.cancel();
        idle = undefined;
        const resuming = waiting && check.isConnected;
        waiting = false;
        launcher.style.background = COLORS.pos;
        disc.setAttribute("fill", COLORS.pos);
        if (resuming && animated) {
            disc.animate([{ fill: COLORS.warn }, { fill: COLORS.pos }], { duration: 250, easing: "ease-out" });
        }
        showCheck();
        void drawTick(0, resuming ? 250 : 320).then(() => {
            if (animated) {
                launcher.animate(
                    [
                        { transform: "scale(1)", boxShadow: "0 0 0 0 rgba(79, 191, 134, 0.8)" },
                        { transform: "scale(1.2)", offset: 0.35 },
                        { transform: "scale(0.94)", offset: 0.65 },
                        { transform: "scale(1)", boxShadow: "0 0 0 18px rgba(79, 191, 134, 0)" },
                    ],
                    { duration: 650, easing: "ease-out" },
                );
            }
            hideTimer = setTimeout(() => {
                if (!animated) {
                    check.remove();
                    return;
                }
                check.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: "ease-in" }).finished.then(
                    () => check.remove(),
                    () => check.remove(),
                );
            }, 1600);
        });
    };

    const pending = getPendingResult();
    if (getReportedResult()) {
        celebrate();
    } else if (pending) {
        startCountdown(pending);
    }
    subscribePendingResult(startCountdown);
    subscribeReportedResult(celebrate);
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
    tab?: string;
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
#${LAUNCHER_ID}:focus-visible, #${TOOLS_ID} button:focus-visible {
    outline: 2px solid ${COLORS.brandOrange};
    outline-offset: 2px;
}
#${TOOLS_ID} [data-edit]:hover, #${TOOLS_ID} [data-config-reset]:not(:disabled):hover { color: ${COLORS.ink} !important; background: ${COLORS.hoverRow} !important; }
#${PANEL_ID} [data-same] { background: ${COLORS.hoverRow}; }
#${PANEL_ID} [data-kind]:hover { background: ${COLORS.hoverRow}; box-shadow: inset 0 0 0 1px #3A4566; }
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
    isolate(replay);
    return replay;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

function createToolsPanel(
    toolList: DevTool[],
    settingsTool: DevTool,
    initialLabel: string | undefined,
    onSelect: (label: string) => void,
): { panel: HTMLElement; header: HTMLElement; grip: HTMLElement; selectLabel: (label: string) => void } {
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
        flex: "1",
        minWidth: "0",
        gap: "16px",
        overflowX: "auto",
        scrollbarWidth: "none",
    });

    const settingsButton = document.createElement("button");
    settingsButton.type = "button";
    settingsButton.textContent = "⚙";
    settingsButton.title = "Settings";
    settingsButton.setAttribute("aria-label", "Settings");
    settingsButton.dataset.settings = "";
    Object.assign(settingsButton.style, {
        flexShrink: "0",
        width: "26px",
        height: "26px",
        alignSelf: "center",
        padding: "0",
        borderRadius: "6px",
        border: "none",
        background: "transparent",
        font: `16px/1 ${FONT}`,
        cursor: "pointer",
    });
    settingsButton.onclick = () => {
        select(settingsTool);
        onSelect(settingsTool.label);
    };

    const tabRow = document.createElement("div");
    Object.assign(tabRow.style, {
        display: "flex",
        alignItems: "stretch",
        gap: "8px",
        padding: "0 8px 0 12px",
        borderBottom: `1px solid ${COLORS.border}`,
        flexShrink: "0",
    });
    tabRow.append(tabBar, settingsButton);

    const body = document.createElement("div");
    Object.assign(body.style, { display: "flex", flexDirection: "column", minHeight: "0", flex: "1" });

    const select = (active: DevTool) => {
        const settingsSelected = active === settingsTool;
        settingsTool.content.style.display = settingsSelected ? "flex" : "none";
        settingsButton.setAttribute("aria-pressed", String(settingsSelected));
        settingsButton.style.color = settingsSelected ? COLORS.brandOrange : COLORS.inkSecondary;
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
            flexShrink: "0",
            whiteSpace: "nowrap",
            padding: "6px 2px 8px",
            marginBottom: "-1px",
            border: "none",
            borderBottom: "2px solid transparent",
            background: "transparent",
            font: `700 12px/1.2 ${FONT}`,
            cursor: "pointer",
        });
        tab.onclick = () => {
            select(tool);
            onSelect(tool.label);
        };
        tool.tab = tab;
        tabBar.append(tab);
        body.append(tool.content);
    }
    body.append(settingsTool.content);
    const allTools = [...toolList, settingsTool];
    select(allTools.find((tool) => tool.label === initialLabel) ?? toolList[0]);

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

    panel.append(header, tabRow, body, grip);
    const selectLabel = (label: string) => {
        const tool = allTools.find((candidate) => candidate.label === label);
        if (tool) {
            select(tool);
            onSelect(label);
        }
    };
    return { panel, header, grip, selectLabel };
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

type AttachDetail = (anchor: HTMLElement, render: () => void) => void;

function createDetailAttacher(detail: HTMLElement): AttachDetail {
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

    return (anchor, render) => {
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
}

interface Alerts {
    set(id: string, active: boolean): void;
    subscribe(listener: (active: boolean) => void): void;
}

function createAlerts(): Alerts {
    const active = new Set<string>();
    const listeners = new Set<(active: boolean) => void>();
    return {
        set(id, on) {
            if (active.has(id) === on) {
                return;
            }
            if (on) {
                active.add(id);
            } else {
                active.delete(id);
            }
            listeners.forEach((listener) => listener(active.size > 0));
        },
        subscribe(listener) {
            listeners.add(listener);
            listener(active.size > 0);
        },
    };
}

function createNotice(tone: "info" | "error"): HTMLElement {
    const notice = document.createElement("div");
    notice.dataset.notice = tone;
    Object.assign(notice.style, {
        margin: "8px 12px 6px",
        padding: "6px 10px",
        borderRadius: "8px",
        border: `1px solid ${tone === "info" ? COLORS.info : COLORS.neg}`,
        background: tone === "info" ? "rgba(91, 141, 239, 0.12)" : "rgba(224, 108, 108, 0.14)",
        color: COLORS.ink,
        font: `11px/1.5 ${FONT}`,
        flexShrink: "0",
    });
    return notice;
}

function setNoticeLines(notice: HTMLElement, title: string, lines: string[]): void {
    const heading = document.createElement("div");
    heading.textContent = title;
    heading.style.fontWeight = "700";
    notice.replaceChildren(
        heading,
        ...lines.map((text) => {
            const line = document.createElement("div");
            line.textContent = text;
            return line;
        }),
    );
}

function createCountBadge(): HTMLElement {
    const badge = document.createElement("span");
    Object.assign(badge.style, {
        minWidth: "18px",
        padding: "0 6px",
        boxSizing: "border-box",
        borderRadius: "999px",
        background: COLORS.border,
        color: COLORS.ink,
        font: `700 10px/16px ${FONT}`,
        textAlign: "center",
    });
    return badge;
}

function setBadgeAlert(badge: HTMLElement, alert: boolean): void {
    badge.toggleAttribute("data-alert", alert);
    badge.style.background = alert ? COLORS.neg : COLORS.border;
    badge.style.color = alert ? COLORS.onAccent : COLORS.ink;
}

interface UsageFooter {
    element: HTMLElement;
    indicator: HTMLElement;
    update(bytes: number, max: number, overflowed: boolean): void;
}

function createUsageFooter(label: string): UsageFooter {
    const indicator = document.createElement("span");
    indicator.tabIndex = 0;
    indicator.setAttribute("aria-describedby", DETAIL_ID);
    Object.assign(indicator.style, { flexShrink: "0", fontFamily: MONO, fontSize: "11px", cursor: "help" });

    const track = document.createElement("div");
    track.setAttribute("role", "progressbar");
    track.setAttribute("aria-label", label);
    track.setAttribute("aria-valuemin", "0");
    track.setAttribute("aria-valuemax", "100");
    Object.assign(track.style, {
        flex: "1",
        height: "6px",
        borderRadius: "999px",
        background: COLORS.surfaceSunk,
        overflow: "hidden",
    });
    const fill = document.createElement("div");
    Object.assign(fill.style, { height: "100%", borderRadius: "999px", transition: "width 150ms ease-out" });
    track.append(fill);

    const row = document.createElement("div");
    Object.assign(row.style, { display: "flex", alignItems: "center", gap: "10px" });
    row.append(track, indicator);

    const element = document.createElement("div");
    Object.assign(element.style, {
        padding: "8px 12px",
        borderTop: `1px solid ${COLORS.border}`,
        flexShrink: "0",
    });
    element.append(row);

    return {
        element,
        indicator,
        update(bytes, max, overflowed) {
            indicator.replaceChildren(...renderUsage(bytes, max, overflowed));
            const percent = remainingPercent(bytes, max);
            track.setAttribute("aria-valuenow", String(percent));
            fill.style.width = `${percent}%`;
            fill.style.background = usageColor(bytes, max, overflowed, COLORS.pos);
        },
    };
}

function createTrackedEventsTool(detail: HTMLElement, attachDetail: AttachDetail, alerts: Alerts): DevTool {
    const content = document.createElement("div");
    content.setAttribute("role", "tabpanel");
    Object.assign(content.style, { flexDirection: "column", minHeight: "0", flex: "1" });

    const disclaimer = createNotice("info");
    disclaimer.textContent = "Check out the tracked events for your games in Minit Studio!";
    disclaimer.style.fontWeight = "700";
    const dropNotice = createNotice("error");
    dropNotice.style.display = "none";

    const usage = createUsageFooter("Remaining event size");

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
    content.append(dropNotice, disclaimer, list, usage.element);

    const countBadge = createCountBadge();
    const tool: DevTool = { label: "Tracking", badge: countBadge, content };
    const entries: TrackedEntry[] = [];
    const dropsByReason = new Map<TrackDropReason, number>();

    const updateUsage = () => {
        const { bytes, bytesCapDrops } = getTrackedUsage();
        usage.update(bytes, MAX_PAYLOAD_BYTES_PER_LOAD, bytesCapDrops > 0);
    };
    attachDetail(usage.indicator, () => showUsageDetail(detail, usage.indicator));

    const recordDrop = (reason: TrackDropReason) => {
        dropsByReason.set(reason, (dropsByReason.get(reason) ?? 0) + 1);
        const total = [...dropsByReason.values()].reduce((sum, count) => sum + count, 0);
        setNoticeLines(
            dropNotice,
            `${total} ${total === 1 ? "event was" : "events were"} thrown away and never sent:`,
            [...dropsByReason].map(([dropReason, count]) => `${count}× ${describeDropReason(dropReason)}`),
        );
        dropNotice.style.display = "block";
        setBadgeAlert(countBadge, true);
        alerts.set("tracking", true);
    };

    const highlightSameType = (row: HTMLElement | undefined) => {
        for (const other of list.children) {
            const element = other as HTMLElement;
            const same = row !== undefined && element.dataset.kind === row.dataset.kind && element.dataset.key === row.dataset.key;
            element.toggleAttribute("data-same", same);
        }
    };

    const add = (entry: TrackedEntry) => {
        entries.push(entry);
        empty.remove();
        const row = renderRow(entry);
        row.dataset.new = "";
        attachDetail(row, () => showDetail(detail, row, entry));
        row.addEventListener("mouseenter", () => highlightSameType(row));
        row.addEventListener("mouseleave", () => highlightSameType(undefined));
        row.addEventListener("focus", () => highlightSameType(row));
        row.addEventListener("blur", () => highlightSameType(undefined));
        list.insertBefore(row, list.firstChild);
        if (entries.length > MAX_DEV_ENTRIES) {
            entries.shift();
            list.lastElementChild?.remove();
        }
        countBadge.textContent = String(entries.length);
        if (entry.kind === "drop") {
            recordDrop(entry.reason);
        }
        updateUsage();
    };

    list.append(empty);
    countBadge.textContent = "0";
    updateUsage();
    getTrackedEntries().forEach(add);
    subscribeTrackedEntries(add);
    return tool;
}

function createUserDataTool(alerts: Alerts): DevTool {
    const content = document.createElement("div");
    content.setAttribute("role", "tabpanel");
    Object.assign(content.style, { flexDirection: "column", minHeight: "0", flex: "1" });

    const errorNotice = createNotice("error");
    errorNotice.style.display = "none";

    const value = document.createElement("div");
    value.dataset.userDataValue = "";
    Object.assign(value.style, {
        flex: "1",
        minHeight: "48px",
        display: "flex",
        flexDirection: "column",
        padding: "16px",
        boxSizing: "border-box",
        overflowY: "auto",
        overscrollBehavior: "contain",
    });

    const usage = createUsageFooter("Remaining user data size");
    content.append(errorNotice, value, usage.element);

    const badge = document.createElement("span");
    badge.textContent = "!";
    Object.assign(badge.style, {
        display: "none",
        alignItems: "center",
        justifyContent: "center",
        width: "16px",
        height: "16px",
        borderRadius: "50%",
        background: COLORS.neg,
        color: COLORS.onAccent,
        font: `900 10px/1 ${FONT}`,
    });

    const render = (userData: string | undefined, label: string, reported: boolean) => {
        const bytes = userData === undefined ? 0 : utf8Bytes(userData);
        const tooBig = reported && bytes > USER_DATA_MAX_BYTES;
        usage.update(bytes, USER_DATA_MAX_BYTES, tooBig);

        if (userData === undefined) {
            const empty = document.createElement("div");
            empty.textContent = "No user data yet.";
            Object.assign(empty.style, {
                margin: "auto",
                color: COLORS.inkMuted,
                font: `700 15px/1.4 ${FONT}`,
                textAlign: "center",
            });
            value.replaceChildren(empty);
        } else {
            const card = document.createElement("div");
            card.dataset.result = "";
            Object.assign(card.style, {
                margin: "auto 0",
                alignSelf: "stretch",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "6px",
                boxSizing: "border-box",
                padding: "10px 16px 12px",
                borderRadius: "12px",
                border: `1px solid ${tooBig ? COLORS.neg : COLORS.border}`,
                background: COLORS.surfaceSunk,
            });
            const pre = document.createElement("pre");
            pre.textContent = userData === "" ? '""' : formatUserData(userData);
            Object.assign(pre.style, {
                margin: "0",
                alignSelf: "stretch",
                color: COLORS.ink,
                font: `12px/1.6 ${MONO}`,
                textAlign: "left",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
            });
            card.append(badgeHeader(label, COLORS.inkMuted), pre);
            value.replaceChildren(card);
        }

        errorNotice.style.display = tooBig ? "block" : "none";
        if (tooBig) {
            setNoticeLines(errorNotice, "User data too big", [
                `reportResult() passed ${formatBytes(bytes)} of userData, over the ${formatBytes(USER_DATA_MAX_BYTES)} cap. ` +
                    "The platform will discard it, so it is not saved for this player.",
            ]);
        }
        badge.style.display = tooBig ? "flex" : "none";
        alerts.set("userData", tooBig);
    };

    render(getUserData(), "Loaded at start", false);
    const onResult = (reported: ReportedResult) => {
        if (reported.userData !== undefined) {
            render(reported.userData, "Reported with reportResult()", true);
        }
    };
    const existing = getReportedResult();
    if (existing) {
        onResult(existing);
    }
    subscribeReportedResult(onResult);
    return { label: "User data", badge, content };
}

type CheckStatus = "pass" | "warn" | "unverified";

interface Check {
    title: string;
    status: CheckStatus;
    hint: string;
}

type MetaState = { status: "loading" } | { status: "missing" } | { status: "ok"; configCount: number };

const CHECK_STYLE: Record<CheckStatus, { color: string; background: string; label: string }> = {
    pass: { color: COLORS.pos, background: "rgba(79, 191, 134, 0.16)", label: "Done" },
    warn: { color: COLORS.warn, background: "rgba(229, 184, 76, 0.16)", label: "Needs attention" },
    unverified: { color: COLORS.inkMuted, background: COLORS.surfaceSunk, label: "Not verified" },
};

function externalOrigins(): string[] {
    const origins = new Set<string>();
    for (const entry of performance.getEntriesByType?.("resource") ?? []) {
        try {
            const url = new URL(entry.name);
            if ((url.protocol === "http:" || url.protocol === "https:") && url.origin !== window.location.origin) {
                origins.add(url.origin);
            }
        } catch {
            // Not a URL: nothing to report.
        }
    }
    return [...origins];
}

function collectChecks(meta: MetaState): Check[] {
    const loadingDone = getReceivedCount(`${RESERVED_KEY_PREFIX}loading_done`) > 0;
    const resultReported = getReceivedCount(`${RESERVED_KEY_PREFIX}result`) > 0 || getReportedResult() !== undefined;
    const tutorialGated = getConfigRequests().some((request) => request.key === TUTORIAL_PARAM);
    const origins = externalOrigins();

    const configCheck = (): Check => {
        const title = "Declares config values";
        if (meta.status === "loading") {
            return { title, status: "unverified", hint: "Checking meta.json…" };
        }
        if (meta.status === "missing") {
            return { title, status: "warn", hint: "Couldn't load meta.json next to your index.html." };
        }
        return meta.configCount > 0
            ? {
                  title,
                  status: "pass",
                  hint: `${meta.configCount} config value${meta.configCount === 1 ? "" : "s"} declared in meta.json.`,
              }
            : { title, status: "warn", hint: "Recommended: declare config values in meta.json so other creators can mod your Game." };
    };

    return [
        { title: "Uses the Minit SDK", status: "pass", hint: "We detected the Minit SDK in your code." },
        loadingDone
            ? { title: "Signals when it is ready to play", status: "pass", hint: "Your Game calls loadingDone() when everything is loaded." }
            : {
                  title: "Signals when it is ready to play",
                  status: "warn",
                  hint: "Platform requirement: call loadingDone() from the Minit SDK once your Game is ready to play.",
              },
        resultReported
            ? { title: "Reports a result", status: "pass", hint: "Your Game sends us a score when it is over." }
            : {
                  title: "Reports a result",
                  status: "unverified",
                  hint: "Play a run to the end to check this. Call reportResult(score) once when the game ends.",
              },
        tutorialGated
            ? { title: "First-play tutorial", status: "pass", hint: "Your Game shows its tutorial only to first-time players." }
            : {
                  title: "First-play tutorial",
                  status: "warn",
                  hint: "Recommended: add a brief first-play tutorial and show it only when shouldShowTutorial() is true.",
              },
        configCheck(),
        origins.length === 0
            ? { title: "No external requests", status: "pass", hint: "Everything loads from inside your bundle." }
            : {
                  title: "No external requests",
                  status: "warn",
                  hint:
                      `Platform requirement: bundle every file your Game needs. It loads from ${origins.slice(0, 3).join(", ")}` +
                      `${origins.length > 3 ? " and more" : ""}.`,
              },
    ];
}

function renderCheckIcon(status: CheckStatus): HTMLElement {
    const style = CHECK_STYLE[status];
    const badge = document.createElement("span");
    badge.dataset.checkStatus = status;
    badge.setAttribute("role", "img");
    badge.setAttribute("aria-label", style.label);
    Object.assign(badge.style, {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: "0",
        width: "24px",
        height: "24px",
        borderRadius: "50%",
        background: style.background,
        color: style.color,
        font: `900 13px/1 ${FONT}`,
    });
    if (status === "unverified") {
        badge.textContent = "?";
        return badge;
    }
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 14 14");
    svg.setAttribute("width", "14");
    svg.setAttribute("height", "14");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    const paths = status === "pass" ? ["M3 7.5l2.5 2.5L11 4.5"] : ["M7 1.8L12.6 11.8H1.4Z", "M7 5.6v2.8", "M7 10.1v0.1"];
    for (const d of paths) {
        const path = document.createElementNS(SVG_NS, "path");
        path.setAttribute("d", d);
        svg.append(path);
    }
    badge.append(svg);
    return badge;
}

function createSuggestionsTool(): DevTool {
    const content = document.createElement("div");
    content.setAttribute("role", "tabpanel");
    Object.assign(content.style, { flexDirection: "column", minHeight: "0", flex: "1", overflowY: "auto" });

    const badge = createCountBadge();
    let meta: MetaState = { status: "loading" };

    const render = () => {
        const checks = collectChecks(meta);
        const done = checks.filter((check) => check.status === "pass").length;
        badge.textContent = `${done}/${checks.length}`;

        const header = document.createElement("div");
        Object.assign(header.style, {
            display: "flex",
            alignItems: "baseline",
            gap: "8px",
            padding: "10px 12px 6px",
        });
        const title = document.createElement("span");
        title.textContent = "Optimisation checklist";
        Object.assign(title.style, { flex: "1", font: `700 13px/1.4 ${FONT}` });
        const summary = document.createElement("span");
        summary.textContent = `${done} of ${checks.length} done`;
        Object.assign(summary.style, { color: COLORS.inkMuted, fontSize: "11px" });
        header.append(title, summary);

        const rows = checks.map((check) => {
            const row = document.createElement("div");
            row.dataset.check = check.title;
            Object.assign(row.style, {
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                padding: "8px 12px",
                borderTop: `1px solid ${COLORS.border}`,
            });
            const text = document.createElement("div");
            Object.assign(text.style, { flex: "1", minWidth: "0", display: "flex", flexDirection: "column", gap: "2px" });
            const name = document.createElement("span");
            name.textContent = check.title;
            name.style.fontWeight = "700";
            const hint = document.createElement("span");
            hint.textContent = check.hint;
            Object.assign(hint.style, { color: COLORS.inkSecondary, fontSize: "11px", overflowWrap: "anywhere" });
            text.append(name, hint);
            row.append(renderCheckIcon(check.status), text);
            return row;
        });
        content.replaceChildren(header, ...rows);
    };

    render();
    Promise.resolve()
        .then(() => fetch(new URL("meta.json", document.baseURI), { cache: "no-store" }))
        .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
        .then((json: { config?: unknown }) => {
            meta = { status: "ok", configCount: Array.isArray(json.config) ? json.config.length : 0 };
        })
        .catch(() => {
            meta = { status: "missing" };
        })
        .finally(render);
    subscribeTrackedEntries(render);
    subscribeReportedResult(render);
    subscribeConfigRequests(render);
    if (typeof PerformanceObserver === "function") {
        try {
            new PerformanceObserver(render).observe({ type: "resource", buffered: false });
        } catch {
            // Resource timing unsupported: the list stays as first rendered.
        }
    }
    return { label: "Suggestions", badge, content };
}

const CONFIG_SOURCE_STYLE: Record<ConfigSource, { label: string; color: string; background: string }> = {
    injected: { label: "injected", color: COLORS.brandOrange, background: "rgba(242, 121, 15, 0.14)" },
    default: { label: "default", color: COLORS.inkSecondary, background: COLORS.surfaceSunk },
    missing: { label: "missing", color: COLORS.inkMuted, background: "transparent" },
};

const TUTORIAL_PARAM = "tutorial";

interface DevSettings {
    autoOpenOnResult: boolean;
    closeOnReplay: boolean;
}

const SETTINGS_STORAGE_KEY = "minit-dev-tools-settings";
const DEFAULT_SETTINGS: DevSettings = { autoOpenOnResult: true, closeOnReplay: true };

function loadSettings(): DevSettings {
    try {
        const stored: unknown = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? "{}");
        const values = stored !== null && typeof stored === "object" ? (stored as Partial<DevSettings>) : {};
        return {
            autoOpenOnResult: typeof values.autoOpenOnResult === "boolean" ? values.autoOpenOnResult : DEFAULT_SETTINGS.autoOpenOnResult,
            closeOnReplay: typeof values.closeOnReplay === "boolean" ? values.closeOnReplay : DEFAULT_SETTINGS.closeOnReplay,
        };
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
}

function saveSettings(settings: DevSettings): void {
    try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
        // Storage blocked: the setting still applies until the next reload.
    }
}

function createSwitch(checked: boolean, label: string, onToggle: (next: boolean) => void): HTMLButtonElement {
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.setAttribute("role", "switch");
    toggle.setAttribute("aria-label", label);
    Object.assign(toggle.style, {
        position: "relative",
        flexShrink: "0",
        width: "34px",
        height: "20px",
        padding: "0",
        borderRadius: "999px",
        border: "none",
        cursor: "pointer",
    });
    const knob = document.createElement("span");
    Object.assign(knob.style, {
        position: "absolute",
        top: "2px",
        width: "16px",
        height: "16px",
        borderRadius: "50%",
        background: COLORS.onAccent,
        transition: "left 120ms ease",
    });
    toggle.append(knob);
    let state = checked;
    const paint = () => {
        toggle.setAttribute("aria-checked", String(state));
        toggle.style.background = state ? COLORS.brandOrange : COLORS.border;
        knob.style.left = state ? "16px" : "2px";
    };
    paint();
    toggle.onclick = () => {
        state = !state;
        paint();
        onToggle(state);
    };
    return toggle;
}

function createSettingsTool(settings: DevSettings): DevTool {
    const content = document.createElement("div");
    content.setAttribute("role", "tabpanel");
    Object.assign(content.style, { flexDirection: "column", minHeight: "0", flex: "1", overflowY: "auto" });

    const heading = document.createElement("div");
    heading.textContent = "Settings";
    Object.assign(heading.style, { padding: "10px 12px 6px", font: `700 13px/1.4 ${FONT}` });

    const row = (key: keyof DevSettings, title: string, hint: string) => {
        const element = document.createElement("div");
        element.dataset.setting = key;
        Object.assign(element.style, {
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "10px 12px",
            borderTop: `1px solid ${COLORS.border}`,
        });
        const text = document.createElement("div");
        Object.assign(text.style, { flex: "1", minWidth: "0", display: "flex", flexDirection: "column", gap: "2px" });
        const name = document.createElement("span");
        name.textContent = title;
        name.style.fontWeight = "700";
        const description = document.createElement("span");
        description.textContent = hint;
        Object.assign(description.style, { color: COLORS.inkSecondary, fontSize: "11px" });
        text.append(name, description);
        const toggle = createSwitch(settings[key], title, (next) => {
            settings[key] = next;
            saveSettings(settings);
        });
        element.append(text, toggle);
        return element;
    };

    content.append(
        heading,
        row("autoOpenOnResult", "Open on result", "Open the panel on the Result tab when the result arrives."),
        row("closeOnReplay", "Close on replay", "Close the panel when you press Replay."),
    );
    return { label: "Settings", content };
}

function reloadWithParams(params: Record<string, string | undefined>): void {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined) {
            url.searchParams.delete(key);
        } else {
            url.searchParams.set(key, value);
        }
    }
    window.location.assign(url.toString());
}

function createConfigTool(body: HTMLElement, detail: HTMLElement, attachDetail: AttachDetail): DevTool {
    const content = document.createElement("div");
    content.setAttribute("role", "tabpanel");
    Object.assign(content.style, { flexDirection: "column", minHeight: "0", flex: "1" });

    const list = document.createElement("div");
    Object.assign(list.style, {
        display: "flex",
        flexDirection: "column",
        flex: "1",
        minHeight: "0",
        overflowY: "auto",
        overscrollBehavior: "contain",
    });
    content.append(list, createConfigFooter());

    const countBadge = createCountBadge();

    const render = (allRequests: readonly ConfigRequest[]) => {
        const requests = allRequests.filter((request) => request.key !== TUTORIAL_PARAM);
        countBadge.textContent = String(requests.length);
        const tutorialRow = renderTutorialSection(detail, attachDetail);
        if (requests.length === 0) {
            const empty = document.createElement("div");
            empty.textContent = "No config values requested yet.";
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
            list.replaceChildren(tutorialRow, empty);
            return;
        }
        const openEditor = (focusKey: string) => openConfigEditor(body, requests, focusKey);
        list.replaceChildren(tutorialRow, ...requests.map((request) => renderConfigRow(request, openEditor)));
    };

    render(getConfigRequests());
    subscribeConfigRequests(render);
    return { label: "Config", badge: countBadge, content };
}

function createConfigFooter(): HTMLElement {
    const injectedKeys = [...new URLSearchParams(window.location.search).keys()].filter((key) => key !== USER_DATA_PARAM_KEY);

    const reset = document.createElement("button");
    reset.type = "button";
    reset.textContent = "Reset to defaults";
    reset.dataset.configReset = "";
    reset.disabled = injectedKeys.length === 0;
    reset.title = reset.disabled ? "Nothing injected" : `Remove ${injectedKeys.join(", ")} and reload`;
    Object.assign(reset.style, {
        padding: "4px 12px",
        borderRadius: "999px",
        border: `1px solid ${COLORS.border}`,
        background: "transparent",
        color: reset.disabled ? COLORS.inkMuted : COLORS.inkSecondary,
        font: `700 11px/1.4 ${FONT}`,
        cursor: reset.disabled ? "default" : "pointer",
    });
    reset.onclick = () => reloadWithParams(Object.fromEntries(injectedKeys.map((key) => [key, undefined])));

    const footer = document.createElement("div");
    Object.assign(footer.style, {
        display: "flex",
        justifyContent: "flex-end",
        padding: "8px 12px",
        borderTop: `1px solid ${COLORS.border}`,
        flexShrink: "0",
    });
    footer.append(reset);
    return footer;
}

function renderSourcePill(source: ConfigSource): HTMLElement {
    const style = CONFIG_SOURCE_STYLE[source];
    const pill = document.createElement("span");
    pill.textContent = style.label;
    Object.assign(pill.style, {
        flexShrink: "0",
        width: "60px",
        boxSizing: "border-box",
        padding: "1px 0",
        borderRadius: "999px",
        border: `1px solid ${source === "injected" ? "rgba(242, 121, 15, 0.5)" : COLORS.border}`,
        background: style.background,
        color: style.color,
        font: `700 10px/1.5 ${FONT}`,
        textAlign: "center",
    });
    return pill;
}

function configRowStyle(row: HTMLElement): void {
    Object.assign(row.style, {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "6px 12px",
        borderBottom: `1px solid ${COLORS.border}`,
    });
}

function renderTutorialSection(detail: HTMLElement, attachDetail: AttachDetail): HTMLElement {
    const section = document.createElement("div");
    const cutline = document.createElement("div");
    Object.assign(cutline.style, { margin: "6px 12px 10px", borderTop: `1px dashed ${COLORS.inkMuted}` });
    section.append(renderTutorialRow(detail, attachDetail), cutline);
    return section;
}

function renderTutorialRow(detail: HTMLElement, attachDetail: AttachDetail): HTMLElement {
    const firstTime = !hasPlayedGame();

    const row = document.createElement("div");
    row.dataset.configKey = TUTORIAL_PARAM;
    configRowStyle(row);
    Object.assign(row.style, { padding: "12px 12px 10px", borderBottom: "none" });

    const label = document.createElement("span");
    label.tabIndex = 0;
    label.setAttribute("aria-describedby", DETAIL_ID);
    Object.assign(label.style, { flex: "1", minWidth: "0", display: "flex", flexDirection: "column", cursor: "help" });
    attachDetail(label, () => showTutorialDetail(detail, label));
    const title = document.createElement("span");
    title.textContent = "First-time user";
    title.style.fontWeight = "700";
    const subtitle = document.createElement("span");
    subtitle.textContent = `tutorial required · hasPlayedGame: ${!firstTime}`;
    Object.assign(subtitle.style, { color: COLORS.inkMuted, fontSize: "11px" });
    label.append(title, subtitle);

    const toggle = createSwitch(firstTime, "First-time user", () =>
        reloadWithParams({ [HAS_PLAYED_GAME_PARAM_KEY]: String(firstTime), [TUTORIAL_PARAM]: undefined }),
    );

    row.append(label, toggle);
    return row;
}

function showTutorialDetail(detail: HTMLElement, anchor: HTMLElement): void {
    const title = document.createElement("div");
    title.textContent = "First-time user";
    Object.assign(title.style, {
        paddingBottom: "8px",
        marginBottom: "8px",
        borderBottom: `1px solid ${COLORS.border}`,
        color: COLORS.ink,
        font: `700 13px/1.4 ${FONT}`,
    });
    const text = document.createElement("div");
    text.textContent =
        "Use a tutorial to guide new players through your Minit. " +
        "Toggle this to preview what first-time and returning players see — it sets hasPlayedGame just like the app does.";
    detail.replaceChildren(title, text);
    Object.assign(detail.style, { color: COLORS.inkSecondary, fontFamily: FONT, wordBreak: "normal" });
    placeDetail(detail, anchor);
}

function openConfigEditor(body: HTMLElement, requests: readonly ConfigRequest[], focusKey: string): void {
    const backdrop = document.createElement("div");
    backdrop.setAttribute("role", "dialog");
    backdrop.setAttribute("aria-modal", "true");
    backdrop.setAttribute("aria-label", "Edit config");
    Object.assign(backdrop.style, {
        position: "fixed",
        inset: "0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: `${EDGE}px`,
        background: "rgba(5, 8, 16, 0.6)",
        zIndex: Z_INDEX,
        fontFamily: FONT,
        fontSize: "13px",
        color: COLORS.ink,
    });
    isolate(backdrop);

    const dialog = document.createElement("form");
    Object.assign(dialog.style, {
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        width: "min(380px, 100%)",
        maxHeight: "100%",
        boxSizing: "border-box",
        padding: "16px",
        borderRadius: "14px",
        border: `1px solid ${COLORS.border}`,
        background: COLORS.surface,
        boxShadow: "0 16px 40px rgba(0, 0, 0, 0.5)",
    });

    const title = document.createElement("div");
    title.textContent = "Edit config";
    title.style.font = `800 15px/1.3 ${FONT}`;
    const hint = document.createElement("div");
    hint.textContent = "Applying sets these as query params and reloads the game. Leave a field empty to use the default.";
    Object.assign(hint.style, { color: COLORS.inkSecondary, fontSize: "12px" });

    const fields = document.createElement("div");
    Object.assign(fields.style, { display: "flex", flexDirection: "column", gap: "10px", overflowY: "auto", minHeight: "0" });
    const inputs = new Map<string, HTMLInputElement>();
    for (const request of requests) {
        const field = document.createElement("label");
        Object.assign(field.style, { display: "flex", flexDirection: "column", gap: "4px" });
        const name = document.createElement("span");
        name.textContent = request.key;
        Object.assign(name.style, { fontWeight: "700", overflowWrap: "anywhere" });
        const input = document.createElement("input");
        input.type = "text";
        input.value = request.source === "injected" ? (request.value ?? "") : "";
        input.placeholder = request.source === "default" ? `default: ${request.value}` : "not set";
        Object.assign(input.style, {
            padding: "6px 8px",
            borderRadius: "8px",
            border: `1px solid ${COLORS.border}`,
            background: COLORS.surfaceSunk,
            color: COLORS.ink,
            font: `12px/1.4 ${MONO}`,
            outline: "none",
        });
        input.onfocus = () => (input.style.borderColor = COLORS.brandOrange);
        input.onblur = () => (input.style.borderColor = COLORS.border);
        field.append(name, input);
        fields.append(field);
        inputs.set(request.key, input);
    }

    const actions = document.createElement("div");
    Object.assign(actions.style, { display: "flex", justifyContent: "flex-end", gap: "8px" });
    const buttonStyle = {
        padding: "6px 14px",
        borderRadius: "999px",
        font: `700 12px/1.4 ${FONT}`,
        cursor: "pointer",
    };
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "Cancel";
    Object.assign(cancel.style, buttonStyle, {
        border: `1px solid ${COLORS.border}`,
        background: "transparent",
        color: COLORS.inkSecondary,
    });
    const apply = document.createElement("button");
    apply.type = "submit";
    apply.textContent = "Apply & reload";
    Object.assign(apply.style, buttonStyle, {
        border: `1px solid ${COLORS.brandOrange}`,
        background: COLORS.brandOrange,
        color: COLORS.onAccent,
    });
    actions.append(cancel, apply);

    const close = () => {
        backdrop.remove();
        document.removeEventListener("keydown", onKeyDown, true);
    };
    const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
            event.stopPropagation();
            close();
        }
    };
    document.addEventListener("keydown", onKeyDown, true);
    cancel.onclick = close;
    let pressedOnBackdrop = false;
    backdrop.addEventListener("pointerdown", (event) => {
        pressedOnBackdrop = event.target === backdrop;
    });
    backdrop.onclick = (event) => {
        if (event.target === backdrop && pressedOnBackdrop) {
            close();
        }
        pressedOnBackdrop = false;
    };
    dialog.onsubmit = (event) => {
        event.preventDefault();
        const params: Record<string, string | undefined> = {};
        for (const [key, input] of inputs) {
            params[key] = input.value === "" ? undefined : input.value;
        }
        reloadWithParams(params);
    };

    dialog.append(title, hint, fields, actions);
    backdrop.append(dialog);
    body.append(backdrop);
    inputs.get(focusKey)?.focus();
}

function renderConfigRow(request: ConfigRequest, openEditor: (focusKey: string) => void): HTMLElement {
    const row = document.createElement("div");
    row.dataset.configKey = request.key;
    configRowStyle(row);

    const key = document.createElement("span");
    key.textContent = request.key;
    key.title = request.key;
    Object.assign(key.style, {
        flex: "1",
        minWidth: "0",
        fontWeight: "700",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    });

    const valueText = request.value === undefined ? "—" : request.value === "" ? '""' : request.value;
    const value = document.createElement("span");
    value.textContent = valueText;
    value.title = valueText;
    Object.assign(value.style, {
        maxWidth: "45%",
        color: request.value === undefined ? COLORS.inkMuted : COLORS.ink,
        fontFamily: MONO,
        fontSize: "11px",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    });

    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "✎";
    edit.title = `Edit ${request.key}`;
    edit.setAttribute("aria-label", `Edit ${request.key}`);
    edit.dataset.edit = "";
    Object.assign(edit.style, {
        flexShrink: "0",
        width: "24px",
        height: "24px",
        padding: "0",
        borderRadius: "6px",
        border: `1px solid ${COLORS.border}`,
        background: "transparent",
        color: COLORS.inkSecondary,
        font: `13px/1 ${FONT}`,
        cursor: "pointer",
    });
    edit.onclick = () => openEditor(request.key);

    row.append(renderSourcePill(request.source), key, value, edit);
    return row;
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

function renderUserDataButton(reported: ReportedResult, openTab: (label: string) => void): HTMLElement {
    const received = reported.userData !== undefined;
    const tooBig = received && utf8Bytes(reported.userData!) > USER_DATA_MAX_BYTES;
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.userData = tooBig ? "too-big" : received ? "received" : "none";
    button.textContent = tooBig ? "⚠ userData too big" : received ? "✓ userData" : "no userData";
    const tone = tooBig
        ? { color: COLORS.neg, background: "rgba(224, 108, 108, 0.14)", border: "rgba(224, 108, 108, 0.5)" }
        : received
          ? { color: COLORS.pos, background: "rgba(79, 191, 134, 0.14)", border: "rgba(79, 191, 134, 0.5)" }
          : { color: COLORS.inkMuted, background: COLORS.surfaceSunk, border: COLORS.border };
    Object.assign(button.style, {
        position: "absolute",
        left: "12px",
        bottom: "12px",
        padding: "4px 12px",
        borderRadius: "999px",
        background: tone.background,
        border: `1px solid ${tone.border}`,
        color: tone.color,
        font: `700 12px/1.4 ${FONT}`,
        cursor: "pointer",
    });
    button.onclick = () => openTab("User data");
    return button;
}

function utf8Bytes(text: string): number {
    return typeof TextEncoder === "undefined" ? text.length : new TextEncoder().encode(text).length;
}

function formatUserData(userData: string): string {
    try {
        const parsed: unknown = JSON.parse(userData);
        if (parsed !== null && typeof parsed === "object") {
            return JSON.stringify(parsed, null, 2);
        }
    } catch {
        // Not JSON: show the raw string.
    }
    return userData;
}

function createResultTool(openTab: (label: string) => void): DevTool {
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
            badgeHeader("Result", COLORS.brandOrange),
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
        card.append(duration, renderUserDataButton(reported, openTab));
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

function usageColor(bytes: number, max: number, overflowed: boolean, normal = COLORS.inkSecondary): string {
    if (overflowed || bytes >= max) {
        return COLORS.neg;
    }
    return bytes >= max * USAGE_WARN_RATIO ? COLORS.warn : normal;
}

function remainingPercent(bytes: number, max: number): number {
    return Math.max(0, 100 - Math.round((bytes / max) * 100));
}

function renderUsage(bytes: number, max: number, overflowed: boolean): HTMLElement[] {
    const size = document.createElement("span");
    size.textContent = `${formatBytes(bytes)} `;
    size.style.color = COLORS.inkSecondary;
    const percent = document.createElement("span");
    percent.textContent = `(${remainingPercent(bytes, max)}% left)`;
    percent.style.color = usageColor(bytes, max, overflowed);
    return [size, percent];
}

function renderTrackedUsage(): HTMLElement[] {
    const { bytes, bytesCapDrops } = getTrackedUsage();
    return renderUsage(bytes, MAX_PAYLOAD_BYTES_PER_LOAD, bytesCapDrops > 0);
}

function renderRow(entry: TrackedEntry): HTMLElement {
    const row = document.createElement("div");
    row.dataset.kind = entry.kind;
    row.dataset.key = entry.key;
    row.tabIndex = 0;
    row.setAttribute("aria-describedby", DETAIL_ID);
    Object.assign(row.style, {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        margin: "0 6px",
        padding: "5px 6px",
        borderRadius: "6px",
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
    total.append(...renderTrackedUsage());
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
