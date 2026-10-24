import { describe, expect, it } from "vitest";

import { maxPriceDays, priceWindow } from "@/features/instruments/price-window";

describe("priceWindow", () => {
  it("ends today and spans the days asked", () => {
    expect(priceWindow("2026-10-24", 30)).toEqual({
      from: "2026-09-25",
      to: "2026-10-24",
    });
  });

  it("never spans more than 366 days", () => {
    const { from, to } = priceWindow("2026-10-24", 5000);
    const days = (Date.parse(to) - Date.parse(from)) / 86_400_000 + 1;
    expect(maxPriceDays).toBe(366);
    expect(days).toBeLessThanOrEqual(366);
    expect(days).toBe(366);
  });
});
