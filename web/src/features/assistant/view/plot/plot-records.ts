import type { ViewValue } from "@/features/assistant/view/view-types";

export interface PlotColumns {
  label: number;
  series: number[];
}

export interface PlotSeries {
  field: string;
  column: number;
  // A value of the column: the unit a number of the series is written in.
  unit: ViewValue;
}

export interface PlotRecords {
  records: Record<string, string | number>[];
  series: PlotSeries[];
}

// The records a chart draws from the rows of a view (answer views design, V25): one record per
// row, its label as written in the table, each series as the number of its value.
export function plotRecords(
  rows: ViewValue[][],
  labels: string[][],
  plot: PlotColumns,
): PlotRecords {
  const first = rows[0] ?? [];
  const series = plot.series.map((column) => ({
    field: `s${String(column)}`,
    column,
    unit: first[column] ?? {},
  }));
  const records = rows.map((row, i) => {
    const record: Record<string, string | number> = {
      label: labels[i]?.[plot.label] ?? "",
    };
    for (const s of series) record[s.field] = numberOf(row[s.column]);
    return record;
  });

  return { records, series };
}

// The number a value holds: minor units of an amount, basis points of a share or a rate.
export function numberOf(v: ViewValue | undefined): number {
  return (
    v?.money?.amount ??
    v?.bp ??
    v?.count ??
    v?.times ??
    v?.rate ??
    v?.points ??
    0
  );
}

// A value of the unit of template that holds n, for the formatter of that unit.
export function withNumber(template: ViewValue, n: number): ViewValue {
  if (template.money !== undefined)
    return { money: { ...template.money, amount: n } };
  if (template.bp !== undefined) return { bp: n };
  if (template.times !== undefined) return { times: n };
  if (template.rate !== undefined) return { rate: n };
  if (template.points !== undefined) return { points: n };

  return { count: n };
}
