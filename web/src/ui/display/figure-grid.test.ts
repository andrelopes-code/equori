import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// The page publishes `--slotted-page-gap`; a dialog or a drawer does not, and a gap with no value
// is zero. These grids are drawn in both.
const GRIDS = [
  "src/ui/display/figure-grid.module.css",
  "src/features/instruments/company-report/company-figure-grid.module.css",
];

describe("grids of figures", () => {
  it.each(GRIDS)("%s keeps its gap outside a page", (path) => {
    expect(readFileSync(path, "utf8")).toContain(
      "gap: var(--slotted-page-gap, var(--slotted-space-6));",
    );
  });
});
