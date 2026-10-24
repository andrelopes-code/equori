import { shiftDate } from "@/i18n/format";

export interface ReportPeriod {
  from: string;
  to: string;
}

export type PeriodKind = "month" | "quarter" | "year" | "custom";

const pad = (n: number) => String(n).padStart(2, "0");

function monthStart(index: number): string {
  return `${String(Math.floor(index / 12))}-${pad((index % 12) + 1)}-01`;
}

// The last day of the month at `index` (year * 12 + month - 1); day 0 of the next month.
function monthEnd(index: number): string {
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${String(year)}-${pad(month)}-${pad(last)}`;
}

function indexOf(iso: string): number {
  return Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7)) - 1;
}

// Periods follow the civil Gregorian calendar; a quarter starts in January, April, July or
// October. A fiscal year or a week is not read.
export function kindOf({ from, to }: ReportPeriod): PeriodKind {
  if (!from.endsWith("-01")) return "custom";
  const start = indexOf(from);
  if (from.endsWith("-01-01") && to === monthEnd(start + 11)) return "year";
  if (start % 3 === 0 && to === monthEnd(start + 2)) return "quarter";
  return to === monthEnd(start) ? "month" : "custom";
}

const spans = { month: 1, quarter: 3, year: 12 } as const;

// The month, quarter or year that holds `day`.
export function periodOfKind(
  kind: Exclude<PeriodKind, "custom">,
  day: string,
): ReportPeriod {
  const span = spans[kind];
  const index = indexOf(day);
  const start = index - (index % span);
  return { from: monthStart(start), to: monthEnd(start + span - 1) };
}

export function defaultPeriod(today: string): ReportPeriod {
  return periodOfKind("month", today);
}

// The neighbouring month, quarter or year, or the run of days of the same length.
export function stepPeriod(
  period: ReportPeriod,
  direction: -1 | 1,
): ReportPeriod {
  const kind = kindOf(period);
  if (kind === "custom") {
    const length =
      Math.round(
        (Date.parse(period.to) - Date.parse(period.from)) / 86_400_000,
      ) + 1;
    return {
      from: shiftDate(period.from, direction * length),
      to: shiftDate(period.to, direction * length),
    };
  }
  const span = spans[kind];
  const start = indexOf(period.from) + direction * span;
  return { from: monthStart(start), to: monthEnd(start + span - 1) };
}

// The period a comparison reads: the one right before.
export function previousPeriod(period: ReportPeriod): ReportPeriod {
  return stepPeriod(period, -1);
}
