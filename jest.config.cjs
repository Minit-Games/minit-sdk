/** @type {import('jest').Config} */
module.exports = {
    preset: "ts-jest",
    testEnvironment: "jsdom",
    testMatch: ["<rootDir>/src/**/*.test.ts"],
    transform: {
        "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.test.json" }],
    },
    // Strip .js extensions from relative imports so ts-jest (CommonJS mode)
    // can resolve TypeScript source files that use NodeNext-style .js extensions.
    moduleNameMapper: {
        "^(\\.{1,2}/.*)\\.js$": "$1",
    },
};
