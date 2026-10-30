/**
 * @jest-environment node
 */
import { build } from "esbuild";
import { minify } from "terser";

const MARKER = "[MinitSDK]";

const GAME_CALLS: Record<string, string> = {
    loadingDone: "loadingDone();",
    reportResult: "reportResult(42);",
    getConfigValue: "(window as any).__minitOut = getConfigValue(\"level\");",
    getUserData: "(window as any).__minitOut = getUserData();",
    initializeSDK: "initializeSDK();",
    getMotionQuality: "(window as any).__minitOut = getMotionQuality();",
    prefersReducedMotion: "(window as any).__minitOut = prefersReducedMotion();",
    getDeviceTier: "(window as any).__minitOut = getDeviceTier();",
};

async function bundleGame(exportName: string, options: { minify: boolean; dropConsole: boolean }): Promise<string> {
    const result = await build({
        stdin: {
            contents: `import { ${exportName} } from "./index.js";\n${GAME_CALLS[exportName]}\n`,
            resolveDir: __dirname,
            sourcefile: "game.ts",
            loader: "ts",
        },
        bundle: true,
        format: "esm",
        platform: "browser",
        treeShaking: true,
        minify: options.minify,
        drop: options.dropConsole ? ["console"] : [],
        write: false,
        logLevel: "silent",
    });
    return result.outputFiles[0].text;
}

describe("SDK fingerprint survives console-stripping production builds", () => {
    describe.each(Object.keys(GAME_CALLS))("a game importing only %s", (exportName) => {
        it("keeps [MinitSDK] after esbuild minify + drop console", async () => {
            const code = await bundleGame(exportName, { minify: true, dropConsole: true });

            expect(code).not.toContain("console.");
            expect(code).toContain(MARKER);
        });

        it("keeps [MinitSDK] after esbuild bundle + terser drop_console", async () => {
            const bundled = await bundleGame(exportName, { minify: false, dropConsole: false });
            const minified = await minify(bundled, {
                module: true,
                compress: { drop_console: true },
                mangle: true,
            });
            const code = minified.code ?? "";

            expect(code).not.toContain("console.");
            expect(code).toContain(MARKER);
        });
    });
});
