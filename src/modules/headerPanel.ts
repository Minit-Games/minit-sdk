import { spawnReward } from './reward';

const HEADER_CONTAINER_ID = "drop-header-bar";
const HEADER_PANEL_CLASS = "drop-header-panel";

export type PanelAlign = "left" | "right";

export interface PanelStyle {
    /** Color for the label text (CSS color, default: '#ffffff') */
    labelColor?: string;
    /** Color for the value text (CSS color, default: '#ffffff') */
    valueColor?: string;
    /** Font size for the label (default: 36) */
    labelSize?: number;
    /** Font size for the value (default: 48) */
    valueSize?: number;
    /** Font family (default: 'Lato, system-ui, sans-serif') */
    fontFamily?: string;
}

export interface PanelConfig {
    /** Label text displayed above the value (e.g., "Score", "Turns") */
    label?: string;
    /** Icon emoji/character displayed above the value (alternative to label) */
    icon?: string;
    /** Initial value to display */
    value: number | string;
    /** Alignment: 'left' or 'right' (default: 'left') */
    align?: PanelAlign;
    /** Optional styling overrides */
    style?: PanelStyle;
    /** Optional click handler for the panel */
    onClick?: () => void;
}

export type HeaderLayout = "split" | "even";

export interface HeaderBarConfig {
    /** Distance from top in pixels (default: 60) */
    y?: number;
    /** Side padding in pixels (default: 5% of container/viewport width) */
    padding?: number;
    /** Constrain width in pixels (panels align within this width, centered) */
    width?: number;
    /** Default styling for all panels */
    defaultStyle?: PanelStyle;
    /** Z-index of the header bar (default: 9000) */
    zIndex?: number;
    /**
     * Layout mode:
     * - "split": Left-aligned and right-aligned groups (default)
     * - "even": All panels distributed evenly across the width
     */
    layout?: HeaderLayout;
    /**
     * Optional container element to append the header bar to.
     * When provided, uses absolute positioning relative to the container.
     * Useful for scaled game wrappers so the header scales with the game.
     * If not provided, appends to document.body with fixed positioning.
     */
    container?: HTMLElement;
}

export interface Panel {
    /** Update the displayed value */
    setValue(value: number | string, options?: { animate?: boolean; duration?: number }): void;
    /** Get the current value */
    getValue(): number | string;
    /** Get the panel's position in viewport coordinates (for flying icons) */
    getPosition(): { x: number; y: number };
    /**
     * Spawn a flying icon that animates to this panel.
     * Uses the spawnReward system internally.
     */
    flyToPanel(options: FlyToPanelOptions): void;
    /** Update the label/icon text */
    setLabel(text: string): void;
    /** Show or hide the panel */
    setVisible(visible: boolean): void;
    /** Remove the panel from the header */
    destroy(): void;
}

export interface FlyToPanelOptions {
    /** Starting position { x, y } in pixels (viewport or container coords) */
    start: { x: number; y: number };
    /** Visual: emoji string, { type: 'image', src: string }, or { type: 'color', color: string }. Defaults to orange color if not provided. */
    visual?: string | { type: 'image'; src: string } | { type: 'color'; color: string };
    /** Size of the flying icon (default: 40) */
    size?: number;
    /** Scale multiplier applied to size (default: 1.0) */
    scale?: number;
    /** Delay before starting animation in ms (default: 0) */
    delay?: number;
    /** Callback when the icon arrives */
    onArrive?: () => void;
    /** Optional container for positioning (useful for scaled game wrappers) */
    container?: HTMLElement;
}

export interface HeaderBar {
    /** Add a panel to the header bar */
    addPanel(config: PanelConfig): Panel;
    /** Get all panels */
    getPanels(): Panel[];
    /** Remove the entire header bar */
    destroy(): void;
}

let stylesInjected = false;
let headerInstance: HeaderBarImpl | null = null;

function injectStyles(): void {
    if (stylesInjected) return;
    stylesInjected = true;

    // Load Lato font
    const fontLink = document.createElement('link');
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap';
    fontLink.rel = 'stylesheet';
    document.head.appendChild(fontLink);

    const style = document.createElement('style');
    style.id = 'drop-header-bar-styles';
    style.textContent = `
        .${HEADER_CONTAINER_ID} {
            position: fixed;
            left: 0;
            right: 0;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            pointer-events: none;
            box-sizing: border-box;
        }

        .${HEADER_CONTAINER_ID}.in-container {
            position: absolute;
        }

        .${HEADER_CONTAINER_ID}.layout-even {
            justify-content: space-around;
        }

        .${HEADER_CONTAINER_ID}.layout-even .header-left,
        .${HEADER_CONTAINER_ID}.layout-even .header-right {
            display: contents;
        }

        .${HEADER_CONTAINER_ID} .header-left,
        .${HEADER_CONTAINER_ID} .header-right {
            display: flex;
            gap: 12px;
        }

        .${HEADER_CONTAINER_ID} .header-left {
            justify-content: flex-start;
        }

        .${HEADER_CONTAINER_ID} .header-right {
            justify-content: flex-end;
        }

        .${HEADER_PANEL_CLASS} {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            pointer-events: auto;
            user-select: none;
            min-width: 60px;
        }

        .${HEADER_PANEL_CLASS}.clickable {
            cursor: pointer;
        }

        .${HEADER_PANEL_CLASS}.clickable:hover {
            transform: scale(1.05);
        }

        .${HEADER_PANEL_CLASS}.clickable:active {
            transform: scale(0.95);
        }

        .${HEADER_PANEL_CLASS} .panel-label {
            line-height: 1.2;
            text-shadow:
                0 2px 4px rgba(0, 0, 0, 0.5),
                0 1px 2px rgba(0, 0, 0, 0.6);
        }

        .${HEADER_PANEL_CLASS} .panel-icon {
            line-height: 1;
            filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.6));
        }

        .${HEADER_PANEL_CLASS} .panel-value {
            line-height: 1.2;
            font-weight: 700;
            text-shadow:
                0 2px 4px rgba(0, 0, 0, 0.5),
                0 1px 2px rgba(0, 0, 0, 0.6);
        }

        .${HEADER_PANEL_CLASS}.hidden {
            display: none;
        }
    `;
    document.head.appendChild(style);
}

