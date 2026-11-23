import type { components } from "@/api/schema.gen";
import type { MessageKey } from "@/i18n/catalog.en";

type History = components["schemas"]["BudgetBucketHistory"];

export type StripKey =
  "spent" | "setAside" | "goalDeposits" | "outside" | "unallocated";

export interface StripPart {
  key: StripKey;
  amount: number;
  // The share of the bar the part takes, in basis points of the positive parts; zero for a
  // part at or below zero, which the bar cannot draw and the legend still writes.
  shareBp: number;
}

// The income received in a month split into where it went (planning coherence section 6):
// spent in the buckets, set aside, deposited into goals, spent outside the split and left
// unallocated. The parts sum to the income received (A235). A part that no bucket of the month
// takes is left out; so is one at zero, except the unallocated income.
export function trackStrip(history: History, month: string): StripPart[] {
  const entry = history.months.find((m) => m.month === month);
  const method = history.methods.find((v) => v.from === entry?.from);
  if (entry === undefined || method === undefined) return [];

  const sums = { spent: 0, setAside: 0, goalDeposits: 0 };
  for (const bucket of method.buckets) {
    const real =
      entry.buckets.find((b) => b.id === bucket.id)?.real.amount ?? 0;
    if (bucket.takes_savings) sums.setAside += real;
    else if (bucket.takes_goals) sums.goalDeposits += real;
    else sums.spent += real;
  }

  const amounts: [StripKey, number][] = [
    ["spent", sums.spent],
    ["setAside", sums.setAside],
    ["goalDeposits", sums.goalDeposits],
    ["outside", entry.outside.amount],
    ["unallocated", entry.unallocated.amount],
  ];
  const kept = amounts.filter(
    ([key, amount]) => amount !== 0 || key === "unallocated",
  );
  const positive = kept.reduce((sum, [, a]) => sum + Math.max(a, 0), 0);

  return kept.map(([key, amount]) => ({
    key,
    amount,
    shareBp:
      positive > 0 ? Math.round((Math.max(amount, 0) * 10000) / positive) : 0,
  }));
}

// The sentence that explains a term of the legend: the unallocated income is an accrual figure
// (A235), the retained yields stand outside the income received (A252). Undefined for a term
// that needs none and for an unallocated income of zero.
export function stripHelp(
  key: StripKey | "retained",
  amount: number,
): MessageKey | undefined {
  if (key === "retained") return "track.retained";
  if (key !== "unallocated" || amount === 0) return undefined;

  return amount > 0 ? "track.unallocated" : "track.unallocatedNegative";
}
