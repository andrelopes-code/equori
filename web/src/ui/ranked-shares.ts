import { formatBasisPoints } from "@/i18n/format";

// The positive amounts, largest first and then by name, each labelled with its share of the
// total in basis points truncated toward zero (analytics design 7).
export function rankedShares(
  items: readonly { name: string; amount: number }[],
  locale: string,
): { label: string; amount: number }[] {
  const shown = items
    .filter((i) => i.amount > 0)
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
  const total = shown.reduce((sum, i) => sum + i.amount, 0);
  return shown.map((i) => ({
    label: `${i.name} · ${formatBasisPoints(Math.trunc((i.amount * 10000) / total), locale)}`,
    amount: i.amount,
  }));
}
