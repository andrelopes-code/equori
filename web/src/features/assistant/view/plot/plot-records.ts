import type {
  ViewPlot,
  ViewPlotSeries,
  ViewValue,
} from "@/features/assistant/view/view-types";

export interface PlotSeries {
  field: string;
  column: number;
  // A value of the column: the unit a number of the series is written in.
  unit: ViewValue;
  drawn: ViewPlotSeries;
}

export interface PlotRecords {
  records: Record<string, string | number>[];
  series: PlotSeries[];
}

// The records a chart draws from the rows of a view (answer views design, V36): one record per
// row, its label as the category axis writes it, each series as the number of its value; a row without a
// value leaves the field out, so the chart draws a gap.
export function plotRecords(
  rows: ViewValue[][],
  labels: string[],
  plot: ViewPlot,
): PlotRecords {
  const series = plot.series.map((drawn) => ({
    field: `c${String(drawn.column)}`,
    column: drawn.column,
    unit: unitOf(rows, drawn.column),
    drawn,
  }));
  const records = rows.map((row, i) => {
    const record: Record<string, string | number> = {
      label: labels[i] ?? "",
    };
    for (const s of series) {
      const n = numberOf(row[s.column]);
      if (n !== undefined) record[s.field] = n;
    }
    return record;
  });

  return { records, series };
}

// A value of the unit of template that holds n, for the formatter of that unit.
export function withNumber(template: ViewValue, n: number): ViewValue {
  if (template.money !== undefined)
    return { money: { ...template.money, amount: n } };

  return { count: n };
}

function numberOf(v: ViewValue | undefined): number | undefined {
  return v?.money?.amount ?? v?.count;
}

function unitOf(rows: ViewValue[][], column: number): ViewValue {
  const found = rows.find((r) => numberOf(r[column]) !== undefined);

  return found?.[column] ?? { count: 0 };
}
