import { describe, expect, it } from "vitest";

import { quoteReading } from "@/features/instruments/quote-reading";

const price = (date: string, value: string) => ({
  instrument: "PETR4",
  quote_instrument: "BRL",
  date,
  value,
  source: "b3_cotahist",
});

const recent = [
  price("2026-11-10", "44.00"),
  price("2026-11-06", "40.00"),
  price("2026-11-09", "42.00"),
];

const shown = [
  price("2026-10-01", "50.00"),
  price("2026-10-02", "55.00"),
  price("2026-10-03", "45.00"),
];

describe("quoteReading", () => {
  it("reads the latest price against the previous quote", () => {
    const reading = quoteReading(recent, shown, null);

    expect(reading?.price.date).toBe("2026-11-10");
    expect(reading?.reference?.date).toBe("2026-11-09");
    expect(reading?.basis).toBe("previous");
    expect(reading?.changeBp).toBe(476);
  });

  it("reads an active point against the start of the shown range", () => {
    const reading = quoteReading(recent, shown, "2026-10-03");

    expect(reading?.price.value).toBe("45.00");
    expect(reading?.reference?.date).toBe("2026-10-01");
    expect(reading?.basis).toBe("start");
    expect(reading?.changeBp).toBe(-1000);
  });

  it("reads the first point of the range without a change", () => {
    const reading = quoteReading(recent, shown, "2026-10-01");

    expect(reading?.reference).toBeNull();
    expect(reading?.changeBp).toBeNull();
  });

  it("falls back to the latest price for a date the range lacks", () => {
    expect(quoteReading(recent, shown, "2026-09-01")?.price.date).toBe(
      "2026-11-10",
    );
  });

  it("has no change from a single quote", () => {
    const reading = quoteReading([price("2026-11-10", "44.00")], [], null);

    expect(reading?.reference).toBeNull();
    expect(reading?.changeBp).toBeNull();
  });

  it("is empty without a quote", () => {
    expect(quoteReading([], [], null)).toBeNull();
  });
});
