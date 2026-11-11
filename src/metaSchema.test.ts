/**
 * Regression / spec guard for schemas/meta.schema.json's text-length caps
 * (DROP-8993). The schema has no runtime consumer in this repo — it exists so
 * schema-driven AI tooling catches over-limit `meta.json` text at authoring
 * time — so this test reads the JSON file directly rather than exercising any
 * SDK code path.
 *
 * DROP-8994 acceptance criteria this encodes:
 *   - the schema parses as valid JSON Schema
 *   - `title` caps at 50, `description`/`controls`/`logic` cap at 2500 each
 *   - `credits` carries NO maxLength (the meta.json path is genuinely uncapped)
 *   - every field given a new maxLength also documents that over-limit text is
 *     truncated by the platform, not rejected
 *   - `config[].description`'s existing maxLength: 100 is unchanged
 *
 * DROP-8993 (the schema changes these assertions guard) ships in this same
 * PR, so these assertions pass against the completed changeset — this file
 * was authored test-first, ahead of that implementation.
 */

import { readFileSync } from "fs";
import { join } from "path";

interface JsonSchemaNode {
    type?: string;
    description?: string;
    maxLength?: number;
    [key: string]: unknown;
}

type PropertyCondition = { const?: unknown; not?: { const?: unknown } };

interface ConditionalBranch {
    if: { required?: string[]; properties?: Record<string, PropertyCondition> };
    then: { properties?: Record<string, unknown> };
}

interface MetaSchema {
    $schema: string;
    $id: string;
    type: string;
    properties: Record<string, JsonSchemaNode>;
    $defs: {
        configEntry: {
            properties: Record<string, JsonSchemaNode>;
            additionalProperties: boolean;
            allOf: ConditionalBranch[];
        };
    };
}

function loadMetaSchema(): MetaSchema {
    const raw = readFileSync(join(__dirname, "..", "schemas", "meta.schema.json"), "utf8");
    return JSON.parse(raw) as MetaSchema;
}

const schema = loadMetaSchema();

describe("schemas/meta.schema.json", () => {
    it("parses as valid JSON Schema", () => {
        expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
        expect(schema.type).toBe("object");
        expect(typeof schema.properties).toBe("object");
    });

    describe("new text-length caps (DROP-8993)", () => {
        it("caps title at 50 characters", () => {
            expect(schema.properties.title.maxLength).toBe(50);
        });

        it.each(["description", "controls", "logic"])(
            "caps %s at 2500 characters",
            (field) => {
                expect(schema.properties[field].maxLength).toBe(2500);
            },
        );

        it("credits carries no maxLength — the meta.json path is genuinely uncapped", () => {
            expect(schema.properties.credits.maxLength).toBeUndefined();
        });

        it.each(["title", "description", "controls", "logic"])(
            "%s's description states the text is truncated, not rejected",
            (field) => {
                const description = schema.properties[field].description;
                expect(typeof description).toBe("string");
                expect(description!.length).toBeGreaterThan(0);
                // Both substrings must be present: "truncat" alone also matches the
                // opposite contract ("not truncated ... rejected"), so pin the
                // "not rejected" half too — a reversed claim fails this guard.
                expect(description).toEqual(expect.stringContaining("truncat"));
                expect(description).toEqual(expect.stringContaining("not rejected"));
            },
        );
    });

    describe("config[].description (existing precedent, unchanged)", () => {
        it("still caps at 100 characters", () => {
            expect(schema.$defs.configEntry.properties.description.maxLength).toBe(100);
        });
    });

    describe("config[].step", () => {
        const configEntry = schema.$defs.configEntry;

        // The SDK ships no JSON Schema validator, so this evaluates only the
        // keywords configEntry's allOf branches use (required, const, not.const).
        function branchApplies(branch: ConditionalBranch, entry: Record<string, unknown>): boolean {
            const required = branch.if.required ?? [];
            if (!required.every((key) => key in entry)) return false;
            return Object.entries(branch.if.properties ?? {}).every(([key, condition]) => {
                if (!(key in entry)) return true;
                if ("const" in condition) return entry[key] === condition.const;
                if (condition.not && "const" in condition.not) return entry[key] !== condition.not.const;
                return true;
            });
        }

        function stepRejectionReason(entry: Record<string, unknown>): string | null {
            const stepSchema = configEntry.properties.step;
            if (!stepSchema) return "configEntry has no step property (additionalProperties: false)";
            if (stepSchema.type !== "number" || typeof entry.step !== "number") return "step is not a number";
            if (typeof stepSchema.exclusiveMinimum === "number" && entry.step <= stepSchema.exclusiveMinimum) {
                return "step violates exclusiveMinimum";
            }
            const forbidding = configEntry.allOf.find(
                (branch) => branchApplies(branch, entry) && branch.then.properties?.step === false,
            );
            return forbidding ? "step forbidden by an allOf branch" : null;
        }

        it("declares step as a number with exclusiveMinimum 0", () => {
            const step = configEntry.properties.step;
            expect(step).toBeDefined();
            expect(step.type).toBe("number");
            expect(step.exclusiveMinimum).toBe(0);
        });

        it.each([
            ["without min/max", { key: "speed", valueType: "number", value: 1, step: 0.5 }],
            ["with min/max", { key: "speed", valueType: "number", value: 1, min: 0, max: 10, step: 0.5 }],
        ])("accepts a positive step on a number entry %s", (_label, entry) => {
            expect(stepRejectionReason(entry)).toBeNull();
        });

        it.each([0, -1])("rejects step %p", (step) => {
            const entry = { key: "speed", valueType: "number", value: 1, step };
            expect(configEntry.properties.step).toBeDefined();
            expect(stepRejectionReason(entry)).toBe("step violates exclusiveMinimum");
        });

        it("rejects step together with range", () => {
            const entry = { key: "speed", valueType: "number", value: 1, range: [1, 2, 3], step: 1 };
            expect(configEntry.properties.step).toBeDefined();
            expect(stepRejectionReason(entry)).toBe("step forbidden by an allOf branch");
        });

        it.each([
            ["string", "hello"],
            ["boolean", true],
            ["color", "#ff0000"],
        ])("rejects step on a %s entry", (valueType, value) => {
            const entry = { key: "k", valueType, value, step: 1 };
            expect(configEntry.properties.step).toBeDefined();
            expect(stepRejectionReason(entry)).toBe("step forbidden by an allOf branch");
        });

        it("accepts an off-grid value: step is a UI hint, not a value constraint", () => {
            const entry = { key: "speed", valueType: "number", value: 0.35, step: 0.1 };
            expect(stepRejectionReason(entry)).toBeNull();
            expect(JSON.stringify(configEntry)).not.toContain("multipleOf");
        });
    });
});
