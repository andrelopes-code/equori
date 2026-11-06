import type { components } from "@/api/schema.gen";
import type { CategoryEntry } from "@/features/categories/category-paths";
import { rankedShares } from "@/ui/ranked-shares";

type CategoryTotal = components["schemas"]["CategoryTotal"];

export interface CompositionRow {
  id: string;
  label: string;
  amount: number;
}

// The groups of one month as ranked bars, the share in each label.
export function compositionRows(
  series: readonly { field: string; label: string }[],
  record: Readonly<Record<string, string | number>>,
  locale: string,
): CompositionRow[] {
  return ranked(
    series.map((s) => ({
      id: s.field,
      name: s.label,
      amount: Number(record[s.field] ?? 0),
    })),
    locale,
  );
}

// One group split into its direct children, plus a bar of its own for what is booked on the
// group itself. The bar of the group keeps the group's id.
export function childRows(
  entries: readonly CategoryEntry[],
  items: readonly CategoryTotal[] | undefined,
  parentId: string,
  ownName: string,
  locale: string,
): CompositionRow[] {
  const byId = new Map((items ?? []).map((item) => [item.account_id, item]));
  const children = entries
    .filter((e) => e.parentId === parentId)
    .map((e) => ({
      id: e.id,
      name: e.name,
      amount: byId.get(e.id)?.subtree_total.amount ?? 0,
    }));
  const own = {
    id: parentId,
    name: ownName,
    amount: byId.get(parentId)?.total.amount ?? 0,
  };

  return ranked([...children, own], locale);
}

function ranked(
  items: readonly { id: string; name: string; amount: number }[],
  locale: string,
): CompositionRow[] {
  return rankedShares(items, locale).map((row) => ({
    id: row.id ?? "",
    label: row.label,
    amount: row.amount,
  }));
}