class PanelImpl implements Panel {
    private element: HTMLDivElement;
    private labelElement: HTMLDivElement;
    private valueElement: HTMLDivElement;
    private currentValue: number | string;
    private animationFrame: number | null = null;
    private parentContainer: HTMLElement | null = null;

    constructor(
        config: PanelConfig,
        defaultStyle: PanelStyle,
        parentContainer: HTMLElement | null = null
    ) {
        this.parentContainer = parentContainer;
        const style = { ...defaultStyle, ...config.style };

        this.currentValue = config.value;

        // Create panel element
        this.element = document.createElement('div');
        this.element.className = HEADER_PANEL_CLASS;

        if (config.onClick) {
            this.element.classList.add('clickable');
            this.element.addEventListener('click', config.onClick);
        }

        const fontFamily = style.fontFamily || 'Lato, system-ui, sans-serif';
        const labelColor = style.labelColor || '#ffffff';
        const valueColor = style.valueColor || '#ffffff';
        const labelSize = style.labelSize || 36;
        const valueSize = style.valueSize || 48;

        // Create label/icon element
        this.labelElement = document.createElement('div');
        if (config.icon) {
            this.labelElement.className = 'panel-icon';
            this.labelElement.textContent = config.icon;
            this.labelElement.style.fontSize = `${valueSize}px`;
        } else {
            this.labelElement.className = 'panel-label';
            this.labelElement.textContent = config.label || '';
            this.labelElement.style.fontFamily = fontFamily;
            this.labelElement.style.fontSize = `${labelSize}px`;
            this.labelElement.style.color = labelColor;
        }
        this.element.appendChild(this.labelElement);

        // Create value element
        this.valueElement = document.createElement('div');
        this.valueElement.className = 'panel-value';
        this.valueElement.textContent = String(config.value);
        this.valueElement.style.fontFamily = fontFamily;
        this.valueElement.style.fontSize = `${valueSize}px`;
        this.valueElement.style.color = valueColor;
        this.element.appendChild(this.valueElement);
    }

    getElement(): HTMLDivElement {
        return this.element;
    }

    setValue(value: number | string, options?: { animate?: boolean; duration?: number }): void {
        const oldValue = this.currentValue;
        this.currentValue = value;

        if (options?.animate && typeof oldValue === 'number' && typeof value === 'number') {
            // Animated count-up
            const duration = options.duration || 300;
            const startTime = performance.now();
            const startValue = oldValue;
            const endValue = value;

            const animate = (currentTime: number) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);

                // Ease out cubic
                const eased = 1 - Math.pow(1 - progress, 3);
                const current = Math.round(startValue + (endValue - startValue) * eased);

                this.valueElement.textContent = String(current);

                if (progress < 1) {
                    this.animationFrame = requestAnimationFrame(animate);
                } else {
                    this.valueElement.textContent = String(endValue);
                }
            };

