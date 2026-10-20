import type { components } from "@/api/schema.gen";

type CategoryTotal = components["schemas"]["CategoryTotal"];

interface Node {
  id: string;
  name: string;
  parent_id?: string | undefined;
}

export function categoryPath(id: string, accounts: readonly Node[]): string {
  const byID = new Map(accounts.map((a) => [a.id, a]));
  const names: string[] = [];
  const seen = new Set<string>();
  for (
    let node = byID.get(id);
    node !== undefined && !seen.has(node.id);
    node = node.parent_id === undefined ? undefined : byID.get(node.parent_id)
  ) {
    seen.add(node.id);
    names.unshift(node.name);
  }
  return names.length === 0 ? id : names.join(" › ");
}

// Sorting by the path places each category right after its parent, siblings by name.
export function categoryRows(
  totals: readonly CategoryTotal[],
  accounts: readonly Node[],
) {
  return totals
    .map((item) => ({
      category: categoryPath(item.account_id, accounts),
      total: item.total,
      subtree_total: item.subtree_total,
    }))
    .sort((a, b) => a.category.localeCompare(b.category));
}

// A root is a category whose parent is not among the listed categories of its class.
export function topCategories(
  totals: readonly CategoryTotal[],
  accounts: readonly Node[],
) {
  const listed = new Set(totals.map((item) => item.account_id));
  const parentOf = new Map(accounts.map((a) => [a.id, a.parent_id]));
  return totals
    .filter((item) => {
      const parent = parentOf.get(item.account_id);
      return parent === undefined || !listed.has(parent);
    })
    .filter((item) => item.subtree_total.amount !== 0)
    .map((item) => ({
      category: categoryPath(item.account_id, accounts),
      amount: item.subtree_total.amount,
      currency: item.subtree_total.currency,
    }))
    .sort((a, b) => b.amount - a.amount);
}
