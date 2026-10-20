import type { MessageKey } from "@/i18n/catalog.en";
import { shiftDate } from "@/i18n/format";

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
  ];
}
