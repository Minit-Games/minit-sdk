const DEFAULT_BACKGROUND_COLOR = "rgba(198, 198, 198, 1)";

export interface ShadowOptions {
    enabled?: boolean;  // Default: true
    color?: string;
    blur?: number;
    spread?: number;
}

export interface ShapeOptions {
    enabled: boolean;
    baseColor?: string;         // If not provided, uses backgroundColor
    count?: number;             // Default: 20
    opacity?: number;           // Default: 0.15
    animate?: boolean;          // Default: true
    colorVariation?: number;    // Lightness spread 0-1 (0=no variation, 0.5=±45%, 1=±90%), default: 0.5
}

export interface ImageOptions {
    src: string;                // Image source URL or imported image
    opacity?: number;           // Default: 1
    blur?: number;              // Blur in pixels, default: 0
    fit?: 'cover' | 'contain';  // How to fit the image, default: 'cover'
}

export type Background = {
    backgroundColor: string,
    containerId?: string,
    shadow?: ShadowOptions,
    shapes?: ShapeOptions,
    image?: ImageOptions
};

// Backward-compat alias
export type DropBackground = Background;

// Generate color variations from a base hex color
// variation: 0-1 value representing how much of the lightness range to use (0.5 = ±25% from base)
function generateColorVariations(hexColor: string, count: number, variation: number = 0.5): string[] {
    // Parse hex to RGB
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Convert to HSL
    const rNorm = r / 255, gNorm = g / 255, bNorm = b / 255;
    const max = Math.max(rNorm, gNorm, bNorm);
    const min = Math.min(rNorm, gNorm, bNorm);
    let h = 0, s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case rNorm: h = ((gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)) / 6; break;
            case gNorm: h = ((bNorm - rNorm) / d + 2) / 6; break;
            case bNorm: h = ((rNorm - gNorm) / d + 4) / 6; break;
        }
    }

    // Clamp variation to 0-1 range
    const clampedVariation = Math.max(0, Math.min(1, variation));

    // Calculate the lightness range based on variation (0-1)
    // maxSpread defines the maximum possible range (±90% at variation=1)
    const maxSpread = 0.5;
    const spread = maxSpread * clampedVariation;

    // Generate variations with lightness and saturation shifts
    const colors: string[] = [];
    for (let i = 0; i < count; i++) {
        // Normalize i to -1 to +1 range
        const t = count > 1 ? (i / (count - 1)) * 2 - 1 : 0;

        const lightnessMod = t * spread;
        const satMod = t * spread * 0.5; // Saturation varies at half the rate

        const newL = Math.max(0.15, Math.min(0.85, l + lightnessMod));
        const newS = Math.max(0.1, Math.min(1.0, s + satMod));
        colors.push(`hsl(${Math.round(h * 360)}, ${Math.round(newS * 100)}%, ${Math.round(newL * 100)}%)`);
    }
    return colors;
}

// Create SVG shape path
function createShapePath(type: number, size: number): string {
    if (type === 0) {
        // Hexagon
        const points: string[] = [];
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i - Math.PI / 2;
            points.push(`${size + size * Math.cos(angle)},${size + size * Math.sin(angle)}`);
        }
        return `<polygon points="${points.join(' ')}"/>`;
    } else if (type === 1) {
        // Triangle
        const h = size * Math.sqrt(3) / 2;
        return `<polygon points="${size},${size - h * 0.66} ${size + size / 2},${size + h * 0.33} ${size - size / 2},${size + h * 0.33}"/>`;
    } else {
        // Circle
        return `<circle cx="${size}" cy="${size}" r="${size * 0.5}"/>`;
    }
}

// Generate shapes container
function createShapesBackground(bg: HTMLElement, options: ShapeOptions, backgroundColor: string): void {
    const baseColor = options.baseColor || backgroundColor;
    const shapeCount = options.count ?? 20;
    const shapeOpacity = options.opacity ?? 0.15;
    const animate = options.animate ?? true;
    const colorVariation = options.colorVariation ?? 0.5;

    const colors = generateColorVariations(baseColor, 5, colorVariation);

    const shapesContainer = document.createElement('div');
    shapesContainer.style.position = 'absolute';
    shapesContainer.style.inset = '0';
    shapesContainer.style.overflow = 'hidden';
    shapesContainer.style.pointerEvents = 'none';

    for (let i = 0; i < shapeCount; i++) {
        const size = 40 + Math.random() * 140; // Range: 40-180px (bigger, more varied)
        const shapeType = Math.floor(Math.random() * 3);
        const color = colors[i % colors.length];

        const shapeWrapper = document.createElement('div');
        shapeWrapper.style.position = 'absolute';
        shapeWrapper.style.left = `${Math.random() * 120 - 10}%`;
        shapeWrapper.style.top = `${Math.random() * 120 - 10}%`;
        shapeWrapper.style.opacity = shapeOpacity.toString();
        shapeWrapper.style.transform = `rotate(${Math.random() * 360}deg)`;

        if (animate) {
            const duration = 8 + Math.random() * 8;
            const delay = Math.random() * -duration;
            shapeWrapper.style.animation = `dropShapeFloat ${duration}s ease-in-out ${delay}s infinite`;
        }

        shapeWrapper.innerHTML = `
            <svg width="${size * 2}" height="${size * 2}" viewBox="0 0 ${size * 2} ${size * 2}">
                <g fill="${color}">${createShapePath(shapeType, size)}</g>
            </svg>
        `;

        shapesContainer.appendChild(shapeWrapper);
    }

    // Add animation keyframes if animate is enabled
    if (animate) {
        const styleId = 'drop-shape-animation';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                @keyframes dropShapeFloat {
                    0%, 100% { transform: translateY(0) rotate(0deg); }
                    50% { transform: translateY(-15px) rotate(3deg); }
                }
            `;
            document.head.appendChild(style);
        }
    }

    bg.appendChild(shapesContainer);
}

export function addBackground(options?: Background): void {

    const containerId = options?.containerId || "game-background";

    let bg = document.getElementById(containerId);

    if (!bg) {
        bg = document.createElement("div");
        bg.id = containerId;
        document.body.prepend(bg);
    }

    bg.style.position = "fixed";
    bg.style.inset = "0";
    bg.style.zIndex = "0";
    bg.style.pointerEvents = "none";
    bg.style.backgroundColor = options?.backgroundColor ?? DEFAULT_BACKGROUND_COLOR;

    // Flex
    bg.style.display = "flex";
    bg.style.alignItems = "center";
    bg.style.justifyContent = "center";

    // Background image - if provided, add full-screen image
    if (options?.image?.src) {
        const imgContainer = document.createElement('div');
        imgContainer.style.position = 'absolute';
        imgContainer.style.inset = '0';
        imgContainer.style.overflow = 'hidden';
        imgContainer.style.pointerEvents = 'none';

        const img = document.createElement('img');
        img.src = options.image.src;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = options.image.fit ?? 'cover';
        img.style.opacity = (options.image.opacity ?? 1).toString();

        if (options.image.blur && options.image.blur > 0) {
            img.style.filter = `blur(${options.image.blur}px)`;
            // Scale up slightly to hide blur edges
            img.style.transform = 'scale(1.1)';
        }

        imgContainer.appendChild(img);
        bg.appendChild(imgContainer);
    }

    // Shapes - if enabled, add shape background
    if (options?.shapes?.enabled) {
        createShapesBackground(bg, options.shapes, options.backgroundColor ?? DEFAULT_BACKGROUND_COLOR);
    }
}

// Backward-compat alias
export const addDropBackground = addBackground;
