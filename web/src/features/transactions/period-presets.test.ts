import { describe, expect, it } from "vitest";

import { periodPresets } from "@/features/transactions/period-presets";

describe("periodPresets", () => {
  it("computes each period from today", () => {
    expect(
      periodPresets("2026-03-15").map(({ key, from, to }) => ({
        key,
        from,
        to,
      })),
    ).toEqual([
      { key: "this-month", from: "2026-03-01", to: "2026-03-31" },
      { key: "last-month", from: "2026-02-01", to: "2026-02-28" },
      { key: "last-90-days", from: "2025-12-16", to: "2026-03-15" },
      { key: "this-year", from: "2026-01-01", to: "2026-12-31" },
    ]);
  });

  it("steps back across a year for last month in January", () => {
    const last = periodPresets("2026-01-10").find(
      (p) => p.key === "last-month",
    );
    expect(last).toMatchObject({ from: "2025-12-01", to: "2025-12-31" });
  });
});
