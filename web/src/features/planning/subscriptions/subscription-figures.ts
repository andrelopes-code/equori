import type { components } from "@/api/schema.gen";
import { dayCount } from "@/features/planning/model/day-count";
import {
  currentTerms,
  hasEnded,
  subscriptionCost,
} from "@/features/planning/model/schedule-words";

type Money = components["schemas"]["Money"];
type Occurrence = components["schemas"]["Occurrence"];
type Schedule = components["schemas"]["Schedule"];
type ScheduleTerms = components["schemas"]["ScheduleTerms"];

export interface MonthCell {
  month: string;
  state: "paid" | "other" | "skipped" | "expected" | "none";
  charged?: Money;
  expected?: Money;
}

export interface SubscriptionLine {
  schedule: Schedule;
  terms: ScheduleTerms;
  monthly: number;
  yearly: number;
  // Share of the monthly total; undefined in another currency.
  shareBp: number | undefined;
  cells: MonthCell[];
}

export interface PriceChange {
  schedule: Schedule;
  kind: "rises" | "falls" | "changed" | "charged";
  on: string;
  from: Money;
  to: Money;
}

export interface NextCharge {
  schedule: Schedule;
  on: string;
  amount: Money;
}

export interface SubscriptionFigures {
  currency: string;
  active: SubscriptionLine[];
  ended: SubscriptionLine[];
  monthly: number;
  yearly: number;
  // Realized in the last 12 months at the charged amount, and its difference from the expected.
  charged: number;
  chargedDiff: number;
  endedMonthly: number;
  // The monthly cost of each other currency: never added, named on screen (spec C2').
  leftOut: Money[];
  changes: PriceChange[];
  next: NextCharge[];
}

export interface SubscriptionInput {
  schedules: readonly Schedule[];
  // Occurrences from the first day of the month 11 months back to today.
  past: readonly Occurrence[];
  // Expected occurrences from today on.
  upcoming: readonly Occurrence[];
  today: string;
  currency: string;
}

const months = 12;
const nextCount = 5;
const yearDays = 365;

// The subscriptions tab in one currency (spec 6).
export function subscriptionFigures(
  input: SubscriptionInput,
): SubscriptionFigures {
  const { today, currency } = input;
  const lines = input.schedules
    .filter((s) => s.kind === "subscription")
    .flatMap((s) => line(s, input));
  const own = (l: SubscriptionLine) => l.terms.amount.currency === currency;
  const active = lines.filter((l) => !hasEnded(l.schedule.ends_on, today));
  const monthly = sum(active.filter(own), (l) => l.monthly);
  const realized = input.past.filter(
    (o) =>
      o.state === "realized" &&
      active.some((l) => own(l) && l.schedule.id === o.schedule_id),
  );

  return {
    currency,
    active: [...active.filter(own), ...active.filter((l) => !own(l))]
      .sort((a, b) => Number(own(b)) - Number(own(a)) || b.monthly - a.monthly)
      .map((l) => ({
        ...l,
        shareBp:
          own(l) && monthly > 0
            ? Math.round((l.monthly * 10000) / monthly)
            : undefined,
      })),
    ended: lines
      .filter((l) => hasEnded(l.schedule.ends_on, today))
      .sort((a, b) =>
        (b.schedule.ends_on ?? "").localeCompare(a.schedule.ends_on ?? ""),
      ),
    monthly,
    yearly: sum(active.filter(own), (l) => l.yearly),
    charged: sum(realized, (o) => charged(o).amount),
    chargedDiff: sum(
      realized,
      (o) => charged(o).amount - Math.abs(o.expected_amount.amount),
    ),
    endedMonthly: sum(
      lines.filter((l) => own(l) && hasEnded(l.schedule.ends_on, today)),
      (l) => l.monthly,
    ),
    leftOut: leftOut(active.filter((l) => !own(l))),
    changes: active.flatMap((l) => changesOf(l.schedule, input)),
    next: input.upcoming
      .filter((o) => o.state === "expected" && o.expected_on >= today)
      .flatMap((o) => {
        const s = active.find((l) => l.schedule.id === o.schedule_id)?.schedule;
        return s === undefined
          ? []
          : [{ schedule: s, on: o.expected_on, amount: o.expected_amount }];
      })
      .sort((a, b) => a.on.localeCompare(b.on))
      .slice(0, nextCount),
  };
}

