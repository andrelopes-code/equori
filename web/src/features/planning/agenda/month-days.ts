import type { components } from "@/api/schema.gen";
import { isPending, rowAmount } from "@/features/planning/agenda/month-close";
import type { AgendaRow } from "@/features/planning/model/agenda";
import { monthEnd } from "@/features/planning/model/agenda";
import { shiftDate } from "@/i18n/format";

type Money = components["schemas"]["Money"];

export interface DayMark {
  direction: "in" | "out";
  // Expected or overdue: drawn hollow.
  pending: boolean;
}

export interface CalendarDay {
  date: string;
  inMonth: boolean;
  rows: AgendaRow[];
  // One mark per occurrence that moves money; a skipped one moves none.
  marks: DayMark[];
  // The day's net in the base currency; undefined when no occurrence of it moves money.
  net: Money | undefined;
}

// The weeks that hold the month, from the locale's first day of the week (0 is Sunday), each
// day with its occurrences, their marks and its net (spec A5).
export function monthDays(
  rows: readonly AgendaRow[],
  month: string,
  currency: string,
  firstDay: number,
): CalendarDay[] {
  const first = `${month}-01`;
  const last = monthEnd(month);
  const start = shiftDate(first, -((weekday(first) - firstDay + 7) % 7));
  const end = shiftDate(last, (firstDay + 6 - weekday(last) + 7) % 7);
  const days: CalendarDay[] = [];

  for (let date = start; date <= end; date = shiftDate(date, 1)) {
    const own = rows.filter((r) => r.occurrence.expected_on === date);
    const moving = own.filter((r) => r.occurrence.state !== "skipped");
    const counted = moving.filter((r) => r.money.currency === currency);

    days.push({
      date,
      inMonth: date >= first && date <= last,
      rows: own,
      marks: moving.map((r) => ({
        direction: r.money.amount > 0 ? "in" : "out",
        pending: isPending(r),
      })),
      net:
        counted.length === 0
          ? undefined
          : {
              amount: counted.reduce((sum, r) => sum + rowAmount(r).amount, 0),
              currency,
            },
    });
  }

  return days;
}

// 0 is Sunday.
function weekday(iso: string): number {
  const [year = 0, month = 1, day = 1] = iso.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}
