import type { ViewMoney } from "@/features/assistant/view/view-types";

export interface ChangesData {
  periods: [{ from: string; to: string }, { from: string; to: string }];
  items: { account_id: string; name: string; delta: ViewMoney }[];
  difference: ViewMoney;
}

export interface ChangesRow {
  key: string;
  name: string;
  delta: ViewMoney;
  // Percent of one half of the axis, against the largest move either way.
  width: number;
  rise: boolean;
}

// Diverging bars: a rise to the right of the axis, a fall to its left, both on one scale.
export function changesRows(data: ChangesData): ChangesRow[] {
  const largest = Math.max(
    0,
    ...data.items.map((i) => Math.abs(i.delta.amount)),
  );

  return data.items.map((i) => ({
    key: i.account_id,
    name: i.name,
    delta: i.delta,
    width: largest > 0 ? (Math.abs(i.delta.amount) / largest) * 100 : 0,
    rise: i.delta.amount > 0,
  }));
}
