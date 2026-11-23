import { describe, expect, it } from "vitest";

import {
  chartTable,
  readSettings,
} from "@/features/spreadsheets/charts/chart-table";

const name = (n: number) => `Series ${String(n)}`;

describe("chartTable", () => {
  it("reads a header row and a label column", () => {
    expect(
      chartTable(
        [
          ["Month", "Income", "Expense"],
          ["Jan", 100, 80],
          ["Feb", 120, "n/a"],
        ],
        name,
      ),
    ).toEqual({
      series: [
        { field: "s0", label: "Income" },
        { field: "s1", label: "Expense" },
      ],
      records: [
        { category: "Jan", s0: 100, s1: 80 },
        { category: "Feb", s0: 120, s1: null },
      ],
    });
  });

  it("numbers the series and the categories of a range of numbers alone", () => {
    expect(
      chartTable(
        [
          [1, 2],
          [3, 4],
        ],
        name,
      ),
    ).toEqual({
      series: [
        { field: "s0", label: "Series 1" },
        { field: "s1", label: "Series 2" },
      ],
      records: [
        { category: "1", s0: 1, s1: 2 },
        { category: "2", s0: 3, s1: 4 },
      ],
    });
  });

  it("reads one column of numbers under its title as one series", () => {
    expect(chartTable([["Total"], [5], [null], [7]], name)).toEqual({
      series: [{ field: "s0", label: "Total" }],
      records: [
        { category: "1", s0: 5 },
        { category: "2", s0: null },
        { category: "3", s0: 7 },
      ],
    });
  });

  it("takes a year in the first column as a value, not as a label", () => {
    const table = chartTable(
      [
        ["Year", "Saved"],
        [2025, 10],
        [2026, 20],
      ],
      name,
    );

    expect(table.series.map((s) => s.label)).toEqual(["Year", "Saved"]);
    expect(table.records[0]).toEqual({ category: "1", s0: 2025, s1: 10 });
  });

  it("names an untitled series and an unnamed category by their position", () => {
    const table = chartTable(
      [
        ["", ""],
        ["", 3],
      ],
      name,
    );

    expect(table.series).toEqual([{ field: "s0", label: "Series 1" }]);
    expect(table.records).toEqual([{ category: "1", s0: 3 }]);
  });

  it("gives nothing for no cell", () => {
    expect(chartTable([], name)).toEqual({ series: [], records: [] });
  });
});

describe("readSettings", () => {
  const range = { startRow: 0, endRow: 3, startColumn: 0, endColumn: 2 };

  it("reads what a chart stores", () => {
    expect(
      readSettings({ kind: "pie", sheetID: "s", range, extra: 1 }),
    ).toEqual({
      kind: "pie",
      sheetID: "s",
      range,
    });
  });

  it.each([
    [null],
    ["chart"],
    [{ kind: "radar", sheetID: "s", range }],
    [{ kind: "line", range }],
    [{ kind: "line", sheetID: "s" }],
    [{ kind: "line", sheetID: "s", range: { ...range, endRow: -1 } }],
    [{ kind: "line", sheetID: "s", range: { ...range, startColumn: 1.5 } }],
  ])("refuses %j", (value) => {
    expect(readSettings(value)).toBeNull();
  });
});
