import { pathSeparator } from "@/features/categories";
import type { CategoryEntry } from "@/features/categories";
import type { PlanDraftRow } from "@/features/planning/plan-math";

export interface PlanLine {
  row: PlanDraftRow;
  entry: CategoryEntry;
  // The path below the top-level category, or the name of a top-level one.
  label: string;
  // The budgeted category above a row that is not counted.
  inside?: string;
}

export interface PlanGroup {
  // The top-level category, or "none" for the rows without a budget.
  id: string;
  name: string;
  lines: PlanLine[];
  // Sums of the counted lines.
  draft: number;
  lastMonth: number;
  average: number;
}

export const withoutBudget = "none";

function rootOf(
  entry: CategoryEntry,
  byId: ReadonlyMap<string, CategoryEntry>,
): CategoryEntry[] {
  const up: CategoryEntry[] = [];
  const seen = new Set([entry.id]);
  let parent =
    entry.parentId === undefined ? undefined : byId.get(entry.parentId);
  while (parent !== undefined && !seen.has(parent.id)) {
    seen.add(parent.id);
    up.push(parent);
    parent =
      parent.parentId === undefined ? undefined : byId.get(parent.parentId);
  }
  return up;
}

// The rows of the plan under their top-level category in the tree's order, then the rows
// without a budget in one group of their own.
export function planGroups(
  entries: readonly CategoryEntry[],
  rows: readonly PlanDraftRow[],
  withoutName: string,
): PlanGroup[] {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const byCategory = new Map(rows.map((r) => [r.category_id, r]));
  const groups = new Map<string, PlanGroup>();
  const loose: PlanGroup = {
    id: withoutBudget,
    name: withoutName,
    lines: [],
    draft: 0,
    lastMonth: 0,
    average: 0,
  };
  for (const entry of entries) {
    const row = byCategory.get(entry.id);
    if (row === undefined) continue;
    const up = rootOf(entry, byId);
    const root = up.at(-1) ?? entry;
    const line: PlanLine = {
      row,
      entry,
      label:
        root === entry
          ? entry.name
          : entry.path.split(pathSeparator).slice(1).join(pathSeparator),
    };
    if (!row.counted) {
      const above = up.find(
        (a) => byCategory.get(a.id)?.budget_id !== undefined,
      );
      if (above !== undefined) line.inside = above.name;
    }
    let group = loose;
    if (row.budget_id !== undefined) {
      group = groups.get(root.id) ?? {
        id: root.id,
        name: root.name,
        lines: [],
        draft: 0,
        lastMonth: 0,
        average: 0,
      };
      groups.set(root.id, group);
    }
    group.lines.push(line);
    if (row.counted) {
      group.draft += row.draft;
      group.lastMonth += row.last_month.amount;
      group.average += row.average.amount;
    }
  }
  return loose.lines.length === 0
    ? [...groups.values()]
    : [...groups.values(), loose];
}
