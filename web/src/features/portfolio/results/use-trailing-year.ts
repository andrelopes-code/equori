import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { returnSeriesQuery } from "@/features/portfolio/api";
import { periodRange } from "@/features/portfolio/results/model/results-period";

// The 12 months to today (PR7), read only when the history covers them. A month step asks for the
// fewest valuations, and the last return of a series is the same at every step (PS3).
export function useTrailingYear(
  accountID: string | null | undefined,
  today: string,
  valueIn: string | undefined,
  historyFrom: string | undefined,
) {
  const api = useApi();
  const { from = today } = periodRange("12m", today);

  return useQuery(
    returnSeriesQuery(
      api,
      accountID,
      from,
      today,
      "month",
      valueIn,
      historyFrom !== undefined && historyFrom <= from,
    ),
  );
}