            if (this.animationFrame) {
                cancelAnimationFrame(this.animationFrame);
            }
            this.animationFrame = requestAnimationFrame(animate);
        } else {
            if (this.animationFrame) {
                cancelAnimationFrame(this.animationFrame);
                this.animationFrame = null;
            }
            this.valueElement.textContent = String(value);
        }
    }

    getValue(): number | string {
        return this.currentValue;
    }

    getPosition(): { x: number; y: number } {
        if (this.parentContainer) {
            // When inside a container (scaled wrapper), return container-relative coordinates
            const containerRect = this.parentContainer.getBoundingClientRect();
            const elementRect = this.valueElement.getBoundingClientRect();

            // Calculate scale factor from transform
            const scaleX = containerRect.width / this.parentContainer.offsetWidth;
            const scaleY = containerRect.height / this.parentContainer.offsetHeight;

            // Get the scaled position relative to container, then unscale to get container coords
            const scaledX = (elementRect.left + elementRect.width / 2) - containerRect.left;
            const scaledY = (elementRect.top + elementRect.height / 2) - containerRect.top;

            return {
                x: scaledX / scaleX,
                y: scaledY / scaleY
            };
        }

        // Default: return viewport coordinates
        const rect = this.valueElement.getBoundingClientRect();
        return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
    }

    flyToPanel(options: FlyToPanelOptions): void {
        const target = this.getPosition();

        // Use the panel's parent container if no container specified in options
        const container = options.container || this.parentContainer || undefined;

        // If a container is provided in options but panel is not in a container,
        // we need to convert viewport target to container coords
        let adjustedTarget = target;
        if (options.container && !this.parentContainer) {
            const containerRect = options.container.getBoundingClientRect();
            adjustedTarget = {
                x: target.x - containerRect.left,
                y: target.y - containerRect.top
            };
        }

        let visual: { type: 'emoji'; emoji: string } | { type: 'image'; src: string } | { type: 'color'; color: string } | undefined;
        if (options.visual) {
            if (typeof options.visual === 'string') {
                visual = { type: 'emoji', emoji: options.visual };
            } else if (options.visual.type === 'color') {
                visual = { type: 'color', color: options.visual.color };
            } else {
                visual = { type: 'image', src: options.visual.src };
            }
        }

        const doSpawn = () => {
            spawnReward({
                visual,
                start: options.start,
                target: adjustedTarget,
                size: options.size || 40,
                scale: options.scale,
                container,
                onArrive: () => {
                    options.onArrive?.();
                }
            });
        };

        if (options.delay && options.delay > 0) {
            setTimeout(doSpawn, options.delay);
        } else {
            doSpawn();
        }
    }

    setLabel(text: string): void {
        this.labelElement.textContent = text;
    }

    setVisible(visible: boolean): void {
        this.element.classList.toggle('hidden', !visible);
    }

    destroy(): void {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        this.element.remove();
    }
}

class HeaderBarImpl implements HeaderBar {
    private headerElement: HTMLDivElement;
    private leftContainer: HTMLDivElement;
    private rightContainer: HTMLDivElement;
    private panels: PanelImpl[] = [];
    private config: HeaderBarConfig;
    private defaultStyle: PanelStyle;
    private parentContainer: HTMLElement | null;

    constructor(config: HeaderBarConfig = {}) {
        injectStyles();

        this.config = config;
        this.defaultStyle = config.defaultStyle || {};
        this.parentContainer = config.container || null;

        // Create main container
        this.headerElement = document.createElement('div');
        let className = HEADER_CONTAINER_ID;
        if (this.parentContainer) className += ' in-container';
        if (config.layout === 'even') className += ' layout-even';
        this.headerElement.className = className;
        this.headerElement.style.top = `${config.y || 60}px`;
        this.headerElement.style.zIndex = String(config.zIndex || 9000);

        // Calculate reference width for padding
        const referenceWidth = this.parentContainer
            ? this.parentContainer.offsetWidth || window.innerWidth
            : window.innerWidth;

        // Calculate padding (default: 75px)
        const padding = config.padding !== undefined
            ? config.padding
            : 75;

        if (config.width) {
            // Constrained width - center it
            const sideMargin = Math.max(0, (referenceWidth - config.width) / 2);
            this.headerElement.style.paddingLeft = `${sideMargin + padding}px`;
            this.headerElement.style.paddingRight = `${sideMargin + padding}px`;
        } else {
            this.headerElement.style.paddingLeft = `${padding}px`;
            this.headerElement.style.paddingRight = `${padding}px`;
        }

        // Create left and right sections
        this.leftContainer = document.createElement('div');
        this.leftContainer.className = 'header-left';

        this.rightContainer = document.createElement('div');
        this.rightContainer.className = 'header-right';

        this.headerElement.appendChild(this.leftContainer);
        this.headerElement.appendChild(this.rightContainer);

        // Append to container or body
        (this.parentContainer || document.body).appendChild(this.headerElement);
    }

    addPanel(config: PanelConfig): Panel {
        const panel = new PanelImpl(config, this.defaultStyle, this.parentContainer);
        this.panels.push(panel);

        const align = config.align || 'left';
        if (align === 'right') {
            this.rightContainer.appendChild(panel.getElement());
        } else {
            this.leftContainer.appendChild(panel.getElement());
        }

        return panel;
    }

    getPanels(): Panel[] {
        return this.panels;
    }

    destroy(): void {
        for (const panel of this.panels) {
            panel.destroy();
        }
        this.panels = [];
        this.headerElement.remove();
        headerInstance = null;
    }
}

/**
 * Create a header bar for displaying game stats (score, turns, lives, etc.)
 *
 * The header bar supports left-aligned and right-aligned panels that auto-position.
 * Each panel can display a label + value or icon + value.
 */
export function createHeaderBar(config?: HeaderBarConfig): HeaderBar {
    // Only allow one header bar at a time
    if (headerInstance) {
        headerInstance.destroy();
    }

    headerInstance = new HeaderBarImpl(config);
    return headerInstance;
}

/**
 * Get the current header bar instance, if one exists.
 */
export function getHeaderBar(): HeaderBar | null {
    return headerInstance;
}
