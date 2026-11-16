import type { UsageRow } from "@/features/setup/api";
import { usageStatus } from "@/features/setup/usage/usage-rows";

export interface UsageSummary {
  requests: number;
  resting: number;
  near: number;
}

// What the closed usage card states: today's requests, the rows over a limit or cooling down,
// and the rows near a limit (spec A8).
export function usageSummary(
  rows: readonly UsageRow[],
  now: Date,
): UsageSummary {
  const summary = { requests: 0, resting: 0, near: 0 };

  for (const row of rows) {
    const status = usageStatus(row, now);

    summary.requests += row.today_requests;
    if (status === "near") summary.near += 1;
    else if (status !== null) summary.resting += 1;
  }

  return summary;
}
