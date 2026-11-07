import { useQueries, useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { categoryTotalsQuery } from "@/features/categories";
import { netWorthQuery } from "@/features/overview";
import {
  categoryRuns,
  classTotal,
  netWorthGrowth,
} from "@/features/reports/net-worth-growth";
import type { NetWorthGrowth } from "@/features/reports/net-worth-growth";
import type { ReportPeriod } from "@/features/reports/report-period";
import { settingsQuery } from "@/features/setup";
import { shiftDate } from "@/i18n/format";

const classes = ["income", "expense"] as const;

export interface NetWorthGrowthState {
  // Absent while the opening or the closing net worth is pending or failed.
  growth: NetWorthGrowth | undefined;
  pending: boolean;
  // The currency of the result (NP4); undefined while the settings load.
  base: string | undefined;
}

// NP3 and NP4: the change from the day before `from` to `closing`, and the result of the same
// days when the valuation currency is the base one.
export function useNetWorthGrowth(
  period: ReportPeriod,
  closing: string | undefined,
  valueIn: string,
): NetWorthGrowthState {
  const api = useApi();
  const base = useQuery(settingsQuery(api)).data?.base_currency;
  const opening = useQuery(
    netWorthQuery(api, shiftDate(period.from, -1), valueIn),
  );
  const last = useQuery({
    ...netWorthQuery(api, closing ?? "", valueIn),
    enabled: closing !== undefined,
  });
  const runs =
    closing === undefined || base !== valueIn
      ? []
      : categoryRuns(period.from, closing);
  const totals = useQueries({
    queries: runs.flatMap((run) =>
      classes.map((cls) => categoryTotalsQuery(api, run.from, run.to, cls)),
    ),
  });

  // Runs alternate income and expense, in the order of `classes`.
  const result =
    totals.length > 0 && totals.every((q) => q.data !== undefined)
      ? totals.reduce(
          (sum, q, i) => sum + (i % 2 === 0 ? 1 : -1) * classTotal(q.data),
          0,
        )
      : undefined;
  const growth =
    opening.data === undefined || last.data === undefined
      ? undefined
      : netWorthGrowth(opening.data.net.amount, last.data.net.amount, result);

  return {
    growth,
    pending:
      opening.isPending ||
      (closing !== undefined && last.isPending) ||
      totals.some((q) => q.isPending),
    base,
  };
}
