export interface CellPosition {
  row: number;
  column: number;
}

// Where a key moves the focus of the board; undefined for a key that does not move it. The edges
// hold the focus.
export function nextCell(
  key: string,
  at: CellPosition,
  rows: number,
  columns: number,
): CellPosition | undefined {
  switch (key) {
    case "ArrowRight":
      return { ...at, column: Math.min(at.column + 1, columns - 1) };
    case "ArrowLeft":
      return { ...at, column: Math.max(at.column - 1, 0) };
    case "ArrowDown":
      return { ...at, row: Math.min(at.row + 1, rows - 1) };
    case "ArrowUp":
      return { ...at, row: Math.max(at.row - 1, 0) };
    case "Home":
      return { ...at, column: 0 };
    case "End":
      return { ...at, column: columns - 1 };
    default:
      return undefined;
  }
}
