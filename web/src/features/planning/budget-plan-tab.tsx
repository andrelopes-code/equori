import { Skeleton } from "@slotted/react/skeleton";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { accountsQuery } from "@/features/accounts";
import { useCategoryEntries } from "@/features/categories";
import { budgetPlanQuery } from "@/features/planning/api";
import styles from "@/features/planning/budget-plan.module.css";
import { PlanEditor } from "@/features/planning/plan-editor";
import { useScale } from "@/features/setup";
import { QueryError } from "@/ui/query-error";

type BudgetPlan = components["schemas"]["BudgetPlan"];

// The Plan view of the budgets tab: the month's plan once its categories and currency scale
// are known. A user with no budget and no history starts from the top-level expense
// categories at zero (spec 5.3).
export function BudgetPlanTab({ month }: { month: string }) {
  const api = useApi();
  const plan = useQuery(budgetPlanQuery(api, month));
  const accounts = useQuery(accountsQuery(api));
  const entries = useCategoryEntries(accounts.data);
  const scale = useScale();
  const failed = [plan, accounts].find((q) => q.isError);
  if (failed?.error)
    return (
      <QueryError error={failed.error} onRetry={() => void failed.refetch()} />
    );
  if (plan.data === undefined || accounts.data === undefined || scale === null)
    return (
      <div className={styles.editor} aria-busy="true">
        <Skeleton shape="block" blockSize="14rem" />
        <Skeleton shape="block" blockSize="20rem" />
      </div>
    );
  const noHistory = plan.data.rows.length === 0;
  const shown: BudgetPlan = noHistory
    ? {
        ...plan.data,
        rows: entries
          .filter(
            (e) =>
              e.class === "expense" &&
              e.parentId === undefined &&
              !e.archived &&
              !e.uncategorized,
          )
          .map((e) => ({
            category_id: e.id,
            planned: { amount: 0, currency: plan.data.currency },
            last_month: { amount: 0, currency: plan.data.currency },
            average: { amount: 0, currency: plan.data.currency },
            counted: true,
          })),
      }
    : plan.data;
  return (
    <PlanEditor
      key={month}
      plan={shown}
      entries={entries}
      scale={scale(plan.data.currency)}
      month={month}
      noHistory={noHistory}
    />
  );
}
