// A calendar month written YYYY-MM as the locale names it, month and year side by side ("outubro 2026").
export function monthText(month: string, locale: string): string {
  const [year = 0, m = 1] = month.split("-").map(Number);
  const name = new Intl.DateTimeFormat(locale, {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, m - 1, 1)));

  return `${name} ${String(year)}`;
}
