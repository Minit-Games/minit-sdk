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
 * These assertions are expected to FAIL until DROP-8993 adds the keywords —
 * this file is written test-first, before that implementation exists.
 */

import { readFileSync } from "fs";
import { join } from "path";

interface JsonSchemaNode {
    type?: string;
    description?: string;
    maxLength?: number;
    [key: string]: unknown;
}

interface MetaSchema {
    $schema: string;
    $id: string;
    type: string;
    properties: Record<string, JsonSchemaNode>;
    $defs: {
        configEntry: {
            properties: Record<string, JsonSchemaNode>;
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
                expect(description).toEqual(expect.stringContaining("truncat"));
            },
        );
    });

    describe("config[].description (existing precedent, unchanged)", () => {
        it("still caps at 100 characters", () => {
            expect(schema.$defs.configEntry.properties.description.maxLength).toBe(100);
        });
    });
});
