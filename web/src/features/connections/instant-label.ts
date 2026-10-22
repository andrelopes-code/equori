import { formatDayMonth, todayISO } from "@/i18n/format";

function clock(at: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(at);
}

// The local time of an instant of today, else its day and time.
export function instantLabel(
  at: string,
  today: string,
  locale: string,
): string {
  const date = new Date(at);
  const day = todayISO(date);
  return day === today
    ? clock(date, locale)
    : `${formatDayMonth(day, locale)}, ${clock(date, locale)}`;
}
