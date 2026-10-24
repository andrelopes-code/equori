import { describe, expect, it } from "vitest";

import { balanceRows } from "@/features/overview/balance-rows";

describe("balanceRows", () => {
  it("keeps the realized balance up to today and the forecast from today, joined on today", () => {
    const rows = balanceRows([
      { date: "2026-10-16", realized: 100, forecast: undefined, events: [] },
      { date: "2026-10-17", realized: 120, forecast: 120, events: [] },
      { date: "2026-10-18", realized: undefined, forecast: 90, events: [] },
    ]);
    expect(rows).toEqual([
      { date: "2026-10-16", balance: 100, projection: null },
      { date: "2026-10-17", balance: 120, projection: 120 },
      { date: "2026-10-18", balance: null, projection: 90 },
    ]);
  });
});
