import type { components } from "@/api/schema.gen";
import { monthEnd, netOf } from "@/features/planning/model/agenda";
import type { AgendaRow } from "@/features/planning/model/agenda";
import { dayCount } from "@/features/planning/model/day-count";
import { shiftDate } from "@/i18n/format";

type Money = components["schemas"]["Money"];

export interface MonthClose {
  currency: string;
  inflow: number;
  outflow: number;
  inflowDone: number;
  outflowDone: number;
  // Pending outflow, a positive amount.
  toPay: number;
  // Expected and overdue rows, in any currency.
  pendingCount: number;
  close: number;
  // The net of each other currency: never added, named on screen (spec A2).
  leftOut: Money[];
}

export interface PendingGroups {
  overdue: AgendaRow[];
  week: AgendaRow[];
  later: AgendaRow[];
  done: AgendaRow[];
}

export interface BalancePoint {
  date: string;
  amount: number;
}

const weekDays = 7;

// The month's close in one currency (spec A2): a realized row at its charged amount, a pending
// row at its expected amount, a skipped row and a movement that leaves the spending set
// untouched not at all (planning coherence A253).
export function monthClose(
  rows: readonly AgendaRow[],
  currency: string,
): MonthClose {
  const counted = rows.filter((r) => cashSign(r) !== 0);
  const own = counted.filter((r) => r.money.currency === currency);
  const flow = (sign: 1 | -1, state?: "realized") =>
    own
      .filter((r) => cashSign(r) === sign)
      .filter((r) => state === undefined || r.occurrence.state === state)
      .reduce((sum, r) => sum + sign * cashAmount(r).amount, 0);

  const inflow = flow(1);
  const outflow = flow(-1);
  const outflowDone = flow(-1, "realized");

  return {
    currency,
    inflow,
    outflow,
    inflowDone: flow(1, "realized"),
    outflowDone,
    toPay: outflow - outflowDone,
    pendingCount: counted.filter((r) => isPending(r)).length,
    close: inflow - outflow,
    leftOut: netOf(
      counted
        .filter((r) => r.money.currency !== currency)
        .map((r) => ({ ...r, money: cashAmount(r) })),
    ),
  };
}

// The effect of a row on the money to spend: 1 adds, -1 takes, 0 leaves it as it is. A skipped
// row moves nothing. A schedule that moves money between two accounts of the owner counts by
// the spending set: out of it takes, into it adds, and a movement that keeps both ends inside
// or outside it changes nothing (planning coherence A253).
function cashSign(row: AgendaRow): -1 | 0 | 1 {
  if (row.occurrence.state === "skipped") return 0;

  const moves = row.schedule?.moves;
  if (moves === undefined) {
    if (row.schedule?.kind === "transfer") return 0;

    return row.money.amount < 0 ? -1 : 1;
  }

  const leaves = moves.from === "spending";
  const enters = moves.to === "spending";
  if (leaves === enters) return 0;

  return leaves ? -1 : 1;
}

// What a row adds to or takes from the money to spend, signed by cashSign.
function cashAmount(row: AgendaRow): Money {
  const moved = rowAmount(row);

  return {
    amount: cashSign(row) * Math.abs(moved.amount),
    currency: moved.currency,
  };
}

// What a row moves: the charged amount once realized, signed like the expected one.
export function rowAmount(row: AgendaRow): Money {
  const actual = row.occurrence.actual_amount;
  if (row.occurrence.state !== "realized" || actual === undefined)
    return row.money;

  return {
    amount: Math.sign(row.money.amount) * Math.abs(actual.amount),
    currency: actual.currency,
  };
}

export function isPending(row: AgendaRow): boolean {
  return (
    row.occurrence.state === "expected" || row.occurrence.state === "overdue"
  );
}

// Overdue first, then what is due within 7 days of today, then the rest (spec A3).
export function pendingGroups(
  rows: readonly AgendaRow[],
  today: string,
): PendingGroups {
  const pending = rows.filter((r) => isPending(r));
  const expected = pending.filter((r) => r.occurrence.state === "expected");
  const soon = (r: AgendaRow) =>
    dayCount(today, r.occurrence.expected_on) <= weekDays;

  return {
    overdue: pending.filter((r) => r.occurrence.state === "overdue"),
    week: expected.filter((r) => soon(r)),
    later: expected.filter((r) => !soon(r)),
    done: rows.filter((r) => !isPending(r)),
  };
}

// The cumulative flow of each day of the month in one currency (spec A6); a row dated before
// the month enters on its first day.
export function runningBalance(
  rows: readonly AgendaRow[],
  month: string,
  currency: string,
): BalancePoint[] {
  const first = `${month}-01`;
  const flows = new Map<string, number>();

  for (const r of rows) {
    if (cashSign(r) === 0 || r.money.currency !== currency) continue;

    const day =
      r.occurrence.expected_on < first ? first : r.occurrence.expected_on;
    flows.set(day, (flows.get(day) ?? 0) + cashAmount(r).amount);
  }

  const points: BalancePoint[] = [];
  let total = 0;
  for (let day = first; day <= monthEnd(month); day = shiftDate(day, 1)) {
    total += flows.get(day) ?? 0;
    points.push({ date: day, amount: total });
  }

  return points;
}

// The first day at the lowest balance.
export function lowestPoint(
  points: readonly BalancePoint[],
): BalancePoint | undefined {
  return points.reduce<BalancePoint | undefined>(
    (low, p) => (low === undefined || p.amount < low.amount ? p : low),
    undefined,
  );
}
