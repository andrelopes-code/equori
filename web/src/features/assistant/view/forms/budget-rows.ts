import type { ViewMoney } from "@/features/assistant/view/view-types";

export interface BudgetData {
  month: string;
  // The day the pace mark stands on; 0 before the month starts.
  day: number;
  days: number;
  items: {
    budget_id: string;
    name: string;
    spent: ViewMoney;
    limit: ViewMoney;
    over: ViewMoney;
  }[];
}

export interface BudgetRow {
  key: string;
  name: string;
  spent: ViewMoney;
  limit: ViewMoney;
  over: ViewMoney;
  // Percent of the track: spent up to the limit, the excess after it, the limit and the pace.
  fill: number;
  overWidth: number;
  tick: number;
  pace?: number;
}

// Budget rows on one scale: the largest of any row's spent and limit fills the track.
export function budgetRows(data: BudgetData): BudgetRow[] {
  const scale = Math.max(
    0,
    ...data.items.flatMap((i) => [i.spent.amount, i.limit.amount]),
  );
  const pct = (amount: number) =>
    scale > 0 ? (Math.max(amount, 0) / scale) * 100 : 0;

  return data.items.map((i) => {
    const tick = pct(i.limit.amount);
    const row: BudgetRow = {
      key: i.budget_id,
      name: i.name,
      spent: i.spent,
      limit: i.limit,
      over: i.over,
      fill: pct(Math.min(i.spent.amount, i.limit.amount)),
      overWidth: pct(i.over.amount),
      tick,
    };

    if (data.day > 0) row.pace = tick * (data.day / data.days);

    return row;
  });
}
