import { Grid } from "@slotted/react/grid";
import {
  ResultState,
  ResultStateContent,
  ResultStateTitle,
} from "@slotted/react/result-state";
import { Stack } from "@slotted/react/stack";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { realizedResultsQuery } from "@/features/portfolio/api";
import { SalesTable } from "@/features/portfolio/sales-table";
import { salesTotals } from "@/features/portfolio/year-figures";
import { YearFigureGrid } from "@/features/portfolio/year-figure-grid";
import { totalsBy } from "@/features/portfolio/year-totals";
import { YearTotalsTable } from "@/features/portfolio/year-totals-table";
import { catalogLabel, useScale } from "@/features/setup";
import { formatMonthName, numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { QueryError } from "@/ui/query-error";

type Money = components["schemas"]["Money"];

// PC15: the result of the year, the months and classes that made it, then every sale. The amount
// sold per month stands beside its result: a jurisdiction's monthly limit reads against it, and
// no limit is computed here.
export function RealizedResultsTab({ year }: { year: number }) {
  const t = useT();
  const [tag] = useAppLocale();
  const api = useApi();
  const fmt = useMoneyFormat();
  const scale = useScale();
  const results = useQuery(realizedResultsQuery(api, year));

  const pending = results.isPending || scale === null;
  const items = results.data?.items ?? [];
  const money = (m: Money) => fmt.money(m, scale?.(m.currency) ?? 0);
  const signed = (m: Money) => fmt.signed(m, scale?.(m.currency) ?? 0);
  const totals = salesTotals(items);
  const byMonth = totalsBy(
    items,
    (r) => r.month,
    (r) => r.result,
  );
  const soldByMonth = totalsBy(
    items,
    (r) => r.month,
    (r) => r.proceeds,
  );
  const byClass = totalsBy(
    items,
    (r) => r.tax_class ?? "",
    (r) => r.result,
  );

  if (results.isError)
    return (
      <QueryError
        error={results.error}
        onRetry={() => void results.refetch()}
      />
    );

  if (!pending && items.length === 0)
    return (
      <ResultState status="empty" reach="section">
        <ResultStateContent>
          <ResultStateTitle>{t("taxYear.realized.empty")}</ResultStateTitle>
        </ResultStateContent>
      </ResultState>
    );

  return (
    <Stack gap={6}>
      {!pending && (
        <YearFigureGrid
          label={t("taxYear.tab.realized")}
          figures={[
            {
              label: t("holdings.sales.result"),
              value: totals.result.map(signed).join(" · "),
              note: t("holdings.sales.result.note"),
            },
            {
              label: t("holdings.sales.sold"),
              value: totals.sold.map(money).join(" · "),
              note: t("holdings.sales.sold.note"),
            },
            {
              label: t("holdings.sales.count"),
              value: numberFormatter(tag).format(totals.count),
              note: t("holdings.sales.count.note", {
                months: numberFormatter(tag).format(totals.months),
              }),
            },
          ]}
        />
      )}

      {!pending && (
        <Grid minItemWidth="md" gap={4}>
          <YearTotalsTable
            caption={t("taxYear.totals.month")}
            headers={[
              t("taxYear.month"),
              t("holdings.sales.monthSold"),
              t("taxYear.result"),
            ]}
            rows={byMonth.map((row, i) => ({
              key: `${row.key}-${row.currency}`,
              cells: [
                formatMonthName(row.key, tag),
                money({
                  amount: soldByMonth[i]?.amount ?? 0,
                  currency: row.currency,
                }),
                signed({ amount: row.amount, currency: row.currency }),
              ],
            }))}
          />
          <YearTotalsTable
            caption={t("taxYear.totals.class")}
            headers={[t("taxYear.taxClass"), t("taxYear.result")]}
            rows={byClass.map((row) => ({
              key: `${row.key}-${row.currency}`,
              cells: [
                row.key === ""
                  ? t("taxYear.unclassified")
                  : catalogLabel(t, `taxYear.class.${row.key}`, row.key),
                signed({ amount: row.amount, currency: row.currency }),
              ],
            }))}
          />
        </Grid>
      )}

      <SalesTable items={items} pending={pending} />
    </Stack>
  );
}
