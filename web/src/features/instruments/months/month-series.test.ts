import { describe, expect, it } from "vitest";

import { monthSeries } from "@/features/instruments/months/month-series";

const end = {
  instrument: "PETR4",
  quote_instrument: "BRL",
  date: "2026-01-30",
  value: "1",
  source: "manual",
};

describe("monthSeries", () => {
  it("lists the months with a change, as fractions", () => {
    const cells = Array<number | null>(12).fill(null);
    cells[0] = -125;
    cells[9] = 1505;

    expect(monthSeries([{ year: 2026, cells, changeBp: null, end }])).toEqual([
      { month: "2026-01", value: -0.0125 },
      { month: "2026-10", value: 0.1505 },
    ]);
  });
});
