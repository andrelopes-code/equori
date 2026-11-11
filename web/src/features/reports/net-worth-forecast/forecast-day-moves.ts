import type { ForecastEvent } from "@/features/overview";
import { shiftDate } from "@/i18n/format";

export interface ForecastMove {
  description: string;
  // Minor units, signed by the effect on net worth.
  amount: number;
}

// What moves the forecast on a remaining day: each scheduled occurrence and recurring estimate of
// the day; an occurrence dated today or earlier counts on the day after today (net worth forecast
// design, F3, F9).
export function forecastDayMoves(
  events: readonly ForecastEvent[],
  date: string,
  today: string,
): ForecastMove[] {
  const first = shiftDate(today, 1);

  return events
    .filter((event) => (event.date > today ? event.date : first) === date)
    .map(({ description, amount }) => ({ description, amount }));
}
