import { describe, expect, it } from "vitest";

import { flowRows, flowTotals } from "@/features/reports/flow-rows";

const money = (amount: number) => ({ amount, currency: "BRL" });
const day = (date: string, inflow: number, outflow: number) => ({
  date,
  inflow: money(inflow),
  outflow: money(outflow),
});

const days = [
  day("2026-09-20", 5000, 0),
  day("2026-10-05", 100000, 12500),
  day("2026-10-07", 0, 800),
];

describe("flowRows", () => {
  it("keeps each day as it comes, with its result", () => {
    expect(flowRows(days, "day")).toEqual([
      { key: "2026-09-20", inflow: 5000, outflow: 0, result: 5000 },
      { key: "2026-10-05", inflow: 100000, outflow: 12500, result: 87500 },
      { key: "2026-10-07", inflow: 0, outflow: 800, result: -800 },
    ]);
  });

  it("adds the days of a month in minor units", () => {
    expect(flowRows(days, "month")).toEqual([
      { key: "2026-09", inflow: 5000, outflow: 0, result: 5000 },
      { key: "2026-10", inflow: 100000, outflow: 13300, result: 86700 },
    ]);
  });

  it("orders the rows by date whatever the order of the answer", () => {
    expect(flowRows([...days].reverse(), "day").map((r) => r.key)).toEqual([
      "2026-09-20",
      "2026-10-05",
      "2026-10-07",
    ]);
  });
});

describe("flowTotals", () => {
  it("adds inflow and outflow and takes the result from them", () => {
    expect(flowTotals(flowRows(days, "day"))).toEqual({
      inflow: 105000,
      outflow: 13300,
      result: 91700,
    });
  });
});
