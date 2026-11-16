import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// Files that paint `--slotted-surface-raised` as a ground today. The list only shrinks: a file
// leaves it when its ground reads `--slotted-panel-surface` (docs/contributing/web.md, O18).
const RAW_GROUND = [
  "src/features/accounts/kind-chooser/kind-chooser.module.css",
  "src/features/accounts/kind-chooser/kind-panel.module.css",
  "src/features/assistant/message/answer-blocks.module.css",
  "src/features/assistant/message/turn-activity.module.css",
  "src/features/assistant/proposal/decision-sheet.module.css",
  "src/features/assistant/proposal/results.module.css",
  "src/features/categories/category-mark/category-avatar.module.css",
  "src/features/planning/budget-plan/budget-plan.module.css",
  "src/features/planning/income-split/bucket-categories.module.css",
  "src/features/setup/market-data/market-data.module.css",
  "src/features/setup/pages/settings-page.module.css",
  "src/features/setup/previews/appearance-previews.module.css",
  "src/features/setup/studio/appearance-preview.module.css",
  "src/features/setup/themes/theme-miniature.module.css",
  "src/ui/region/region-flag.module.css",
];

describe("rawGrounds", () => {
  it.each([
    ["background: var(--slotted-surface-raised);", 1],
    ["background-color: var(--slotted-surface-raised);", 1],
    [
      "background: color-mix(in oklab, var(--slotted-text) 5%, var(--slotted-surface-raised));",
      1,
    ],
    [
      "background: var(--slotted-panel-surface, var(--slotted-surface-raised));",
      0,
    ],
    ["border: 1px solid var(--slotted-surface-raised);", 0],
    ["background: var(--slotted-border-subtle);", 0],
  ])("counts the raw grounds of %s", (source, expected) => {
    expect(rawGrounds(source)).toBe(expected);
  });
});

describe("stylesheets under src", () => {
  it("paint a card ground from the panel surface, not from the raised surface", () => {
    const offenders = stylesheets().filter(
      (file) =>
        !RAW_GROUND.includes(file) &&
        rawGrounds(readFileSync(file, "utf8")) > 0,
    );

    expect(offenders).toEqual([]);
  });

  it("keep RAW_GROUND to files that still paint a raw ground", () => {
    const stale = RAW_GROUND.filter(
      (file) => rawGrounds(readFileSync(file, "utf8")) === 0,
    );

    expect(stale).toEqual([]);
  });
});

function stylesheets(): string[] {
  return readdirSync("src", { recursive: true })
    .filter((file) => file.endsWith(".module.css"))
    .map((file) => `src/${file}`);
}

// A ground is a `background` declaration; the glass theme publishes the card fill under
// `--slotted-panel-surface`, and the raised surface stays the fallback of the standard theme.
function rawGrounds(source: string): number {
  return [...source.matchAll(/background(?:-color)?:[^;]*;/g)].filter(
    ([declaration]) =>
      declaration.includes("var(--slotted-surface-raised)") &&
      !declaration.includes("--slotted-panel-surface"),
  ).length;
}
