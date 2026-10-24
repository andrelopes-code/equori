import type { components } from "@/api/schema.gen";
import type { CategoryClass, CategoryEntry } from "@/features/categories";
import { changeBP } from "@/features/reports/report-change";

type CategoryTotal = components["schemas"]["CategoryTotal"];

export interface CategoryRow {
  id: string;
  name: string;
  // Minor units, positive as the class reads: the subtree of the category, and what it holds itself.
  subtree: number;
  own: number;
  hasChildren: boolean;
  // The subtree in the previous period; present when a comparison is asked.
  previous?: number;
  change?: number;
  changeBP?: number;
}

export interface CategoryLevel {
  rows: CategoryRow[];
  // What the open category holds itself, as a row of its own; absent at the top level.
  direct?: CategoryRow;
  total: number;
  previousTotal?: number;
  change?: number;
  changeBP?: number;
}

function compared(
  row: CategoryRow,
  before: ReadonlyMap<string, CategoryTotal> | undefined,
  pick: (item: CategoryTotal | undefined) => number,
): CategoryRow {
  if (before === undefined) return row;
  const previous = pick(before.get(row.id));
  const change = row.subtree - previous;
  const bp = changeBP(change, previous);
  return {
    ...row,
    previous,
    change,
    ...(bp === undefined ? {} : { changeBP: bp }),
  };
}

// The categories of a class one level down from `parent` (the top level when absent), by
// subtree total. With `previous`, each row also carries the same category in the period before,
// and a category that only that period holds stays.
export function categoryRows(
  entries: readonly CategoryEntry[],
  items: readonly CategoryTotal[] | undefined,
  previous: readonly CategoryTotal[] | undefined,
  cls: CategoryClass,
  parent: string | undefined,
): CategoryLevel {
  const now = new Map((items ?? []).map((i) => [i.account_id, i]));
  const before =
    previous === undefined
      ? undefined
      : new Map(previous.map((i) => [i.account_id, i]));
  const own = entries.filter((e) => e.class === cls);
  const known = new Set(own.map((e) => e.id));
  const hasParent = new Set(own.map((e) => e.parentId));
  const level =
    parent === undefined
      ? own.filter((e) => e.parentId === undefined || !known.has(e.parentId))
      : own.filter((e) => e.parentId === parent);
  const rows = level
    .map((entry) =>
      compared(
        {
          id: entry.id,
          name: entry.name,
          subtree: now.get(entry.id)?.subtree_total.amount ?? 0,
          own: now.get(entry.id)?.total.amount ?? 0,
          hasChildren: hasParent.has(entry.id),
        },
        before,
        (item) => item?.subtree_total.amount ?? 0,
      ),
    )
    .filter((r) => r.subtree !== 0 || (r.previous ?? 0) !== 0)
    .sort((a, b) => b.subtree - a.subtree || a.name.localeCompare(b.name));
  const parentEntry = own.find((e) => e.id === parent);
  const heldNow =
    parent === undefined ? 0 : (now.get(parent)?.total.amount ?? 0);
  const heldBefore =
    parent === undefined ? 0 : (before?.get(parent)?.total.amount ?? 0);
  const direct =
    parentEntry === undefined || (heldNow === 0 && heldBefore === 0)
      ? undefined
      : compared(
          {
            id: parentEntry.id,
            name: parentEntry.name,
            subtree: heldNow,
            own: heldNow,
            hasChildren: false,
          },
          before,
          (item) => item?.total.amount ?? 0,
        );
  const all = direct === undefined ? rows : [...rows, direct];
  const total = all.reduce((sum, r) => sum + r.subtree, 0);
  if (before === undefined)
    return { rows, ...(direct ? { direct } : {}), total };
  const previousTotal = all.reduce((sum, r) => sum + (r.previous ?? 0), 0);
  const bp = changeBP(total - previousTotal, previousTotal);
  return {
    rows,
    ...(direct ? { direct } : {}),
    total,
    previousTotal,
    change: total - previousTotal,
    ...(bp === undefined ? {} : { changeBP: bp }),
  };
}
