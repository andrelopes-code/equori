export interface MonthReturn {
  month: string;
  value: number;
}

export interface MonthFigures {
  best: MonthReturn;
  worst: MonthReturn;
  positive: number;
  negative: number;
  total: number;
}

// PR8: the best and the worst month and the months on each side of zero; null without a month.
export function monthFigures(
  months: readonly MonthReturn[],
): MonthFigures | null {
  const [first, ...rest] = months;
  if (first === undefined) return null;

  return {
    best: rest.reduce((a, m) => (m.value > a.value ? m : a), first),
    worst: rest.reduce((a, m) => (m.value < a.value ? m : a), first),
    positive: months.filter((m) => m.value > 0).length,
    negative: months.filter((m) => m.value < 0).length,
    total: months.length,
  };
}
