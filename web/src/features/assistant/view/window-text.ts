import type { ViewWindow } from "@/features/assistant/view/view-types";
import { formatDate } from "@/i18n/format";

// The period of a view in the locale: a month by name, whole months as a range, else the dates.
export function windowText(w: ViewWindow, locale: string): string {
  if (w.at !== undefined) return formatDate(w.at, locale);
  if (w.from === undefined || w.to === undefined) return "";

  const from = utc(w.from);
  const to = utc(w.to);

  if (!wholeMonths(from, to))
    return `${formatDate(w.from, locale)} – ${formatDate(w.to, locale)}`;

  if (
    from.getUTCMonth() === to.getUTCMonth() &&
    from.getUTCFullYear() === to.getUTCFullYear()
  ) {
    return new Intl.DateTimeFormat(locale, {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(from);
  }

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).formatRange(from, to);
}

function utc(iso: string): Date {
  const [year = 0, month = 1, day = 1] = iso.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, day));
}

// The period starts on a first day and ends on a last day of a month.
function wholeMonths(from: Date, to: Date): boolean {
  const next = new Date(to.getTime() + 86_400_000);

  return from.getUTCDate() === 1 && next.getUTCDate() === 1;
}
