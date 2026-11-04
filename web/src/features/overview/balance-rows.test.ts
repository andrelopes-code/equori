import { describe, expect, it } from "vitest";

import { balanceFloor, balanceRows } from "@/features/overview/balance-rows";

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

describe("balanceFloor", () => {
  const row = (balance: number | null, projection: number | null = null) => ({
    date: "2026-11-01",
    balance,
    projection,
  });

  it.each([
    [
      "a balance far from zero",
      [row(9_300_000), row(null, 10_200_000), row(9_000_000)],
      8_000_000,
    ],
    ["a flat balance", [row(500_000), row(null, 500_000)], 480_000],
    ["a balance near zero", [row(20_000), row(null, 900_000)], 0],
    ["a negative balance", [row(-5_000), row(null, 900_000)], undefined],
    ["no balance", [row(null)], undefined],
    ["a zero balance", [row(0), row(null, 0)], undefined],
  ])("fits the axis of %s", (_, rows, floor) => {
    expect(balanceFloor(rows)).toBe(floor);
  });
});
