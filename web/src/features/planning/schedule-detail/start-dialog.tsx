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
import { Field, FieldLabel } from "@slotted/react/field";
import { useState } from "react";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { useUpdateScheduleMatching } from "@/features/planning/api";
import { shiftDate } from "@/i18n/format";
import { useT } from "@/i18n/i18n-provider";
import { DateInput } from "@/ui/date-input";
import { FormLayout } from "@/ui/form-layout";
import { FormNotice } from "@/ui/form-notice";
import { useOverlayOpen } from "@/ui/use-overlay-open";
import { useStableCallback } from "@/ui/use-stable-callback";

type Schedule = components["schemas"]["Schedule"];

interface StartDialogProps {
  schedule: Schedule;
  onDone: () => void;
  onCancel: () => void;
}

// Moves the first date of a schedule before its current one; the server keeps the rule's rhythm.
export function StartDialog({ schedule, onDone, onCancel }: StartDialogProps) {
  const t = useT();
  const overlayOpen = useOverlayOpen();
  const update = useUpdateScheduleMatching();
  const current = schedule.terms[0]?.recurrence.start ?? "";
  const latest = shiftDate(current, -1);
  const [startsOn, setStartsOn] = useState(latest);
  const [error, setError] = useState<string | null>(null);
  const openChange = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });

  function handleSave() {
    setError(null);
    update
      .mutateAsync({ id: schedule.id, matching: { starts_on: startsOn } })
      .then(onDone)
      .catch((caught: unknown) => {
        setError(errorText(caught, t));
      });
  }

  return (
    <Dialog open={overlayOpen} size="md" onOpenChange={openChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("schedule.startEarlier")}</DialogTitle>
          <DialogDescription>
            {t("schedule.startEarlier.hint")}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <FormLayout>
            {error !== null && <FormNotice>{error}</FormNotice>}

            <Field required>
              <FieldLabel>{t("schedule.startEarlier.from")}</FieldLabel>
              <DateInput
                name="starts_on"
                value={startsOn}
                max={latest}
                onChange={setStartsOn}
              />
            </Field>
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
