import type { components } from "@/api/schema.gen";
import { changeBP } from "@/features/reports/report-change";
import type { ReportPeriod } from "@/features/reports/report-period";

type NetWorth = components["schemas"]["NetWorth"];

export interface MonthEnd {
  // YYYY-MM.
  month: string;
  // The last day of the month; today for the month that is not over.
  date: string;
}

// The `count` months that end with the month of today, oldest first.
export function monthEnds(today: string, count: number): MonthEnd[] {
  return periodMonthEnds(spanPeriod(today, count), today);
}

// NP1: the `count` months that end with the month of today, from the first day to today.
export function spanPeriod(today: string, count: number): ReportPeriod {
  return { from: `${monthOf(indexOf(today) - count + 1)}-01`, to: today };
}

// NP2: each month that starts in [from, min(to, today)], ended on its last day, on to or on today.
export function periodMonthEnds(
  period: ReportPeriod,
  today: string,
): MonthEnd[] {
  const last = period.to < today ? period.to : today;
  const ends: MonthEnd[] = [];
  for (let index = indexOf(period.from); index <= indexOf(last); index++) {
    const month = monthOf(index);
    const y = Math.floor(index / 12);
    // Day 0 of the next month is the last day of this one.
    const day = new Date(Date.UTC(y, (index % 12) + 1, 0)).getUTCDate();
    const end = `${month}-${String(day).padStart(2, "0")}`;
    ends.push({ month, date: end < last ? end : last });
  }

  return ends;
}

// A month as year * 12 + month − 1.
function indexOf(iso: string): number {
  return Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7)) - 1;
}

function monthOf(index: number): string {
  const y = Math.floor(index / 12);
  return `${String(y)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

export interface NetWorthRow {
  month: string;
  // Minor units; absent for a month with no answer.
  assets?: number;
  liabilities?: number;
  net?: number;
  // The net against the month before, when both have an answer.
  change?: number;
  // The change over the magnitude of the month before, in basis points; absent when that net is zero.
  changeBP?: number;
}

export function netWorthRows(
  months: readonly MonthEnd[],
  results: readonly (NetWorth | undefined)[],
): NetWorthRow[] {
  return months.map(({ month }, i) => {
    const worth = results[i];
    if (worth === undefined) return { month };
    const row: NetWorthRow = {
      month,
      assets: worth.assets.amount,
      liabilities: worth.liabilities.amount,
      net: worth.net.amount,
    };
    const before = i > 0 ? results[i - 1] : undefined;
    if (before === undefined) return row;
    const change = worth.net.amount - before.net.amount;
    const bp = changeBP(change, before.net.amount);
    return { ...row, change, ...(bp === undefined ? {} : { changeBP: bp }) };
  });
}
