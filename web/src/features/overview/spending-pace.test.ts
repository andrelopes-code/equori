import { describe, expect, it } from "vitest";

import {
  paceChange,
  paceRanges,
  spendingOf,
} from "@/features/overview/spending-pace";

const item = (amount: number, currency = "BRL") => ({
  account_id: "a",
  total: { amount, currency },
  subtree_total: { amount, currency },
});

describe("paceRanges", () => {
  it.each([
    ["2026-10-17", "2026-10-01", "2026-09-01", "2026-09-17"],
    ["2026-10-31", "2026-10-01", "2026-09-01", "2026-09-30"],
    ["2026-03-31", "2026-03-01", "2026-02-01", "2026-02-28"],
    ["2028-03-31", "2028-03-01", "2028-02-01", "2028-02-29"],
    ["2026-01-15", "2026-01-01", "2025-12-01", "2025-12-15"],
  ])(
    "on %s reads from %s and the previous range %s to %s",
    (today, from, previousFrom, previousTo) => {
      const ranges = paceRanges(today);

      expect(ranges).toEqual({
        current: { from, to: today },
        previous: { from: previousFrom, to: previousTo },
      });
    },
  );
});

describe("spendingOf", () => {
  it("sums the base currency totals, a refund included", () => {
    const total = spendingOf(
      [item(50000), item(100000), item(-10000), item(5000, "USD")],
      "BRL",
    );

    expect(total).toBe(140000);
  });
});

describe("paceChange", () => {
  it.each([
    [150000, 140000, 10000 / 140000],
    [100000, 80000, 0.25],
    [50000, 0, undefined],
    [50000, -1000, undefined],
  ])("from %i against %i is %s", (current, previous, change) => {
    expect(paceChange(current, previous)).toBe(change);
  });
});
