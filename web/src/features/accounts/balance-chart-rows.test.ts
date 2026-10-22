import { describe, expect, it } from "vitest";

import { balanceChartRows } from "@/features/accounts/balance-chart-rows";

const money = (amount: number) => ({ amount, currency: "BRL" });

describe("balanceChartRows", () => {
  it("continues the history day by day with the balance the schedules leave", () => {
    const rows = balanceChartRows(
      [
        { date: "2026-10-20", balance: money(1000) },
        { date: "2026-10-21", balance: money(900) },
      ],
      {
        opening: money(900),
        points: [
          { date: "2026-10-23", balance: money(600) },
          { date: "2026-10-23", balance: money(650) },
        ],
      },
      "2026-10-21",
      "2026-10-24",
    );
    expect(rows).toEqual([
      { date: "2026-10-20", balance: 1000, projection: null },
      { date: "2026-10-21", balance: 900, projection: 900 },
      { date: "2026-10-22", balance: null, projection: 900 },
      { date: "2026-10-23", balance: null, projection: 650 },
      { date: "2026-10-24", balance: null, projection: 650 },
    ]);
  });

  it("draws the history alone without a projection", () => {
    expect(
      balanceChartRows(
        [{ date: "2026-10-21", balance: money(5) }],
        undefined,
        "2026-10-21",
        "2026-10-25",
      ),
    ).toEqual([{ date: "2026-10-21", balance: 5, projection: null }]);
  });
});
