import { Button } from "@slotted/react/button";

import { useT } from "@/i18n/i18n-provider";
import { FormNotice } from "@/ui/form-layout/form-notice";

interface PlanLoadFailedProps {
  onRetry: () => void;
}

export function PlanLoadFailed({ onRetry }: PlanLoadFailedProps) {
  const t = useT();

  return (
    <FormNotice
      actions={<Button onClick={onRetry}>{t("contributionPlan.retry")}</Button>}
    >
      {t("contributionPlan.loadFailed")}
    </FormNotice>
  );
}
