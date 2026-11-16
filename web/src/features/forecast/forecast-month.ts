import { forecastDays } from "@/features/forecast/forecast-days";
import type { ForecastPoint } from "@/features/forecast/forecast-days";
import type { RecurringEstimate } from "@/features/forecast/recurring-series";
import { variableForecast } from "@/features/forecast/variable-forecast";
import type { ForecastEntry } from "@/features/forecast/variable-forecast";
import { monthEnd } from "@/features/overview";
import type { ForecastEvent } from "@/features/overview";

export interface MonthForecast {
  // The history months the forecast read.
  history: number;
  points: ForecastPoint[];
  // The scheduled occurrences the month counts.
  events: ForecastEvent[];
  recurring: RecurringEstimate[];
}

// The forecast of the current month, or of the month after it: that one starts on the last day of
// the current month with the value of the current forecast and adds its own (net worth forecast
// design, F2, F13 to F17). `start` is the net worth of today.
export function forecastMonth({
  entries,
  events,
  month,
  today,
  start,
}: {
  entries: readonly ForecastEntry[];
  events: readonly ForecastEvent[];
  month: string;
  today: string;
  start: number;
}): MonthForecast {
  const current = today.slice(0, 7);
  const end = monthEnd(current);
  const own = events.filter((event) => event.date <= end);
  const variable = variableForecast({ entries, month: current, today });
  const points = forecastDays({
    month: current,
    today,
    start,
    scheduled: own,
    variable,
  });

  if (month === current) {
    return {
      history: variable.history,
      points,
      events: own,
      recurring: variable.recurring,
    };
  }

  // An occurrence dated on the last day, when that is today, counts on the next month's first day.
  const next = events.filter(
    (event) => event.date > end || (today === end && event.date === end),
  );
  const last = points.at(-1);
  const ahead = variableForecast({ entries, month, today: end });
  const chained = forecastDays({
    month,
    today: end,
    start: last?.value ?? start,
    startRange:
      last?.low === undefined || last.high === undefined
        ? undefined
        : { low: last.low, high: last.high },
    scheduled: next,
    variable: ahead,
  });

  return {
    history: ahead.history,
    points: chained.slice(1),
    events: next,
    recurring: ahead.recurring,
  };
}
