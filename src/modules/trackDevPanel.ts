import { isTestEnvironment } from "../utils.js";
import { getTrackedEntries, subscribeTrackedEntries } from "./trackDevBuffer.js";
import type { TrackedEntry } from "./trackDevBuffer.js";

const PANEL_ID = "minit-track-dev-panel";

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

    const add = (entry: TrackedEntry) => {
        count++;
        list.insertBefore(renderRow(entry), list.firstChild);
        renderHeader();
    };

    getTrackedEntries().forEach(add);
    subscribeTrackedEntries(add);
    renderHeader();

    panel.append(header, list);
    body.appendChild(panel);
}

function renderRow(entry: TrackedEntry): HTMLElement {
    const row = document.createElement("div");
    row.dataset.kind = entry.kind;
    Object.assign(row.style, {
        padding: "3px 0",
        borderTop: "1px solid rgba(255, 255, 255, 0.05)",
        wordBreak: "break-all",
    });

    const head = document.createElement("div");
    const key = document.createElement("span");
    key.style.fontWeight = "700";
    const time = document.createElement("span");
    time.style.color = "#7f849c";
    time.textContent = ` t=${entry.t}`;
    head.append(key, time);
    row.appendChild(head);

    const detail = document.createElement("div");
    if (entry.kind === "event") {
        key.textContent = entry.key;
        detail.style.color = "#a6adc8";
        detail.textContent = Object.entries(entry.props)
            .map(([name, value]) => `${name}=${JSON.stringify(value)}`)
            .join(" ");
    } else {
        row.style.color = "#f38ba8";
        key.textContent = `⚠ dropped ${entry.key}`;
        detail.textContent = entry.reason;
    }
    if (detail.textContent) {
        row.appendChild(detail);
    }
    return row;
}
