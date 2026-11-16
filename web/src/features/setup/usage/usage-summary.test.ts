import { describe, expect, it } from "vitest";

import type { UsageRow } from "@/features/setup/api";
import { usageSummary } from "@/features/setup/usage/usage-summary";

describe("usage summary (A8)", () => {
  it("sums today's requests and counts the resting and the near rows", () => {
    const rows = [
      row({ today_requests: 20, requests_per_day: 20 }),
      row({ today_requests: 42, requests_per_day: 50 }),
      row({ today_requests: 3, cooling_until: "2026-11-16T23:10:00Z" }),
      row({ today_requests: 0 }),
    ];

    expect(usageSummary(rows, new Date("2026-11-16T12:00:00Z"))).toEqual({
      requests: 65,
      resting: 2,
      near: 1,
    });
  });

  it("is zero without rows", () => {
    expect(usageSummary([], new Date("2026-11-16T12:00:00Z"))).toEqual({
      requests: 0,
      resting: 0,
      near: 0,
    });
  });
});

function row(over: Partial<UsageRow>): UsageRow {
  return {
    provider_id: "p",
    provider_name: "P",
    preset: "gemini",
    instance: false,
    model: "m",
    today_requests: 0,
    today_errors: 0,
    today_tokens: 0,
    period_requests: 0,
    period_tokens: 0,
    period_days: 30,
    ...over,
  };
}
