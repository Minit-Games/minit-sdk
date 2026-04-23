import type { ResultOptions, HostResultOptions } from "../minitApi";
import { callApiFunction, isTestEnvironment } from "../utils";

/**
 * In-memory blob accumulator for the current game session.
 *
 * Initialised once on module load by parsing `window.minit.userData`.
 * If the stored string is absent, invalid JSON, or not a plain object,
 * we start from an empty record — the next `reportResult` call with a
 * `userData` patch will write a fresh blob.
 */
let currentBlob: Record<string, string> = initBlob();

function initBlob(): Record<string, string> {
    if (typeof window === "undefined") return {};
    const raw = window.minit?.userData;
    if (!raw) return {};
    try {
        const parsed: unknown = JSON.parse(raw);
        if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
            return parsed as Record<string, string>;
        }
    } catch {
        // Malformed blob — start fresh.
    }
    return {};
}

/** Exposed for unit tests to reset module-level state between test cases. */
export function _resetBlobForTests(): void {
    currentBlob = initBlob();
}

export function reportResult(result: number|string, options?: ResultOptions): void {

    if(isTestEnvironment()) {

        if(options?.delay) {
            console.log(`[DropSDK] Delaying drop result display by ${options.delay}ms`);
            setTimeout(() => {
                showResultScreen(result, options);
            }, options.delay);
        }
        else {
            showResultScreen(result, options);
        }
    }

    // Build the host-facing options, serialising the userData patch if present.
    const hostOptions: HostResultOptions | undefined = buildHostOptions(options);

    callApiFunction(() => {
        window.minit?.reportResult(result, hostOptions);
    }, `reportResult => ${result}\nOptions: ${JSON.stringify(hostOptions)}`);
}

/**
 * Converts public `ResultOptions` (with `userData: Record<string, string>`)
 * to the wire-format `HostResultOptions` (with `userData: string`).
 *
 * Empty-patch semantics: an empty `{}` patch is a no-op for the blob, so
 * we omit `userData` from the host payload entirely — same as if the caller
 * had not passed `userData` at all.
 */
function buildHostOptions(options?: ResultOptions): HostResultOptions | undefined {
    if (!options) return undefined;

    const { userData: patch, ...rest } = options;

    if (patch === null || typeof patch !== "object" || Array.isArray(patch)) {
        // Invalid patch — treat as no-op (do not forward userData to the host).
        return Object.keys(rest).length > 0 ? rest : undefined;
    }

    if (patch === undefined || Object.keys(patch).length === 0) {
        // No patch (or empty patch) — do not forward userData to the host.
        return Object.keys(rest).length > 0 ? rest : undefined;
    }

    // Merge patch into the in-memory blob and serialise.
    currentBlob = { ...currentBlob, ...patch };
    return { ...rest, userData: JSON.stringify(currentBlob) };
}

// Backward-compat alias
export const reportDropResult = reportResult;

function showResultScreen(result: number | string, options?: ResultOptions) {
    const flavorText = options?.flavorText || "No flavor text provided";
    const delay = options?.delay || 0;

    const overlay = document.createElement('div');
    overlay.id = "dashboard-overlay";
    Object.assign(overlay.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(10, 10, 15, 0.8)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: '10000',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        opacity: '0',
        transition: 'opacity 0.25s ease'
    });

    const card = document.createElement('div');
    Object.assign(card.style, {
        background: '#181825',
        color: '#cdd6f4',
        padding: '3rem 2.5rem 2rem 2.5rem',
        borderRadius: '20px',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
        width: '350px',
        textAlign: 'center',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        transform: 'scale(0.9)',
        transition: 'transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        position: 'relative'
    });

    card.innerHTML = `
        <button id="destroy-btn" style="
            position: absolute;
            top: 15px;
            right: 15px;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            color: #f38ba8;
            font-size: 1.2rem;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.2s ease;
            line-height: 0;
        ">✕</button>
        <div style="font-size: 0.75rem; color: #fab387; font-weight: 700; text-transform: uppercase; margin-bottom: 0.5rem;">${flavorText}</div>
        <div style="font-size: 3.5rem; font-weight: 800; color: #fff; line-height: 1;">${result}</div>
        <div style="margin-top: 2rem; width: 100%; height: 1px; background: rgba(255,255,255,0.05);"></div>
        <div style="margin-top: 1.5rem; font-size: 0.6rem; color: #fdfdfd; font-family: 'Courier New', monospace;">Result Display Delay: ${delay}ms</div>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
        overlay.style.opacity = '1';
        card.style.transform = 'scale(1)';
    });

    const destroy = () => {
        overlay.style.opacity = '0';
        card.style.transform = 'scale(0.9)';
        setTimeout(() => overlay.remove(), 250);
    };

    const btn = card.querySelector('#destroy-btn') as HTMLElement;

    if (btn) {
        btn.onclick = destroy;
        btn.onmouseenter = () => btn.style.background = "rgba(243, 139, 168, 0.2)";
        btn.onmouseleave = () => btn.style.background = "rgba(255, 255, 255, 0.05)";
    }

    overlay.onclick = (e) => { if (e.target === overlay) destroy(); };
}
