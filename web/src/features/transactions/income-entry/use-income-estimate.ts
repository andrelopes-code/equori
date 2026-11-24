import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { incomeWithholdingQuery } from "@/features/transactions/api";

export interface IncomeEstimate {
  rateBp: number;
  // Minor units of the base currency.
  withheld: number;
}

// The tax the region withholds on an income, an estimate; null where it withholds none.
export function useIncomeEstimate(
  incomeType: string | null,
  date: string,
  gross: number,
): IncomeEstimate | null {
  const api = useApi();
  const estimate = useQuery({
    ...incomeWithholdingQuery(api, incomeType ?? "", date, gross),
    enabled: incomeType !== null && gross > 0,
  }).data;

  if (estimate === undefined || estimate.rate_bp === 0) return null;

  return { rateBp: estimate.rate_bp, withheld: estimate.withheld.amount };
}
