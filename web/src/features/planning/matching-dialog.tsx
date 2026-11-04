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
import { useUpdateScheduleMatching } from "@/features/planning/api";
import {
  MatchingFields,
  type MatchingValues,
} from "@/features/planning/matching-fields";
import { useT } from "@/i18n/i18n-provider";
import { FormNotice } from "@/ui/form-notice";
import { FormLayout } from "@/ui/form-layout";
import { useOverlayOpen } from "@/ui/use-overlay-open";
import { useStableCallback } from "@/ui/use-stable-callback";

type Schedule = components["schemas"]["Schedule"];

interface MatchingDialogProps {
  schedule: Schedule;
  onDone: () => void;
  onCancel: () => void;
}

// The three matching settings of a schedule; a change reaches only transactions recorded later.
export function MatchingDialog({
  schedule,
  onDone,
  onCancel,
}: MatchingDialogProps) {
  const t = useT();
  const overlayOpen = useOverlayOpen();
  const update = useUpdateScheduleMatching();
  const [values, setValues] = useState<MatchingValues>({
    toleranceBP: schedule.match_tolerance_bp,
    windowDays: schedule.match_window_days,
    graceDays: schedule.grace_days,
  });
  const [error, setError] = useState<string | null>(null);
  const openChange = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });

  function handleSave() {
    setError(null);
    update
      .mutateAsync({
        id: schedule.id,
        matching: {
          match_tolerance_bp: values.toleranceBP,
          grace_days: values.graceDays,
          match_window_days: values.windowDays,
        },
      })
      .then(onDone)
      .catch((caught: unknown) => {
        setError(errorText(caught, t));
      });
  }

  return (
    <Dialog open={overlayOpen} size="md" onOpenChange={openChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("schedule.matching.edit")}</DialogTitle>
          <DialogDescription>
            {t("schedule.matching.appliesLater")}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <FormLayout>
            {error !== null && <FormNotice>{error}</FormNotice>}

            <MatchingFields
              values={values}
              patch={(change) => {
                setValues((current) => ({ ...current, ...change }));
              }}
            />
          </FormLayout>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onCancel}>
            {t("detail.cancel")}
          </Button>
          <Button loading={update.isPending} onClick={handleSave}>
            {t("schedule.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
