import { DetailPanelSection } from "@slotted/react/detail-panel";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { payingGoal } from "@/features/goals/goal-expenses/paying-goal";
import {
  goalExpensesQuery,
  goalsQuery,
  useLinkGoalExpense,
  useUnlinkGoalExpense,
} from "@/features/planning";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/form-fields/choice-select";
import { FormNotice } from "@/ui/form-layout/form-notice";
import { compactQuery, useMediaQuery } from "@/ui/runtime/use-media-query";

type Transaction = components["schemas"]["Transaction"];

const none = "none";

interface GoalPaymentSectionProps {
  transaction: Transaction;
  // The transaction holds an expense posting and is not voided.
  expense: boolean;
}

// Which goal paid an expense (planning coherence A256): the expense then counts against neither
// its budget nor its bucket. Draws nothing for another transaction, for a book without goals and
// on a phone, where the goals are not served (ADR 027).
export function GoalPaymentSection({
  transaction,
  expense,
}: GoalPaymentSectionProps) {
  const t = useT();
  const api = useApi();
  const phone = useMediaQuery(compactQuery);
  const enabled = expense && !phone;
  const goals = useQuery({ ...goalsQuery(api), enabled });
  const expenses = useQueries({
    queries: (goals.data ?? []).map((g) => ({
      ...goalExpensesQuery(api, g.id),
      enabled,
    })),
  });
  const link = useLinkGoalExpense();
  const unlink = useUnlinkGoalExpense();
  const [error, setError] = useState<string | null>(null);

  if (!enabled || goals.data === undefined || goals.data.length === 0)
    return null;

  const paying = payingGoal(
    goals.data.map((g, i) => ({ goal: g, expenses: expenses[i]?.data ?? [] })),
    transaction.id,
  );

  const handleChange = (next: string | string[] | null) => {
    if (typeof next !== "string" || next === (paying?.goal.id ?? none)) return;

    setError(null);
    const write =
      next === none
        ? unlink.mutateAsync({
            goal: paying?.goal.id ?? "",
            transaction: transaction.id,
          })
        : link.mutateAsync({ goal: next, transaction: transaction.id });
    write.catch((caught: unknown) => {
      setError(errorText(caught, t));
    });
  };

  return (
    <DetailPanelSection name="goal" label={t("detail.goal")}>
      <Stack gap={2}>
        {paying?.direct === true && (
          <Text size="sm">
            {t("detail.goal.direct", { name: paying.goal.name })}
          </Text>
        )}

        {paying?.direct !== true && (
          <ChoiceSelect
            label={t("detail.goal.label")}
            multiple={false}
            value={paying?.goal.id ?? none}
            readOnly={link.isPending || unlink.isPending}
            choices={[
              { value: none, label: t("detail.goal.none") },
              ...goals.data.map((g) => ({ value: g.id, label: g.name })),
            ]}
            onChange={handleChange}
          />
        )}

        {error !== null && <FormNotice>{error}</FormNotice>}
      </Stack>
    </DetailPanelSection>
  );
}
