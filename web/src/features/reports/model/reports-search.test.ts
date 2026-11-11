import { describe, expect, it } from "vitest";

import { validateReportsSearch } from "@/features/reports/model/reports-search";

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
