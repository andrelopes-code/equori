import { describe, expect, it } from "vitest";

import { netWorthRows } from "@/features/reports/net-worth-rows";

describe("net worth rows", () => {
  it("joins the days up to today with the forecast, today carrying both", () => {
    const rows = netWorthRows(
      [
        { date: "2026-10-16", net: { amount: 900 } },
        { date: "2026-10-17", net: { amount: 1000 } },
      ],
      [
        {
          date: "2026-10-17",
          value: 1000,
          scheduled: 0,
          recurring: 0,
          variable: 0,
        },
        {
          date: "2026-10-18",
          value: 950,
          scheduled: 0,
          recurring: 0,
          variable: -50,
        },
      ],
    );

    expect(rows).toEqual([
      { date: "2026-10-16", net: 900, forecast: null, low: null, high: null },
      { date: "2026-10-17", net: 1000, forecast: 1000, low: null, high: null },
      { date: "2026-10-18", net: null, forecast: 950, low: null, high: null },
    ]);
  });

  it("carries the likely range of a forecast day that states one", () => {
    const rows = netWorthRows(
      [],
      [
        {
          date: "2026-10-18",
          value: 950,
          low: 900,
          high: 1020,
          scheduled: 0,
          recurring: 0,
          variable: -50,
        },
      ],
    );

    expect(rows).toEqual([
      { date: "2026-10-18", net: null, forecast: 950, low: 900, high: 1020 },
    ]);
  });

  it("keeps the days alone without a forecast", () => {
    expect(
      netWorthRows([{ date: "2026-09-30", net: { amount: 5 } }], []),
    ).toEqual([
      { date: "2026-09-30", net: 5, forecast: null, low: null, high: null },
    ]);
  });
});
