import { quantile } from "@/features/forecast/quantile";
import { monthDays, shiftMonth } from "@/features/overview";

export interface DatedAmount {
  date: string;
  // Minor units, signed by the effect on the forecast value.
  amount: number;
}

export interface ForecastEntry extends DatedAmount {
  kind: "income" | "expense";
}

export interface VariableForecast {
  // The history months the forecast read.
  history: number;
  // Each day after today to the month's end; fractions of a minor unit stay.
  days: DatedAmount[];
  // Offsets of the likely range over the remaining days, against the expected total; null below
  // three history months.
  range: { lower: number; upper: number } | null;
}

interface MonthFigures {
  incomeRate: number;
  expenseRate: number;
  netRate: number;
  expenseBefore: number;
  dayMean: number;
  weekdayMeans: number[];
  incomeByDay: Map<number, number>;
}

const historyMonths = 6;
const minRangeMonths = 3;
const paceBounds = { low: 0.5, high: 2 } as const;

// What the entries no schedule produced say about the rest of the month: the median of the
// history months' tails, weighed by the month's own pace, spread by weekday for expenses and by
// day of the month for income (net worth forecast design, F4 to F8).
export function variableForecast({
  entries,
  month,
  today,
}: {
  entries: readonly ForecastEntry[];
  month: string;
  today: string;
}): VariableForecast {
  const dom = Number(today.slice(8, 10));
  const days = monthDays(month);
  const ahead = days.filter((date) => date > today);
  const history = historyOf(entries, month).map((m) =>
    figuresOf(entries, m, dom),
  );

  const income =
    quantile(
      history.map((m) => m.incomeRate),
      0.5,
    ) * ahead.length;
  const expenses =
    quantile(
      history.map((m) => m.expenseRate),
      0.5,
    ) * ahead.length;
  const pace = paceOf(entries, month, today, history);
  const forecastExpenses = expenses * (1 + (pace - 1) * (dom / days.length));

  const expenseShare = shares(ahead, weekdayWeights(history));
  const incomeShare = shares(ahead, dayWeights(history, days.length));

  return {
    history: history.length,
    days: ahead.map((date, i) => ({
      date,
      amount:
        income * (incomeShare[i] ?? 0) -
        forecastExpenses * (expenseShare[i] ?? 0),
    })),
    range: rangeOf(history, ahead.length, income - expenses),
  };
}

// The complete months before the current one, from the month of the earliest entry on.
function historyOf(entries: readonly ForecastEntry[], month: string): string[] {
  const first = entries.reduce(
    (min, entry) => (entry.date < min ? entry.date : min),
    `${month}-01`,
  );

  return Array.from({ length: historyMonths }, (_, i) =>
    shiftMonth(month, -(i + 1)),
  ).filter((m) => m >= first.slice(0, 7) && m < month);
}

function figuresOf(
  entries: readonly ForecastEntry[],
  month: string,
  dom: number,
): MonthFigures {
  const days = monthDays(month);
  const inMonth = entries.filter((entry) => entry.date.startsWith(month));
  const tailFrom = dom < days.length ? dom : 0;
  const tail = inMonth.filter((entry) => dayOf(entry.date) > tailFrom);
  const tailDays = days.length - tailFrom;

  return {
    incomeRate: sumOf(tail, "income") / tailDays,
    expenseRate: -sumOf(tail, "expense") / tailDays,
    netRate: tail.reduce((sum, entry) => sum + entry.amount, 0) / tailDays,
    expenseBefore: -sumOf(
      inMonth.filter((entry) => dayOf(entry.date) <= dom),
      "expense",
    ),
    dayMean: -sumOf(inMonth, "expense") / days.length,
    weekdayMeans: weekdayMeansOf(inMonth, days),
    incomeByDay: incomeByDayOf(inMonth),
  };
}

function paceOf(
  entries: readonly ForecastEntry[],
  month: string,
  today: string,
  history: readonly MonthFigures[],
): number {
  const before = quantile(
    history.map((m) => m.expenseBefore),
    0.5,
  );
  const spent = -sumOf(
    entries.filter(
      (entry) => entry.date.startsWith(month) && entry.date <= today,
    ),
    "expense",
  );

  if (before <= 0) return 1;

  return Math.min(paceBounds.high, Math.max(paceBounds.low, spent / before));
}

// Medians over the months, so one month's large purchase moves no weekday.
function weekdayWeights(
  history: readonly MonthFigures[],
): (date: string) => number {
  const mean = quantile(
    history.map((m) => m.dayMean),
    0.5,
  );
  const weights = Array.from({ length: 7 }, (_, w) =>
    mean <= 0
      ? 1
      : quantile(
          history.map((m) => m.weekdayMeans[w] ?? 0),
          0.5,
        ) / mean,
  );

  return (date) => weights[weekdayOf(date)] ?? 1;
}

// A day number past the current month's length counts on its last day.
function dayWeights(
  history: readonly MonthFigures[],
  length: number,
): (date: string) => number {
  const weights = new Map<number, number>();
  for (const m of history) {
    for (const [day, amount] of m.incomeByDay) {
      const at = Math.min(day, length);
      weights.set(at, (weights.get(at) ?? 0) + amount);
    }
  }

  return (date) => weights.get(dayOf(date)) ?? 0;
}

// Each date's share of the weights; equal shares when the weights sum to zero.
function shares(
  dates: readonly string[],
  weight: (date: string) => number,
): number[] {
  const weights = dates.map(weight);
  const total = weights.reduce((sum, w) => sum + w, 0);

  return total > 0
    ? weights.map((w) => w / total)
    : dates.map(() => 1 / dates.length);
}

function rangeOf(
  history: readonly MonthFigures[],
  ahead: number,
  expected: number,
): VariableForecast["range"] {
  if (history.length < minRangeMonths) return null;

  const rates = history.map((m) => m.netRate);

  return {
    lower: Math.min(0, quantile(rates, 0.25) * ahead - expected),
    upper: Math.max(0, quantile(rates, 0.75) * ahead - expected),
  };
}

function weekdayMeansOf(
  entries: readonly ForecastEntry[],
  days: readonly string[],
): number[] {
  return Array.from({ length: 7 }, (_, w) => {
    const count = days.filter((date) => weekdayOf(date) === w).length;
    const spent = -sumOf(
      entries.filter((entry) => weekdayOf(entry.date) === w),
      "expense",
    );

    return count === 0 ? 0 : spent / count;
  });
}

function incomeByDayOf(entries: readonly ForecastEntry[]): Map<number, number> {
  const byDay = new Map<number, number>();
  for (const entry of entries) {
    if (entry.kind !== "income") continue;

    const day = dayOf(entry.date);
    byDay.set(day, (byDay.get(day) ?? 0) + entry.amount);
  }

  return byDay;
}

function sumOf(
  entries: readonly ForecastEntry[],
  kind: ForecastEntry["kind"],
): number {
  return entries
    .filter((entry) => entry.kind === kind)
    .reduce((sum, entry) => sum + entry.amount, 0);
}

function dayOf(date: string): number {
  return Number(date.slice(8, 10));
}

function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}