function line(
  schedule: Schedule,
  input: SubscriptionInput,
): SubscriptionLine[] {
  const terms = currentTerms(schedule.terms, input.today);
  if (terms === undefined) return [];

  const cost = subscriptionCost(terms.recurrence, terms.amount.amount);
  const own = [...input.past, ...input.upcoming].filter(
    (o) => o.schedule_id === schedule.id,
  );

  return [
    {
      schedule,
      terms,
      monthly: cost.monthly,
      yearly: cost.yearly,
      shareBp: undefined,
      cells: lastMonths(input.today).map((month) =>
        cell(
          month,
          own.find((o) => o.expected_on.startsWith(month)),
        ),
      ),
    },
  ];
}

// The month 11 months back to the current one, as YYYY-MM.
function lastMonths(today: string): string[] {
  const [year = 0, month = 1] = today.split("-").map(Number);

  return Array.from({ length: months }, (_, i) => {
    const d = new Date(Date.UTC(year, month - months + i, 1));
    return d.toISOString().slice(0, 7);
  });
}

function cell(month: string, o: Occurrence | undefined): MonthCell {
  if (o === undefined) return { month, state: "none" };
  if (o.state === "skipped") return { month, state: "skipped" };
  if (o.state !== "realized")
    return { month, state: "expected", expected: o.expected_amount };

  const paid = charged(o);
  const expected = {
    ...o.expected_amount,
    amount: Math.abs(o.expected_amount.amount),
  };

  return {
    month,
    state: paid.amount === expected.amount ? "paid" : "other",
    charged: paid,
    expected,
  };
}

function charged(o: Occurrence): Money {
  const m = o.actual_amount ?? o.expected_amount;

  return { amount: Math.abs(m.amount), currency: m.currency };
}

// A charge at another amount, a later price, a price that changed within the year (spec C4).
function changesOf(
  schedule: Schedule,
  input: SubscriptionInput,
): PriceChange[] {
  const { today } = input;
  const out: PriceChange[] = [];
  const last = input.past
    .filter((o) => o.schedule_id === schedule.id && o.state === "realized")
    .sort((a, b) => a.expected_on.localeCompare(b.expected_on))
    .at(-1);

  if (
    last !== undefined &&
    charged(last).amount !== Math.abs(last.expected_amount.amount)
  )
    out.push({
      schedule,
      kind: "charged",
      on: last.expected_on,
      from: last.expected_amount,
      to: charged(last),
    });

  const versions = [...schedule.terms].sort((a, b) =>
    a.effective_from.localeCompare(b.effective_from),
  );
  const nowIndex = versions.reduce(
    (found, v, i) => (v.effective_from <= today ? i : found),
    -1,
  );
  const now = versions[nowIndex];
  const ahead = versions[nowIndex + 1];
  const before = versions[nowIndex - 1];

  if (
    now !== undefined &&
    ahead !== undefined &&
    ahead.amount.amount !== now.amount.amount
  )
    out.push({
      schedule,
      kind: ahead.amount.amount > now.amount.amount ? "rises" : "falls",
      on: ahead.effective_from,
      from: now.amount,
      to: ahead.amount,
    });

  if (
    now !== undefined &&
    before !== undefined &&
    before.amount.amount !== now.amount.amount &&
    dayCount(now.effective_from, today) < yearDays
  )
    out.push({
      schedule,
      kind: "changed",
      on: now.effective_from,
      from: before.amount,
      to: now.amount,
    });

  return out;
}

function leftOut(lines: readonly SubscriptionLine[]): Money[] {
  const sums = new Map<string, number>();
  for (const l of lines)
    sums.set(
      l.terms.amount.currency,
      (sums.get(l.terms.amount.currency) ?? 0) + l.monthly,
    );

  return [...sums]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, amount]) => ({ amount, currency }));
}

function sum<T>(items: readonly T[], value: (item: T) => number): number {
  return items.reduce((total, item) => total + value(item), 0);
}
