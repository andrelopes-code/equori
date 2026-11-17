import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { pricesQuery } from "@/features/instruments";
import { shiftDate } from "@/i18n/format";

// How far back the form looks for a price: a feed skips weekends and holidays, never a month.
const windowDays = 30;

// The latest stored price of a currency in the base currency on or before a date. Absent while it
// loads, when none is stored in the window and when no currency is asked.
export function useStoredPrice(
  currency: string | null,
  baseCurrency: string,
  date: string,
) {
  const api = useApi();
  const prices = useQuery({
    ...pricesQuery(
      api,
      currency ?? "",
      baseCurrency,
      shiftDate(date, -windowDays),
      date,
    ),
    enabled: currency !== null,
  });

  return { price: prices.data?.at(-1), loaded: prices.isFetched };
}
