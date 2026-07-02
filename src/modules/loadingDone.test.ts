/**
 * Tests for the loadingDone one-shot host signal.
 *
 * The module keeps a `_loadingDonePosted` guard at module scope, so each test
 * resets the registry (jest.resetModules()) and re-imports via a fresh dynamic
 * import() to get a clean guard — matching headerPanel.test.ts.
 */

describe("loadingDone", () => {
    afterEach(() => {
        delete window.minit;
        jest.restoreAllMocks();
    });

    it("does not call the host loadingDone in the test environment", async () => {
        jest.resetModules();
        const hostLoadingDone = jest.fn();
        window.minit = {
            environment: "testing",
            loadingDone: hostLoadingDone,
        } as never;

        const { loadingDone } = await import("./loadingDone");
        loadingDone();

        expect(hostLoadingDone).not.toHaveBeenCalled();
    });

    it("posts loadingDone to the host exactly once outside the test environment", async () => {
        jest.resetModules();
        const hostLoadingDone = jest.fn();
        window.minit = {
            environment: "app",
            loadingDone: hostLoadingDone,
        } as never;

        const { loadingDone } = await import("./loadingDone");
        loadingDone();
        loadingDone();
        loadingDone();

        expect(hostLoadingDone).toHaveBeenCalledTimes(1);
    });

    it("guards before the environment check — a test-env first call blocks a later app call", async () => {
        jest.resetModules();
        const hostLoadingDone = jest.fn();

        // First call while the env reports 'testing' → guard is set, host untouched.
        window.minit = {
            environment: "testing",
            loadingDone: hostLoadingDone,
        } as never;
        const { loadingDone } = await import("./loadingDone");
        loadingDone();

        // Later the env reports 'app', but the guard short-circuits the repeat.
        window.minit = {
            environment: "app",
            loadingDone: hostLoadingDone,
        } as never;
        loadingDone();

        expect(hostLoadingDone).not.toHaveBeenCalled();
    });
});
