import type { components } from "@/api/schema.gen";

type SeriesPoint = components["schemas"]["ReturnSeriesPoint"];
type SeriesIndex = components["schemas"]["ReturnSeriesIndex"];

export const portfolioField = "portfolio";

const dayStepDays = 184;
const threeYearsDays = 1100;

export type PlotRow = Record<string, string | number | null>;

// One record per date holding a point of the portfolio or of an index; a series without a point on
// the date reads null, so its line leaves a gap or joins its neighbours as the chart sets.
export function plotRows(
  points: readonly SeriesPoint[],
  indexes: readonly SeriesIndex[],
): PlotRow[] {
  const ids = [portfolioField, ...indexes.map((i) => i.index)];
  const rows = new Map<string, PlotRow>();
  const rowOf = (date: string): PlotRow => {
    const empty: PlotRow = { date };
    for (const id of ids) empty[id] = null;
    const row = rows.get(date) ?? empty;
    rows.set(date, row);

    return row;
  };

  for (const p of points) {
    if (p.return_bp !== undefined)
      rowOf(p.date)[portfolioField] = p.return_bp / 10000;
  }
  for (const index of indexes) {
    for (const p of index.points)
      rowOf(p.date)[index.index] = p.return_bp / 10000;
  }

  return [...rows.values()].sort((a, b) =>
    String(a.date).localeCompare(String(b.date)),
  );
}

// The labels of the time axis: days of a short period, months of a few years, years beyond.
export function timeFormat(days: number): Intl.DateTimeFormatOptions {
  if (days <= dayStepDays) return { day: "2-digit", month: "short" };

  return days <= threeYearsDays
    ? { month: "short", year: "2-digit" }
    : { year: "numeric" };
}
