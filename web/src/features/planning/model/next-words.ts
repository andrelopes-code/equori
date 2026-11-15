import { dayCount } from "@/features/planning/model/day-count";
import { formatDate, formatDayMonth, formatRelativeDays } from "@/i18n/format";

// Beyond this many days a relative date stops helping and the date stands alone.
const relativeDays = 45;

// The next occurrence as the owner plans with it: "in 3 days · Oct 20", or the date alone when
// it is far.
export function nextWords(iso: string, today: string, locale: string): string {
  const days = dayCount(today, iso);
  if (days < 0 || days > relativeDays) return formatDate(iso, locale);

  return `${formatRelativeDays(days, locale)} · ${formatDayMonth(iso, locale)}`;
}
