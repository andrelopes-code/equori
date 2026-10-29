import { Button } from "@slotted/react/button";
import { Grid } from "@slotted/react/grid";
import { Inline } from "@slotted/react/inline";
import {
  ResultState,
  ResultStateActions,
  ResultStateContent,
  ResultStateDescription,
  ResultStateTitle,
} from "@slotted/react/result-state";
import { Skeleton } from "@slotted/react/skeleton";
import { Heading, Text } from "@slotted/react/typography";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { accountsQuery } from "@/features/accounts";
import { categoryTotalsQuery, useCategoryEntries } from "@/features/categories";
import { monthEnd } from "@/features/planning/agenda";
import {
  budgetProgressQuery,
  budgetsQuery,
  committedQuery,
} from "@/features/planning/api";
import { BudgetCard } from "@/features/planning/budget-card";
import {
  budgetGroups,
  budgetState,
  monthFigures,
  startsBy,
  unbudgeted,
} from "@/features/planning/budget-month";
import type { BudgetState } from "@/features/planning/budget-month";
import { BudgetAmountDialog } from "@/features/planning/budget-amount-dialog";
import { DeleteBudgetDialog } from "@/features/planning/delete-budget-dialog";
import { BudgetSpendingChart } from "@/features/planning/budget-spending-chart";
import { BudgetSummary } from "@/features/planning/budget-summary";
import styles from "@/features/planning/budgets.module.css";
import { UnbudgetedList } from "@/features/planning/unbudgeted-list";
import { settingsQuery, useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { QueryError } from "@/ui/query-error";

type Budget = components["schemas"]["Budget"];

// The budgets of a month: the month over every budget and where its spending went, one card per
// budget under its top category, and the spending no budget covers.
export function BudgetsTab({
  month,
  onCreate,
}: {
  month: string;
  onCreate: () => void;
}) {
  const t = useT();
  const api = useApi();
  const today = useToday();
  const fmt = useMoneyFormat();
  const scale = useScale();
  const [editing, setEditing] = useState<Budget | null>(null);
  const [deleting, setDeleting] = useState<{
    budget: Budget;
    name: string;
  } | null>(null);
  const budgets = useQuery(budgetsQuery(api));
  const accounts = useQuery(accountsQuery(api));
  const settings = useQuery(settingsQuery(api));
  const entries = useCategoryEntries(accounts.data);
  const committed = useQuery(committedQuery(api, month));
  const totals = useQuery(
    categoryTotalsQuery(api, `${month}-01`, monthEnd(month), "expense"),
  );
  const shown = (budgets.data ?? []).filter((b) => startsBy(b, month));
  const progress = useQueries({
    queries: shown.map((b) => budgetProgressQuery(api, b.id, month)),
  });
  const byBudget = new Map(
    progress.flatMap((p, i) => {
      const id = shown[i]?.id;
      return p.data === undefined || id === undefined ? [] : [[id, p.data]];
    }),
  );
  const failed = [budgets, totals, ...progress].find((q) => q.isError);
  if (failed?.error)
    return (
      <QueryError error={failed.error} onRetry={() => void failed.refetch()} />
    );
  if (budgets.data?.length === 0)
    return (
      <ResultState status="empty" reach="section">
        <ResultStateContent>
          <ResultStateTitle>{t("budget.none")}</ResultStateTitle>
          <ResultStateDescription>
            {t("budget.noneHint")}
          </ResultStateDescription>
        </ResultStateContent>
        <ResultStateActions>
          <Button onClick={onCreate}>{t("budget.new")}</Button>
        </ResultStateActions>
      </ResultState>
    );
  const currency = settings.data?.base_currency;
  if (
    budgets.isPending ||
    accounts.isPending ||
    progress.some((p) => p.isPending) ||
    scale === null ||
    currency === undefined
  )
    return (
      <div className={styles.layout} aria-busy="true">
        <Skeleton shape="block" blockSize="16rem" />
        <Skeleton shape="block" blockSize="16rem" />
      </div>
    );
  const groups = budgetGroups(entries, shown, byBudget);
  const loose = unbudgeted(entries, budgets.data ?? [], totals.data ?? []);
  const states: Record<BudgetState, number> = { over: 0, near: 0, within: 0 };
  for (const g of groups)
    for (const r of g.rows) states[budgetState(r.progress)] += 1;
  const days = Number(monthEnd(month).slice(8, 10));
  const elapsed =
    today.slice(0, 7) === month
      ? { day: Number(today.slice(8, 10)), days }
      : undefined;
  const money = (amount: number) =>
    fmt.money({ amount, currency }, scale(currency));
  const slices = [
    ...groups.map((g) => ({
      name: g.root.name,
      spent: g.subtotal.spent.amount,
    })),
    {
      name: t("budget.unbudgetedSlice"),
      spent: loose.reduce((sum, r) => sum + r.total.amount, 0),
    },
  ];
  return (
    <>
      <div className={styles.layout}>
        <div className={styles.overview}>
          <BudgetSummary
            figures={
              groups.length === 0 ? undefined : monthFigures(groups, currency)
            }
            states={states}
            committed={committed.data}
            elapsed={elapsed}
            scale={scale}
          />
          <BudgetSpendingChart
            slices={slices}
            currency={currency}
            scale={scale(currency)}
            loading={totals.isPending}
          />
        </div>
        <div className={styles.groups}>
          {groups.length === 0 && <Text tone="muted">{t("budget.empty")}</Text>}
          {groups.map((group) => {
            const cards = group.rows.map((row) => (
              <BudgetCard
                key={row.budget.id}
                row={row}
                month={month}
                scale={scale}
                onChangeAmount={setEditing}
                onDelete={(budget, name) => {
                  setDeleting({ budget, name });
                }}
              />
            ));
            return (
              <section
                key={group.root.id}
                aria-label={group.root.name}
                className={styles.group}
              >
                <Inline gap={3} justify="between" wrap="wrap">
                  <Heading level={3} size="sm">
                    {group.root.name}
                  </Heading>
                  <Text size="sm" tone="muted" numeric="tabular">
                    {t("budget.groupTotal", {
                      spent: money(group.subtotal.spent.amount),
                      room: money(
                        group.subtotal.planned.amount +
                          group.subtotal.carried.amount,
                      ),
                    })}
                  </Text>
                </Inline>
                <Grid columns={4} gap={3} minItemWidth="md" align="stretch">
                  {cards}
                </Grid>
              </section>
            );
          })}
        </div>
        <UnbudgetedList rows={loose} scale={scale} />
      </div>
      {deleting !== null && (
        <DeleteBudgetDialog
          budget={deleting.budget}
          name={deleting.name}
          onDone={() => {
            setDeleting(null);
          }}
          onCancel={() => {
            setDeleting(null);
          }}
        />
      )}
      {editing !== null && (
        <BudgetAmountDialog
          budget={editing}
          onDone={() => {
            setEditing(null);
          }}
          onCancel={() => {
            setEditing(null);
          }}
        />
      )}
    </>
  );
}
