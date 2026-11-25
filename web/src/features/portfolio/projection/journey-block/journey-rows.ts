import type { components } from "@/api/schema.gen";
import type { ProjectionRow } from "@/features/portfolio/projection/model/project";
import { monthEnd } from "@/features/portfolio/projection/journey-block/journey-months";
import { contributed } from "@/features/portfolio/results/model/wealth";

export type JourneyField = "date" | "value" | "contributed" | "projected";

// One record per date, in major units of the currency: what the chart reads. A series without a
// point on the date reads null.
export interface JourneyRow extends Record<JourneyField, unknown> {
  date: string;
  value: number | null;
  contributed: number | null;
  projected: number | null;
}

// PX6: the recorded value and the money contributed from the history, then the projection; the
// last recorded row also carries the projection, so its line starts on today's value.
export function journeyRows(
  history: components["schemas"]["ReturnSeries"],
  projection: readonly ProjectionRow[],
  scale: number,
): JourneyRow[] {
  const divisor = 10 ** scale;
  const sums = contributed(history.opening, history.points);
  const last = history.points.length - 1;

  const recorded = history.points.map((p, i): JourneyRow => ({
    date: p.date,
    value: p.value / divisor,
    contributed: (sums[i] ?? 0) / divisor,
    projected: i === last ? p.value / divisor : null,
  }));
  const projected = projection.map((row): JourneyRow => ({
    date: monthEnd(row.month),
    value: null,
    contributed: null,
    projected: row.value / divisor,
  }));

  return [...recorded, ...projected];
}
