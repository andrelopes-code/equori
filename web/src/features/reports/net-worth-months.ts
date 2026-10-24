import type { components } from "@/api/schema.gen";

type NetWorth = components["schemas"]["NetWorth"];

export interface MonthEnd {
  // YYYY-MM.
  month: string;
  // The last day of the month; today for the month that is not over.
  date: string;
}

// The `count` months that end with the month of today, oldest first.
export function monthEnds(today: string, count: number): MonthEnd[] {
  const year = Number(today.slice(0, 4));
  const current = year * 12 + Number(today.slice(5, 7)) - 1;
  return Array.from({ length: count }, (_, i) => {
    const index = current - (count - 1 - i);
    const y = Math.floor(index / 12);
    const m = (index % 12) + 1;
    const month = `${String(y)}-${String(m).padStart(2, "0")}`;
    if (month === today.slice(0, 7)) return { month, date: today };
    // Day 0 of the next month is the last day of this one.
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { month, date: `${month}-${String(last).padStart(2, "0")}` };
  });
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
    const base = Math.abs(before.net.amount);
    return {
      ...row,
      change,
      ...(base === 0 ? {} : { changeBP: Math.round((change * 10000) / base) }),
    };
  });
}
