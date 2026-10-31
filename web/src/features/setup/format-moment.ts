// An instant of the instance (a backup, a copy) in the time zone of the books.
export function formatMoment(
  iso: string,
  locale: string,
  timeZone?: string,
): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    ...(timeZone === undefined ? {} : { timeZone }),
  }).format(new Date(iso));
}
