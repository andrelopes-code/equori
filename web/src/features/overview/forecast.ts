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

const dayMs = 86_400_000;

function utc(iso: string): number {
  const [year = 0, month = 1, day = 1] = iso.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
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

export function daysBetween(from: string, to: string): number {
  return Math.round((utc(to) - utc(from)) / dayMs);
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
  let running = todayBalance;
  return monthDays(month).map((date) => {
    const dayEvents = events.filter((event) => event.date === date);
    if (date <= today) {
      last = realized.get(date) ?? last;
      return {
        date,
        realized: last,
        forecast: date === today ? todayBalance : undefined,
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
