import type { components } from "@/api/schema.gen";

type AttributionYear = components["schemas"]["AttributionYear"];

// yearsInView is how many years the chart opens on; an older year is reached by the zoom.
const yearsInView = 12;

export interface YearChartRecord {
  year: string;
  portfolio: number | null;
  rate: number | null;
}

// One record per year: the return of the portfolio (AT8) and the growth of the same money at the
// reference rate, in basis points; a year without the figure holds null and draws no bar.
export function yearChartData(
  years: readonly AttributionYear[],
): YearChartRecord[] {
  return years.map((y) => ({
    year: String(y.year),
    portfolio: y.return_bp ?? null,
    rate: y.rate?.index_bp ?? null,
  }));
}

// The window the chart opens on: the last twelve years of a longer history, the whole otherwise.
export function yearZoom(count: number) {
  if (count <= yearsInView) return undefined;

  return { start: 1 - yearsInView / count, end: 1 };
}
