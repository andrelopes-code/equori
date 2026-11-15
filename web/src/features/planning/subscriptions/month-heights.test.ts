import { describe, expect, it } from "vitest";

import { monthHeights } from "@/features/planning/subscriptions/month-heights";
import type { MonthCell } from "@/features/planning/subscriptions/subscription-figures";

const brl = (amount: number) => ({ amount, currency: "BRL" });

describe("monthHeights", () => {
  it("draws each charged or expected month against the largest of the 12", () => {
    const cells: MonthCell[] = [
      { month: "2026-01", state: "none" },
      { month: "2026-02", state: "paid", charged: brl(11990) },
      {
        month: "2026-03",
        state: "other",
        charged: brl(12990),
        expected: brl(11990),
      },
      { month: "2026-04", state: "skipped" },
      { month: "2026-05", state: "expected", expected: brl(6495) },
    ];

    expect(monthHeights(cells)).toEqual([0, 92, 100, 0, 50]);
  });

  it("draws nothing when no month holds an amount", () => {
    expect(monthHeights([{ month: "2026-01", state: "none" }])).toEqual([0]);
  });
});
