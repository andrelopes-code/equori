import { useQueries, useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { accountsQuery } from "@/features/accounts";
import { CategoryMark, categoryEntries } from "@/features/categories";
import { budgetAlerts } from "@/features/overview/budget-alerts";
import { MeterHead } from "@/features/overview/meter-head";
import { MeterLine } from "@/features/overview/meter-line";
import {
  OverviewBlock,
  type Placement,
} from "@/features/overview/overview-block";
import { OverviewRows } from "@/features/overview/overview-rows";
import { useBase } from "@/features/overview/use-base";
import {
  budgetProgressQuery,
  budgetsQuery,
  startsBy,
} from "@/features/planning";
import type { Figures } from "@/features/planning";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

// The budgets of the month that are over their amount or at 90 % of it, the state the
// budgets tab of Planning draws.
export function BudgetsBlock({
  month,
  ...placement
}: { month: string } & Placement) {
  const t = useT();
  const api = useApi();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const { scale } = useBase();
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
    scale === null ||
    budgets.data === undefined ||
    accounts.data === undefined ||
    progress.some((query) => query.data === undefined);
  const percent = numberFormatter(locale, {
    style: "percent",
    maximumFractionDigits: 0,
  });
  const entries = new Map(
    categoryEntries(accounts.data ?? [], locale).map((entry) => [
      entry.id,
      entry,
    ]),
  );
  const figures = new Map<string, Figures>();
  const money = (m: Figures["spent"]) =>
    fmt.money(m, scale === null ? 0 : scale(m.currency));
  const rows =
    loading || error !== null
      ? []
      : budgetAlerts(
          active.flatMap((budget, i) => {
            const data = progress[i]?.data;
            if (data === undefined) return [];
            figures.set(budget.id, data);
            return [
              {
                id: budget.id,
                name: entries.get(budget.category_id)?.name ?? "",
                progress: data,
              },
            ];
          }),
        ).flatMap((alert) => {
          const p = figures.get(alert.id);
          const budget = active.find((b) => b.id === alert.id);
          if (p === undefined || budget === undefined) return [];
          const entry = entries.get(budget.category_id);
          const over = alert.state === "over";
          const tone = over ? "danger" : "warning";
          const share = percent.format(alert.share / 100);
          return [
            {
              key: alert.id,
              to: {
                to: "/planning/budgets/$id" as const,
                params: { id: alert.id },
                search: { month },
              },
              start: (
                <CategoryMark
                  name={alert.name}
                  color={entry?.color}
                  icon={entry?.icon}
                />
              ),
              title: <MeterHead name={alert.name} share={share} tone={tone} />,
              line: (
                <MeterLine
                  label={alert.name}
                  basisPoints={alert.share * 100}
                  share={share}
                  tone={tone}
                  amounts={t("overview.budgets.of", {
                    spent: money(p.spent),
                    planned: money({
                      ...p.planned,
                      amount: p.planned.amount + p.carried.amount,
                    }),
                  })}
                  status={
                    over
                      ? t("budget.over", {
                          amount: money({
                            ...p.available,
                            amount: -p.available.amount,
                          }),
                        })
                      : t("budget.left", { amount: money(p.available) })
                  }
                  statusTone={tone}
                />
              ),
            },
          ];
        });
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
