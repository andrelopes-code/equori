import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
} from "@slotted/react/alert";

import { useT } from "@/i18n/i18n-provider";

interface PlanSaveFailureProps {
  message: string;
}

// The failure of the last save, in the danger tone.
export function PlanSaveFailure({ message }: PlanSaveFailureProps) {
  const t = useT();

  return (
    <Alert tone="danger">
      <AlertContent>
        <AlertTitle>{t("plan.saveFailed")}</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </AlertContent>
    </Alert>
  );
}
