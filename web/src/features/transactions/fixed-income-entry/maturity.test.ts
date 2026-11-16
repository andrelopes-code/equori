import { describe, expect, it } from "vitest";

import { monthsAfter } from "@/features/transactions/fixed-income-entry/maturity";

describe("monthsAfter", () => {
  it.each([
    ["2026-06-15", 6, "2026-12-15"],
    ["2026-06-15", 12, "2027-06-15"],
    ["2026-08-31", 6, "2027-02-28"],
    ["2027-08-31", 6, "2028-02-29"],
    ["2026-11-30", 60, "2031-11-30"],
  ])("%s plus %i months is %s", (date, months, want) => {
    expect(monthsAfter(date, months)).toBe(want);
  });
});
