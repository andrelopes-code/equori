import type {
  DatedAmount,
  VariableForecast,
} from "@/features/forecast/variable-forecast";
import { monthDays } from "@/features/overview";

export interface ForecastPoint {
  date: string;
  // Minor units: the forecast value at the end of the day.
  value: number;
  // The likely range, when the variable forecast states one.
  low?: number;
  high?: number;
  // What the day adds: its scheduled, recurring and routine amounts.
  scheduled: number;
  recurring: number;
  variable: number;
}

// The value from today to the month's end: today's value, then each day's scheduled, recurring
// and routine amounts. An amount the schedules date today is still to come and counts on the
// next day (net worth forecast design, F2, F3 and F8).
export function forecastDays({
  month,
  today,
  start,
  scheduled,
  variable,
}: {
  month: string;
  today: string;
  start: number;
  scheduled: readonly DatedAmount[];
  variable: VariableForecast;
}): ForecastPoint[] {
  const ahead = monthDays(month).filter((date) => date > today);
  const dueToday = sumOn(scheduled, today);
  const range = variable.range;

  let fixed = 0;
  let routine = 0;
  let previous = 0;

  const points = ahead.map((date, i): ForecastPoint => {
    const dayScheduled = sumOn(scheduled, date) + (i === 0 ? dueToday : 0);
    const dayRecurring = sumOn(variable.recurring, date);
    fixed += dayScheduled + dayRecurring;
    routine += sumOn(variable.routine, date);

    const exact = start + fixed + routine;
    const rounded = Math.round(routine);
    const dayRoutine = rounded - previous;
    previous = rounded;
    const share = (i + 1) / ahead.length;

    return {
      date,
      value: Math.round(exact),
      ...(range === null
        ? {}
        : {
            low: Math.round(exact + range.lower * share),
            high: Math.round(exact + range.upper * share),
          }),
      scheduled: dayScheduled,
      recurring: dayRecurring,
      variable: dayRoutine,
    };
  });

  return [
    {
      date: today,
      value: start,
      ...(range === null ? {} : { low: start, high: start }),
      scheduled: 0,
      recurring: 0,
      variable: 0,
    },
    ...points,
  ];
}

function sumOn(amounts: readonly DatedAmount[], date: string): number {
  return amounts
    .filter((amount) => amount.date === date)
    .reduce((sum, amount) => sum + amount.amount, 0);
}
