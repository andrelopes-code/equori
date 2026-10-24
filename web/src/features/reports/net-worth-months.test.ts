import { describe, expect, it } from "vitest";

import { monthEnds, netWorthRows } from "@/features/reports/net-worth-months";

const money = (amount: number) => ({ amount, currency: "BRL" });
const worth = (assets: number, liabilities: number) => ({
  assets: money(assets),
  liabilities: money(liabilities),
  net: money(assets - liabilities),
});

describe("monthEnds", () => {
  it("ends the current month on today and the others on their last day", () => {
    expect(monthEnds("2026-03-17", 4)).toEqual([
      { month: "2025-12", date: "2025-12-31" },
      { month: "2026-01", date: "2026-01-31" },
      { month: "2026-02", date: "2026-02-28" },
      { month: "2026-03", date: "2026-03-17" },
    ]);
  });

  it("knows a leap February", () => {
    expect(monthEnds("2024-03-05", 2)[0]).toEqual({
      month: "2024-02",
      date: "2024-02-29",
    });
  });
});

describe("netWorthRows", () => {
  const months = monthEnds("2026-10-17", 3);

  it("changes each month against the one before, in basis points of its magnitude", () => {
    const rows = netWorthRows(months, [
      worth(200000, 120000),
      worth(205500, 120000),
      worth(220500, 120000),
    ]);
    expect(rows.map((r) => [r.month, r.net, r.change, r.changeBP])).toEqual([
      ["2026-08", 80000, undefined, undefined],
      ["2026-09", 85500, 5500, 688],
      ["2026-10", 100500, 15000, 1754],
    ]);
  });

  it("leaves a month without an answer empty and its neighbour without a change", () => {
    const rows = netWorthRows(months, [
      worth(200000, 120000),
      undefined,
      worth(220500, 120000),
    ]);
    expect(rows[1]).toEqual({ month: "2026-09" });
    expect(rows[2]?.change).toBeUndefined();
  });

  it("has no percent when the month before nets zero", () => {
    const rows = netWorthRows(months.slice(1), [
      worth(120000, 120000),
      worth(130000, 120000),
    ]);
    expect(rows[1]?.change).toBe(10000);
    expect(rows[1]?.changeBP).toBeUndefined();
  });
});
