import { describe, expect, it } from "vitest";

import {
  changeBp,
  priceAmount,
  priceDigits,
  priceStats,
} from "@/features/instruments/model/price-stats";

const price = (date: string, value: string, source = "b3_cotahist") => ({
  instrument: "PETR4",
  quote_instrument: "BRL",
  date,
  value,
  source,
});

describe("changeBp", () => {
  it.each([
    ["10.00", "11.00", 1000],
    ["100", "99.5", -50],
    ["3", "2", -3333],
    ["2", "3", 5000],
    ["200", "200.25", 13],
    ["200", "199.75", -13],
    ["12000.00", "15998.473131166787", 3332],
    ["5", "5", 0],
  ])("from %s to %s is %i basis points", (from, to, bp) => {
    expect(changeBp(from, to)).toBe(bp);
  });

  it("has no change from a zero price", () => {
    expect(changeBp("0", "5")).toBeNull();
    expect(changeBp("0.000", "5")).toBeNull();
  });
});

describe("priceStats", () => {
  it("is empty without a price", () => {
    expect(priceStats([])).toBeNull();
  });

  it("reads first, last, high and low of prices in any order", () => {
    const stats = priceStats([
      price("2026-10-03", "9.00"),
      price("2026-10-01", "10.00"),
      price("2026-10-04", "11.00"),
      price("2026-10-02", "12.50"),
    ]);

    expect(stats?.first.date).toBe("2026-10-01");
    expect(stats?.last.date).toBe("2026-10-04");
    expect(stats?.changeBp).toBe(1000);
    expect(stats?.high).toMatchObject({ date: "2026-10-02", value: "12.50" });
    expect(stats?.low).toMatchObject({ date: "2026-10-03", value: "9.00" });
    expect(stats?.count).toBe(4);
  });

  it("keeps the earliest date of a tied high and low", () => {
    const stats = priceStats([
      price("2026-10-01", "5"),
      price("2026-10-02", "7"),
      price("2026-10-03", "7"),
      price("2026-10-04", "5"),
    ]);

    expect(stats?.high.date).toBe("2026-10-02");
    expect(stats?.low.date).toBe("2026-10-01");
  });

  it("has no change from one price", () => {
    expect(priceStats([price("2026-10-01", "5")])?.changeBp).toBeNull();
  });
});

describe("priceDigits", () => {
  it.each([
    ["44.95", 2],
    ["5.5840", 4],
    ["808181.5859", 2],
    ["12000", 2],
    ["15998.473131166787", 2],
    ["1.5", 2],
    ["2.123456789", 4],
    ["0.5", 2],
    ["0.00001234", 8],
    ["0.123456789012", 8],
  ])("writes %s with %i decimals", (value, digits) => {
    expect(priceDigits(value)).toBe(digits);
  });
});

describe("priceAmount", () => {
  it.each([
    ["44.95", 2, 4495],
    ["5.58399", 4, 55840],
    ["808181.5859", 2, 80818159],
    ["0.000012345", 8, 1235],
    ["12000", 2, 1200000],
  ])("holds %s at %i decimals as %i", (value, digits, amount) => {
    expect(priceAmount(value, digits)).toBe(amount);
  });
});
