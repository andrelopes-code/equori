import type { components } from "@/api/schema.gen";
import { pathSeparator } from "@/features/categories";
import type { CategoryEntry } from "@/features/categories";

type Budget = components["schemas"]["Budget"];
type Progress = components["schemas"]["BudgetProgress"];
type Money = components["schemas"]["Money"];
type CategoryTotal = components["schemas"]["CategoryTotal"];

export interface BudgetRow {
  budget: Budget;
  entry: CategoryEntry;
  // The path below the top-level category, or the category's name when it is the top one.
  label: string;
  progress: Progress;
}

type Figure = "planned" | "carried" | "spent" | "available";

export interface BudgetGroup {
  root: CategoryEntry;
  rows: BudgetRow[];
  // Present when the group holds more than one budget.
  subtotal?: Pick<Progress, Figure>;
}

// A budget answers for its month only from its first amount on; progress before it is a 422.
export function startsBy(budget: Budget, month: string): boolean {
  const first = budget.amounts[0];
  return first !== undefined && first.effective_from <= month;
}

function ancestors(
  entry: CategoryEntry,
  byId: ReadonlyMap<string, CategoryEntry>,
): CategoryEntry[] {
  const out: CategoryEntry[] = [];
  const seen = new Set([entry.id]);
  let parent =
    entry.parentId === undefined ? undefined : byId.get(entry.parentId);
  while (parent !== undefined && !seen.has(parent.id)) {
    seen.add(parent.id);
    out.push(parent);
    parent =
      parent.parentId === undefined ? undefined : byId.get(parent.parentId);
  }
  return out;
}

function sum(rows: readonly BudgetRow[], key: Figure): Money {
  const first = rows[0]?.progress[key];
  return {
    // Budgets are kept in the base currency, so their amounts add up.
    currency: first?.currency ?? "",
    amount: rows.reduce((total, r) => total + r.progress[key].amount, 0),
  };
}

// The budgets of a month by top-level category, in the tree's order. A subtotal counts only the
// budgets with no budgeted ancestor in the group: a parent's spending already holds its children's.
export function budgetGroups(
  entries: readonly CategoryEntry[],
  budgets: readonly Budget[],
  progress: ReadonlyMap<string, Progress>,
): BudgetGroup[] {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const byCategory = new Map(budgets.map((b) => [b.category_id, b]));
  const groups = new Map<string, BudgetGroup>();
  const tops = new Map<string, BudgetRow[]>();
  for (const entry of entries) {
    const budget = byCategory.get(entry.id);
    const p = budget === undefined ? undefined : progress.get(budget.id);
    if (budget === undefined || p === undefined) continue;
    const up = ancestors(entry, byId);
    const root = up[up.length - 1] ?? entry;
    const row: BudgetRow = {
      budget,
      entry,
      label:
        root === entry
          ? entry.name
          : entry.path.split(pathSeparator).slice(1).join(pathSeparator),
      progress: p,
    };
    const group = groups.get(root.id) ?? { root, rows: [] };
    group.rows.push(row);
    groups.set(root.id, group);
    const shown = (a: CategoryEntry) => {
      const b = byCategory.get(a.id);
      return b !== undefined && progress.has(b.id);
    };
    if (!up.some(shown)) tops.set(root.id, [...(tops.get(root.id) ?? []), row]);
  }
  return [...groups.values()].map((group) => {
    const top = tops.get(group.root.id) ?? [];
    return group.rows.length < 2
      ? group
      : {
          ...group,
          subtotal: {
            planned: sum(top, "planned"),
            carried: sum(top, "carried"),
            spent: sum(top, "spent"),
            available: sum(top, "available"),
          },
        };
  });
}

// The expense categories that booked an amount of their own in the month with no budget on them
// or on a category above them, in the tree's order.
export function unbudgeted(
  entries: readonly CategoryEntry[],
  budgets: readonly Budget[],
  totals: readonly CategoryTotal[],
): { entry: CategoryEntry; total: Money }[] {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const budgeted = new Set(budgets.map((b) => b.category_id));
  const own = new Map(totals.map((t) => [t.account_id, t.total]));
  return entries.flatMap((entry) => {
    const total = own.get(entry.id);
    if (entry.class !== "expense" || total === undefined || total.amount === 0)
      return [];
    if (
      budgeted.has(entry.id) ||
      ancestors(entry, byId).some((a) => budgeted.has(a.id))
    )
      return [];
    return [{ entry, total }];
  });
}
