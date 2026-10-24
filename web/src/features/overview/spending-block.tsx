import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { accountsQuery } from "@/features/accounts";
import { categoryTotalsQuery } from "@/features/categories";
import { monthEnd } from "@/features/overview/forecast";
import { OverviewBlock } from "@/features/overview/overview-block";
import { OverviewRows } from "@/features/overview/overview-rows";
import { topCategories } from "@/features/overview/top-categories";
import { useBase } from "@/features/overview/use-base";
import { formatMonthName } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { MoneyFigure } from "@/ui/money-figure";

// The five categories that took the most of the month.
export function SpendingBlock({ month }: { month: string }) {
  const t = useT();
  const api = useApi();
  const [locale] = useAppLocale();
  const { base, scale, error: baseError, retry: retryBase } = useBase();
  const totals = useQuery(
    categoryTotalsQuery(api, `${month}-01`, monthEnd(month), "expense"),
  );
  const accounts = useQuery(accountsQuery(api));
  const error = baseError ?? totals.error ?? accounts.error;
  const loading =
    totals.data === undefined ||
    accounts.data === undefined ||
    base === undefined ||
    scale === null;
  const rows =
    loading || error !== null
      ? []
      : topCategories(
          totals.data,
          new Map(accounts.data.map((account) => [account.id, account.name])),
        );
  return (
    <OverviewBlock
      title={t("overview.spending.title")}
      link={{
        label: t("overview.spending.open"),
        options: { to: "/categories" },
      }}
      loading={loading && error === null}
      error={error}
      onRetry={() => {
        retryBase();
        if (totals.isError) void totals.refetch();
        if (accounts.isError) void accounts.refetch();
      }}
      empty={
        rows.length === 0
          ? t("overview.spending.empty", {
              month: formatMonthName(month, locale).toLocaleLowerCase(locale),
            })
          : undefined
      }
    >
      <OverviewRows
        label={t("overview.spending.title")}
        rows={rows.map((row) => ({
          key: row.id,
          title: row.name,
          end:
            base === undefined || scale === null ? undefined : (
              <MoneyFigure
                amount={row.amount}
                currency={base}
                scale={scale(base)}
              />
            ),
        }))}
      />
    </OverviewBlock>
  );
}
