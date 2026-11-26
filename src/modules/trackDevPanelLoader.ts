// Loaded on demand so hosted games never fetch the dev UI or its embedded font.
export function showTrackDevPanel(): Promise<void> {
    return import("./trackDevPanel.js").then(
        (panel) => panel.showTrackDevPanel(),
        () => {},
    );
}
