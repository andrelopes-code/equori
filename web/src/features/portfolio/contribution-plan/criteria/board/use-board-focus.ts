import { useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import type { CellPosition } from "@/features/portfolio/contribution-plan/criteria/model/next-cell";
import { nextCell } from "@/features/portfolio/contribution-plan/criteria/model/next-cell";

// The one tab stop of the board: the cell the focus rests on, and the keys that move it.
// Workaround for Slotted issue #176: the focus helpers move along one axis, and the board has two.
export function useBoardFocus(rows: number, columns: number) {
  const [at, setAt] = useState<CellPosition>({ row: 0, column: 0 });
  const board = useRef<HTMLDivElement>(null);

  // A criterion or an asset that leaves takes the rest of the focus back inside the board.
  const rest = {
    row: Math.min(at.row, Math.max(rows - 1, 0)),
    column: Math.min(at.column, Math.max(columns - 1, 0)),
  };

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    const next = nextCell(event.key, rest, rows, columns);

    if (next === undefined) return;

    event.preventDefault();
    setAt(next);
    board.current
      ?.querySelector<HTMLElement>(
        `[data-cell="${String(next.row)}:${String(next.column)}"]`,
      )
      ?.focus();
  }

  return {
    board,
    cellProps: (row: number, column: number) => ({
      "data-cell": `${String(row)}:${String(column)}`,
      tabIndex: rest.row === row && rest.column === column ? 0 : -1,
      onFocus: () => {
        setAt({ row, column });
      },
      onKeyDown: handleKeyDown,
    }),
  };
}

export type BoardFocus = ReturnType<typeof useBoardFocus>;
