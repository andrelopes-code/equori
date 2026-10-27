import { ProgressBar } from "@slotted/react/progress-indicator";
import { useQueries, useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { accountsQuery } from "@/features/accounts";
import { budgetAlerts } from "@/features/overview/budget-alerts";
import {
  OverviewBlock,
  type Placement,
} from "@/features/overview/overview-block";
import { OverviewRows } from "@/features/overview/overview-rows";
import {
  budgetProgressQuery,
  budgetsQuery,
  startsBy,
} from "@/features/planning";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMediaQuery, wideQuery } from "@/ui/use-media-query";

// The budgets of the month that are over their amount or at 90 % of it, the state the
// budgets tab of Planning draws.
export function BudgetsBlock({
  month,
  ...placement
}: { month: string } & Placement) {
  const t = useT();
  const api = useApi();
  const [locale] = useAppLocale();
  const wide = useMediaQuery(wideQuery);
  const budgets = useQuery(budgetsQuery(api));
  const accounts = useQuery(accountsQuery(api));
  const active = (budgets.data ?? []).filter((budget) =>
    startsBy(budget, month),
  );
  const progress = useQueries({
    queries: active.map((budget) => budgetProgressQuery(api, budget.id, month)),
  });
  const error =
    budgets.error ??
    accounts.error ??
    progress.find((query) => query.error !== null)?.error ??
    null;
  const loading =
    budgets.data === undefined ||
    accounts.data === undefined ||
    progress.some((query) => query.data === undefined);
  const percent = new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 0,
  });
  const names = new Map(
    (accounts.data ?? []).map((account) => [account.id, account.name]),
  );
  const rows =
    loading || error !== null
      ? []
      : budgetAlerts(
          active.flatMap((budget, i) => {
            const data = progress[i]?.data;
            return data === undefined
              ? []
              : [
                  {
                    id: budget.id,
                    name: names.get(budget.category_id) ?? "",
                    progress: data,
                  },
                ];
          }),
        ).map((alert) => ({
          key: alert.id,
          title: alert.name,
          line: (
            <>
              {t(
                alert.state === "over"
                  ? "overview.budgets.over"
                  : "overview.budgets.near",
              )}
              {wide && (
                <ProgressBar
                  size="sm"
                  hideLabel
                  label={alert.name}
                  value={Math.min(alert.share, 100)}
                  tone={alert.state === "over" ? "danger" : "warning"}
                />
              )}
            </>
          ),
          end: percent.format(alert.share / 100),
        }));
  return (
    <OverviewBlock
      placement={placement}
      link={{
        label: t("overview.budgets.open"),
        options: { to: "/planning", search: { tab: "budgets" } },
      }}
      loading={loading && error === null}
      error={error}
      onRetry={() => {
        if (budgets.isError) void budgets.refetch();
        if (accounts.isError) void accounts.refetch();
        for (const query of progress) {
          if (query.isError) void query.refetch();
        }
      }}
      empty={rows.length === 0 ? t("overview.budgets.empty") : undefined}
    >
      <OverviewRows label={t("overview.budgets.title")} rows={rows} />
    </OverviewBlock>
  );
}
