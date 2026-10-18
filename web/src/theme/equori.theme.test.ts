import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { flattenTheme } from "@slotted/theme";
import { themeConformance } from "@slotted/theme/conformance";
import contract from "@slotted/theme/contract.json" with { type: "json" };
import theme from "./equori.theme.ts";

const css = readFileSync(new URL("./equori.gen.css", import.meta.url), "utf8");

themeConformance({ contract, theme: flattenTheme(theme), css });

// Ledger sheet decision L1.
test("seeds are teal, zinc, yellow and red", () => {
  assert.equal(theme.seeds.accent, "#2dd4bf");
  assert.equal(theme.seeds.neutral, "#71717a");
  assert.equal(theme.seeds.warning, "#facc15");
  assert.equal(theme.seeds.danger, "#f87171");
});

// Ledger sheet decision L11: a total closes with a double rule.
test("table summary cells carry a double top rule", () => {
  const rule = /\[data-ui="table"\] \[data-part="summary"\][^{]*\{[^}]*double/;
  assert.ok(rule.test(css), "the summary rule is missing from equori.gen.css");
});
