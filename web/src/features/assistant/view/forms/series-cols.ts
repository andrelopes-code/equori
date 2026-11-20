import type { ViewMoney } from "@/features/assistant/view/view-types";

export interface SeriesData {
  months: { month: string; amount: ViewMoney; partial: boolean }[];
  average: ViewMoney;
  focus: string;
}

export interface SeriesCol {
  month: string;
  amount: ViewMoney;
  // Percent of the plot's height.
  height: number;
  partial: boolean;
  focus: boolean;
}

// Columns of a monthly series against the largest month, and the average line's height.
export function seriesCols(data: SeriesData): {
  cols: SeriesCol[];
  average: number;
} {
  const largest = Math.max(0, ...data.months.map((m) => m.amount.amount));
  const pct = (amount: number) =>
    largest > 0 ? (Math.max(amount, 0) / largest) * 100 : 0;

  return {
    cols: data.months.map((m) => ({
      month: m.month,
      amount: m.amount,
      height: pct(m.amount.amount),
      partial: m.partial,
      focus: m.month === data.focus,
    })),
    average: pct(data.average.amount),
  };
}
