import type { MessageKey } from "@/i18n/catalog.en";
import {
  formatDate,
  formatDayMonth,
  formatMonthTitle,
  shiftDate,
} from "@/i18n/format";

export interface PeriodPreset {
  key: string;
  label: MessageKey;
  from: string;
  to: string;
}

function monthEnd(year: number, month: number): string {
  // Day 0 of the next month is the last day of this one.
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${String(year)}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

function monthStart(year: number, month: number): string {
  return `${String(year)}-${String(month).padStart(2, "0")}-01`;
}

export function periodPresets(today: string): PeriodPreset[] {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const lastYear = month === 1 ? year - 1 : year;
  const lastMonth = month === 1 ? 12 : month - 1;
  return [
    {
      key: "this-month",
      label: "transactions.period.thisMonth",
      from: monthStart(year, month),
      to: monthEnd(year, month),
    },
    {
      key: "last-month",
      label: "transactions.period.lastMonth",
      from: monthStart(lastYear, lastMonth),
      to: monthEnd(lastYear, lastMonth),
    },
    {
      key: "last-30-days",
      label: "transactions.period.last30Days",
      from: shiftDate(today, -29),
      to: today,
    },
    {
      key: "last-90-days",
      label: "transactions.period.last90Days",
      from: shiftDate(today, -89),
      to: today,
    },
    {
      key: "this-year",
      label: "transactions.period.thisYear",
      from: `${String(year)}-01-01`,
      to: `${String(year)}-12-31`,
    },
    {
      key: "last-year",
      label: "transactions.period.lastYear",
      from: `${String(year - 1)}-01-01`,
      to: `${String(year - 1)}-12-31`,
    },
  ];
}

export type PeriodKind = "month" | "year" | "range";

// A whole calendar month or year reads and steps as one; any other run is a plain range.
export function periodKind(from: string, to: string): PeriodKind {
  const year = Number(from.slice(0, 4));
  const month = Number(from.slice(5, 7));
  if (from.endsWith("-01-01") && to === `${String(year)}-12-31`) return "year";
  if (from.endsWith("-01") && to === monthEnd(year, month)) return "month";
  return "range";
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

// The period before (-1) or after (1): the neighbouring month or year, else a run of the same length.
export function stepPeriod(
  from: string,
  to: string,
  direction: -1 | 1,
): { from: string; to: string } {
  const year = Number(from.slice(0, 4));
  const month = Number(from.slice(5, 7));
  switch (periodKind(from, to)) {
    case "year": {
      const next = year + direction;
      return { from: `${String(next)}-01-01`, to: `${String(next)}-12-31` };
    }
    case "month": {
      const index = year * 12 + (month - 1) + direction;
      const y = Math.floor(index / 12);
      const m = (index % 12) + 1;
      return { from: monthStart(y, m), to: monthEnd(y, m) };
    }
    case "range": {
      const length = daysBetween(from, to) + 1;
      return {
        from: shiftDate(from, direction * length),
        to: shiftDate(to, direction * length),
      };
    }
  }
}

// "Outubro de 2026", "2025", "1 out – 10 out"; a run outside this year writes its years.
export function periodLabel(
  from: string,
  to: string,
  today: string,
  locale: string,
): string {
  switch (periodKind(from, to)) {
    case "month":
      return formatMonthTitle(from.slice(0, 7), locale);
    case "year":
      return from.slice(0, 4);
    case "range": {
      const year = today.slice(0, 4);
      const short = from.startsWith(year) && to.startsWith(year);
      const day = (iso: string) =>
        short ? formatDayMonth(iso, locale) : formatDate(iso, locale);
      return `${day(from)} – ${day(to)}`;
    }
  }
}
