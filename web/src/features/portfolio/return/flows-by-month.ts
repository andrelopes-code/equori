import type { components } from "@/api/schema.gen";

type ReturnFlow = components["schemas"]["ReturnFlow"];

// A month is "YYYY-MM".
export interface MonthFlows {
  month: string;
  deposits: number;
  withdrawals: number;
}

// The flows of the period summed by month, newest month first. A flow in another currency than
// `currency` is skipped.
export function flowsByMonth(
  flows: readonly ReturnFlow[],
  currency: string,
): MonthFlows[] {
  const months = new Map<string, MonthFlows>();

  for (const { date, amount } of flows) {
    if (amount.currency !== currency) continue;

    const month = date.slice(0, 7);
    const row = months.get(month) ?? { month, deposits: 0, withdrawals: 0 };
    if (amount.amount > 0) row.deposits += amount.amount;
    else row.withdrawals -= amount.amount;
    months.set(month, row);
  }

  return [...months.values()].sort((a, b) => b.month.localeCompare(a.month));
}
