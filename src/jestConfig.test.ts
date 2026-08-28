/**
 * Regression guard for the Jest config's regex keys.
 *
 * `transform` and `moduleNameMapper` keys are regexes written inside JS string
 * literals, so a literal dot needs a DOUBLE backslash. With a single one the
 * escape collapses at parse time and `\.` silently becomes `.` — any
 * character. Nothing fails loudly: the patterns keep matching everything they
 * used to and quietly start matching things they should not, surfacing much
 * later as a "Cannot find module" pointing at the wrong file.
 *
 * This happened once already (PR #48 review): the mapper became
 * `^(.{1,2}/.*).js$`, which matches the bare package path `qs/lib/index.js`
 * and rewrites it to an unresolvable extensionless specifier.
 */

import { readFileSync } from "fs";
import { join } from "path";

interface JestConfigShape {
    transform: Record<string, unknown>;
    moduleNameMapper: Record<string, string>;
}

/**
 * Evaluate the config from source rather than `require`-ing it. A `require`
 * here would itself be routed through the very moduleNameMapper under test —
 * with the entry broken, the specifier is rewritten and this suite dies at
 * import time instead of reporting which pattern is wrong.
 */
function loadJestConfig(): JestConfigShape {
    const src = readFileSync(join(__dirname, "..", "jest.config.cjs"), "utf8");
    const module_ = { exports: {} as JestConfigShape };
    new Function("module", "exports", src)(module_, module_.exports);
    return module_.exports;
}

const jestConfig = loadJestConfig();

/** The one mapper entry that strips NodeNext-style .js extensions. */
function relativeJsMapperPattern(): RegExp {
    const keys = Object.keys(jestConfig.moduleNameMapper);
    expect(keys).toHaveLength(1);
    return new RegExp(keys[0]);
}

describe("jest.config.cjs — regex keys are correctly escaped", () => {
    it("maps relative .js specifiers", () => {
        const re = relativeJsMapperPattern();
        expect(re.test("./theme.js")).toBe(true);
        expect(re.test("../primitives/pill.js")).toBe(true);
    });

    it("leaves bare package subpaths alone, including 1-2 char package names", () => {
        // `.{1,2}` matching any two characters instead of one-or-two dots is
        // the exact shape of the de-escaping bug: these must NOT match.
        const re = relativeJsMapperPattern();
        expect(re.test("qs/lib/index.js")).toBe(false);
        expect(re.test("os/x.js")).toBe(false);
        expect(re.test("react-dom/client.js")).toBe(false);
    });

    it("routes only real .ts/.tsx and .js files through a transform", () => {
        const keys = Object.keys(jestConfig.transform);
        const matches = (path: string): boolean =>
            keys.some((k) => new RegExp(k).test(path));

        expect(matches("src/modules/feedback.ts")).toBe(true);
        expect(matches("src/modules/tutorial/overlay.js")).toBe(true);

        // An unescaped `.` in `^.+\.js$` also swallows .mjs/.cjs, which would
        // silently route ESM-only scripts through the CommonJS transform.
        expect(matches("scripts/bundle-tutorial-assets.mjs")).toBe(false);
        expect(matches("some/module.cjs")).toBe(false);
    });
});
