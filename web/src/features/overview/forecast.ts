import type { components } from "@/api/schema.gen";

type ScheduleKind = components["schemas"]["ScheduleKind"];

export interface ForecastEvent {
  date: string;
  occurrenceID: string;
  description: string;
  kind: ScheduleKind | undefined;
  // Minor units, signed by its effect on the scoped balance.
  amount: number;
}

export interface ForecastDay {
  date: string;
  // Minor units; realized up to today, forecast from today. Today carries both.
  realized: number | undefined;
  forecast: number | undefined;
  events: ForecastEvent[];
}

export function monthDays(month: string): string[] {
  const [year = 0, m = 1] = month.split("-").map(Number);
  const days = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return Array.from(
    { length: days },
    (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`,
  );
}

export function monthEnd(month: string): string {
  return monthDays(month).at(-1) ?? `${month}-01`;
}

export function shiftMonth(month: string, by: number): string {
  const [year = 0, m = 1] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, m - 1 + by, 1));
  return date.toISOString().slice(0, 7);
}

export function sumByDate(
  series: readonly (readonly {
    date: string;
    balance: { amount: number; currency: string };
  }[])[],
): Map<string, number> {
  const sums = new Map<string, number>();
  for (const points of series) {
    for (const point of points) {
      sums.set(point.date, (sums.get(point.date) ?? 0) + point.balance.amount);
    }
  }
  return sums;
}

// One occurrence can move two scoped accounts (a transfer between them); its sides add up,
// and an occurrence that nets to zero leaves the scoped balance unchanged.
export function mergeEvents(
  projections: readonly (readonly {
    date: string;
    occurrence_id: string;
    schedule_id: string;
    amount: number;
  }[])[],
  schedules: Map<string, { description: string; kind: ScheduleKind }>,
): ForecastEvent[] {
  const byOccurrence = new Map<string, ForecastEvent>();
  for (const points of projections) {
    for (const point of points) {
      const known = byOccurrence.get(point.occurrence_id);
      if (known !== undefined) {
        known.amount += point.amount;
        continue;
      }
      const schedule = schedules.get(point.schedule_id);
      byOccurrence.set(point.occurrence_id, {
        date: point.date,
        occurrenceID: point.occurrence_id,
        description: schedule?.description ?? "",
        kind: schedule?.kind,
        amount: point.amount,
      });
    }
  }
  return [...byOccurrence.values()]
    .filter((event) => event.amount !== 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function buildForecast({
  month,
  today,
  realized,
  todayBalance,
  events,
}: {
  month: string;
  today: string;
  realized: Map<string, number>;
  todayBalance: number;
  events: readonly ForecastEvent[];
}): ForecastDay[] {
  let last: number | undefined;
  const days = monthDays(month);
  // An occurrence dated today is still to happen: the forecast drops by it from the next day, so
  // the two lines meet on today, and on today itself when today ends the month.
  let running =
    todayBalance +
    events
      .filter((event) => event.date === today)
      .reduce((sum, event) => sum + event.amount, 0);

  return days.map((date) => {
    const dayEvents = events.filter((event) => event.date === date);

    if (date <= today) {
      last = realized.get(date) ?? last;

      return {
        date,
        realized: last,
        forecast: forecastOn(date, today, days.at(-1), todayBalance, running),
        events: date === today ? dayEvents : [],
      };
    }

    running += dayEvents.reduce((sum, event) => sum + event.amount, 0);
    return { date, realized: undefined, forecast: running, events: dayEvents };
  });
}

export function lowestAhead(
  days: readonly ForecastDay[],
): { date: string; balance: number; event: ForecastEvent | undefined } | null {
  let low: {
    date: string;
    balance: number;
    event: ForecastEvent | undefined;
  } | null = null;
  for (const day of days) {
    if (day.forecast === undefined) continue;
    if (low === null || day.forecast < low.balance) {
      const event = [...day.events].sort((a, b) => a.amount - b.amount)[0];
      low = { date: day.date, balance: day.forecast, event };
    }
  }
  return low;
}

// A card statement leaves the Available accounts on its due date; one past due leaves today,
// and one due after the month stays out (balance forecast design, B1 and B2).
export function statementEvents({
  owed,
  base,
  today,
  end,
  paid,
  describe,
}: {
  owed: readonly {
    account: { id: string; name: string };
    statement: { id: string; due_date: string };
    amount: { amount: number; currency: string };
  }[];
  base: string;
  today: string;
  end: string;
  paid: ReadonlySet<string>;
  describe: (card: string) => string;
}): ForecastEvent[] {
  return owed
    .filter(
      ({ account, statement, amount }) =>
        amount.currency === base &&
        amount.amount > 0 &&
        statement.due_date <= end &&
        !paid.has(account.id),
    )
    .map(({ account, statement, amount }) => ({
      date: statement.due_date < today ? today : statement.due_date,
      occurrenceID: `statement-${statement.id}`,
      description: describe(account.name),
      kind: undefined,
      amount: -amount.amount,
    }));
}

// The accounts that the schedules expected by month end move: a schedule that pays a card
// already carries its statement in the forecast.
export function cardsPaidBySchedule(
  points: readonly { date: string; schedule_id: string }[],
  schedules: ReadonlyMap<
    string,
    { account_id: string; counterpart_id: string }
  >,
  end: string,
): Set<string> {
  return new Set(
    points
      .filter((point) => point.date <= end)
      .flatMap((point) => {
        const schedule = schedules.get(point.schedule_id);

        return schedule === undefined
          ? []
          : [schedule.account_id, schedule.counterpart_id];
      }),
  );
}

function forecastOn(
  date: string,
  today: string,
  end: string | undefined,
  todayBalance: number,
  settled: number,
): number | undefined {
  if (date !== today) return undefined;

  return date === end ? settled : todayBalance;
}
