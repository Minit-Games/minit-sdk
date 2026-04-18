const REWARD_CONTAINER_CLASS = "drop-reward-icon";

export type RewardVisual =
    | { type: 'emoji'; emoji: string }
    | { type: 'image'; src: string }
    | { type: 'color'; color: string };

export interface RewardOptions {
    /** Visual representation: emoji, image, or color (circle). Defaults to orange color if not provided. */
    visual?: RewardVisual;
    /** Starting position { x, y } in pixels */
    start: { x: number; y: number };
    /** Target position { x, y } in pixels where the reward flies to */
    target: { x: number; y: number };
    /** Size of the reward icon in pixels (default: 60) */
    size?: number;
    /** Scale multiplier applied to size (default: 1.0) */
    scale?: number;
    /** How long to hold at the scatter position in ms (default: 350) */
    holdDuration?: number;
    /** How far to scatter from start position in pixels (default: 30) */
    scatterDistance?: number;
    /** Duration of the fly animation in ms (default: 400) */
    flyDuration?: number;
    /** Callback when the reward arrives at target */
    onArrive?: () => void;
    /** Optional z-index (default: 10000) */
    zIndex?: number;
    /** Optional container element (default: document.body).
     *  When provided, uses absolute positioning relative to container.
     *  Useful for scaled game wrappers so rewards scale with the game. */
    container?: HTMLElement;
}

let stylesInjected = false;

function injectStyles(): void {
    if (stylesInjected) return;
    stylesInjected = true;

    const style = document.createElement('style');
    style.id = 'drop-reward-icon-styles';
    style.textContent = `
        .${REWARD_CONTAINER_CLASS} {
            position: fixed;
            pointer-events: none;
            display: flex;
            align-items: center;
            justify-content: center;
            will-change: left, top, transform, opacity;
        }

        .${REWARD_CONTAINER_CLASS}.in-container {
            position: absolute;
        }

        /* Phase 1: Spawn + drift to scatter position */
        .${REWARD_CONTAINER_CLASS}.phase-spawn {
            transition: left 0.4s cubic-bezier(0.2, 0.8, 0.3, 1),
                        top 0.4s cubic-bezier(0.2, 0.8, 0.3, 1),
                        opacity 0.15s ease-out;
            animation: rewardSpawnWobble 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards,
                       rewardIdleWobble 0.4s ease-in-out 0.35s infinite;
        }

        @keyframes rewardSpawnWobble {
            0% { transform: translate(-50%, -50%) scale(0.3) scaleX(1) scaleY(1); }
            20% { transform: translate(-50%, -50%) scale(0.7) scaleX(1.12) scaleY(0.92); }
            45% { transform: translate(-50%, -50%) scale(0.9) scaleX(0.94) scaleY(1.08); }
            70% { transform: translate(-50%, -50%) scale(0.98) scaleX(1.04) scaleY(0.97); }
            100% { transform: translate(-50%, -50%) scale(1) scaleX(1) scaleY(1); }
        }

        @keyframes rewardIdleWobble {
            0% { transform: translate(-50%, -50%) scale(1) scaleX(1) scaleY(1); }
            25% { transform: translate(-50%, -50%) scale(1) scaleX(1.06) scaleY(0.95); }
            50% { transform: translate(-50%, -50%) scale(1) scaleX(0.97) scaleY(1.04); }
            75% { transform: translate(-50%, -50%) scale(1) scaleX(1.04) scaleY(0.97); }
            100% { transform: translate(-50%, -50%) scale(1) scaleX(1) scaleY(1); }
        }

        /* Phase 3: Fly to target with height wobble */
        .${REWARD_CONTAINER_CLASS}.phase-fly {
            transition: left 0.45s cubic-bezier(0.4, 0, 0.2, 1),
                        top 0.45s cubic-bezier(0.4, 0, 0.2, 1),
                        opacity 0.08s ease-out 0.42s;
            animation: rewardFlyWobble 0.45s ease-in-out forwards;
        }

        @keyframes rewardFlyWobble {
            0% { transform: translate(-50%, -50%) scale(1); }
            25% { transform: translate(-50%, -50%) scale(1.15); }
            50% { transform: translate(-50%, -50%) scale(0.95); }
            70% { transform: translate(-50%, -50%) scale(1.05); }
            90% { transform: translate(-50%, -50%) scale(0.5); }
            100% { transform: translate(-50%, -50%) scale(0.25); }
        }

        .${REWARD_CONTAINER_CLASS} .reward-circle {
            border-radius: 50%;
            box-sizing: border-box;
        }

        .${REWARD_CONTAINER_CLASS} .reward-emoji {
            line-height: 1;
            text-align: center;
            font-weight: 800;
            color: #ffffff;
        }

        .${REWARD_CONTAINER_CLASS} .reward-image {
            object-fit: contain;
        }
    `;
    document.head.appendChild(style);
}

