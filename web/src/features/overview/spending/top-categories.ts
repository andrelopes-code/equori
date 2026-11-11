import type { components } from "@/api/schema.gen";

type CategoryTotal = components["schemas"]["CategoryTotal"];

export interface TopCategory {
  id: string;
  name: string;
  amount: number;
}

const shown = 5;

// Own totals, so a parent and its children never count the same posting twice.
export function topCategories(
  items: readonly CategoryTotal[],
  names: ReadonlyMap<string, string>,
): TopCategory[] {
  return items
    .flatMap((item) => {
      const name = names.get(item.account_id);
      return name === undefined || item.total.amount <= 0
        ? []
        : [{ id: item.account_id, name, amount: item.total.amount }];
    })
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))
    .slice(0, shown);
}
