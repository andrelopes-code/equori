import {
  defaultFrom,
  periodDays,
} from "@/features/portfolio/return/portfolio-period";
import type { ResultsPeriod } from "@/features/portfolio/results/results-search";
import { shiftDate } from "@/i18n/format";

// PR5: the longest period read at each step, in days with both ends.
const dayStepDays = 184;
const weekStepDays = 730;

const monthPresets: Partial<Record<ResultsPeriod, number>> = {
  "1m": 1,
  "3m": 3,
  "6m": 6,
};

const yearPresets: Partial<Record<ResultsPeriod, number>> = {
  "12m": 1,
  "2y": 2,
  "5y": 5,
};

export function periodRange(
  period: ResultsPeriod | undefined,
  today: string,
): { from?: string; to: string } {
  if (period === undefined) return { to: today };
  if (period === "ytd")
    return { from: `${today.slice(0, 4)}-01-01`, to: today };

  const months = monthPresets[period];
  if (months !== undefined)
    return { from: startAfterMonths(today, months), to: today };

  return { from: defaultFrom(today, yearPresets[period]), to: today };
}

export function seriesStep(
  from: string | undefined,
  to: string,
): "day" | "week" | "month" {
  if (from === undefined) return "month";

  const days = periodDays(from, to);
  if (days <= dayStepDays) return "day";

  return days <= weekStepDays ? "week" : "month";
}

// PR3, PR5: the period read. A whole history reads itself at the step of its length once its first
// date is known; at `month` the history read is the period read (own false).
export function periodRead(
  from: string | undefined,
  historyFrom: string | undefined,
  to: string,
): { from: string | undefined; step: "day" | "week" | "month"; own: boolean } {
  const start = from ?? historyFrom;
  const step = seriesStep(start, to);

  return { from: start, step, own: from !== undefined || step !== "month" };
}

// The day after the same day `months` months before `to`; a day the month lacks becomes its last.
function startAfterMonths(to: string, months: number): string {
  const [year = 0, month = 1, day = 1] = to.split("-").map(Number);
  const lastDay = new Date(
    Date.UTC(year, month - 1 - months + 1, 0),
  ).getUTCDate();
  const back = new Date(
    Date.UTC(year, month - 1 - months, Math.min(day, lastDay)),
  );

  return shiftDate(back.toISOString().slice(0, 10), 1);
}
