import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";

interface ToolSchema {
  name: string;
  effect: string;
  input_schema: { properties?: Record<string, { enum?: string[] }> };
}

// The catalogue of the tools, as the Go suite writes it; tests run from web/.
const tools = JSON.parse(
  readFileSync("../internal/server/testdata/tools.json", "utf8"),
) as ToolSchema[];

// The fields a preview may name; the registry refuses any other.
const changeFields = readFileSync(
  "../internal/platform/tool/change_fields.go",
  "utf8",
);

// The actions a preview names for a category, beside those of the tool's input.
const categoryActions = ["create", "update", "close", "reopen"].map(
  (verb) => `manage_accounts_and_payees.${verb}_category`,
);

const catalogs = { en: catalogEn, "pt-BR": catalogPtBR };

describe("proposal words", () => {
  it("gives every action a proposal can name its title in each catalog", () => {
    const actions = [...tools.flatMap(previewActions), ...categoryActions];

    expect(actions.length).toBeGreaterThan(100);
    expect(missing(actions.map((a) => `assistant.action.${a}`))).toEqual([]);
  });

  it("gives every field of a change its label in each catalog", () => {
    const fields = [...changeFields.matchAll(/^\t"([a-z_]+)",$/gm)].map(
      (match) => `assistant.field.${match[1] ?? ""}`,
    );

    expect(fields.length).toBeGreaterThan(70);
    expect(missing(fields)).toEqual([]);
  });

  it("gives every class and kind of account its word in each catalog", () => {
    const input = tools.find((x) => x.name === "manage_accounts_and_payees");
    const words = (field: string) =>
      input?.input_schema.properties?.[field]?.enum ?? [];
    const classes = words("class").map((c) => `assistant.value.class.${c}`);
    const kinds = words("kind").map((k) =>
      k === "other" ? "assistant.value.kind.other" : `kind.title.${k}`,
    );

    expect(classes.length).toBe(5);
    expect(kinds.length).toBeGreaterThan(10);
    expect(missing([...classes, ...kinds])).toEqual([]);
  });
});

function previewActions(tool: ToolSchema): string[] {
  if (tool.effect === "read_only") return [];

  const { action, kind } = tool.input_schema.properties ?? {};
  const named =
    tool.name === "record_corporate_action" || tool.name === "record_investment"
      ? kind
      : action;

  return named?.enum?.map((value) => `${tool.name}.${value}`) ?? [tool.name];
}

function missing(keys: string[]): string[] {
  return Object.entries(catalogs).flatMap(([tag, catalog]) =>
    keys.filter((key) => !(key in catalog)).map((key) => `${tag} ${key}`),
  );
}
