import { describe, expect, it } from "vitest";

import {
  plotRecords,
  withNumber,
} from "@/features/assistant/view/plot/plot-records";
import type { ViewValue } from "@/features/assistant/view/view-types";

const brl = (amount: number): ViewValue => ({
  money: { amount, currency: "BRL" },
});

describe("plotRecords", () => {
  it("draws one record per row with the label as written and each series as a number", () => {
    const rows: ViewValue[][] = [
      [{ month: "2026-08" }, brl(60000), { count: 2 }],
      [{ month: "2026-09" }, brl(0), { count: 0 }],
    ];
    const labels = ["ago. de 2026", "set. de 2026"];

    const got = plotRecords(rows, labels, {
      label: 0,
      series: [
        { column: 1, kind: "bar" },
        { column: 2, kind: "line", axis: "end" },
      ],
      marks: [],
    });

    expect(got.records).toEqual([
      { label: "ago. de 2026", c1: 60000, c2: 2 },
      { label: "set. de 2026", c1: 0, c2: 0 },
    ]);
    expect(got.series.map((s) => [s.field, s.column, s.unit])).toEqual([
      ["c1", 1, brl(60000)],
      ["c2", 2, { count: 2 }],
    ]);
  });

  it("leaves a gap where a row holds no value", () => {
    const got = plotRecords(
      [
        [{ month: "2026-01" }, {}],
        [{ month: "2026-02" }, brl(5)],
      ],
      ["jan.", "fev."],
      { label: 0, series: [{ column: 1, kind: "line" }], marks: [] },
    );

    expect(got.records).toEqual([{ label: "jan." }, { label: "fev.", c1: 5 }]);
    expect(got.series[0]?.unit).toEqual(brl(5));
  });
});

describe("withNumber", () => {
  it("keeps the unit and the currency of the template", () => {
    expect(withNumber(brl(1), 250)).toEqual(brl(250));
    expect(withNumber({ count: 1 }, 4)).toEqual({ count: 4 });
  });
});
