import type { components } from "@/api/schema.gen";

type ReturnSeries = components["schemas"]["ReturnSeries"];

// PX13: the recorded amounts in the money of the last point of the inflation index of the series;
// a date after that point is not corrected. Null when the series carries no inflation index.
export function realHistory(history: ReturnSeries): ReturnSeries | null {
  const index = history.indexes.find((i) => i.period === "month")?.points;
  const last = index?.at(-1);
  if (index === undefined || last === undefined) return null;

  const lastLevel = 1 + last.return_bp / 10000;
  const factorAt = (date: string) => {
    const point = index.filter((p) => p.date <= date).at(-1);

    return lastLevel / (1 + (point?.return_bp ?? 0) / 10000);
  };

  return {
    ...history,
    opening: history.opening * lastLevel,
    points: history.points.map((p) => {
      const factor = factorAt(p.date);

      return { ...p, value: p.value * factor, flows: p.flows * factor };
    }),
  };
}
