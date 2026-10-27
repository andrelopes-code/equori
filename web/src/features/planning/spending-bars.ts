import { rankedShares } from "@/ui/ranked-shares";

// The month's spending per slice as ranked bars, the share in each label.
export function spendingBars(
  slices: readonly { name: string; spent: number }[],
  locale: string,
): { label: string; spent: number }[] {
  return rankedShares(
    slices.map((s) => ({ name: s.name, amount: s.spent })),
    locale,
  ).map((r) => ({ label: r.label, spent: r.amount }));
}
