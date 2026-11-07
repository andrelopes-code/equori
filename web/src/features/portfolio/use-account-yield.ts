import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { returnQuery } from "@/features/portfolio/api";
import { useMeasuredTops } from "@/features/portfolio/use-measured-tops";
import { settingsQuery } from "@/features/setup";

// The return of an account over [from, to] in the base currency, with its comparison with the
// region's index; undefined while it loads, when the account is not measured (A208 R8) or when
// the request fails.
export function useAccountYield(accountId: string, from: string, to: string) {
  const api = useApi();
  const measured = useMeasuredTops().has(accountId);
  const base = useQuery(settingsQuery(api)).data?.base_currency;
  const report = useQuery(
    returnQuery(api, accountId, from, to, base, measured),
  );

  return measured ? report.data : undefined;
}
