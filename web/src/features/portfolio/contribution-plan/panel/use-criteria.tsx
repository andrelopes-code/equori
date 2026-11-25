import { useState } from "react";

import { useEditContributionPlan } from "@/features/portfolio/api";
import {
  type PlanEdit,
  restore,
} from "@/features/portfolio/contribution-plan/panel/criteria-edits";
import { showUndo } from "@/features/portfolio/contribution-plan/panel/show-undo";
import { useT } from "@/i18n/i18n-provider";

export type Criteria = ReturnType<typeof useCriteria>;

interface SaveOptions {
  // The sentence of the notice that offers to undo the change; none is shown without it.
  undo?: string;
  onSaved?: () => void;
}

// The saves of the panel: each change is sent when it is made, and a failed one stays to be sent
// again (CO15).
export function useCriteria() {
  const t = useT();
  const edit = useEditContributionPlan();
  const [last, setLast] = useState<PlanEdit>();

  function save(change: PlanEdit, { undo, onSaved }: SaveOptions = {}) {
    setLast(() => change);
    edit.mutate(change, {
      onSuccess: ({ before, saved }) => {
        onSaved?.();
        if (undo === undefined) return;

        showUndo(undo, t("contributionPlan.panel.undo"), () => {
          save(restore(before, saved.revision));
        });
      },
    });
  }

  return {
    save,
    pending: edit.isPending,
    error: edit.error,
    dismiss: edit.reset,
    retry: () => {
      if (last !== undefined) save(last);
    },
  };
}
