import { getEnvironment, isApp, isTestEnvironment, callApiFunction } from "./utils";

describe("utils", () => {
    afterEach(() => {
        delete window.minit;
        jest.restoreAllMocks();
    });

    describe("getEnvironment", () => {
        it("returns 'testing' when window.minit is absent", () => {
            expect(getEnvironment()).toBe("testing");
        });

        it("returns the environment from window.minit when present", () => {
            window.minit = { environment: "app" } as never;
            expect(getEnvironment()).toBe("app");
        });
    });

    describe("isApp", () => {
        it("is true when environment is 'app'", () => {
            window.minit = { environment: "app" } as never;
            expect(isApp()).toBe(true);
        });

        it("is false when environment is not 'app'", () => {
            window.minit = { environment: "web" } as never;
            expect(isApp()).toBe(false);
        });

        it("is false by default (testing)", () => {
            expect(isApp()).toBe(false);
        });
    });

    describe("isTestEnvironment", () => {
        it("is true when window.minit is absent", () => {
            expect(isTestEnvironment()).toBe(true);
        });

        it("is false when running inside the app", () => {
            window.minit = { environment: "app" } as never;
            expect(isTestEnvironment()).toBe(false);
        });
    });

    describe("callApiFunction", () => {
        it("logs the message and skips the callback in the test environment", () => {
            const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
            const callback = jest.fn();
            callApiFunction(callback, "hello");
            expect(callback).not.toHaveBeenCalled();
            expect(logSpy).toHaveBeenCalledWith("[DropSDK]", "hello");
        });

        it("evaluates a thunk message lazily in the test environment", () => {
            jest.spyOn(console, "log").mockImplementation(() => {});
            const msgFn = jest.fn(() => "lazy");
            callApiFunction(() => {}, msgFn);
            expect(msgFn).toHaveBeenCalledTimes(1);
        });

        it("invokes the callback and skips logging outside the test environment", () => {
            window.minit = { environment: "app" } as never;
            const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
            const callback = jest.fn();
            callApiFunction(callback, "hello");
            expect(callback).toHaveBeenCalledTimes(1);
            expect(logSpy).not.toHaveBeenCalled();
        });
    });
});
