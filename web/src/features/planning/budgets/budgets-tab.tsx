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
  SectionBleed,
  SectionBody,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import { Text } from "@slotted/react/typography";
import { useQueries, useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
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
  inForce,
  monthFigures,
  unbudgeted,
} from "@/features/planning/model/budget-month";
import { BudgetDetails } from "@/features/planning/budgets/budget-details";
import { BudgetRowDialogs } from "@/features/planning/budgets/budget-row-dialogs";
import { BudgetSummary } from "@/features/planning/budgets/budget-summary";
import { BudgetTable } from "@/features/planning/budgets/budget-table";
import styles from "@/features/planning/budgets/budgets.module.css";
import { useBudgetDialogs } from "@/features/planning/budgets/use-budget-dialogs";
import {
  budgetStates,
  spendingSlices,
} from "@/features/planning/budgets/month-shares";
import { settingsQuery, useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { QueryError } from "@/ui/feedback/query-error";

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
  const dialogs = useBudgetDialogs();
  const budgets = useQuery(budgetsQuery(api));
  const accounts = useQuery(accountsQuery(api));
  const settings = useQuery(settingsQuery(api));
  const entries = useCategoryEntries(accounts.data);
  const committed = useQuery(committedQuery(api, month));
  const totals = useQuery(
    categoryTotalsQuery(api, `${month}-01`, monthEnd(month), "expense"),
  );
  const shown = (budgets.data ?? []).filter((b) => inForce(b, month));
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
  const loose = unbudgeted(
    entries,
    budgets.data ?? [],
    totals.data ?? [],
    month,
  );

  return (
    <>
      <div className={styles.layout}>
        <Section size="lg" ground="surface" heading="title">
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
              <SectionBleed>
                <BudgetTable
                  groups={groups}
                  month={month}
                  scale={scale}
                  onChangeAmount={dialogs.changeAmount}
                  onEnd={dialogs.end}
                  onDelete={dialogs.remove}
                />
              </SectionBleed>
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

      <BudgetRowDialogs
        dialog={dialogs.dialog}
        month={month}
        onClose={dialogs.close}
      />
    </>
  );
}
