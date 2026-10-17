import { readFileSync } from "node:fs";
import { flattenTheme } from "@slotted/theme";
import { themeConformance } from "@slotted/theme/conformance";
import contract from "@slotted/theme/contract.json" with { type: "json" };
import theme from "./equori.theme.ts";

themeConformance({
  contract,
  theme: flattenTheme(theme),
  css: readFileSync(new URL("./equori.gen.css", import.meta.url), "utf8"),
});
