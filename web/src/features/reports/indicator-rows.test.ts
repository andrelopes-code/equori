import { describe, expect, it } from "vitest";

import { indicatorRows } from "@/features/reports/indicator-rows";
import { validateReportsSearch } from "@/features/reports/reports-search";
import { indicatorsFixture } from "@/testing/report-api";

describe("indicatorRows", () => {
  it("gives one row per month, null where a ratio has a reason", () => {
    const rows = indicatorRows(indicatorsFixture(), (m) => m);
    expect(rows).toHaveLength(12);
    expect(rows[11]).toEqual({
      label: "2026-10",
      savings: 4300,
      trailing: 4650,
      liquidity: 66915,
      committed: 100,
      debt: 2500,
      liabilities: 640000,
    });
    expect(rows[0]?.savings).toBeNull();
  });
});

describe("validateReportsSearch", () => {
  it("reads the indicators tab and its month", () => {
    const search = validateReportsSearch({
      tab: "indicators",
      month: "2026-09",
    });
    expect(search.tab).toBe("indicators");
    expect(search.month).toBe("2026-09");
    expect(
      validateReportsSearch({ tab: "indicators", month: "2026-13" }).month,
    ).toBeUndefined();
  });
});
