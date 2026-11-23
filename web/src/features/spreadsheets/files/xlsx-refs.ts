// "A" for 0, "Z" for 25, "AA" for 26.
export function columnName(index: number): string {
  let name = "";

  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26))
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name;

  return name;
}

// 0 for "A", 26 for "AA".
export function columnIndex(name: string): number {
  let index = 0;

  for (const char of name) index = index * 26 + (char.charCodeAt(0) - 64);

  return index - 1;
}

export function cellName(row: number, column: number): string {
  return `${columnName(column)}${String(row + 1)}`;
}

// The zero-based row and column of "B3".
export function cellPosition(name: string): { row: number; column: number } {
  const match = /^([A-Z]+)(\d+)$/.exec(name.replaceAll("$", ""));
  if (match === null) return { row: 0, column: 0 };

  return { row: Number(match[2]) - 1, column: columnIndex(match[1] ?? "A") };
}

// A cell reference outside a longer word: "$A1", "AB$12". The lookbehind refuses the end of a
// name ("LOG10") and the lookahead refuses a function call and the rest of a name.
const reference =
  /(?<![A-Za-z0-9_.])(\$?)([A-Z]{1,3})(\$?)(\d{1,7})(?![A-Za-z0-9_(])/g;

// The formula of a cell that shares the one written rows and columns away, as a fill does: a
// reference moves by the offset unless a "$" holds its row or its column. Texts in double
// quotes and sheet names in single quotes stay as written.
export function shiftFormula(
  formula: string,
  rows: number,
  columns: number,
): string {
  return formula
    .split(/("(?:[^"]|"")*"|'(?:[^']|'')*')/)
    .map((part, i) =>
      i % 2 === 1 ? part : shiftReferences(part, rows, columns),
    )
    .join("");
}

function shiftReferences(text: string, rows: number, columns: number): string {
  return text.replace(
    reference,
    (
      _all,
      columnHeld: string,
      column: string,
      rowHeld: string,
      row: string,
    ) => {
      const nextColumn =
        columnHeld === "$"
          ? columnIndex(column)
          : columnIndex(column) + columns;
      const nextRow = rowHeld === "$" ? Number(row) : Number(row) + rows;

      if (nextColumn < 0 || nextRow < 1) return "#REF!";

      return `${columnHeld}${columnName(nextColumn)}${rowHeld}${String(nextRow)}`;
    },
  );
}
