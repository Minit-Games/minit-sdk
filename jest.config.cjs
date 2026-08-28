/** @type {import('jest').Config} */
module.exports = {
    preset: "ts-jest",
    testEnvironment: "jsdom",
    testMatch: ["<rootDir>/src/**/*.test.ts"],
    transform: {
        "^.+\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.test.json" }],
        // The tutorial module ships as plain ESM .js (it has no build step of
        // its own). Route it through the same transform so a test can import
        // its primitives at all — without this, importing overlay.js fails
        // with "Cannot use import statement outside a module".
        "^.+\.js$": ["ts-jest", { tsconfig: "tsconfig.test.json" }],
    },
    // Strip .js extensions from relative imports so ts-jest (CommonJS mode)
    // can resolve TypeScript source files that use NodeNext-style .js extensions.
    moduleNameMapper: {
        "^(\.{1,2}/.*)\.js$": "$1",
    },
};
