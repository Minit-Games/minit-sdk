const TUTORIAL_CONTAINER_CLASS = "drop-tutorial-hint";

export type TutorialPosition = "top" | "center" | "bottom";

export interface TutorialOptions {
    /** Vertical position: "top", "center", or "bottom" (default: "center") */
    position?: TutorialPosition;
    /** If true, show immediately without the 250ms delay (default: false) */
    instant?: boolean;
    /**
     * Optional container element to append the tutorial to.
     * When provided, uses absolute positioning relative to the container.
     * Useful for scaled game wrappers so the tutorial scales with the game.
     */
    container?: HTMLElement;
    /** Y position in pixels when using a container (default: auto based on position) */
    y?: number;
    /** Font size in pixels (default: 20, or 32 when in container) */
    fontSize?: number;
}

let currentContainer: HTMLElement | null = null;
let currentParent: HTMLElement | null = null;

function injectStyles(): void {
    const styleId = 'drop-tutorial-hint-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        .${TUTORIAL_CONTAINER_CLASS} {
            position: fixed;
            left: 5%;
            right: 5%;
            transform: translateY(20px);
            z-index: 9999;
            padding: 10px 0;
            color: #FFFFFF;
            font-family: 'Lato', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 80px;
            font-weight: 700;
            text-align: center;
            -webkit-text-stroke: 1px #000;
            paint-order: stroke fill;
            text-shadow:
                0 2px 4px rgba(0, 0, 0, 0.8),
                0 4px 8px rgba(0, 0, 0, 0.6),
                0 0 20px rgba(0, 0, 0, 0.5);
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s ease, transform 0.3s ease;
        }

        .${TUTORIAL_CONTAINER_CLASS}.in-container {
            position: absolute;
        }

        .${TUTORIAL_CONTAINER_CLASS}.visible {
            opacity: 1;
            transform: translateY(0);
            animation: tutorialFlash 2s ease-in-out infinite;
        }

        @keyframes tutorialFlash {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
        }

        .${TUTORIAL_CONTAINER_CLASS}.pos-top {
            top: 80px;
            bottom: auto;
        }

        .${TUTORIAL_CONTAINER_CLASS}.pos-center {
            top: 50%;
            bottom: auto;
            transform: translateY(-50%) translateY(20px);
        }

        .${TUTORIAL_CONTAINER_CLASS}.pos-center.visible {
            transform: translateY(-50%);
            animation: tutorialFlash 2s ease-in-out infinite;
        }

        .${TUTORIAL_CONTAINER_CLASS}.pos-bottom {
            top: auto;
            bottom: 120px;
        }
    `;
    document.head.appendChild(style);
}

/**
 * Show a non-blocking tutorial hint on screen.
 * The hint does not block game input.
 * Call hideTutorial() when the player takes their first action.
 *
 * @param text - The hint text to display
 * @param positionOrOptions - Position string or options object
 * @param instant - If true, show immediately (legacy parameter, use options.instant instead)
 */
export function showTutorial(
    text: string,
    positionOrOptions: TutorialPosition | TutorialOptions = "center",
    instant: boolean = false
): void {
    injectStyles();

    // Parse options
    let options: TutorialOptions;
    if (typeof positionOrOptions === 'string') {
        options = { position: positionOrOptions, instant };
    } else {
        options = positionOrOptions;
    }

    const position = options.position || "center";
    const parentContainer = options.container || null;

    // Remove existing container if any
    if (currentContainer) {
        currentContainer.remove();
        currentContainer = null;
    }

    const container = document.createElement('div');
    container.className = parentContainer
        ? `${TUTORIAL_CONTAINER_CLASS} in-container pos-${position}`
        : `${TUTORIAL_CONTAINER_CLASS} pos-${position}`;
    container.textContent = text;

    // Apply custom font size (only if explicitly specified)
    if (options.fontSize) {
        container.style.fontSize = `${options.fontSize}px`;
    }

    // Apply custom Y position when in container
    if (parentContainer && options.y !== undefined) {
        container.style.top = `${options.y}px`;
        container.style.bottom = 'auto';
        // Reset transforms for custom Y positioning
        if (position !== 'center') {
            container.style.transform = 'translateY(20px)';
        }
    }

    // Append to parent container or body
    (parentContainer || document.body).appendChild(container);
    currentContainer = container;
    currentParent = parentContainer;

    if (options.instant) {
        // Show immediately
        requestAnimationFrame(() => {
            container.classList.add('visible');
        });
    } else {
        // Trigger fade-in animation after 250ms delay
        setTimeout(() => {
            if (currentContainer === container) {
                requestAnimationFrame(() => {
                    container.classList.add('visible');
                });
            }
        }, 250);
    }
}

/**
 * Hide the tutorial hint.
 * Call this when the player takes their first action.
 */
export function hideTutorial(): void {
    if (!currentContainer) return;

    const container = currentContainer;
    container.classList.remove('visible');

    // Remove after transition
    setTimeout(() => {
        container.remove();
        if (currentContainer === container) {
            currentContainer = null;
        }
    }, 300);
}

/**
 * Check if a tutorial hint is currently visible.
 */
export function isTutorialVisible(): boolean {
    return currentContainer !== null;
}
