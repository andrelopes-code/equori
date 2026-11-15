import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
} from "@slotted/react/alert";
import { Button } from "@slotted/react/button";

import { useT } from "@/i18n/i18n-provider";

interface PlanNoticesProps {
  hidden: boolean;
  past: boolean;
  onShowAmounts: () => void;
}

// What the plan cannot do now: amounts hidden by privacy mode, a past month read-only.
export function PlanNotices({ hidden, past, onShowAmounts }: PlanNoticesProps) {
  const t = useT();

  return (
    <>
      {hidden && (
        <Alert tone="info">
          <AlertContent>
            <AlertDescription>{t("plan.privacy")}</AlertDescription>
          </AlertContent>
          <AlertActions>
            <Button onClick={onShowAmounts}>{t("plan.showAmounts")}</Button>
          </AlertActions>
        </Alert>
      )}
      {past && (
        <Alert tone="secondary">
          <AlertContent>
            <AlertDescription>{t("plan.pastMonth")}</AlertDescription>
          </AlertContent>
        </Alert>
      )}
    </>
  );
}
