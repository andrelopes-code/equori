import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { quoteWarningsQuery } from "@/features/accounts";

// The holdings with a late or missing quote. The key is the one of the positions list, so the
// page notice and the notices below it share one request.
export function useQuoteWarnings(
  date: string | undefined,
  valueIn: string | undefined,
) {
  const api = useApi();

  return useQuery({
    ...quoteWarningsQuery(api, date ?? "", valueIn),
    enabled: date !== undefined && valueIn !== undefined,
  }).data;
}
