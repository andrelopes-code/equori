import { describe, expect, it } from "vitest";

import {
  isDatePattern,
  sheetRows,
} from "@/features/spreadsheets/files/sheet-rows";

describe("isDatePattern", () => {
  it.each([
    ["dd/mm/yyyy", true],
    ["m/d/yyyy h:mm", true],
    ["[h]:mm:ss", true],
    ["mmm-yy", true],
    ["#,##0.00", false],
    ["0%", false],
    ["0.00E+00", false],
    ["General", false],
    ['#,##0.00 "dias"', false],
    ["[Red]#,##0;[Blue]-#,##0", false],
    ["0\\h", false],
    ["@", false],
    ["", false],
    [null, false],
    [undefined, false],
  ])("%j is a date format: %s", (pattern, want) => {
    expect(isDatePattern(pattern)).toBe(want);
  });
});

describe("sheetRows", () => {
  it("keeps numbers as held and dates as shown", () => {
    expect(
      sheetRows(
        [
          ["Rent", 1500.5, 46349],
          [null, true, 0.1],
        ],
        [
          ["Rent", "1.500,50", "23/11/2026"],
          ["", "TRUE", "10%"],
        ],
        [
          [null, "#,##0.00", "dd/mm/yyyy"],
          [undefined, "", "0%"],
        ],
      ),
    ).toEqual([
      ["Rent", 1500.5, "23/11/2026"],
      [null, true, 0.1],
    ]);
  });
});
