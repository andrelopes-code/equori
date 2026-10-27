import { rankedShares } from "@/ui/ranked-shares";

// The groups of one month as ranked bars, the share in each label.
export function compositionRows(
  series: readonly { field: string; label: string }[],
  record: Readonly<Record<string, string | number>>,
  locale: string,
): { label: string; amount: number }[] {
  return rankedShares(
    series.map((s) => ({
      name: s.label,
      amount: Number(record[s.field] ?? 0),
    })),
    locale,
  );
}
