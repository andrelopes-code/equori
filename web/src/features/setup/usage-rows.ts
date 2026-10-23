import type { ModelUse, UsageRow } from "@/features/setup/api";

// The usage rows plus a zero row for each chain target not used yet, so a limit can be
// declared before the first call.
export function mergeUsageRows(
  usage: readonly UsageRow[],
  uses: readonly ModelUse[],
  instance: ReadonlySet<string>,
): UsageRow[] {
  const rows = [...usage];
  const seen = new Set(usage.map((r) => `${r.provider_id}\n${r.model}`));
  for (const use of uses) {
    for (const target of use.targets) {
      const key = `${target.provider_id}\n${target.model}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        provider_id: target.provider_id,
        provider_name: target.provider_name,
        preset: target.preset,
        instance: instance.has(target.provider_id),
        model: target.model,
        today_requests: 0,
        today_errors: 0,
        today_tokens: 0,
        period_requests: 0,
        period_tokens: 0,
        period_days: usage[0]?.period_days ?? 30,
      });
    }
  }
  return rows;
}

export type UsageStatus = "reached" | "near" | "cooling";

// A row's strongest condition: a declared limit reached, then a model cooling down, then
// 80 percent of a limit.
export function usageStatus(row: UsageRow, now: Date): UsageStatus | null {
  const share = Math.max(
    ratio(row.today_requests, row.requests_per_day),
    ratio(row.today_tokens, row.tokens_per_day),
  );
  if (share >= 1) return "reached";
  if (row.cooling_until !== undefined && new Date(row.cooling_until) > now)
    return "cooling";
  return share >= 0.8 ? "near" : null;
}

function ratio(used: number, limit: number | undefined): number {
  return limit === undefined ? 0 : used / limit;
}
