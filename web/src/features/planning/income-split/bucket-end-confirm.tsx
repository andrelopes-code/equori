import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
} from "@slotted/react/alert";
import { Button } from "@slotted/react/button";

import { useMonthNames } from "@/features/planning/income-split/use-month-names";
import { useT } from "@/i18n/i18n-provider";

interface BucketEndConfirmProps {
  // The month the split ends in.
  month: string;
  // The end starts at the first version: every month loses the split.
  all: boolean;
  onEnd: () => void;
  onKeep: () => void;
}

// What ending the split erases, asked once before it happens.
export function BucketEndConfirm({
  month,
  all,
  onEnd,
  onKeep,
}: BucketEndConfirmProps) {
  const t = useT();
  const names = useMonthNames([]);
  const message = all
    ? t("buckets.endAllConfirm")
    : t("buckets.endConfirm", { month: names.longYear(month) });

  return (
    <Alert tone="danger">
      <AlertContent>
        <AlertDescription>{message}</AlertDescription>
      </AlertContent>
      <AlertActions>
        <Button onClick={onEnd}>{t("buckets.end")}</Button>
        <Button variant="ghost" onClick={onKeep}>
          {t("buckets.keep")}
        </Button>
      </AlertActions>
    </Alert>
  );
}
