import { Chart } from "@slotted/react/chart";
import type { ChartSeries } from "@slotted/core/chart";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { seriesQuery } from "@/features/accounts/api";
import { historyStart } from "@/features/accounts/kind-figures/history-start";
import { formatDateShortYear } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Account = components["schemas"]["Account"];

interface HistoryChartProps {
  account: Account;
  scale: number;
}

// K8: the whole life of a property or a loan as a step line on an axis that holds zero, so a
// revaluation of a few percent reads as a step and not as a fall. A loan draws its debt.
export function HistoryChart({ account, scale }: HistoryChartProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const api = useApi();
  const today = useToday();
  const from = historyStart(account.opened_on, today);
  const series = useQuery(seriesQuery(api, account.id, from, today));

  const loan = account.kind === "loan";
  const sign = loan ? -1 : 1;
  const data = useMemo(
    () =>
      (series.data?.items ?? []).map((p) => ({
        label: formatDateShortYear(p.date, locale),
        value: sign * p.balance.amount,
      })),
    [series.data, locale, sign],
  );
  const money = (value: number) =>
    fmt.money({ amount: value, currency: account.currency }, scale);
  const lines: ChartSeries<"label" | "value">[] = [
    {
      id: "value",
      kind: "line",
      field: "value",
      curve: "step",
      label: t(loan ? "loan.chart.debt" : "property.chart.value"),
      format: money,
    },
  ];

  return (
    <Chart
      variant="card"
      size="sm"
      loading={series.isPending}
      error={series.isError}
      title={t(loan ? "loan.chart" : "property.chart")}
      legend={false}
      data={data}
      series={lines}
      x={{ field: "label" }}
      y={{ format: money, extent: "zero" }}
    />
  );
}
