// The short name of a month written YYYY-MM, in the locale ("out.", "Oct").
export function monthLabel(month: string, locale: string): string {
  const [year = 0, m = 1] = month.split("-").map(Number);

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, m - 1, 1)));
}
