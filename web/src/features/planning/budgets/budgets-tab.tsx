import { Button } from "@slotted/react/button";
import {
  ResultState,
  ResultStateActions,
  ResultStateContent,
  ResultStateDescription,
  ResultStateTitle,
} from "@slotted/react/result-state";
import { Skeleton } from "@slotted/react/skeleton";
import {
  Section,
  SectionBody,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import { Text } from "@slotted/react/typography";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { accountsQuery } from "@/features/accounts";
import { categoryTotalsQuery, useCategoryEntries } from "@/features/categories";
import { monthEnd } from "@/features/planning/model/agenda";
import {
  budgetProgressQuery,
  budgetsQuery,
  committedQuery,
} from "@/features/planning/api";
import {
  budgetGroups,
  monthFigures,
  startsBy,
  unbudgeted,
} from "@/features/planning/model/budget-month";
import { BudgetAmountDialog } from "@/features/planning/budget-dialogs/budget-amount-dialog";
import { DeleteBudgetDialog } from "@/features/planning/budget-dialogs/delete-budget-dialog";
import { BudgetDetails } from "@/features/planning/budgets/budget-details";
import { BudgetSummary } from "@/features/planning/budgets/budget-summary";
import { BudgetTable } from "@/features/planning/budgets/budget-table";
import styles from "@/features/planning/budgets/budgets.module.css";
import {
  budgetStates,
  spendingSlices,
} from "@/features/planning/budgets/month-shares";
import { settingsQuery, useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { QueryError } from "@/ui/feedback/query-error";

type Budget = components["schemas"]["Budget"];

// The budgets of a month: one section with the month over every budget and one line per budget
// under its top category, then the spending no budget covers and where the spending went, closed.
export function BudgetsTab({
  month,
  onCreate,
}: {
  month: string;
  onCreate: () => void;
}) {
  const t = useT();
  const api = useApi();
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

  return (
    <>
      <div className={styles.layout}>
        <Section size="lg" ground="surface">
          <SectionHeader>
            <SectionTitle>
              <SectionHeading>{t("budget.title")}</SectionHeading>
            </SectionTitle>
          </SectionHeader>
          <SectionBody>
            <BudgetSummary
              figures={
                groups.length === 0 ? undefined : monthFigures(groups, currency)
              }
              states={budgetStates(groups)}
              committed={committed.data}
              month={month}
              scale={scale}
            />
            {groups.length === 0 && (
              <Text tone="muted">{t("budget.empty")}</Text>
            )}
            {groups.length > 0 && (
              <BudgetTable
                groups={groups}
                month={month}
                scale={scale}
                onChangeAmount={setEditing}
                onDelete={(budget, name) => {
                  setDeleting({ budget, name });
                }}
              />
            )}
          </SectionBody>
        </Section>

        <BudgetDetails
          loose={loose}
          slices={spendingSlices(groups, loose, t("budget.unbudgetedSlice"))}
          currency={currency}
          scale={scale}
          loading={totals.isPending}
        />
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