/**
 * Darken a hex color by a percentage
 */
function darkenColor(hex: string, percent: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, (num >> 16) - Math.round(255 * percent));
    const g = Math.max(0, ((num >> 8) & 0x00FF) - Math.round(255 * percent));
    const b = Math.max(0, (num & 0x0000FF) - Math.round(255 * percent));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/**
 * Lighten a hex color by a percentage
 */
function lightenColor(hex: string, percent: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, (num >> 16) + Math.round(255 * percent));
    const g = Math.min(255, ((num >> 8) & 0x00FF) + Math.round(255 * percent));
    const b = Math.min(255, (num & 0x0000FF) + Math.round(255 * percent));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/**
 * Spawn a reward icon that animates from start → scatter → target.
 *
 * The animation sequence:
 * 1. Spawn at start position (scale 0 → 1)
 * 2. Scatter to a random nearby position
 * 3. Hold for holdDuration ms
 * 4. Fly to target position
 * 5. Call onArrive callback and remove
 *
 * @param options - Configuration for the reward animation
 */
export function spawnReward(options: RewardOptions): void {
    injectStyles();

    const {
        visual = { type: 'color', color: '#f7931e' },
        start,
        target,
        size: baseSize = 60,
        scale = 1.0,
        holdDuration = 350,
        scatterDistance = 30,
        flyDuration = 400,
        onArrive,
        zIndex = 10000,
        container
    } = options;

    // Apply scale to size
    const size = baseSize * scale;

    // Create the reward element
    const element = document.createElement('div');
    element.className = container
        ? `${REWARD_CONTAINER_CLASS} in-container`
        : REWARD_CONTAINER_CLASS;
    element.style.left = `${start.x}px`;
    element.style.top = `${start.y}px`;
    element.style.width = `${size}px`;
    element.style.height = `${size}px`;
    element.style.zIndex = zIndex.toString();
    element.style.transform = 'translate(-50%, -50%) scale(0)';
    element.style.opacity = '1';

    // Create the visual content
    let content: HTMLElement;

    if (visual.type === 'emoji') {
        content = document.createElement('span');
        content.className = 'reward-emoji';
        content.textContent = visual.emoji;
        content.style.fontSize = `${size * 0.7}px`;
    } else if (visual.type === 'image') {
        const img = document.createElement('img');
        img.className = 'reward-image';
        img.src = visual.src;
        img.style.width = `${size}px`;
        img.style.height = `${size}px`;
        content = img;
    } else {
        // Color - render as circle with gradient
        content = document.createElement('div');
        content.className = 'reward-circle';
        content.style.width = `${size}px`;
        content.style.height = `${size}px`;
        const lighterColor = lightenColor(visual.color, 0.25);
        content.style.background = `linear-gradient(135deg, ${lighterColor} 0%, ${visual.color} 100%)`;
        content.style.border = `4px solid ${darkenColor(visual.color, 0.35)}`;
    }

    element.appendChild(content);
    (container || document.body).appendChild(element);

    // Calculate scatter position (random offset from start)
    const angle = Math.random() * Math.PI * 2;
    const distance = scatterDistance * (0.5 + Math.random() * 0.5);
    const scatterX = start.x + Math.cos(angle) * distance;
    const scatterY = start.y + Math.sin(angle) * distance;

    // Animation sequence

    // Phase 1: Spawn at start, immediately begin drifting to scatter position
    element.style.transform = 'translate(-50%, -50%) scale(0.3)';
    element.style.opacity = '0';

    // Force browser to paint the initial state before starting transition
    // Double RAF ensures the initial state is rendered
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            // Add spawn phase class and trigger animation
            element.classList.add('phase-spawn');
            element.style.left = `${scatterX}px`;
            element.style.top = `${scatterY}px`;
            element.style.transform = 'translate(-50%, -50%) scale(1)';
            element.style.opacity = '1';

            // Phase 2: Hold at scatter position
            setTimeout(() => {
                element.classList.remove('phase-spawn');

                // Phase 3: Fly to target with wobble animation
                setTimeout(() => {
                    element.classList.add('phase-fly');
                    element.style.left = `${target.x}px`;
                    element.style.top = `${target.y}px`;
                    element.style.opacity = '0';

                    // Call onArrive early (at ~70% of flight) so score updates while element is still visible
                    setTimeout(() => {
                        onArrive?.();
                    }, flyDuration * 0.7);

                    // Cleanup after animation completes
                    setTimeout(() => {
                        element.remove();
                    }, flyDuration + 100);
                }, 80); // Brief anticipation pause
            }, 250 + holdDuration); // Spawn drift duration (400ms) + hold time
        });
    });
}

