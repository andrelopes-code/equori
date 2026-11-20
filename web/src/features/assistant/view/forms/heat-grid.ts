export interface HeatCell {
  day: number;
  // Share of the month's peak, 0 to 1; undefined after the counted days.
  level?: number;
}

// The cells of a month in weeks that start on firstDay (1 = Monday … 7 = Sunday, ISO), with the
// blanks before the first day.
export function heatGrid(
  month: string,
  amounts: number[],
  until: number,
  firstDay: number,
): { blanks: number; cells: HeatCell[] } {
  const [year = 0, m = 1] = month.split("-").map(Number);
  const isoWeekday =
    ((new Date(Date.UTC(year, m - 1, 1)).getUTCDay() + 6) % 7) + 1;
  const blanks = (isoWeekday - firstDay + 7) % 7;
  const peak = Math.max(0, ...amounts);

  return {
    blanks,
    cells: amounts.map((a, i) => {
      const day = i + 1;
      return day > until ? { day } : { day, level: peak > 0 ? a / peak : 0 };
    }),
  };
}

// The first day of the week in a locale, ISO numbered; Monday where the browser cannot tell.
export function firstWeekday(locale: string): number {
  const info = (
    new Intl.Locale(locale) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number };
    }
  ).getWeekInfo?.();

  return info?.firstDay ?? 1;
}
