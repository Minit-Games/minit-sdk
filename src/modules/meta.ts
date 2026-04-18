export function applyMetaTags() {
    const head = document.head;

    // Add charset meta tag
    const charsetMeta = document.createElement('meta');
    charsetMeta.setAttribute('charset', 'UTF-8');
    head.appendChild(charsetMeta);

    // Add viewport meta tag
    const viewportMeta = document.createElement('meta');
    viewportMeta.setAttribute('name', 'viewport');
    viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0');
    head.appendChild(viewportMeta);
}

// Backward-compat alias
export const applyDropMetaTags = applyMetaTags;