/**
 * Cluster a count into denominations to reduce the number of icons.
 * Uses denominations of 50, 12, 3, and 1 to keep icon count <= 5.
 */
function clusterIntoDenominations(count: number): { value: number; scale: number }[] {
    const denominations = [
        { value: 50, scale: 2.0 },
        { value: 12, scale: 1.5 },
        { value: 3, scale: 1.2 },
        { value: 1, scale: 1.0 }
    ];

    const result: { value: number; scale: number }[] = [];
    let remaining = count;

    for (const denom of denominations) {
        while (remaining >= denom.value && result.length < 5) {
            result.push({ value: denom.value, scale: denom.scale });
            remaining -= denom.value;
        }
        if (result.length >= 5) break;
    }

    // If we still have remaining and room, add more 1s
    while (remaining > 0 && result.length < 5) {
        result.push({ value: 1, scale: 1.0 });
        remaining--;
    }

    // If still remaining, distribute to existing icons (shouldn't happen often)
    if (remaining > 0 && result.length > 0) {
        result[result.length - 1].value += remaining;
    }

    return result;
}

/**
 * Spawn multiple reward icons with staggered timing.
 * When count > 5, clusters icons into larger denominations (50, 12, 3, 1)
 * with appropriately scaled sizes.
 *
 * @param count - Number of icons to spawn (or total value to represent)
 * @param options - Base options (each icon gets slight variations)
 * @param staggerMs - Delay between each icon spawn (default: 50ms)
 */
export function spawnRewards(
    count: number,
    options: Omit<RewardOptions, 'onArrive'> & { onAllArrive?: () => void },
    staggerMs: number = 50
): void {
    let arrived = 0;
    const { onAllArrive, ...baseOptions } = options;
    const baseSize = baseOptions.size || 50;

    // If count <= 5, spawn individual icons
    // If count > 5, cluster into denominations
    const clusters = count <= 5
        ? Array(count).fill({ value: 1, scale: 1.0 })
        : clusterIntoDenominations(count);

    const totalIcons = clusters.length;

    for (let i = 0; i < clusters.length; i++) {
        const cluster = clusters[i];

        setTimeout(() => {
            spawnReward({
                ...baseOptions,
                // Scale size based on denomination
                size: Math.round(baseSize * cluster.scale),
                // Slight position variation for each
                start: {
                    x: baseOptions.start.x + (Math.random() - 0.5) * 20,
                    y: baseOptions.start.y + (Math.random() - 0.5) * 20
                },
                onArrive: () => {
                    arrived++;
                    if (arrived >= totalIcons) {
                        onAllArrive?.();
                    }
                }
            });
        }, i * staggerMs);
    }
}
