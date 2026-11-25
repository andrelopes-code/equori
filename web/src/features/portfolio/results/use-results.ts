import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { returnQuery, returnSeriesQuery } from "@/features/portfolio/api";
import { periodProblem } from "@/features/portfolio/return/portfolio-period";
import {
  useReturnOptions,
  wholePortfolio,
} from "@/features/portfolio/return/use-return-options";
import {
  periodRange,
  seriesStep,
} from "@/features/portfolio/results/model/results-period";
import { useResultsSearch } from "@/features/portfolio/results/use-results-search";
import { useTrailingYear } from "@/features/portfolio/results/use-trailing-year";
import { settingsQuery } from "@/features/setup";
import { useToday } from "@/i18n/today";

// The reads of the results tab: the history (PR3, the whole history by month), the period at its
// step, which is the history itself while the period is the whole history, the 12 months to today
// (PR7) and the return of getReturn that feeds the method layer while the period holds at most
// 3,660 days (PR9).
export function useResults() {
  const api = useApi();
  const today = useToday();
  const [search] = useResultsSearch();
  const { options } = useReturnOptions();
  const base = useQuery(settingsQuery(api)).data?.base_currency;

  const valueIn = search.value_in ?? base;
  const selected =
    options.find((o) => o.value === search.account)?.value ?? options[0]?.value;
  const accountID = selected === wholePortfolio ? null : selected;
  const range =
    search.from !== undefined && search.to !== undefined
      ? { from: search.from, to: search.to > today ? today : search.to }
      : periodRange(search.period, today);
  const whole = range.from === undefined;

  const history = useQuery(
    returnSeriesQuery(api, accountID, undefined, today, "month", valueIn, true),
  );
  const asked = useQuery(
    returnSeriesQuery(
      api,
      accountID,
      range.from,
      range.to,
      seriesStep(range.from, range.to),
      valueIn,
      !whole,
    ),
  );
  const period = whole ? history : asked;
  const trailing = useTrailingYear(
    accountID,
    today,
    valueIn,
    history.data?.from,
  );

  const from = range.from ?? period.data?.from;
  const methodFrom = from ?? range.to;
  const report = useQuery(
    returnQuery(
      api,
      accountID,
      methodFrom,
      range.to,
      valueIn,
      from !== undefined && periodProblem(methodFrom, range.to) === undefined,
    ),
  );

  return { history, period, trailing, report, whole };
}
