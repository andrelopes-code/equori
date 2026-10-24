import type { components } from "@/api/schema.gen";
import { shiftDate } from "@/i18n/format";

type Money = components["schemas"]["Money"];
type Occurrence = components["schemas"]["Occurrence"];
type OccurrenceState = components["schemas"]["OccurrenceState"];
type Schedule = components["schemas"]["Schedule"];
type ScheduleKind = components["schemas"]["ScheduleKind"];
type Transaction = components["schemas"]["Transaction"];

// What an action needs of an occurrence; a projection point carries no more.
export type OccurrenceRef = Pick<
  Occurrence,
  "id" | "schedule_id" | "expected_on" | "expected_amount" | "state"
>;

export interface AgendaFilter {
  state?: OccurrenceState | undefined;
  scheduleID?: string | undefined;
  accountID?: string | undefined;
  kind?: ScheduleKind | undefined;
}

export interface AgendaRow {
  occurrence: Occurrence;
  schedule: Schedule | undefined;
  // Signed by its effect on the schedule's account: income adds, everything else takes.
  money: Money;
}

export interface Agenda {
  overdue: AgendaRow[];
  days: { date: string; rows: AgendaRow[] }[];
}

export function signedAmount(
  occurrence: Occurrence,
  schedule: Schedule | undefined,
): Money {
  const sign = schedule?.kind === "income" ? 1 : -1;
  return {
    amount: sign * Math.abs(occurrence.expected_amount.amount),
    currency: occurrence.expected_amount.currency,
  };
}

// The month's occurrences by day, after the overdue ones of any earlier day in a group of their own.
export function agenda(
  month: readonly Occurrence[],
  overdue: readonly Occurrence[],
  schedules: readonly Schedule[],
  filter: AgendaFilter,
): Agenda {
  const byID = new Map(schedules.map((s) => [s.id, s]));
  const unique = new Map([...overdue, ...month].map((o) => [o.id, o]));
  const rows = [...unique.values()]
    .map((occurrence) => {
      const schedule = byID.get(occurrence.schedule_id);
      return {
        occurrence,
        schedule,
        money: signedAmount(occurrence, schedule),
      };
    })
    .filter(
      ({ occurrence, schedule }) =>
        (filter.state === undefined || occurrence.state === filter.state) &&
        (filter.scheduleID === undefined ||
          occurrence.schedule_id === filter.scheduleID) &&
        (filter.accountID === undefined ||
          schedule?.account_id === filter.accountID) &&
        (filter.kind === undefined || schedule?.kind === filter.kind),
    )
    .sort((a, b) =>
      a.occurrence.expected_on.localeCompare(b.occurrence.expected_on),
    );
  const days: Agenda["days"] = [];
  for (const row of rows) {
    if (row.occurrence.state === "overdue") continue;
    const last = days.at(-1);
    if (last?.date === row.occurrence.expected_on) last.rows.push(row);
    else days.push({ date: row.occurrence.expected_on, rows: [row] });
  }
  return {
    overdue: rows.filter((r) => r.occurrence.state === "overdue"),
    days,
  };
}

// The last day of a month (YYYY-MM).
export function monthEnd(month: string): string {
  const [year = 0, m = 1] = month.split("-").map(Number);
  return new Date(Date.UTC(year, m, 0)).toISOString().slice(0, 10);
}

// What the month (YYYY-MM) is planned to bring in and take out; a skipped occurrence moves nothing.
export function monthTotals(
  view: Agenda,
  month: string,
  currency: string,
): { inflow: Money; outflow: Money } {
  let inflow = 0;
  let outflow = 0;
  for (const row of [...view.overdue, ...view.days.flatMap((d) => d.rows)]) {
    if (
      row.occurrence.state === "skipped" ||
      !row.occurrence.expected_on.startsWith(month)
    )
      continue;
    if (row.money.amount > 0) inflow += row.money.amount;
    else outflow -= row.money.amount;
  }
  return {
    inflow: { amount: inflow, currency },
    outflow: { amount: outflow, currency },
  };
}

export function candidateWindow(
  occurrence: OccurrenceRef,
  schedule: Schedule,
): { from: string; to: string } {
  return {
    from: shiftDate(occurrence.expected_on, -schedule.grace_days),
    to: shiftDate(occurrence.expected_on, schedule.grace_days),
  };
}

export interface RealizeCandidate {
  transaction: Transaction;
  // What the transaction moves on the schedule's account.
  amount: Money;
  withinTolerance: boolean;
}

// The transactions that can realize the occurrence, the closest to its expected amount first.
export function realizeCandidates(
  transactions: readonly Transaction[],
  occurrence: OccurrenceRef,
  schedule: Schedule,
): RealizeCandidate[] {
  const expected = Math.abs(occurrence.expected_amount.amount);
  return transactions
    .filter((tx) => tx.voided_at === undefined)
    .flatMap((transaction) => {
      const postings = transaction.postings.filter(
        (p) => p.account_id === schedule.account_id,
      );
      const first = postings[0];
      if (first === undefined) return [];
      const amount = postings.reduce((sum, p) => sum + p.amount.amount, 0);
      const distance = Math.abs(Math.abs(amount) - expected);
      return [
        {
          transaction,
          amount: { amount, currency: first.amount.currency },
          // The server's rule (|A − E| × 10000 ≤ E × tolerance), in integers.
          withinTolerance:
            distance * 10000 <= expected * schedule.match_tolerance_bp,
          distance,
        },
      ];
    })
    .sort(
      (a, b) =>
        a.distance - b.distance ||
        a.transaction.date.localeCompare(b.transaction.date),
    )
    .map(({ transaction, amount, withinTolerance }) => ({
      transaction,
      amount,
      withinTolerance,
    }));
}
