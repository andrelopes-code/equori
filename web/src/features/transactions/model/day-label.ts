import { formatDate, formatDayHeader } from "@/i18n/format";

interface DayWords {
  today: string;
  yesterday: string;
}

// The name of a day of the list: today and yesterday by word, a day of this year by weekday and
// date, a day of another year by its full date.
export function dayLabel(
  iso: string,
  today: string,
  locale: string,
  words: DayWords,
): string {
  if (!iso.startsWith(today.slice(0, 4))) return formatDate(iso, locale);

  return formatDayHeader(iso, today, locale, words);
}
