import { describe, expect, it } from "vitest";

import { defaultMonth } from "@/features/reports/pages/indicator-month";

describe("defaultMonth", () => {
  it.each([
    { today: "2026-11-09", want: "2026-10" },
    { today: "2026-10-17", want: "2026-09" },
    { today: "2026-01-15", want: "2025-12" },
  ])("$today opens on $want", ({ today, want }) => {
    expect(defaultMonth(today)).toBe(want);
  });
});
