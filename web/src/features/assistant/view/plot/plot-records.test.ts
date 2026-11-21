import { describe, expect, it } from "vitest";

import {
  plotRecords,
  withNumber,
} from "@/features/assistant/view/plot/plot-records";
import type { ViewValue } from "@/features/assistant/view/view-types";

describe("plotRecords", () => {
  it("draws one record per row with the label as written and each series as a number", () => {
    const rows: ViewValue[][] = [
      [
        { text: "Food" },
        { money: { amount: 60000, currency: "BRL" } },
        { bp: 6000 },
      ],
      [
        { text: "Home" },
        { money: { amount: 40000, currency: "BRL" } },
        { bp: 4000 },
      ],
    ];
    const labels = [
      ["Food", "R$ 600,00", "60%"],
      ["Home", "R$ 400,00", "40%"],
    ];

    const got = plotRecords(rows, labels, { label: 0, series: [1] });

    expect(got.records).toEqual([
      { label: "Food", s1: 60000 },
      { label: "Home", s1: 40000 },
    ]);
    expect(got.series).toEqual([
      {
        field: "s1",
        column: 1,
        unit: { money: { amount: 60000, currency: "BRL" } },
      },
    ]);
  });

  it("reads a missing value as zero", () => {
    const got = plotRecords([[{ text: "A" }]], [["A"]], {
      label: 0,
      series: [1],
    });

    expect(got.records).toEqual([{ label: "A", s1: 0 }]);
  });
});

describe("withNumber", () => {
  it("keeps the unit and the currency of the template", () => {
    expect(withNumber({ money: { amount: 1, currency: "USD" } }, 250)).toEqual({
      money: { amount: 250, currency: "USD" },
    });
    expect(withNumber({ bp: 1 }, 30)).toEqual({ bp: 30 });
    expect(withNumber({ rate: 1 }, 7)).toEqual({ rate: 7 });
    expect(withNumber({ count: 1 }, 4)).toEqual({ count: 4 });
  });
});
