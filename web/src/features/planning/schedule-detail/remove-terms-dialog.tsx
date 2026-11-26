import { Button } from "@slotted/react/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import { useState } from "react";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { useRemoveTerms } from "@/features/planning/api";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { FormNotice } from "@/ui/form-layout/form-notice";
import { useOverlayOpen } from "@/ui/dialogs/use-overlay-open";
import { useStableCallback } from "@/ui/runtime/use-stable-callback";

type Schedule = components["schemas"]["Schedule"];

interface RemoveTermsDialogProps {
  schedule: Schedule;
  effectiveFrom: string;
  onDone: () => void;
  onCancel: () => void;
}

// Removing the latest terms version applies the previous one again from its date (A269, TR3).
export function RemoveTermsDialog({
  schedule,
  effectiveFrom,
  onDone,
  onCancel,
}: RemoveTermsDialogProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const overlayOpen = useOverlayOpen();
  const remove = useRemoveTerms();

  const [error, setError] = useState<string | null>(null);

  const date = formatDate(effectiveFrom, locale);
  const openChange = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });

  function handleRemove() {
    setError(null);
    remove
      .mutateAsync({ id: schedule.id, effectiveFrom })
      .then(onDone)
      .catch((caught: unknown) => {
        setError(errorText(caught, t));
      });
  }

  return (
    <Dialog open={overlayOpen} size="sm" onOpenChange={openChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("schedule.terms.removeTitle", { date })}</DialogTitle>
          <DialogDescription>
            {t("schedule.terms.removeHint", { date })}
          </DialogDescription>
        </DialogHeader>

        {error !== null && (
          <DialogBody>
            <FormNotice>{error}</FormNotice>
          </DialogBody>
        )}

        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onCancel}>
            {t("detail.cancel")}
          </Button>
          <Button
            tone="danger"
            loading={remove.isPending}
            onClick={handleRemove}
          >
            {t("schedule.terms.remove")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
