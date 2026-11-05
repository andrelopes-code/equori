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
  // What the day adds: its scheduled amount and its variable amount.
  scheduled: number;
  variable: number;
}

// The value from today to the month's end: today's value, then each day's scheduled and variable
// amounts. An amount the schedules date today is still to come and counts on the next day (net
// worth forecast design, F2, F3 and F8).
export function forecastDays({
  month,
  today,
  start,
  events,
  variable,
}: {
  month: string;
  today: string;
  start: number;
  events: readonly DatedAmount[];
  variable: VariableForecast;
}): ForecastPoint[] {
  const ahead = monthDays(month).filter((date) => date > today);
  const dueToday = sumOn(events, today);
  const range = variable.range;

  let scheduled = 0;
  let variableSum = 0;
  let previous = 0;

  const points = ahead.map((date, i): ForecastPoint => {
    const dayScheduled = sumOn(events, date) + (i === 0 ? dueToday : 0);
    variableSum += variable.days.find((day) => day.date === date)?.amount ?? 0;
    scheduled += dayScheduled;

    const exact = start + scheduled + variableSum;
    const rounded = Math.round(variableSum);
    const dayVariable = rounded - previous;
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
      variable: dayVariable,
    };
  });

  return [
    {
      date: today,
      value: start,
      ...(range === null ? {} : { low: start, high: start }),
      scheduled: 0,
      variable: 0,
    },
    ...points,
  ];
}

function sumOn(events: readonly DatedAmount[], date: string): number {
  return events
    .filter((event) => event.date === date)
    .reduce((sum, event) => sum + event.amount, 0);
}
