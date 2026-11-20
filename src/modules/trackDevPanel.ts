import { isTestEnvironment } from "../utils.js";
import { getTrackedEntries, subscribeTrackedEntries } from "./trackDevBuffer.js";
import type { TrackedEntry } from "./trackDevBuffer.js";

const PANEL_ID = "minit-track-dev-panel";
const DETAIL_ID = "minit-track-dev-detail";

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
    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    Object.assign(panel.style, {
        position: "fixed",
        right: "8px",
        bottom: "8px",
        width: "280px",
        maxWidth: "calc(100vw - 16px)",
        background: "rgba(24, 24, 37, 0.92)",
        color: "#cdd6f4",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: "10px",
        boxShadow: "0 8px 20px rgba(0, 0, 0, 0.4)",
        fontFamily: "'Courier New', monospace",
        fontSize: "11px",
        lineHeight: "1.4",
        zIndex: "9999",
        overflow: "hidden",
    });

    const header = document.createElement("button");
    header.type = "button";
    Object.assign(header.style, {
        display: "block",
        width: "100%",
        padding: "6px 10px",
        background: "rgba(255, 255, 255, 0.05)",
        border: "none",
        color: "#fab387",
        font: "inherit",
        fontWeight: "700",
        textAlign: "left",
        cursor: "pointer",
    });

    const list = document.createElement("div");
    Object.assign(list.style, {
        maxHeight: "35vh",
        overflowY: "auto",
        padding: "4px 10px 6px",
    });

    let count = 0;
    let collapsed = false;
    const renderHeader = () => {
        header.textContent = `${collapsed ? "▸" : "▾"} Minit events (${count})`;
    };
    header.onclick = () => {
        collapsed = !collapsed;
        list.style.display = collapsed ? "none" : "block";
        renderHeader();
    };

    const detail = createDetailPanel();

    const add = (entry: TrackedEntry) => {
        count++;
        const row = renderRow(entry);
        row.onmouseenter = () => showDetail(detail, panel, row, entry);
        row.onmouseleave = () => {
            detail.style.display = "none";
        };
        list.insertBefore(row, list.firstChild);
        renderHeader();
    };

    getTrackedEntries().forEach(add);
    subscribeTrackedEntries(add);
    renderHeader();

    panel.append(header, list);
    body.append(panel, detail);
}

function renderRow(entry: TrackedEntry): HTMLElement {
    const row = document.createElement("div");
    row.dataset.kind = entry.kind;
    Object.assign(row.style, {
        padding: "3px 0",
        borderTop: "1px solid rgba(255, 255, 255, 0.05)",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        cursor: "default",
    });

    const key = document.createElement("span");
    key.style.fontWeight = "700";
    const time = document.createElement("span");
    time.style.color = "#7f849c";
    time.textContent = ` t=${entry.t}`;

    if (entry.kind === "event") {
        key.textContent = entry.key;
    } else {
        row.style.color = "#f38ba8";
        key.textContent = `⚠ dropped ${entry.key}`;
    }
    row.append(key, time);
    return row;
}

function createDetailPanel(): HTMLElement {
    const detail = document.createElement("div");
    detail.id = DETAIL_ID;
    Object.assign(detail.style, {
        display: "none",
        position: "fixed",
        maxWidth: "260px",
        padding: "6px 10px",
        background: "rgba(24, 24, 37, 0.96)",
        color: "#a6adc8",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: "8px",
        boxShadow: "0 8px 20px rgba(0, 0, 0, 0.4)",
        fontFamily: "'Courier New', monospace",
        fontSize: "11px",
        lineHeight: "1.4",
        wordBreak: "break-all",
        pointerEvents: "none",
        zIndex: "9999",
    });
    return detail;
}

function showDetail(detail: HTMLElement, panel: HTMLElement, row: HTMLElement, entry: TrackedEntry): void {
    const lines =
        entry.kind === "event"
            ? Object.entries(entry.props).map(([name, value]) => `${name}: ${JSON.stringify(value)}`)
            : [`reason: ${entry.reason}`];
    if (lines.length === 0) {
        lines.push("no properties");
    }
    detail.replaceChildren(
        ...lines.map((text) => {
            const line = document.createElement("div");
            line.textContent = text;
            return line;
        }),
    );
    detail.style.color = entry.kind === "event" ? "#a6adc8" : "#f38ba8";

    const panelRect = panel.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    detail.style.right = `${window.innerWidth - panelRect.left + 8}px`;
    detail.style.bottom = `${Math.max(8, window.innerHeight - rowRect.bottom)}px`;
    detail.style.display = "block";
}
