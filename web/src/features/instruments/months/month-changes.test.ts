import { describe, expect, it } from "vitest";

import { monthChanges } from "@/features/instruments/months/month-changes";

const price = (date: string, value: string) => ({
  instrument: "PETR4",
  quote_instrument: "BRL",
  date,
  value,
  source: "b3_cotahist",
});

const cellsOf = (changes: Record<number, number>) =>
  Array.from({ length: 12 }, (_, month) => changes[month + 1] ?? null);

describe("monthChanges", () => {
  it("measures each month from the last price before it", () => {
    const rows = monthChanges([
      price("2025-11-03", "10.00"),
      price("2025-11-28", "12.00"),
      price("2025-12-30", "15.00"),
      price("2026-01-05", "99.00"),
      price("2026-01-30", "12.00"),
    ]);

    expect(rows.map((r) => r.year)).toEqual([2026, 2025]);
    expect(rows[1]?.cells).toEqual(cellsOf({ 11: 2000, 12: 2500 }));
    expect(rows[0]?.cells).toEqual(cellsOf({ 1: -2000 }));
  });

  it("measures each year from the last price of the year before", () => {
    const rows = monthChanges([
      price("2024-03-14", "10.00"),
      price("2024-12-31", "12.00"),
      price("2025-06-02", "15.00"),
      price("2025-12-31", "18.00"),
      price("2026-11-12", "27.00"),
    ]);

    expect(rows.map((r) => r.changeBp)).toEqual([5000, 5000, 2000]);
    expect(rows.map((r) => r.end.value)).toEqual(["27.00", "18.00", "12.00"]);
  });

  it("skips a month and a year without a price and keeps the older base", () => {
    const rows = monthChanges([
      price("2022-05-10", "10.00"),
      price("2024-02-01", "20.00"),
      price("2024-11-01", "30.00"),
    ]);

    expect(rows.map((r) => r.year)).toEqual([2024, 2022]);
    expect(rows[0]?.cells).toEqual(cellsOf({ 2: 10000, 11: 5000 }));
    expect(rows[0]?.changeBp).toBe(20000);
  });

  it("gives no change to a first month and a first year with one price", () => {
    const rows = monthChanges([
      price("2023-12-29", "5.00"),
      price("2024-06-03", "6.00"),
    ]);

    expect(rows[1]?.cells).toEqual(cellsOf({}));
    expect(rows[1]?.changeBp).toBeNull();
    expect(rows[0]?.changeBp).toBe(2000);
  });

  it("gives no change to a start price of zero", () => {
    const rows = monthChanges([
      price("2023-12-29", "0"),
      price("2024-06-03", "6.00"),
      price("2025-02-03", "7.00"),
    ]);

    expect(rows[1]).toMatchObject({ year: 2024, changeBp: null });
    expect(rows[1]?.cells).toEqual(cellsOf({}));
  });

  it("reads the prices in any order", () => {
    const rows = monthChanges([
      price("2026-02-27", "12.00"),
      price("2026-01-02", "10.00"),
    ]);

    expect(rows[0]?.cells).toEqual(cellsOf({ 2: 2000 }));
  });

  // IM4
  it("returns rows for two months of one year and none for a single month", () => {
    expect(
      monthChanges([price("2024-01-02", "1.00"), price("2024-06-03", "2.00")]),
    ).toHaveLength(1);
    expect(
      monthChanges([price("2024-01-02", "1.00"), price("2024-01-03", "2.00")]),
    ).toEqual([]);
    expect(monthChanges([])).toEqual([]);
  });
});
