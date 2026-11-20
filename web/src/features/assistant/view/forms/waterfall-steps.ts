import type { ViewMoney } from "@/features/assistant/view/view-types";

export interface WaterfallData {
  month: string;
  steps: {
    kind: "start" | "income" | "expense" | "other" | "end";
    amount: ViewMoney;
  }[];
}

export interface WaterfallBar {
  kind: WaterfallData["steps"][number]["kind"];
  amount: ViewMoney;
  // Percent of the plot's height from its bottom, and the bar's height.
  from: number;
  height: number;
  // A total stands on the base line; a flow floats between two levels.
  total: boolean;
}

// The walk of a month as floating columns: totals from the base, each flow from the level before.
export function waterfallBars(data: WaterfallData): WaterfallBar[] {
  let level = 0;
  const spans = data.steps.map((s) => {
    const total = s.kind === "start" || s.kind === "end";
    const low = total ? 0 : Math.min(level, level + s.amount.amount);
    const high = total
      ? s.amount.amount
      : Math.max(level, level + s.amount.amount);
    level = total ? s.amount.amount : level + s.amount.amount;
    return { s, low, high, total };
  });

  const top = Math.max(0, ...spans.map((x) => x.high));
  const bottom = Math.min(0, ...spans.map((x) => x.low));
  const range = top - bottom || 1;

  return spans.map(({ s, low, high, total }) => ({
    kind: s.kind,
    amount: s.amount,
    from: ((low - bottom) / range) * 100,
    height: ((high - low) / range) * 100,
    total,
  }));
}
