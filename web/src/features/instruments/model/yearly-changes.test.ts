import { describe, expect, it } from "vitest";

import { yearlyChanges } from "@/features/instruments/model/yearly-changes";

const price = (date: string, value: string) => ({
  instrument: "PETR4",
  quote_instrument: "BRL",
  date,
  value,
  source: "b3_cotahist",
});

describe("yearlyChanges", () => {
  it("measures each year from the last price of the year before", () => {
    const rows = yearlyChanges(
      [
        price("2024-03-14", "10.00"),
        price("2024-12-31", "12.00"),
        price("2025-06-02", "15.00"),
        price("2025-12-31", "18.00"),
        price("2026-11-12", "27.00"),
      ],
      "2026-11-12",
    );

    expect(rows.map((r) => r.year)).toEqual([2026, 2025, 2024]);
    expect(rows[0]).toMatchObject({
      start: { date: "2025-12-31", value: "18.00" },
      end: { date: "2026-11-12", value: "27.00" },
      changeBp: 5000,
      partialFrom: false,
      partialTo: true,
    });
    expect(rows[1]).toMatchObject({
      start: { date: "2024-12-31", value: "12.00" },
      end: { date: "2025-12-31", value: "18.00" },
      changeBp: 5000,
      partialFrom: false,
      partialTo: false,
    });
    expect(rows[2]).toMatchObject({
      start: { date: "2024-03-14", value: "10.00" },
      end: { date: "2024-12-31", value: "12.00" },
      changeBp: 2000,
      partialFrom: true,
      partialTo: false,
    });
  });

  it("skips a year without a price and keeps the older base", () => {
    const rows = yearlyChanges(
      [
        price("2022-05-10", "10.00"),
        price("2024-02-01", "20.00"),
        price("2024-11-01", "30.00"),
      ],
      "2024-11-12",
    );

    expect(rows.map((r) => r.year)).toEqual([2024, 2022]);
    expect(rows[0]?.start).toMatchObject({
      date: "2022-05-10",
      value: "10.00",
    });
    expect(rows[0]?.changeBp).toBe(20000);
  });

  it("gives no change to a first year with one price", () => {
    const rows = yearlyChanges(
      [price("2023-12-29", "5.00"), price("2024-06-03", "6.00")],
      "2024-06-03",
    );

    expect(rows[0]).toMatchObject({ year: 2024, changeBp: 2000 });
    expect(rows[1]).toMatchObject({ year: 2023, changeBp: null });
    expect(rows[1]?.start).toEqual(rows[1]?.end);
  });

  it("gives no change to a start price of zero", () => {
    const rows = yearlyChanges(
      [
        price("2023-12-29", "0"),
        price("2024-06-03", "6.00"),
        price("2025-02-03", "7.00"),
      ],
      "2025-02-03",
    );

    expect(rows[1]).toMatchObject({ year: 2024, changeBp: null });
  });

  it("returns no row for one year or for an empty series", () => {
    expect(
      yearlyChanges(
        [price("2024-01-02", "1.00"), price("2024-06-03", "2.00")],
        "2024-06-03",
      ),
    ).toEqual([]);
    expect(yearlyChanges([], "2024-06-03")).toEqual([]);
  });
});
