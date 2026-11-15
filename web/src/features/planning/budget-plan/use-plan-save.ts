import { toast } from "@slotted/react/toast";
import { useState } from "react";

import { ProblemError, errorText, fieldErrors } from "@/api/problem";
import { useSaveBudgetPlan } from "@/features/planning/api";
import type { usePlanDraft } from "@/features/planning/budget-plan/use-plan-draft";
import type { PlanFormat } from "@/features/planning/budget-plan/use-plan-format";
import { useT } from "@/i18n/i18n-provider";

interface Failure {
  message: string;
  invalid: ReadonlySet<string>;
}

// Saving the draft of a month (budget plan A130): a failure names the rows the server
// rejected; a success resets the draft and says so.
export function usePlanSave(
  draft: ReturnType<typeof usePlanDraft>,
  month: string,
  format: PlanFormat,
) {
  const t = useT();
  const save = useSaveBudgetPlan(month);
  const [failure, setFailure] = useState<Failure | null>(null);

  const run = () => {
    if (draft.pending === 0 || save.isPending) return;
    const body = draft.payload();
    save.mutate(body, {
      onSuccess: () => {
        draft.reset();
        setFailure(null);
        toast.show({
          tone: "success",
          title: t("plan.saved", { month: format.month(month) }),
        });
      },
      onError: (error) => {
        const invalid = new Set<string>();
        if (error instanceof ProblemError) {
          for (const field of Object.keys(fieldErrors(error.problem))) {
            const index = /^amounts\[(\d+)\]/.exec(field)?.[1];
            const id =
              index === undefined
                ? undefined
                : body.amounts[Number(index)]?.category_id;
            if (id !== undefined) invalid.add(id);
          }
        }
        setFailure({ message: errorText(error, t), invalid });
      },
    });
  };

  return {
    run,
    saving: save.isPending,
    failure,
    clearFailure: () => {
      setFailure(null);
    },
  };
}
