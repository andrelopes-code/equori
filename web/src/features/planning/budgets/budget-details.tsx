import { Accordion } from "@slotted/react/accordion";
import {
  Collapsible,
  CollapsibleHeader,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@slotted/react/collapsible";

import type { components } from "@/api/schema.gen";
import type { CategoryEntry } from "@/features/categories";
import { BudgetSpendingChart } from "@/features/planning/budgets/budget-spending-chart";
import type { SpendingSlice } from "@/features/planning/budgets/budget-spending-chart";
import { UnbudgetedList } from "@/features/planning/budgets/unbudgeted-list";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Money = components["schemas"]["Money"];

interface BudgetDetailsProps {
  loose: readonly { entry: CategoryEntry; total: Money }[];
  slices: readonly SpendingSlice[];
  currency: string;
  scale: (code: string) => number;
  loading: boolean;
}

// The month's evidence, closed until asked for: the spending no budget covers, with its total on
// the trigger, and where the spending went.
export function BudgetDetails({
  loose,
  slices,
  currency,
  scale,
  loading,
}: BudgetDetailsProps) {
  const t = useT();
  const fmt = useMoneyFormat();

  const total = loose.reduce((sum, r) => sum + r.total.amount, 0);

  return (
    <Accordion variant="framed" size="sm" multiple>
      <Collapsible value="unbudgeted">
        <CollapsibleHeader>
          <CollapsibleTrigger>
            {t("budget.groupLine", {
              name: t("budget.unbudgeted"),
              amount: fmt.money({ amount: total, currency }, scale(currency)),
            })}
          </CollapsibleTrigger>
        </CollapsibleHeader>

        <CollapsiblePanel>
          <UnbudgetedList rows={loose} scale={scale} />
        </CollapsiblePanel>
      </Collapsible>

      <Collapsible value="chart">
        <CollapsibleHeader>
          <CollapsibleTrigger>{t("budget.spendingChart")}</CollapsibleTrigger>
        </CollapsibleHeader>

        <CollapsiblePanel>
          <BudgetSpendingChart
            slices={slices}
            currency={currency}
            scale={scale(currency)}
            loading={loading}
          />
        </CollapsiblePanel>
      </Collapsible>
    </Accordion>
  );
}
