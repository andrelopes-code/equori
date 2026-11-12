import type { TreeRow } from "@/features/categories/category-tree/category-tree";

export interface VisibleRows {
  rows: readonly TreeRow[];
  // The rows hidden while empty rows are off; every empty row while they show.
  count: number;
}

export function visibleRows(
  rows: readonly TreeRow[],
  showEmpty: boolean,
): VisibleRows {
  if (showEmpty) {
    return { rows, count: rows.filter(isEmpty).length };
  }

  const hidden = hiddenIds(rows);

  return {
    rows: rows.filter((row) => !hidden.has(row.id)),
    count: hidden.size,
  };
}

function isEmpty(row: TreeRow): boolean {
  return row.subtree === 0 && row.own === 0;
}

// A row hides when it is empty and every row under it hides.
function hiddenIds(rows: readonly TreeRow[]): Set<string> {
  const children = new Map<string, TreeRow[]>();
  for (const row of rows) {
    if (row.parentId === null) continue;
    children.set(row.parentId, [...(children.get(row.parentId) ?? []), row]);
  }

  const hidden = new Set<string>();
  const hides = (row: TreeRow): boolean => {
    const rowsUnder = (children.get(row.id) ?? []).map(hides);
    const hide = isEmpty(row) && rowsUnder.every(Boolean);
    if (hide) hidden.add(row.id);

    return hide;
  };
  rows.filter((row) => row.parentId === null).forEach(hides);

  return hidden;
}
