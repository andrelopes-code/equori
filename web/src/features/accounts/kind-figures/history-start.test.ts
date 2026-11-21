import { describe, expect, it } from "vitest";

import { historyStart } from "@/features/accounts/kind-figures/history-start";

describe("historyStart", () => {
  it("keeps an opening date inside the window (K8)", () => {
    expect(historyStart("2025-08-15", "2026-11-21")).toBe("2025-08-15");
  });

  it("holds an older opening date to 3660 days, today included", () => {
    // 2026-11-21 minus 3659 days: ten years are 3652 days (29 Feb 2020 and 2024), then 7 more.
    expect(historyStart("2000-01-01", "2026-11-21")).toBe("2016-11-14");
  });

  it("starts at the window's first day without an opening date", () => {
    expect(historyStart(undefined, "2026-11-21")).toBe("2016-11-14");
  });
});
