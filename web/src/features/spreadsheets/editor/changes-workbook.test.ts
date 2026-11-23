import { describe, expect, it } from "vitest";

import { changesWorkbook } from "@/features/spreadsheets/editor/changes-workbook";

describe("changesWorkbook", () => {
  it.each([
    ["sheet.mutation.set-range-values", { unitId: "w1" }, true],
    ["sheet.mutation.set-range-values", { unitId: "w2" }, false],
    ["sheet.mutation.insert-sheet", {}, true],
    ["data-validation.mutation.addRule", undefined, true],
    ["doc.mutation.rich-text-editing", { unitId: "w1" }, false],
    ["doc.mutation.rich-text-editing", { unitId: "__editor__" }, false],
    ["formula.mutation.set-formula-calculation-result", {}, false],
    ["sheet.mutation.set-range-values", null, true],
  ])("%s with %j changes the workbook: %s", (id, params, want) => {
    expect(changesWorkbook(id, params, "w1")).toBe(want);
  });
});
