import type { Indicators } from "@/features/overview";

export interface IndicatorRow {
  label: string;
  savings: number | null;
  trailing: number | null;
  liquidity: number | null;
  committed: number | null;
  debt: number | null;
  liabilities: number;
}

// One chart row per month; a ratio with a reason is a gap.
export function indicatorRows(
  report: Indicators,
  label: (month: string) => string,
): IndicatorRow[] {
  return report.months.map((m) => ({
    label: label(m.month),
    savings: m.savings_rate.bp ?? null,
    trailing: m.trailing_savings_rate.bp ?? null,
    liquidity: m.liquidity.bp ?? null,
    committed: m.committed_share.bp ?? null,
    debt: m.debt_service_share.bp ?? null,
    liabilities: m.liabilities.amount,
  }));
}
