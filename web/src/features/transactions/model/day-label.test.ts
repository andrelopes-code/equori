import { describe, expect, it } from "vitest";

import { dayLabel } from "@/features/transactions/model/day-label";

const words = { today: "Today", yesterday: "Yesterday" };

describe("dayLabel", () => {
  it("names today and yesterday by word", () => {
    expect(dayLabel("2026-10-17", "2026-10-17", "en", words)).toBe("Today");
    expect(dayLabel("2026-10-16", "2026-10-17", "en", words)).toBe("Yesterday");
  });

  it("names a day of this year by weekday and date", () => {
    expect(dayLabel("2026-10-10", "2026-10-17", "en", words)).toBe(
      "Sat, Oct 10",
    );
  });

  it("names a day of another year by its full date", () => {
    expect(dayLabel("2025-12-30", "2026-10-17", "en", words)).not.toMatch(
      /^Tue, Dec 30$/,
    );
    expect(dayLabel("2025-12-30", "2026-10-17", "en", words)).toMatch(/2025/);
  });
});
