import { Button } from "@slotted/react/button";

import { errorText } from "@/api/problem";
import { PlanMovedError, planChanged } from "@/features/portfolio/api";
import type { Criteria } from "@/features/portfolio/contribution-plan/panel/use-criteria";
import { useT } from "@/i18n/i18n-provider";
import { FormNotice } from "@/ui/form-layout/form-notice";

interface SaveNoticeProps {
  criteria: Criteria;
}

// A change that was not saved. The plan that changed elsewhere is read again, so only the others are sent
// again from here.
export function SaveNotice({ criteria }: SaveNoticeProps) {
  const t = useT();

  const { error } = criteria;
  if (error === null) return null;

  const moved = error instanceof PlanMovedError || planChanged(error);

  return (
    <FormNotice
      actions={
        moved ? undefined : (
          <Button size="sm" onClick={criteria.retry}>
            {t("contributionPlan.retry")}
          </Button>
        )
      }
    >
      {moved ? t("contributionPlan.panel.planMoved") : errorText(error, t)}
    </FormNotice>
  );
}
