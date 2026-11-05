import { quantile } from "@/features/forecast/quantile";
import type { ForecastEntry } from "@/features/forecast/variable-forecast";
import { monthDays } from "@/features/overview";

export interface RecurringEstimate {
  date: string;
  // Minor units, signed by the effect on the forecast value.
  amount: number;
  // The label of the series' entries.
  label: string;
}

const tolerance = 0.25;
const maxPerMonth = 3;
const minMonths = 2;
const matchShare = 0.75;
const lateDays = 7;

// The series that repeat monthly with a similar amount, and the one payment each still owes the
// current month; `history` lists the history months in order (net worth forecast design, F4, F5).
export function recurringSeries({
  entries,
  history,
  month,
  today,
}: {
  entries: readonly ForecastEntry[];
  history: readonly string[];
  month: string;
  today: string;
}): { estimates: RecurringEstimate[]; matched: Set<ForecastEntry> } {
  const estimates: RecurringEstimate[] = [];
  const matched = new Set<ForecastEntry>();

  for (const series of groupBySeries(entries).values()) {
    const found = recurrenceOf(series, history);
    if (found === null) continue;

    for (const entry of found.matches) matched.add(entry);

    const paid = series.find(
      (entry) =>
        entry.date.startsWith(month) &&
        entry.date <= today &&
        near(entry.amount, found.typical),
    );
    if (paid !== undefined) {
      matched.add(paid);
      continue;
    }

    const date = dueDate(month, today, found.day);
    if (date !== undefined) {
      estimates.push({ date, amount: found.amount, label: found.label });
    }
  }

  return {
    estimates: estimates.sort((a, b) => a.date.localeCompare(b.date)),
    matched,
  };
}

function groupBySeries(
  entries: readonly ForecastEntry[],
): Map<string, ForecastEntry[]> {
  const groups = new Map<string, ForecastEntry[]>();
  for (const entry of entries) {
    groups.set(entry.series, [...(groups.get(entry.series) ?? []), entry]);
  }

  return groups;
}

// The series' typical amount, its matched entries, and their median amount and day; null when it
// does not recur.
function recurrenceOf(
  series: readonly ForecastEntry[],
  history: readonly string[],
): {
  typical: number;
  matches: ForecastEntry[];
  amount: number;
  day: number;
  label: string;
} | null {
  const byMonth = history.map((m) =>
    series.filter((entry) => entry.date.startsWith(m)),
  );
  const held = byMonth.filter((list) => list.length > 0);
  const typical = quantile(
    byMonth.flat().map((entry) => entry.amount),
    0.5,
  );
  const matches = byMonth.map((list) => closest(list, typical));
  const found = matches.filter((entry) => entry !== undefined);
  const required = Math.max(minMonths, Math.ceil(matchShare * history.length));

  if (
    history.length < minMonths ||
    quantile(
      held.map((list) => list.length),
      0.5,
    ) >= maxPerMonth ||
    matches.at(-1) === undefined ||
    found.length < required
  ) {
    return null;
  }

  return {
    typical,
    matches: found,
    amount: Math.round(
      quantile(
        found.map((entry) => entry.amount),
        0.5,
      ),
    ),
    day: Math.round(
      quantile(
        found.map((entry) => dayOf(entry.date)),
        0.5,
      ),
    ),
    label: found.at(-1)?.label ?? "",
  };
}

// The entry of one month closest to the typical amount, when it lies within the tolerance.
function closest(
  list: readonly ForecastEntry[],
  typical: number,
): ForecastEntry | undefined {
  const best = [...list].sort(
    (a, b) => Math.abs(a.amount - typical) - Math.abs(b.amount - typical),
  )[0];

  return best !== undefined && near(best.amount, typical) ? best : undefined;
}

// The day the payment is due this month: its own day ahead, tomorrow when it is late by up to a
// week, and none when it is later.
function dueDate(
  month: string,
  today: string,
  day: number,
): string | undefined {
  const days = monthDays(month);
  const date = days[Math.min(day, days.length) - 1] ?? days[0] ?? today;

  if (date > today) return date;

  const late = (Date.parse(today) - Date.parse(date)) / 86_400_000;
  const tomorrow = days.find((d) => d > today);

  return late <= lateDays ? tomorrow : undefined;
}

function near(amount: number, typical: number): boolean {
  return Math.abs(amount - typical) <= tolerance * Math.abs(typical);
}

function dayOf(date: string): number {
  return Number(date.slice(8, 10));
}
