import { describe, expect, it } from "vitest";

import { priceYears } from "@/features/instruments/price-table/price-years";

describe("priceYears", () => {
  it("lists the calendar years from the last quote to the first", () => {
    expect(priceYears("2024-03-14", "2026-10-16")).toEqual([2026, 2025, 2024]);
  });

  it("lists the one year of a series inside it", () => {
    expect(priceYears("2026-01-02", "2026-10-16")).toEqual([2026]);
  });
});
