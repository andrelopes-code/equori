import type { CellRange } from "@/features/spreadsheets/files/snapshot";

export const chartKinds = ["column", "bar", "line", "area", "pie"] as const;

export type ChartKind = (typeof chartKinds)[number];

// What a chart placed on a sheet keeps in the document: its kind and the cells it reads.
export interface ChartSettings {
  kind: ChartKind;
  sheetID: string;
  range: CellRange;
}

export interface ChartTable {
  // One record per category: the field "category" and one field per series.
  records: Record<string, string | number | null>[];
  series: { field: string; label: string }[];
}

// The settings a stored value holds, or null when it is not one: a document can come from a
// later version or from a file edited by hand.
export function readSettings(value: unknown): ChartSettings | null {
  if (!isRecord(value) || !isRecord(value.range)) return null;

  const kind = chartKinds.find((k) => k === value.kind);
  const { sheetID } = value;
  const { startRow, endRow, startColumn, endColumn } = value.range;

  if (
    kind === undefined ||
    typeof sheetID !== "string" ||
    !isIndex(startRow) ||
    !isIndex(endRow) ||
    !isIndex(startColumn) ||
    !isIndex(endColumn)
  )
    return null;

  return { kind, sheetID, range: { startRow, endRow, startColumn, endColumn } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// A row or a column: a whole number from zero.
function isIndex(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

// The words of a cell that names a series or a category.
function text(value: unknown): string {
  if (typeof value === "string") return value;

  return typeof value === "number" || typeof value === "boolean"
    ? String(value)
    : "";
}

// The categories and the series of the cells of a range, as a spreadsheet reads them. The
// first row names the series when it holds no number and another row follows. The first column
// names the categories when it holds no number and another column follows. Every other column
// is a series; a cell that is not a number is a gap. A series without a name is numbered, and
// so is a category without one.
export function chartTable(
  rows: readonly (readonly unknown[])[],
  seriesName: (position: number) => string,
): ChartTable {
  const width = Math.max(0, ...rows.map((row) => row.length));
  const headed = rows.length > 1 && !(rows[0] ?? []).some(isNumber);
  const body = headed ? rows.slice(1) : rows;
  const labelled = width > 1 && !body.some((row) => isNumber(row[0]));
  const first = labelled ? 1 : 0;

  const series = Array.from({ length: Math.max(0, width - first) }, (_, i) => ({
    field: `s${String(i)}`,
    label:
      (headed ? text(rows[0]?.[first + i]).trim() : "") || seriesName(i + 1),
  }));

  const records = body.map((row, r) => {
    const record: Record<string, string | number | null> = {
      category: (labelled ? text(row[0]).trim() : "") || String(r + 1),
    };

    series.forEach((s, i) => {
      const value = row[first + i];
      record[s.field] = isNumber(value) ? value : null;
    });

    return record;
  });

  return { records, series };
}
