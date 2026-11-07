import {
  ResultState,
  ResultStateContent,
  ResultStateTitle,
} from "@slotted/react/result-state";
import { Stack } from "@slotted/react/stack";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { incomeEventsQuery } from "@/features/portfolio/api";
import { IncomeCharts } from "@/features/portfolio/income-charts";
import { IncomeEventsTable } from "@/features/portfolio/income-events-table";
import { incomeTaxRows } from "@/features/portfolio/year-figures";
import { YearFigureGrid } from "@/features/portfolio/year-figure-grid";
import { incomeTotals } from "@/features/portfolio/year-income";
import { YearTotalsTable } from "@/features/portfolio/year-totals-table";
import { catalogLabel, useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { QueryError } from "@/ui/query-error";

type Money = components["schemas"]["Money"];

// PC14: how much came in, when and from what, the lines of a tax return, then every payment. The
// treatment codes come from the user's jurisdiction: a treatment without a catalog key reads as
// its code, and no treatment reads as unclassified.
export function IncomeEventsTab({ year }: { year: number }) {
  const t = useT();
  const api = useApi();
  const fmt = useMoneyFormat();
  const scale = useScale();
  const events = useQuery(incomeEventsQuery(api, year));

  const pending = events.isPending || scale === null;
  const items = events.data?.items ?? [];
  const money = (m: Money) => fmt.money(m, scale?.(m.currency) ?? 0);
  const list = (amounts: readonly Money[]) => amounts.map(money).join(" · ");
  const totals = incomeTotals(items);
  const treatmentLabel = (code: string | null) =>
    code === null
      ? t("taxYear.unclassified")
      : catalogLabel(t, `taxYear.treatment.${code}`, code);

  if (events.isError)
    return (
      <QueryError error={events.error} onRetry={() => void events.refetch()} />
    );

  if (!pending && items.length === 0)
    return (
      <ResultState status="empty" reach="section">
        <ResultStateContent>
          <ResultStateTitle>{t("taxYear.income.empty")}</ResultStateTitle>
        </ResultStateContent>
      </ResultState>
    );

  return (
    <Stack gap={6}>
      {!pending && (
        <YearFigureGrid
          label={t("taxYear.tab.income")}
          figures={[
            {
              label: t("holdings.income.net"),
              value: list(totals.net),
              note: t("holdings.income.net.note"),
            },
            {
              label: t("holdings.income.withheld"),
              value: list(totals.withheld),
              note: t("holdings.income.withheld.note"),
            },
            {
              label: t("holdings.income.gross"),
              value: list(totals.gross),
              note: t("holdings.income.gross.note"),
            },
          ]}
        />
      )}

      {!pending && (
        <IncomeCharts
          items={items}
          from={events.data.from}
          to={events.data.to}
        />
      )}

      {!pending && (
        <YearTotalsTable
          caption={t("holdings.tax")}
          headers={[
            t("holdings.tax.group"),
            t("taxYear.gross"),
            t("taxYear.withheld"),
            t("taxYear.net"),
          ]}
          rows={incomeTaxRows(items).map((row) => ({
            key: `${row.type}-${row.treatment ?? ""}-${row.gross.currency}`,
            cells: [
              [
                catalogLabel(t, `income.type.${row.type}`, row.type),
                treatmentLabel(row.treatment),
              ].join(" · "),
              money(row.gross),
              money(row.withheld),
              money(row.net),
            ],
          }))}
        />
      )}

      <IncomeEventsTable items={items} pending={pending} />
    </Stack>
  );
}
