import { formatDate } from "@/i18n/format";
import type { Locale } from "@/i18n/locale";

// A moment the provider reports, as the day and the time in the reader's zone.
export function formatInstant(iso: string, locale: Locale): string {
  const moment = new Date(iso);
  const day = moment.toISOString().slice(0, 10);
  const time = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(moment);
  return `${formatDate(day, locale)} ${time}`;
}
