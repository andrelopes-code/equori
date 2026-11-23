import { describe, expect, it } from "vitest";

import {
  cellName,
  cellPosition,
  columnIndex,
  columnName,
  shiftFormula,
} from "@/features/spreadsheets/files/xlsx-refs";

describe("column names", () => {
  it.each([
    [0, "A"],
    [25, "Z"],
    [26, "AA"],
    [27, "AB"],
    [701, "ZZ"],
    [702, "AAA"],
    [16383, "XFD"],
  ])("column %i is %s", (index, name) => {
    expect(columnName(index)).toBe(name);
    expect(columnIndex(name)).toBe(index);
  });

  it("names and places a cell", () => {
    expect(cellName(2, 27)).toBe("AB3");
    expect(cellPosition("AB3")).toEqual({ row: 2, column: 27 });
    expect(cellPosition("$C$10")).toEqual({ row: 9, column: 2 });
  });
});

describe("shiftFormula", () => {
  it.each([
    ["A1*2", 1, 0, "A2*2"],
    ["SUM(A1:B2)", 2, 1, "SUM(B3:C4)"],
    ["$A1+A$1+$A$1", 3, 3, "$A4+D$1+$A$1"],
    ['IF(A1="A1",B1,"x")', 1, 1, 'IF(B2="A1",C2,"x")'],
    ["'Sheet A1'!A1+Data!B2", 1, 0, "'Sheet A1'!A2+Data!B3"],
    ["LOG10(A1)+ATAN2(B1,C1)", 1, 0, "LOG10(A2)+ATAN2(B2,C2)"],
    ["A1", -1, 0, "#REF!"],
    ["B2", 0, -2, "#REF!"],
    ["TODAY()+1", 5, 5, "TODAY()+1"],
  ])(
    "shifts %s by %i rows and %i columns to %s",
    (formula, rows, columns, want) => {
      expect(shiftFormula(formula, rows, columns)).toBe(want);
    },
  );
});
