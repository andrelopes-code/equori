import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { incomeEventsQuery } from "@/features/portfolio/api";
import { incomeTotals } from "@/features/portfolio/year-income";

// PC24: the income of the tax year that holds a date, up to that date. A jurisdiction's tax year
// need not start in January, so a date before the start of its calendar year's tax year belongs to
// the year before; only the response knows the range.
export function usePortfolioIncome(date: string) {
  const api = useApi();
  const calendarYear = Number(date.slice(0, 4));
  const current = useQuery(incomeEventsQuery(api, calendarYear));
  const earlier = current.data !== undefined && current.data.from > date;
  const previous = useQuery({
    ...incomeEventsQuery(api, calendarYear - 1),
    enabled: earlier,
  });
  const income = earlier ? previous : current;

  return {
    year: earlier ? calendarYear - 1 : calendarYear,
    totals: incomeTotals(income.data?.items ?? [], date),
    pending: current.isPending || income.isPending,
  };
}
