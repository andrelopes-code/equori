import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
} from "@slotted/react/alert";
import { Button } from "@slotted/react/button";

import { useT } from "@/i18n/i18n-provider";

interface BucketRemoveConfirmProps {
  onRemove: () => void;
  onKeep: () => void;
}

// What removing the split erases, asked once before it happens.
export function BucketRemoveConfirm({
  onRemove,
  onKeep,
}: BucketRemoveConfirmProps) {
  const t = useT();

  return (
    <Alert tone="danger">
      <AlertContent>
        <AlertDescription>{t("buckets.removeConfirm")}</AlertDescription>
      </AlertContent>
      <AlertActions>
        <Button onClick={onRemove}>{t("buckets.removeAll")}</Button>
        <Button variant="ghost" onClick={onKeep}>
          {t("buckets.keep")}
        </Button>
      </AlertActions>
    </Alert>
  );
}
