/** @type {import('jest').Config} */
module.exports = {
    preset: "ts-jest",
    testEnvironment: "jsdom",
    testMatch: ["<rootDir>/src/**/*.test.ts"],
    transform: {
        "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.test.json" }],
    },
};
