import { atypicalFence } from "@/features/forecast/atypical-fence";
import { quantile } from "@/features/forecast/quantile";
import { recurringSeries } from "@/features/forecast/recurring-series";
import type { RecurringEstimate } from "@/features/forecast/recurring-series";
import { monthDays, shiftMonth } from "@/features/overview";

export interface DatedAmount {
  date: string;
  // Minor units, signed by the effect on the forecast value.
  amount: number;
}

export interface ForecastEntry extends DatedAmount {
  kind: "income" | "expense";
  // The category account: the routine counts by category.
  category: string;
  // Joins the entries of one series (seriesKey).
  series: string;
  label: string;
}

export interface VariableForecast {
  // The history months the forecast read.
  history: number;
  // The routine amount of each day after today to the month's end; fractions of a minor unit stay.
  routine: DatedAmount[];
  recurring: RecurringEstimate[];
  // Offsets of the likely range over the remaining days, against the expected total; null below
  // three history months.
  range: { lower: number; upper: number } | null;
}

const historyMonths = 6;
const minRangeMonths = 3;
const minCategoryMonths = 2;
const paceBounds = { low: 0.5, high: 2 } as const;

// What the entries no schedule produced say about the rest of the month: the series that recur,
// then the routine, without the atypical amounts, at the median rate of each category over the
// history months and weighed by the month's own pace (net worth forecast design, F4 to F8).
export function variableForecast({
  entries,
  month,
  today,
}: {
  entries: readonly ForecastEntry[];
  month: string;
  today: string;
}): VariableForecast {
  const days = monthDays(month);
  const ahead = days.filter((date) => date > today);
  const history = historyOf(entries, month);
  const scoped = entries.filter(
    (entry) =>
      history.some((m) => entry.date.startsWith(m)) ||
      (entry.date.startsWith(month) && entry.date <= today),
  );

  const { estimates, matched } = recurringSeries({
    entries: scoped,
    history,
    month,
    today,
  });
  const routine = routineOf(
    scoped.filter((entry) => !matched.has(entry)),
    history,
  );

  const usual = usualRates(routine, history);
  const spent = -sumOf(
    routine.filter(
      (entry) =>
        entry.date.startsWith(month) && usual.counted.has(entry.category),
    ),
    "expense",
  );
  const dom = Number(today.slice(8, 10));
  const pace = paceOf(spent, usual.expense * dom);
  const expense = usual.expense * (1 + (pace - 1) * (dom / days.length));

  return {
    history: history.length,
    routine: ahead.map((date) => ({ date, amount: usual.income - expense })),
    recurring: estimates,
    range: rangeOf(
      history.map((m) => ratesOf(routine, m)),
      ahead.length,
    ),
  };
}

// The complete months before the current one, after the month of the earliest entry: the data
// can start on any day of its first month.
function historyOf(entries: readonly ForecastEntry[], month: string): string[] {
  const first = entries.reduce(
    (min, entry) => (entry.date < min ? entry.date : min),
    `${month}-01`,
  );

  return Array.from({ length: historyMonths }, (_, i) =>
    shiftMonth(month, i - historyMonths),
  ).filter((m) => m > first.slice(0, 7));
}

// The entries left once the atypical amounts are out. The fence of each kind comes from the
// history's purchases (or receipts); a refund passes it by its size, so the refund of an
// atypical purchase leaves with it.
function routineOf(
  entries: readonly ForecastEntry[],
  history: readonly string[],
): ForecastEntry[] {
  const inHistory = entries.filter((entry) =>
    history.some((m) => entry.date.startsWith(m)),
  );
  const fences = {
    expense: atypicalFence(
      inHistory
        .filter((entry) => entry.kind === "expense" && entry.amount < 0)
        .map((entry) => -entry.amount),
    ),
    income: atypicalFence(
      inHistory
        .filter((entry) => entry.kind === "income" && entry.amount > 0)
        .map((entry) => entry.amount),
    ),
  };

  return entries.filter((entry) => !fences[entry.kind](Math.abs(entry.amount)));
}

// The routine rate of a category is its median rate over the history months, a month without it
// counting as zero. A category in fewer than two history months (one, with one month) is left
// out: a purchase that did not repeat says nothing of this month.
function usualRates(
  routine: readonly ForecastEntry[],
  history: readonly string[],
): { income: number; expense: number; counted: Set<string> } {
  const sums = new Map<
    string,
    { kind: ForecastEntry["kind"]; months: Map<string, number> }
  >();

  for (const entry of routine) {
    const month = history.find((m) => entry.date.startsWith(m));

    if (month === undefined) continue;

    const category = sums.get(entry.category) ?? {
      kind: entry.kind,
      months: new Map<string, number>(),
    };
    category.months.set(
      month,
      (category.months.get(month) ?? 0) + entry.amount,
    );
    sums.set(entry.category, category);
  }

  const needed = Math.min(minCategoryMonths, history.length);
  const usual = { income: 0, expense: 0, counted: new Set<string>() };

  for (const [id, category] of sums) {
    if (category.months.size < needed) continue;

    const rate = quantile(
      history.map((m) => (category.months.get(m) ?? 0) / monthDays(m).length),
      0.5,
    );
    usual.counted.add(id);
    if (category.kind === "income") usual.income += rate;
    else usual.expense -= rate;
  }

  return usual;
}

function ratesOf(
  routine: readonly ForecastEntry[],
  month: string,
): { income: number; expense: number } {
  const inMonth = routine.filter((entry) => entry.date.startsWith(month));
  const length = monthDays(month).length;

  return {
    income: sumOf(inMonth, "income") / length,
    expense: -sumOf(inMonth, "expense") / length,
  };
}

function paceOf(spent: number, usual: number): number {
  if (usual <= 0) return 1;

  return Math.min(paceBounds.high, Math.max(paceBounds.low, spent / usual));
}

// The spread of the months' routine net rates around their medians.
function rangeOf(
  rates: readonly { income: number; expense: number }[],
  ahead: number,
): VariableForecast["range"] {
  if (rates.length < minRangeMonths) return null;

  const net = rates.map((r) => r.income - r.expense);
  const expected =
    quantile(
      rates.map((r) => r.income),
      0.5,
    ) -
    quantile(
      rates.map((r) => r.expense),
      0.5,
    );

  return {
    lower: Math.min(0, (quantile(net, 0.25) - expected) * ahead),
    upper: Math.max(0, (quantile(net, 0.75) - expected) * ahead),
  };
}

function sumOf(
  entries: readonly ForecastEntry[],
  kind: ForecastEntry["kind"],
): number {
  return entries
    .filter((entry) => entry.kind === kind)
    .reduce((sum, entry) => sum + entry.amount, 0);
}
