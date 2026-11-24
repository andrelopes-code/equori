import {
  monthRows,
  type MonthReturn,
} from "@/features/portfolio/results/model/month-returns";

// A row of the table: the figures of a year, null where the index has none to subtract.
export interface TableRow {
  year: number;
  cells: (number | null)[];
  total: number | null;
  accumulated: number | null;
}

// PR8: the rows of the portfolio; with an index, each figure is the portfolio's minus the index's
// for the same month, year total and accumulated value (a difference in fractions).
export function compareMonths(
  portfolio: readonly MonthReturn[],
  index: readonly MonthReturn[] | null,
): TableRow[] {
  const rows = monthRows(portfolio);
  if (index === null) return rows;

  const against = new Map(monthRows(index).map((row) => [row.year, row]));

  return rows.map((row) => {
    const other = against.get(row.year);

    return {
      year: row.year,
      cells: row.cells.map((cell, month) => minus(cell, other?.cells[month])),
      total: minus(row.total, other?.total),
      accumulated: minus(row.accumulated, other?.accumulated),
    };
  });
}

function minus(value: number | null, other: number | null | undefined) {
  return value === null || other === null || other === undefined
    ? null
    : value - other;
}
