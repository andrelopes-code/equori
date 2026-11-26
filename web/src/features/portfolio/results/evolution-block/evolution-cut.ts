import type { components } from "@/api/schema.gen";

type ReturnSeries = components["schemas"]["ReturnSeries"];
type SeriesPoint = components["schemas"]["ReturnSeriesPoint"];

export interface HistoryCut {
  currency: string;
  // Minor units: the value before the first kept point.
  opening: number;
  points: SeriesPoint[];
}

// PR9: the month points of the period, or the points of the period read when the period holds fewer
// than two month points, which draw no line.
export function evolutionCut(
  history: ReturnSeries,
  period: ReturnSeries,
  whole: boolean,
): HistoryCut {
  const months = cutHistory(
    history,
    whole ? undefined : period.from,
    period.to,
  );
  if (months.points.length >= 2) return months;

  return {
    currency: period.currency,
    opening: period.opening,
    points: period.points,
  };
}

// PR9: the month points of the history dated inside the period. The opening value is the value of
// the point before the first one kept, or the opening of the series when the period is the whole
// history (`from` absent) or no point precedes it.
export function cutHistory(
  history: ReturnSeries,
  from: string | undefined,
  to: string,
): HistoryCut {
  const points = history.points.filter(
    (p) => p.date <= to && (from === undefined || p.date >= from),
  );
  const first = points[0];
  const before =
    from === undefined || first === undefined
      ? undefined
      : history.points.filter((p) => p.date < first.date).at(-1);

  return {
    currency: history.currency,
    opening: before?.value ?? history.opening,
    points,
  };
}
