import { describe, expect, it } from "vitest";

import {
  maxPriceDays,
  priceWindow,
  rangeWindow,
} from "@/features/instruments/model/price-window";

describe("priceWindow", () => {
  it("ends today and spans the days asked", () => {
    expect(priceWindow("2026-10-24", 30)).toEqual({
      from: "2026-09-25",
      to: "2026-10-24",
    });
  });

  // MQ30
  it("never spans more than 18,300 days", () => {
    const { from, to } = priceWindow("2026-10-24", 50_000);
    const days = (Date.parse(to) - Date.parse(from)) / 86_400_000 + 1;
    expect(maxPriceDays).toBe(18_300);
    expect(days).toBe(18_300);
  });
});

describe("rangeWindow", () => {
  it("spans five years", () => {
    expect(rangeWindow("2026-10-17", "y5", null)).toEqual({
      from: "2021-10-17",
      to: "2026-10-17",
    });
  });

  it("starts at the first quote when it is inside the limit", () => {
    expect(rangeWindow("2026-10-17", "max", "2010-01-04")).toEqual({
      from: "2010-01-04",
      to: "2026-10-17",
    });
  });

  it("starts at the limit when the first quote is older", () => {
    expect(rangeWindow("2026-10-17", "max", "1900-01-02")).toEqual({
      from: "1976-09-10",
      to: "2026-10-17",
    });
  });
});
