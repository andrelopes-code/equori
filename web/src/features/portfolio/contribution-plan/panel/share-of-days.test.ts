import { describe, expect, it } from "vitest";

import { shareOfDays } from "@/features/portfolio/contribution-plan/panel/share-of-days";

const counts = Array.from({ length: 101 }, (_, value) =>
  value === 10 || value === 25 || value === 26 ? 1 : 0,
);
const index = { id: "crypto_fear_greed", enabled: true, days: 3, counts };

describe("shareOfDays", () => {
  it("counts the days at the limit and below it", () => {
    expect(shareOfDays(index, 9)).toBe(0);
    expect(shareOfDays(index, 25)).toBeCloseTo(2 / 3);
    expect(shareOfDays(index, 100)).toBe(1);
  });

  it("has none without a stored day", () => {
    expect(shareOfDays({ ...index, days: 0 }, 25)).toBeUndefined();
  });
});
