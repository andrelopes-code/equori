import type { SheetRow } from "@/features/accounts/balance-sheet/balance-sheet";

// How many currency codes the folded positions line names.
const namedPositions = 3;

export interface SheetView {
  // The parents whose children are hidden.
  closed: ReadonlySet<string>;
  // The parents whose positions are listed.
  positionsOpen: ReadonlySet<string>;
}

interface Sibling {
  // The first and the last line among the lines that share a parent: the rail starts above
  // the first and ends at the branch of the last.
  first: boolean;
  last: boolean;
}

export type SheetLine =
  | ({ type: "account"; row: SheetRow; open: boolean } & Sibling)
  | ({
      type: "positions";
      parentId: string;
      depth: number;
      count: number;
      codes: string[];
      open: boolean;
    } & Sibling);

// The lines the list draws: the rows under a closed parent are left out, and the positions of a
// parent fold into one line until it is opened (AL8, AL9).
export function sheetLines(
  rows: readonly SheetRow[],
  view: SheetView,
): SheetLine[] {
  const lines: SheetLine[] = [];
  let hiddenBelow: number | undefined;
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (row === undefined) continue;
    if (hiddenBelow !== undefined && row.depth > hiddenBelow) continue;
    hiddenBelow = undefined;
    if (row.position && row.parentId !== undefined) {
      const first =
        rows[i - 1]?.position !== true ||
        rows[i - 1]?.parentId !== row.parentId;
      if (first) lines.push(positionsLine(rows, i, view, row.parentId));
      if (!view.positionsOpen.has(row.parentId)) continue;
    }
    const open = !view.closed.has(row.account.id);
    lines.push({ type: "account", row, open, first: false, last: false });
    if (row.hasChildren && !open) hiddenBelow = row.depth;
  }
  return markSiblings(lines);
}

function positionsLine(
  rows: readonly SheetRow[],
  start: number,
  view: SheetView,
  parentId: string,
): SheetLine {
  const group: SheetRow[] = [];
  for (
    let i = start;
    rows[i]?.position === true && rows[i]?.parentId === parentId;
    i += 1
  ) {
    const row = rows[i];
    if (row !== undefined) group.push(row);
  }
  return {
    type: "positions",
    parentId,
    depth: rows[start]?.depth ?? 1,
    count: group.length,
    codes: group.slice(0, namedPositions).map((row) => row.account.currency),
    open: view.positionsOpen.has(parentId),
    first: false,
    last: false,
  };
}

function parentOf(line: SheetLine): string | undefined {
  return line.type === "positions" ? line.parentId : line.row.parentId;
}

function markSiblings(lines: SheetLine[]): SheetLine[] {
  const seen = new Set<string>();
  const lastOf = new Map<string, number>();
  lines.forEach((line, i) => {
    const parent = parentOf(line);
    if (parent !== undefined) lastOf.set(parent, i);
  });
  return lines.map((line, i) => {
    const parent = parentOf(line);
    if (parent === undefined) return line;
    const first = !seen.has(parent);
    seen.add(parent);
    return { ...line, first, last: lastOf.get(parent) === i };
  });
}
